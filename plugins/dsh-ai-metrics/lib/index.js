/**
 * Host half: same-origin proxies for metrics + plugins-data config store.
 * - /jetson-metrics-api/* → metrics upstream (optional)
 * - /jetson-switcher-api/* → model switcher (clear-cache, health)
 * - /ollama-metrics-api/* → Ollama (browser cannot hit :11434 directly — CORS)
 * - auto-sync switcher /v1/models + Ollama /api/tags → matching llm-pi-ai providers
 *
 * Upstream URLs: plugins-data → env → empty (never hardcode LAN IPs in code).
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { registerRpcChannel } from "dsh-ide-shared/register-rpc-channel.js";
import {
	startJetsonModelSync,
	syncJetsonModels,
	requestModelCatalogSync,
} from "./jetson-model-sync.js";

const name = "dsh-ai-metrics";
const inject = ["webServer", "connection", "settings"];
const PROXY_PREFIX = "/jetson-metrics-api";
const SWITCHER_PROXY_PREFIX = "/jetson-switcher-api";
const OLLAMA_PROXY_PREFIX = "/ollama-metrics-api";
const RPC_CHANNEL = "/ai-metrics-config";
/** Periodic catalog sync; set DSH_JETSON_MODEL_SYNC_MS=0 to disable. Default 60s. */
const DEFAULT_SYNC_MS = 60_000;

/** Live proxy targets — updated when config is saved / migrated. */
const liveUpstreams = {
	metrics: "",
	switcher: "",
	ollama: "",
};

function sendJson(res, status, body) {
	const buf = Buffer.from(JSON.stringify(body), "utf8");
	res.writeHead(status, {
		"content-type": "application/json; charset=utf-8",
		"content-length": buf.length,
		"cache-control": "no-store",
	});
	res.end(buf);
}

function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-ai-metrics.json");
}

function ok(value) {
	return { ok: true, value };
}

function transportError(error) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error),
			details: {},
		},
	};
}

function trimUrl(v) {
	return String(v || "").trim().replace(/\/+$/, "");
}

function envUpstream(name, fallback = "") {
	return trimUrl(process.env[name] || fallback);
}

/**
 * Normalize widget + upstream fields. Does not invent LAN defaults.
 * @param {unknown} raw
 */
function normalizeUserConfig(raw) {
	const o = raw && typeof raw === "object" ? /** @type {Record<string, unknown>} */ (raw) : {};
	return {
		adapter: typeof o.adapter === "string" ? o.adapter : "off",
		url: typeof o.url === "string" ? o.url : "/jetson-metrics-api/api/ai/active",
		label: typeof o.label === "string" && o.label.trim() ? o.label.trim() : "AI RAM",
		clickUrl: typeof o.clickUrl === "string" ? o.clickUrl : "",
		totalBytes: o.totalBytes != null ? String(o.totalBytes) : "",
		colors: o.colors && typeof o.colors === "object" ? o.colors : {},
		metricsUpstream: trimUrl(o.metricsUpstream),
		switcherUpstream: trimUrl(o.switcherUpstream),
		ollamaUpstream: trimUrl(o.ollamaUpstream),
	};
}

async function loadStore() {
	try {
		const raw = JSON.parse(await readFile(configPath(), "utf8"));
		const config = raw && typeof raw.config === "object" && raw.config ? raw.config : null;
		const initialized = typeof raw?.initialized === "boolean" ? raw.initialized : config !== null;
		return { initialized, config };
	} catch {
		return { initialized: false, config: null };
	}
}

async function saveStore(cfg) {
	const p = configPath();
	await mkdir(dirname(p), { recursive: true });
	const clean = normalizeUserConfig(cfg);
	await writeFile(p, `${JSON.stringify({ initialized: true, config: clean }, null, 2)}\n`, "utf8");
	applyLiveUpstreams(clean);
	return clean;
}

function applyLiveUpstreams(cfg) {
	liveUpstreams.metrics = trimUrl(cfg?.metricsUpstream) || envUpstream("JETSON_METRICS_URL");
	liveUpstreams.switcher = trimUrl(cfg?.switcherUpstream) || envUpstream("JETSON_SWITCHER_URL");
	liveUpstreams.ollama = trimUrl(cfg?.ollamaUpstream) || envUpstream("OLLAMA_BASE_URL");
}

/**
 * One-time: if store lacks upstream fields, seed from env (or leave empty).
 * Existing ProDesk installs that already have widget config keep labels/colors
 * and gain upstreams from env when present.
 */
async function migrateAndLoadConfig() {
	const store = await loadStore();
	let cfg = normalizeUserConfig(store.config || {});
	let changed = false;

	const envMetrics = envUpstream("JETSON_METRICS_URL");
	const envSwitcher = envUpstream("JETSON_SWITCHER_URL");
	const envOllama = envUpstream("OLLAMA_BASE_URL");

	if (!cfg.metricsUpstream && envMetrics) {
		cfg.metricsUpstream = envMetrics;
		changed = true;
	}
	if (!cfg.switcherUpstream && envSwitcher) {
		cfg.switcherUpstream = envSwitcher;
		changed = true;
	}
	if (!cfg.ollamaUpstream && envOllama) {
		cfg.ollamaUpstream = envOllama;
		changed = true;
	}

	// Legacy: initialized jetson widget but no upstream keys yet — seed from
	// env only. If env empty, leave blank (user configures in Settings).
	if (store.initialized && store.config && !("metricsUpstream" in (store.config || {}))) {
		changed = true;
	}

	if (changed || (store.initialized && store.config && !("metricsUpstream" in store.config))) {
		cfg = await saveStore({ ...store.config, ...cfg });
	} else {
		applyLiveUpstreams(cfg);
	}
	return { initialized: store.initialized || changed, config: cfg };
}

function syncIntervalMs() {
	const raw = process.env.DSH_JETSON_MODEL_SYNC_MS;
	if (raw === undefined || raw === "") return DEFAULT_SYNC_MS;
	const n = Number(raw);
	if (!Number.isFinite(n) || n < 0) return DEFAULT_SYNC_MS;
	return Math.round(n);
}

function registerRpc(ctx) {
	return registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
		try {
			if (endpoint === "loadConfig") {
				const store = await loadStore();
				const config = store.config ? normalizeUserConfig(store.config) : null;
				if (config) applyLiveUpstreams(config);
				return ok({ config, initialized: store.initialized });
			}
			if (endpoint === "saveConfig") {
				const clean = await saveStore(payload?.config);
				// Upstream URLs may have changed — refresh Harness model dropdowns.
				void requestModelCatalogSync({
					ctx,
					switcherBase: liveUpstreams.switcher,
					ollamaBase: liveUpstreams.ollama,
					force: true,
					log: (msg) => ctx.logger?.info?.(msg),
				});
				return ok({ config: clean });
			}
			if (endpoint === "syncConfig") {
				const store = await loadStore();
				const clientCfg = payload?.config && typeof payload.config === "object" ? payload.config : null;
				if (!store.initialized && clientCfg) {
					const saved = await saveStore(clientCfg);
					return ok({ config: saved, migrated: true });
				}
				const config = store.config ? normalizeUserConfig(store.config) : null;
				if (config) applyLiveUpstreams(config);
				return ok({ config, migrated: false });
			}
			if (endpoint === "syncModelCatalog" || endpoint === "syncJetsonModels") {
				const result = await requestModelCatalogSync({
					ctx,
					switcherBase: liveUpstreams.switcher,
					ollamaBase: liveUpstreams.ollama,
					// Legacy: syncJetsonModels with only switcher still works when ollama unset
					force: Boolean(payload?.force ?? true),
					log: (msg) => ctx.logger?.info?.(msg),
				});
				return ok(result);
			}
			throw new Error(`unknown endpoint: ${endpoint}`);
		} catch (error) {
			return transportError(error);
		}
	});
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {{ prefix: string, getBase: () => string, label: string, timeoutMs?: number, allowMethods?: string[] }} opts
 */
function makePrefixProxy(ctx, { prefix, getBase, label, timeoutMs = 20_000, allowMethods = ["GET", "HEAD"] }) {
	const allowed = new Set(allowMethods.map((m) => m.toUpperCase()));
	return async (req, res) => {
		try {
			const base = trimUrl(getBase());
			if (!base) {
				sendJson(res, 503, {
					ok: false,
					error: "upstream not configured",
					detail: `Set ${label} URL in Settings → AI Metrics (or env).`,
				});
				return;
			}
			const method = (req.method || "GET").toUpperCase();
			if (!allowed.has(method)) {
				sendJson(res, 405, { ok: false, error: "method not allowed" });
				return;
			}
			const url = new URL(req.url || "/", "http://localhost");
			if (!url.pathname.startsWith(prefix)) {
				sendJson(res, 404, { ok: false, error: "not found" });
				return;
			}
			const suffix = url.pathname.slice(prefix.length) || "/";
			const target = new URL(suffix + url.search, `${base}/`);
			if (target.origin !== new URL(base).origin) {
				sendJson(res, 400, { ok: false, error: "refusing proxy escape" });
				return;
			}

			const slow = method === "POST" && /\/clear-cache\/?$/.test(suffix);
			const upstream = await fetch(target, {
				method,
				headers: { accept: "application/json", "content-type": "application/json" },
				signal: AbortSignal.timeout(slow ? 120_000 : timeoutMs),
			});
			const buf = Buffer.from(await upstream.arrayBuffer());
			res.writeHead(upstream.status, {
				"content-type": upstream.headers.get("content-type") || "application/json; charset=utf-8",
				"content-length": buf.length,
				"cache-control": "no-store",
			});
			if (method === "HEAD") {
				res.end();
				return;
			}
			res.end(buf);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.logger?.warn?.(`[${name}] ${label} proxy failed: ${message}`);
			sendJson(res, 502, { ok: false, error: "upstream unreachable", detail: message });
		}
	};
}

function apply(ctx) {
	// Fire-and-forget migrate so first requests see seeded upstreams when env is set.
	void migrateAndLoadConfig().catch((err) => {
		ctx.logger?.warn?.(
			`[${name}] config migrate failed: ${err instanceof Error ? err.message : err}`,
		);
		applyLiveUpstreams({});
	});

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: PROXY_PREFIX,
				handler: makePrefixProxy(ctx, {
					prefix: PROXY_PREFIX,
					getBase: () => liveUpstreams.metrics,
					label: "metrics",
				}),
			}),
		`${name}: jetson-metrics proxy`,
	);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: SWITCHER_PROXY_PREFIX,
				handler: makePrefixProxy(ctx, {
					prefix: SWITCHER_PROXY_PREFIX,
					getBase: () => liveUpstreams.switcher,
					label: "switcher",
					timeoutMs: 15_000,
					allowMethods: ["GET", "HEAD", "POST"],
				}),
			}),
		`${name}: jetson-switcher proxy`,
	);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: OLLAMA_PROXY_PREFIX,
				handler: makePrefixProxy(ctx, {
					prefix: OLLAMA_PROXY_PREFIX,
					getBase: () => liveUpstreams.ollama,
					label: "ollama",
					timeoutMs: 8_000,
				}),
			}),
		`${name}: ollama-metrics proxy`,
	);

	ctx.inject(["connection", "webServer", "settings"], (scope) => {
		scope.effect(() => registerRpc(scope), `${name}: rpc`);
		scope.effect(
			() =>
				startJetsonModelSync({
					ctx: scope,
					getSwitcherBase: () => liveUpstreams.switcher,
					getOllamaBase: () => liveUpstreams.ollama,
					getUpstreamBase: () => liveUpstreams.switcher,
					upstreamBase: liveUpstreams.switcher,
					intervalMs: syncIntervalMs(),
					log: (msg) => scope.logger?.info?.(msg) ?? console.info(msg),
				}),
			`${name}: model catalog sync`,
		);
	});
}

export { apply, name, inject, liveUpstreams, normalizeUserConfig };
export default { name, inject, apply };

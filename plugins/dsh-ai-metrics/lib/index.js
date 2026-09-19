/**
 * Host half: same-origin proxies for metrics + plugins-data config store.
 * - /jetson-metrics-api/* → Jetson metrics-api (optional)
 * - /ollama-metrics-api/* → host Ollama (browser cannot hit :11434 directly — CORS)
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";

const name = "dsh-ai-metrics";
const inject = ["webServer", "connection"];
const PROXY_PREFIX = "/jetson-metrics-api";
const OLLAMA_PROXY_PREFIX = "/ollama-metrics-api";
const DEFAULT_UPSTREAM = "http://192.168.0.146:8001";
/** Docker→host bridge; override with OLLAMA_BASE_URL (e.g. http://192.168.0.50:11434). */
const DEFAULT_OLLAMA_UPSTREAM = "http://172.17.0.1:11434";
const RPC_CHANNEL = "/ai-metrics-config";

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
	const clean = cfg && typeof cfg === "object" ? cfg : {};
	await writeFile(p, `${JSON.stringify({ initialized: true, config: clean }, null, 2)}\n`, "utf8");
	return clean;
}

function registerRpc(ctx) {
	return registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
			try {
				if (endpoint === "loadConfig") {
					const store = await loadStore();
					return ok({ config: store.config, initialized: store.initialized });
				}
				if (endpoint === "saveConfig") {
					const clean = await saveStore(payload?.config);
					return ok({ config: clean });
				}
				if (endpoint === "syncConfig") {
					const store = await loadStore();
					const clientCfg = payload?.config && typeof payload.config === "object" ? payload.config : null;
					if (!store.initialized && clientCfg) {
						const saved = await saveStore(clientCfg);
						return ok({ config: saved, migrated: true });
					}
					return ok({ config: store.config, migrated: false });
				}
				throw new Error(`unknown endpoint: ${endpoint}`);
			} catch (error) {
				return transportError(error);
			}
		});
}

function makePrefixProxy(ctx, { prefix, upstreamBase, label, timeoutMs = 20_000 }) {
	const base = String(upstreamBase || "").replace(/\/+$/, "");
	return async (req, res) => {
		try {
			const method = (req.method || "GET").toUpperCase();
			if (method !== "GET" && method !== "HEAD") {
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

			const upstream = await fetch(target, {
				method,
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(timeoutMs),
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
			sendJson(res, 502, { ok: false, error: "upstream metrics unreachable", detail: message });
		}
	};
}

function apply(ctx) {
	const jetsonUpstream = (process.env.JETSON_METRICS_URL || DEFAULT_UPSTREAM).replace(/\/+$/, "");
	const ollamaUpstream = (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_UPSTREAM).replace(/\/+$/, "");

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: PROXY_PREFIX,
				handler: makePrefixProxy(ctx, {
					prefix: PROXY_PREFIX,
					upstreamBase: jetsonUpstream,
					label: "jetson metrics",
				}),
			}),
		`${name}: jetson-metrics proxy`,
	);

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: OLLAMA_PROXY_PREFIX,
				handler: makePrefixProxy(ctx, {
					prefix: OLLAMA_PROXY_PREFIX,
					upstreamBase: ollamaUpstream,
					label: "ollama metrics",
					timeoutMs: 8_000,
				}),
			}),
		`${name}: ollama-metrics proxy`,
	);

	ctx.inject(["connection", "webServer"], (scope) => {
		scope.effect(() => registerRpc(scope), `${name}: rpc`);
	});
}

export { apply, name, inject };
export default { name, inject, apply };

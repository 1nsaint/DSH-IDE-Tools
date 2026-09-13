/**
 * Host half: same-origin proxy for /jetson-metrics-api/* → Jetson metrics-api,
 * plus centralized storage for metrics configuration in plugins-data/dsh-ai-metrics.json.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const name = "dsh-ai-metrics";
const inject = ["webServer"];
const PROXY_PREFIX = "/jetson-metrics-api";
const DEFAULT_UPSTREAM = "http://192.168.0.146:8001";
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
	return ctx.connection.rpc.handle(
		RPC_CHANNEL,
		async (endpoint, payload) => {
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
		},
		{ authority: "loopback" }
	);
}

function apply(ctx) {
	const upstreamBase = DEFAULT_UPSTREAM.replace(/\/+$/, "");

	const handler = async (req, res) => {
		try {
			const method = (req.method || "GET").toUpperCase();
			if (method !== "GET" && method !== "HEAD") {
				sendJson(res, 405, { ok: false, error: "method not allowed" });
				return;
			}
			const url = new URL(req.url || "/", "http://localhost");
			if (!url.pathname.startsWith(PROXY_PREFIX)) {
				sendJson(res, 404, { ok: false, error: "not found" });
				return;
			}
			const suffix = url.pathname.slice(PROXY_PREFIX.length) || "/";
			const target = new URL(suffix + url.search, `${upstreamBase}/`);
			if (target.origin !== new URL(upstreamBase).origin) {
				sendJson(res, 400, { ok: false, error: "refusing proxy escape" });
				return;
			}

			const upstream = await fetch(target, {
				method,
				headers: { accept: "application/json" },
				signal: AbortSignal.timeout(8_000),
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
			ctx.logger?.warn?.(`[${name}] jetson metrics proxy failed: ${message}`);
			sendJson(res, 502, { ok: false, error: "upstream metrics unreachable", detail: message });
		}
	};

	ctx.effect(
		() =>
			ctx.webServer.register({
				kind: "prefix",
				path: PROXY_PREFIX,
				handler,
			}),
		`${name}: jetson-metrics proxy`,
	);

	ctx.inject(["connection"], (scope) => {
		scope.effect(() => registerRpc(scope), `${name}: rpc`);
	});
}

export { apply, name, inject };
export default { name, inject, apply };

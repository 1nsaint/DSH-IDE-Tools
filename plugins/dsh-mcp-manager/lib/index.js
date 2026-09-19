/**
 * dsh-mcp-manager — host: persist MCP server entries and mount one
 * `@deepseek-ai/dsh-mcp-client` fiber per enabled server (stdio or HTTP).
 */
import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { pathToFileURL } from "node:url";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";

const name = "dsh-mcp-manager";
/** tools comes from the parent agent scope — child mcp-client fibers inject it. */
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/mcp-manager";
const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

/** @type {Map<string, { fiber: any, serverName: string }>} */
const live = new Map();

function storePath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-mcp-servers.json");
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

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   enabled: boolean,
 *   serverName: string,
 *   transport: "stdio" | "streamable-http",
 *   command?: string,
 *   args?: string[],
 *   env?: Record<string, string>,
 *   cwd?: string,
 *   url?: string,
 *   headers?: Record<string, string>,
 *   toolCallTimeoutMs?: number,
 *   status?: string,
 *   lastError?: string | null,
 * }} McpServerEntry
 */

/** @returns {Promise<{ servers: McpServerEntry[] }>} */
async function loadStore() {
	try {
		const raw = JSON.parse(await readFile(storePath(), "utf8"));
		const servers = Array.isArray(raw?.servers) ? raw.servers.map(normalizeEntry).filter(Boolean) : [];
		return { servers };
	} catch {
		return { servers: [] };
	}
}

/** @param {{ servers: McpServerEntry[] }} store */
async function saveStore(store) {
	const p = storePath();
	await mkdir(dirname(p), { recursive: true });
	const servers = (store.servers || []).map(normalizeEntry).filter(Boolean);
	await writeFile(p, `${JSON.stringify({ servers }, null, 2)}\n`, "utf8");
	return { servers };
}

/** @param {unknown} raw @returns {McpServerEntry | null} */
function normalizeEntry(raw) {
	if (!raw || typeof raw !== "object") return null;
	const o = /** @type {Record<string, unknown>} */ (raw);
	const id = typeof o.id === "string" && o.id ? o.id : randomUUID();
	const label = typeof o.label === "string" ? o.label.trim() : "";
	const serverName = typeof o.serverName === "string" ? o.serverName.trim() : "";
	const transport = o.transport === "streamable-http" ? "streamable-http" : "stdio";
	if (!label || !SERVER_NAME_RE.test(serverName)) return null;

	/** @type {McpServerEntry} */
	const entry = {
		id,
		label,
		enabled: Boolean(o.enabled),
		serverName,
		transport,
		toolCallTimeoutMs: typeof o.toolCallTimeoutMs === "number" && o.toolCallTimeoutMs > 0
			? Math.floor(o.toolCallTimeoutMs)
			: 60_000,
		status: typeof o.status === "string" ? o.status : "stopped",
		lastError: typeof o.lastError === "string" ? o.lastError : null,
	};

	if (transport === "stdio") {
		const command = typeof o.command === "string" ? o.command.trim() : "";
		if (!command) return null;
		entry.command = command;
		entry.args = Array.isArray(o.args)
			? o.args.map((a) => String(a))
			: typeof o.args === "string"
				? splitArgs(o.args)
				: [];
		entry.env = isStringDict(o.env) ? { ...o.env } : {};
		entry.cwd = typeof o.cwd === "string" ? o.cwd : "";
	} else {
		const url = typeof o.url === "string" ? o.url.trim() : "";
		if (!url) return null;
		entry.url = url;
		entry.headers = isStringDict(o.headers) ? { ...o.headers } : {};
	}
	return entry;
}

/** @param {unknown} v @returns {v is Record<string, string>} */
function isStringDict(v) {
	if (!v || typeof v !== "object" || Array.isArray(v)) return false;
	return Object.values(v).every((x) => typeof x === "string");
}

/** @param {string} text */
function splitArgs(text) {
	const out = [];
	const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
	let m;
	while ((m = re.exec(text))) {
		out.push((m[1] ?? m[2] ?? m[3] ?? "").replace(/\\(["'\\])/g, "$1"));
	}
	return out;
}

/** @param {McpServerEntry} entry */
function toMcpConfig(entry) {
	const base = {
		serverName: entry.serverName,
		toolCallTimeoutMs: entry.toolCallTimeoutMs ?? 60_000,
		failOnStartupError: false,
	};
	if (entry.transport === "streamable-http") {
		return {
			...base,
			transport: "streamable-http",
			url: entry.url,
			headers: entry.headers || {},
		};
	}
	return {
		...base,
		transport: "stdio",
		command: entry.command,
		args: entry.args || [],
		env: entry.env || {},
		cwd: entry.cwd || "",
	};
}

/** @returns {Promise<any>} */
async function loadMcpClientModule() {
	try {
		return await import("@deepseek-ai/dsh-mcp-client");
	} catch (first) {
		// Fall back to profile-hoisted path when resolved from a linked plugin.
		const home = process.env.DSH_HOME || join(homedir(), ".dsh");
		const candidates = [
			join(home, "profiles", "node_modules", "@deepseek-ai", "dsh-mcp-client", "lib", "index.js"),
			join(home, "profiles", "web", "node_modules", "@deepseek-ai", "dsh-mcp-client", "lib", "index.js"),
		];
		for (const p of candidates) {
			try {
				return await import(pathToFileURL(p).href);
			} catch {
				/* try next */
			}
		}
		throw first;
	}
}

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {McpServerEntry} entry
 */
async function startFiber(ctx, entry) {
	await stopFiber(entry.id);
	const mcp = await loadMcpClientModule();
	const config = toMcpConfig(entry);
	const fiber = ctx.registry.plugin(mcp, config);
	live.set(entry.id, { fiber, serverName: entry.serverName });
	try {
		await fiber;
		entry.status = "running";
		entry.lastError = null;
	} catch (err) {
		entry.status = "error";
		entry.lastError = err instanceof Error ? err.message : String(err);
		await stopFiber(entry.id);
		throw err;
	}
}

/** @param {string} id */
async function stopFiber(id) {
	const row = live.get(id);
	if (!row) return;
	live.delete(id);
	try {
		const result = row.fiber.dispose?.();
		if (result && typeof result.then === "function") await result;
	} catch {
		/* ignore dispose races */
	}
}

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {McpServerEntry[]} servers
 */
async function syncLive(ctx, servers, { forceRestartIds = [] } = {}) {
	const force = new Set(forceRestartIds);
	const want = new Set(servers.filter((s) => s.enabled).map((s) => s.id));
	for (const id of [...live.keys()]) {
		if (!want.has(id) || force.has(id)) await stopFiber(id);
	}
	for (const entry of servers) {
		if (!entry.enabled) {
			entry.status = "stopped";
			entry.lastError = null;
			continue;
		}
		const existing = live.get(entry.id);
		if (existing && existing.serverName === entry.serverName && !force.has(entry.id)) {
			entry.status = "running";
			continue;
		}
		entry.status = "starting";
		entry.lastError = null;
		try {
			await startFiber(ctx, entry);
		} catch (err) {
			entry.status = "error";
			entry.lastError = err instanceof Error ? err.message : String(err);
		}
	}
}

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {McpServerEntry[]} servers
 * @param {McpServerEntry} next
 */
function assertUniqueServerName(servers, next) {
	const clash = servers.find((s) => s.id !== next.id && s.serverName === next.serverName);
	if (clash) throw new Error(`serverName "${next.serverName}" already used by "${clash.label}"`);
}

function apply(ctx) {
	/** @type {McpServerEntry[]} */
	let servers = [];
	let ready = (async () => {
		const store = await loadStore();
		servers = store.servers;
		await syncLive(ctx, servers);
		await saveStore({ servers });
	})().catch((err) => {
		ctx.logger?.error?.(`[${name}] startup sync failed: ${err instanceof Error ? err.message : err}`);
	});

	ctx.effect(() => () => {
		for (const id of [...live.keys()]) {
			void stopFiber(id);
		}
	}, `${name}.dispose-all`);

	registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
		try {
			await ready;
			if (endpoint === "list") {
				return ok({
					servers: servers.map((s) => ({
						...s,
						status: live.has(s.id) ? "running" : s.status || "stopped",
					})),
					presets: PRESETS,
				});
			}
			if (endpoint === "upsert") {
				const entry = normalizeEntry(payload?.server);
				if (!entry) throw new Error("invalid server entry");
				assertUniqueServerName(servers, entry);
				const idx = servers.findIndex((s) => s.id === entry.id);
				if (idx >= 0) servers[idx] = { ...servers[idx], ...entry, id: entry.id };
				else servers.push(entry);
				await syncLive(ctx, servers, { forceRestartIds: [entry.id] });
				await saveStore({ servers });
				return ok({ server: servers.find((s) => s.id === entry.id) });
			}
			if (endpoint === "remove") {
				const id = typeof payload?.id === "string" ? payload.id : "";
				if (!id) throw new Error("id required");
				await stopFiber(id);
				servers = servers.filter((s) => s.id !== id);
				await saveStore({ servers });
				return ok({ removed: id });
			}
			if (endpoint === "setEnabled") {
				const id = typeof payload?.id === "string" ? payload.id : "";
				const enabled = Boolean(payload?.enabled);
				const entry = servers.find((s) => s.id === id);
				if (!entry) throw new Error("server not found");
				entry.enabled = enabled;
				await syncLive(ctx, servers);
				await saveStore({ servers });
				return ok({ server: entry });
			}
			if (endpoint === "restart") {
				const id = typeof payload?.id === "string" ? payload.id : "";
				const entry = servers.find((s) => s.id === id);
				if (!entry) throw new Error("server not found");
				if (!entry.enabled) throw new Error("server is disabled");
				await stopFiber(id);
				entry.status = "starting";
				try {
					await startFiber(ctx, entry);
				} catch (err) {
					entry.status = "error";
					entry.lastError = err instanceof Error ? err.message : String(err);
				}
				await saveStore({ servers });
				return ok({ server: entry });
			}
			throw new Error(`unknown endpoint: ${endpoint}`);
		} catch (error) {
			return transportError(error);
		}
	});
}

const PRESETS = [
	{
		id: "blender",
		label: "Blender (mcp-for-blender)",
		serverName: "blender",
		transport: "stdio",
		command: "uvx",
		args: ["mcp-for-blender"],
		env: { BLENDER_HOST: "192.168.0.1" },
		hint: "Start the Blender MCP addon on the Windows PC first. Set BLENDER_HOST to that PC's LAN IP.",
	},
	{
		id: "npx-custom",
		label: "npx package…",
		serverName: "npx",
		transport: "stdio",
		command: "npx",
		args: ["-y", "@modelcontextprotocol/server-everything"],
		env: {},
		hint: "Runs an npm MCP package inside the Harness container via npx.",
	},
	{
		id: "http",
		label: "HTTP / Streamable MCP",
		serverName: "remote",
		transport: "streamable-http",
		url: "http://192.168.0.1:3000/mcp",
		headers: {},
		hint: "Paste a streamable-http MCP URL (LAN or tunnel).",
	},
];

export { apply, inject, name };

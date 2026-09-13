/**
 * dsh-terminal — host half: node-pty sessions with poll-based I/O over RPC.
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const name = "dsh-terminal";
const RPC_CHANNEL = "/terminal";
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, "vendor");

const ASSETS = {
	"xterm.js": { file: "xterm.js", mime: "application/javascript" },
	"xterm.css": { file: "xterm.css", mime: "text/css" },
	"addon-fit.js": { file: "addon-fit.js", mime: "application/javascript" },
};

function loadPty() {
	const candidates = [
		"/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/node-pty",
		"node-pty",
	];
	for (const id of candidates) {
		try {
			if (id.startsWith("/") && !existsSync(id)) continue;
			return require(id);
		} catch {
			/* try next */
		}
	}
	throw new Error("node-pty not available in this image");
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

function resolveTerminalCwd(ctx, sessionId, workspaceCwd) {
	if (typeof sessionId === "string" && sessionId.trim()) {
		try {
			const sessions = ctx.get?.("sessions");
			const session = sessions?.get?.(sessionId.trim());
			const cwd = session?.header?.cwd;
			if (typeof cwd === "string" && cwd.trim()) return cwd;
		} catch {
			/* ignore */
		}
	}
	if (typeof workspaceCwd === "string" && workspaceCwd.trim()) {
		const target = resolve(workspaceCwd.trim());
		if (existsSync(target)) return target;
	}
	const fallback = resolve(process.env.HOME || "/workspace");
	return existsSync(fallback) ? fallback : "/workspace";
}

/** @type {Map<string, { pty: any, buf: string, sessionId: string, closed: boolean }>} */
const terms = new Map();

const MAX_BUF = 512 * 1024;

function registerRpc(ctx) {
	const pty = loadPty();
	return ctx.connection.rpc.handle(
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				switch (endpoint) {
					case "asset": {
						const key = String(payload?.name || "");
						const meta = ASSETS[key];
						if (!meta) throw new Error(`unknown asset: ${key}`);
						const path = join(VENDOR, meta.file);
						if (!existsSync(path)) throw new Error(`missing vendor file: ${meta.file}`);
						const content = await readFile(path, "utf8");
						return ok({ name: key, mime: meta.mime, content });
					}
					case "open": {
						const sessionId = payload?.sessionId;
						const cwd = resolveTerminalCwd(ctx, sessionId, payload?.workspaceCwd);
						const cols = Math.min(Math.max(Number(payload?.cols) || 80, 20), 300);
						const rows = Math.min(Math.max(Number(payload?.rows) || 24, 5), 120);
						const shell = process.env.DSH_TERMINAL_SHELL || process.env.SHELL || "/bin/bash";
						const termId = randomUUID();
						const proc = pty.spawn(shell, ["-l"], {
							name: "xterm-256color",
							cols,
							rows,
							cwd,
							env: {
								...process.env,
								TERM: "xterm-256color",
								COLORTERM: "truecolor",
								FORCE_COLOR: "1",
								CLICOLOR: "1",
								CLICOLOR_FORCE: "1",
							},
						});
						const entry = { pty: proc, buf: "", sessionId, closed: false };
						proc.onData((data) => {
							entry.buf += data;
							if (entry.buf.length > MAX_BUF) {
								entry.buf = entry.buf.slice(entry.buf.length - MAX_BUF);
							}
						});
						proc.onExit(() => {
							entry.closed = true;
							entry.buf += "\r\n[process exited]\r\n";
						});
						terms.set(termId, entry);
						return ok({ termId, cwd, shell });
					}
					case "write": {
						const termId = payload?.termId;
						const data = payload?.data;
						const entry = terms.get(termId);
						if (!entry || entry.closed) throw new Error("terminal closed");
						if (typeof data !== "string") throw new Error("data required");
						entry.pty.write(data);
						return ok({ written: data.length });
					}
					case "read": {
						const termId = payload?.termId;
						const entry = terms.get(termId);
						if (!entry) throw new Error("unknown terminal");
						const data = entry.buf;
						entry.buf = "";
						return ok({ data, closed: entry.closed });
					}
					case "resize": {
						const termId = payload?.termId;
						const entry = terms.get(termId);
						if (!entry || entry.closed) throw new Error("terminal closed");
						const cols = Math.min(Math.max(Number(payload?.cols) || 80, 20), 300);
						const rows = Math.min(Math.max(Number(payload?.rows) || 24, 5), 120);
						entry.pty.resize(cols, rows);
						return ok({ cols, rows });
					}
					case "close": {
						const termId = payload?.termId;
						const entry = terms.get(termId);
						if (entry) {
							try {
								entry.pty.kill();
							} catch {
								/* ignore */
							}
							terms.delete(termId);
						}
						return ok({ closed: true });
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" }
	);
}

function apply(ctx) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.inject(["sessions"], (scope) => {
			scope.effect(() => {
				const dispose = registerRpc(scope);
				return () => {
					dispose();
					for (const [id, entry] of terms) {
						try {
							entry.pty.kill();
						} catch {
							/* ignore */
						}
						terms.delete(id);
					}
				};
			}, "dsh-terminal: rpc");
		});
	});
}

export { apply, name };

/**
 * dsh-terminal — host half: node-pty sessions with poll-based I/O over RPC.
 */
import { createRequire } from "node:module";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { isDsshPath, openSshShell } from "../../dsh-ssh-workspace/lib/ssh.js";
import { parseDsshPath } from "../../dsh-ssh-workspace/lib/config.js";
import { buildLocalMotd, localMotdEnabled } from "./local-motd.js";
import { buildLocalPtyEnv } from "./terminal-env.js";
import { registerRpcChannel } from "dsh-ide-shared/register-rpc-channel.js";

const name = "dsh-terminal";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/terminal";
const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const VENDOR = join(HERE, "vendor");

const ASSETS = {
	"xterm.js": { file: "xterm.js", mime: "application/javascript" },
	"xterm.css": { file: "xterm.css", mime: "text/css" },
	"addon-fit.js": { file: "addon-fit.js", mime: "application/javascript" },
	"addon-canvas.js": { file: "addon-canvas.js", mime: "application/javascript" },
	"addon-webgl.js": { file: "addon-webgl.js", mime: "application/javascript" },
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
	let sessionCwd = "";
	if (typeof sessionId === "string" && sessionId.trim()) {
		try {
			const sessions = ctx.get?.("sessions");
			const session = sessions?.get?.(sessionId.trim());
			if (typeof session?.header?.cwd === "string" && session.header.cwd.trim()) {
				sessionCwd = session.header.cwd.trim();
			}
		} catch {
			/* ignore */
		}
	}
	const wsCwd = typeof workspaceCwd === "string" ? workspaceCwd.trim() : "";
	// During SSH workspace switches the sidebar pointer updates before session.header.cwd;
	// never open a local PTY when the UI scope is already dssh://.
	if (isDsshPath(wsCwd)) {
		if (isDsshPath(sessionCwd)) return sessionCwd;
		return wsCwd;
	}
	if (isDsshPath(sessionCwd)) return sessionCwd;
	if (sessionCwd) {
		const target = resolve(sessionCwd);
		if (existsSync(target)) return target;
	}
	if (wsCwd) {
		if (isDsshPath(wsCwd)) return wsCwd;
		const target = resolve(wsCwd);
		if (existsSync(target)) return target;
	}
	const fallback = resolve(process.env.HOME || "/workspace");
	return existsSync(fallback) ? fallback : "/workspace";
}

/** @type {Map<string, { pty?: any, stream?: any, buf: string, sessionId: string, closed: boolean, remote?: boolean }>} */
const terms = new Map();

const MAX_TERMS = 32;

function closeTermEntry(termId, entry) {
	if (!entry) return;
	try {
		if (entry.stream) entry.stream.close();
		else entry.pty?.kill?.();
	} catch {
		/* ignore */
	}
	terms.delete(termId);
}

/** Drop oldest PTY when at cap (workspace/tab churn can leave orphans until client closes). */
function evictOldestTerm() {
	while (terms.size >= MAX_TERMS) {
		const oldest = terms.keys().next().value;
		if (!oldest) break;
		closeTermEntry(oldest, terms.get(oldest));
	}
}

function closeAllTerms() {
	for (const [id, entry] of terms) {
		closeTermEntry(id, entry);
	}
}

function enqueueSpawn(fn) {
	const run = spawnQueue.then(fn, fn);
	spawnQueue = run.catch(() => {});
	return run;
}

let spawnQueue = Promise.resolve();

function spawnLocalPty(pty, shell, cols, rows, cwd, ctx) {
	return enqueueSpawn(async () => {
		if (terms.size >= MAX_TERMS) {
			evictOldestTerm();
		}
		if (terms.size >= MAX_TERMS) {
			throw new Error(
				`too many terminal sessions (${MAX_TERMS} max) — close a terminal tab or restart the harness`,
			);
		}
		const env = await buildLocalPtyEnv(ctx);
		// Do NOT use login shells (`-l`): /etc/profile resets PATH and drops
		// ~/.local/bin even when we pass it in env. Interactive non-login keeps
		// the PTY env PATH so npm -g CLIs (gemini, …) resolve by name.
		const args = shell.includes("bash") ? ["-i"] : [];
		return pty.spawn(shell, args, {
			name: "xterm-256color",
			cols,
			rows,
			cwd,
			env,
		});
	});
}

const MAX_BUF = 512 * 1024;

function registerRpc(ctx) {
	const pty = loadPty();
	return registerRpcChannel(ctx, 
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
						if (terms.size >= MAX_TERMS) evictOldestTerm();
						if (isDsshPath(cwd)) {
							const parsed = parseDsshPath(cwd);
							if (!parsed) throw new Error("invalid remote workspace path");
							const termId = randomUUID();
							const entry = {
								stream: null,
								buf: "",
								sessionId,
								closed: false,
								remote: true,
								cwd: parsed.remotePath,
								shell: "",
								hostId: parsed.hostId,
							};
							const appendBuf = (data) => {
								entry.buf += data.toString("utf8");
								if (entry.buf.length > MAX_BUF) {
									entry.buf = entry.buf.slice(entry.buf.length - MAX_BUF);
								}
							};
							const { stream, cwd: remoteCwd, host } = await openSshShell(
								parsed.hostId,
								parsed.remotePath,
								cols,
								rows,
								{
									onData: appendBuf,
									onClose: () => {
										entry.closed = true;
										entry.buf += "\r\n[ssh session closed]\r\n";
									},
								},
							);
							entry.stream = stream;
							entry.cwd = remoteCwd || parsed.remotePath;
							entry.shell = `ssh:${host?.label || parsed.hostId}`;
							terms.set(termId, entry);
							// Collect login banner + cd before client read loop starts.
							await new Promise((resolve) => setTimeout(resolve, 500));
							const replay = entry.buf;
							entry.buf = "";
							return ok({
								termId,
								cwd: remoteCwd || parsed.remotePath,
								shell: `ssh:${host?.label || parsed.hostId}`,
								remote: true,
								hostId: parsed.hostId,
								replay: replay || undefined,
							});
						}
						const shell = process.env.DSH_TERMINAL_SHELL || process.env.SHELL || "/bin/bash";
						const termId = randomUUID();
						const localBanner = localMotdEnabled()
							? buildLocalMotd({ ctx, sessionId, cwd, cols })
							: "";
						const proc = await spawnLocalPty(pty, shell, cols, rows, cwd, ctx);
						const entry = {
							pty: proc,
							buf: "",
							localBanner,
							sessionId,
							closed: false,
							cwd,
							shell,
							remote: false,
						};
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
						return ok({
							termId,
							cwd,
							shell,
							banner: localBanner || undefined,
						});
					}
					case "attach": {
						const termId = String(payload?.termId || "").trim();
						const entry = terms.get(termId);
						if (!entry || entry.closed) throw new Error("terminal not found");
						const cols = Math.min(Math.max(Number(payload?.cols) || 80, 20), 300);
						const rows = Math.min(Math.max(Number(payload?.rows) || 24, 5), 120);
						if (entry.stream && typeof entry.stream.setWindow === "function") {
							entry.stream.setWindow(rows, cols, 0, 0, 0, 0);
						} else if (entry.pty) {
							entry.pty.resize(cols, rows);
						}
						const replay = (entry.localBanner || "") + entry.buf;
						entry.buf = "";
						return ok({
							termId,
							attached: true,
							replay,
							cwd: entry.cwd || "",
							shell: entry.shell || "",
							remote: !!entry.remote,
							hostId: entry.hostId || null,
						});
					}
					case "write": {
						const termId = payload?.termId;
						const data = payload?.data;
						const entry = terms.get(termId);
						if (!entry || entry.closed) throw new Error("terminal closed");
						if (typeof data !== "string") throw new Error("data required");
						if (entry.stream) entry.stream.write(data);
						else entry.pty.write(data);
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
						if (entry.stream && typeof entry.stream.setWindow === "function") {
							entry.stream.setWindow(rows, cols, 0, 0, 0, 0);
						} else {
							entry.pty.resize(cols, rows);
						}
						return ok({ cols, rows });
					}
					case "close": {
						const termId = payload?.termId;
						const entry = terms.get(termId);
						if (entry) closeTermEntry(termId, entry);
						return ok({ closed: true });
					}
					case "closeAll": {
						const n = terms.size;
						closeAllTerms();
						return ok({ closed: n });
					}
					case "stats": {
						return ok({ count: terms.size, max: MAX_TERMS });
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		});
}

function apply(ctx) {
	ctx.inject(["connection", "webServer"], (connectionCtx) => {
		connectionCtx.inject(["sessions"], (scope) => {
			scope.effect(() => {
				const dispose = registerRpc(scope);
				return () => {
					dispose();
					for (const [id, entry] of terms) {
						closeTermEntry(id, entry);
					}
				};
			}, "dsh-terminal: rpc");
		});
	});
}

export { apply, name, inject };

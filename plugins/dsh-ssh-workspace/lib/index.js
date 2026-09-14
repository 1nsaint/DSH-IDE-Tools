/**
 * dsh-ssh-workspace — host: SSH hosts, remote browse, workspace bindings, SFTP file ops, SSH shells.
 */
import { randomUUID } from "node:crypto";
import {
	loadConfig,
	saveConfig,
	normalizeHost,
	newHostId,
	makeDsshPath,
	parseDsshPath,
	bindingForWorkspace,
	bindingForPath,
	publicHost,
	hostHasKey,
} from "./config.js";
import { ensureSshDirs, persistHostKey, removeHostKey, sshKeysDir } from "./keys.js";
import {
	testHostConnection,
	listRemoteDirectory,
	resolveDsshPath,
	isDsshPath,
	remoteStat,
	remoteReadFile,
	remoteWriteFile,
	remoteRemove,
	remoteRename,
	openSshShell,
} from "./ssh.js";

const name = "dsh-ssh-workspace";
const RPC_CHANNEL = "/ssh-workspace";

/** @type {Map<string, { stream: any, buf: string, closed: boolean }>} */
const sshTerms = new Map();
const MAX_BUF = 512 * 1024;

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

function workspaceEntityId(entity) {
	return entity?.id || entity?.workspaceId || null;
}

/**
 * Register a remote directory as a Harness workspace (dssh:// virtual path).
 * Stock workspaceRegistry.create() realpath-validates local dirs only.
 * @param {any} registry
 * @param {string} hostId
 * @param {string} remotePath
 * @param {string} label
 */
async function createRemoteWorkspace(registry, hostId, remotePath, label) {
	if (!registry || typeof registry.createCanonical !== "function") {
		throw new Error("workspace registry unavailable");
	}
	const st = await remoteStat(hostId, remotePath);
	if (st.type !== "directory") {
		throw new Error(`Remote path is not a directory: ${remotePath}`);
	}
	const cfg = await loadConfig();
	const host = cfg.hosts.find((h) => h.id === hostId);
	const title = label
		|| remotePath.split("/").filter(Boolean).pop()
		|| host?.label
		|| hostId;
	const dsshPath = makeDsshPath(hostId, remotePath);
	let entity = await registry.createCanonical(dsshPath, title);
	if (entity.title !== title && typeof entity.setTitle === "function") {
		await entity.setTitle(title);
		entity = registry.get(workspaceEntityId(entity)) || entity;
	}
	const workspaceId = workspaceEntityId(entity);
	if (!workspaceId) throw new Error("workspace creation failed");
	cfg.bindings = cfg.bindings.filter((b) => b.workspaceId !== workspaceId);
	cfg.bindings.push({ workspaceId, hostId, remotePath, label: title });
	await saveConfig(cfg);
	return {
		workspaceId,
		path: dsshPath,
		title: entity.title || title,
	};
}

function registerRpc(ctx) {
	return ctx.connection.rpc.handle(
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				switch (endpoint) {
					case "getConfig": {
						await ensureSshDirs();
						const cfg = await loadConfig();
						return ok({
							hosts: cfg.hosts.map((h) => publicHost(h)),
							bindings: cfg.bindings,
							sshKeysDir: sshKeysDir(),
						});
					}
					case "saveHost": {
						await ensureSshDirs();
						const cfg = await loadConfig();
						let incoming = normalizeHost(payload?.host, payload?.host?.id || newHostId(payload?.host?.label));
						if (!incoming) throw new Error("Invalid host (need label, user, hostname)");
						const idx = cfg.hosts.findIndex((h) => h.id === incoming.id);
						const existing = idx >= 0 ? cfg.hosts[idx] : null;
						if (!incoming.privateKey && existing?.privateKey) incoming.privateKey = existing.privateKey;
						if (!incoming.identityFile && existing?.identityFile) incoming.identityFile = existing.identityFile;
						if (!hostHasKey(incoming)) {
							throw new Error("Paste the private key for this PC (or set a key file path).");
						}
						incoming = await persistHostKey(incoming);
						if (idx >= 0) cfg.hosts[idx] = incoming;
						else cfg.hosts.push(incoming);
						await saveConfig(cfg);
						return ok({ host: publicHost(incoming), hosts: cfg.hosts.map((h) => publicHost(h)), sshKeysDir: sshKeysDir() });
					}
					case "removeHost": {
						const id = String(payload?.id || "").trim();
						if (!id) throw new Error("id required");
						const cfg = await loadConfig();
						cfg.hosts = cfg.hosts.filter((h) => h.id !== id);
						cfg.bindings = cfg.bindings.filter((b) => b.hostId !== id);
						await saveConfig(cfg);
						await removeHostKey(id);
						return ok({ hosts: cfg.hosts });
					}
					case "testHost": {
						const cfg = await loadConfig();
						let host = cfg.hosts.find((h) => h.id === payload?.host?.id) || null;
						if (host && payload?.host) {
							host = normalizeHost({ ...host, ...payload.host }, host.id);
						} else {
							host = normalizeHost(payload?.host, payload?.host?.id);
						}
						if (!host) throw new Error("host required");
						if (payload?.persist) {
							const cfg = await loadConfig();
							const idx = cfg.hosts.findIndex((h) => h.id === host.id);
							if (idx >= 0) cfg.hosts[idx] = host;
							else cfg.hosts.push(host);
							await saveConfig(cfg);
						}
						try {
							const result = await testHostConnection(host);
							return ok(result);
						} catch (err) {
							return ok({ ok: false, detail: err instanceof Error ? err.message : String(err) });
						}
					}
					case "listRemoteDir": {
						const hostId = String(payload?.hostId || "").trim();
						const path = String(payload?.path || "/");
						const listing = await listRemoteDirectory(hostId, path);
						return ok(listing);
					}
					case "makePath": {
						const hostId = String(payload?.hostId || "").trim();
						const remotePath = String(payload?.remotePath || "").trim();
						if (!hostId || !remotePath) throw new Error("hostId and remotePath required");
						return ok({ path: makeDsshPath(hostId, remotePath) });
					}
					case "createRemoteWorkspace": {
						const hostId = String(payload?.hostId || "").trim();
						const remotePath = String(payload?.remotePath || "").trim();
						const label = String(payload?.label || "").trim();
						if (!hostId || !remotePath) throw new Error("hostId and remotePath required");
						const workspace = await createRemoteWorkspace(
							ctx.workspaceRegistry,
							hostId,
							remotePath,
							label,
						);
						return ok(workspace);
					}
					case "parsePath": {
						const parsed = parseDsshPath(payload?.path);
						if (!parsed) return ok({ parsed: null });
						const cfg = await loadConfig();
						const host = cfg.hosts.find((h) => h.id === parsed.hostId) || null;
						return ok({ parsed, host });
					}
					case "bindWorkspace": {
						const workspaceId = String(payload?.workspaceId || "").trim();
						const hostId = String(payload?.hostId || "").trim();
						const remotePath = String(payload?.remotePath || "").trim();
						const label = String(payload?.label || "").trim();
						if (!workspaceId || !hostId || !remotePath) {
							throw new Error("workspaceId, hostId, remotePath required");
						}
						const cfg = await loadConfig();
						cfg.bindings = cfg.bindings.filter((b) => b.workspaceId !== workspaceId);
						cfg.bindings.push({ workspaceId, hostId, remotePath, label });
						await saveConfig(cfg);
						return ok({
							binding: { workspaceId, hostId, remotePath, label },
							path: makeDsshPath(hostId, remotePath),
						});
					}
					case "unbindWorkspace": {
						const workspaceId = String(payload?.workspaceId || "").trim();
						const cfg = await loadConfig();
						cfg.bindings = cfg.bindings.filter((b) => b.workspaceId !== workspaceId);
						await saveConfig(cfg);
						return ok({ ok: true });
					}
					case "getBinding": {
						const cfg = await loadConfig();
						if (payload?.workspaceId) {
							return ok({ binding: bindingForWorkspace(cfg, String(payload.workspaceId)) });
						}
						if (payload?.path) {
							const byPath = bindingForPath(cfg, String(payload.path));
							if (byPath) return ok({ binding: byPath });
							const parsed = parseDsshPath(payload.path);
							if (parsed) {
								const host = cfg.hosts.find((h) => h.id === parsed.hostId);
								return ok({
									binding: {
										hostId: parsed.hostId,
										remotePath: parsed.remotePath,
										label: host?.label || parsed.hostId,
									},
								});
							}
						}
						return ok({ binding: null });
					}
					case "getBindings": {
						const cfg = await loadConfig();
						return ok({ bindings: cfg.bindings, hosts: cfg.hosts.map((h) => publicHost(h)) });
					}
					case "files.stat": {
						const resolved = await resolveDsshPath(payload?.path || payload?.root);
						if (!resolved) throw new Error("not a dssh path");
						const st = await remoteStat(resolved.hostId, resolved.remotePath);
						return ok(st);
					}
					case "files.list": {
						const root = payload?.root || payload?.path;
						const resolved = await resolveDsshPath(root);
						if (!resolved) throw new Error("not a dssh path");
						const listing = await listRemoteDirectory(resolved.hostId, resolved.remotePath);
						return ok({
							entries: listing.entries.map((e) => ({
								name: e.name,
								type: e.type,
								path: makeDsshPath(resolved.hostId, e.path),
								size: null,
							})),
						});
					}
					case "files.read": {
						const resolved = await resolveDsshPath(payload?.path);
						if (!resolved) throw new Error("not a dssh path");
						const data = await remoteReadFile(resolved.hostId, resolved.remotePath);
						return ok(data);
					}
					case "files.write": {
						const resolved = await resolveDsshPath(payload?.path);
						if (!resolved) throw new Error("not a dssh path");
						await remoteWriteFile(resolved.hostId, resolved.remotePath, payload?.content ?? "");
						return ok({ ok: true });
					}
					case "files.remove": {
						const resolved = await resolveDsshPath(payload?.path);
						if (!resolved) throw new Error("not a dssh path");
						await remoteRemove(resolved.hostId, resolved.remotePath, payload?.type);
						return ok({ ok: true });
					}
					case "files.rename": {
						const from = await resolveDsshPath(payload?.from);
						const to = await resolveDsshPath(payload?.to);
						if (!from || !to || from.hostId !== to.hostId) throw new Error("invalid rename paths");
						await remoteRename(from.hostId, from.remotePath, to.remotePath);
						return ok({ ok: true });
					}
					case "terminal.open": {
						const binding = payload?.binding;
						const hostId = binding?.hostId || payload?.hostId;
						const remotePath = binding?.remotePath || payload?.remotePath || "/";
						const cols = Math.min(Math.max(Number(payload?.cols) || 80, 20), 300);
						const rows = Math.min(Math.max(Number(payload?.rows) || 24, 5), 120);
						const { stream, cwd } = await openSshShell(hostId, remotePath, cols, rows);
						const termId = randomUUID();
						const entry = { stream, buf: "", closed: false };
						stream.on("data", (data) => {
							entry.buf += data.toString("utf8");
							if (entry.buf.length > MAX_BUF) entry.buf = entry.buf.slice(-MAX_BUF);
						});
						stream.on("close", () => {
							entry.closed = true;
							entry.buf += "\r\n[ssh session closed]\r\n";
						});
						sshTerms.set(termId, entry);
						return ok({ termId, cwd, remote: true, hostId });
					}
					case "terminal.write": {
						const entry = sshTerms.get(payload?.termId);
						if (!entry || entry.closed) throw new Error("terminal closed");
						entry.stream.write(String(payload?.data ?? ""));
						return ok({ written: String(payload?.data ?? "").length });
					}
					case "terminal.read": {
						const entry = sshTerms.get(payload?.termId);
						if (!entry) throw new Error("unknown terminal");
						const data = entry.buf;
						entry.buf = "";
						return ok({ data, closed: entry.closed });
					}
					case "terminal.resize": {
						const entry = sshTerms.get(payload?.termId);
						if (!entry || entry.closed) throw new Error("terminal closed");
						if (typeof entry.stream.setWindow === "function") {
							entry.stream.setWindow(
								Math.min(Math.max(Number(payload?.rows) || 24, 5), 120),
								Math.min(Math.max(Number(payload?.cols) || 80, 20), 300),
								0,
								0,
								0,
								0,
							);
						}
						return ok({ ok: true });
					}
					case "terminal.close": {
						const entry = sshTerms.get(payload?.termId);
						if (entry) {
							try { entry.stream.close(); } catch { /* ignore */ }
							sshTerms.delete(payload.termId);
						}
						return ok({ closed: true });
					}
					case "probePath": {
						const path = String(payload?.path || "");
						return ok({ remote: isDsshPath(path) });
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" },
	);
}

function apply(ctx) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.inject(["workspaceRegistry"], (scope) => {
			scope.effect(() => {
				ensureSshDirs().catch((err) => {
					console.warn("[dsh-ssh-workspace] ensure ssh dirs failed:", err instanceof Error ? err.message : err);
				});
				return registerRpc(scope);
			}, "dsh-ssh-workspace: rpc");
		});
	});
}

export { apply, name, isDsshPath, resolveDsshPath, makeDsshPath, parseDsshPath };

import { Client } from "ssh2";
import { readFile } from "node:fs/promises";
import { loadConfig, parseDsshPath } from "./config.js";

const connCache = new Map();

function cacheKey(host) {
	return `${host.id || ""}:${host.user}@${host.hostname}:${host.port || 22}`;
}

async function readIdentity(path) {
	if (!path) return undefined;
	try {
		return await readFile(path, "utf8");
	} catch {
		return undefined;
	}
}

async function getPrivateKey(host) {
	if (host?.privateKey) return host.privateKey;
	return readIdentity(host?.identityFile);
}

export async function getHostById(hostId) {
	const cfg = await loadConfig();
	const host = cfg.hosts.find((h) => h.id === hostId);
	if (!host) throw new Error(`Unknown SSH host: ${hostId}`);
	return host;
}

export async function resolveDsshPath(path) {
	const parsed = parseDsshPath(path);
	if (!parsed) return null;
	const host = await getHostById(parsed.hostId);
	return { host, remotePath: parsed.remotePath, hostId: parsed.hostId };
}

export function connect(host) {
	return connectResolved(host);
}

function clientAlive(entry) {
	if (!entry?.ready || !entry?.client) return false;
	const sock = entry.client._sock;
	if (sock && (sock.destroyed || sock.readyState !== "open")) return false;
	return true;
}

export function dropConnection(host) {
	if (!host) return;
	const key = cacheKey(host);
	const existing = connCache.get(key);
	connCache.delete(key);
	try {
		existing?.client?.end?.();
	} catch {
		/* ignore */
	}
}

export async function dropConnectionForHostId(hostId) {
	const host = await getHostById(hostId);
	dropConnection(host);
}

function shouldRetrySsh(err) {
	const m = String(err?.message || err);
	return /Channel open failure|Not connected|ECONNRESET|connection reset|SSH_MSG_DISCONNECT|Socket is closed/i.test(m);
}

function connectResolved(host) {
	const key = cacheKey(host);
	const existing = connCache.get(key);
	if (clientAlive(existing)) return Promise.resolve(existing.client);
	if (existing) dropConnection(host);

	return new Promise((resolve, reject) => {
		const client = new Client();
		const entry = { client, ready: false };
		connCache.set(key, entry);

		client.on("ready", () => {
			entry.ready = true;
			resolve(client);
		}).on("error", (err) => {
			connCache.delete(key);
			reject(err);
		}).on("close", () => {
			connCache.delete(key);
		});

		getPrivateKey(host).then((privateKey) => {
			if (!privateKey) {
				connCache.delete(key);
				reject(new Error(
					`No private key for ${host.label || host.hostname}. Paste one when adding this PC, or set a key file path.`,
				));
				return;
			}
			const connectCfg = {
				host: host.hostname,
				port: host.port || 22,
				username: host.user,
				readyTimeout: 15000,
				tryKeyboard: false,
			};
			if (privateKey) {
				connectCfg.privateKey = privateKey;
			}
			client.connect(connectCfg);
		}).catch(reject);
	});
}

export function withSftp(client) {
	return new Promise((resolve, reject) => {
		client.sftp((err, sftp) => {
			if (err) reject(err);
			else resolve(sftp);
		});
	});
}

async function withSftpSession(client, fn) {
	const sftp = await withSftp(client);
	try {
		return await fn(sftp);
	} finally {
		try { sftp.end(); } catch { /* ignore */ }
	}
}

function evictConn(host) {
	connCache.delete(cacheKey(host));
}

function sftpStat(sftp, p) {
	return new Promise((resolve, reject) => {
		sftp.stat(p, (err, st) => (err ? reject(err) : resolve(st)));
	});
}

function sftpReaddir(sftp, p) {
	return new Promise((resolve, reject) => {
		sftp.readdir(p, (err, list) => (err ? reject(err) : resolve(list)));
	});
}

function sftpReadFile(sftp, p) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		const stream = sftp.createReadStream(p);
		stream.on("data", (c) => chunks.push(c));
		stream.on("error", reject);
		stream.on("end", () => resolve(Buffer.concat(chunks)));
	});
}

function sftpWriteFile(sftp, p, data) {
	return new Promise((resolve, reject) => {
		const stream = sftp.createWriteStream(p);
		stream.on("error", reject);
		stream.on("close", resolve);
		stream.end(data);
	});
}

function sftpUnlink(sftp, p) {
	return new Promise((resolve, reject) => {
		sftp.unlink(p, (err) => (err ? reject(err) : resolve()));
	});
}

function sftpRmdir(sftp, p) {
	return new Promise((resolve, reject) => {
		sftp.rmdir(p, (err) => (err ? reject(err) : resolve()));
	});
}

function sftpMkdir(sftp, p) {
	return new Promise((resolve, reject) => {
		sftp.mkdir(p, (err) => (err ? reject(err) : resolve()));
	});
}

function sftpRename(sftp, from, to) {
	return new Promise((resolve, reject) => {
		sftp.rename(from, to, (err) => (err ? reject(err) : resolve()));
	});
}

export async function testHostConnection(host) {
	dropConnection(host);
	const client = await connect(host);
	try {
		await withSftpSession(client, (sftp) => sftpStat(sftp, "/"));
	} finally {
		try {
			client.end();
		} catch {
			/* ignore */
		}
	}
	return { ok: true, detail: `Connected to ${host.user}@${host.hostname}` };
}

/** Verify SFTP works (reconnects if the cached session died). */
export async function warmHostById(hostId) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	await withSftpSession(client, (sftp) => sftpStat(sftp, "/"));
	return { ok: true, detail: `SSH ready for ${host.label || hostId}` };
}

export async function listRemoteDirectory(hostId, remotePath = "/") {
	const host = await getHostById(hostId);
	const run = async () => {
		const client = await connect(host);
		return withSftpSession(client, async (sftp) => {
			const dir = remotePath || "/";
			await sftpStat(sftp, dir);
			const entries = await sftpReaddir(sftp, dir);
			const out = entries
				.filter((e) => e.filename && !e.filename.startsWith("."))
				.map((e) => {
					const isDir = (e.attrs.mode & 0o40000) !== 0;
					const full = dir === "/" ? `/${e.filename}` : `${dir.replace(/\/$/, "")}/${e.filename}`;
					return {
						name: e.filename,
						path: full,
						type: isDir ? "directory" : "file",
					};
				})
				.sort((a, b) => {
					const ad = a.type === "directory" ? 0 : 1;
					const bd = b.type === "directory" ? 0 : 1;
					if (ad !== bd) return ad - bd;
					return a.name.localeCompare(b.name);
				});
			const crumbs = [{ name: "Root", path: "/" }];
			if (dir !== "/") {
				const parts = dir.split("/").filter(Boolean);
				let acc = "";
				for (const part of parts) {
					acc += `/${part}`;
					crumbs.push({ name: part, path: acc });
				}
			}
			return { path: dir, entries: out, crumbs };
		});
	};
	try {
		return await run();
	} catch (err) {
		if (shouldRetrySsh(err)) {
			evictConn(host);
			return run();
		}
		throw err;
	}
}

export async function remoteStat(hostId, remotePath) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		const st = await sftpStat(sftp, remotePath);
		const isDir = (st.mode & 0o40000) !== 0;
		return {
			path: remotePath,
			type: isDir ? "directory" : "file",
			size: st.size,
		};
	});
}

export async function remoteReadFile(hostId, remotePath, maxBytes = 256 * 1024) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		const st = await sftpStat(sftp, remotePath);
		if ((st.mode & 0o40000) !== 0) throw new Error("not a file");
		if (st.size > maxBytes) {
			const err = new Error("file too large");
			err.code = "FS_TOO_LARGE";
			throw err;
		}
		const buf = await sftpReadFile(sftp, remotePath);
		const text = buf.toString("utf8");
		if (text.includes("\u0000")) {
			const err = new Error("binary file");
			err.code = "FS_NOT_TEXT";
			throw err;
		}
		return { content: text, size: buf.length };
	});
}

export async function remoteReadFileBytes(hostId, remotePath, maxBytes = 16 * 1024 * 1024) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		const st = await sftpStat(sftp, remotePath);
		if ((st.mode & 0o40000) !== 0) throw new Error("not a file");
		if (st.size > maxBytes) {
			const err = new Error("file too large");
			err.code = "FS_TOO_LARGE";
			throw err;
		}
		const buf = await sftpReadFile(sftp, remotePath);
		return { content: buf, size: buf.length };
	});
}

export async function remoteWriteFile(hostId, remotePath, content) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		const buf = Buffer.isBuffer(content) ? content : Buffer.from(String(content), "utf8");
		await sftpWriteFile(sftp, remotePath, buf);
		return { ok: true };
	});
}

export async function remoteMkdir(hostId, remotePath) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		await sftpMkdir(sftp, remotePath);
		return { ok: true };
	});
}

async function remoteRemoveTree(sftp, remotePath, type) {
	if (type !== "directory") {
		await sftpUnlink(sftp, remotePath);
		return;
	}
	let entries;
	try {
		entries = await sftpReaddir(sftp, remotePath);
	} catch (err) {
		await sftpRmdir(sftp, remotePath);
		return;
	}
	for (const entry of entries) {
		const name = entry.filename;
		if (!name || name === "." || name === "..") continue;
		const child = remotePath === "/" ? `/${name}` : `${remotePath.replace(/\/+$/, "")}/${name}`;
		const isDir = (entry.attrs.mode & 0o40000) !== 0;
		await remoteRemoveTree(sftp, child, isDir ? "directory" : "file");
	}
	await sftpRmdir(sftp, remotePath);
}

export async function remoteRemove(hostId, remotePath, type) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		await remoteRemoveTree(sftp, remotePath, type);
		return { ok: true };
	});
}

export async function remoteRename(hostId, from, to) {
	const host = await getHostById(hostId);
	const client = await connect(host);
	return withSftpSession(client, async (sftp) => {
		await sftpRename(sftp, from, to);
		return { ok: true };
	});
}

export async function openSshShell(hostId, remotePath, cols, rows, hooks = {}) {
	const host = await getHostById(hostId);
	const cwd = remotePath || host.home || "/";
	const ptyEnv = {
		TERM: "xterm-256color",
		COLORTERM: "truecolor",
		FORCE_COLOR: "1",
		CLICOLOR: "1",
		CLICOLOR_FORCE: "1",
	};
	const cdLine = `cd ${shellQuote(cwd)} 2>/dev/null || cd ~`;
	const onData = typeof hooks.onData === "function" ? hooks.onData : null;
	const onClose = typeof hooks.onClose === "function" ? hooks.onClose : null;

	const openOnce = () => new Promise((resolve, reject) => {
		connect(host).then((client) => {
			client.shell({ term: "xterm-256color", cols, rows, env: ptyEnv }, (err, stream) => {
				if (err) return reject(err);
				if (onData) stream.on("data", onData);
				if (onClose) stream.on("close", onClose);
				setTimeout(() => stream.write(`${cdLine}\n`), 150);
				resolve({ client, stream, cwd, host });
			});
		}).catch(reject);
	});

	try {
		return await openOnce();
	} catch (err) {
		if (!shouldRetrySsh(err)) throw err;
		evictConn(host);
		return openOnce();
	}
}

function shellQuote(s) {
	return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

export function isDsshPath(p) {
	return String(p || "").startsWith("dssh://");
}

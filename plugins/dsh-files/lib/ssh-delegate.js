import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import {
	isDsshPath,
	resolveDsshPath,
	listRemoteDirectory,
	remoteStat,
	remoteReadFile,
	remoteReadFileBytes,
	remoteWriteFile,
	remoteMkdir,
	remoteRemove,
	remoteRename,
} from "../../dsh-ssh-workspace/lib/bridge.js";
import { makeDsshPath } from "../../dsh-ssh-workspace/lib/config.js";

export function pathIsRemote(p) {
	return isDsshPath(p);
}

function isPermissionDenied(err) {
	const e = err;
	const code = e && e.code;
	const msg = String((e && e.message) || err || "");
	return code === "EACCES"
		|| code === "PERMISSION_DENIED"
		|| /permission denied/i.test(msg);
}

function copyResult(path, skipped) {
	const out = { ok: true, path };
	if (skipped && skipped.length) {
		out.skipped = skipped;
		out.warning = `Copied with ${skipped.length} unreadable item(s) skipped`;
	}
	return out;
}

export async function remoteList(args) {
	const path = args.path;
	const resolved = await resolveDsshPath(path);
	if (!resolved) throw new Error("invalid dssh path");
	const listing = await listRemoteDirectory(resolved.hostId, resolved.remotePath);
	return {
		ok: true,
		path,
		entries: listing.entries.map((e) => ({
			name: e.name,
			type: e.type,
			path: makeDsshPath(resolved.hostId, e.path),
			size: null,
		})),
	};
}

export async function remoteStatEntry(args) {
	const resolved = await resolveDsshPath(args.path);
	if (!resolved) throw new Error("invalid dssh path");
	const st = await remoteStat(resolved.hostId, resolved.remotePath);
	return { ok: true, path: args.path, type: st.type, size: st.size, version: null };
}

export async function remoteRead(args, maxPreview) {
	const resolved = await resolveDsshPath(args.path);
	if (!resolved) throw new Error("invalid dssh path");
	const data = await remoteReadFile(resolved.hostId, resolved.remotePath, maxPreview);
	return { ok: true, text: data.content, truncated: false, size: data.size, version: null };
}

export async function remoteWrite(args) {
	const resolved = await resolveDsshPath(args.path);
	if (!resolved) throw new Error("invalid dssh path");
	await remoteWriteFile(resolved.hostId, resolved.remotePath, args.text);
	return { ok: true, version: null };
}

export async function remoteMkdirEntry(args) {
	const resolved = await resolveDsshPath(args.path);
	if (!resolved) throw new Error("invalid dssh path");
	await remoteMkdir(resolved.hostId, resolved.remotePath);
	return { ok: true, path: args.path };
}

export async function remoteRemoveEntry(args) {
	const resolved = await resolveDsshPath(args.path);
	if (!resolved) throw new Error("invalid dssh path");
	await remoteRemove(resolved.hostId, resolved.remotePath, args.type);
	return { ok: true };
}

export async function remoteRenameEntry(args) {
	const from = await resolveDsshPath(args.from || args.path);
	if (!from) throw new Error("invalid rename source");
	const newName = String(args.newName || "").trim();
	if (!newName) throw new Error("missing newName");
	const parent = from.remotePath.replace(/\/[^/]+$/, "") || "/";
	const destPath = `${parent}/${newName}`.replace(/\/+/g, "/");
	const toPath = makeDsshPath(from.hostId, destPath);
	await remoteRename(from.hostId, from.remotePath, destPath);
	return { ok: true, path: toPath, oldPath: args.from || args.path };
}

export function joinRemotePath(dir, name) {
	const base = String(dir || "/").replace(/\/+$/, "");
	const leaf = String(name || "").replace(/^\/+/, "");
	if (!leaf) throw new Error("invalid name");
	if (!base || base === "/") return `/${leaf}`;
	return `${base}/${leaf}`.replace(/\/+/g, "/");
}

export function baseNameOf(remotePath) {
	const s = String(remotePath || "").replace(/\/+$/, "");
	const i = s.lastIndexOf("/");
	return i === -1 ? s : s.slice(i + 1);
}

export async function remoteMoveEntry(args) {
	const src = await resolveDsshPath(args.path);
	const destDirResolved = await resolveDsshPath(args.destDir);
	if (!src || !destDirResolved) throw new Error("invalid dssh path");

	const destDirStat = await remoteStat(destDirResolved.hostId, destDirResolved.remotePath);
	if (destDirStat.type !== "directory") throw new Error("destination is not a directory");

	const baseName = typeof args.newName === "string" && args.newName.trim()
		? args.newName.trim()
		: baseNameOf(src.remotePath);
	if (!baseName || baseName === "." || baseName === ".." || /[\\/]/.test(baseName)) {
		throw new Error("invalid name");
	}

	const destRemotePath = joinRemotePath(destDirResolved.remotePath, baseName);
	const destDsshPath = makeDsshPath(destDirResolved.hostId, destRemotePath);
	const srcParent = src.remotePath.replace(/\/[^/]+$/, "") || "/";
	const destParent = destDirResolved.remotePath.replace(/\/+$/, "") || "/";
	if (src.hostId === destDirResolved.hostId
		&& srcParent === destParent
		&& baseName === baseNameOf(src.remotePath)) {
		throw new Error("already in that folder");
	}

	try {
		await remoteStat(destDirResolved.hostId, destRemotePath);
		throw new Error("an item with that name already exists there");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg === "an item with that name already exists there") throw err;
	}

	const srcStat = await remoteStat(src.hostId, src.remotePath);

	if (src.hostId === destDirResolved.hostId) {
		await remoteRename(src.hostId, src.remotePath, destRemotePath);
		return { ok: true, path: destDsshPath, oldPath: args.path };
	}

	if (srcStat.type === "directory") {
		throw new Error("moving folders between SSH hosts is not supported yet");
	}

	const data = await remoteReadFile(src.hostId, src.remotePath);
	await remoteWriteFile(destDirResolved.hostId, destRemotePath, data.content);
	await remoteRemove(src.hostId, src.remotePath, "file");
	return { ok: true, path: destDsshPath, oldPath: args.path };
}

async function remoteCopyTree(srcHostId, srcPath, destHostId, destPath, skipped = []) {
	let st;
	try {
		st = await remoteStat(srcHostId, srcPath);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(srcPath);
			return skipped;
		}
		throw err;
	}
	if (st.type === "file") {
		try {
			const data = await remoteReadFileBytes(srcHostId, srcPath);
			await remoteWriteFile(destHostId, destPath, data.content);
		} catch (err) {
			if (isPermissionDenied(err)) {
				skipped.push(srcPath);
				return skipped;
			}
			throw err;
		}
		return skipped;
	}
	try {
		await remoteMkdir(destHostId, destPath);
	} catch (err) {
		if (!isPermissionDenied(err)) throw err;
	}
	let listing;
	try {
		listing = await listRemoteDirectory(srcHostId, srcPath);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(srcPath);
			return skipped;
		}
		throw err;
	}
	for (const entry of listing.entries) {
		const childDest = joinRemotePath(destPath, entry.name);
		try {
			await remoteCopyTree(srcHostId, entry.path, destHostId, childDest, skipped);
		} catch (err) {
			if (isPermissionDenied(err)) {
				skipped.push(entry.path);
				continue;
			}
			throw err;
		}
	}
	return skipped;
}

export async function remoteCopyEntry(args) {
	const src = await resolveDsshPath(args.path);
	const destDirResolved = await resolveDsshPath(args.destDir);
	if (!src || !destDirResolved) throw new Error("invalid dssh path");

	const destDirStat = await remoteStat(destDirResolved.hostId, destDirResolved.remotePath);
	if (destDirStat.type !== "directory") throw new Error("destination is not a directory");

	const baseName = typeof args.newName === "string" && args.newName.trim()
		? args.newName.trim()
		: baseNameOf(src.remotePath);
	if (!baseName || baseName === "." || baseName === ".." || /[\\/]/.test(baseName)) {
		throw new Error("invalid name");
	}

	const destRemotePath = joinRemotePath(destDirResolved.remotePath, baseName);
	const destDsshPath = makeDsshPath(destDirResolved.hostId, destRemotePath);

	try {
		await remoteStat(destDirResolved.hostId, destRemotePath);
		throw new Error("an item with that name already exists there");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (msg === "an item with that name already exists there") throw err;
	}

	const skipped = await remoteCopyTree(src.hostId, src.remotePath, destDirResolved.hostId, destRemotePath);
	return copyResult(destDsshPath, skipped);
}

function joinLocalDestRel(destDir, baseName) {
	return path.posix.join(String(destDir).replace(/\/+$/, "") || "/", baseName);
}

async function localPathExists(svc, relPath, root) {
	try {
		const target = await svc.fs.resolve(relPath);
		await svc.guard(root, target);
		const info = await svc.fs.stat(target);
		return !!info;
	} catch {
		return false;
	}
}

async function copyRemoteTreeToLocal(svc, hostId, remotePath, destRel, destRoot, skipped = []) {
	let st;
	try {
		st = await remoteStat(hostId, remotePath);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(remotePath);
			return skipped;
		}
		throw err;
	}
	const destTarget = await svc.fs.resolve(destRel);
	await svc.guard(destRoot, destTarget);
	const destAbs = svc.fs.processPath(destTarget);

	if (st.type === "file") {
		try {
			const data = await remoteReadFileBytes(hostId, remotePath);
			await mkdir(path.dirname(destAbs), { recursive: true });
			await writeFile(destAbs, data.content);
		} catch (err) {
			if (isPermissionDenied(err)) {
				skipped.push(remotePath);
				return skipped;
			}
			throw err;
		}
		return skipped;
	}

	await mkdir(destAbs, { recursive: true });
	let listing;
	try {
		listing = await listRemoteDirectory(hostId, remotePath);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(remotePath);
			return skipped;
		}
		throw err;
	}
	for (const entry of listing.entries) {
		if (entry.name.startsWith(".")) continue;
		const childRel = joinLocalDestRel(destRel, entry.name);
		try {
			await copyRemoteTreeToLocal(svc, hostId, entry.path, childRel, destRoot, skipped);
		} catch (err) {
			if (isPermissionDenied(err)) {
				skipped.push(entry.path);
				continue;
			}
			throw err;
		}
	}
	return skipped;
}

async function copyLocalTreeToRemote(svc, localPath, localRoot, hostId, remoteDestPath, skipped = []) {
	let target;
	try {
		target = await svc.fs.resolve(localPath);
		await svc.guard(localRoot, target);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(localPath);
			return skipped;
		}
		throw err;
	}
	let info;
	try {
		info = await svc.fs.stat(target);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(localPath);
			return skipped;
		}
		throw err;
	}
	if (!info) throw new Error("file not found");

	if (info.type === "file") {
		try {
			const abs = svc.fs.processPath(target);
			const buf = await readFile(abs);
			await remoteWriteFile(hostId, remoteDestPath, buf);
		} catch (err) {
			if (isPermissionDenied(err)) {
				skipped.push(localPath);
				return skipped;
			}
			throw err;
		}
		return skipped;
	}

	try {
		await remoteMkdir(hostId, remoteDestPath);
	} catch (err) {
		if (!isPermissionDenied(err)) throw err;
	}
	let entries;
	try {
		entries = await svc.fs.listDir(target);
	} catch (err) {
		if (isPermissionDenied(err)) {
			skipped.push(localPath);
			return skipped;
		}
		throw err;
	}
	for (const entry of entries) {
		if (entry.name.startsWith(".")) continue;
		const childRemote = joinRemotePath(remoteDestPath, entry.name);
		try {
			await copyLocalTreeToRemote(svc, entry.target.displayPath, localRoot, hostId, childRemote, skipped);
		} catch (err) {
			if (isPermissionDenied(err)) {
				skipped.push(entry.target.displayPath);
				continue;
			}
			throw err;
		}
	}
	return skipped;
}

/** Copy between a local workspace path and a dssh:// path (either direction). */
export async function hybridCopyLocalRemote(svc, args) {
	const a = args && typeof args === "object" ? args : {};
	const root = typeof a.root === "string" && a.root ? a.root : null;
	const destRoot = typeof a.destRoot === "string" && a.destRoot ? a.destRoot : root;
	const srcRemote = pathIsRemote(a.path);
	const destRemote = pathIsRemote(a.destDir);

	if (srcRemote && !destRemote) {
		const src = await resolveDsshPath(a.path);
		if (!src) throw new Error("invalid dssh path");
		if (!destRoot) throw new Error("copy requires destRoot");

		const destDirTarget = await svc.fs.resolve(a.destDir);
		await svc.guard(destRoot, destDirTarget);
		const destDirInfo = await svc.fs.stat(destDirTarget);
		if (!destDirInfo || destDirInfo.type !== "directory") {
			return { ok: false, kind: "error", message: "destination is not a directory" };
		}

		const baseName = typeof a.newName === "string" && a.newName.trim()
			? a.newName.trim()
			: baseNameOf(src.remotePath);
		if (!baseName || baseName === "." || baseName === ".." || /[\\/]/.test(baseName)) {
			return { ok: false, kind: "error", message: "invalid name" };
		}

		const destRel = joinLocalDestRel(a.destDir, baseName);
		if (await localPathExists(svc, destRel, destRoot)) {
			return { ok: false, kind: "error", message: "an item with that name already exists there" };
		}

		const skipped = await copyRemoteTreeToLocal(svc, src.hostId, src.remotePath, destRel, destRoot);
		return copyResult(destRel, skipped);
	}

	if (!srcRemote && destRemote) {
		if (!root) throw new Error("copy requires root");
		const dest = await resolveDsshPath(a.destDir);
		if (!dest) throw new Error("invalid dssh path");

		const localTarget = await svc.fs.resolve(a.path);
		await svc.guard(root, localTarget);
		const localInfo = await svc.fs.stat(localTarget);
		if (!localInfo) return { ok: false, kind: "missing", message: "file not found" };

		const baseName = typeof a.newName === "string" && a.newName.trim()
			? a.newName.trim()
			: path.basename(svc.fs.processPath(localTarget));
		if (!baseName || baseName === "." || baseName === ".." || /[\\/]/.test(baseName)) {
			return { ok: false, kind: "error", message: "invalid name" };
		}

		const destRemotePath = joinRemotePath(dest.remotePath, baseName);
		const destDsshPath = makeDsshPath(dest.hostId, destRemotePath);

		try {
			await remoteStat(dest.hostId, destRemotePath);
			return { ok: false, kind: "error", message: "an item with that name already exists there" };
		} catch {
			/* dest missing — ok */
		}

		const skipped = await copyLocalTreeToRemote(svc, a.path, root, dest.hostId, destRemotePath);
		return copyResult(destDsshPath, skipped);
	}

	throw new Error("hybridCopyLocalRemote requires one local and one remote path");
}

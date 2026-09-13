import {
	isDsshPath,
	resolveDsshPath,
	listRemoteDirectory,
	remoteStat,
	remoteReadFile,
	remoteWriteFile,
	remoteRemove,
	remoteRename,
} from "../../dsh-ssh-workspace/lib/bridge.js";
import { makeDsshPath } from "../../dsh-ssh-workspace/lib/config.js";

export function pathIsRemote(p) {
	return isDsshPath(p);
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

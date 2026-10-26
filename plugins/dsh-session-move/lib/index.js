/**
 * dsh-session-move — host half.
 *
 * Moves a session to another workspace by rewriting its persisted cwd,
 * relocating the session log directory, and updating workspace membership.
 * Stock attachSession requires cwd === workspace path, so a plain membership
 * tweak is not enough.
 */
import { mkdir, readFile, rename, rm, writeFile, stat } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { constants, zstdCompress, zstdDecompress } from "node:zlib";
import { promisify } from "node:util";
import { registerRpcChannel } from "dsh-ide-shared/register-rpc-channel.js";

const name = "dsh-session-move";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/session-move";
const zstdCompressAsync = promisify(zstdCompress);
const zstdDecompressAsync = promisify(zstdDecompress);
/** Same magic / checksum options as dsh-session-persistence-jsonl. */
const ZSTD_MAGIC = 4247762216;
const CHECKSUM_OPTIONS = { params: { [constants.ZSTD_c_checksumFlag]: 1 } };

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

function dshHome() {
	return process.env.DSH_HOME || join(homedir(), ".dsh");
}

function sessionsRoot() {
	return join(dshHome(), "sessions");
}

/** Same encoding as dsh-session-persistence-jsonl encodeSegment. */
function encodeSegment(raw) {
	if (raw.length === 0) throw new Error("cannot encode an empty path segment");
	if (raw === ".") return "~002E";
	if (raw === "..") return "~002E~002E";
	let out = "";
	for (let i = 0; i < raw.length; i++) {
		const code = raw.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) out += ch;
		else out += `~${code.toString(16).toUpperCase().padStart(4, "0")}`;
	}
	return out;
}

/** Same encoding as dsh-session-persistence-jsonl projectKey. */
function projectKey(cwd) {
	if (cwd.length === 0) throw new Error("cannot encode an empty project path");
	let readable = "";
	let separatorRun = false;
	for (let i = 0; i < cwd.length; i++) {
		const code = cwd.charCodeAt(i);
		const ch = String.fromCharCode(code);
		if (ch === "/" || ch === "\\" || ch === ":") {
			if (!separatorRun) readable += "-";
			separatorRun = true;
		} else if (ch !== "~" && /^[A-Za-z0-9._-]$/.test(ch)) {
			readable += ch;
			separatorRun = false;
		} else {
			readable += `~${code.toString(16).toUpperCase().padStart(4, "0")}`;
			separatorRun = false;
		}
	}
	return `--${(readable.replace(/^-+/, "") || "root").slice(0, 251)}--`;
}

function sessionDirFor(cwd, sessionId) {
	return join(sessionsRoot(), projectKey(cwd), encodeSegment(sessionId));
}

async function pathExists(path) {
	try {
		await stat(path);
		return true;
	} catch {
		return false;
	}
}

/**
 * Locate complete ZSTD frames without decompressing (mirrors harness scanZstdFrames).
 * @param {Buffer} buffer
 * @returns {{ frames: { start: number, end: number }[], tornStart?: number }}
 */
function scanZstdFrames(buffer) {
	const frames = [];
	let offset = 0;
	while (offset < buffer.length) {
		const start = offset;
		if (buffer.length - offset < 4) return { frames, tornStart: start };
		if (buffer.readUInt32LE(offset) !== ZSTD_MAGIC) {
			throw new Error(`corrupt Zstandard session log: invalid frame magic at byte ${offset}`);
		}
		offset += 4;
		if (offset === buffer.length) return { frames, tornStart: start };
		const descriptor = buffer.readUInt8(offset);
		offset += 1;
		if ((descriptor & 24) !== 0) {
			throw new Error(`corrupt Zstandard session log: reserved frame-header bit at byte ${offset - 1}`);
		}
		const contentSizeFlag = descriptor >>> 6;
		const singleSegment = (descriptor & 32) !== 0;
		const checksum = (descriptor & 4) !== 0;
		const dictionaryFlag = descriptor & 3;
		const dictionaryBytes = dictionaryFlag === 3 ? 4 : dictionaryFlag;
		const contentSizeBytes = contentSizeFlag === 0 ? (singleSegment ? 1 : 0) : 1 << contentSizeFlag;
		const remainingHeaderBytes = (singleSegment ? 0 : 1) + dictionaryBytes + contentSizeBytes;
		if (buffer.length - offset < remainingHeaderBytes) return { frames, tornStart: start };
		offset += remainingHeaderBytes;
		for (;;) {
			if (buffer.length - offset < 3) return { frames, tornStart: start };
			const blockHeader = buffer.readUIntLE(offset, 3);
			offset += 3;
			const lastBlock = (blockHeader & 1) !== 0;
			const blockType = (blockHeader >>> 1) & 3;
			const blockSize = blockHeader >>> 3;
			if (blockType === 3) {
				throw new Error(`corrupt Zstandard session log: reserved block type at byte ${offset - 3}`);
			}
			const payloadBytes = blockType === 1 ? 1 : blockSize;
			if (buffer.length - offset < payloadBytes) return { frames, tornStart: start };
			offset += payloadBytes;
			if (lastBlock) break;
		}
		if (checksum) {
			if (buffer.length - offset < 4) return { frames, tornStart: start };
			offset += 4;
		}
		frames.push({ start, end: offset });
	}
	return { frames };
}

/**
 * Remove sessionId from every workspace's stored membership.
 * Important: do NOT gate on workspace.sessionIds (that list is cwd-filtered and
 * goes empty after we rewrite sessionPaths — which left stale membership before).
 * @param {any} registry
 * @param {string} sessionId
 */
async function detachEverywhere(registry, sessionId) {
	for (const workspace of registry.list()) {
		await workspace.detachSession(sessionId);
	}
}

/**
 * Find the on-disk session log for an id (scan project dirs).
 * @param {string} sessionId
 */
async function findSessionLog(sessionId) {
	const root = sessionsRoot();
	const encoded = encodeSegment(sessionId);
	const { readdir } = await import("node:fs/promises");
	let projects = [];
	try {
		projects = await readdir(root, { withFileTypes: true });
	} catch {
		return null;
	}
	for (const ent of projects) {
		if (!ent.isDirectory()) continue;
		const dir = join(root, ent.name, encoded);
		for (const name of ["session.jsonl.zstd", "session.jsonl"]) {
			const path = join(dir, name);
			if (await pathExists(path)) {
				return { dir, path, zstd: name.endsWith(".zstd") };
			}
		}
	}
	return null;
}

/**
 * Rewrite only the header line/cwd. For zstd logs, rewrite the first frame only
 * and keep all subsequent event frames intact (Node one-shot decompress would
 * drop multi-frame tails and truncate chats to header-only).
 * @param {{ path: string, zstd: boolean }} log
 * @param {string} newCwd
 */
async function rewriteLogCwd(log, newCwd) {
	const raw = await readFile(log.path);

	if (!log.zstd) {
		const text = raw.toString("utf8");
		const nl = text.indexOf("\n");
		const first = nl === -1 ? text : text.slice(0, nl);
		const rest = nl === -1 ? "" : text.slice(nl + 1);
		const header = parseSessionHeader(first, log.path);
		header.cwd = newCwd;
		const nextBuf = Buffer.from(`${JSON.stringify(header)}\n${rest}`, "utf8");
		return { header, nextBuf, fileName: "session.jsonl" };
	}

	const { frames, tornStart } = scanZstdFrames(raw);
	if (frames.length === 0) {
		throw new Error(`corrupt session log ${log.path}: no complete zstd frames`);
	}
	if (tornStart !== undefined) {
		throw new Error(`corrupt session log ${log.path}: incomplete final zstd frame`);
	}

	const firstFrame = raw.subarray(frames[0].start, frames[0].end);
	const plaintext = await zstdDecompressAsync(firstFrame);
	if (plaintext.length === 0 || plaintext.indexOf(10) !== plaintext.length - 1) {
		throw new Error(`corrupt session log ${log.path}: first frame is not exactly one header line`);
	}
	const header = parseSessionHeader(plaintext.subarray(0, -1).toString("utf8"), log.path);
	header.cwd = newCwd;
	const nextHeaderFrame = await zstdCompressAsync(
		Buffer.from(`${JSON.stringify(header)}\n`, "utf8"),
		CHECKSUM_OPTIONS,
	);
	const tail = raw.subarray(frames[0].end);
	const nextBuf = Buffer.concat([nextHeaderFrame, tail]);
	return { header, nextBuf, fileName: "session.jsonl.zstd" };
}

/**
 * @param {string} first
 * @param {string} path
 */
function parseSessionHeader(first, path) {
	let header;
	try {
		header = JSON.parse(first);
	} catch (error) {
		throw new Error(`corrupt session header in ${path}`, { cause: error });
	}
	if (header?.type !== "session" || typeof header.id !== "string") {
		throw new Error(`invalid session header in ${path}`);
	}
	return header;
}

/**
 * Projcache rows are identity-checked on createdAt+cwd. After a cwd rewrite the
 * cache miss makes cold list probe the (often small) log and mark blank chats
 * as blank:true — hiding non-blank moved sessions from the sidebar.
 * @param {string} sessionId
 * @param {string} newCwd
 */
async function updateProjcacheCwd(sessionId, newCwd) {
	const path = join(dshHome(), "storages", "session_projcache.json");
	let raw;
	try {
		raw = await readFile(path, "utf8");
	} catch {
		return;
	}
	let doc;
	try {
		doc = JSON.parse(raw);
	} catch {
		return;
	}
	const rec = doc?.tables?.sessions?.[sessionId];
	if (!rec || typeof rec !== "object") return;
	const identity = rec.identity && typeof rec.identity === "object" ? rec.identity : {};
	if (identity.cwd === newCwd) return;
	rec.identity = { ...identity, cwd: newCwd };
	await writeFile(path, `${JSON.stringify(doc, null, 2)}\n`);
}

/**
 * Relocate session artifacts to the target workspace cwd.
 * @param {string} sessionId
 * @param {string} newCwd
 */
async function relocateSessionFiles(sessionId, newCwd) {
	const found = await findSessionLog(sessionId);
	if (!found) throw new Error(`session files not found for ${sessionId}`);

	const { header, nextBuf, fileName } = await rewriteLogCwd(found, newCwd);
	const destDir = sessionDirFor(newCwd, sessionId);
	if (destDir === found.dir) {
		await writeFile(found.path, nextBuf);
		await updateProjcacheCwd(sessionId, newCwd);
		return { header, from: found.dir, to: destDir };
	}

	if (await pathExists(destDir)) {
		throw new Error(`refusing to move ${sessionId}: destination already exists at ${destDir}`);
	}

	await mkdir(destDir, { recursive: true });
	const destPath = join(destDir, fileName);
	await writeFile(destPath, nextBuf);

	// Move any sibling artifacts (rare), then remove the old dir.
	try {
		const { readdir } = await import("node:fs/promises");
		for (const name of await readdir(found.dir)) {
			if (name === fileName || name === "session.jsonl" || name === "session.jsonl.zstd") continue;
			await rename(join(found.dir, name), join(destDir, name)).catch(() => {});
		}
	} catch {
		/* ignore */
	}

	await rm(found.dir, { recursive: true, force: true });
	await updateProjcacheCwd(sessionId, newCwd);
	return { header, from: found.dir, to: destDir };
}

/**
 * @param {any} registry
 * @param {string} sessionId
 * @param {string} cwd
 * @param {any} header
 */
function rememberMoved(registry, sessionId, cwd, header) {
	try {
		registry.sessionPaths?.set?.(sessionId, cwd);
	} catch {
		/* ignore */
	}
	try {
		registry.headers?.set?.(sessionId, { ...header, cwd });
	} catch {
		/* ignore */
	}
	try {
		registry.invalidSessionPaths?.delete?.(sessionId);
	} catch {
		/* ignore */
	}
}

/**
 * Unload a live agent+session so we can relocate its log safely.
 * Sessions stay in memory after you leave them in the UI — that alone must not block moves.
 * @param {any} ctx
 * @param {string} sessionId
 */
async function unloadLiveSession(ctx, sessionId) {
	const agents = ctx.get?.("agents");
	const sessions = ctx.get?.("sessions");
	const agent = agents?.get?.(sessionId);
	if (agent?.status === "running") {
		throw new Error("This chat is still running. Wait for the agent to finish, then drop it on the workspace again.");
	}

	const agentEntry = agents?.store?.get?.(sessionId);
	if (agentEntry) {
		try {
			if (typeof agents.detachEntered === "function") agents.detachEntered(agentEntry);
			else if (typeof agentEntry.detach === "function") agentEntry.detach();
		} catch (error) {
			ctx.logger?.warn?.(
				`dsh-session-move: agent unload failed: ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	const sessionEntry = sessions?.store?.get?.(sessionId);
	if (sessionEntry) {
		try {
			if (typeof sessionEntry.detach === "function") sessionEntry.detach();
			else if (typeof sessions.detachEntered === "function") sessions.detachEntered(sessionEntry);
		} catch (error) {
			ctx.logger?.warn?.(
				`dsh-session-move: session unload failed: ${error instanceof Error ? error.message : error}`,
			);
		}
	}

	// If still live after unload attempts, refuse rather than corrupt the log.
	if (sessions?.get?.(sessionId) || agents?.get?.(sessionId)) {
		throw new Error(
			"Couldn’t unload this chat from memory. Open New Session (or another chat), hard-refresh, then try the drop again.",
		);
	}
}

/**
 * @param {any} ctx
 * @param {any} registry
 */
function registerRpc(ctx, registry) {
	const dispose = registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
			try {
				if (endpoint !== "moveToWorkspace") {
					return transportError(new Error(`dsh-session-move unknown endpoint: ${endpoint}`));
				}
				const sessionId = typeof payload?.sessionId === "string" ? payload.sessionId.trim() : "";
				const workspaceId = typeof payload?.workspaceId === "string" ? payload.workspaceId.trim() : "";
				if (!sessionId.startsWith("session-")) {
					throw new Error("payload.sessionId must be a session id");
				}
				if (!workspaceId) throw new Error("payload.workspaceId is required");

				const target = registry.list().find((w) => w.id === workspaceId || w.workspaceId === workspaceId);
				if (!target) throw new Error(`unknown workspace ${workspaceId}`);

				await unloadLiveSession(ctx, sessionId);

				const already = target.sessionIds?.includes(sessionId);
				const source = registry.list().find((w) => w.sessionIds?.includes(sessionId));
				if (already && source && (source.id === target.id || source.workspaceId === target.workspaceId)) {
					return ok({
						sessionId,
						workspaceId: target.id || target.workspaceId,
						workspaceTitle: target.title,
						moved: false,
						reason: "already-there",
					});
				}

				// Detach from raw membership BEFORE rewriting cwd/sessionPaths.
				// Otherwise source.workspace.sessionIds is already filtered empty and detach is skipped.
				await detachEverywhere(registry, sessionId);

				const relocated = await relocateSessionFiles(sessionId, target.path);
				rememberMoved(registry, sessionId, target.path, relocated.header);

				// Prefer official attach now that cwd matches; fall back to mutate.
				try {
					await target.attachSession(sessionId);
				} catch (attachErr) {
					await target.mutate((record) => ({
						...record,
						sessionIds: [sessionId, ...record.sessionIds.filter((id) => id !== sessionId)],
					}));
					rememberMoved(registry, sessionId, target.path, relocated.header);
					ctx.logger?.warn?.(
						`dsh-session-move: attachSession failed (${attachErr instanceof Error ? attachErr.message : attachErr}); used mutate fallback`,
					);
				}

				return ok({
					sessionId,
					workspaceId: target.id || target.workspaceId,
					workspaceTitle: target.title,
					workspacePath: target.path,
					moved: true,
					from: relocated.from,
					to: relocated.to,
				});
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" },
	);
	return () => dispose();
}

function apply(ctx) {
	ctx.inject(["connection", "webServer"], (connectionCtx) => {
		connectionCtx.inject(["workspaceRegistry"], (scope) => {
			scope.effect(() => registerRpc(scope, scope.workspaceRegistry), "dsh-session-move: rpc");
		});
	});
}

export { apply, name, inject };

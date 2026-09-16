/**
 * dsh-archive — host half.
 *
 * Upstream Harness can archive sessions but has no unarchive / delete UI.
 * Loopback RPC (`/archive`): list / unarchive / permanent delete.
 *
 * 0.1.5 lesson: "delete" must wipe disk + projcache BEFORE unarchiving.
 * Unarchiving alone drops the archive flag and the chat reappears under Ungrouped.
 */
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { readdir, readFile, rm, writeFile, unlink } from "node:fs/promises";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";

const name = "dsh-archive";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/archive";

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

function payloadId(payload) {
	const id = payload?.sessionId;
	if (typeof id !== "string" || id.trim().length === 0) {
		throw new Error("dsh-archive RPC: payload.sessionId must be a non-blank string");
	}
	return id.trim();
}

function dshHome() {
	return process.env.DSH_HOME || join(homedir(), ".dsh");
}

function sessionsRoot() {
	return join(dshHome(), "sessions");
}

function projCacheSessionPath(sessionId) {
	return join(dshHome(), "storages", "session_projcache", "sessions", `${sessionId}.json`);
}

function projCacheLegacyPath() {
	return join(dshHome(), "storages", "session_projcache.json");
}

/** Safe get — Cordis throws if the service wasn't injected on this fiber. */
function tryGet(ctx, key) {
	try {
		if (ctx?.[key] !== undefined) return ctx[key];
		return ctx?.get?.(key);
	} catch {
		return undefined;
	}
}

async function readTitles() {
	/** @type {Record<string, string>} */
	const titles = {};
	try {
		const dir = join(dshHome(), "storages", "session_projcache", "sessions");
		const files = await readdir(dir);
		for (const file of files) {
			if (!file.endsWith(".json")) continue;
			try {
				const raw = JSON.parse(await readFile(join(dir, file), "utf8"));
				const id = file.replace(/\.json$/, "");
				const title = raw?.record?.rows?.title?.val;
				const cwd = raw?.record?.identity?.cwd;
				if (typeof title === "string" && title.trim()) titles[id] = title.trim();
				else if (typeof cwd === "string" && cwd.trim()) {
					const base = cwd.replace(/\/+$/, "").split("/").pop();
					if (base) titles[id] = base;
				}
			} catch {
				/* skip */
			}
		}
	} catch {
		/* no per-session dir */
	}
	try {
		const raw = JSON.parse(await readFile(projCacheLegacyPath(), "utf8"));
		for (const [id, row] of Object.entries(raw?.tables?.sessions || {})) {
			if (titles[id]) continue;
			const title = row?.rows?.title?.val;
			if (typeof title === "string" && title.trim()) titles[id] = title.trim();
		}
	} catch {
		/* ignore */
	}
	return titles;
}

async function unarchiveSession(registry, sessionId) {
	await registry.enqueueOperation(async () => {
		const state = registry.requireState();
		if (!state.archivedSessionIds.includes(sessionId)) return;
		await registry.setState({
			...state,
			archivedSessionIds: state.archivedSessionIds.filter((id) => id !== sessionId),
		});
	});
}

async function detachEverywhere(registry, sessionId) {
	for (const workspace of registry.list()) {
		if (workspace.sessionIds?.includes(sessionId)) {
			await workspace.detachSession(sessionId);
		}
	}
}

function forgetHeader(registry, sessionId) {
	try {
		registry.headers?.delete?.(sessionId);
	} catch {
		/* best-effort */
	}
	try {
		registry.invalidSessionPaths?.delete?.(sessionId);
	} catch {
		/* best-effort */
	}
}

function disposeLiveSession(ctx, sessionId) {
	try {
		const sessions = tryGet(ctx, "sessions");
		const session = sessions?.get?.(sessionId);
		if (!session) return false;
		if (typeof session.dispose === "function") {
			session.dispose();
			return true;
		}
		const entry = sessions?.store?.get?.(sessionId);
		if (typeof entry?.detach === "function") {
			entry.detach();
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

/** Remove any ~/.dsh/sessions/<bucket>/<sessionId> and empty parent buckets. */
async function wipeSessionDirs(sessionId) {
	const root = sessionsRoot();
	/** @type {string[]} */
	const paths = [];
	let buckets;
	try {
		buckets = await readdir(root, { withFileTypes: true });
	} catch {
		return { removed: false, paths };
	}
	for (const bucket of buckets) {
		if (!bucket.isDirectory()) continue;
		const bucketPath = join(root, bucket.name);
		const candidate = join(bucketPath, sessionId);
		try {
			await rm(candidate, { recursive: true, force: true });
			paths.push(candidate);
		} catch {
			/* absent */
		}
		try {
			const left = await readdir(bucketPath);
			if (left.length === 0) {
				await rm(bucketPath, { recursive: true, force: true });
				paths.push(bucketPath);
			}
		} catch {
			/* ignore */
		}
	}
	return { removed: paths.length > 0, paths };
}

async function removeViaPersistence(ctx, sessionId, registry) {
	const persistence = tryGet(ctx, "sessionPersistence");
	if (!persistence) return { removed: false, paths: [] };
	/** @type {string[]} */
	const paths = [];

	let header = null;
	try {
		const list = await persistence.list();
		const snap = list.find((entry) => String(entry.header?.id) === sessionId);
		header = snap?.header ?? null;
	} catch {
		header = null;
	}

	const tryRmLocate = async (meta) => {
		if (!meta || typeof persistence.locate !== "function") return;
		try {
			const loc = persistence.locate(meta);
			if (!loc?.path) return;
			const dir = dirname(loc.path);
			await rm(dir, { recursive: true, force: true });
			paths.push(dir);
		} catch {
			/* ignore */
		}
	};

	if (header) await tryRmLocate(header);
	else if (registry) {
		for (const workspace of registry.list()) {
			await tryRmLocate({
				id: sessionId,
				cwd: workspace.path,
				version: 1,
				createdAt: 0,
			});
		}
	}
	return { removed: paths.length > 0, paths };
}

async function scrubProjCache(sessionId) {
	try {
		await unlink(projCacheSessionPath(sessionId));
	} catch {
		/* missing ok */
	}
	try {
		const path = projCacheLegacyPath();
		const raw = JSON.parse(await readFile(path, "utf8"));
		if (!raw?.tables?.sessions?.[sessionId]) return;
		delete raw.tables.sessions[sessionId];
		await writeFile(path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
	} catch {
		/* best-effort */
	}
}

/**
 * @param {() => any} getCtx — latest fiber (may gain sessionPersistence/sessions later)
 */
function registerArchiveRpc(getCtx) {
	const bootstrap = getCtx();
	const dispose = registerRpcChannel(bootstrap, RPC_CHANNEL, async (endpoint, payload) => {
		const ctx = getCtx();
		const registry = ctx.workspaceRegistry || tryGet(ctx, "workspaceRegistry");
		if (!registry) return transportError(new Error("workspaceRegistry unavailable"));
		try {
			switch (endpoint) {
				case "list": {
					const ids = [...registry.archivedSessionIds];
					const titles = await readTitles();
					const workspaces = registry.list();
					const items = ids.map((sessionId) => {
						const workspace = workspaces.find((w) => w.sessionIds?.includes(sessionId));
						return {
							sessionId,
							title: titles[sessionId] || sessionId.replace(/^session-/, "").slice(0, 8),
							workspaceTitle: workspace?.title || null,
							workspacePath: workspace?.path || null,
						};
					});
					return ok({ items, generatedAt: Date.now() });
				}
				case "unarchive": {
					const sessionId = payloadId(payload);
					await unarchiveSession(registry, sessionId);
					return ok({
						sessionId,
						archivedSessionIds: [...registry.archivedSessionIds],
					});
				}
				case "delete": {
					const sessionId = payloadId(payload);
					await detachEverywhere(registry, sessionId);
					const liveDisposed = disposeLiveSession(ctx, sessionId);
					const viaPersist = await removeViaPersistence(ctx, sessionId, registry);
					const scanned = await wipeSessionDirs(sessionId);
					await scrubProjCache(sessionId);
					forgetHeader(registry, sessionId);
					// Unarchive only after wipe — otherwise chats bounce back to Ungrouped.
					await unarchiveSession(registry, sessionId);
					const paths = [...(viaPersist.paths || []), ...(scanned.paths || [])];
					return ok({
						sessionId,
						filesRemoved: viaPersist.removed || scanned.removed,
						liveDisposed,
						path: paths[0] || null,
						paths,
						archivedSessionIds: [...registry.archivedSessionIds],
					});
				}
				default:
					return transportError(new Error(`dsh-archive RPC unknown endpoint: ${endpoint}`));
			}
		} catch (error) {
			return transportError(error);
		}
	});
	return () => {
		dispose();
	};
}

/**
 * One RPC registration; optional injects only widen the fiber used by getCtx().
 * @param {any} ctx
 */
function apply(ctx) {
	ctx.inject(["connection", "webServer"], (connectionCtx) => {
		connectionCtx.inject(["workspaceRegistry"], (registryCtx) => {
			/** @type {any} */
			let activeCtx = registryCtx;
			registryCtx.inject(["sessionPersistence"], (persistCtx) => {
				activeCtx = persistCtx;
				persistCtx.inject(["sessions"], (sessionsCtx) => {
					activeCtx = sessionsCtx;
				});
			});
			registryCtx.effect(
				() => registerArchiveRpc(() => activeCtx),
				"dsh-archive: rpc",
			);
		});
	});
}

export { apply, name, inject };

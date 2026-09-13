/**
 * dsh-archive — host half.
 *
 * Upstream Harness can archive sessions but has no unarchive / delete UI.
 * This plugin adds a loopback RPC channel (`/archive`) that:
 *   - lists archived sessions (with titles from the projection cache)
 *   - restores (unarchives) by rewriting workspaceRegistry.archivedSessionIds
 *   - permanently deletes: detach from workspace, remove archive flag, rm session dir
 *
 * Unarchive uses workspaceRegistry.setState / enqueueOperation (TypeScript-private
 * but present at runtime) so domain/changed still fires host/archived-sessions-changed.
 *
 * Important: nest `connection` then `workspaceRegistry` injects. Waiting on both
 * in one `inject([...])` never fires from this patch-plugin fiber (HTTP 405 from
 * the static frontend). Accessing `ctx.workspaceRegistry` without inject throws.
 */
import { dirname } from "node:path";
import { homedir } from "node:os";
import { readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const name = "dsh-archive";
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

async function readTitles() {
	const path = join(dshHome(), "storages", "session_projcache.json");
	try {
		const raw = JSON.parse(await readFile(path, "utf8"));
		const table = raw?.tables?.sessions || {};
		/** @type {Record<string, string>} */
		const titles = {};
		for (const [id, row] of Object.entries(table)) {
			const title = row?.rows?.title?.val;
			if (typeof title === "string" && title.trim()) titles[id] = title.trim();
		}
		return titles;
	} catch {
		return {};
	}
}

/**
 * @param {any} registry
 * @param {string} sessionId
 */
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

/**
 * @param {any} registry
 * @param {string} sessionId
 */
async function detachEverywhere(registry, sessionId) {
	for (const workspace of registry.list()) {
		if (workspace.sessionIds?.includes(sessionId)) {
			await workspace.detachSession(sessionId);
		}
	}
}

/**
 * @param {any} ctx
 * @param {string} sessionId
 */
async function removeSessionFiles(ctx, sessionId, registry) {
	const persistence = ctx.get?.("sessionPersistence");
	if (!persistence) return { removed: false, path: null };

	let header = null;
	try {
		const list = await persistence.list();
		const snap = list.find((entry) => String(entry.header?.id) === sessionId);
		header = snap?.header ?? null;
	} catch {
		header = null;
	}

	if (!header && typeof persistence.loadStored === "function") {
		try {
			const stored = await persistence.loadStored(sessionId);
			header = stored?.meta ?? stored?.header ?? null;
		} catch {
			header = null;
		}
	}

	if (!header && registry) {
		for (const workspace of registry.list()) {
			try {
				const loc = persistence.locate({
					id: sessionId,
					cwd: workspace.path,
					version: 1,
					createdAt: 0,
				});
				if (loc?.path) {
					await rm(dirname(loc.path), { recursive: true, force: true });
					return { removed: true, path: dirname(loc.path) };
				}
			} catch {
				/* try next workspace */
			}
		}
		return { removed: false, path: null };
	}

	if (!header) return { removed: false, path: null };

	const loc = persistence.locate(header);
	if (!loc?.path) return { removed: false, path: null };
	const dir = dirname(loc.path);
	await rm(dir, { recursive: true, force: true });
	return { removed: true, path: dir };
}

/**
 * Drop title cache entry so search/UI don't keep a ghost name.
 * @param {string} sessionId
 */
async function scrubProjCache(sessionId) {
	const path = join(dshHome(), "storages", "session_projcache.json");
	try {
		const raw = JSON.parse(await readFile(path, "utf8"));
		if (!raw?.tables?.sessions?.[sessionId]) return;
		delete raw.tables.sessions[sessionId];
		await writeFile(path, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
	} catch {
		/* best-effort */
	}
}

/**
 * @param {any} ctx — fiber that already injected connection + workspaceRegistry
 */
function registerArchiveRpc(ctx) {
	const register = ctx.connection.rpc.handle;
	const registry = ctx.workspaceRegistry;
	const dispose = register(
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				switch (endpoint) {
					case "list": {
						const ids = [...registry.archivedSessionIds];
						const titles = await readTitles();
						const workspaces = registry.list();
						const items = ids.map((sessionId) => {
							const workspace = workspaces.find((w) =>
								w.sessionIds?.includes(sessionId)
							);
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
						const files = await removeSessionFiles(ctx, sessionId, registry);
						await unarchiveSession(registry, sessionId);
						await scrubProjCache(sessionId);
						return ok({
							sessionId,
							filesRemoved: files.removed,
							path: files.path,
							archivedSessionIds: [...registry.archivedSessionIds],
						});
					}
					default:
						return transportError(new Error(`dsh-archive RPC unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" }
	);
	return () => {
		dispose();
	};
}

/**
 * Nest injects: waiting on both at once never fires from this patch fiber;
 * connection alone mounts the route, then workspaceRegistry binds the handler.
 * @param {any} ctx
 */
function apply(ctx) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.inject(["workspaceRegistry"], (scope) => {
			scope.effect(() => registerArchiveRpc(scope), "dsh-archive: rpc");
		});
	});
}

export { apply, name };

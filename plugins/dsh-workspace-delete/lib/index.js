/**
 * dsh-workspace-delete — host half.
 *
 * Stock Harness "delete workspace" only drops the registry entry and keeps the
 * folder + session logs. This plugin adds a loopback RPC channel that:
 *   - previews file + chat counts for a workspace
 *   - on confirm: deletes sessions, removes the workspace folder, then registry.delete
 */
import { dirname } from "node:path";
import { homedir } from "node:os";
import { readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import path from "node:path";
import { registerRpcChannel } from "dsh-ide-shared/register-rpc-channel.js";

const name = "dsh-workspace-delete";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/workspace-delete";
const ROOT = process.env.DSH_WORKSPACE_ROOT || "/workspace";

const NEVER_REGISTER = new Set(
	String(process.env.DSH_WORKSPACE_SYNC_SKIP || "repos")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
);

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

function payloadWorkspaceId(payload) {
	const id = payload?.workspaceId;
	if (typeof id !== "string" || id.trim().length === 0) {
		throw new Error("dsh-workspace-delete RPC: payload.workspaceId is required");
	}
	return id.trim();
}

function entityId(entity) {
	return entity?.id || entity?.workspaceId || null;
}

function dshHome() {
	return process.env.DSH_HOME || join(homedir(), ".dsh");
}

/**
 * @param {string} dir
 */
async function countTree(dir) {
	let files = 0;
	let dirs = 0;

	async function walk(current) {
		let ents;
		try {
			ents = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		for (const ent of ents) {
			if (!ent.name || ent.name.startsWith(".")) continue;
			const next = path.join(current, ent.name);
			if (ent.isDirectory()) {
				dirs += 1;
				await walk(next);
			} else {
				files += 1;
			}
		}
	}

	await walk(dir);
	return { files, dirs };
}

/**
 * @param {any} registry
 * @param {string} workspaceId
 */
function findWorkspace(registry, workspaceId) {
	return registry.list().find((w) => entityId(w) === workspaceId) || null;
}

/**
 * @param {string} workspacePath
 */
function assertDeletablePath(workspacePath) {
	const resolved = path.resolve(workspacePath);
	const rootR = path.resolve(ROOT);
	if (resolved === rootR) {
		throw new Error("cannot delete the /workspace root");
	}
	if (!resolved.startsWith(`${rootR}${path.sep}`) && resolved !== rootR) {
		throw new Error("workspace path is outside the workspace root");
	}
	const base = path.basename(resolved);
	if (NEVER_REGISTER.has(base)) {
		throw new Error(`cannot delete protected workspace folder "${base}"`);
	}
	return resolved;
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
 * @param {string} sessionId
 */
async function scrubProjCache(sessionId) {
	const cachePath = join(dshHome(), "storages", "session_projcache.json");
	try {
		const raw = JSON.parse(await readFile(cachePath, "utf8"));
		if (!raw?.tables?.sessions?.[sessionId]) return;
		delete raw.tables.sessions[sessionId];
		await writeFile(cachePath, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
	} catch {
		/* best-effort */
	}
}

/**
 * @param {any} ctx
 * @param {string} sessionId
 * @param {any} registry
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
 * @param {any} ctx
 * @param {any} registry
 * @param {string} sessionId
 */
async function deleteSession(ctx, registry, sessionId) {
	await detachEverywhere(registry, sessionId);
	const files = await removeSessionFiles(ctx, sessionId, registry);
	await scrubProjCache(sessionId);
	return files;
}

/**
 * @param {any} registry
 * @param {string} workspaceId
 */
async function previewWorkspace(registry, workspaceId) {
	const workspace = findWorkspace(registry, workspaceId);
	if (!workspace) throw new Error(`unknown workspace ${workspaceId}`);

	const workspacePath = String(workspace.path || "");
	assertDeletablePath(workspacePath);

	let fileCount = 0;
	let dirCount = 0;
	let folderExists = false;
	try {
		const st = await stat(workspacePath);
		if (st.isDirectory()) {
			folderExists = true;
			const counts = await countTree(workspacePath);
			fileCount = counts.files;
			dirCount = counts.dirs;
		}
	} catch {
		folderExists = false;
	}

	const sessionIds = [...(workspace.sessionIds || [])];
	return {
		workspaceId: entityId(workspace),
		title: workspace.title || path.basename(workspacePath),
		path: workspacePath,
		fileCount,
		dirCount,
		sessionCount: sessionIds.length,
		hasFiles: fileCount > 0 || dirCount > 0,
		hasSessions: sessionIds.length > 0,
		folderExists,
		isEmpty: fileCount === 0 && dirCount === 0 && sessionIds.length === 0,
	};
}

/**
 * @param {any} ctx
 * @param {any} registry
 * @param {string} workspaceId
 */
async function executeDelete(ctx, registry, workspaceId) {
	const workspace = findWorkspace(registry, workspaceId);
	if (!workspace) throw new Error(`unknown workspace ${workspaceId}`);

	const workspacePath = assertDeletablePath(String(workspace.path || ""));
	const sessionIds = [...(workspace.sessionIds || [])];
	let deletedSessions = 0;
	let removedSessionDirs = 0;

	for (const sessionId of sessionIds) {
		const res = await deleteSession(ctx, registry, sessionId);
		deletedSessions += 1;
		if (res.removed) removedSessionDirs += 1;
	}

	let folderRemoved = false;
	try {
		const st = await stat(workspacePath);
		if (st.isDirectory()) {
			await rm(workspacePath, { recursive: true, force: true });
			folderRemoved = true;
		}
	} catch (err) {
		if (err && typeof err === "object" && "code" in err && err.code !== "ENOENT") {
			throw err;
		}
	}

	const id = entityId(workspace);
	if (!id || typeof registry.delete !== "function") {
		throw new Error("workspace registry delete unavailable");
	}
	await registry.delete(id);

	return {
		workspaceId: id,
		title: workspace.title || path.basename(workspacePath),
		path: workspacePath,
		deletedSessions,
		removedSessionDirs,
		folderRemoved,
	};
}

/**
 * @param {any} ctx
 */
function registerRpc(ctx) {
	const registry = ctx.workspaceRegistry;
	const dispose = registerRpcChannel(
		ctx,
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				switch (endpoint) {
					case "preview": {
						const workspaceId = payloadWorkspaceId(payload);
						return ok(await previewWorkspace(registry, workspaceId));
					}
					case "delete": {
						const workspaceId = payloadWorkspaceId(payload);
						return ok(await executeDelete(ctx, registry, workspaceId));
					}
					default:
						return transportError(new Error(`dsh-workspace-delete RPC unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
	);
	return () => dispose();
}

/**
 * @param {any} ctx
 */
function apply(ctx) {
	ctx.inject(["connection", "webServer"], (connectionCtx) => {
		connectionCtx.inject(["workspaceRegistry"], (scope) => {
			scope.effect(() => registerRpc(scope), `${name}: rpc`);
		});
	});
}

export { apply, name, inject };

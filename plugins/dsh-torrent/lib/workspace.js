import { join, resolve } from "node:path";

/** Folder name created at the root of each workspace (not a separate Harness workspace). */
export const WORKSPACE_DOWNLOAD_FOLDER = "download";

/** @deprecated legacy default — treated as “no override”. */
export const LEGACY_GLOBAL_DOWNLOAD_DIR = "/workspace/downloads";

/**
 * @param {string} workspaceRoot
 */
export function workspaceDownloadDir(workspaceRoot) {
	return join(resolve(workspaceRoot), WORKSPACE_DOWNLOAD_FOLDER);
}

/**
 * @param {{ get?: (id: string) => { session?: { header?: { cwd?: string } } } } | undefined} agents
 * @param {{ list?: () => Array<{ path: string, sessionIds?: string[] }> } | undefined} workspaceRegistry
 * @param {string | undefined | null} sessionId
 */
export async function resolveWorkspaceRoot(agents, workspaceRegistry, sessionId) {
	const id = typeof sessionId === "string" ? sessionId.trim() : "";
	if (id && agents) {
		const agent = agents.get(id);
		const cwd = agent?.session?.header?.cwd;
		if (typeof cwd === "string" && cwd.startsWith("dssh://")) {
			throw new Error(
				"Downloads are stored on the Harness host. Use a local workspace, or SSH files separately.",
			);
		}
		if (typeof cwd === "string" && cwd.length > 0) {
			return resolve(cwd);
		}
	}
	if (id && workspaceRegistry) {
		for (const ws of workspaceRegistry.list()) {
			if (Array.isArray(ws.sessionIds) && ws.sessionIds.includes(id)) {
				return resolve(ws.path);
			}
		}
	}
	return resolve("/workspace");
}

/**
 * @param {{ downloadDir?: string | null }} cfg
 * @param {string} workspaceRoot
 */
export function effectiveDownloadDir(cfg, workspaceRoot) {
	const override = typeof cfg.downloadDir === "string" ? cfg.downloadDir.trim() : "";
	if (override && override !== LEGACY_GLOBAL_DOWNLOAD_DIR) {
		return override;
	}
	return workspaceDownloadDir(workspaceRoot);
}

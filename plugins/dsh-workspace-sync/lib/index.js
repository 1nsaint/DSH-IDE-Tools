/**
 * dsh-workspace-sync — host half.
 *
 * Harness only shows *registered* workspaces in the sidebar. Agents (and users)
 * regularly create folders under /workspace that never get registered, so they
 * show up in Git/disk scans but stay invisible in Workspaces.
 *
 * This plugin makes that split impossible: every non-dot, non-empty top-level
 * directory under /workspace is registered via workspaceRegistry.create
 * (idempotent by realpath). Nested folders (e.g. Git Repos/Champions-DB) are
 * intentionally NOT auto-registered — those belong *inside* a parent workspace.
 *
 * Empty top-level dirs are skipped so deleting a workspace in the UI (which
 * only drops the registry entry) is not undone by re-registering a leftover
 * empty folder after refresh. Explicit Add-workspace registrations of empty
 * folders still stick — we only skip *creating* new ones from disk scans.
 *
 * System / library dirs in NEVER_REGISTER are never promoted to workspaces
 * (and any existing registration for them is pruned). Missing top-level
 * registrations under /workspace are also pruned so deleted folders leave
 * the sidebar.
 *
 * Nest injects like dsh-archive: connection first, then workspaceRegistry.
 */
import { watch } from "node:fs";
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

const name = "dsh-workspace-sync";
const ROOT = process.env.DSH_WORKSPACE_ROOT || "/workspace";
const INTERVAL_MS = 15_000;
const WATCH_DEBOUNCE_MS = 750;

function isWorkspaceMountRoot(dir, root = ROOT) {
	return path.resolve(String(dir || "")) === path.resolve(root);
}

/** Top-level basenames that are plugin library roots, not user workspaces. */
const NEVER_REGISTER = new Set(
	String(process.env.DSH_WORKSPACE_SYNC_SKIP || "repos")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean),
);

/**
 * True when a directory has no non-dot entries (empty or only hidden files).
 * Used so removing a workspace from the sidebar isn't undone by re-registering
 * an empty leftover folder on disk.
 * @param {string} dir
 */
async function isEffectivelyEmpty(dir) {
	try {
		const ents = await readdir(dir, { withFileTypes: true });
		return !ents.some((e) => e.name && !e.name.startsWith("."));
	} catch {
		return true;
	}
}

/**
 * @param {string} root
 * @returns {Promise<string[]>} absolute paths of top-level non-dot directories
 */
async function listTopLevelDirs(root) {
	const ents = await readdir(root, { withFileTypes: true });
	const dirs = ents
		.filter((e) => e.isDirectory() && !e.name.startsWith(".") && !NEVER_REGISTER.has(e.name))
		.map((e) => path.join(root, e.name));
	const out = [];
	for (const dir of dirs) {
		if (await isEffectivelyEmpty(dir)) continue;
		out.push(dir);
	}
	return out;
}

function entityId(entity) {
	return entity?.id || entity?.workspaceId || null;
}

/**
 * Drop registrations for NEVER_REGISTER basenames and for missing top-level dirs.
 * @param {any} registry
 * @param {string} root
 */
async function pruneStale(registry, root = ROOT) {
	const rootR = path.resolve(root);
	const entities = typeof registry.entities?.values === "function"
		? [...registry.entities.values()]
		: [];
	let removed = 0;
	for (const entity of entities) {
		const p = path.resolve(String(entity.path || ""));
		const id = entityId(entity);
		if (!id || typeof registry.delete !== "function") continue;

		// The bind mount root (/workspace) is the parent of all workspaces, not a workspace itself.
		if (isWorkspaceMountRoot(p, rootR)) {
			try {
				await registry.delete(id);
				removed += 1;
			} catch (err) {
				console.warn(`[${name}] prune mount root failed for ${p}:`, err instanceof Error ? err.message : err);
			}
			continue;
		}

		if (path.dirname(p) !== rootR) continue;
		const base = path.basename(p);

		if (NEVER_REGISTER.has(base)) {
			try {
				await registry.delete(id);
				removed += 1;
			} catch (err) {
				console.warn(`[${name}] prune skip-list failed for ${p}:`, err instanceof Error ? err.message : err);
			}
			continue;
		}

		try {
			const st = await stat(p);
			if (!st.isDirectory()) {
				await registry.delete(id);
				removed += 1;
			}
		} catch {
			try {
				await registry.delete(id);
				removed += 1;
			} catch (err) {
				console.warn(`[${name}] prune missing failed for ${p}:`, err instanceof Error ? err.message : err);
			}
		}
	}
	return removed;
}

/**
 * @param {any} registry
 * @param {string} root
 */
async function syncOnce(registry, root = ROOT) {
	const pruned = await pruneStale(registry, root);
	let dirs;
	try {
		dirs = await listTopLevelDirs(root);
	} catch (err) {
		console.warn(`[${name}] readdir ${root} failed:`, err instanceof Error ? err.message : err);
		return { ok: false, created: 0, seen: 0, pruned };
	}
	let created = 0;
	for (const dir of dirs) {
		try {
			const before = registry.resolveByPath
				? await registry.resolveByPath(dir).catch(() => null)
				: null;
			await registry.create(dir);
			if (!before) created += 1;
		} catch (err) {
			console.warn(`[${name}] create failed for ${dir}:`, err instanceof Error ? err.message : err);
		}
	}
	return { ok: true, created, seen: dirs.length, pruned };
}

/**
 * @param {any} ctx — fiber with connection + workspaceRegistry injected
 */
function startSync(ctx) {
	const registry = ctx.workspaceRegistry;
	if (!registry || typeof registry.create !== "function") {
		console.warn(`[${name}] workspaceRegistry.create unavailable`);
		return () => {};
	}

	let syncing = false;
	let timer = null;
	let watchTimer = null;
	/** @type {import("node:fs").FSWatcher | null} */
	let watcher = null;

	const run = async (reason = "tick") => {
		if (syncing) return;
		syncing = true;
		try {
			const res = await syncOnce(registry);
			if (res.created > 0 || res.pruned > 0) {
				console.log(
					`[${name}] synced ${res.seen || 0} dirs (+${res.created} new, -${res.pruned} pruned) via ${reason}`,
				);
			}
		} finally {
			syncing = false;
		}
	};

	void run("startup");
	timer = setInterval(() => void run("interval"), INTERVAL_MS);

	try {
		watcher = watch(ROOT, { persistent: false }, (_event, filename) => {
			if (filename && String(filename).startsWith(".")) return;
			if (watchTimer) clearTimeout(watchTimer);
			watchTimer = setTimeout(() => void run("watch"), WATCH_DEBOUNCE_MS);
		});
		watcher.on("error", (err) => {
			console.warn(`[${name}] watch error:`, err instanceof Error ? err.message : err);
		});
	} catch (err) {
		console.warn(`[${name}] watch ${ROOT} failed:`, err instanceof Error ? err.message : err);
	}

	return () => {
		if (timer) clearInterval(timer);
		if (watchTimer) clearTimeout(watchTimer);
		if (watcher) {
			try { watcher.close(); } catch { /* ignore */ }
		}
	};
}

/**
 * @param {any} ctx
 */
function apply(ctx) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.inject(["workspaceRegistry"], (scope) => {
			scope.effect(() => startSync(scope), `${name}: sync`);
		});
	});
}

export { apply, name, syncOnce, listTopLevelDirs, NEVER_REGISTER, isEffectivelyEmpty, isWorkspaceMountRoot };

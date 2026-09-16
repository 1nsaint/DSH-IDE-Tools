/**
 * dsh-agent-review — host half.
 * Snapshots agent write/edit tool results per session so the UI can Undo / Keep / Review.
 */
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";

const name = "dsh-agent-review";
const RPC_CHANNEL = "/agent-review";
const MUTATION_TOOLS = new Set(["write", "edit"]);
const MAX_TEXT_BYTES = 2 * 1024 * 1024;

/** @type {Map<string, SessionReview>} */
const reviews = new Map();

/**
 * @typedef {{
 *   path: string,
 *   absPath: string,
 *   before: string | null,
 *   after: string,
 *   created: boolean,
 *   updatedAt: string,
 *   additions: number,
 *   deletions: number,
 * }} ReviewFile
 *
 * @typedef {{
 *   sessionId: string,
 *   generation: number,
 *   files: Map<string, ReviewFile>,
 * }} SessionReview
 */

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

function storageRoot() {
	const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
	return path.join(home, "storages", "agent-review");
}

function allowedRoots() {
	return [
		path.resolve("/workspace"),
		path.resolve(process.env.CONTAINERS_ROOT || "/containers"),
	];
}

function assertAllowedPath(abs) {
	const resolved = path.resolve(abs);
	const okRoot = allowedRoots().some(
		(root) => resolved === root || resolved.startsWith(root + path.sep),
	);
	if (!okRoot) throw new Error(`path not allowed: ${resolved}`);
	return resolved;
}

function countDiffStats(before, after) {
	const a = String(before ?? "").split("\n");
	const b = String(after ?? "").split("\n");
	// Cheap line-set approximation (good enough for badges)
	let additions = 0;
	let deletions = 0;
	const max = Math.max(a.length, b.length);
	for (let i = 0; i < max; i += 1) {
		const left = a[i];
		const right = b[i];
		if (left === right) continue;
		if (right !== undefined && left === undefined) additions += 1;
		else if (left !== undefined && right === undefined) deletions += 1;
		else {
			additions += 1;
			deletions += 1;
		}
	}
	return { additions, deletions };
}

function byteLen(text) {
	return Buffer.byteLength(String(text ?? ""), "utf8");
}

function truncateForStore(text) {
	if (text == null) return null;
	if (byteLen(text) <= MAX_TEXT_BYTES) return text;
	return `${String(text).slice(0, MAX_TEXT_BYTES)}\n\n/* …truncated for agent-review store… */\n`;
}

function getReview(sessionId) {
	const id = String(sessionId || "").trim();
	if (!id) return null;
	let rev = reviews.get(id);
	if (!rev) {
		rev = { sessionId: id, generation: 0, files: new Map() };
		reviews.set(id, rev);
	}
	return rev;
}

function bump(rev) {
	rev.generation += 1;
}

function listFiles(rev) {
	return [...rev.files.values()]
		.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
		.map((f) => ({
			path: f.path,
			absPath: f.absPath,
			created: f.created,
			updatedAt: f.updatedAt,
			additions: f.additions,
			deletions: f.deletions,
			pending: true,
		}));
}

async function persist(rev) {
	try {
		const root = storageRoot();
		await fs.mkdir(root, { recursive: true });
		const payload = {
			sessionId: rev.sessionId,
			generation: rev.generation,
			files: listFiles(rev).map((f) => {
				const full = rev.files.get(f.path);
				return {
					...f,
					before: full?.before ?? null,
					after: full?.after ?? "",
				};
			}),
		};
		await fs.writeFile(
			path.join(root, `${rev.sessionId.replace(/[^a-zA-Z0-9._-]+/g, "_")}.json`),
			JSON.stringify(payload),
			"utf8",
		);
	} catch {
		/* best-effort */
	}
}

function resolveAbsPath(exec, filePathRaw, displayPath) {
	const filePath = String(filePathRaw || displayPath || "").trim();
	if (!filePath) throw new Error("file path required");
	if (path.isAbsolute(filePath)) return assertAllowedPath(filePath);
	const cwd = exec?.agent?.session?.header?.cwd;
	if (typeof cwd === "string" && cwd.trim()) {
		return assertAllowedPath(path.resolve(cwd, filePath));
	}
	// Fall back to display path if absolute-ish
	if (path.isAbsolute(displayPath || "")) return assertAllowedPath(displayPath);
	throw new Error(`cannot resolve path: ${filePath}`);
}

async function recordMutation(exec, result) {
	if (!result || result.isError) return;
	const toolName = String(exec?.name || "");
	if (!MUTATION_TOOLS.has(toolName)) return;
	const sessionId =
		exec?.agent?.session?.id
		|| exec?.agent?.sessionId
		|| exec?.agent?.session?.header?.id
		|| exec?.sessionId;
	if (!sessionId) return;
	const value = result.value && typeof result.value === "object" ? result.value : null;
	if (!value) return;

	const displayPath = String(value.path || exec.arguments?.file_path || "").trim();
	const fileArg = String(exec.arguments?.file_path || displayPath).trim();
	if (!displayPath && !fileArg) return;

	let absPath;
	try {
		absPath = resolveAbsPath(exec, fileArg, displayPath);
	} catch {
		return;
	}

	const afterRaw = typeof value.after === "string" ? value.after : null;
	if (afterRaw == null) return;
	const beforeRaw = value.before === null || typeof value.before === "string" ? value.before : null;
	const created = value.operation === "create" || beforeRaw === null;

	const rev = getReview(sessionId);
	if (!rev) return;
	const key = displayPath || absPath;
	const existing = rev.files.get(key);
	const before = existing
		? existing.before
		: truncateForStore(beforeRaw);
	const after = truncateForStore(afterRaw);
	const stats = countDiffStats(before, after);

	rev.files.set(key, {
		path: key,
		absPath,
		before,
		after,
		created: existing ? existing.created || created : created,
		updatedAt: new Date().toISOString(),
		additions: stats.additions,
		deletions: stats.deletions,
	});
	bump(rev);
	await persist(rev);
}

async function restoreFile(entry) {
	const abs = assertAllowedPath(entry.absPath);
	if (entry.before === null) {
		await fs.unlink(abs).catch(async (err) => {
			if (err && err.code !== "ENOENT") throw err;
		});
		return { restored: "deleted" };
	}
	await fs.mkdir(path.dirname(abs), { recursive: true });
	await fs.writeFile(abs, entry.before, "utf8");
	return { restored: "written" };
}

function registerRpc(ctx) {
	return registerRpcChannel(
		ctx,
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				const sessionId = String(payload?.sessionId || "").trim();
				if (!sessionId) throw new Error("sessionId required");
				const rev = getReview(sessionId);

				switch (endpoint) {
					case "list": {
						return ok({
							sessionId,
							generation: rev?.generation || 0,
							files: rev ? listFiles(rev) : [],
						});
					}
					case "diff": {
						const filePath = String(payload?.path || "").trim();
						if (!filePath) throw new Error("path required");
						const entry = rev?.files.get(filePath);
						if (!entry) throw new Error("no pending review for that file");
						return ok({
							path: entry.path,
							absPath: entry.absPath,
							before: entry.before,
							after: entry.after,
							created: entry.created,
							additions: entry.additions,
							deletions: entry.deletions,
						});
					}
					case "undo": {
						const filePath = String(payload?.path || "").trim();
						if (!filePath) throw new Error("path required");
						const entry = rev?.files.get(filePath);
						if (!entry) throw new Error("no pending review for that file");
						await restoreFile(entry);
						rev.files.delete(filePath);
						bump(rev);
						await persist(rev);
						return ok({ undone: filePath, files: listFiles(rev), generation: rev.generation });
					}
					case "undoAll": {
						if (!rev || !rev.files.size) {
							return ok({ undone: [], files: [], generation: rev?.generation || 0 });
						}
						const undone = [];
						const errors = [];
						for (const entry of [...rev.files.values()]) {
							try {
								await restoreFile(entry);
								undone.push(entry.path);
								rev.files.delete(entry.path);
							} catch (err) {
								errors.push({ path: entry.path, message: err?.message || String(err) });
							}
						}
						bump(rev);
						await persist(rev);
						return ok({
							undone,
							errors,
							files: listFiles(rev),
							generation: rev.generation,
						});
					}
					case "keep": {
						const filePath = String(payload?.path || "").trim();
						if (!filePath) throw new Error("path required");
						if (!rev?.files.has(filePath)) throw new Error("no pending review for that file");
						rev.files.delete(filePath);
						bump(rev);
						await persist(rev);
						return ok({ kept: filePath, files: listFiles(rev), generation: rev.generation });
					}
					case "keepAll": {
						if (!rev) return ok({ kept: [], files: [], generation: 0 });
						const kept = [...rev.files.keys()];
						rev.files.clear();
						bump(rev);
						await persist(rev);
						return ok({ kept, files: [], generation: rev.generation });
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
	);
}

const inject = ["tools", "connection", "sessions", "webServer"];

function apply(ctx) {
	ctx.inject(["tools", "connection", "sessions", "webServer"], (scope) => {
		scope.effect(() => {
			const offTool = scope.on("tools/execute", async (exec, next) => {
				const result = await next();
				try {
					await recordMutation(exec, result);
				} catch {
					/* never break the agent tool path */
				}
				return result;
			});
			const offRpc = registerRpc(scope);
			return () => {
				try {
					offTool?.();
				} catch {
					/* */
				}
				try {
					offRpc?.();
				} catch {
					/* */
				}
			};
		}, "dsh-agent-review");
	});
}

export { apply, inject, name };

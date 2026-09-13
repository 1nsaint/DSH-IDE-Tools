// dsh-files — standalone filesystem Remote for sidebar + Code tab.
// Gateway: POST /api/files/<method>
// Methods: root | list | search | read | write | remove | rename | stat
//
// Independent of dsh-filelens (UI). Same containment rules:
//   - guard fail-closed when root is supplied
//   - write / remove REQUIRE an explicit root
import path from "node:path";
import { rename, rm } from "node:fs/promises";
import { TypertRemoteService } from "@deepseek-ai/dsh-typert-protocol";

export class FilesService extends TypertRemoteService {
	constructor(ctx) {
		super(ctx, "files");
		this.MAX_PREVIEW = 256 * 1024;
		this.activeSearches = new Map();
		this.fs = ctx.get("fs");
		this.sandboxPolicy = ctx.get("sandboxPolicy");

		const invocations = ["root", "list", "stat", "search", "read", "write", "remove", "rename", "move"].map((method) => ({
			id: "dsh-files#files/" + method,
			service: "files",
			namespace: "files",
			method,
			invocation: { kind: "direct" },
			parameters: [{
				name: "args",
				wire: "args",
				source: "json",
				codec: { mode: "src-json" },
			}],
			result: { mode: "src-json" },
		}));

		const typert = ctx.typert;
		typert.register({
			package: "dsh-files",
			face: "host",
			schemas: [],
			model: { services: [], events: [], objects: [] },
			invocations,
		});
	}

	async guard(root, target) {
		if (!root) return;
		const rootTarget = await this.fs.resolve(root);
		if (!rootTarget || !this.fs.contains(rootTarget, target)) {
			const err = new Error("path is outside the explorer root");
			err.kind = "outside-root";
			throw err;
		}
	}

	kindOf(err) {
		const e = err;
		const code = e && e.code;
		if (code === "FS_TOO_LARGE") return "too-large";
		if (code === "FS_NOT_TEXT") return "binary";
		if (code === "FS_NOT_FOUND") return "missing";
		if (code === "FS_NOT_REGULAR_FILE" || code === "FS_NOT_DIRECTORY") return "not-file";
		if (code === "FS_STALE_VERSION") return "stale";
		if (code === "FS_PERMISSION_DENIED" || code === "FS_SANDBOX_DENIED") return "denied";
		if (code === "FS_ABORTED") return "aborted";
		const hay = ((e && e.kind) || "") + " " + ((e && e.message) || "");
		if (/too[_ -]?large/i.test(hay)) return "too-large";
		if (/binary|not utf|decode|invalid character/i.test(hay)) return "binary";
		if (/not found|no such/i.test(hay)) return "missing";
		return "error";
	}

	fail(err) {
		const e = err;
		return { ok: false, kind: this.kindOf(err), message: (e && e.message) || String(err) };
	}

	sessionCwd() {
		try {
			const agents = this.ctx.get("agents");
			const initiator = agents && typeof agents.currentInitiator === "function"
				? agents.currentInitiator()
				: undefined;
			const c = initiator && initiator.session && initiator.session.header && initiator.session.header.cwd;
			if (typeof c === "string" && c) return c;
		} catch { /* ignore */ }
		try {
			const sessions = this.ctx.get("sessions");
			const all = sessions && typeof sessions.list === "function" ? sessions.list() : [];
			for (const s of all) {
				const c = s && s.header && s.header.cwd;
				if (typeof c === "string" && c) return c;
			}
		} catch { /* ignore */ }
		return null;
	}

	defaultRoot() {
		return this.sessionCwd()
			|| (this.sandboxPolicy && typeof this.sandboxPolicy.workspaceRoot === "string"
				? this.sandboxPolicy.workspaceRoot
				: null);
	}

	toPlain(entries) {
		return entries
			.map((e) => ({
				name: e.name,
				type: e.type,
				size: typeof e.size === "number" ? e.size : null,
				path: e.target.displayPath,
			}))
			.sort((a, b) => {
				const ad = a.type === "directory" ? 0 : 1;
				const bd = b.type === "directory" ? 0 : 1;
				if (ad !== bd) return ad - bd;
				return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
			});
	}

	async readFrom(iter, skip, max) {
		let text = "";
		let consumed = 0;
		let eof = false;
		while (text.length < max) {
			const r = await iter.next();
			if (r.done) {
				eof = true;
				break;
			}
			const len = r.value.length;
			if (skip >= len) {
				skip -= len;
				consumed += len;
				continue;
			}
			text += r.value.slice(skip);
			consumed += len;
			skip = 0;
			if (text.length >= max) {
				text = text.slice(0, max);
				break;
			}
		}
		return { text, consumed, eof };
	}

	async root(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.sessionId === "string" && a.sessionId) {
			try {
				const sessions = this.ctx.get("sessions");
				const session = sessions && typeof sessions.get === "function"
					? sessions.get(a.sessionId)
					: undefined;
				const cwd = session && session.header && session.header.cwd;
				if (typeof cwd === "string" && cwd) return { root: cwd };
			} catch { /* ignore */ }
		}
		return { root: this.defaultRoot() };
	}

	async list(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path) {
			return { ok: false, kind: "error", message: "missing path" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const entries = await this.fs.listDir(target);
			return { ok: true, path: a.path, entries: this.toPlain(entries) };
		} catch (err) {
			return this.fail(err);
		}
	}

	async stat(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path) {
			return { ok: false, kind: "error", message: "missing path" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const info = await this.fs.stat(target);
			if (!info) return { ok: false, kind: "missing", message: "file not found" };
			return {
				ok: true,
				path: a.path,
				type: info.type,
				size: typeof info.size === "number" ? info.size : null,
				version: info.version,
			};
		} catch (err) {
			return this.fail(err);
		}
	}

	async search(args) {
		const a = args && typeof args === "object" ? args : {};
		const root = typeof a.root === "string" && a.root ? a.root : null;
		const query = typeof a.query === "string" ? a.query.trim().toLowerCase() : "";
		if (!root || !query) return { ok: false, kind: "error", message: "missing root/query" };
		const family = typeof a.family === "string" && a.family ? a.family : "search:" + root;
		const prev = this.activeSearches.get(family);
		if (prev) prev.abort();
		const ctrl = new AbortController();
		this.activeSearches.set(family, ctrl);
		const signal = ctrl.signal;
		const maxDepth = 8;
		const dirCap = 3000;
		const resultCap = 300;
		const results = [];
		const seen = new Set();
		let dirsScanned = 0;
		let aborted = false;

		const walk = async (dirPath, depth) => {
			if (aborted || depth > maxDepth || dirsScanned > dirCap || results.length >= resultCap) return;
			let target;
			try {
				target = await this.fs.resolve(dirPath, { signal });
				if (seen.has(target.targetKey)) return;
				seen.add(target.targetKey);
			} catch {
				if (signal.aborted) aborted = true;
				return;
			}
			let entries;
			try {
				entries = await this.fs.listDir(target, signal);
			} catch {
				if (signal.aborted) aborted = true;
				return;
			}
			dirsScanned++;
			for (const e of entries) {
				if (aborted || results.length >= resultCap) return;
				const name = e.name;
				if (name.startsWith(".")) continue;
				if (name === "node_modules" || name === ".git" || name === ".dsh") continue;
				if (e.type === "directory") {
					await walk(e.target.displayPath, depth + 1);
				} else if (e.type === "file" && name.toLowerCase().includes(query)) {
					results.push({ path: e.target.displayPath, name });
				}
			}
		};

		try {
			await walk(root, 0);
			if (signal.aborted || aborted) return { ok: false, kind: "aborted", message: "aborted" };
			return { ok: true, results, truncated: results.length >= resultCap || dirsScanned > dirCap };
		} catch (err) {
			if (signal.aborted) return { ok: false, kind: "aborted", message: "aborted" };
			return this.fail(err);
		} finally {
			if (this.activeSearches.get(family) === ctrl) this.activeSearches.delete(family);
		}
	}

	async read(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path) {
			return { ok: false, kind: "error", message: "missing path" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const info = await this.fs.stat(target);
			if (!info) return { ok: false, kind: "missing", message: "file not found" };
			if (info.type !== "file") return { ok: false, kind: "not-file", message: "not a regular file" };
			const size = typeof info.size === "number" ? info.size : null;
			if (size === null || size > this.MAX_PREVIEW) {
				const stream = await this.fs.streamText(target);
				const { text, eof } = await this.readFrom(stream[Symbol.asyncIterator](), 0, this.MAX_PREVIEW);
				return { ok: true, text, truncated: !eof, size, version: info.version };
			}
			const text = await this.fs.readText(target);
			return { ok: true, text, truncated: false, size, version: info.version };
		} catch (err) {
			return this.fail(err);
		}
	}

	async write(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path || typeof a.text !== "string") {
			return { ok: false, kind: "error", message: "missing path/text" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		if (!root) return { ok: false, kind: "error", message: "write requires an explicit root" };
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const expected = typeof a.expectedVersion === "string" && a.expectedVersion
				? { kind: "replaceIfVersion", version: a.expectedVersion }
				: undefined;
			const outcome = await this.fs.writeText(target, a.text, expected);
			return { ok: true, version: outcome.version };
		} catch (err) {
			return this.fail(err);
		}
	}

	async remove(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path) {
			return { ok: false, kind: "error", message: "missing path" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		if (!root) return { ok: false, kind: "error", message: "remove requires an explicit root" };
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const rootTarget = await this.fs.resolve(root);
			if (rootTarget && rootTarget.targetKey === target.targetKey) {
				return { ok: false, kind: "error", message: "cannot delete the workspace root" };
			}
			const info = await this.fs.stat(target);
			if (!info) return { ok: false, kind: "missing", message: "path not found" };
			const abs = this.fs.processPath(target);
			await rm(abs, { recursive: info.type === "directory", force: false });
			return { ok: true, path: a.path, type: info.type };
		} catch (err) {
			return this.fail(err);
		}
	}

	async rename(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path || typeof a.newName !== "string" || !a.newName.trim()) {
			return { ok: false, kind: "error", message: "missing path/newName" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		if (!root) return { ok: false, kind: "error", message: "rename requires an explicit root" };
		const newName = a.newName.trim();
		if (newName.includes("/") || newName.includes("\\") || newName === "." || newName === "..") {
			return { ok: false, kind: "error", message: "invalid name" };
		}
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const rootTarget = await this.fs.resolve(root);
			if (rootTarget && rootTarget.targetKey === target.targetKey) {
				return { ok: false, kind: "error", message: "cannot rename the workspace root" };
			}
			const abs = this.fs.processPath(target);
			const destAbs = path.join(path.dirname(abs), newName);
			const destRel = path.join(path.dirname(a.path), newName).replace(/\\/g, "/");
			try {
				const destTarget = await this.fs.resolve(destRel);
				const existing = await this.fs.stat(destTarget);
				if (existing) return { ok: false, kind: "error", message: "name already exists" };
			} catch {
				/* dest missing — ok */
			}
			await rename(abs, destAbs);
			return { ok: true, path: destRel, oldPath: a.path };
		} catch (err) {
			return this.fail(err);
		}
	}

	/** Move (drag & drop) a file/directory into a different parent directory, optionally
	 * across a different workspace root. `root`/`destRoot` are independent containment
	 * guards (source and destination may be different workspaces). */
	async move(args) {
		const a = args && typeof args === "object" ? args : {};
		if (typeof a.path !== "string" || !a.path || typeof a.destDir !== "string" || !a.destDir) {
			return { ok: false, kind: "error", message: "missing path/destDir" };
		}
		const root = typeof a.root === "string" && a.root ? a.root : null;
		const destRoot = typeof a.destRoot === "string" && a.destRoot ? a.destRoot : root;
		if (!root || !destRoot) {
			return { ok: false, kind: "error", message: "move requires an explicit root/destRoot" };
		}
		try {
			const target = await this.fs.resolve(a.path);
			await this.guard(root, target);
			const rootTarget = await this.fs.resolve(root);
			if (rootTarget && rootTarget.targetKey === target.targetKey) {
				return { ok: false, kind: "error", message: "cannot move the workspace root" };
			}
			const destDirTarget = await this.fs.resolve(a.destDir);
			await this.guard(destRoot, destDirTarget);
			const destDirInfo = await this.fs.stat(destDirTarget);
			if (!destDirInfo || destDirInfo.type !== "directory") {
				return { ok: false, kind: "error", message: "destination is not a directory" };
			}

			const srcAbs = this.fs.processPath(target);
			const destDirAbs = this.fs.processPath(destDirTarget);
			const baseName = typeof a.newName === "string" && a.newName.trim()
				? a.newName.trim()
				: path.basename(srcAbs);
			if (baseName.includes("/") || baseName.includes("\\") || baseName === "." || baseName === "..") {
				return { ok: false, kind: "error", message: "invalid name" };
			}
			const destAbs = path.join(destDirAbs, baseName);
			if (path.dirname(srcAbs) === destDirAbs && baseName === path.basename(srcAbs)) {
				return { ok: false, kind: "error", message: "already in that folder" };
			}

			const srcInfo = await this.fs.stat(target);
			if (srcInfo && srcInfo.type === "directory") {
				const rel = path.relative(srcAbs, destAbs);
				if (rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel))) {
					return { ok: false, kind: "error", message: "cannot move a folder into itself" };
				}
			}

			const destRel = path.posix.join(String(a.destDir).replace(/\/+$/, "") || "/", baseName);
			try {
				const destDisplayTarget = await this.fs.resolve(destRel);
				const existing = await this.fs.stat(destDisplayTarget);
				if (existing) return { ok: false, kind: "error", message: "an item with that name already exists there" };
			} catch { /* dest missing — ok */ }

			await rename(srcAbs, destAbs);
			return { ok: true, path: destRel, oldPath: a.path };
		} catch (err) {
			return this.fail(err);
		}
	}
}

FilesService.inject = ["fs", "typert"];
export default FilesService;

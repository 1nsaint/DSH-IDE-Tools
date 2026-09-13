/**
 * dsh-git — host half: git library under /workspace/Git Repos (portable) + session
 * workspace repos; optional HTTPS PAT / SSH identity for private remotes.
 */
import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const name = "dsh-git";
const RPC_CHANNEL = "/git";
const execFileAsync = promisify(execFile);

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

function authConfigPath() {
	const home = process.env.DSH_HOME || path.join(os.homedir(), ".dsh");
	return path.join(home, "plugins-data", "dsh-git.json");
}

/** Portable default: clones live under the Harness workspace, not ~/Containers. */
function reposRoot() {
	return path.resolve(process.env.DSH_GIT_REPOS_ROOT || "/workspace/Git Repos");
}

function containersRoot() {
	return path.resolve(process.env.CONTAINERS_ROOT || "/containers");
}

function testEnvRoot() {
	return path.join(containersRoot(), ".test-environments");
}

function allowedRoots() {
	const roots = [path.resolve("/workspace"), reposRoot(), testEnvRoot(), containersRoot()];
	return [...new Set(roots.map((r) => path.resolve(r)))];
}

function assertAllowedPath(abs) {
	const resolved = path.resolve(abs);
	const okRoot = allowedRoots().some(
		(root) => resolved === root || resolved.startsWith(root + path.sep),
	);
	if (!okRoot) {
		throw new Error(`path must be under /workspace (or ${reposRoot()})`);
	}
	return resolved;
}

async function loadAuthConfig() {
	try {
		const raw = JSON.parse(await fs.readFile(authConfigPath(), "utf8"));
		return {
			httpsToken: typeof raw.httpsToken === "string" ? raw.httpsToken.trim() : "",
			sshIdentityFile: typeof raw.sshIdentityFile === "string" ? raw.sshIdentityFile.trim() : "",
			reposRoot: typeof raw.reposRoot === "string" && raw.reposRoot.trim()
				? raw.reposRoot.trim()
				: "",
			githubClientId: typeof raw.githubClientId === "string" ? raw.githubClientId.trim() : "",
			githubLogin: typeof raw.githubLogin === "string" ? raw.githubLogin.trim() : "",
			authSource: typeof raw.authSource === "string" ? raw.authSource : "",
			userName: typeof raw.userName === "string" ? raw.userName.trim() : "",
			userEmail: typeof raw.userEmail === "string" ? raw.userEmail.trim() : "",
			sessionRepos: raw.sessionRepos && typeof raw.sessionRepos === "object" ? raw.sessionRepos : {},
		};
	} catch {
		return {
			httpsToken: "",
			sshIdentityFile: "",
			reposRoot: "",
			githubClientId: "",
			githubLogin: "",
			authSource: "",
			userName: "",
			userEmail: "",
			sessionRepos: {},
		};
	}
}

async function saveAuthConfig(cfg) {
	const p = authConfigPath();
	await fs.mkdir(path.dirname(p), { recursive: true });
	await fs.writeFile(
		p,
		`${JSON.stringify(
			{
				httpsToken: cfg.httpsToken || "",
				sshIdentityFile: cfg.sshIdentityFile || "",
				reposRoot: cfg.reposRoot || "",
				githubClientId: cfg.githubClientId || "",
				githubLogin: cfg.githubLogin || "",
				authSource: cfg.authSource || "",
				userName: cfg.userName || "",
				userEmail: cfg.userEmail || "",
				sessionRepos: cfg.sessionRepos || {},
			},
			null,
			2,
		)}\n`,
		{ mode: 0o600 },
	);
}

const DEFAULT_COMMIT_NAME = process.env.DSH_GIT_USER_NAME || "Harness";
const DEFAULT_COMMIT_EMAIL = process.env.DSH_GIT_USER_EMAIL || "harness@local";

/** Name/email for commits: Settings → GitHub login → Harness defaults. */
function resolveCommitIdentity(cfg) {
	const login = String(cfg?.githubLogin || "").trim();
	const settingsName = String(cfg?.userName || "").trim();
	const settingsEmail = String(cfg?.userEmail || "").trim();
	const githubEmail = login ? `${login}@users.noreply.github.com` : "";

	const name = settingsName || login || DEFAULT_COMMIT_NAME;
	const email = settingsEmail || githubEmail || DEFAULT_COMMIT_EMAIL;

	let source = "default";
	if (settingsName || settingsEmail) source = "settings";
	else if (login) source = "github";

	return {
		name,
		email,
		source,
		needsAuthorSetup: source === "default",
		fromGithub: source === "github",
	};
}

function effectiveReposRoot(cfg) {
	if (cfg?.reposRoot) return path.resolve(cfg.reposRoot);
	return reposRoot();
}

function shellSingleQuote(s) {
	return `'${String(s).replace(/'/g, `'\\''`)}'`;
}

async function buildGitEnv() {
	const cfg = await loadAuthConfig();
	const env = { ...process.env, GIT_TERMINAL_PROMPT: "0" };
	const identity = cfg.sshIdentityFile;
	if (identity) {
		env.GIT_SSH_COMMAND = `ssh -i ${shellSingleQuote(identity)} -o IdentitiesOnly=yes -o BatchMode=yes`;
	} else {
		env.GIT_SSH_COMMAND = "ssh -o BatchMode=yes";
	}
	return { env, cfg };
}

function githubBasicAuthHeader(httpsToken) {
	return `Authorization: Basic ${Buffer.from(`x-access-token:${httpsToken}`).toString("base64")}`;
}

function withHttpsAuthArgs(args, httpsToken) {
	if (!httpsToken) return args;
	// Bearer works for api.github.com; git clone/fetch/push needs Basic x-access-token.
	return [
		"-c", "credential.helper=",
		"-c", `http.https://github.com/.extraHeader=${githubBasicAuthHeader(httpsToken)}`,
		...args,
	];
}

function sessionCwd(ctx, sessionId) {
	if (typeof sessionId !== "string" || !sessionId.trim()) {
		throw new Error("sessionId required");
	}
	const sessions = ctx.get?.("sessions");
	const session = sessions?.get?.(sessionId.trim());
	const cwd = session?.header?.cwd;
	if (typeof cwd !== "string" || !cwd) {
		throw new Error("session has no workspace cwd");
	}
	return cwd;
}

function resolveUnderCwd(cwd, rel = ".") {
	const root = path.resolve(cwd);
	const abs = path.resolve(root, typeof rel === "string" && rel.trim() ? rel.trim() : ".");
	if (abs !== root && !abs.startsWith(root + path.sep)) {
		throw new Error("path escapes workspace");
	}
	return abs;
}

function toRel(cwd, abs) {
	const root = path.resolve(cwd);
	const resolved = path.resolve(abs);
	if (resolved === root) return ".";
	return path.relative(root, resolved) || ".";
}

async function resolveRepoAbs(ctx, payload) {
	if (typeof payload?.repoPath === "string" && payload.repoPath.trim()) {
		return assertAllowedPath(payload.repoPath.trim());
	}
	let cwd = null;
	try {
		cwd = sessionCwd(ctx, payload?.sessionId);
	} catch {
		cwd = resolveFallbackCwd(payload?.workspaceCwd) || null;
	}
	const repoRel = typeof payload?.repoRel === "string" ? payload.repoRel : ".";
	if (cwd) {
		return resolveUnderCwd(cwd, repoRel);
	}
	return path.resolve("/workspace");
}

async function git(cwd, args, { allowFail = false } = {}) {
	const { env, cfg } = await buildGitEnv();
	const fullArgs = withHttpsAuthArgs(args, cfg.httpsToken);
	try {
		const { stdout, stderr } = await execFileAsync("git", fullArgs, {
			cwd,
			maxBuffer: 8 * 1024 * 1024,
			env,
		});
		return { code: 0, stdout: stdout || "", stderr: stderr || "" };
	} catch (err) {
		if (allowFail && err && (typeof err.code === "number" || err.code === 128)) {
			return {
				code: typeof err.code === "number" ? err.code : 1,
				stdout: err.stdout || "",
				stderr: err.stderr || err.message || String(err),
			};
		}
		const msg = err?.stderr || err?.message || String(err);
		throw new Error(String(msg).trim() || "git failed");
	}
}

function isConflictXy(xy) {
	const a = xy[0];
	const b = xy[1];
	if (a === "U" || b === "U") return true;
	if (a === "A" && b === "A") return true;
	if (a === "D" && b === "D") return true;
	return false;
}

function parseStatusPorcelain(stdout) {
	const files = [];
	for (const line of stdout.split("\n")) {
		if (!line || line.length < 4) continue;
		const xy = line.slice(0, 2);
		let filePath = line.slice(3);
		if (filePath.startsWith("\"")) {
			try {
				filePath = JSON.parse(filePath);
			} catch {
				/* keep raw */
			}
		}
		if (filePath.includes(" -> ")) {
			filePath = filePath.split(" -> ").pop();
		}
		const conflict = isConflictXy(xy);
		files.push({
			path: filePath,
			index: xy[0],
			worktree: xy[1],
			staged: !conflict && xy[0] !== " " && xy[0] !== "?",
			unstaged: xy[1] !== " " || conflict,
			conflict,
		});
	}
	return files;
}

function assertBranchName(nameRaw) {
	const name = String(nameRaw || "").trim();
	if (!name) throw new Error("branch name required");
	if (name === "HEAD" || name.startsWith("-")) throw new Error("invalid branch name");
	if (!/^[A-Za-z0-9._/-]+$/.test(name) || name.includes("..") || name.endsWith(".lock") || name.includes("@{")) {
		throw new Error("invalid branch name");
	}
	return name;
}

async function gitPathExists(repoAbs, rel) {
	try {
		await fs.access(path.join(repoAbs, ".git", rel));
		return true;
	} catch {
		return false;
	}
}

async function detectOpState(repoAbs) {
	const mergeInProgress = await gitPathExists(repoAbs, "MERGE_HEAD");
	const rebaseInProgress =
		(await gitPathExists(repoAbs, "rebase-merge")) || (await gitPathExists(repoAbs, "rebase-apply"));
	const cherryPickInProgress = await gitPathExists(repoAbs, "CHERRY_PICK_HEAD");
	return { mergeInProgress, rebaseInProgress, cherryPickInProgress };
}

async function listStashes(repoAbs) {
	const res = await git(repoAbs, ["stash", "list", "--pretty=format:%gd%x1f%s%x1f%cr"], { allowFail: true });
	if (res.code !== 0 || !res.stdout.trim()) return [];
	const out = [];
	for (const line of res.stdout.split("\n")) {
		if (!line.trim()) continue;
		const [ref, subject, when] = line.split("\x1f");
		out.push({ ref: ref || "", subject: subject || "", when: when || "" });
	}
	return out;
}

async function listBranches(repoAbs) {
	const currentRes = await git(repoAbs, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true });
	const current = currentRes.code === 0 ? currentRes.stdout.trim() : null;
	// Use a real unit-separator char in the format string (not "%x1f") — some git
	// builds print "%x1f" literally in for-each-ref formats.
	const sep = "\x1f";
	const localRes = await git(
		repoAbs,
		[
			"for-each-ref",
			`--format=%(refname:short)${sep}%(upstream:short)${sep}%(objectname:short)${sep}%(HEAD)`,
			"refs/heads",
		],
		{ allowFail: true },
	);
	const locals = [];
	if (localRes.code === 0 && localRes.stdout.trim()) {
		for (const line of localRes.stdout.split("\n")) {
			if (!line.trim()) continue;
			const [name, upstream, shortHash, headMark] = line.split(sep);
			if (!name) continue;
			locals.push({
				name,
				upstream: upstream || "",
				shortHash: shortHash || "",
				current: headMark === "*" || name === current,
			});
		}
	}
	const remoteRes = await git(
		repoAbs,
		["for-each-ref", `--format=%(refname:short)${sep}%(objectname:short)`, "refs/remotes"],
		{ allowFail: true },
	);
	const remotes = [];
	if (remoteRes.code === 0 && remoteRes.stdout.trim()) {
		for (const line of remoteRes.stdout.split("\n")) {
			if (!line.trim()) continue;
			const [name, shortHash] = line.split(sep);
			if (!name || name === "origin/HEAD" || name.endsWith("/HEAD")) continue;
			remotes.push({ name, shortHash: shortHash || "" });
		}
	}
	return { current, locals, remotes };
}

function parseDiffHunks(diffText) {
	const lines = String(diffText || "").split("\n");
	const hunks = [];
	let i = 0;
	while (i < lines.length && !lines[i].startsWith("@@")) i += 1;
	while (i < lines.length) {
		const header = lines[i];
		if (!header.startsWith("@@")) {
			i += 1;
			continue;
		}
		const m = /^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/.exec(header);
		const hunkLines = [header];
		i += 1;
		while (i < lines.length && !lines[i].startsWith("@@") && !lines[i].startsWith("diff ")) {
			hunkLines.push(lines[i]);
			i += 1;
		}
		// split("\n") leaves a trailing "" — that becomes a bogus empty context line and breaks git apply
		while (hunkLines.length > 1 && hunkLines[hunkLines.length - 1] === "") {
			hunkLines.pop();
		}
		hunks.push({
			header,
			oldStart: m ? Number(m[1]) : 0,
			oldCount: m ? Number(m[2] ?? 1) : 0,
			newStart: m ? Number(m[3]) : 0,
			newCount: m ? Number(m[4] ?? 1) : 0,
			lines: hunkLines,
		});
	}
	return hunks;
}

function buildFilePatch(filePath, hunkLines) {
	const p = String(filePath || "").replace(/\\/g, "/");
	const body = Array.isArray(hunkLines) ? hunkLines.filter((l, idx, arr) => !(l === "" && idx === arr.length - 1)) : [];
	return [`diff --git a/${p} b/${p}`, `--- a/${p}`, `+++ b/${p}`, ...body].join("\n") + "\n";
}

async function applyCachedPatch(repoAbs, patchText, { reverse = false } = {}) {
	const patch = String(patchText || "");
	if (!patch.trim()) throw new Error("empty patch");
	const tmp = path.join(os.tmpdir(), `dsh-git-patch-${process.pid}-${Date.now()}.patch`);
	await fs.writeFile(tmp, patch.endsWith("\n") ? patch : `${patch}\n`, "utf8");
	try {
		const args = ["apply", "--cached", "--unidiff-zero", "--whitespace=nowarn"];
		if (reverse) args.push("--reverse");
		args.push("--", tmp);
		let res = await git(repoAbs, args, { allowFail: true });
		if (res.code !== 0) {
			// older git without --unidiff-zero / recount fallback
			const args2 = ["apply", "--cached", "--recount", "--whitespace=nowarn"];
			if (reverse) args2.push("--reverse");
			args2.push("--", tmp);
			res = await git(repoAbs, args2, { allowFail: true });
		}
		if (res.code !== 0) {
			throw new Error(res.stderr || res.stdout || "git apply --cached failed");
		}
		return { applied: true };
	} finally {
		await fs.unlink(tmp).catch(() => {});
	}
}

async function githubListPullRequests(token, fullName, { state = "open", page = 1, perPage = 30 } = {}) {
	const { owner, repo } = splitGithubFullName(fullName);
	const url = new URL(`https://api.github.com/repos/${owner}/${repo}/pulls`);
	url.searchParams.set("state", state === "all" ? "all" : state === "closed" ? "closed" : "open");
	url.searchParams.set("per_page", String(Math.min(Math.max(perPage, 1), 50)));
	url.searchParams.set("page", String(Math.max(page, 1)));
	const rows = await githubApiJson(token, url);
	if (!Array.isArray(rows)) return { pullRequests: [], page, hasMore: false, fullName: `${owner}/${repo}` };
	return {
		page,
		hasMore: rows.length >= perPage,
		fullName: `${owner}/${repo}`,
		pullRequests: rows.map((pr) => ({
			number: pr.number,
			title: pr.title || "",
			state: pr.state || "",
			draft: Boolean(pr.draft),
			htmlUrl: pr.html_url || "",
			headRef: pr.head?.ref || "",
			headSha: pr.head?.sha || "",
			baseRef: pr.base?.ref || "",
			author: pr.user?.login || "",
			updatedAt: pr.updated_at || "",
			mergeable: pr.mergeable ?? null,
		})),
	};
}

async function githubCreatePullRequest(token, fullName, payload = {}) {
	const { owner, repo } = splitGithubFullName(fullName);
	const title = String(payload.title || "").trim();
	const head = String(payload.head || "").trim();
	const base = String(payload.base || "").trim() || "main";
	if (!title) throw new Error("PR title required");
	if (!head) throw new Error("head branch required");
	const body = {
		title,
		head,
		base,
		body: typeof payload.body === "string" ? payload.body : "",
		draft: payload.draft === true,
	};
	const created = await githubApiJson(token, `https://api.github.com/repos/${owner}/${repo}/pulls`, {
		method: "POST",
		body,
	});
	return {
		number: created.number,
		title: created.title || title,
		htmlUrl: created.html_url || "",
		state: created.state || "open",
		draft: Boolean(created.draft),
		headRef: created.head?.ref || head,
		baseRef: created.base?.ref || base,
	};
}

async function githubCompare(token, fullName, base, head) {
	const { owner, repo } = splitGithubFullName(fullName);
	const b = String(base || "").trim();
	const h = String(head || "").trim();
	if (!b || !h) throw new Error("base and head required");
	const data = await githubApiJson(
		token,
		`https://api.github.com/repos/${owner}/${repo}/compare/${encodeURIComponent(b)}...${encodeURIComponent(h)}`,
	);
	return {
		status: data.status || "",
		aheadBy: data.ahead_by || 0,
		behindBy: data.behind_by || 0,
		totalCommits: data.total_commits || 0,
		files: (data.files || []).slice(0, 100).map((f) => ({
			path: f.filename || "",
			status: f.status || "",
			additions: f.additions || 0,
			deletions: f.deletions || 0,
		})),
		commits: (data.commits || []).slice(0, 40).map((c) => ({
			hash: c.sha || "",
			shortHash: (c.sha || "").slice(0, 7),
			subject: (c.commit?.message || "").split("\n")[0] || "",
			authorName: c.commit?.author?.name || c.author?.login || "",
		})),
		htmlUrl: data.html_url || "",
		mergeable: data.mergeable_state || data.status || "",
	};
}

function originFullNameFromRemote(remoteUrl) {
	const raw = String(remoteUrl || "").trim();
	if (!raw) return "";
	let m = /github\.com[:/]([^/]+)\/([^/.]+?)(?:\.git)?$/i.exec(raw);
	if (m) return `${m[1]}/${m[2]}`;
	return "";
}

async function isGitRepo(dir) {
	try {
		const st = await fs.stat(path.join(dir, ".git"));
		return st.isDirectory() || st.isFile();
	} catch {
		return false;
	}
}

async function isEmptyDir(dir) {
	try {
		const ents = await fs.readdir(dir);
		return ents.length === 0;
	} catch (err) {
		if (err && err.code === "ENOENT") return true;
		throw err;
	}
}

function repoNameFromUrl(url) {
	const cleaned = String(url).replace(/\.git$/i, "");
	const part = cleaned.split("/").filter(Boolean).pop() || "repo";
	return part.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-|-$/g, "") || "repo";
}

async function getSubmodules(repoDir) {
	try {
		await fs.access(path.join(repoDir, ".gitmodules"));
	} catch {
		return [];
	}
	const res = await git(repoDir, ["submodule", "status"], { allowFail: true });
	if (res.code !== 0 || !res.stdout) return [];

	const lines = res.stdout.trim().split("\n");
	const submodules = [];
	for (const line of lines) {
		if (!line.trim()) continue;
		const statusChar = line[0];
		const rest = line.slice(1).trim();
		const parts = rest.split(/\s+/);
		const commit = parts[0] || "";
		const subRelPath = parts[1] || "";
		const describe = parts.slice(2).join(" ");
		const subAbsPath = path.resolve(repoDir, subRelPath);

		let status = "ok";
		if (statusChar === "-") status = "uninitialized";
		else if (statusChar === "+") status = "modified";
		else if (statusChar === "U") status = "conflict";

		let hasCompose = false;
		for (const n of ["docker-compose.yml", "compose.yml", "docker-compose.yaml", "compose.yaml"]) {
			try {
				await fs.access(path.join(subAbsPath, n));
				hasCompose = true;
				break;
			} catch {
				/* ignore */
			}
		}

		let subBranch = "";
		let subRemote = "";
		if (status !== "uninitialized") {
			try {
				const rem = await git(subAbsPath, ["remote", "get-url", "origin"], { allowFail: true });
				if (rem.code === 0) subRemote = rem.stdout.trim();
				const br = await git(subAbsPath, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true });
				if (br.code === 0) subBranch = br.stdout.trim();
			} catch {
				/* ignore */
			}
		}

		submodules.push({
			name: path.basename(subRelPath),
			relPath: subRelPath,
			path: subAbsPath,
			commit: commit.slice(0, 8),
			status,
			describe,
			branch: subBranch,
			remote: subRemote,
			hasCompose,
		});
	}
	return submodules;
}

async function collectStatus(cwd, repoAbs) {
	const rel = cwd ? toRel(cwd, repoAbs) : path.basename(repoAbs);
	if (!(await isGitRepo(repoAbs))) {
		return {
			cwd: cwd || repoAbs,
			repoRel: rel,
			repoRoot: repoAbs,
			repoPath: repoAbs,
			isRepo: false,
			branch: null,
			detached: false,
			remote: null,
			fullName: "",
			files: [],
			conflictFiles: [],
			ahead: 0,
			behind: 0,
			hasUpstream: false,
			recent: [],
			hasCompose: false,
			submodules: [],
			stashes: [],
			mergeInProgress: false,
			rebaseInProgress: false,
			cherryPickInProgress: false,
			canUndo: false,
			canAmend: false,
			defaultBranch: "main",
		};
	}

	const porcelain = await git(repoAbs, ["status", "--porcelain=v1", "-uall"], { allowFail: true });
	const files = parseStatusPorcelain(porcelain.stdout || "");
	const conflictFiles = files.filter((f) => f.conflict).map((f) => f.path);

	let branch = null;
	let detached = false;
	const br = await git(repoAbs, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true });
	if (br.code === 0) {
		branch = br.stdout.trim() || null;
		if (branch === "HEAD") {
			detached = true;
			const short = await git(repoAbs, ["rev-parse", "--short", "HEAD"], { allowFail: true });
			branch = short.code === 0 ? short.stdout.trim() : "HEAD";
		}
	}

	let ahead = 0;
	let behind = 0;
	let hasUpstream = false;
	const ab = await git(repoAbs, ["rev-list", "--left-right", "--count", "@{upstream}...HEAD"], {
		allowFail: true,
	});
	if (ab.code === 0) {
		hasUpstream = true;
		const parts = ab.stdout.trim().split(/\s+/);
		behind = Number(parts[0]) || 0;
		ahead = Number(parts[1]) || 0;
	}
	let remote = null;
	const rem = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
	if (rem.code === 0) remote = rem.stdout.trim() || null;
	const fullName = originFullNameFromRemote(remote);

	const log = await git(repoAbs, ["log", "-5", "--pretty=format:%h%x09%s%x09%cr"], { allowFail: true });
	const recent = [];
	if (log.code === 0 && log.stdout.trim()) {
		for (const line of log.stdout.split("\n")) {
			const [hash, subject, when] = line.split("\t");
			if (hash) recent.push({ hash, subject: subject || "", when: when || "" });
		}
	}

	let hasCompose = false;
	for (const n of ["docker-compose.yml", "compose.yml", "docker-compose.yaml", "compose.yaml"]) {
		try {
			await fs.access(path.join(repoAbs, n));
			hasCompose = true;
			break;
		} catch {
			/* */
		}
	}

	const submodules = await getSubmodules(repoAbs);
	const op = await detectOpState(repoAbs);
	const stashes = await listStashes(repoAbs);

	const headExists = await git(repoAbs, ["rev-parse", "--verify", "HEAD"], { allowFail: true });
	const hasHead = headExists.code === 0;
	const unpushed = hasHead && (!hasUpstream || ahead > 0) && !detached;
	const canUndo = unpushed && !op.mergeInProgress && !op.rebaseInProgress && !op.cherryPickInProgress;
	const canAmend = canUndo;

	let defaultBranch = "main";
	const sym = await git(repoAbs, ["symbolic-ref", "refs/remotes/origin/HEAD"], { allowFail: true });
	if (sym.code === 0 && sym.stdout.includes("/")) {
		defaultBranch = sym.stdout.trim().split("/").pop() || "main";
	}

	return {
		cwd: cwd || repoAbs,
		repoRel: rel,
		repoRoot: repoAbs,
		repoPath: repoAbs,
		isRepo: true,
		branch,
		detached,
		remote,
		fullName,
		files,
		conflictFiles,
		ahead,
		behind,
		hasUpstream,
		recent,
		hasCompose,
		submodules,
		stashes,
		mergeInProgress: op.mergeInProgress,
		rebaseInProgress: op.rebaseInProgress,
		cherryPickInProgress: op.cherryPickInProgress,
		canUndo,
		canAmend,
		defaultBranch,
	};
}

async function listCommits(repoAbs, { limit = 80 } = {}) {
	const n = Math.min(Math.max(Number(limit) || 80, 1), 200);
	const res = await git(
		repoAbs,
		["log", `-${n}`, "--pretty=format:%H%x1f%h%x1f%s%x1f%an%x1f%ae%x1f%aI%x1e"],
		{ allowFail: true },
	);
	if (res.code !== 0) {
		throw new Error(res.stderr || res.stdout || "git log failed");
	}
	const commits = [];
	for (const chunk of res.stdout.split("\x1e")) {
		const line = chunk.trim();
		if (!line) continue;
		const [hash, shortHash, subject, authorName, authorEmail, authoredAt] = line.split("\x1f");
		if (!hash) continue;
		commits.push({
			hash,
			shortHash: shortHash || hash.slice(0, 7),
			subject: subject || "",
			authorName: authorName || "",
			authorEmail: authorEmail || "",
			authoredAt: authoredAt || "",
		});
	}
	return { commits };
}

async function showCommit(repoAbs, hashRaw) {
	const hash = String(hashRaw || "").trim();
	if (!hash) throw new Error("commit hash required");
	const metaRes = await git(
		repoAbs,
		["show", "-s", "--format=%H%x1f%h%x1f%s%x1f%b%x1f%an%x1f%ae%x1f%aI", hash],
		{ allowFail: true },
	);
	if (metaRes.code !== 0) {
		throw new Error(metaRes.stderr || metaRes.stdout || "commit not found");
	}
	const [fullHash, shortHash, subject, body, authorName, authorEmail, authoredAt] =
		metaRes.stdout.replace(/\n$/, "").split("\x1f");

	const statusRes = await git(repoAbs, ["show", "--name-status", "--format=", hash], { allowFail: true });
	const numRes = await git(repoAbs, ["show", "--numstat", "--format=", hash], { allowFail: true });
	const numMap = new Map();
	let additions = 0;
	let deletions = 0;
	if (numRes.code === 0) {
		for (const line of numRes.stdout.split("\n")) {
			if (!line.trim()) continue;
			const [a, d, ...pathParts] = line.split("\t");
			const filePath = pathParts.join("\t");
			if (!filePath) continue;
			const addN = a === "-" ? 0 : Number(a) || 0;
			const delN = d === "-" ? 0 : Number(d) || 0;
			additions += addN;
			deletions += delN;
			numMap.set(filePath, { additions: addN, deletions: delN, binary: a === "-" || d === "-" });
		}
	}

	const files = [];
	if (statusRes.code === 0) {
		for (const line of statusRes.stdout.split("\n")) {
			if (!line.trim()) continue;
			const tab = line.indexOf("\t");
			const status = (tab === -1 ? line : line.slice(0, tab)).trim();
			let filePath = tab === -1 ? "" : line.slice(tab + 1);
			// renames: status R100 \told\tnew
			if (filePath.includes("\t")) {
				const parts = filePath.split("\t");
				filePath = parts[parts.length - 1];
			}
			if (!filePath) continue;
			const stats = numMap.get(filePath) || { additions: 0, deletions: 0, binary: false };
			files.push({
				path: filePath,
				status: status.charAt(0) || "M",
				...stats,
			});
		}
	}

	return {
		hash: fullHash || hash,
		shortHash: shortHash || (fullHash || hash).slice(0, 7),
		subject: subject || "",
		body: (body || "").trim(),
		authorName: authorName || "",
		authorEmail: authorEmail || "",
		authoredAt: authoredAt || "",
		additions,
		deletions,
		files,
	};
}

async function commitFileDiff(repoAbs, hashRaw, filePathRaw) {
	const hash = String(hashRaw || "").trim();
	const filePath = String(filePathRaw || "").trim();
	if (!hash || !filePath) throw new Error("hash and path required");
	const res = await git(repoAbs, ["show", "--format=", hash, "--", filePath], { allowFail: true });
	if (res.code !== 0) {
		return { diff: res.stderr || res.stdout || "Could not load diff", code: res.code };
	}
	const diff = res.stdout || "";
	if (!diff.trim()) {
		return { diff: "(No textual diff for this file — binary or mode-only change.)", code: 0 };
	}
	return { diff, code: 0 };
}

async function scanGitDirs(root, { maxDepth = 2 } = {}) {
	const found = [];
	const rootAbs = path.resolve(root);
	async function walk(dir, depth) {
		if (depth > maxDepth) return;
		let ents;
		try {
			ents = await fs.readdir(dir, { withFileTypes: true });
		} catch {
			return;
		}
		if (await isGitRepo(dir)) {
			found.push(dir);
			return;
		}
		for (const ent of ents) {
			if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
			await walk(path.join(dir, ent.name), depth + 1);
		}
	}
	await walk(rootAbs, 0);
	return found;
}

function resolveFallbackCwd(fallbackCwd) {
	if (typeof fallbackCwd !== "string" || !fallbackCwd.trim()) return "";
	try {
		return assertAllowedPath(fallbackCwd.trim());
	} catch {
		return "";
	}
}

async function listCloneTargets(ctx, sessionId, fallbackCwd) {
	let sessionPath = "";
	let sessionLabel = "";
	const targets = [];
	try {
		sessionPath = sessionCwd(ctx, sessionId);
		sessionLabel = "Current chat's workspace";
	} catch {
		sessionPath = resolveFallbackCwd(fallbackCwd);
		sessionLabel = "Current workspace (sidebar)";
	}
	if (sessionPath) {
		targets.push({
			id: "session",
			label: `${sessionLabel} (${path.basename(sessionPath)})`,
			path: sessionPath,
			kind: "session",
			hint: sessionPath,
		});
	}

	const wsRoot = path.resolve("/workspace");
	let ents;
	try {
		ents = await fs.readdir(wsRoot, { withFileTypes: true });
	} catch {
		ents = [];
	}
	for (const ent of ents) {
		if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
		if (ent.name === "repos") continue;
		const top = path.join(wsRoot, ent.name);
		targets.push({
			id: `ws:${ent.name}`,
			label: ent.name,
			path: top,
			kind: "folder",
			hint: top,
		});
		try {
			const sub = await fs.readdir(top, { withFileTypes: true });
			for (const s of sub) {
				if (!s.isDirectory() || s.name.startsWith(".")) continue;
				const nested = path.join(top, s.name);
				targets.push({
					id: `ws:${ent.name}/${s.name}`,
					label: `${ent.name} / ${s.name}`,
					path: nested,
					kind: "folder",
					hint: nested,
				});
			}
		} catch {
			/* skip nested */
		}
	}

	const seen = new Set();
	const unique = targets.filter((t) => {
		if (seen.has(t.path)) return false;
		seen.add(t.path);
		return true;
	});

	return {
		targets: unique,
		defaultTarget: sessionPath || unique[0]?.path || "",
		sessionPath,
	};
}

async function listRepos(ctx, sessionId, fallbackCwd) {
	const roots = new Set([path.resolve("/workspace")]);
	roots.add(testEnvRoot());
	if (sessionId) {
		try {
			roots.add(path.resolve(sessionCwd(ctx, sessionId)));
		} catch {
			/* optional */
		}
	}
	if (fallbackCwd) {
		const resolved = resolveFallbackCwd(fallbackCwd);
		if (resolved) roots.add(resolved);
	}

	/** @type {Map<string, any>} */
	const map = new Map();
	for (const root of roots) {
		const dirs = await scanGitDirs(root, { maxDepth: 3 });
		for (const dir of dirs) {
			if (map.has(dir)) continue;
			let remote = "";
			let branch = "";
			try {
				const rem = await git(dir, ["remote", "get-url", "origin"], { allowFail: true });
				if (rem.code === 0) remote = rem.stdout.trim();
				const br = await git(dir, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true });
				if (br.code === 0) branch = br.stdout.trim();
			} catch {
				/* skip meta */
			}
			let hasCompose = false;
			for (const n of ["docker-compose.yml", "compose.yml", "docker-compose.yaml", "compose.yaml"]) {
				try {
					await fs.access(path.join(dir, n));
					hasCompose = true;
					break;
				} catch {
					/* */
				}
			}
			const submodules = await getSubmodules(dir);
			map.set(dir, {
				path: dir,
				name: path.basename(dir),
				remote,
				branch,
				hasCompose,
				submodules,
				inLibrary: false,
			});
		}
	}

	return {
		repos: [...map.values()].sort((a, b) => a.name.localeCompare(b.name)),
	};
}

async function probeSshGithub() {
	try {
		const { env } = await buildGitEnv();
		await execFileAsync("ssh", ["-T", "-o", "BatchMode=yes", "-o", "ConnectTimeout=5", "git@github.com"], {
			env,
			timeout: 8000,
		});
		return { ok: true, detail: "ok" };
	} catch (err) {
		const msg = String(err?.stderr || err?.message || err);
		if (/successfully authenticated/i.test(msg)) return { ok: true, detail: msg.trim() };
		return { ok: false, detail: msg.trim().slice(0, 400) };
	}
}

async function probeHttpsGithub(token) {
	if (!token) return { ok: false, detail: "no token", login: "" };
	try {
		const res = await fetch("https://api.github.com/user", {
			headers: {
				Authorization: `Bearer ${token}`,
				"User-Agent": "dsh-git",
				Accept: "application/vnd.github+json",
			},
			signal: AbortSignal.timeout(8000),
		});
		if (!res.ok) return { ok: false, detail: `HTTP ${res.status}`, login: "" };
		const body = await res.json();
		return { ok: true, detail: body?.login || "ok", login: body?.login || "" };
	} catch (err) {
		return { ok: false, detail: String(err?.message || err).slice(0, 200), login: "" };
	}
}

async function githubDeviceStart(clientId) {
	const id = String(clientId || "").trim();
	if (!id) {
		throw new Error(
			"GitHub OAuth Client ID required — create an OAuth App at github.com/settings/developers (Device Flow), then paste the Client ID in Settings → Git.",
		);
	}
	const body = new URLSearchParams({
		client_id: id,
		scope: "repo read:user",
	});
	const res = await fetch("https://github.com/login/device/code", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": "dsh-git",
		},
		body,
		signal: AbortSignal.timeout(15000),
	});
	const data = await res.json().catch(() => ({}));
	if (!res.ok || !data.device_code) {
		throw new Error(data.error_description || data.error || `device start failed (${res.status})`);
	}
	return {
		deviceCode: data.device_code,
		userCode: data.user_code,
		verificationUri: data.verification_uri || "https://github.com/login/device",
		interval: Math.max(Number(data.interval) || 5, 5),
		expiresIn: Number(data.expires_in) || 900,
	};
}

async function githubDevicePoll(clientId, deviceCode) {
	const id = String(clientId || "").trim();
	const code = String(deviceCode || "").trim();
	if (!id || !code) throw new Error("clientId and deviceCode required");
	const body = new URLSearchParams({
		client_id: id,
		device_code: code,
		grant_type: "urn:ietf:params:oauth:grant-type:device_code",
	});
	const res = await fetch("https://github.com/login/oauth/access_token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/x-www-form-urlencoded",
			"User-Agent": "dsh-git",
		},
		body,
		signal: AbortSignal.timeout(15000),
	});
	const data = await res.json().catch(() => ({}));
	if (data.error === "authorization_pending") {
		return { pending: true };
	}
	if (data.error === "slow_down") {
		return { pending: true, slowDown: true, interval: Number(data.interval) || 10 };
	}
	if (data.error === "expired_token") {
		throw new Error("Device code expired — start Sign in again");
	}
	if (data.error === "access_denied") {
		throw new Error("GitHub access denied");
	}
	if (!data.access_token) {
		throw new Error(data.error_description || data.error || "device poll failed");
	}
	const probe = await probeHttpsGithub(data.access_token);
	const cfg = await loadAuthConfig();
	cfg.httpsToken = data.access_token;
	cfg.githubLogin = probe.login || "";
	cfg.authSource = "github-device";
	await saveAuthConfig(cfg);
	return {
		pending: false,
		login: cfg.githubLogin,
		hasHttpsToken: true,
	};
}

async function listGithubRemoteRepos(token, { page = 1, perPage = 50 } = {}) {
	if (!token) throw new Error("Sign in with GitHub (or save a PAT) first");
	const url = new URL("https://api.github.com/user/repos");
	url.searchParams.set("per_page", String(Math.min(Math.max(perPage, 1), 100)));
	url.searchParams.set("page", String(Math.max(page, 1)));
	url.searchParams.set("sort", "updated");
	url.searchParams.set("affiliation", "owner,collaborator,organization_member");
	const res = await fetch(url, {
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "dsh-git",
			Accept: "application/vnd.github+json",
		},
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`GitHub repos HTTP ${res.status}: ${text.slice(0, 200)}`);
	}
	const rows = await res.json();
	if (!Array.isArray(rows)) return { repos: [], page, hasMore: false };
	return {
		page,
		hasMore: rows.length >= perPage,
		repos: rows.map((r) => ({
			id: r.id,
			fullName: r.full_name,
			name: r.name,
			private: Boolean(r.private),
			cloneUrl: r.clone_url,
			sshUrl: r.ssh_url,
			htmlUrl: r.html_url,
			updatedAt: r.updated_at,
			description: r.description || "",
			defaultBranch: r.default_branch || "main",
		})),
	};
}

function splitGithubFullName(fullName) {
	const parts = String(fullName || "").trim().split("/").filter(Boolean);
	if (parts.length < 2) throw new Error("fullName must be owner/repo");
	return { owner: parts[0], repo: parts.slice(1).join("/") };
}

async function githubApiJson(token, url, { method = "GET", body } = {}) {
	if (!token) throw new Error("Sign in with GitHub first");
	const res = await fetch(url, {
		method,
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "dsh-git",
			Accept: "application/vnd.github+json",
			...(body ? { "Content-Type": "application/json" } : {}),
		},
		body: body ? JSON.stringify(body) : undefined,
		signal: AbortSignal.timeout(20000),
	});
	const text = await res.text();
	let data = null;
	try {
		data = text ? JSON.parse(text) : null;
	} catch {
		data = null;
	}
	if (!res.ok) {
		const detail = data?.message || text.slice(0, 300) || `HTTP ${res.status}`;
		throw new Error(detail);
	}
	return data;
}

async function githubListCommits(token, fullName, { page = 1, perPage = 50 } = {}) {
	const { owner, repo } = splitGithubFullName(fullName);
	const url = new URL(`https://api.github.com/repos/${owner}/${repo}/commits`);
	url.searchParams.set("per_page", String(Math.min(Math.max(perPage, 1), 100)));
	url.searchParams.set("page", String(Math.max(page, 1)));
	const rows = await githubApiJson(token, url);
	if (!Array.isArray(rows)) return { commits: [], page, hasMore: false };
	return {
		page,
		hasMore: rows.length >= perPage,
		source: "github",
		fullName: `${owner}/${repo}`,
		commits: rows.map((c) => {
			const message = c.commit?.message || "";
			const subject = message.split("\n")[0] || "";
			const sha = c.sha || "";
			return {
				hash: sha,
				shortHash: sha.slice(0, 7),
				subject,
				authorName: c.commit?.author?.name || c.author?.login || "",
				authorEmail: c.commit?.author?.email || "",
				authoredAt: c.commit?.author?.date || "",
			};
		}),
	};
}

async function githubShowCommit(token, fullName, shaRaw) {
	const { owner, repo } = splitGithubFullName(fullName);
	const sha = String(shaRaw || "").trim();
	if (!sha) throw new Error("commit hash required");
	const body = await githubApiJson(token, `https://api.github.com/repos/${owner}/${repo}/commits/${encodeURIComponent(sha)}`);
	const message = body.commit?.message || "";
	const lines = message.split("\n");
	const subject = lines[0] || "";
	const commitBody = lines.slice(1).join("\n").trim();
	const statusMap = {
		added: "A",
		removed: "D",
		modified: "M",
		renamed: "R",
		copied: "C",
		changed: "M",
	};
	const files = (body.files || []).map((f) => ({
		path: f.filename || f.previous_filename || "",
		status: statusMap[f.status] || "M",
		additions: f.additions || 0,
		deletions: f.deletions || 0,
		binary: !f.patch && (f.changes || 0) === 0 && f.status !== "removed",
		patch: f.patch || "",
	})).filter((f) => f.path);

	return {
		hash: body.sha || sha,
		shortHash: (body.sha || sha).slice(0, 7),
		subject,
		body: commitBody,
		authorName: body.commit?.author?.name || body.author?.login || "",
		authorEmail: body.commit?.author?.email || "",
		authoredAt: body.commit?.author?.date || "",
		additions: body.stats?.additions || 0,
		deletions: body.stats?.deletions || 0,
		files,
		source: "github",
		fullName: `${owner}/${repo}`,
		htmlUrl: body.html_url || "",
	};
}

function sanitizeGithubRepoName(name) {
	const cleaned = String(name || "")
		.trim()
		.replace(/\s+/g, "-")
		.replace(/[^A-Za-z0-9._-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[.-]+|[.-]+$/g, "");
	return cleaned.slice(0, 100) || "repo";
}

async function createGithubRepo(token, { name, description = "", isPrivate = true } = {}) {
	if (!token) throw new Error("Sign in with GitHub first");
	const repoName = sanitizeGithubRepoName(name);
	if (!repoName) throw new Error("Repository name required");
	const res = await fetch("https://api.github.com/user/repos", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${token}`,
			"User-Agent": "dsh-git",
			Accept: "application/vnd.github+json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			name: repoName,
			description: String(description || "").trim().slice(0, 350),
			private: Boolean(isPrivate),
			auto_init: false,
		}),
		signal: AbortSignal.timeout(20000),
	});
	if (!res.ok) {
		const text = await res.text();
		let detail = text.slice(0, 300);
		try {
			const j = JSON.parse(text);
			detail = j.message || (Array.isArray(j.errors) ? j.errors.map((e) => e.message).join("; ") : detail);
		} catch {
			/* keep text */
		}
		throw new Error(`GitHub create repo failed (${res.status}): ${detail}`);
	}
	const body = await res.json();
	return {
		name: body.name,
		fullName: body.full_name,
		htmlUrl: body.html_url,
		cloneUrl: body.clone_url,
		sshUrl: body.ssh_url,
		private: Boolean(body.private),
	};
}

async function setOriginRemote(repoAbs, url) {
	const remoteUrl = String(url || "").trim();
	if (!remoteUrl) throw new Error("remote URL required");
	const existing = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
	if (existing.code === 0) {
		await git(repoAbs, ["remote", "set-url", "origin", remoteUrl]);
	} else {
		await git(repoAbs, ["remote", "add", "origin", remoteUrl]);
	}
	return remoteUrl;
}

async function publishToGithub(repoAbs, cfg, payload = {}) {
	if (!cfg?.httpsToken) throw new Error("Sign in with GitHub first (Settings → Git)");
	const name = sanitizeGithubRepoName(payload?.name || path.basename(repoAbs));
	const created = await createGithubRepo(cfg.httpsToken, {
		name,
		description: payload?.description,
		isPrivate: payload?.private !== false,
	});
	await setOriginRemote(repoAbs, created.cloneUrl);

	const head = await git(repoAbs, ["rev-parse", "--verify", "HEAD"], { allowFail: true });
	if (head.code !== 0) {
		return {
			...created,
			remoteSet: true,
			pushed: false,
			hint: "Created on GitHub and set origin — commit at least once, then Push.",
		};
	}

	const push = await git(repoAbs, ["push", "-u", "origin", "HEAD"], { allowFail: true });
	if (push.code !== 0) {
		throw new Error(
			`Repo created (${created.htmlUrl}) and origin set, but push failed: ${
				(push.stderr || push.stdout || "push failed").trim()
			}`,
		);
	}
	return {
		...created,
		remoteSet: true,
		pushed: true,
		output: (push.stdout || push.stderr || "").trim(),
	};
}

function registerRpc(ctx) {
	const register = ctx.connection.rpc.handle;
	return register(
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				switch (endpoint) {
					case "getAuth": {
						const cfg = await loadAuthConfig();
						const identity = resolveCommitIdentity(cfg);
						return ok({
							hasHttpsToken: Boolean(cfg.httpsToken),
							sshIdentityFile: cfg.sshIdentityFile || "",
							httpsTokenHint: cfg.httpsToken
								? `${cfg.httpsToken.slice(0, 4)}...${cfg.httpsToken.slice(-4)}`
								: "",
							reposRoot: effectiveReposRoot(cfg),
							githubClientId: cfg.githubClientId || "",
							githubLogin: cfg.githubLogin || "",
							authSource: cfg.authSource || "",
							userName: cfg.userName || "",
							userEmail: cfg.userEmail || "",
							commitName: identity.name,
							commitEmail: identity.email,
							commitIdentitySource: identity.source,
							needsAuthorSetup: identity.needsAuthorSetup,
							hasCommitIdentity: Boolean(identity.name && identity.email),
							defaultCommitName: DEFAULT_COMMIT_NAME,
							defaultCommitEmail: DEFAULT_COMMIT_EMAIL,
						});
					}
					case "setAuth": {
						const current = await loadAuthConfig();
						let httpsToken = current.httpsToken;
						if (payload?.clearHttpsToken === true) {
							httpsToken = "";
							current.githubLogin = "";
							current.authSource = "";
						} else if (typeof payload?.httpsToken === "string" && payload.httpsToken.trim()) {
							httpsToken = payload.httpsToken.trim();
							current.authSource = "pat";
							current.githubLogin = "";
						}
						const sshIdentityFile =
							typeof payload?.sshIdentityFile === "string"
								? payload.sshIdentityFile.trim()
								: current.sshIdentityFile;
						if (sshIdentityFile) {
							try {
								await fs.access(sshIdentityFile);
							} catch {
								throw new Error(`SSH identity file not readable: ${sshIdentityFile}`);
							}
						}
						let nextReposRoot = current.reposRoot || "";
						if (typeof payload?.reposRoot === "string") {
							nextReposRoot = payload.reposRoot.trim();
							if (nextReposRoot) assertAllowedPath(nextReposRoot);
						}
						let githubClientId = current.githubClientId || "";
						if (typeof payload?.githubClientId === "string") {
							githubClientId = payload.githubClientId.trim();
						}
						let userName = current.userName || "";
						if (typeof payload?.userName === "string") {
							userName = payload.userName.trim();
						}
						let userEmail = current.userEmail || "";
						if (typeof payload?.userEmail === "string") {
							userEmail = payload.userEmail.trim();
						}
						const cfg = {
							httpsToken,
							sshIdentityFile,
							reposRoot: nextReposRoot,
							githubClientId,
							githubLogin: current.githubLogin || "",
							authSource: current.authSource || "",
							userName,
							userEmail,
							sessionRepos: current.sessionRepos || {},
						};
						await saveAuthConfig(cfg);
						const identity = resolveCommitIdentity(cfg);
						return ok({
							hasHttpsToken: Boolean(cfg.httpsToken),
							sshIdentityFile: cfg.sshIdentityFile || "",
							reposRoot: effectiveReposRoot(cfg),
							githubClientId: cfg.githubClientId || "",
							githubLogin: cfg.githubLogin || "",
							authSource: cfg.authSource || "",
							userName: cfg.userName || "",
							userEmail: cfg.userEmail || "",
							commitName: identity.name,
							commitEmail: identity.email,
							commitIdentitySource: identity.source,
							needsAuthorSetup: identity.needsAuthorSetup,
							hasCommitIdentity: Boolean(identity.name && identity.email),
							defaultCommitName: DEFAULT_COMMIT_NAME,
							defaultCommitEmail: DEFAULT_COMMIT_EMAIL,
						});
					}
					case "authStatus": {
						const cfg = await loadAuthConfig();
						const ssh = await probeSshGithub();
						const https = await probeHttpsGithub(cfg.httpsToken);
						if (https.ok && https.login && https.login !== cfg.githubLogin) {
							cfg.githubLogin = https.login;
							await saveAuthConfig(cfg);
						}
						return ok({
							ssh,
							https,
							hasHttpsToken: Boolean(cfg.httpsToken),
							sshIdentityFile: cfg.sshIdentityFile || "",
							reposRoot: effectiveReposRoot(cfg),
							githubClientId: cfg.githubClientId || "",
							githubLogin: cfg.githubLogin || https.login || "",
							authSource: cfg.authSource || "",
						});
					}
					case "github.deviceStart": {
						const cfg = await loadAuthConfig();
						const clientId = (typeof payload?.clientId === "string" && payload.clientId.trim())
							|| cfg.githubClientId;
						if (typeof payload?.clientId === "string" && payload.clientId.trim()) {
							cfg.githubClientId = payload.clientId.trim();
							await saveAuthConfig(cfg);
						}
						return ok(await githubDeviceStart(clientId));
					}
					case "github.devicePoll": {
						const cfg = await loadAuthConfig();
						const clientId = (typeof payload?.clientId === "string" && payload.clientId.trim())
							|| cfg.githubClientId;
						return ok(await githubDevicePoll(clientId, payload?.deviceCode));
					}
					case "github.listRepos": {
						const cfg = await loadAuthConfig();
						return ok(await listGithubRemoteRepos(cfg.httpsToken, {
							page: Number(payload?.page) || 1,
							perPage: Number(payload?.perPage) || 50,
						}));
					}
					case "github.createRepo": {
						const cfg = await loadAuthConfig();
						return ok(await createGithubRepo(cfg.httpsToken, {
							name: payload?.name,
							description: payload?.description,
							isPrivate: payload?.private !== false,
						}));
					}
					case "github.listCommits": {
						const cfg = await loadAuthConfig();
						return ok(await githubListCommits(cfg.httpsToken, payload?.fullName, {
							page: Number(payload?.page) || 1,
							perPage: Number(payload?.perPage) || 50,
						}));
					}
					case "github.showCommit": {
						const cfg = await loadAuthConfig();
						return ok(await githubShowCommit(cfg.httpsToken, payload?.fullName, payload?.hash));
					}
					case "github.listPullRequests": {
						const cfg = await loadAuthConfig();
						return ok(await githubListPullRequests(cfg.httpsToken, payload?.fullName, {
							state: payload?.state,
							page: Number(payload?.page) || 1,
							perPage: Number(payload?.perPage) || 30,
						}));
					}
					case "github.createPullRequest": {
						const cfg = await loadAuthConfig();
						return ok(await githubCreatePullRequest(cfg.httpsToken, payload?.fullName, payload || {}));
					}
					case "github.compare": {
						const cfg = await loadAuthConfig();
						return ok(await githubCompare(
							cfg.httpsToken,
							payload?.fullName,
							payload?.base,
							payload?.head,
						));
					}
					case "listRepos": {
						return ok(await listRepos(ctx, payload?.sessionId, payload?.workspaceCwd));
					}
					case "cloneTargets": {
						return ok(await listCloneTargets(ctx, payload?.sessionId, payload?.workspaceCwd));
					}
					case "roots": {
						const cfg = await loadAuthConfig();
						return ok({
							reposRoot: effectiveReposRoot(cfg),
							workspace: "/workspace",
							testEnvRoot: testEnvRoot(),
							allowedRoots: allowedRoots(),
						});
					}
					case "listSessionRepos": {
						const cfg = await loadAuthConfig();
						return ok({ sessionRepos: cfg.sessionRepos || {} });
					}
					case "setSessionRepo": {
						const sid = String(payload?.sessionId || "").trim();
						if (!sid) throw new Error("sessionId required");
						const repo = typeof payload?.repoPath === "string" ? payload.repoPath.trim() : "";
						const cfg = await loadAuthConfig();
						cfg.sessionRepos = cfg.sessionRepos || {};
						if (repo) {
							cfg.sessionRepos[sid] = repo;
						} else {
							delete cfg.sessionRepos[sid];
						}
						await saveAuthConfig(cfg);
						return ok({ sessionId: sid, repoPath: repo, sessionRepos: cfg.sessionRepos });
					}
					case "syncSessionRepos": {
						const cfg = await loadAuthConfig();
						cfg.sessionRepos = cfg.sessionRepos || {};
						const clientRepos = payload?.sessionRepos && typeof payload.sessionRepos === "object" ? payload.sessionRepos : {};
						let changed = false;
						for (const [sId, rPath] of Object.entries(clientRepos)) {
							if (typeof rPath === "string" && rPath.trim() && !cfg.sessionRepos[sId]) {
								cfg.sessionRepos[sId] = rPath.trim();
								changed = true;
							}
						}
						if (changed) {
							await saveAuthConfig(cfg);
						}
						return ok({ sessionRepos: cfg.sessionRepos });
					}
					default:
						break;
				}

				const sessionId = payload?.sessionId;
				let cwd = null;
				try {
					cwd = sessionCwd(ctx, sessionId);
				} catch {
					cwd = resolveFallbackCwd(payload?.workspaceCwd) || null;
				}
				const repoAbs = await resolveRepoAbs(ctx, payload);

				switch (endpoint) {
					case "status": {
						return ok(await collectStatus(cwd, repoAbs));
					}
					case "diff": {
						const filePath = payload?.path;
						const staged = payload?.staged === true;
						const args = staged
							? ["diff", "--cached", "--", filePath || "."]
							: ["diff", "--", filePath || "."];
						const res = await git(repoAbs, args, { allowFail: true });
						return ok({ diff: res.stdout || res.stderr || "", code: res.code });
					}
					case "log": {
						return ok(await listCommits(repoAbs, { limit: payload?.limit }));
					}
					case "showCommit": {
						return ok(await showCommit(repoAbs, payload?.hash));
					}
					case "commitDiff": {
						return ok(await commitFileDiff(repoAbs, payload?.hash, payload?.path));
					}
					case "listBranches": {
						return ok(await listBranches(repoAbs));
					}
					case "createBranch": {
						const name = assertBranchName(payload?.name);
						const from = typeof payload?.from === "string" && payload.from.trim()
							? payload.from.trim()
							: "HEAD";
						const checkout = payload?.checkout !== false;
						const args = checkout
							? ["checkout", "-b", name, from]
							: ["branch", name, from];
						const res = await git(repoAbs, args, { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "create branch failed");
						return ok({ name, checkedOut: checkout, ...(await listBranches(repoAbs)) });
					}
					case "deleteBranch": {
						const name = assertBranchName(payload?.name);
						const current = await git(repoAbs, ["rev-parse", "--abbrev-ref", "HEAD"], { allowFail: true });
						if (current.code === 0 && current.stdout.trim() === name) {
							throw new Error("Cannot delete the current branch — switch first");
						}
						const force = payload?.force === true;
						const res = await git(repoAbs, ["branch", force ? "-D" : "-d", name], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "delete branch failed");
						return ok({ deleted: name, ...(await listBranches(repoAbs)) });
					}
					case "switchBranch": {
						const nameRaw = String(payload?.name || "").trim();
						if (!nameRaw) throw new Error("branch name required");
						const create = payload?.create === true;
						const dirtyMode = String(payload?.dirtyMode || "fail"); // fail | stash | bring | discard
						const statusNow = await collectStatus(cwd, repoAbs);
						const dirty = (statusNow.files || []).length > 0;
						let stashed = false;
						if (dirty) {
							if (dirtyMode === "fail") {
								throw new Error(
									`You have ${statusNow.files.length} uncommitted change(s). Stash, bring them, or discard before switching.`,
								);
							}
							if (dirtyMode === "discard") {
								await git(repoAbs, ["reset", "--hard", "HEAD"], { allowFail: true });
								await git(repoAbs, ["clean", "-fd"], { allowFail: true });
							} else if (dirtyMode === "stash") {
								const stash = await git(
									repoAbs,
									["stash", "push", "-u", "-m", `dsh-git switch → ${nameRaw}`],
									{ allowFail: true },
								);
								if (stash.code !== 0) {
									throw new Error(stash.stderr || stash.stdout || "stash before switch failed");
								}
								stashed = true;
							} else if (dirtyMode !== "bring") {
								throw new Error("dirtyMode must be fail, stash, bring, or discard");
							}
						}
						let res;
						if (create) {
							const branchName = assertBranchName(nameRaw);
							res = await git(repoAbs, ["checkout", "-b", branchName], { allowFail: true });
						} else if (nameRaw.startsWith("origin/")) {
							const local = nameRaw.slice("origin/".length);
							assertBranchName(local);
							const exists = await git(repoAbs, ["show-ref", "--verify", "--quiet", `refs/heads/${local}`], {
								allowFail: true,
							});
							if (exists.code === 0) {
								res = await git(repoAbs, ["checkout", local], { allowFail: true });
							} else {
								res = await git(repoAbs, ["checkout", "-b", local, "--track", nameRaw], { allowFail: true });
							}
						} else {
							assertBranchName(nameRaw);
							res = await git(repoAbs, ["checkout", nameRaw], { allowFail: true });
						}
						if (res.code !== 0) {
							throw new Error(res.stderr || res.stdout || "checkout failed");
						}
						return ok({
							branch: nameRaw,
							stashed,
							brought: dirty && dirtyMode === "bring",
							...(await listBranches(repoAbs)),
						});
					}
					case "publishBranch": {
						const name = assertBranchName(payload?.name || (await collectStatus(cwd, repoAbs)).branch);
						const rem = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
						if (rem.code !== 0) throw new Error("No origin remote — Publish to GitHub first.");
						const res = await git(repoAbs, ["push", "-u", "origin", name], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "publish branch failed");
						return ok({ published: name, output: res.stdout || res.stderr });
					}
					case "stash": {
						const message = typeof payload?.message === "string" && payload.message.trim()
							? payload.message.trim()
							: "dsh-git stash";
						const includeUntracked = payload?.includeUntracked !== false;
						const args = ["stash", "push"];
						if (includeUntracked) args.push("-u");
						args.push("-m", message);
						const res = await git(repoAbs, args, { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "stash failed");
						return ok({ stashed: true, stashes: await listStashes(repoAbs), output: res.stdout || res.stderr });
					}
					case "stashPop": {
						const ref = typeof payload?.ref === "string" && payload.ref.trim() ? payload.ref.trim() : "stash@{0}";
						const res = await git(repoAbs, ["stash", "pop", ref], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "stash pop failed");
						return ok({ restored: true, stashes: await listStashes(repoAbs), output: res.stdout || res.stderr });
					}
					case "stashDrop": {
						const ref = typeof payload?.ref === "string" && payload.ref.trim() ? payload.ref.trim() : "stash@{0}";
						const res = await git(repoAbs, ["stash", "drop", ref], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "stash drop failed");
						return ok({ dropped: ref, stashes: await listStashes(repoAbs) });
					}
					case "stashList": {
						return ok({ stashes: await listStashes(repoAbs) });
					}
					case "abortMerge": {
						const op = await detectOpState(repoAbs);
						if (op.rebaseInProgress) {
							const res = await git(repoAbs, ["rebase", "--abort"], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "rebase --abort failed");
							return ok({ aborted: "rebase" });
						}
						if (op.cherryPickInProgress) {
							const res = await git(repoAbs, ["cherry-pick", "--abort"], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "cherry-pick --abort failed");
							return ok({ aborted: "cherry-pick" });
						}
						if (op.mergeInProgress) {
							const res = await git(repoAbs, ["merge", "--abort"], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "merge --abort failed");
							return ok({ aborted: "merge" });
						}
						throw new Error("No merge/rebase in progress");
					}
					case "continueMerge": {
						const op = await detectOpState(repoAbs);
						const statusNow = await collectStatus(cwd, repoAbs);
						if ((statusNow.conflictFiles || []).length) {
							throw new Error(
								`Resolve ${statusNow.conflictFiles.length} conflicted file(s) and stage them first.`,
							);
						}
						const cfg = await loadAuthConfig();
						const { name, email } = resolveCommitIdentity(cfg);
						if (op.rebaseInProgress) {
							const res = await git(repoAbs, [
								"-c", `user.name=${name}`,
								"-c", `user.email=${email}`,
								"rebase", "--continue",
							], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "rebase --continue failed");
							return ok({ continued: "rebase", output: res.stdout || res.stderr });
						}
						if (op.cherryPickInProgress) {
							const res = await git(repoAbs, [
								"-c", `user.name=${name}`,
								"-c", `user.email=${email}`,
								"cherry-pick", "--continue",
							], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "cherry-pick --continue failed");
							return ok({ continued: "cherry-pick", output: res.stdout || res.stderr });
						}
						if (op.mergeInProgress) {
							const res = await git(repoAbs, [
								"-c", `user.name=${name}`,
								"-c", `user.email=${email}`,
								"commit", "--no-edit",
							], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "merge commit failed");
							return ok({ continued: "merge", output: res.stdout || res.stderr });
						}
						throw new Error("No merge/rebase in progress");
					}
					case "undoCommit": {
						const statusNow = await collectStatus(cwd, repoAbs);
						if (!statusNow.canUndo) {
							throw new Error(
								statusNow.hasUpstream && statusNow.ahead === 0
									? "Cannot undo — latest commit is already on the remote"
									: "Cannot undo right now",
							);
						}
						const res = await git(repoAbs, ["reset", "--soft", "HEAD~1"], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "undo failed");
						return ok({ undone: true });
					}
					case "amendCommit": {
						const statusNow = await collectStatus(cwd, repoAbs);
						if (!statusNow.canAmend && payload?.force !== true) {
							throw new Error(
								statusNow.hasUpstream && statusNow.ahead === 0
									? "Cannot amend — latest commit is already on the remote (would need force-push)"
									: "Cannot amend right now",
							);
						}
						const message = typeof payload?.message === "string" ? payload.message.trim() : "";
						const cfg = await loadAuthConfig();
						const { name, email } = resolveCommitIdentity(cfg);
						const args = [
							"-c", `user.name=${name}`,
							"-c", `user.email=${email}`,
							"commit", "--amend",
						];
						if (message) args.push("-m", message);
						else args.push("--no-edit");
						const res = await git(repoAbs, args, { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "amend failed");
						return ok({ amended: true });
					}
					case "stageHunk": {
						const filePath = String(payload?.path || "").trim();
						const hunkIndex = Number(payload?.hunkIndex);
						if (!filePath) throw new Error("path required");
						if (!Number.isInteger(hunkIndex) || hunkIndex < 0) throw new Error("hunkIndex required");
						const unstage = payload?.unstage === true;
						const diffArgs = unstage
							? ["diff", "--cached", "--", filePath]
							: ["diff", "--", filePath];
						const diffRes = await git(repoAbs, diffArgs, { allowFail: true });
						const hunks = parseDiffHunks(diffRes.stdout || "");
						if (!hunks[hunkIndex]) throw new Error("hunk not found");
						const patch = buildFilePatch(filePath, hunks[hunkIndex].lines);
						await applyCachedPatch(repoAbs, patch, { reverse: unstage });
						return ok({ path: filePath, hunkIndex, unstaged: unstage });
					}
					case "diffHunks": {
						const filePath = String(payload?.path || "").trim();
						if (!filePath) throw new Error("path required");
						const staged = payload?.staged === true;
						const args = staged
							? ["diff", "--cached", "--", filePath]
							: ["diff", "--", filePath];
						const res = await git(repoAbs, args, { allowFail: true });
						const hunks = parseDiffHunks(res.stdout || "");
						return ok({
							path: filePath,
							staged,
							diff: res.stdout || "",
							hunks: hunks.map((h, index) => ({
								index,
								header: h.header,
								oldStart: h.oldStart,
								newStart: h.newStart,
								lineCount: h.lines.length,
							})),
						});
					}
					case "checkoutPullRequest": {
						const number = Number(payload?.number);
						if (!Number.isInteger(number) || number < 1) throw new Error("PR number required");
						const rem = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
						if (rem.code !== 0) throw new Error("No origin remote");
						const branchName = assertBranchName(
							typeof payload?.branch === "string" && payload.branch.trim()
								? payload.branch.trim()
								: `pr-${number}`,
						);
						const fetch = await git(
							repoAbs,
							["fetch", "origin", `pull/${number}/head:${branchName}`],
							{ allowFail: true },
						);
						if (fetch.code !== 0) {
							throw new Error(fetch.stderr || fetch.stdout || "fetch PR failed");
						}
						const dirtyMode = String(payload?.dirtyMode || "fail");
						const statusNow = await collectStatus(cwd, repoAbs);
						if ((statusNow.files || []).length && dirtyMode === "fail") {
							throw new Error(
								`You have ${statusNow.files.length} uncommitted change(s). Stash or discard before checking out the PR.`,
							);
						}
						if ((statusNow.files || []).length && dirtyMode === "stash") {
							await git(repoAbs, ["stash", "push", "-u", "-m", `dsh-git before PR #${number}`], {
								allowFail: true,
							});
						}
						if ((statusNow.files || []).length && dirtyMode === "discard") {
							await git(repoAbs, ["reset", "--hard", "HEAD"], { allowFail: true });
							await git(repoAbs, ["clean", "-fd"], { allowFail: true });
						}
						const co = await git(repoAbs, ["checkout", branchName], { allowFail: true });
						if (co.code !== 0) throw new Error(co.stderr || co.stdout || "checkout PR failed");
						return ok({ number, branch: branchName, fetched: true });
					}
					case "stage": {
						const paths = Array.isArray(payload?.paths) ? payload.paths : [];
						if (!paths.length) throw new Error("paths required");
						await git(repoAbs, ["add", "--", ...paths]);
						return ok({ staged: paths });
					}
					case "stageAll": {
						await git(repoAbs, ["add", "-A"]);
						return ok({ staged: "all" });
					}
					case "unstage": {
						const paths = Array.isArray(payload?.paths) ? payload.paths : [];
						if (!paths.length) throw new Error("paths required");
						await git(repoAbs, ["restore", "--staged", "--", ...paths], { allowFail: true });
						return ok({ unstaged: paths });
					}
					case "unstageAll": {
						await git(repoAbs, ["restore", "--staged", "."], { allowFail: true });
						return ok({ unstaged: "all" });
					}
					case "discard": {
						const paths = Array.isArray(payload?.paths) ? payload.paths : [];
						if (!paths.length) throw new Error("paths required");
						const statusNow = await collectStatus(cwd, repoAbs);
						const byPath = new Map((statusNow.files || []).map((f) => [f.path, f]));
						const tracked = [];
						const untracked = [];
						for (const p of paths) {
							const rel = String(p || "").trim();
							if (!rel || rel.includes("..")) throw new Error(`invalid path: ${p}`);
							const f = byPath.get(rel);
							if (!f || (f.index === "?" && f.worktree === "?")) untracked.push(rel);
							else tracked.push(rel);
						}
						if (tracked.length) {
							await git(repoAbs, ["restore", "--source=HEAD", "--staged", "--worktree", "--", ...tracked], {
								allowFail: true,
							});
							// older git fallback
							const still = await collectStatus(cwd, repoAbs);
							const left = tracked.filter((p) => (still.files || []).some((f) => f.path === p));
							if (left.length) {
								await git(repoAbs, ["checkout", "HEAD", "--", ...left], { allowFail: true });
							}
						}
						if (untracked.length) {
							const clean = await git(repoAbs, ["clean", "-f", "-d", "--", ...untracked], { allowFail: true });
							if (clean.code !== 0) {
								throw new Error(clean.stderr || clean.stdout || "failed to remove untracked files");
							}
						}
						return ok({ discarded: paths });
					}
					case "discardAll": {
						const hard = await git(repoAbs, ["reset", "--hard", "HEAD"], { allowFail: true });
						if (hard.code !== 0) throw new Error(hard.stderr || hard.stdout || "reset --hard failed");
						const clean = await git(repoAbs, ["clean", "-fd"], { allowFail: true });
						if (clean.code !== 0) throw new Error(clean.stderr || clean.stdout || "clean failed");
						return ok({ discarded: "all" });
					}
					case "pushPreview": {
						const statusNow = await collectStatus(cwd, repoAbs);
						const rem = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
						if (rem.code !== 0) {
							throw new Error("No origin remote — Publish to GitHub first.");
						}
						const commits = [];
						const log = await git(
							repoAbs,
							["log", "@{upstream}..HEAD", "--pretty=format:%h%x1f%s%x1f%an%x1f%aI"],
							{ allowFail: true },
						);
						if (log.code === 0 && log.stdout.trim()) {
							for (const line of log.stdout.split("\n")) {
								if (!line.trim()) continue;
								const [hash, subject, authorName, authoredAt] = line.split("\x1f");
								commits.push({
									hash: hash || "",
									subject: subject || "",
									authorName: authorName || "",
									authoredAt: authoredAt || "",
								});
							}
						} else if ((statusNow.ahead || 0) === 0) {
							// no upstream or nothing ahead — try unpushed via branch
							const log2 = await git(
								repoAbs,
								["log", "origin/HEAD..HEAD", "--pretty=format:%h%x1f%s%x1f%an%x1f%aI"],
								{ allowFail: true },
							);
							if (log2.code === 0 && log2.stdout.trim()) {
								for (const line of log2.stdout.split("\n")) {
									if (!line.trim()) continue;
									const [hash, subject, authorName, authoredAt] = line.split("\x1f");
									commits.push({
										hash: hash || "",
										subject: subject || "",
										authorName: authorName || "",
										authoredAt: authoredAt || "",
									});
								}
							}
						}
						return ok({
							remote: rem.stdout.trim(),
							branch: statusNow.branch,
							ahead: statusNow.ahead || commits.length,
							behind: statusNow.behind || 0,
							dirty: (statusNow.files || []).length > 0,
							dirtyCount: (statusNow.files || []).length,
							commits,
						});
					}
					case "pullPreview": {
						const rem = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
						if (rem.code !== 0) {
							throw new Error("No origin remote — nothing to pull from.");
						}
						await git(repoAbs, ["fetch", "--prune"], { allowFail: true });
						const statusNow = await collectStatus(cwd, repoAbs);
						const commits = [];
						const log = await git(
							repoAbs,
							["log", "HEAD..@{upstream}", "--pretty=format:%h%x1f%s%x1f%an%x1f%aI"],
							{ allowFail: true },
						);
						if (log.code === 0 && log.stdout.trim()) {
							for (const line of log.stdout.split("\n")) {
								if (!line.trim()) continue;
								const [hash, subject, authorName, authoredAt] = line.split("\x1f");
								commits.push({
									hash: hash || "",
									subject: subject || "",
									authorName: authorName || "",
									authoredAt: authoredAt || "",
								});
							}
						}
						const files = [];
						const diffNames = await git(
							repoAbs,
							["diff", "--name-status", "HEAD...@{upstream}"],
							{ allowFail: true },
						);
						if (diffNames.code === 0 && diffNames.stdout.trim()) {
							for (const line of diffNames.stdout.split("\n")) {
								if (!line.trim()) continue;
								const tab = line.indexOf("\t");
								const statusChar = (tab === -1 ? line : line.slice(0, tab)).trim();
								let filePath = tab === -1 ? "" : line.slice(tab + 1);
								if (filePath.includes("\t")) {
									filePath = filePath.split("\t").pop();
								}
								if (!filePath) continue;
								files.push({ status: statusChar.charAt(0) || "M", path: filePath });
							}
						}
						return ok({
							remote: rem.stdout.trim(),
							branch: statusNow.branch,
							ahead: statusNow.ahead || 0,
							behind: statusNow.behind || commits.length,
							dirty: (statusNow.files || []).length > 0,
							dirtyCount: (statusNow.files || []).length,
							commits,
							files,
							fetched: true,
						});
					}
					case "commit": {
						const message = typeof payload?.message === "string" ? payload.message.trim() : "";
						if (!message) throw new Error("commit message required");
						const cfg = await loadAuthConfig();
						const { name, email, source } = resolveCommitIdentity(cfg);
						await git(repoAbs, [
							"-c", `user.name=${name}`,
							"-c", `user.email=${email}`,
							"commit", "-m", message,
						]);
						return ok({ committed: true, author: { name, email, source } });
					}
					case "fetch": {
						const res = await git(repoAbs, ["fetch", "--prune"], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "fetch failed");
						return ok({ output: res.stdout || res.stderr });
					}
					case "pull": {
						if (payload?.confirmed !== true) {
							throw new Error("Pull requires confirmation");
						}
						const statusNow = await collectStatus(cwd, repoAbs);
						if ((statusNow.files || []).length && payload?.forceDirty !== true) {
							throw new Error(
								`You have ${statusNow.files.length} local uncommitted change(s). Discard them first, or confirm pull anyway.`,
							);
						}
						const res = await git(repoAbs, ["pull", "--ff-only"], { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "pull failed");
						return ok({ output: res.stdout || res.stderr, pulled: true });
					}
					case "push": {
						const rem = await git(repoAbs, ["remote", "get-url", "origin"], { allowFail: true });
						if (rem.code !== 0) {
							throw new Error("No origin remote — use Publish to GitHub first (or add a remote).");
						}
						if (payload?.confirmed !== true) {
							throw new Error("Push requires confirmation");
						}
						const res = await git(repoAbs, ["push", "-u", "origin", "HEAD"], { allowFail: true });
						if (res.code !== 0) {
							const retry = await git(repoAbs, ["push"], { allowFail: true });
							if (retry.code !== 0) throw new Error(res.stderr || retry.stderr || "push failed");
							return ok({ output: retry.stdout || retry.stderr });
						}
						return ok({ output: res.stdout || res.stderr });
					}
					case "publish": {
						const cfg = await loadAuthConfig();
						return ok(await publishToGithub(repoAbs, cfg, payload || {}));
					}
					case "setRemote": {
						const url = typeof payload?.url === "string" ? payload.url.trim() : "";
						if (!url) throw new Error("remote URL required");
						if (!/^(https?:\/\/|git@|ssh:\/\/)/i.test(url)) {
							throw new Error("URL must be https://, git@, or ssh://");
						}
						const name = typeof payload?.name === "string" && payload.name.trim()
							? payload.name.trim()
							: "origin";
						if (name === "origin") {
							await setOriginRemote(repoAbs, url);
						} else {
							const existing = await git(repoAbs, ["remote", "get-url", name], { allowFail: true });
							if (existing.code === 0) await git(repoAbs, ["remote", "set-url", name, url]);
							else await git(repoAbs, ["remote", "add", name, url]);
						}
						return ok({ name, url });
					}
					case "submoduleUpdate": {
						const subPath = typeof payload?.subPath === "string" ? payload.subPath.trim() : "";
						const args = subPath
							? ["submodule", "update", "--init", "--recursive", "--", subPath]
							: ["submodule", "update", "--init", "--recursive"];
						const res = await git(repoAbs, args, { allowFail: true });
						if (res.code !== 0) throw new Error(res.stderr || res.stdout || "submodule update failed");
						return ok({ output: res.stdout || res.stderr || "Submodules updated" });
					}
					case "init": {
						const st = await fs.stat(repoAbs).catch((err) => {
							if (err && err.code === "ENOENT") return null;
							throw err;
						});
						if (st && !st.isDirectory()) {
							throw new Error("path must be a directory");
						}
						if (await isGitRepo(repoAbs)) {
							throw new Error(`Already a git repository: ${repoAbs}`);
						}
						await fs.mkdir(repoAbs, { recursive: true });
						let res = await git(repoAbs, ["init", "-b", "main"], { allowFail: true });
						if (res.code !== 0) {
							res = await git(repoAbs, ["init"], { allowFail: true });
						}
						if (res.code !== 0) {
							throw new Error(res.stderr || res.stdout || "git init failed");
						}
						return ok({
							repoRel: cwd ? toRel(cwd, repoAbs) : path.basename(repoAbs),
							repoPath: repoAbs,
							initialized: true,
							output: (res.stdout || res.stderr || "").trim(),
						});
					}
					case "clone": {
						const url = typeof payload?.url === "string" ? payload.url.trim() : "";
						if (!url) throw new Error("clone URL required");
						if (!/^(https?:\/\/|git@|ssh:\/\/)/i.test(url)) {
							throw new Error("URL must be https://, git@, or ssh://");
						}

						let targetParentRaw =
							typeof payload?.targetParent === "string" ? payload.targetParent.trim() : "";
						const intoDot = !targetParentRaw && payload?.intoCurrent === true;
						const intoFolderRoot = payload?.layout === "root" || payload?.intoFolderRoot === true;
						let targetAbs;
						let targetRel;

						if (!targetParentRaw && !intoDot) {
							if (!cwd) throw new Error("Pick a workspace folder to clone into");
							targetParentRaw = path.resolve(cwd);
						}

						if (targetParentRaw) {
							const parent = assertAllowedPath(targetParentRaw);
							await fs.mkdir(parent, { recursive: true });
							if (intoFolderRoot) {
								if (!(await isEmptyDir(parent))) {
									throw new Error(`Folder not empty — pick another target or use subfolder layout: ${parent}`);
								}
								if (await isGitRepo(parent)) {
									throw new Error("Target folder is already a git repo");
								}
								targetAbs = parent;
								targetRel = cwd && parent.startsWith(path.resolve(cwd) + path.sep)
									? toRel(cwd, parent)
									: path.relative("/workspace", parent) || ".";
								const res = await git(parent, ["clone", url, "."], { allowFail: true });
								if (res.code !== 0) throw new Error(res.stderr || res.stdout || "clone failed");
							} else {
								const nameHint =
									(typeof payload?.directory === "string" && payload.directory.trim()) ||
									repoNameFromUrl(url);
								if (nameHint.includes("/") || nameHint.includes("\\") || nameHint === "." || nameHint === "..") {
									throw new Error("directory must be a single folder name");
								}
								targetAbs = path.join(parent, nameHint);
								try {
									await fs.access(targetAbs);
									throw new Error(`folder already exists: ${nameHint}`);
								} catch (err) {
									if (err && err.message && err.message.startsWith("folder already")) throw err;
									if (err && err.code !== "ENOENT") throw err;
								}
								const res = await git(parent, ["clone", url, nameHint], { allowFail: true });
								if (res.code !== 0) throw new Error(res.stderr || res.stdout || "clone failed");
								targetRel = cwd && targetAbs.startsWith(path.resolve(cwd) + path.sep)
									? toRel(cwd, targetAbs)
									: path.relative("/workspace", targetAbs) || nameHint;
							}
						} else if (intoDot) {
							if (!cwd) throw new Error("sessionId required to clone into workspace");
							targetAbs = resolveUnderCwd(cwd, ".");
							if (!(await isEmptyDir(targetAbs))) {
								throw new Error("workspace folder is not empty — pick an empty folder or use subfolder layout");
							}
							if (await isGitRepo(targetAbs)) {
								throw new Error("workspace is already a git repo");
							}
							targetRel = ".";
							const res = await git(cwd, ["clone", url, "."], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "clone failed");
						} else {
							if (!cwd) throw new Error("sessionId required");
							const nameHint =
								(typeof payload?.directory === "string" && payload.directory.trim()) ||
								repoNameFromUrl(url);
							if (nameHint === "." || nameHint === ".." || nameHint.includes("/") || nameHint.includes("\\")) {
								throw new Error("directory must be a single folder name");
							}
							targetAbs = resolveUnderCwd(cwd, nameHint);
							try {
								await fs.access(targetAbs);
								throw new Error(`folder already exists: ${nameHint}`);
							} catch (err) {
								if (err && err.message && err.message.startsWith("folder already")) throw err;
								if (err && err.code !== "ENOENT") throw err;
							}
							const res = await git(cwd, ["clone", url, nameHint], { allowFail: true });
							if (res.code !== 0) throw new Error(res.stderr || res.stdout || "clone failed");
							targetRel = nameHint;
						}

						return ok({
							repoRel: targetRel,
							repoRoot: targetAbs,
							repoPath: targetAbs,
							cloned: true,
							targetParent: targetParentRaw || null,
						});
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" },
	);
}

function apply(ctx) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.inject(["sessions"], (scope) => {
			scope.effect(() => registerRpc(scope), "dsh-git: rpc");
		});
	});
}

export { apply, name };

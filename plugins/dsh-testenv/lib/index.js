/**
 * dsh-testenv — clone-based test stacks under CONTAINERS_ROOT/.test-environments.
 * Compose runs against the host Docker socket with host-path project directories.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import {
	readFile,
	writeFile,
	mkdir,
	readdir,
	access,
	cp,
	rm,
	constants as fsConstants,
} from "node:fs/promises";
import { dirname, join, basename, resolve, sep, relative } from "node:path";
import { homedir } from "node:os";

const name = "dsh-testenv";
const RPC_CHANNEL = "/testenv";
const execFileAsync = promisify(execFile);

const TEST_COMPOSE = "docker-compose.test.yml";
const LEGACY_SANDBOX = "docker-compose.sandbox.yml";
const REGISTER_MARKER = ".dsh-testenv.json";
const BASE_COMPOSE_NAMES = ["docker-compose.yml", "compose.yml", "docker-compose.yaml", "compose.yaml"];
const PORT_OFFSET = Number(process.env.DSH_TESTENV_PORT_OFFSET || 10000);
const TEST_DIR_NAME = ".test-environments";

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

function containersRoot() {
	return resolve(process.env.CONTAINERS_ROOT || "/containers");
}

function containersHostRoot() {
	return resolve(process.env.CONTAINERS_HOST_ROOT || "/home/insaint/Containers");
}

function workspaceHostRoot() {
	return resolve(
		process.env.WORKSPACE_HOST_ROOT
			|| "/home/insaint/Containers/deepseek-harness/data/workspace",
	);
}

function testEnvRoot() {
	return join(containersRoot(), TEST_DIR_NAME);
}

function testEnvHostRoot() {
	return join(containersHostRoot(), TEST_DIR_NAME);
}

/** Map a path inside the Harness container to the equivalent host path for Docker binds. */
function toHostPath(containerPath) {
	const abs = resolve(containerPath);
	const cRoot = containersRoot();
	const cHost = containersHostRoot();
	const wRoot = resolve("/workspace");
	const wHost = workspaceHostRoot();
	if (abs === cRoot || abs.startsWith(cRoot + sep)) {
		const rel = abs === cRoot ? "" : abs.slice(cRoot.length + 1);
		return rel ? join(cHost, rel) : cHost;
	}
	if (abs === wRoot || abs.startsWith(wRoot + sep)) {
		const rel = abs === wRoot ? "" : abs.slice(wRoot.length + 1);
		return rel ? join(wHost, rel) : wHost;
	}
	return abs;
}

async function fileExists(p) {
	try {
		await access(p, fsConstants.R_OK);
		return true;
	} catch {
		return false;
	}
}

async function docker(args, { maxBuffer = 16 * 1024 * 1024 } = {}) {
	try {
		const { stdout, stderr } = await execFileAsync("docker", args, {
			maxBuffer,
			env: { ...process.env },
		});
		return { code: 0, stdout: stdout || "", stderr: stderr || "" };
	} catch (err) {
		const msg = err?.stderr || err?.message || String(err);
		throw new Error(String(msg).trim() || "docker failed");
	}
}

async function git(args, { cwd, maxBuffer = 32 * 1024 * 1024 } = {}) {
	try {
		const { stdout, stderr } = await execFileAsync("git", args, {
			cwd,
			maxBuffer,
			env: {
				...process.env,
				GIT_TERMINAL_PROMPT: "0",
				GIT_SSH_COMMAND: process.env.GIT_SSH_COMMAND || "ssh -o BatchMode=yes",
			},
		});
		return { code: 0, stdout: stdout || "", stderr: stderr || "" };
	} catch (err) {
		const msg = err?.stderr || err?.message || String(err);
		throw new Error(String(msg).trim() || "git failed");
	}
}

function slugify(raw) {
	return String(raw || "")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 64) || "app";
}

function projectNameForSlug(slug) {
	const s = slugify(slug);
	return s.endsWith("-test") ? s : `${s}-test`;
}

function repoNameFromUrl(url) {
	try {
		const cleaned = String(url).replace(/\.git$/i, "");
		const part = cleaned.split("/").filter(Boolean).pop() || "repo";
		return slugify(part);
	} catch {
		return "repo";
	}
}

async function findBaseCompose(dir) {
	for (const n of BASE_COMPOSE_NAMES) {
		if (await fileExists(join(dir, n))) return n;
	}
	return null;
}

function assertAllowedComposeDir(dir) {
	const raw = String(dir || "").trim();
	if (!raw) throw new Error("Folder path required");
	const abs = raw.startsWith("/") ? resolve(raw) : resolve("/workspace", raw);
	const roots = [testEnvRoot(), resolve("/workspace")];
	const okRoot = roots.some((root) => abs === root || abs.startsWith(root + sep));
	if (!okRoot) {
		throw new Error(`compose dir must be under ${testEnvRoot()} or /workspace`);
	}
	return abs;
}

function assertUnderTestRoot(dir) {
	const abs = resolve(dir);
	const root = testEnvRoot();
	if (abs !== root && !abs.startsWith(root + sep)) {
		throw new Error(`path must be under ${root}`);
	}
	return abs;
}

function assertUnderContainers(dir) {
	const abs = resolve(dir);
	const root = containersRoot();
	if (abs !== root && !abs.startsWith(root + sep)) {
		throw new Error(`path must be under ${root}`);
	}
	return abs;
}

async function listLiveStacks() {
	const root = containersRoot();
	const out = [];
	let ents;
	try {
		ents = await readdir(root, { withFileTypes: true });
	} catch {
		return out;
	}
	for (const ent of ents) {
		if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
		const dir = join(root, ent.name);
		const baseFile = await findBaseCompose(dir);
		if (!baseFile) continue;
		let remote = "";
		try {
			const r = await git(["remote", "get-url", "origin"], { cwd: dir });
			remote = (r.stdout || "").trim();
		} catch {
			/* optional */
		}
		out.push({
			slug: ent.name,
			dir,
			hostDir: toHostPath(dir),
			baseFile,
			remote,
			label: ent.name,
		});
	}
	return out.sort((a, b) => a.label.localeCompare(b.label));
}

async function inspectTestEnv(dir) {
	const abs = resolve(dir);
	const baseFile = await findBaseCompose(abs);
	if (!baseFile) return null;
	const hasTest = await fileExists(join(abs, TEST_COMPOSE));
	const hasLegacy = await fileExists(join(abs, LEGACY_SANDBOX));
	const registered = await fileExists(join(abs, REGISTER_MARKER));
	let marker = null;
	if (registered) {
		try {
			marker = JSON.parse(await readFile(join(abs, REGISTER_MARKER), "utf8"));
		} catch {
			marker = {};
		}
	}
	const slug = basename(abs);
	return {
		slug,
		dir: abs,
		hostDir: toHostPath(abs),
		workspacePath: abs,
		baseFile,
		overlayFile: hasTest ? TEST_COMPOSE : (hasLegacy ? LEGACY_SANDBOX : null),
		hasOverlay: hasTest || hasLegacy,
		registered,
		databaseUrl: marker?.databaseUrl || null,
		project: projectNameForSlug(slug),
		label: slug,
	};
}

async function listCandidates(workspaceCwd) {
	const roots = new Set([
		testEnvRoot(),
		resolve("/workspace"),
	]);
	if (typeof workspaceCwd === "string" && workspaceCwd.trim()) {
		try {
			roots.add(resolve(workspaceCwd.trim()));
		} catch {
			/* ignore */
		}
	}
	const out = [];
	const seen = new Set();

	async function walk(current, depth) {
		if (depth > 4) return;
		let ents;
		try {
			ents = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		const base = await findBaseCompose(current);
		if (base && !seen.has(current)) {
			seen.add(current);
			const isGit = await fileExists(join(current, ".git"));
			const isRegistered = await fileExists(join(current, REGISTER_MARKER));
			let rel = current.startsWith("/workspace")
				? current.slice("/workspace".length).replace(/^\/+/, "")
				: (current.startsWith(testEnvRoot()) ? current.slice(testEnvRoot().length).replace(/^\/+/, "") : basename(current));
			out.push({
				path: current,
				name: basename(current),
				relPath: rel || basename(current),
				baseFile: base,
				isGit,
				registered: isRegistered,
				source: current.startsWith(testEnvRoot()) ? "test-environments" : "workspace",
			});
		}
		for (const ent of ents) {
			if (!ent.isDirectory()) continue;
			if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "build" || ent.name === ".git" || ent.name === ".npm" || ent.name === ".local") continue;
			if (ent.name.startsWith(".") && ent.name !== ".test-environments") continue;
			await walk(join(current, ent.name), depth + 1);
		}
	}

	for (const r of roots) {
		await mkdir(r, { recursive: true }).catch(() => {});
		await walk(r, 0);
	}

	return out.sort((a, b) => a.name.localeCompare(b.name));
}

async function listTestEnvs(workspaceCwd) {
	const roots = new Set([
		testEnvRoot(),
		resolve("/workspace"),
	]);
	if (typeof workspaceCwd === "string" && workspaceCwd.trim()) {
		try {
			roots.add(resolve(workspaceCwd.trim()));
		} catch {
			/* ignore */
		}
	}
	const out = [];
	const seen = new Set();

	async function scanRegistered(current, depth) {
		if (depth > 4) return;
		let ents;
		try {
			ents = await readdir(current, { withFileTypes: true });
		} catch {
			return;
		}
		if (await fileExists(join(current, REGISTER_MARKER))) {
			const meta = await inspectTestEnv(current);
			if (meta?.registered && !seen.has(meta.dir)) {
				seen.add(meta.dir);
				out.push({
					...meta,
					source: meta.dir.startsWith(testEnvRoot()) ? "test-environments" : "workspace",
				});
			}
		}
		for (const ent of ents) {
			if (!ent.isDirectory()) continue;
			if (ent.name === "node_modules" || ent.name === "dist" || ent.name === "build" || ent.name === ".git" || ent.name === ".npm" || ent.name === ".local") continue;
			if (ent.name.startsWith(".") && ent.name !== ".test-environments") continue;
			await scanRegistered(join(current, ent.name), depth + 1);
		}
	}

	for (const r of roots) {
		await mkdir(r, { recursive: true }).catch(() => {});
		await scanRegistered(r, 0);
	}
	return out.sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * Build a docker-compose.test.yml from `docker compose config --format json`.
 * Offsets published ports, remaps ./data* binds to ./data-test/*, renames containers, labels dsh.test=1.
 */
async function generateOverlayYaml(dir, baseFile, slug) {
	const hostDir = toHostPath(dir);
	// Prefer reading compose via container path; project-dir must exist on host for bind resolution later.
	let cfg;
	try {
		const res = await docker([
			"compose",
			"--project-directory",
			hostDir,
			"-f",
			join(hostDir, baseFile),
			"config",
			"--format",
			"json",
		]);
		cfg = JSON.parse(res.stdout || "{}");
	} catch (err) {
		// Fallback: config with container path (may still parse services)
		try {
			const res = await docker([
				"compose",
				"--project-directory",
				dir,
				"-f",
				join(dir, baseFile),
				"config",
				"--format",
				"json",
			]);
			cfg = JSON.parse(res.stdout || "{}");
		} catch (err2) {
			throw new Error(`compose config failed: ${err2.message || err.message}`);
		}
	}

	const services = cfg.services || {};
	const networks = cfg.networks || {};
	const lines = [
		`# Generated by dsh-testenv — safe to edit.`,
		`# Project: ${projectNameForSlug(slug)}`,
		`# Ports offset +${PORT_OFFSET}; data under ./data-test/; labels dsh.test=1`,
		``,
	];

	const netNames = Object.keys(networks);
	if (netNames.length) {
		lines.push("networks:");
		for (const n of netNames) {
			const safe = `${slugify(slug)}-test`;
			lines.push(`  ${n}:`);
			lines.push(`    name: ${safe}`);
			lines.push(`    driver: bridge`);
		}
		lines.push("");
	}

	lines.push("services:");
	for (const [svc, def] of Object.entries(services)) {
		if (!def || typeof def !== "object") continue;
		lines.push(`  ${svc}:`);
		lines.push(`    container_name: ${slugify(slug)}-test-${svc}`);
		lines.push(`    labels:`);
		lines.push(`      - dsh.test=1`);
		lines.push(`      - dsh.test.stack=${slugify(slug)}`);
		lines.push(`      - wud.watch=false`);

		const ports = Array.isArray(def.ports) ? def.ports : [];
		if (ports.length) {
			lines.push(`    ports: !override`);
			for (const p of ports) {
				const mapped = remapPortEntry(p);
				if (mapped) lines.push(`      - "${mapped}"`);
			}
		}

		const vols = Array.isArray(def.volumes) ? def.volumes : [];
		const remapped = [];
		for (const v of vols) {
			const r = remapVolumeEntry(v, hostDir);
			if (r) remapped.push(r);
		}
		if (remapped.length) {
			lines.push(`    volumes: !override`);
			for (const v of remapped) {
				lines.push(`      - ${v}`);
			}
		}
	}

	return `${lines.join("\n")}\n`;
}

function remapPortEntry(p) {
	// compose config json: { target, published, protocol, mode } or string
	if (typeof p === "string") {
		const m = p.match(/^(?:[\d.]+:)?(\d+):(\d+)(?:\/(\w+))?$/);
		if (!m) return p;
		const host = Number(m[1]) + PORT_OFFSET;
		return `${host}:${m[2]}${m[3] ? `/${m[3]}` : ""}`;
	}
	if (p && typeof p === "object") {
		const target = p.target ?? p.Target;
		const published = p.published ?? p.Published;
		if (target == null) return null;
		if (published == null || published === "") return null;
		const host = Number(published) + PORT_OFFSET;
		const proto = p.protocol ? `/${p.protocol}` : "";
		return `${host}:${target}${proto}`;
	}
	return null;
}

function remapVolumeEntry(v, hostDir) {
	let src;
	let dst;
	let mode = "";
	if (typeof v === "string") {
		const parts = v.split(":");
		if (parts.length < 2) return null;
		src = parts[0];
		dst = parts[1];
		mode = parts[2] ? `:${parts[2]}` : "";
	} else if (v && typeof v === "object") {
		src = v.source || v.Source;
		dst = v.target || v.Target;
		if (v.read_only || v.ReadOnly) mode = ":ro";
	} else {
		return null;
	}
	if (!src || !dst) return null;

	// Named volumes — leave to base; only rewrite bind mounts that look like data dirs
	const isBind = src.startsWith(".") || src.startsWith("/") || src.startsWith(hostDir);
	if (!isBind) return null;

	let rel = src;
	if (src.startsWith(hostDir)) {
		rel = "." + src.slice(hostDir.length).replace(/\\/g, "/") || ".";
	}
	if (rel.startsWith("/containers/")) {
		rel = "./" + relative(hostDir, src).replace(/\\/g, "/");
	}

	const dataMatch = rel.match(/^\.\/data(?:-sandbox)?(\/.*)?$/);
	if (dataMatch) {
		const rest = dataMatch[1] || "";
		return `./data-test${rest}:${dst}${mode}`;
	}
	// Keep other binds relative to clone (code mounts stay on clone tree)
	if (rel.startsWith("./") || rel.startsWith("../")) {
		return `${rel}:${dst}${mode}`;
	}
	return null;
}

async function ensureOverlay(dir, { force = false } = {}) {
	const abs = assertAllowedComposeDir(dir);
	const baseFile = await findBaseCompose(abs);
	if (!baseFile) throw new Error("No docker-compose.yml in that folder");
	const dest = join(abs, TEST_COMPOSE);
	if (!force && (await fileExists(dest))) {
		return { overlayFile: TEST_COMPOSE, generated: false };
	}

	// Prefer adapting legacy sandbox overlay if present
	const legacy = join(abs, LEGACY_SANDBOX);
	if (await fileExists(legacy)) {
		let text = await readFile(legacy, "utf8");
		text = text
			.replace(/dsh\.sandbox=/g, "dsh.test=")
			.replace(/data-sandbox/g, "data-test")
			.replace(/-sandbox/g, "-test")
			.replace(/pchamp-sandbox/g, "pchamp-test")
			.replace(/SANDBOX_/g, "TEST_")
			.replace(/^(\s+)ports:\s*$/gm, "$1ports: !override")
			.replace(/^(\s+)volumes:\s*$/gm, "$1volumes: !override");
		// Sibling mounts from .test-environments/<slug> need an extra ../
		text = text.replace(
			/(^|\s)-\s+\.\.\/webscraper-html\//gm,
			"$1- ../../webscraper-html/",
		);
		text = `# Adapted from docker-compose.sandbox.yml by dsh-testenv\n${text}`;
		await writeFile(dest, text, "utf8");
		return { overlayFile: TEST_COMPOSE, generated: true, from: LEGACY_SANDBOX };
	}

	const slug = basename(abs);
	const yaml = await generateOverlayYaml(abs, baseFile, slug);
	await writeFile(dest, yaml, "utf8");
	return { overlayFile: TEST_COMPOSE, generated: true };
}

async function writeDbOverlay(dir, databaseUrl) {
	const abs = resolve(dir);
	const dest = join(abs, "docker-compose.test.db.yml");
	if (!databaseUrl) {
		try {
			await rm(dest, { force: true });
		} catch {
			/* */
		}
		return { overlayFile: null };
	}
	const yaml = `# Generated by dsh-testenv — wires app services to a cloned DB
services:
  api:
    environment:
      DATABASE_URL: "${databaseUrl.replace(/"/g, '\\"')}"
  importer:
    environment:
      DATABASE_URL: "${databaseUrl.replace(/"/g, '\\"')}"
`;
	await writeFile(dest, yaml, "utf8");
	return { overlayFile: "docker-compose.test.db.yml" };
}

/** Matches services whose resolved image is a well-known DB engine — used to skip
 * spinning up the compose file's own DB container when an external clone is wired in. */
const DB_IMAGE_RE = /(^|\/)(postgres|postgis|mysql|mariadb|mongo|redis)(:|@|$)/i;

async function detectDbImageServices(dir, baseFile) {
	const hostDir = toHostPath(dir);
	try {
		const res = await docker([
			"compose", "--project-directory", hostDir, "-f", join(hostDir, baseFile), "config", "--format", "json",
		]);
		const cfg = JSON.parse(res.stdout || "{}");
		const services = cfg.services || {};
		return Object.entries(services)
			.filter(([, def]) => DB_IMAGE_RE.test(String(def?.image || "")))
			.map(([svcName]) => svcName);
	} catch {
		return [];
	}
}

/** DB clone containers (dsh-database) live on the Harness's own networks, not the
 * test stack's compose network — so DNS resolution of the clone hostname fails
 * from inside the stack unless we explicitly connect it. */
function parseDbCloneContainer(databaseUrl) {
	try {
		const host = new URL(databaseUrl).hostname;
		if (/^dsh-dbclone-/.test(host)) return host;
	} catch { /* not a URL / not a clone */ }
	return null;
}

async function resolveComposeNetworks(dir, files) {
	const hostDir = toHostPath(dir);
	try {
		const res = await docker(["compose", "--project-directory", hostDir, ...files, "config", "--format", "json"]);
		const cfg = JSON.parse(res.stdout || "{}");
		return Object.values(cfg.networks || {}).map((n) => n && n.name).filter(Boolean);
	} catch {
		return [];
	}
}

async function connectCloneToNetworks(databaseUrl, networks) {
	const container = parseDbCloneContainer(databaseUrl);
	if (!container || !networks.length) return;
	for (const net of networks) {
		try {
			await docker(["network", "connect", net, container]);
		} catch {
			/* already connected, or network not found — non-fatal */
		}
	}
}

async function composeTest(dir, args, { databaseUrl } = {}) {
	const meta = await inspectTestEnv(dir);
	if (!meta) throw new Error("No compose file in that folder");
	let overlay = meta.overlayFile;
	if (!overlay || overlay === LEGACY_SANDBOX) {
		await ensureOverlay(dir);
		overlay = TEST_COMPOSE;
	}
	const hostDir = toHostPath(dir);
	const files = [
		"-f",
		join(hostDir, meta.baseFile),
		"-f",
		join(hostDir, overlay),
	];
	const extraArgs = [];
	if (databaseUrl) {
		await writeDbOverlay(dir, databaseUrl);
		files.push("-f", join(hostDir, "docker-compose.test.db.yml"));
		if (args[0] === "up") {
			// A DB clone is wired in via DATABASE_URL — don't also start the compose
			// file's own DB engine (unused, wastes RAM, and can confuse "is it working").
			const dbServices = await detectDbImageServices(dir, meta.baseFile);
			for (const svc of dbServices) extraArgs.push("--scale", `${svc}=0`);
		}
	} else if (await fileExists(join(dir, "docker-compose.test.db.yml"))) {
		files.push("-f", join(hostDir, "docker-compose.test.db.yml"));
	}
	const full = [
		"compose",
		"--project-directory",
		hostDir,
		"-p",
		meta.project,
		...files,
		...args,
		...extraArgs,
	];
	const result = await docker(full);
	if (databaseUrl && args[0] === "up") {
		const networks = await resolveComposeNetworks(dir, files);
		await connectCloneToNetworks(databaseUrl, networks);
	}
	return result;
}

async function cloneRepo(url, slug) {
	if (!/^(https?:\/\/|git@|ssh:\/\/)/i.test(url)) {
		throw new Error("URL must be https://, git@, or ssh://");
	}
	const root = testEnvRoot();
	await mkdir(root, { recursive: true });
	await mkdir(testEnvHostRoot(), { recursive: true });
	const nameHint = slugify(slug || repoNameFromUrl(url));
	const target = join(root, nameHint);
	if (await fileExists(target)) {
		throw new Error(`test env already exists: ${nameHint}`);
	}
	await git(["clone", "--", url, nameHint], { cwd: root });
	const meta = await inspectTestEnv(target);
	if (!meta) {
		throw new Error("Clone succeeded but no docker-compose.yml found — add compose or pick another repo");
	}
	await ensureOverlay(target);
	return inspectTestEnv(target);
}

async function cloneDataDirs(liveDir, testDir) {
	const live = assertUnderContainers(liveDir);
	const dest = assertUnderTestRoot(testDir);
	const pairs = [
		["data/postgres", "data-test/postgres"],
		["data/chroma", "data-test/chroma"],
		["data/meta-usage", "data-test/meta-usage"],
		["api/data/meta-usage", "data-test/meta-usage"],
		["data-sandbox/postgres", "data-test/postgres"],
		["data-sandbox/chroma", "data-test/chroma"],
	];
	const copied = [];
	for (const [fromRel, toRel] of pairs) {
		const from = join(live, fromRel);
		const to = join(dest, toRel);
		if (!(await fileExists(from))) continue;
		await mkdir(dirname(to), { recursive: true });
		if (await fileExists(to)) {
			copied.push({ from: fromRel, to: toRel, skipped: true });
			continue;
		}
		await cp(from, to, { recursive: true });
		copied.push({ from: fromRel, to: toRel, skipped: false });
	}
	return { copied };
}

function registerRpc(ctx) {
	return ctx.connection.rpc.handle(
		RPC_CHANNEL,
		async (endpointName, payload) => {
			try {
				switch (endpointName) {
					case "roots": {
						return ok({
							containersRoot: containersRoot(),
							containersHostRoot: containersHostRoot(),
							testEnvRoot: testEnvRoot(),
							testEnvHostRoot: testEnvHostRoot(),
							portOffset: PORT_OFFSET,
						});
					}
					case "listLive": {
						return ok({ stacks: await listLiveStacks() });
					}
					case "list": {
						const cwd = typeof payload?.workspaceCwd === "string" ? payload.workspaceCwd.trim() : "";
						return ok({ envs: await listTestEnvs(cwd) });
					}
					case "candidates": {
						const cwd = typeof payload?.workspaceCwd === "string" ? payload.workspaceCwd.trim() : "";
						return ok({ candidates: await listCandidates(cwd) });
					}
					case "register": {
						const codePath = assertAllowedComposeDir(payload?.codePath || payload?.dir);
						const meta0 = await inspectTestEnv(codePath);
						if (!meta0) throw new Error("No docker-compose.yml in that code folder");
						await ensureOverlay(codePath);
						const databaseUrl = typeof payload?.databaseUrl === "string"
							? payload.databaseUrl.trim()
							: "";
						if (databaseUrl) await writeDbOverlay(codePath, databaseUrl);
						await writeFile(
							join(codePath, REGISTER_MARKER),
							`${JSON.stringify({
								registeredAt: new Date().toISOString(),
								databaseUrl: databaseUrl || null,
							}, null, 2)}\n`,
							"utf8",
						);
						const meta = await inspectTestEnv(codePath);
						return ok({ env: meta, databaseUrl: databaseUrl || null });
					}
					case "create": {
						const url = typeof payload?.url === "string" ? payload.url.trim() : "";
						const fromLive = typeof payload?.fromLive === "string" ? payload.fromLive.trim() : "";
						let cloneUrl = url;
						let slug = typeof payload?.slug === "string" ? payload.slug.trim() : "";
						if (fromLive) {
							const stacks = await listLiveStacks();
							const hit = stacks.find((s) => s.slug === fromLive || s.dir === fromLive);
							if (!hit) throw new Error(`unknown live stack: ${fromLive}`);
							if (!hit.remote) throw new Error(`${hit.slug} has no git remote origin`);
							cloneUrl = hit.remote;
							if (!slug) slug = `${hit.slug}-dev`;
						}
						if (!cloneUrl) throw new Error("url or fromLive required");
						const env = await cloneRepo(cloneUrl, slug);
						let dataCopy = null;
						if (payload?.copyDataFrom) {
							dataCopy = await cloneDataDirs(payload.copyDataFrom, env.dir);
						} else if (fromLive) {
							const stacks = await listLiveStacks();
							const hit = stacks.find((s) => s.slug === fromLive || s.dir === fromLive);
							if (hit && payload?.copyData !== false) {
								dataCopy = await cloneDataDirs(hit.dir, env.dir);
							}
						}
						return ok({ env, dataCopy });
					}
					case "ensureOverlay": {
						const dir = assertAllowedComposeDir(payload?.dir || join(testEnvRoot(), payload?.slug || ""));
						const res = await ensureOverlay(dir, { force: !!payload?.force });
						return ok({ ...res, env: await inspectTestEnv(dir) });
					}
					case "up":
					case "down": {
						const dir = assertAllowedComposeDir(
							payload?.dir || join(testEnvRoot(), String(payload?.slug || "")),
						);
						await ensureOverlay(dir);
						const databaseUrl = typeof payload?.databaseUrl === "string"
							? payload.databaseUrl.trim()
							: "";
						const action = endpointName === "up"
							? ["up", "-d", "--build"]
							: ["down"];
						const res = await composeTest(dir, action, { databaseUrl: databaseUrl || undefined });
						const meta = await inspectTestEnv(dir);
						return ok({
							action: endpointName,
							project: meta?.project,
							dir,
							hostDir: toHostPath(dir),
							stdout: (res.stdout || "").slice(-4000),
							stderr: (res.stderr || "").slice(-2000),
							env: meta,
						});
					}
					case "destroy": {
						const dir = assertAllowedComposeDir(
							payload?.dir || join(testEnvRoot(), String(payload?.slug || "")),
						);
						try {
							await composeTest(dir, ["down", "-v"]);
						} catch {
							/* may already be down / no overlay */
						}
						if (payload?.deleteFiles) {
							await rm(dir, { recursive: true, force: true });
						}
						return ok({ destroyed: true, dir, deletedFiles: !!payload?.deleteFiles });
					}
					case "copyData": {
						const live = assertUnderContainers(payload?.from);
						const dest = assertUnderTestRoot(payload?.to || join(testEnvRoot(), payload?.slug || ""));
						const res = await cloneDataDirs(live, dest);
						return ok(res);
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpointName}`));
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
			scope.effect(() => registerRpc(scope), "dsh-testenv: rpc");
		});
	});
}

export { apply, name };

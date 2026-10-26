import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join, resolve } from "node:path";
import { homedir } from "node:os";
import { LEGACY_GLOBAL_DOWNLOAD_DIR } from "./workspace.js";

export const PLUGIN = "dsh-torrent";
export const RPC_CHANNEL = "/torrent";
/** aria2 global default; per-download `dir` is set per workspace. */
export const ARIA2_PROCESS_DIR = "/workspace";

/** @type {import('node:child_process').ChildProcess | null} */
let aria2Proc = null;
let starting = false;

function pluginsDataDir() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", PLUGIN);
}

function configPath() {
	return join(pluginsDataDir(), "config.json");
}

function sessionPath() {
	return join(pluginsDataDir(), "aria2.session");
}

/** @typedef {{ downloadDir: string | null, rpcPort: number, rpcSecret: string }} TorrentConfig */

/** @returns {Promise<TorrentConfig>} */
export async function loadConfig() {
	const dir = pluginsDataDir();
	await mkdir(dir, { recursive: true });
	let raw;
	try {
		raw = JSON.parse(await readFile(configPath(), "utf8"));
	} catch {
		raw = {};
	}
	let downloadDir = null;
	if (typeof raw.downloadDir === "string") {
		const candidate = raw.downloadDir.trim();
		if (candidate && candidate !== LEGACY_GLOBAL_DOWNLOAD_DIR) {
			downloadDir = normalizeDownloadDir(candidate);
		}
	}
	const rpcPort = clampInt(raw.rpcPort, 6800, 65000, 16800);
	let rpcSecret = typeof raw.rpcSecret === "string" ? raw.rpcSecret.trim() : "";
	if (!rpcSecret) {
		rpcSecret = randomBytes(24).toString("hex");
		await saveConfig({ downloadDir, rpcPort, rpcSecret });
	}
	return { downloadDir, rpcPort, rpcSecret };
}

/** @param {TorrentConfig} cfg */
export async function saveConfig(cfg) {
	await mkdir(pluginsDataDir(), { recursive: true });
	const next = {
		rpcPort: clampInt(cfg.rpcPort, 6800, 65000, 16800),
		rpcSecret: String(cfg.rpcSecret || "").trim() || randomBytes(24).toString("hex"),
	};
	if (cfg.downloadDir) {
		next.downloadDir = normalizeDownloadDir(cfg.downloadDir);
	}
	await writeFile(configPath(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return { downloadDir: next.downloadDir ?? null, rpcPort: next.rpcPort, rpcSecret: next.rpcSecret };
}

/**
 * @param {string} dir
 */
export function normalizeDownloadDir(dir) {
	const resolved = resolve(String(dir || "").trim());
	if (!resolved) throw new Error("download directory is required");
	const workspace = resolve("/workspace");
	if (resolved === workspace || resolved.startsWith(`${workspace}/`)) return resolved;
	throw new Error(`download directory must be under /workspace (got ${resolved})`);
}

function clampInt(value, min, max, fallback) {
	const n = Number(value);
	if (!Number.isFinite(n)) return fallback;
	return Math.min(max, Math.max(min, Math.round(n)));
}

async function sleep(ms) {
	await new Promise((r) => setTimeout(r, ms));
}

/**
 * @param {TorrentConfig} cfg
 * @param {string} method
 * @param {unknown[]} params
 */
export async function aria2Rpc(cfg, method, params = []) {
	const token = `token:${cfg.rpcSecret}`;
	const res = await fetch(`http://127.0.0.1:${cfg.rpcPort}/jsonrpc`, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify({
			jsonrpc: "2.0",
			id: "dsh-torrent",
			method: `aria2.${method}`,
			params: [token, ...params],
		}),
		signal: AbortSignal.timeout(30_000),
	});
	if (!res.ok) throw new Error(`aria2 RPC HTTP ${res.status}`);
	const json = await res.json();
	if (json.error) {
		throw new Error(json.error.message || `aria2 error ${json.error.code}`);
	}
	return json.result;
}

/**
 * @param {TorrentConfig} cfg
 */
export async function ensureAria2(cfg) {
	if (aria2Proc && aria2Proc.exitCode === null && !aria2Proc.killed) {
		try {
			await aria2Rpc(cfg, "getVersion", []);
			return;
		} catch {
			/* restart */
		}
	}
	if (starting) {
		for (let i = 0; i < 40; i++) {
			await sleep(150);
			try {
				await aria2Rpc(cfg, "getVersion", []);
				return;
			} catch {
				/* wait */
			}
		}
		throw new Error("aria2 is still starting");
	}
	starting = true;
	try {
		await mkdir(ARIA2_PROCESS_DIR, { recursive: true });
		await mkdir(pluginsDataDir(), { recursive: true });
		try {
			await access(sessionPath(), fsConstants.F_OK);
		} catch {
			await writeFile(sessionPath(), "", "utf8");
		}
		const args = [
			"--enable-rpc",
			`--rpc-listen-port=${cfg.rpcPort}`,
			`--rpc-secret=${cfg.rpcSecret}`,
			`--dir=${ARIA2_PROCESS_DIR}`,
			"--continue=true",
			"--max-concurrent-downloads=5",
			"--allow-overwrite=true",
			"--auto-file-renaming=true",
			`--save-session=${sessionPath()}`,
			`--input-file=${sessionPath()}`,
			"--save-session-interval=30",
			"--daemon=false",
			"--quiet=true",
		];
		aria2Proc = spawn("aria2c", args, {
			stdio: "ignore",
			detached: false,
		});
		aria2Proc.on("exit", () => {
			aria2Proc = null;
		});
		for (let i = 0; i < 50; i++) {
			await sleep(100);
			try {
				await aria2Rpc(cfg, "getVersion", []);
				return;
			} catch {
				/* retry */
			}
		}
		throw new Error("aria2 failed to start (is aria2c installed?)");
	} finally {
		starting = false;
	}
}

/**
 * @param {Record<string, unknown>} row
 */
export function mapDownload(row) {
	const total = Number(row.totalLength || 0);
	const completed = Number(row.completedLength || 0);
	const pct = total > 0 ? Math.min(100, Math.round((completed / total) * 100)) : 0;
	const files = Array.isArray(row.files)
		? row.files.map((f) => {
				const path = f?.path;
				const name = Array.isArray(path) ? path.join("/") : String(path || "");
				return { path: name, length: Number(f?.length || 0) };
			})
		: [];
	const dir = typeof row.dir === "string" ? row.dir : "";
	return {
		gid: String(row.gid || ""),
		status: String(row.status || "unknown"),
		name: files[0]?.path?.split("/").pop() || dir || String(row.gid || ""),
		progressPercent: pct,
		totalLength: total,
		completedLength: completed,
		downloadSpeed: Number(row.downloadSpeed || 0),
		uploadSpeed: Number(row.uploadSpeed || 0),
		dir,
		files,
		errorMessage: row.errorMessage ? String(row.errorMessage) : undefined,
	};
}

const DOWNLOAD_KEYS = [
	"gid",
	"status",
	"totalLength",
	"completedLength",
	"downloadSpeed",
	"uploadSpeed",
	"files",
	"dir",
	"errorMessage",
];

/**
 * @param {TorrentConfig} cfg
 * @param {'active' | 'waiting' | 'stopped'} which
 */
export async function listDownloads(cfg, which) {
	await ensureAria2(cfg);
	let rows;
	if (which === "active") {
		rows = await aria2Rpc(cfg, "tellActive", [DOWNLOAD_KEYS]);
	} else {
		const method = which === "waiting" ? "tellWaiting" : "tellStopped";
		const num = which === "stopped" ? 50 : 100;
		rows = await aria2Rpc(cfg, method, [0, num, DOWNLOAD_KEYS]);
	}
	return (Array.isArray(rows) ? rows : []).map(mapDownload);
}

/**
 * @param {TorrentConfig} cfg
 * @param {string[]} uris
 * @param {{ dir?: string, targetDir: string }} opts
 */
export async function addDownloads(cfg, uris, opts) {
	await ensureAria2(cfg);
	const clean = uris.map((u) => String(u || "").trim()).filter(Boolean);
	if (clean.length === 0) throw new Error("at least one URI is required");
	const base = normalizeDownloadDir(opts.targetDir);
	await mkdir(base, { recursive: true });
	let dest = base;
	if (opts.dir) {
		const sub = String(opts.dir).replace(/^\/+/, "");
		dest = join(base, sub);
		await mkdir(dest, { recursive: true });
	}
	const gid = await aria2Rpc(cfg, "addUri", [clean, { dir: dest }]);
	return { gid: String(gid), uris: clean, dir: dest };
}

export function stopAria2() {
	if (aria2Proc && !aria2Proc.killed) {
		try {
			aria2Proc.kill("SIGTERM");
		} catch {
			/* ignore */
		}
	}
	aria2Proc = null;
}

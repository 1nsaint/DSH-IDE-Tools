import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { randomUUID } from "node:crypto";

export function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-ssh-workspace.json");
}

export function defaultConfig() {
	return { hosts: [], bindings: [] };
}

export function normalizeHost(raw, fallbackId) {
	if (!raw || typeof raw !== "object") return null;
	const id = String(raw.id || fallbackId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-");
	if (!id) return null;
	const label = String(raw.label || id).trim() || id;
	const user = String(raw.user || "").trim();
	const hostname = String(raw.hostname || raw.host || "").trim();
	if (!user || !hostname) return null;
	const identityFile = typeof raw.identityFile === "string" ? raw.identityFile.trim() : "";
	const port = Number(raw.port) > 0 ? Number(raw.port) : 22;
	return { id, label, user, hostname, port, identityFile };
}

export async function loadConfig() {
	try {
		const raw = JSON.parse(await readFile(configPath(), "utf8"));
		const hosts = Array.isArray(raw.hosts)
			? raw.hosts.map((h, i) => normalizeHost(h, `host-${i}`)).filter(Boolean)
			: [];
		const bindings = Array.isArray(raw.bindings)
			? raw.bindings.map((b) => ({
				workspaceId: String(b.workspaceId || "").trim(),
				hostId: String(b.hostId || "").trim(),
				remotePath: String(b.remotePath || "").trim(),
				label: String(b.label || "").trim(),
			})).filter((b) => b.workspaceId && b.hostId && b.remotePath)
			: [];
		return { hosts, bindings };
	} catch {
		return defaultConfig();
	}
}

export async function saveConfig(cfg) {
	const path = configPath();
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, JSON.stringify(cfg, null, 2) + "\n", "utf8");
}

export function newHostId(label) {
	const base = String(label || "host").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "host";
	return `${base}-${randomUUID().slice(0, 8)}`;
}

export function bindingForWorkspace(cfg, workspaceId) {
	return cfg.bindings.find((b) => b.workspaceId === workspaceId) || null;
}

export function bindingForPath(cfg, path) {
	const p = String(path || "");
	return cfg.bindings.find((b) => {
		const virtual = makeDsshPath(b.hostId, b.remotePath);
		return p === virtual || p.startsWith(virtual + "/");
	}) || null;
}

export function makeDsshPath(hostId, remotePath) {
	const p = String(remotePath || "").replace(/\/+$/, "") || "/";
	return `dssh://${hostId}${p.startsWith("/") ? p : `/${p}`}`;
}

export function parseDsshPath(path) {
	const m = /^dssh:\/\/([^/]+)(\/.*)?$/.exec(String(path || "").trim());
	if (!m) return null;
	return { hostId: m[1], remotePath: m[2] || "/" };
}

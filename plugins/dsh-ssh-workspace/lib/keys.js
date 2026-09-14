import { mkdir, writeFile, unlink } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

export function dshHome() {
	return process.env.DSH_HOME || join(homedir(), ".dsh");
}

/** Persisted on the host via the $DSH_HOME bind mount (e.g. ./data/home → /home/node/.dsh). */
export function sshKeysDir() {
	return join(dshHome(), "ssh");
}

export function hostKeyPath(hostId) {
	const id = String(hostId || "").trim().replace(/[^a-zA-Z0-9_-]/g, "-");
	return join(sshKeysDir(), `${id}.key`);
}

export async function ensureSshDirs() {
	await mkdir(sshKeysDir(), { recursive: true, mode: 0o700 });
}

export async function persistHostKey(host) {
	if (!host?.privateKey) return host;
	await ensureSshDirs();
	const path = hostKeyPath(host.id);
	const body = host.privateKey.endsWith("\n") ? host.privateKey : `${host.privateKey}\n`;
	await writeFile(path, body, { mode: 0o600 });
	return { ...host, identityFile: path, privateKey: "" };
}

export async function removeHostKey(hostId) {
	try {
		await unlink(hostKeyPath(hostId));
	} catch {
		/* ignore missing */
	}
}

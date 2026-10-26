import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const DEFAULT_CDP_HTTP = "http://192.168.0.130:9222";

function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-browser.json");
}

function defaultConfig() {
	return {
		engine: "builtin", // "builtin" | "remote"
		cdpHttp: DEFAULT_CDP_HTTP,
	};
}

function normalizeConfig(raw) {
	const base = defaultConfig();
	if (!raw || typeof raw !== "object") return base;
	const engine = raw.engine === "remote" ? "remote" : "builtin";
	let cdpHttp = String(raw.cdpHttp || raw.baseUrl || base.cdpHttp).trim() || base.cdpHttp;
	cdpHttp = cdpHttp.replace(/\/+$/, "");
	try {
		const u = new URL(cdpHttp);
		if (u.protocol !== "http:" && u.protocol !== "https:") {
			cdpHttp = base.cdpHttp;
		}
	} catch {
		cdpHttp = base.cdpHttp;
	}
	return { engine, cdpHttp };
}

async function loadConfig() {
	try {
		const raw = JSON.parse(await readFile(configPath(), "utf8"));
		return normalizeConfig(raw);
	} catch {
		return defaultConfig();
	}
}

async function saveConfig(partial) {
	const next = normalizeConfig({ ...(await loadConfig()), ...partial });
	const path = configPath();
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
	return next;
}

export { DEFAULT_CDP_HTTP, configPath, defaultConfig, loadConfig, saveConfig, normalizeConfig };

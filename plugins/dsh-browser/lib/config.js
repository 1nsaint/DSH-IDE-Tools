import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

/** Example only — never used as a live default (user CDP lives in plugins-data). */
const CDP_HTTP_PLACEHOLDER = "http://127.0.0.1:9222";

function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-browser.json");
}

function defaultConfig() {
	return {
		engine: "builtin", // "builtin" | "remote"
		cdpHttp: "",
	};
}

/**
 * @param {unknown} raw
 * @returns {{ engine: "builtin" | "remote", cdpHttp: string }}
 */
function normalizeConfig(raw) {
	const base = defaultConfig();
	if (!raw || typeof raw !== "object") return base;
	const o = /** @type {Record<string, unknown>} */ (raw);
	let cdpHttp = String(o.cdpHttp || o.baseUrl || "").trim().replace(/\/+$/, "");
	if (cdpHttp) {
		try {
			const u = new URL(cdpHttp);
			if (u.protocol !== "http:" && u.protocol !== "https:") {
				cdpHttp = "";
			}
		} catch {
			cdpHttp = "";
		}
	}
	let engine = o.engine === "remote" ? "remote" : "builtin";
	// Remote without a CDP URL cannot work — fall back to builtin.
	if (engine === "remote" && !cdpHttp) {
		engine = "builtin";
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

/** @deprecated alias for CDP_HTTP_PLACEHOLDER */
const DEFAULT_CDP_HTTP = CDP_HTTP_PLACEHOLDER;

export {
	CDP_HTTP_PLACEHOLDER,
	DEFAULT_CDP_HTTP,
	configPath,
	defaultConfig,
	loadConfig,
	saveConfig,
	normalizeConfig,
};

/**
 * dsh-plugin-list-filter — host half.
 *
 * Returns custom plugin ids and short descriptions for the Settings plugin list.
 */
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";

const name = "dsh-plugin-list-filter";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/plugin-list-filter";
const DSH_HOME = process.env.DSH_HOME || "/home/node/.dsh";
const PLUGINS_DIR = path.join(DSH_HOME, "plugins");
const PROFILE_PATCH = path.join(DSH_HOME, "profiles/web/cordis.patch.yml");
const UPSTREAM_NM = "/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules";

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

/**
 * @param {string} moduleName
 */
function moduleShortName(moduleName) {
	return String(moduleName || "")
		.replace(/^@deepseek-ai\//, "")
		.replace(/^cordis:/, "")
		.replace(/^cordis-plugin-/, "")
		.replace(/^dsh-(?:host-|client-)?/, "");
}

/**
 * @param {string} file
 */
async function idsFromPatch(file) {
	/** @type {Set<string>} */
	const ids = new Set();
	let text;
	try {
		text = await readFile(file, "utf8");
	} catch {
		return ids;
	}
	for (const m of text.matchAll(/^\s*-\s+id:\s*(\S+)/gm)) {
		ids.add(m[1].replace(/^['"]|['"]$/g, ""));
	}
	for (const m of text.matchAll(/^\s*name:\s*(dsh-[^\s#]+)/gm)) {
		ids.add(m[1].replace(/^['"]|['"]$/g, ""));
	}
	for (const m of text.matchAll(/^\s*-\s+name:\s*(dsh-[^\s#]+)/gm)) {
		ids.add(m[1].replace(/^['"]|['"]$/g, ""));
	}
	return ids;
}

/**
 * @param {string} pkgPath
 */
async function readPackageMeta(pkgPath) {
	try {
		const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
		const description = typeof pkg.description === "string" ? pkg.description.trim() : "";
		const pkgName = typeof pkg.name === "string" ? pkg.name.trim() : "";
		return { description, name: pkgName };
	} catch {
		return { description: "", name: "" };
	}
}

/**
 * @param {Record<string, string>} map
 * @param {string} key
 * @param {string} description
 */
function putDesc(map, key, description) {
	const k = String(key || "").trim();
	const d = String(description || "").trim();
	if (!k || !d || map[k]) return;
	map[k] = d;
}

/**
 * @param {Record<string, string>} map
 * @param {string} pkgName
 * @param {string} description
 */
function indexPackageName(map, pkgName, description) {
	if (!pkgName || !description) return;
	putDesc(map, pkgName, description);
	putDesc(map, moduleShortName(pkgName), description);
	const base = pkgName.includes("/") ? pkgName.slice(pkgName.lastIndexOf("/") + 1) : pkgName;
	putDesc(map, base, description);
}

/**
 * @param {string} root
 * @param {Record<string, string>} map
 */
async function indexPackagesInDir(root, map) {
	let ents;
	try {
		ents = await readdir(root, { withFileTypes: true });
	} catch {
		return;
	}
	for (const ent of ents) {
		if (!ent.isDirectory() || ent.name.startsWith(".")) continue;
		const { description, name: pkgName } = await readPackageMeta(path.join(root, ent.name, "package.json"));
		if (!description) continue;
		indexPackageName(map, pkgName || ent.name, description);
		putDesc(map, ent.name, description);
	}
}

/**
 * @returns {Promise<string[]>}
 */
async function collectCustomIds() {
	/** @type {Set<string>} */
	const ids = new Set();
	try {
		const ents = await readdir(PLUGINS_DIR, { withFileTypes: true });
		for (const ent of ents) {
			if (ent.isDirectory() && ent.name && !ent.name.startsWith(".")) ids.add(ent.name);
		}
	} catch (err) {
		console.warn(`[${name}] readdir ${PLUGINS_DIR} failed:`, err instanceof Error ? err.message : err);
	}
	for (const id of await idsFromPatch(PROFILE_PATCH)) ids.add(id);
	return [...ids].sort((a, b) => a.localeCompare(b));
}

/**
 * @returns {Promise<Record<string, string>>}
 */
async function collectDescriptions() {
	/** @type {Record<string, string>} */
	const map = {};

	await indexPackagesInDir(PLUGINS_DIR, map);
	await indexPackagesInDir(path.join(UPSTREAM_NM, "@deepseek-ai"), map);
	await indexPackagesInDir(UPSTREAM_NM, map);

	// cordis.patch id aliases → folder descriptions (e.g. web-search-router → dsh-web-search-router)
	try {
		const text = await readFile(PROFILE_PATCH, "utf8");
		const blocks = text.split(/^\s*-\s+id:/gm).slice(1);
		for (const block of blocks) {
			const idMatch = block.match(/^(\S+)/);
			const nameMatch = block.match(/^\s*name:\s*(dsh-[^\s#]+)/m);
			if (!idMatch || !nameMatch) continue;
			const id = idMatch[1].replace(/^['"]|['"]$/g, "");
			const folder = nameMatch[1].replace(/^['"]|['"]$/g, "");
			if (map[folder] && !map[id]) map[id] = map[folder];
		}
	} catch { /* ignore */ }

	return map;
}

/**
 * @param {any} ctx
 */
function registerRpc(ctx) {
	const dispose = registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint) => {
			try {
				switch (endpoint) {
					case "customIds":
						return ok({
							ids: await collectCustomIds(),
							generatedAt: Date.now(),
						});
					case "catalogMeta":
						return ok({
							ids: await collectCustomIds(),
							descriptions: await collectDescriptions(),
							generatedAt: Date.now(),
						});
					default:
						return transportError(new Error(`dsh-plugin-list-filter unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" },
	);
	return () => dispose();
}

/**
 * @param {any} ctx
 */
function apply(ctx) {
	ctx.inject(["connection", "webServer"], (connectionCtx) => {
		connectionCtx.effect(() => registerRpc(connectionCtx), `${name}: rpc`);
	});
}

export { apply, name, collectCustomIds, collectDescriptions, moduleShortName, inject };

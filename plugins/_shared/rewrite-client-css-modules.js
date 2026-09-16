#!/usr/bin/env node
/**
 * Rewrite ModuleLoader client.js files to use hash-agnostic CSS-module selectors.
 *
 * Usage:
 *   node plugins/_shared/rewrite-client-css-modules.js              # all plugins/*/lib/client.js
 *   node plugins/_shared/rewrite-client-css-modules.js path/to/client.js ...
 *   node plugins/_shared/rewrite-client-css-modules.js --check       # dry-run + syntax check only report
 */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { rewriteClientSource } from "./css-modules.js";

const here = dirname(fileURLToPath(import.meta.url));
const pluginsRoot = join(here, "..");
const args = process.argv.slice(2).filter((a) => a !== "--check");
const checkOnly = process.argv.includes("--check");

function allClients() {
	return readdirSync(pluginsRoot, { withFileTypes: true })
		.filter((d) => d.isDirectory() && d.name.startsWith("dsh-"))
		.map((d) => join(pluginsRoot, d.name, "lib", "client.js"))
		.filter((p) => {
			try {
				readFileSync(p);
				return true;
			} catch {
				return false;
			}
		});
}

const targets = args.length ? args : allClients();
const hashRe = /(?:bhn1Oq_|qDHVXG_|YDXeBa_|hHd-Xa_|wSkVaW_|uV2eYG_)/g;
let failed = 0;

for (const path of targets) {
	const before = readFileSync(path, "utf8");
	const after = rewriteClientSource(before);
	if (after === before) {
		const left = (before.match(hashRe) || []).length;
		console.log(`= ${path} (unchanged, ${left} hash literals left)`);
		continue;
	}
	if (!checkOnly) writeFileSync(path, after);
	const check = spawnSync("node", ["--check", checkOnly ? path : path], {
		encoding: "utf8",
		input: checkOnly ? after : undefined,
	});
	// node --check needs a file; write to temp if checkOnly
	if (checkOnly) {
		const tmp = path + ".rewrite-tmp.js";
		writeFileSync(tmp, after);
		const r = spawnSync("node", ["--check", tmp], { encoding: "utf8" });
		spawnSync("rm", ["-f", tmp]);
		if (r.status !== 0) {
			console.error(`FAIL syntax ${path}\n${r.stderr}`);
			failed++;
			continue;
		}
	} else {
		const r = spawnSync("node", ["--check", path], { encoding: "utf8" });
		if (r.status !== 0) {
			writeFileSync(path, before);
			console.error(`FAIL syntax (reverted) ${path}\n${r.stderr}`);
			failed++;
			continue;
		}
	}
	const left = (after.match(hashRe) || []).length;
	console.log(`* ${path} → ${left} hash literals left`);
}

process.exit(failed ? 1 : 0);

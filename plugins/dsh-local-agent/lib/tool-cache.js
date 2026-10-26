import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { PLUGIN } from "./config.js";

/** @type {Map<string, number>} */
const sessionRefCounters = new Map();

function dshHome() {
	return process.env.DSH_HOME || join(homedir(), ".dsh");
}

export function toolCacheRoot() {
	return join(dshHome(), "plugins-data", PLUGIN, "tool-cache");
}

/**
 * @param {string} sessionId
 * @param {string} toolName
 * @param {string} text
 * @returns {Promise<{ ref: string, absPath: string, relHint: string }>}
 */
export async function persistToolCache(sessionId, toolName, text) {
	const safeSession = String(sessionId).replace(/[^\w.-]+/g, "_");
	const n = (sessionRefCounters.get(safeSession) ?? 0) + 1;
	sessionRefCounters.set(safeSession, n);
	const ref = String(n).padStart(4, "0");
	const safeTool = String(toolName).replace(/[^\w.-]+/g, "_").slice(0, 48) || "tool";
	const fileName = `${ref}-${safeTool}.txt`;
	const dir = join(toolCacheRoot(), safeSession);
	const absPath = join(dir, fileName);
	await mkdir(dir, { recursive: true });
	await writeFile(absPath, text, "utf8");
	const relHint = `plugins-data/${PLUGIN}/tool-cache/${safeSession}/${fileName}`;
	return { ref, absPath, relHint };
}

/**
 * @param {object} p
 * @param {string} p.toolName
 * @param {string} p.ref
 * @param {string} p.absPath
 * @param {string} p.relHint
 * @param {number} p.charCount
 */
/**
 * @param {object} p
 * @param {string} p.toolName
 * @param {string} p.ref
 * @param {string} p.absPath
 * @param {string} p.relHint
 * @param {number} p.charCount
 * @param {string} [p.preview]
 */
export function formatToolResultStub({ toolName, ref, absPath, relHint, charCount, preview }) {
	const lines = [
		`[${PLUGIN}: tool result ${ref} · ${toolName} · ${charCount} chars omitted from model context]`,
		`Cached on host: ${absPath}`,
		`(under DSH home: ${relHint})`,
	];
	if (preview) {
		lines.push("", "--- short preview (already handled; full body on host) ---", preview.slice(0, 500));
	}
	lines.push("Re-fetch with read on that path, or run the tool again if you need the full body.");
	return lines.join("\n");
}

/**
 * Pull a compact ref list out of a browser_snapshot JSON body so stubs stay usable.
 * @param {string} text
 */
export function previewBrowserSnapshot(text) {
	try {
		const data = JSON.parse(text);
		const snap = data?.snapshot || data;
		const items = Array.isArray(snap?.items) ? snap.items : null;
		if (!items) return "";
		const lines = [
			`url: ${snap.url || ""}`,
			`title: ${snap.title || ""}`,
			`refs (${items.length}) — click ONLY these:`,
		];
		for (const it of items) {
			const t = String(it.text || "").replace(/\s+/g, " ").trim().slice(0, 50);
			const href = it.href ? ` → ${String(it.href).slice(0, 70)}` : "";
			lines.push(`${it.ref} ${it.tag || ""}${t ? ` "${t}"` : ""}${href}`);
		}
		return lines.join("\n");
	} catch {
		return "";
	}
}

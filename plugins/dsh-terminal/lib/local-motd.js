/**
 * One-shot welcome banner for local (Harness) PTY sessions — plain text for client tokenizers.
 */
import { basename, resolve } from "node:path";

function workspaceLabel(ctx, sessionId, cwd) {
	if (typeof sessionId === "string" && sessionId.trim()) {
		try {
			const sessions = ctx.get?.("sessions");
			const session = sessions?.get?.(sessionId.trim());
			const h = session?.header;
			const name = h?.title || h?.name || h?.label;
			if (typeof name === "string" && name.trim()) return name.trim();
		} catch {
			/* ignore */
		}
	}
	const base = basename(resolve(cwd || "/workspace"));
	return base && base !== "." ? base : "workspace";
}

function shortPath(cwd) {
	try {
		const home = process.env.HOME || "/home/node";
		const r = resolve(cwd || home);
		if (r.startsWith(home)) return `~${r.slice(home.length) || ""}` || "~";
		return r;
	} catch {
		return String(cwd || "");
	}
}

/**
 * @param {{ ctx: object, sessionId?: string, cwd: string, cols?: number }} opts
 * @returns {string}
 */
export function buildLocalMotd(opts) {
	const { ctx, sessionId, cwd, cols = 80 } = opts;
	const label = workspaceLabel(ctx, sessionId, cwd);
	const path = shortPath(cwd);
	const nodeVer = process.version;
	const width = Math.min(Math.max(cols, 52), 100);

	const lines = [
		"DeepSeek Harness — local terminal",
		"",
		` * Workspace: ${label}  (${path})`,
		` * Node ${nodeVer} · true color · npm prefix ~/.local (persists on /workspace)`,
		" * Commands sidebar — insert snippets at the prompt (Enter to run)",
		"",
	];

	const bar = "─".repeat(Math.max(20, Math.min(width - 4, 72)));
	const body = lines.map((l) => (l === "" ? "" : l)).join("\r\n");
	return `\r\n${bar}\r\n${body}\r\n${bar}\r\n\r\n`;
}

export function localMotdEnabled() {
	const v = String(process.env.DSH_TERMINAL_MOTD ?? "1").trim().toLowerCase();
	return v !== "0" && v !== "false" && v !== "off";
}

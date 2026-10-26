import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

export const PLUGIN = "dsh-local-agent";
export const RPC_CHANNEL = "/local-agent";
export const STORE_FILE = "dsh-local-agent.json";

/** @typedef {'lite' | 'balanced' | 'jetson' | 'full' | 'custom'} PresetId */

/** @typedef {Record<string, boolean>} CategoryFlags */

/**
 * @typedef {object} LocalAgentConfig
 * @property {PresetId} preset
 * @property {boolean} useCustomCategories
 * @property {CategoryFlags} categories
 * @property {boolean} truncateToolResults
 * @property {boolean} truncateAllToolResults
 * @property {number} maxInlineChars
 * @property {boolean} patientJetsonStream
 * @property {boolean} liteSystemHint
 * @property {boolean} sessionHygieneHint
 * @property {boolean} denyHeavyMedia
 * @property {boolean} stubToolResults
 * @property {number} stubAfterChars
 * @property {boolean} earlyPruneToolResults
 * @property {boolean} deferToolResultShrink
 * @property {number} keepRecentToolResults
 * @property {number} hardMaxInlineChars
 * @property {number} heavyMaxInlineChars mid-turn cap for browser/web/bash/read (before deferred stub)
 * @property {number} shrinkEverySteps shrink older tool results every N agent steps (0 = only at turn end)
 * @property {number} jetsonKvSlots llama.cpp --parallel / slot count for id_slot pinning
 * @property {boolean} breakGenerationLoops abort mid-stream when prose/reasoning repeats without a tool call
 * @property {number} generationLoopMinChars min accumulated chars before fingerprint loop check
 * @property {number} generationLoopMaxChars hard cap on prose/reasoning without a tool call
 */

export const CATEGORY_META = [
	{ id: "core_files", label: "Core files", hint: "read, write, edit, str_replace_editor" },
	{ id: "shell", label: "Shell", hint: "bash / pwsh" },
	{ id: "web", label: "Web", hint: "web_search, web_fetch" },
	{ id: "browser", label: "In-app browser", hint: "browser_* (dsh-browser)" },
	{ id: "downloads", label: "Downloads", hint: "download_* (aria2 — magnets, torrents, large HTTP)" },
	{ id: "scheduling", label: "Scheduling", hint: "cron_*, schedule_* — turn on when creating or editing schedules" },
	{ id: "search", label: "Repo search", hint: "glob, grep" },
	{ id: "skills", label: "Skills loader", hint: "skill" },
	{ id: "subagent", label: "Subagents", hint: "list_subagent_models, send_message, …" },
	{ id: "jobs", label: "Background jobs", hint: "job_list, job_kill, job_output" },
	{ id: "advanced", label: "Advanced / meta", hint: "cordis_*, goals, ralph, ask_user (todo_write stays on unless custom)" },
];

/** @type {Record<PresetId, Omit<LocalAgentConfig, 'preset'>>} */
export const PRESET_DEFAULTS = {
	lite: {
		useCustomCategories: false,
		categories: {
			core_files: true,
			shell: true,
			web: false,
			browser: false,
			downloads: false,
			scheduling: false,
			search: false,
			skills: true,
			subagent: false,
			jobs: false,
			advanced: false,
		},
		truncateToolResults: true,
		truncateAllToolResults: true,
		maxInlineChars: 2_500,
		patientJetsonStream: true,
		liteSystemHint: true,
		sessionHygieneHint: true,
		denyHeavyMedia: true,
		stubToolResults: true,
		stubAfterChars: 1_200,
		earlyPruneToolResults: true,
		deferToolResultShrink: true,
		keepRecentToolResults: 1,
		hardMaxInlineChars: 24_000,
		heavyMaxInlineChars: 1_500,
		shrinkEverySteps: 1,
		jetsonKvSlots: 1,
		breakGenerationLoops: true,
		generationLoopMinChars: 500,
		generationLoopMaxChars: 8_000,
	},
	balanced: {
		useCustomCategories: false,
		categories: {
			core_files: true,
			shell: true,
			web: true,
			browser: false,
			downloads: true,
			scheduling: false,
			search: true,
			skills: true,
			subagent: false,
			jobs: false,
			advanced: true,
		},
		truncateToolResults: true,
		truncateAllToolResults: false,
		maxInlineChars: 8_000,
		patientJetsonStream: true,
		liteSystemHint: false,
		sessionHygieneHint: true,
		denyHeavyMedia: false,
		stubToolResults: true,
		stubAfterChars: 3_000,
		earlyPruneToolResults: true,
		deferToolResultShrink: true,
		keepRecentToolResults: 2,
		hardMaxInlineChars: 48_000,
		heavyMaxInlineChars: 3_000,
		shrinkEverySteps: 2,
		jetsonKvSlots: 1,
		breakGenerationLoops: true,
		generationLoopMinChars: 600,
		generationLoopMaxChars: 10_000,
	},
	jetson: {
		useCustomCategories: false,
		categories: {
			core_files: true,
			shell: true,
			web: true,
			browser: false,
			downloads: true,
			scheduling: false,
			search: true,
			skills: true,
			subagent: false,
			jobs: false,
			advanced: true,
		},
		truncateToolResults: true,
		truncateAllToolResults: true,
		maxInlineChars: 2_500,
		patientJetsonStream: true,
		liteSystemHint: true,
		sessionHygieneHint: true,
		denyHeavyMedia: true,
		stubToolResults: true,
		stubAfterChars: 1_200,
		earlyPruneToolResults: true,
		deferToolResultShrink: true,
		keepRecentToolResults: 1,
		hardMaxInlineChars: 24_000,
		heavyMaxInlineChars: 1_500,
		shrinkEverySteps: 1,
		jetsonKvSlots: 1,
		breakGenerationLoops: true,
		generationLoopMinChars: 500,
		generationLoopMaxChars: 8_000,
	},
	full: {
		useCustomCategories: false,
		categories: Object.fromEntries(CATEGORY_META.map((c) => [c.id, true])),
		truncateToolResults: false,
		truncateAllToolResults: false,
		maxInlineChars: 48_000,
		patientJetsonStream: false,
		liteSystemHint: false,
		sessionHygieneHint: false,
		denyHeavyMedia: false,
		stubToolResults: false,
		stubAfterChars: 4000,
		earlyPruneToolResults: false,
		deferToolResultShrink: false,
		keepRecentToolResults: 8,
		hardMaxInlineChars: 120_000,
		heavyMaxInlineChars: 48_000,
		shrinkEverySteps: 0,
		jetsonKvSlots: 1,
		breakGenerationLoops: false,
		generationLoopMinChars: 800,
		generationLoopMaxChars: 16_000,
	},
	custom: {
		useCustomCategories: true,
		categories: Object.fromEntries(CATEGORY_META.map((c) => [c.id, true])),
		truncateToolResults: true,
		truncateAllToolResults: true,
		maxInlineChars: 2_500,
		patientJetsonStream: true,
		liteSystemHint: true,
		sessionHygieneHint: true,
		denyHeavyMedia: true,
		stubToolResults: true,
		stubAfterChars: 1_200,
		earlyPruneToolResults: true,
		deferToolResultShrink: true,
		keepRecentToolResults: 1,
		hardMaxInlineChars: 24_000,
		heavyMaxInlineChars: 1_500,
		shrinkEverySteps: 1,
		jetsonKvSlots: 1,
		breakGenerationLoops: true,
		generationLoopMinChars: 500,
		generationLoopMaxChars: 8_000,
	},
};

/** One-click values for already-bloated Jetson chats (keeps current categories). */
export const JETSON_RESCUE_OVERRIDES = {
	truncateToolResults: true,
	truncateAllToolResults: true,
	maxInlineChars: 2_000,
	patientJetsonStream: true,
	liteSystemHint: true,
	sessionHygieneHint: true,
	denyHeavyMedia: true,
	stubToolResults: true,
	stubAfterChars: 1_000,
	earlyPruneToolResults: true,
	deferToolResultShrink: true,
	keepRecentToolResults: 1,
	hardMaxInlineChars: 16_000,
	heavyMaxInlineChars: 1_200,
	shrinkEverySteps: 1,
	breakGenerationLoops: true,
	generationLoopMinChars: 500,
	generationLoopMaxChars: 6_000,
};

const SUBAGENT_TOOLS = new Set([
	"list_subagent_models",
	"send_message",
	"interrupt_agent",
	"spawn_teammate",
]);

const JOB_TOOLS = new Set(["job_list", "job_kill", "job_output"]);

const ADVANCED_PREFIXES = ["cordis_"];
const ADVANCED_TOOLS = new Set([
	"ralph",
	"create_goal",
	"update_goal",
	"get_goal",
	"ask_user_question",
]);

/** @param {string} toolName */
export function categoryForTool(toolName) {
	const n = String(toolName || "");
	if (["read", "write", "edit", "read_image", "str_replace_editor"].includes(n)) return "core_files";
	if (n === "bash" || n === "pwsh") return "shell";
	if (n === "web_search" || n === "web_fetch") return "web";
	if (n.startsWith("browser_")) return "browser";
	if (n.startsWith("download_")) return "downloads";
	if (n.startsWith("cron_") || n.startsWith("schedule_")) return "scheduling";
	if (n === "glob" || n === "grep") return "search";
	if (n === "skill") return "skills";
	if (SUBAGENT_TOOLS.has(n) || n.includes("subagent")) return "subagent";
	if (JOB_TOOLS.has(n)) return "jobs";
	if (n === "todo_write") return null;
	if (ADVANCED_TOOLS.has(n) || ADVANCED_PREFIXES.some((p) => n.startsWith(p))) return "advanced";
	return null;
}

/** @returns {LocalAgentConfig} */
export function defaultConfig() {
	return { preset: "balanced", ...PRESET_DEFAULTS.balanced };
}

/** @param {unknown} raw */
export function normalizeConfig(raw) {
	const base = defaultConfig();
	if (!raw || typeof raw !== "object") return base;
	const o = /** @type {Record<string, unknown>} */ (raw);
	const preset =
		o.preset === "lite" ||
		o.preset === "balanced" ||
		o.preset === "jetson" ||
		o.preset === "full" ||
		o.preset === "custom"
			? o.preset
			: base.preset;
	const presetBlock = PRESET_DEFAULTS[preset] ?? PRESET_DEFAULTS.balanced;
	const categories = { ...presetBlock.categories };
	if (o.categories && typeof o.categories === "object") {
		for (const [k, v] of Object.entries(/** @type {Record<string, unknown>} */ (o.categories))) {
			if (typeof v === "boolean") categories[k] = v;
		}
	}
	return {
		preset,
		useCustomCategories: preset === "custom" ? true : Boolean(o.useCustomCategories),
		categories,
		truncateToolResults:
			typeof o.truncateToolResults === "boolean" ? o.truncateToolResults : presetBlock.truncateToolResults,
		truncateAllToolResults:
			typeof o.truncateAllToolResults === "boolean"
				? o.truncateAllToolResults
				: (presetBlock.truncateAllToolResults ?? false),
		maxInlineChars: clampInt(o.maxInlineChars, 1000, 120_000, presetBlock.maxInlineChars),
		patientJetsonStream:
			typeof o.patientJetsonStream === "boolean" ? o.patientJetsonStream : presetBlock.patientJetsonStream,
		liteSystemHint:
			typeof o.liteSystemHint === "boolean" ? o.liteSystemHint : presetBlock.liteSystemHint,
		sessionHygieneHint:
			typeof o.sessionHygieneHint === "boolean"
				? o.sessionHygieneHint
				: (presetBlock.sessionHygieneHint ?? false),
		denyHeavyMedia:
			typeof o.denyHeavyMedia === "boolean"
				? o.denyHeavyMedia
				: (presetBlock.denyHeavyMedia ?? false),
		stubToolResults:
			typeof o.stubToolResults === "boolean" ? o.stubToolResults : presetBlock.stubToolResults,
		stubAfterChars: clampInt(o.stubAfterChars, 500, 80_000, presetBlock.stubAfterChars),
		earlyPruneToolResults:
			typeof o.earlyPruneToolResults === "boolean"
				? o.earlyPruneToolResults
				: presetBlock.earlyPruneToolResults,
		deferToolResultShrink:
			typeof o.deferToolResultShrink === "boolean"
				? o.deferToolResultShrink
				: (presetBlock.deferToolResultShrink ?? true),
		keepRecentToolResults: clampInt(
			o.keepRecentToolResults,
			0,
			32,
			presetBlock.keepRecentToolResults ?? 3,
		),
		hardMaxInlineChars: clampInt(
			o.hardMaxInlineChars,
			4_000,
			200_000,
			presetBlock.hardMaxInlineChars ?? 48_000,
		),
		heavyMaxInlineChars: clampInt(
			o.heavyMaxInlineChars,
			400,
			120_000,
			presetBlock.heavyMaxInlineChars ?? Math.min(presetBlock.maxInlineChars ?? 6_000, 3_000),
		),
		shrinkEverySteps: clampInt(
			o.shrinkEverySteps,
			0,
			64,
			presetBlock.shrinkEverySteps ?? 2,
		),
		jetsonKvSlots: clampInt(
			o.jetsonKvSlots ?? process.env.DSH_JETSON_KV_SLOTS,
			1,
			64,
			presetBlock.jetsonKvSlots ?? 1,
		),
		breakGenerationLoops:
			typeof o.breakGenerationLoops === "boolean"
				? o.breakGenerationLoops
				: (presetBlock.breakGenerationLoops ?? true),
		generationLoopMinChars: clampInt(
			o.generationLoopMinChars,
			200,
			20_000,
			presetBlock.generationLoopMinChars ?? 500,
		),
		generationLoopMaxChars: clampInt(
			o.generationLoopMaxChars,
			1_000,
			64_000,
			presetBlock.generationLoopMaxChars ?? 8_000,
		),
	};
}

/** @param {LocalAgentConfig} cfg */
export function effectiveCategories(cfg) {
	if (cfg.preset !== "custom" && !cfg.useCustomCategories) {
		return { ...(PRESET_DEFAULTS[cfg.preset]?.categories ?? PRESET_DEFAULTS.balanced.categories) };
	}
	return { ...cfg.categories };
}

/** @param {string} toolName @param {LocalAgentConfig} cfg */
export function isToolAllowed(toolName, cfg) {
	const cats = effectiveCategories(cfg);
	const cat = categoryForTool(toolName);
	if (!cat) return true;
	return cats[cat] !== false;
}

/**
 * Global tool names to omit from the model request (tools.restrict deny list).
 * @param {Iterable<string>} restrictableNames
 * @param {LocalAgentConfig} cfg
 * @returns {string[]}
 */
const HEAVY_MEDIA_TOOLS = new Set([
	"browser_screenshot",
	"read_image",
]);

export function buildToolDenyList(restrictableNames, cfg) {
	const deny = [];
	for (const name of restrictableNames) {
		if (!isToolAllowed(name, cfg)) deny.push(name);
		else if (cfg.denyHeavyMedia && HEAVY_MEDIA_TOOLS.has(name)) deny.push(name);
	}
	return deny;
}

/** @param {unknown} n @param {number} min @param {number} max @param {number} fallback */
function clampInt(n, min, max, fallback) {
	const v = Number(n);
	if (!Number.isFinite(v)) return fallback;
	return Math.min(max, Math.max(min, Math.round(v)));
}

export function storePath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", STORE_FILE);
}

export function settingsYamlPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "settings.yaml");
}

/** @returns {Promise<LocalAgentConfig | null>} null when no store file yet */
export async function tryLoadConfig() {
	try {
		const raw = JSON.parse(await readFile(storePath(), "utf8"));
		return normalizeConfig(raw);
	} catch {
		return null;
	}
}

/** @returns {Promise<LocalAgentConfig>} */
export async function loadConfig() {
	return (await tryLoadConfig()) ?? defaultConfig();
}

/** @param {LocalAgentConfig} cfg */
export async function saveConfig(cfg) {
	const path = storePath();
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(normalizeConfig(cfg), null, 2)}\n`, "utf8");
}

const PATIENT_MS = 900_000;
const DEFAULT_MS = 300_000;

/** @param {boolean} enabled */
export async function syncJetsonStreamTimeout(enabled) {
	const path = settingsYamlPath();
	let text;
	try {
		text = await readFile(path, "utf8");
	} catch (err) {
		throw new Error(`Could not read settings.yaml: ${err instanceof Error ? err.message : err}`);
	}
	const ms = enabled ? PATIENT_MS : DEFAULT_MS;
	const providerKey = "jetson-llamacpp";
	const lines = text.split("\n");
	let out = [];
	let inProvider = false;
	let providerIndent = 0;
	let inserted = false;
	let foundTimeout = false;

	for (let i = 0; i < lines.length; i++) {
		const line = lines[i];
		const trimmed = line.trimStart();
		const indent = line.length - trimmed.length;

		if (/^llm-pi-ai:\s*$/.test(trimmed)) {
			inProvider = false;
			out.push(line);
			continue;
		}

		if (/^providers:\s*$/.test(trimmed) && indent <= 2) {
			inProvider = false;
			out.push(line);
			continue;
		}

		if (new RegExp(`^${providerKey}:\\s*$`).test(trimmed)) {
			inProvider = true;
			providerIndent = indent;
			out.push(line);
			continue;
		}

		if (inProvider && indent <= providerIndent && trimmed && !trimmed.startsWith("#")) {
			if (!foundTimeout && !inserted) {
				out.push(`${" ".repeat(providerIndent + 2)}streamIdleTimeoutMs: ${ms}`);
				inserted = true;
			}
			inProvider = false;
		}

		if (inProvider && /^streamIdleTimeoutMs:\s*/.test(trimmed)) {
			out.push(`${" ".repeat(indent)}streamIdleTimeoutMs: ${ms}`);
			foundTimeout = true;
			continue;
		}

		out.push(line);
	}

	if (enabled && !foundTimeout && !inserted) {
		const idx = out.findIndex((l) => /^\s*jetson-llamacpp:\s*$/.test(l));
		if (idx >= 0) {
			const indent = (out[idx].match(/^(\s*)/) || ["", "    "])[1];
			out.splice(idx + 1, 0, `${indent}  streamIdleTimeoutMs: ${ms}`);
			inserted = true;
		}
	}

	await writeFile(path, out.join("\n"), "utf8");
	return { streamIdleTimeoutMs: enabled ? ms : DEFAULT_MS, patched: inserted || foundTimeout };
}

/** @param {unknown} content */
export function flattenTextContent(content) {
	if (!Array.isArray(content)) return undefined;
	let text = "";
	for (const block of content) {
		if (!block || typeof block !== "object" || block.type !== "text") return undefined;
		text += String(block.text ?? "");
	}
	return text;
}

/** @param {string} text @param {number} maxChars */
export function truncateText(text, maxChars) {
	if (text.length <= maxChars) return text;
	const head = Math.floor(maxChars * 0.65);
	const tail = maxChars - head - 120;
	const omitted = text.length - head - tail;
	return `${text.slice(0, head)}\n\n… [dsh-local-agent: ${omitted} chars omitted from model context — use read with offset/limit if needed] …\n\n${text.slice(-Math.max(0, tail))}`;
}

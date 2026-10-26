/**
 * Keep Harness llm-pi-ai jetson-llamacpp.models in sync with the Jetson
 * switcher catalog (GET /v1/models). Harness-side only — switcher already
 * owns storage; we just mirror ids/ctx/vision/thinking into the dropdown.
 */

const PROVIDER = "jetson-llamacpp";
const SETTINGS_NS = "llm-pi-ai";
const DEFAULT_MAX_TOKENS = 8192;

/** Prefer stable, short labels for known ids; fall back to switcher root. */
const NAME_OVERRIDES = {
	qwen36a3b: "Qwen 3.6 35B-A3B",
	qwen38: "Qwen 3.8 27B",
	heretic38: "Qwen 3.8 Heretic RVN",
	heretic36a3b: "Qwen 3.6 35B-A3B Heretic",
	heretic35_9b: "Qwen 3.5 9B Heretic",
	"heretic35-9b": "Qwen 3.5 9B Heretic",
	gemma26: "Gemma 4 26B-A4B",
	"llama31-8b": "Llama 3.1 8B Instruct",
};

/**
 * @param {string} upstreamBase e.g. http://192.168.1.10:8100
 * @param {AbortSignal} [signal]
 */
export async function fetchSwitcherModels(upstreamBase, signal) {
	const base = String(upstreamBase || "").replace(/\/+$/, "");
	const url = `${base}/v1/models`;
	const res = await fetch(url, {
		method: "GET",
		headers: { accept: "application/json" },
		signal: signal ?? AbortSignal.timeout(15_000),
	});
	if (!res.ok) {
		throw new Error(`switcher ${url} → HTTP ${res.status}`);
	}
	const body = await res.json();
	const data = Array.isArray(body?.data) ? body.data : [];
	return data.filter((m) => m && typeof m.id === "string" && m.id.length > 0);
}

/**
 * @param {Record<string, unknown>} remote
 */
export function mapSwitcherModel(remote) {
	const id = String(remote.id);
	const meta = remote.meta && typeof remote.meta === "object" ? /** @type {Record<string, unknown>} */ (remote.meta) : {};
	const caps = remote.capabilities && typeof remote.capabilities === "object"
		? /** @type {Record<string, unknown>} */ (remote.capabilities)
		: {};

	const ctxRaw = remote.ctx ?? meta.n_ctx ?? remote.contextWindow ?? remote.context_window;
	const contextWindow = Number(ctxRaw);
	const safeCtx = Number.isFinite(contextWindow) && contextWindow > 0
		? Math.round(contextWindow)
		: 8192;

	/** @type {string[]} */
	let input = ["text"];
	if (Array.isArray(caps.modalities) && caps.modalities.length > 0) {
		input = caps.modalities.map(String).filter((m) => m === "text" || m === "image");
		if (!input.includes("text")) input.unshift("text");
	} else if (caps.vision === true) {
		input = ["text", "image"];
	}

	const root = typeof remote.root === "string" ? remote.root : id;
	const name = NAME_OVERRIDES[id] || friendlyName(root, id);

	/** @type {Record<string, unknown>} */
	const entry = {
		id,
		name,
		input,
		contextWindow: safeCtx,
		maxTokens: DEFAULT_MAX_TOKENS,
		reasoningEfforts: mapReasoningEfforts(remote),
	};
	return entry;
}

/**
 * @param {string} root
 * @param {string} id
 */
function friendlyName(root, id) {
	const cleaned = String(root)
		.replace(/\.gguf$/i, "")
		.replace(/-Q4_K_M$/i, "")
		.replace(/_/g, " ")
		.trim();
	return cleaned || id;
}

/**
 * @param {Record<string, unknown>} remote
 * @returns {false | Record<string, string | null>}
 */
function mapReasoningEfforts(remote) {
	if (remote.thinking_controllable !== true) return false;
	const levels = Array.isArray(remote.thinking_levels)
		? remote.thinking_levels
		: [false, "low", "medium", "high"];
	/** @type {Record<string, string | null>} */
	const out = {};
	for (const level of levels) {
		if (level === false || level === null || level === "off") {
			out.off = null;
		} else if (typeof level === "string" && level.length > 0) {
			out[level] = level;
		}
	}
	return Object.keys(out).length > 0 ? out : false;
}

/**
 * Stable fingerprint so we skip no-op settings writes.
 * @param {Array<Record<string, unknown>>} models
 */
export function modelsFingerprint(models) {
	return JSON.stringify(
		(models || []).map((m) => ({
			id: m.id,
			name: m.name,
			input: m.input,
			contextWindow: m.contextWindow,
			maxTokens: m.maxTokens,
			reasoningEfforts: m.reasoningEfforts,
		})),
	);
}

/**
 * @param {object} opts
 * @param {import('@deepseek-ai/cordis').Context} opts.ctx
 * @param {string} opts.upstreamBase
 * @param {(msg: string) => void} [opts.log]
 * @param {boolean} [opts.force]
 * @returns {Promise<{ ok: boolean, changed: boolean, models: Array<Record<string, unknown>>, error?: string }>}
 */
export async function syncJetsonModels({ ctx, upstreamBase, log, force = false }) {
	const settings = ctx.get?.("settings");
	if (!settings?.update) {
		return { ok: false, changed: false, models: [], error: "settings service unavailable" };
	}

	let remote;
	try {
		remote = await fetchSwitcherModels(upstreamBase);
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log?.(`[dsh-ai-metrics] jetson model sync fetch failed: ${message}`);
		return { ok: false, changed: false, models: [], error: message };
	}

	if (remote.length === 0) {
		return { ok: false, changed: false, models: [], error: "switcher returned no models" };
	}

	const models = remote.map(mapSwitcherModel);
	const nextFp = modelsFingerprint(models);

	/** @type {Array<Record<string, unknown>>} */
	let currentModels = [];
	try {
		const rows = typeof settings.describe === "function" ? settings.describe() : [];
		const row = Array.isArray(rows) ? rows.find((r) => r?.ns === SETTINGS_NS) : null;
		const jetson = row?.value?.providers?.[PROVIDER];
		if (Array.isArray(jetson?.models)) currentModels = jetson.models;
	} catch {
		/* first sync — still write */
	}

	if (!force && modelsFingerprint(currentModels) === nextFp) {
		return { ok: true, changed: false, models };
	}

	try {
		await settings.update(SETTINGS_NS, {
			providers: {
				[PROVIDER]: {
					models,
				},
			},
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log?.(`[dsh-ai-metrics] jetson model sync write failed: ${message}`);
		return { ok: false, changed: false, models, error: message };
	}

	log?.(
		`[dsh-ai-metrics] synced ${models.length} switcher models: ${models.map((m) => m.id).join(", ")}`,
	);
	return { ok: true, changed: true, models };
}

/**
 * @param {object} opts
 * @param {import('@deepseek-ai/cordis').Context} opts.ctx
 * @param {string} [opts.upstreamBase]
 * @param {() => string} [opts.getUpstreamBase] live reader (preferred when Settings can change URL)
 * @param {number} [opts.intervalMs] 0 = disable periodic
 * @param {(msg: string) => void} [opts.log]
 * @returns {() => void} disposer
 */
export function startJetsonModelSync({ ctx, upstreamBase, getUpstreamBase, intervalMs = 300_000, log }) {
	let stopped = false;
	let timer = /** @type {ReturnType<typeof setInterval> | null} */ (null);

	const run = (force = false) => {
		if (stopped) return;
		const base = typeof getUpstreamBase === "function"
			? String(getUpstreamBase() || "").trim()
			: String(upstreamBase || "").trim();
		if (!base) {
			log?.("[dsh-ai-metrics] jetson model sync skipped — switcher upstream not configured");
			return;
		}
		void syncJetsonModels({
			ctx,
			upstreamBase: base,
			log,
			force,
		});
	};

	// After boot: settings fiber is ready; small delay avoids racing loader settle.
	const boot = setTimeout(() => run(true), 4_000);

	if (intervalMs > 0) {
		timer = setInterval(() => run(false), intervalMs);
	}

	return () => {
		stopped = true;
		clearTimeout(boot);
		if (timer) clearInterval(timer);
	};
}

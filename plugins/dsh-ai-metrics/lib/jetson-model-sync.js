/**
 * Keep Harness llm-pi-ai provider model lists in sync with upstream catalogs:
 * - Jetson / OpenAI-compatible switcher → GET {base}/v1/models
 * - Ollama → GET {base}/api/tags (fallback: /v1/models)
 *
 * Writes go through Cordis settings (HMR). Nested HMR transactions fail with
 * "HMR transactions cannot be nested" — we serialize + retry outside that ALS.
 */

const SETTINGS_NS = "llm-pi-ai";
const DEFAULT_MAX_TOKENS = 8192;
/** Known switcher provider id (ProDesk / suite seed). */
const SWITCHER_PROVIDER_IDS = new Set(["jetson-llamacpp"]);
/** Common Ollama provider ids people pick / seed. */
const OLLAMA_PROVIDER_IDS = new Set(["ollama", "local-ollama", "local-llm"]);

const NAME_OVERRIDES = {
	qwen36a3b: "Qwen 3.6 35B-A3B",
	qwen38: "Qwen 3.8 27B",
	heretic38: "Qwen 3.8 Heretic RVN",
	heretic36a3b: "Qwen 3.6 35B-A3B Heretic",
	heretic35_9b: "Qwen 3.5 9B Heretic",
	"heretic35-9b": "Qwen 3.5 9B Heretic",
	gemma26: "Gemma 4 26B-A4B",
	"llama31-8b": "Llama 3.1 8B Instruct",
	"mimo26-9b": "MiMo 2.6 9B",
};

/** @type {Promise<unknown>} */
let syncChain = Promise.resolve();

/**
 * @param {string} url
 */
export function normalizeUpstreamBase(url) {
	return String(url || "")
		.trim()
		.replace(/\/+$/, "")
		.replace(/\/v1$/i, "");
}

/**
 * @param {string | undefined} providerBase
 * @param {string} upstreamBase
 */
export function providerMatchesUpstream(providerBase, upstreamBase) {
	const pb = normalizeUpstreamBase(providerBase);
	const ub = normalizeUpstreamBase(upstreamBase);
	if (!pb || !ub) return false;
	if (pb === ub) return true;
	// openai-completions often stores …/v1; upstream may omit it
	if (pb === `${ub}/v1` || ub === `${pb}/v1`) return true;
	return false;
}

/**
 * @param {unknown} settings
 * @returns {Record<string, Record<string, unknown>>}
 */
function readProviders(settings) {
	try {
		const rows = typeof settings.describe === "function" ? settings.describe() : [];
		const row = Array.isArray(rows) ? rows.find((r) => r?.ns === SETTINGS_NS) : null;
		const providers = row?.value?.providers;
		if (providers && typeof providers === "object") {
			return /** @type {Record<string, Record<string, unknown>>} */ (providers);
		}
	} catch {
		/* empty */
	}
	return {};
}

/**
 * @param {Record<string, Record<string, unknown>>} providers
 * @param {string} upstreamBase
 * @param {"switcher" | "ollama"} kind
 * @returns {string[]}
 */
export function findProviderIds(providers, upstreamBase, kind) {
	/** @type {string[]} */
	const matched = [];
	for (const [id, p] of Object.entries(providers || {})) {
		if (providerMatchesUpstream(typeof p?.baseURL === "string" ? p.baseURL : "", upstreamBase)) {
			matched.push(id);
		}
	}
	if (matched.length > 0) return matched;

	// Fallback: known ids when URL match fails (legacy / slightly wrong baseURL)
	const known = kind === "switcher" ? SWITCHER_PROVIDER_IDS : OLLAMA_PROVIDER_IDS;
	for (const id of known) {
		if (providers[id]) matched.push(id);
	}
	return matched;
}

/**
 * @param {string} upstreamBase
 * @param {AbortSignal} [signal]
 */
export async function fetchSwitcherModels(upstreamBase, signal) {
	const base = normalizeUpstreamBase(upstreamBase);
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
 * @param {string} upstreamBase
 * @param {AbortSignal} [signal]
 */
export async function fetchOllamaModels(upstreamBase, signal) {
	const base = normalizeUpstreamBase(upstreamBase);
	const sig = signal ?? AbortSignal.timeout(15_000);

	// Prefer native tags (full local list); OpenAI /v1/models is often thinner.
	try {
		const res = await fetch(`${base}/api/tags`, {
			method: "GET",
			headers: { accept: "application/json" },
			signal: sig,
		});
		if (res.ok) {
			const body = await res.json();
			const list = Array.isArray(body?.models) ? body.models : [];
			return list
				.map((m) => {
					const id = String(m?.name || m?.model || "").trim();
					if (!id) return null;
					const ctx = Number(m?.details?.context_length ?? m?.context_length ?? 0);
					return {
						id,
						name: id,
						input: ["text"],
						contextWindow: Number.isFinite(ctx) && ctx > 0 ? Math.round(ctx) : 8192,
						maxTokens: DEFAULT_MAX_TOKENS,
						reasoningEfforts: false,
					};
				})
				.filter(Boolean);
		}
	} catch {
		/* fall through to /v1/models */
	}

	const res = await fetch(`${base}/v1/models`, {
		method: "GET",
		headers: { accept: "application/json" },
		signal: sig,
	});
	if (!res.ok) {
		throw new Error(`ollama ${base} → HTTP ${res.status}`);
	}
	const body = await res.json();
	const data = Array.isArray(body?.data) ? body.data : [];
	return data
		.filter((m) => m && typeof m.id === "string" && m.id.length > 0)
		.map((m) => ({
			id: String(m.id),
			name: String(m.id),
			input: ["text"],
			contextWindow: 8192,
			maxTokens: DEFAULT_MAX_TOKENS,
			reasoningEfforts: false,
		}));
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

	return {
		id,
		name,
		input,
		contextWindow: safeCtx,
		maxTokens: DEFAULT_MAX_TOKENS,
		reasoningEfforts: mapReasoningEfforts(remote),
	};
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
 * settings.update runs inside an HMR exclusive transaction. Calling it while
 * another HMR op is active rejects with "HMR transactions cannot be nested".
 * Defer + retry until the ALS slot is free.
 *
 * @param {{ update: (ns: string, patch: unknown) => Promise<unknown> }} settings
 * @param {string} ns
 * @param {unknown} patch
 */
async function settingsUpdateSafe(settings, ns, patch) {
	const maxAttempts = 12;
	let lastErr = /** @type {Error | null} */ (null);
	for (let i = 0; i < maxAttempts; i++) {
		// Yield out of any current HMR ALS frame (boot effect, reload, etc.).
		await new Promise((r) => setTimeout(r, i === 0 ? 0 : 75 * i));
		try {
			await settings.update(ns, patch);
			return;
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			lastErr = err instanceof Error ? err : new Error(message);
			if (!/HMR transactions cannot be nested/i.test(message)) {
				throw lastErr;
			}
		}
	}
	throw lastErr || new Error("HMR transactions cannot be nested");
}

/**
 * @param {object} opts
 * @param {import('@deepseek-ai/cordis').Context} opts.ctx
 * @param {"switcher" | "ollama"} opts.kind
 * @param {string} opts.upstreamBase
 * @param {(msg: string) => void} [opts.log]
 * @param {boolean} [opts.force]
 */
async function syncOneCatalog({ ctx, kind, upstreamBase, log, force = false }) {
	const settings = ctx.get?.("settings");
	if (!settings?.update) {
		return { ok: false, changed: false, models: [], providers: [], error: "settings service unavailable" };
	}

	const base = normalizeUpstreamBase(upstreamBase);
	if (!base) {
		return { ok: false, changed: false, models: [], providers: [], error: `${kind} upstream not configured` };
	}

	/** @type {Array<Record<string, unknown>>} */
	let models;
	try {
		if (kind === "ollama") {
			models = /** @type {Array<Record<string, unknown>>} */ (await fetchOllamaModels(base));
		} else {
			const remote = await fetchSwitcherModels(base);
			models = remote.map(mapSwitcherModel);
		}
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log?.(`[dsh-ai-metrics] ${kind} model sync fetch failed: ${message}`);
		return { ok: false, changed: false, models: [], providers: [], error: message };
	}

	// Empty catalog is a valid state (user deleted everything) — still write so Harness drops stale ids.
	const nextFp = modelsFingerprint(models);
	const providers = readProviders(settings);
	const targetIds = findProviderIds(providers, base, kind);

	if (targetIds.length === 0) {
		const hint = kind === "ollama"
			? "add Settings → Models → Custom model API with base URL matching Ollama upstream (…:11434/v1)"
			: "add / keep a provider whose baseURL matches the switcher upstream (or id jetson-llamacpp)";
		log?.(`[dsh-ai-metrics] ${kind} model sync skipped — no matching llm-pi-ai provider (${hint})`);
		return {
			ok: false,
			changed: false,
			models,
			providers: [],
			error: `no matching llm-pi-ai provider for ${kind}`,
		};
	}

	/** @type {string[]} */
	const changedIds = [];
	/** @type {Record<string, { models: Array<Record<string, unknown>> }>} */
	const patchProviders = {};

	for (const id of targetIds) {
		const current = Array.isArray(providers[id]?.models)
			? /** @type {Array<Record<string, unknown>>} */ (providers[id].models)
			: [];
		if (!force && modelsFingerprint(current) === nextFp) continue;
		changedIds.push(id);
		patchProviders[id] = { models };
	}

	if (changedIds.length === 0) {
		return { ok: true, changed: false, models, providers: targetIds };
	}

	try {
		await settingsUpdateSafe(settings, SETTINGS_NS, {
			providers: patchProviders,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		log?.(`[dsh-ai-metrics] ${kind} model sync write failed: ${message}`);
		return { ok: false, changed: false, models, providers: targetIds, error: message };
	}

	log?.(
		`[dsh-ai-metrics] synced ${models.length} ${kind} model(s) → ${changedIds.join(", ")}: ${
			models.map((m) => m.id).join(", ") || "(none)"
		}`,
	);
	return { ok: true, changed: true, models, providers: changedIds };
}

/**
 * @param {object} opts
 * @param {import('@deepseek-ai/cordis').Context} opts.ctx
 * @param {string} [opts.switcherBase]
 * @param {string} [opts.ollamaBase]
 * @param {(msg: string) => void} [opts.log]
 * @param {boolean} [opts.force]
 */
export async function syncModelCatalog({ ctx, switcherBase, ollamaBase, log, force = false }) {
	/** @type {{ switcher?: Awaited<ReturnType<typeof syncOneCatalog>>, ollama?: Awaited<ReturnType<typeof syncOneCatalog>> }} */
	const results = {};
	const sw = String(switcherBase || "").trim();
	const ol = String(ollamaBase || "").trim();

	if (sw) {
		results.switcher = await syncOneCatalog({
			ctx,
			kind: "switcher",
			upstreamBase: sw,
			log,
			force,
		});
	}
	if (ol) {
		results.ollama = await syncOneCatalog({
			ctx,
			kind: "ollama",
			upstreamBase: ol,
			log,
			force,
		});
	}

	const parts = [results.switcher, results.ollama].filter(Boolean);
	if (parts.length === 0) {
		return {
			ok: false,
			changed: false,
			results,
			error: "no switcher or ollama upstream configured",
		};
	}
	return {
		ok: parts.every((p) => p && p.ok),
		changed: parts.some((p) => p && p.changed),
		results,
	};
}

/** @deprecated use syncModelCatalog — kept for RPC / callers */
export async function syncJetsonModels({ ctx, upstreamBase, log, force = false }) {
	const one = await syncOneCatalog({
		ctx,
		kind: "switcher",
		upstreamBase,
		log,
		force,
	});
	return {
		ok: one.ok,
		changed: one.changed,
		models: one.models,
		error: one.error,
	};
}

/**
 * Serialize catalog syncs so overlapping timers don't nest HMR writes.
 * @param {() => Promise<unknown>} fn
 */
function enqueueSync(fn) {
	const run = syncChain.then(fn, fn);
	syncChain = run.then(
		() => undefined,
		() => undefined,
	);
	return run;
}

/**
 * @param {object} opts
 * @param {import('@deepseek-ai/cordis').Context} opts.ctx
 * @param {() => string} [opts.getSwitcherBase]
 * @param {() => string} [opts.getOllamaBase]
 * @param {string} [opts.upstreamBase] legacy switcher-only
 * @param {() => string} [opts.getUpstreamBase] legacy switcher-only
 * @param {number} [opts.intervalMs]
 * @param {(msg: string) => void} [opts.log]
 */
export function startJetsonModelSync({
	ctx,
	getSwitcherBase,
	getOllamaBase,
	upstreamBase,
	getUpstreamBase,
	intervalMs = 60_000,
	log,
}) {
	let stopped = false;
	let timer = /** @type {ReturnType<typeof setInterval> | null} */ (null);

	const readSwitcher = () => {
		if (typeof getSwitcherBase === "function") return String(getSwitcherBase() || "").trim();
		if (typeof getUpstreamBase === "function") return String(getUpstreamBase() || "").trim();
		return String(upstreamBase || "").trim();
	};
	const readOllama = () => {
		if (typeof getOllamaBase === "function") return String(getOllamaBase() || "").trim();
		return "";
	};

	const run = (force = false) => {
		if (stopped) return;
		const switcher = readSwitcher();
		const ollama = readOllama();
		if (!switcher && !ollama) {
			log?.("[dsh-ai-metrics] model sync skipped — switcher/ollama upstream not configured");
			return;
		}
		void enqueueSync(() =>
			syncModelCatalog({
				ctx,
				switcherBase: switcher,
				ollamaBase: ollama,
				log,
				force,
			}),
		);
	};

	// Defer past plugin/HMR settle; force first pass so deletions apply.
	const boot = setTimeout(() => run(true), 6_000);

	if (intervalMs > 0) {
		timer = setInterval(() => run(false), intervalMs);
	}

	return () => {
		stopped = true;
		clearTimeout(boot);
		if (timer) clearInterval(timer);
	};
}

/** Trigger a sync now (Settings button / saveConfig). */
export function requestModelCatalogSync(opts) {
	return enqueueSync(() => syncModelCatalog(opts));
}

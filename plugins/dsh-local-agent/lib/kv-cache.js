/**
 * Local llama.cpp KV reuse: inject `cache_prompt` + stable `id_slot` into
 * OpenAI-compatible chat/completions bodies aimed at the model switcher.
 *
 * pi-ai withholds sendSessionAffinityHeaders and does not forward samplingParams
 * from GenerateOptions, so we bind session identity via llm/stream + ALS and
 * patch fetch for matching switcher / host URLs only.
 */
import { AsyncLocalStorage } from "node:async_hooks";
import { PLUGIN } from "./config.js";

const als = new AsyncLocalStorage();

/** @type {((input: RequestInfo | URL, init?: RequestInit) => Promise<Response>) | null} */
let originalFetch = null;

/** Always-on path / name markers (same-origin switcher proxy). */
const BUILTIN_KV_URL_RE = /jetson-switcher|\/jetson-switcher-api\//i;

/** @type {string[]} host:port or host substrings from plugins-data */
let kvHostNeedles = [];

/**
 * Configure which URL hosts get cache_prompt / id_slot injection.
 * @param {string} hostsCsv comma-separated host or host:port fragments
 */
export function setJetsonKvUrlHosts(hostsCsv) {
	kvHostNeedles = String(hostsCsv || "")
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
}

/**
 * @param {string} url
 */
function urlMatchesKvTarget(url) {
	if (BUILTIN_KV_URL_RE.test(url)) return true;
	const lower = String(url || "").toLowerCase();
	for (const needle of kvHostNeedles) {
		if (needle && lower.includes(needle.toLowerCase())) return true;
	}
	return false;
}

/**
 * @param {unknown} n
 * @returns {number}
 */
function slotCount(n) {
	const v = Number(n);
	if (!Number.isFinite(v) || v < 1) return 1;
	return Math.min(64, Math.round(v));
}

/**
 * Stable slot for a harness session. With n>1, reserve the last slot for
 * short-lived purposes (title / compaction) so they do not thrash the main chat.
 * @param {string | undefined} sessionId
 * @param {string | undefined} purpose
 * @param {number} nSlots
 */
export function slotForSession(sessionId, purpose, nSlots) {
	const n = slotCount(nSlots);
	if (n === 1) return 0;
	if (purpose === "compaction" || purpose === "session-title") return n - 1;
	const s = String(sessionId || "default");
	let h = 2166136261;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 16777619);
	}
	return (h >>> 0) % (n - 1);
}

/**
 * @param {{ sessionId?: unknown, purpose?: unknown, provider?: unknown } | null | undefined} options
 * @param {number} nSlots
 */
export function bindJetsonKvSession(options, nSlots = 1) {
	const provider = String(options?.provider || "");
	if (provider && provider !== "jetson-llamacpp") {
		als.enterWith(undefined);
		return;
	}
	als.enterWith({
		sessionId: options?.sessionId != null ? String(options.sessionId) : undefined,
		purpose: options?.purpose != null ? String(options.purpose) : undefined,
		nSlots: slotCount(nSlots),
	});
}

/**
 * @param {string} url
 */
function isJetsonChatCompletions(url) {
	if (!urlMatchesKvTarget(url)) return false;
	return /\/chat\/completions\b/i.test(url) || /\/completions\b/i.test(url);
}

/**
 * @param {HeadersInit | undefined} headers
 * @returns {string | undefined}
 */
function sessionIdFromHeaders(headers) {
	if (!headers) return undefined;
	const h = headers instanceof Headers ? headers : new Headers(headers);
	return (
		h.get("x-session-affinity")
		|| h.get("x-session-id")
		|| h.get("session_id")
		|| undefined
	) ?? undefined;
}

/**
 * @param {string} bodyText
 * @param {HeadersInit | undefined} headers
 * @param {number} fallbackSlots
 * @returns {string}
 */
function injectKvFields(bodyText, headers, fallbackSlots) {
	let body;
	try {
		body = JSON.parse(bodyText);
	} catch {
		return bodyText;
	}
	if (!body || typeof body !== "object" || Array.isArray(body)) return bodyText;

	const store = als.getStore();
	const nSlots = slotCount(store?.nSlots ?? fallbackSlots);
	const sid = store?.sessionId || sessionIdFromHeaders(headers);
	const purpose = store?.purpose;

	if (body.cache_prompt === undefined) body.cache_prompt = true;
	if (body.id_slot === undefined) {
		body.id_slot = slotForSession(sid, purpose, nSlots);
	}

	return JSON.stringify(body);
}

/**
 * @param {number} [nSlots]
 * @param {{ warn?: (msg: string) => void } | null} [log]
 */
export function installJetsonKvFetch(nSlots = 1, log = null) {
	if (originalFetch) return;
	const root = globalThis;
	if (typeof root.fetch !== "function") return;

	originalFetch = root.fetch.bind(root);
	const fallbackSlots = slotCount(nSlots);

	root.fetch = async (input, init) => {
		const url =
			typeof input === "string"
				? input
				: input instanceof URL
					? input.href
					: input && typeof input === "object" && "url" in input
						? String(/** @type {Request} */ (input).url)
						: "";

		if (!isJetsonChatCompletions(url)) {
			return originalFetch(input, init);
		}

		const method = String(
			init?.method
			|| (input && typeof input === "object" && "method" in input
				? /** @type {Request} */ (input).method
				: "GET"),
		).toUpperCase();
		if (method !== "POST") {
			return originalFetch(input, init);
		}

		try {
			let bodyText;
			let headers = init?.headers;
			if (init?.body != null) {
				if (typeof init.body === "string") {
					bodyText = init.body;
				} else if (init.body instanceof Uint8Array) {
					bodyText = new TextDecoder().decode(init.body);
				} else if (typeof Buffer !== "undefined" && Buffer.isBuffer?.(init.body)) {
					bodyText = init.body.toString("utf8");
				}
			} else if (input && typeof input === "object" && "clone" in input) {
				const req = /** @type {Request} */ (input);
				headers = headers ?? req.headers;
				bodyText = await req.clone().text();
			}

			if (typeof bodyText === "string" && bodyText.length > 0) {
				const nextBody = injectKvFields(bodyText, headers, fallbackSlots);
				if (nextBody !== bodyText) {
					if (input && typeof input === "object" && "clone" in input && (init == null || init.body == null)) {
						const req = /** @type {Request} */ (input);
						const rebuilt = new Request(req, { body: nextBody });
						return originalFetch(rebuilt);
					}
					return originalFetch(input, { ...init, body: nextBody });
				}
			}
		} catch (err) {
			log?.warn?.(
				`[${PLUGIN}] KV inject skipped: ${err instanceof Error ? err.message : err}`,
			);
		}

		return originalFetch(input, init);
	};
}

/** @returns {boolean} */
export function isJetsonKvFetchInstalled() {
	return originalFetch != null;
}

/** Test helper / optional teardown. */
export function uninstallJetsonKvFetch() {
	if (!originalFetch) return;
	globalThis.fetch = originalFetch;
	originalFetch = null;
}

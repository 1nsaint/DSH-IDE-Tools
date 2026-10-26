/**
 * Stop local models from infinite browser retry / invent-ref loops.
 * Soft limits enforced in the tool layer with loud STOP errors + activity log.
 */

const MAX_SAME_FAILURE = 2;
const MAX_FAILURES_WINDOW = 5;
const MAX_UNKNOWN_REFS = 1; // inventing a ref once → STOP next time
const MAX_EVALUATE_WINDOW = 4;
const WINDOW_MS = 3 * 60 * 1000;
const ACTIVITY_MAX = 40;

const PAYWALL_RE =
	/membership\s*exclusive|members?\s*only|become\s*a\s*member|subscribe\s*to\s*(download|unlock)|paywall|patron[- ]only|sign\s*in\s*to\s*download/i;

/** @type {{ key: string, count: number, at: number }[]} */
const recentFailures = [];
/** @type {Map<string, number>} */
const sameFailCounts = new Map();
/** @type {number} */
let unknownRefCount = 0;
/** @type {number} */
let evaluateCountWindow = 0;
/** @type {number} */
let evaluateWindowStart = 0;

/** Last snapshot refs the agent is allowed to click (from browser_snapshot). */
let lastRefs = /** @type {Set<string>} */ (new Set());
let lastSnapshotUrl = "";
let lastSnapshotAt = 0;

/** Substantial page text already in context — further click/evaluate is usually waste. */
let lastPageTextChars = 0;
let lastPageTextAt = 0;
let lastInteractionFailAt = 0;
/** Consecutive browser tools since last navigate (click/fill/snapshot/text/evaluate). */
let browserToolsSinceNavigate = 0;

/** @type {{ at: number, action: string, detail: string, ok: boolean, error?: string }[]} */
const activityLog = [];

const PAGE_TEXT_ENOUGH = 800;
const MAX_BROWSER_TOOLS_SINCE_NAV = 8;

function prune() {
	const cutoff = Date.now() - WINDOW_MS;
	while (recentFailures.length && recentFailures[0].at < cutoff) {
		recentFailures.shift();
	}
	if (Date.now() - evaluateWindowStart > WINDOW_MS) {
		evaluateCountWindow = 0;
		evaluateWindowStart = Date.now();
	}
}

function failKey(action, params = {}) {
	const sel = String(params.selector || params.script || params.url || "").trim().slice(0, 200);
	return `${action}::${sel}`;
}

function stopError(reason) {
	return new Error(
		`STOP: ${reason} ` +
		`Do not retry the same browser action. Tell the user the outcome in one short reply and end the turn.`,
	);
}

function pushActivity(entry) {
	activityLog.push({
		at: Date.now(),
		action: String(entry.action || ""),
		detail: String(entry.detail || "").slice(0, 160),
		ok: Boolean(entry.ok),
		...(entry.error ? { error: String(entry.error).slice(0, 200) } : {}),
	});
	while (activityLog.length > ACTIVITY_MAX) activityLog.shift();
}

/**
 * @param {number} [limit]
 */
function getActivity(limit = 20) {
	const n = Math.min(Math.max(Number(limit) || 20, 1), ACTIVITY_MAX);
	return activityLog.slice(-n).map((e) => ({
		...e,
		agoMs: Date.now() - e.at,
	}));
}

/**
 * Compact human/model-facing summary of a snapshot — prefer this over giant JSON.
 * @param {{ url?: string, title?: string, items?: Array<Record<string, unknown>> }} snap
 */
function formatCompactSnapshot(snap) {
	const items = Array.isArray(snap?.items) ? snap.items : [];
	const lines = [
		`url: ${snap?.url || "(unknown)"}`,
		`title: ${snap?.title || ""}`,
		`refs (${items.length}) — click ONLY these refs (e0…e${Math.max(0, items.length - 1)}). Never invent eN.`,
	];
	for (const it of items) {
		const ref = it.ref || "?";
		const tag = it.tag || "";
		const text = String(it.text || "").replace(/\s+/g, " ").trim().slice(0, 60);
		const href = it.href ? ` → ${String(it.href).slice(0, 80)}` : "";
		lines.push(`${ref} ${tag}${text ? ` "${text}"` : ""}${href}`);
	}
	if (items.length === 0) {
		lines.push("(no interactive elements — do not invent refs; report to user)");
	}
	return lines.join("\n");
}

/**
 * Remember which refs exist after a successful snapshot.
 * @param {{ url?: string, items?: Array<{ ref?: string }> }} snap
 */
function rememberSnapshot(snap) {
	const items = Array.isArray(snap?.items) ? snap.items : [];
	lastRefs = new Set(items.map((i) => String(i.ref || "")).filter(Boolean));
	lastSnapshotUrl = String(snap?.url || "");
	lastSnapshotAt = Date.now();
	unknownRefCount = 0; // fresh inventory — reset invent counter only
}

function validRefsHint() {
	if (!lastRefs.size) {
		return "No snapshot yet — call browser_snapshot once and use a listed ref.";
	}
	const list = [...lastRefs].slice(0, 24).join(", ");
	const more = lastRefs.size > 24 ? ` (+${lastRefs.size - 24} more)` : "";
	return `Valid refs on ${lastSnapshotUrl || "last snapshot"}: ${list}${more}.`;
}

/**
 * Call before executing a browser tool. Throws if the agent is looping / inventing refs.
 * @param {string} action
 * @param {Record<string, unknown>} [params]
 */
/**
 * Remember that browser_text / evaluate already returned a large body.
 * @param {number} chars
 */
function recordPageText(chars) {
	const n = Number(chars) || 0;
	if (n >= PAGE_TEXT_ENOUGH) {
		lastPageTextChars = n;
		lastPageTextAt = Date.now();
	}
}

function assertNotLooping(action, params = {}) {
	prune();
	const sel = String(params.selector || "").trim();

	if (action === "navigate") {
		browserToolsSinceNavigate = 0;
	} else if (
		action === "click"
		|| action === "fill"
		|| action === "snapshot"
		|| action === "text"
		|| action === "evaluate"
	) {
		browserToolsSinceNavigate += 1;
	}

	// Already have the page body — stop accordion-click / evaluate spirals that
	// look like "hung after error" while Jetson prefills a bloated context.
	const havePageText =
		lastPageTextChars >= PAGE_TEXT_ENOUGH
		&& Date.now() - lastPageTextAt < WINDOW_MS;
	const recentMiss = lastInteractionFailAt > 0 && Date.now() - lastInteractionFailAt < WINDOW_MS;
	if (
		havePageText
		&& (action === "evaluate" || action === "click" || action === "fill")
		&& (recentMiss || browserToolsSinceNavigate >= MAX_BROWSER_TOOLS_SINCE_NAV)
	) {
		throw new Error(
			`Page text (~${lastPageTextChars} chars) is already in context from browser_text/evaluate. ` +
			`Answer the user now with what you have — do not call more browser click/fill/evaluate this turn. ` +
			`(This is not STOP:; it is a soft gate so Jetson does not stall on more tool dumps.)`,
		);
	}

	// Hallucinated snapshot refs: e999 when only e0–e72 exist.
	if ((action === "click" || action === "fill") && /^e\d+$/i.test(sel)) {
		if (lastRefs.size > 0 && !lastRefs.has(sel)) {
			unknownRefCount += 1;
			pushActivity({
				action,
				detail: sel,
				ok: false,
				error: `invented ref ${sel}`,
			});
			throw stopError(
				`ref "${sel}" is not in the last browser_snapshot (${lastRefs.size} refs). ` +
				`${validRefsHint()} ` +
				`Do not invent refs or URLs that are not listed.`,
			);
		}
		if (unknownRefCount >= MAX_UNKNOWN_REFS && lastRefs.size === 0) {
			throw stopError(
				`clicked invented ref "${sel}" without a prior snapshot. Call browser_snapshot first.`,
			);
		}
	}

	if (action === "evaluate") {
		if (!evaluateWindowStart) evaluateWindowStart = Date.now();
		evaluateCountWindow += 1;
		if (evaluateCountWindow > MAX_EVALUATE_WINDOW) {
			throw stopError(
				`browser_evaluate used ${evaluateCountWindow} times in a few minutes — stop probing; report what you know.`,
			);
		}
	}

	const key = failKey(action, params);
	const same = sameFailCounts.get(key) || 0;
	if (same >= MAX_SAME_FAILURE) {
		throw stopError(
			`identical "${action}" failed ${same} times already (${String(params.selector || params.url || "…").slice(0, 80)}).`,
		);
	}
	if (recentFailures.length >= MAX_FAILURES_WINDOW) {
		throw stopError(
			`${recentFailures.length} browser tool failures in the last few minutes — aborting further browser retries.`,
		);
	}
}

/**
 * @param {string} action
 * @param {Record<string, unknown>} [params]
 * @param {unknown} err
 */
function recordFailure(action, params = {}, err) {
	prune();
	const key = failKey(action, params);
	sameFailCounts.set(key, (sameFailCounts.get(key) || 0) + 1);
	recentFailures.push({ key, count: 1, at: Date.now() });
	const msg = err instanceof Error ? err.message : String(err || "");
	if (/element not found|click failed|fill failed/i.test(msg)) {
		lastInteractionFailAt = Date.now();
	}
	pushActivity({
		action,
		detail: String(params.selector || params.url || params.script || "").slice(0, 120),
		ok: false,
		error: msg,
	});
	if (/STOP:/i.test(msg)) return;
	if (/unknown ref/i.test(msg)) {
		unknownRefCount += 1;
		if (unknownRefCount >= MAX_UNKNOWN_REFS) {
			// escalate next call via assert — also rewrite current throw site if needed
		}
	}
}

/**
 * @param {string} [action]
 * @param {Record<string, unknown>} [extra]
 */
function recordSuccess(action, extra = {}) {
	// IMPORTANT: do NOT clear failure counts on snapshot — that enabled
	// snapshot→fail→snapshot→fail forever loops.
	if (action === "navigate") {
		sameFailCounts.clear();
		recentFailures.length = 0;
		unknownRefCount = 0;
		evaluateCountWindow = 0;
		lastRefs = new Set();
		lastSnapshotUrl = "";
		lastPageTextChars = 0;
		lastPageTextAt = 0;
		lastInteractionFailAt = 0;
		browserToolsSinceNavigate = 0;
	}
	pushActivity({
		action: action || "ok",
		detail: String(extra.detail || extra.url || "").slice(0, 120),
		ok: true,
	});
}

/**
 * Soft hints (NOT exceptions).
 * Paywall → ok:true + done:true (end turn).
 * Cloudflare → ok:true + cloudflareChallenge (keep solving; never done:true).
 * @param {string} text
 * @param {string} [url]
 * @returns {{ done?: true, cloudflareChallenge?: true, reason: string, message: string } | null}
 */
function detectDeadEndPage(text, url = "") {
	const body = String(text || "");
	const page = url || "current page";
	if (PAYWALL_RE.test(body)) {
		return {
			done: true,
			reason: "paywall",
			message:
				`Page looks membership/paywalled (${page}). ` +
				`Tell the user there is no free download here. ` +
				`Do not chase Patreon/Discord/mirrors unless they explicitly ask. End the turn.`,
		};
	}
	if (/just a moment|cloudflare challenge|verify you are human|performing security verification/i.test(body)) {
		return {
			cloudflareChallenge: true,
			reason: "cloudflare",
			message:
				`Cloudflare human-check is still on (${page}). Do not end the turn. ` +
				`Ask the user to click “Verify you are human” in the Remote live feed, ` +
				`and/or browser_snapshot + click that checkbox if listed, then snapshot again and continue.`,
		};
	}
	return null;
}

/**
 * Rewrite click/fill errors into STOP when the model invents refs.
 * @param {string} msg
 * @param {string} [selector]
 */
function enrichInteractionError(msg, selector = "") {
	if (/^STOP:/i.test(msg)) return msg;
	if (/unknown ref/i.test(msg)) {
		return (
			`STOP: ${msg}. ${validRefsHint()} ` +
			`Never invent refs. browser_snapshot once if needed, then click a listed ref only — or end the turn.`
		);
	}
	if (/element not found|click failed|fill failed/i.test(msg)) {
		const hint = lastRefs.size
			? ` Prefer a listed ref from the last snapshot (${[...lastRefs].slice(0, 8).join(", ")}…).`
			: " Call browser_snapshot once, then retry with a listed ref (e0, e1, …).";
		const already =
			lastPageTextChars >= PAGE_TEXT_ENOUGH
				? ` You already have ~${lastPageTextChars} chars of page text — if that answers the question, reply to the user now instead of more clicks.`
				: "";
		// Soft recovery only — never say "STOP" here. Hard stops use stopError() → "STOP:" prefix.
		return (
			`${msg}.${hint}${already} ` +
			`This is recoverable — keep going. Do not invent refs or URLs. ` +
			`Only end the turn if a later tool error starts with STOP:.`
		);
	}
	return msg;
}

export {
	assertNotLooping,
	recordFailure,
	recordSuccess,
	recordPageText,
	detectDeadEndPage,
	stopError,
	PAYWALL_RE,
	rememberSnapshot,
	formatCompactSnapshot,
	getActivity,
	validRefsHint,
	enrichInteractionError,
};

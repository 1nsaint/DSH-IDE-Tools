/**
 * Mid-stream generation-loop breaker for local models that rewrite the same
 * thought forever without emitting a tool call.
 */

/** @param {string} a @param {string} b */
function jaccardWords(a, b) {
	const wa = new Set(a.split(/\s+/).filter((w) => w.length > 3));
	const wb = new Set(b.split(/\s+/).filter((w) => w.length > 3));
	if (wa.size === 0 || wb.size === 0) return 0;
	let inter = 0;
	for (const w of wa) if (wb.has(w)) inter++;
	return inter / (wa.size + wb.size - inter);
}

/**
 * @param {string} buf accumulated text + reasoning deltas (raw)
 * @param {{ minChars?: number, maxChars?: number }} [opts]
 * @returns {boolean}
 */
export function detectGenerationLoop(buf, opts = {}) {
	const minChars = Math.max(200, Number(opts.minChars) || 500);
	const maxChars = Math.max(minChars, Number(opts.maxChars) || 12_000);
	const norm = String(buf || "")
		.replace(/\s+/g, " ")
		.trim()
		.toLowerCase();
	if (norm.length >= maxChars) return true;
	if (norm.length < minChars) return false;

	// Exact substring replay (same sentence pasted / regenerated verbatim).
	const needleLen = 90;
	if (norm.length >= needleLen * 3) {
		const needle = norm.slice(-(needleLen + 40), -40);
		const letters = (needle.match(/[a-z]/g) || []).length;
		if (needle.length >= 70 && letters >= 40) {
			let count = 0;
			let idx = 0;
			const step = Math.max(1, Math.floor(needleLen / 3));
			while ((idx = norm.indexOf(needle, idx)) !== -1) {
				count++;
				if (count >= 3) return true;
				idx += step;
			}
		}
	}

	// Paraphrase spiral: last window keeps matching earlier windows on content words
	// ("try the browser… credentials… network tab" rewritten 4–6×).
	const win = 110;
	if (norm.length >= win * 3) {
		const last = norm.slice(-win);
		let hits = 0;
		const step = Math.floor(win / 2);
		for (let i = 0; i + win <= norm.length - win; i += step) {
			if (jaccardWords(last, norm.slice(i, i + win)) >= 0.55) hits++;
			if (hits >= 3) return true;
		}
	}

	const parts = norm
		.split(/(?<=[.!?])\s+|\bok[, ]+|let me |actually[, ]+|i (?:should|will|need to) /i)
		.map((p) => p.trim())
		.filter((p) => p.length >= 50);
	if (parts.length >= 4) {
		const last = parts.slice(-5);
		let nearDup = 0;
		for (let i = 1; i < last.length; i++) {
			if (jaccardWords(last[i - 1], last[i]) >= 0.55) nearDup++;
		}
		if (nearDup >= 2) return true;
	}

	return false;
}

/**
 * Wrap an llm/stream so repetitive prose/reasoning aborts the upstream
 * consumer and finishes the step with `stop` (no tool calls).
 *
 * @param {import('@deepseek-ai/dsh-llm').GenerateOptions} options
 * @param {() => AsyncIterable<import('@deepseek-ai/dsh-llm').StreamChunk>} next
 * @param {{
 *   enabled?: boolean,
 *   minChars?: number,
 *   maxChars?: number,
 *   logger?: { warn?: Function, info?: Function },
 * }} [cfg]
 * @returns {AsyncIterable<import('@deepseek-ai/dsh-llm').StreamChunk>}
 */
export function wrapStreamAgainstGenerationLoop(options, next, cfg = {}) {
	if (cfg.enabled === false) return next();
	if (options?.purpose === "compaction" || options?.purpose === "session-title") {
		return next();
	}

	const minChars = Math.max(200, Number(cfg.minChars) || 500);
	const maxChars = Math.max(minChars, Number(cfg.maxChars) || 12_000);

	return (async function* () {
		const upstream = next();
		const it = upstream[Symbol.asyncIterator]();
		let buf = "";
		let sawToolDelta = false;
		let stopped = false;
		try {
			while (true) {
				const { done, value: chunk } = await it.next();
				if (done) return;
				if (!chunk || typeof chunk !== "object") {
					yield chunk;
					continue;
				}

				if (chunk.type === "tool-call-delta") {
					sawToolDelta = true;
					buf = "";
				} else if (
					!sawToolDelta
					&& (chunk.type === "text-delta" || chunk.type === "reasoning-delta")
					&& typeof chunk.text === "string"
					&& chunk.text
				) {
					buf += chunk.text;
					if (buf.length > maxChars + 512) {
						buf = buf.slice(-(maxChars + 512));
					}
					if (detectGenerationLoop(buf, { minChars, maxChars })) {
						stopped = true;
						cfg.logger?.warn?.(
							`[dsh-local-agent] generation loop detected (~${buf.length} chars prose, no tool call) — finishing step`,
						);
						yield {
							type: "finish",
							reason: { kind: "stop" },
						};
						return;
					}
				}

				yield chunk;
				if (chunk.type === "finish") return;
			}
		} finally {
			if (stopped) {
				try {
					await it.return?.(undefined);
				} catch {
					/* upstream already tearing down */
				}
			}
		}
	})();
}

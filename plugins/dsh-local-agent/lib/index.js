/**
 * dsh-local-agent — host: tool guards, result truncation, settings.yaml stream timeout.
 */
import { registerRpcChannel } from "dsh-ide-shared/register-rpc-channel.js";
import {
	PLUGIN,
	RPC_CHANNEL,
	CATEGORY_META,
	PRESET_DEFAULTS,
	JETSON_RESCUE_OVERRIDES,
	defaultConfig,
	loadConfig,
	saveConfig,
	normalizeConfig,
	isToolAllowed,
	buildToolDenyList,
	syncJetsonStreamTimeout,
	flattenTextContent,
	truncateText,
	tryLoadConfig,
} from "./config.js";
import { persistToolCache, formatToolResultStub, previewBrowserSnapshot } from "./tool-cache.js";
import {
	bindJetsonKvSession,
	installJetsonKvFetch,
	isJetsonKvFetchInstalled,
	setJetsonKvUrlHosts,
} from "./kv-cache.js";
import { wrapStreamAgainstGenerationLoop } from "./stream-loop.js";

export const name = PLUGIN;
export const inject = ["tools", "agents", "connection", "webServer", "systemPrompt", "llm"];

/** @type {import('./config.js').LocalAgentConfig} */
let activeConfig = defaultConfig();

/** @type {WeakMap<object, () => void>} */
const agentTeardown = new WeakMap();

/** After stock compaction fails, nudge the model to answer instead of more tools. */
/** @type {{ at: number, count: number } | null} */
let lastCompactionPressure = null;

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

function applyKvHostConfig(cfg) {
	setJetsonKvUrlHosts(cfg?.jetsonKvUrlHosts || "");
}

async function reloadConfig() {
	activeConfig = await loadConfig();
	applyKvHostConfig(activeConfig);
	return activeConfig;
}

/**
 * @param {import('@deepseek-ai/dsh-tools').Tools} toolsSvc
 * @param {import('@deepseek-ai/dsh-agent').Agent} agent
 * @param {import('./config.js').LocalAgentConfig} cfg
 */
function applyAgentToolRestrictions(toolsSvc, agent, cfg) {
	const agentCtx = agent?.ctx;
	if (!agentCtx?.tools?.restrict) return;
	const known = toolsSvc.view(agentCtx).restrictableNames;
	const deny = buildToolDenyList(known, cfg);
	if (deny.length === 0) return;
	agentCtx.tools.restrict({ deny });
}

const ALREADY_SHRUNK_RE = /\[dsh-local-agent: tool result |\.\.\. tool result middle pruned \.\.\.|chars omitted from model context/i;

const CF_BODY_RE =
	/just a moment|cf-browser-verification|challenge-platform|cdn-cgi\/challenge|_cf_chl|checking your browser before accessing|enable javascript and cookies to continue/i;
const HTML_DUMP_RE = /<!doctype html|<html[\s>]|<head[\s>]/i;
/** curl/wget plus python/node HTTP clients local models use to dodge the curl ban */
const CURLISH_CMD_RE =
	/\b(curl|wget|http\s+get|fetch\(|urllib\.request|urlopen\(|requests\.get|httpx\.|youtube_transcript_api|youtubetranscript\.com)\b/i;
const PUBLIC_HTTP_CMD_RE = /https?:\/\/(?!127\.|localhost|192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/i;

const MAX_SAME_BASH_FAIL = 2;
const BASH_FAIL_WINDOW_MS = 5 * 60 * 1000;
/** @type {Map<string, { count: number, at: number }>} */
const bashFailCounts = new Map();

function bashCommandOf(args) {
	if (!args || typeof args !== "object") return "";
	return String("command" in args ? args.command : args.cmd || "");
}

/** Normalize for repeat detection (whitespace + heredoc tag names). */
function bashCmdKey(sessionId, cmd) {
	const norm = String(cmd || "")
		.replace(/\s+/g, " ")
		.replace(/<<\s*'?[A-Za-z_][A-Za-z0-9_]*'?/g, "<<'EOF'")
		.trim()
		.slice(0, 280);
	return `${sessionId || "global"}::${norm}`;
}

function pruneBashFails() {
	const cutoff = Date.now() - BASH_FAIL_WINDOW_MS;
	for (const [k, v] of bashFailCounts) {
		if (v.at < cutoff) bashFailCounts.delete(k);
	}
}

function recordBashFailure(sessionId, cmd) {
	pruneBashFails();
	const key = bashCmdKey(sessionId, cmd);
	if (!key.endsWith("::") && key.length > (sessionId || "global").length + 3) {
		const prev = bashFailCounts.get(key) || { count: 0, at: 0 };
		bashFailCounts.set(key, { count: prev.count + 1, at: Date.now() });
	}
}

/**
 * Pre-flight: block public-web fetches from bash and identical failing retries.
 * @param {import('@deepseek-ai/dsh-tools').ToolExecution} exec
 * @returns {string | undefined} deny reason
 */
function bashLoopGuardReason(exec) {
	if (exec.name !== "bash" && exec.name !== "pwsh") return undefined;
	const args = exec.arguments ?? exec.args ?? exec.input;
	const cmd = bashCommandOf(args);
	if (!cmd) return undefined;
	const sessionId = exec.agent?.session?.id;

	pruneBashFails();
	const key = bashCmdKey(sessionId, cmd);
	const fails = bashFailCounts.get(key)?.count || 0;
	if (fails >= MAX_SAME_BASH_FAIL) {
		return (
			`STOP: identical bash command already failed ${fails} times. ` +
			`Do not retry it. Report the failure to the user in one short reply and end the turn ` +
			`(or change URL/method entirely — not the same urllib/curl call).`
		);
	}

	// Public internet HTTP from bash/python — same class of mistake as curl.
	const publicFetch =
		(CURLISH_CMD_RE.test(cmd) && PUBLIC_HTTP_CMD_RE.test(cmd))
		|| /\byoutube_transcript_api\b|\byoutubetranscript\.com\b/i.test(cmd);
	if (publicFetch) {
		return (
			`STOP: do not fetch public websites from bash/python (urllib/requests/curl/wget/youtube-transcript). ` +
			`For the open web use browser_navigate + browser_snapshot on Remote Chromium, or web_search. ` +
			`Bash is for local files/Docker/LAN only.`
		);
	}
	return undefined;
}

/**
 * Small models love `curl` for CF sites — that dumps HTML into context and
 * cannot pass bot checks. Rewrite those bash results into a hard redirect.
 * @param {string} toolName
 * @param {unknown} args
 * @param {string} text
 * @returns {string | null}
 */
function rewriteBashWebFetch(toolName, args, text) {
	if (toolName !== "bash" && toolName !== "pwsh") return null;
	const cmd = bashCommandOf(args);
	const looksLikeFetch = CURLISH_CMD_RE.test(cmd) || HTML_DUMP_RE.test(text);
	if (!looksLikeFetch) return null;

	if (CF_BODY_RE.test(text) || (/cloudflare/i.test(text) && /challenge|just a moment/i.test(text))) {
		return (
			"bash/curl hit a Cloudflare human-check — curl cannot pass it. " +
			"Do NOT retry curl. Use browser_navigate (Remote Chromium). " +
			"Ask the user to click “Verify you are human” in the live feed and/or browser_snapshot + click that checkbox, then continue — do not give up."
		);
	}

	if (/HTTP Error 404|404:\s*Not Found|\b404\b.*Not Found/i.test(text)) {
		const urlMatch = cmd.match(/https?:\/\/[^\s'"\\]+/i);
		const url = urlMatch ? urlMatch[0] : "that URL";
		return (
			`STOP: bash HTTP fetch returned 404 for ${url}. ` +
			`Do not retry the same URL/command. Tell the user it is unavailable and stop, ` +
			`or use a different approach (browser_navigate / web_search) — not another urllib call.`
		);
	}

	// Large HTML page fetch — never useful as raw bash stdout for local models.
	if (HTML_DUMP_RE.test(text) && text.length > 2_500) {
		const urlMatch = cmd.match(/https?:\/\/[^\s'"\\]+/i);
		const url = urlMatch ? urlMatch[0] : "that URL";
		return (
			`STOP: bash fetched a large HTML page (${text.length} chars) for ${url}. ` +
			`Do not curl websites into context. Use browser_navigate + browser_snapshot (Remote Chromium) instead.`
		);
	}
	return null;
}

/**
 * After a turn finishes, shrink older tool/result surface nodes so local GPU
 * context does not keep every dump forever — without mutating the prompt
 * prefix mid tool-loop (which would kill llama.cpp KV reuse).
 * @param {import('@deepseek-ai/dsh-session').Session} session
 * @param {import('./config.js').LocalAgentConfig} cfg
 * @param {import('@deepseek-ai/cordis').Context} logCtx
 * @param {import('@deepseek-ai/cordis').Context} [agentCtx]
 */
/**
 * @returns {Promise<number>} how many tool/result nodes were rewritten
 */
async function shrinkOlderToolResults(session, cfg, logCtx, agentCtx) {
	if (!cfg.deferToolResultShrink) return 0;
	if (!cfg.stubToolResults && !cfg.truncateToolResults && !cfg.earlyPruneToolResults) return 0;
	if (!session?.surface?.nodes || typeof session.eventAt !== "function") return 0;

	const toolResults = [];
	for (const seq of [...session.surface.nodes]) {
		const event = session.eventAt(seq);
		if (event?.type === "tool/result") toolResults.push({ seq, event });
	}
	const keep = Math.max(0, Number(cfg.keepRecentToolResults) || 0);
	const older = toolResults.slice(0, Math.max(0, toolResults.length - keep));
	if (older.length === 0) return 0;

	let freezeMessage = (msg) => msg;
	try {
		const llm = await import("@deepseek-ai/dsh-llm");
		if (typeof llm.freezeMessage === "function") freezeMessage = llm.freezeMessage;
	} catch {
		/* optional */
	}

	const tokenMeter = agentCtx?.get?.("tokenMeter");
	let rewritten = 0;

	for (const { seq, event } of older) {
		try {
			const original = session.deriveEventMessage(event);
			if (!original) continue;
			const text = flattenTextContent(original.content);
			if (text === undefined || text.length === 0) continue;
			if (ALREADY_SHRUNK_RE.test(text)) continue;

			const sessionId = session.id;
			const toolName = String(
				event.data?.message?.source?.toolName
				|| event.data?.message?.source?.name
				|| event.data?.message?.toolName
				|| "tool",
			).slice(0, 48);
			let newText = null;

			// Stub anything past stubAfterChars (default ~1.2k) — not a soft 6k "truncate".
			const stubFloor = Math.min(
				Number(cfg.stubAfterChars) || 1_200,
				Number(cfg.heavyMaxInlineChars) || Number(cfg.maxInlineChars) || 1_500,
			);
			if (cfg.stubToolResults && text.length >= stubFloor && sessionId) {
				const cached = await persistToolCache(sessionId, toolName, text);
				const snapPreview = toolName.startsWith("browser_snapshot")
					? previewBrowserSnapshot(text)
					: "";
				newText = formatToolResultStub({
					toolName,
					ref: cached.ref,
					absPath: cached.absPath,
					relHint: cached.relHint,
					charCount: text.length,
					preview: (snapPreview || text.slice(0, 280).replace(/\s+/g, " ").trim()),
				});
			} else if (cfg.truncateToolResults && text.length > cfg.maxInlineChars) {
				newText = truncateText(text, cfg.maxInlineChars);
			} else if (cfg.earlyPruneToolResults && text.length > Math.max(cfg.maxInlineChars, 4_000)) {
				newText = truncateText(text, cfg.maxInlineChars);
			}

			if (!newText || newText.length >= text.length) continue;

			// Must only change message.content — session asserts deep-equal on the rest.
			const baseMsg = event.data?.message || original;
			const message = freezeMessage({
				...baseMsg,
				content: [{ type: "text", text: newText }],
			});

			const shadowedTokenCount = tokenMeter?.estimateMessage?.(original) ?? {
				input: 0,
				output: 0,
			};
			session.append("compaction/prune", {
				shadowedRange: { start: seq, end: seq },
				shadowedSeqs: [seq],
				shadowedTokenCount,
			});
			session.append(
				"tool/result",
				{ ...event.data, message },
				{
					surfaceOp: { op: "replace", startSeq: seq, endSeq: seq },
					sourceEventSeqs: [seq],
				},
			);
			rewritten += 1;
		} catch (err) {
			logCtx.logger?.warn?.(
				`[${PLUGIN}] deferred shrink failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}
	return rewritten;
}

/**
 * Mid-turn / turn-end / compaction-fail cull. Registered on the host scope
 * (not agent.ctx) so a broken agent/created arity cannot silently disable it.
 * @param {import('@deepseek-ai/cordis').Context} scope
 */
function installGlobalCullHooks(scope) {
	const offPre = scope.on("agent/pre-step", async (payload, next) => {
		const agent = payload?.agent;
		const session = agent?.session;
		const step = Number(payload?.step) || 0;
		const agentCtx = agent?.ctx;
		try {
			if (activeConfig.deferToolResultShrink) {
				const every = Math.max(0, Number(activeConfig.shrinkEverySteps) || 0);
				if (every > 0 && step > 0 && step % every === 0 && session) {
					const n = await shrinkOlderToolResults(session, activeConfig, scope, agentCtx);
					if (n > 0) {
						scope.logger?.info?.(
							`[${PLUGIN}] pre-step ${step}: stubbed/truncated ${n} older tool result(s)`,
						);
					}
				}
			} else if (activeConfig.earlyPruneToolResults && session) {
				const pruner = agentCtx?.get?.("toolResultPruner") || scope.get?.("toolResultPruner");
				pruner?.pruneSession?.(session);
			}
		} catch (err) {
			scope.logger?.warn?.(
				`[${PLUGIN}] pre-step tool-result prune failed: ${err instanceof Error ? err.message : err}`,
			);
		}
		return next();
	});

	const offSession = scope.on("session/event", (session, event) => {
		if (!session || !event) return;

		if (event?.type === "compaction/end" && event?.data?.error) {
			const prev = lastCompactionPressure || { at: 0, count: 0 };
			lastCompactionPressure = { at: Date.now(), count: prev.count + 1 };
			const emergency = {
				...activeConfig,
				deferToolResultShrink: true,
				stubToolResults: true,
				truncateToolResults: true,
				keepRecentToolResults: 1,
				stubAfterChars: Math.min(Number(activeConfig.stubAfterChars) || 1500, 800),
				maxInlineChars: Math.min(Number(activeConfig.maxInlineChars) || 6000, 2000),
			};
			void shrinkOlderToolResults(session, emergency, scope, session?.agent?.ctx).then((n) => {
				scope.logger?.warn?.(
					`[${PLUGIN}] compaction failed; emergency-shrunk ${n} tool result(s): ${String(event.data.error).slice(0, 120)}`,
				);
			}).catch((err) => {
				scope.logger?.warn?.(
					`[${PLUGIN}] compaction-fail emergency shrink failed: ${err instanceof Error ? err.message : err}`,
				);
			});
			return;
		}

		if (event?.type !== "turn/end") return;
		lastCompactionPressure = null;
		if (!activeConfig.deferToolResultShrink) return;
		void shrinkOlderToolResults(session, activeConfig, scope).then((n) => {
			if (n > 0) {
				scope.logger?.info?.(`[${PLUGIN}] turn-end: stubbed/truncated ${n} older tool result(s)`);
			}
		}).catch((err) => {
			scope.logger?.warn?.(
				`[${PLUGIN}] turn-end tool-result shrink failed: ${err instanceof Error ? err.message : err}`,
			);
		});
	});

	return () => {
		try {
			offPre?.();
		} catch {
			/* */
		}
		try {
			offSession?.();
		} catch {
			/* */
		}
	};
}

const TRUNCATE_TOOL_NAMES = new Set([
	"read",
	"write",
	"bash",
	"pwsh",
	"grep",
	"glob",
	"web_fetch",
	"web_search",
	"browser_text",
	"browser_snapshot",
	"browser_evaluate",
	"browser_console",
	"browser_network",
	"browser_navigate",
	"job_output",
]);

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function registerRpc(ctx) {
	return registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
		try {
			switch (endpoint) {
				case "getConfig": {
					const cfg = await reloadConfig();
					return ok({
						config: cfg,
						categoryMeta: CATEGORY_META,
						presets: Object.keys(PRESET_DEFAULTS),
						kvCache: {
							fetchPatched: isJetsonKvFetchInstalled(),
							slots: cfg.jetsonKvSlots ?? 1,
						},
					});
				}
				case "setConfig": {
					const next = normalizeConfig(payload?.config ?? payload);
					await saveConfig(next);
					if (next.patientJetsonStream !== activeConfig.patientJetsonStream) {
						await syncJetsonStreamTimeout(next.patientJetsonStream);
					}
					activeConfig = next;
					applyKvHostConfig(activeConfig);
					return ok({ config: activeConfig });
				}
				case "applyPreset": {
					const id = String(payload?.preset || "balanced");
					if (!(id in PRESET_DEFAULTS)) {
						return transportError(new Error(`Unknown preset: ${id}`));
					}
					const prev = await loadConfig();
					const next = normalizeConfig({
						...prev,
						preset: id,
						useCustomCategories: id === "custom",
						...PRESET_DEFAULTS[id],
					});
					await saveConfig(next);
					if (next.patientJetsonStream !== prev.patientJetsonStream) {
						await syncJetsonStreamTimeout(next.patientJetsonStream);
					}
					activeConfig = next;
					applyKvHostConfig(activeConfig);
					return ok({ config: activeConfig });
				}
				case "applyJetsonRescue": {
					const prev = await loadConfig();
					const next = normalizeConfig({
						...prev,
						...JETSON_RESCUE_OVERRIDES,
						// Keep whatever categories the user already chose.
						preset: prev.preset === "full" ? "custom" : prev.preset,
						useCustomCategories: prev.useCustomCategories || prev.preset === "custom",
						categories: prev.categories,
					});
					await saveConfig(next);
					if (next.patientJetsonStream !== prev.patientJetsonStream) {
						await syncJetsonStreamTimeout(next.patientJetsonStream);
					}
					activeConfig = next;
					applyKvHostConfig(activeConfig);
					return ok({ config: activeConfig });
				}
				case "syncStreamTimeout": {
					const enabled = Boolean(payload?.enabled);
					const result = await syncJetsonStreamTimeout(enabled);
					return ok(result);
				}
				default:
					return transportError(new Error(`unknown endpoint: ${endpoint}`));
			}
		} catch (error) {
			return transportError(error);
		}
	});
}

/**
 * @param {import('@deepseek-ai/cordis').Context} scope
 * @param {import('@deepseek-ai/dsh-tools').ToolExecution} exec
 * @param {import('@deepseek-ai/dsh-tools').ToolResult} result
 * @param {object} decision
 */
async function shrinkToolResultForModel(scope, exec, result, decision) {
	const cfg = activeConfig;
	if (decision.kind !== "accept" || Object.hasOwn(decision, "value")) return decision;
	if (result.isError) return decision;

	const text = flattenTextContent(decision.content ?? result.content);
	if (text === undefined) return decision;

	const sessionId = exec.agent?.session?.id;
	const bashRewrite = rewriteBashWebFetch(exec.name, exec.args ?? exec.input, text);
	if (bashRewrite) {
		return {
			kind: "accept",
			content: [{ type: "text", text: bashRewrite }],
			...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}),
		};
	}

	// Deferred mode: heavy dumps get a tight mid-turn cap (or an immediate stub for
	// browser_snapshot). Older results are stubbed on agent/pre-step every shrinkEverySteps.
	// Previously heavy tools stayed at maxInlineChars (6k) × keepRecent — that made
	// one browser spiral go from fast to unusable inside the same turn.
	if (cfg.deferToolResultShrink) {
		const hard = cfg.hardMaxInlineChars || 48_000;
		const soft = cfg.maxInlineChars || 6_000;
		const heavySoft = Math.min(
			soft,
			Number(cfg.heavyMaxInlineChars) || 1_500,
		);
		const name = String(exec.name || "");
		const heavy =
			name.startsWith("browser_")
			|| name === "web_search"
			|| name === "web_fetch"
			|| name === "bash"
			|| name === "pwsh"
			|| name === "read";
		const stubFloor = Number(cfg.stubAfterChars) || 1_200;
		const cap = heavy ? Math.min(hard, heavySoft) : hard;

		// Snapshots: keep ref list only — full body on host. Model needs refs, not 6k YAML.
		if (
			heavy
			&& cfg.stubToolResults
			&& name === "browser_snapshot"
			&& text.length >= stubFloor
			&& sessionId
		) {
			try {
				const cached = await persistToolCache(sessionId, exec.name, text);
				const preview = previewBrowserSnapshot(text) || text.slice(0, 600).replace(/\s+/g, " ").trim();
				return {
					kind: "accept",
					content: [{
						type: "text",
						text: formatToolResultStub({
							toolName: exec.name,
							ref: cached.ref,
							absPath: cached.absPath,
							relHint: cached.relHint,
							charCount: text.length,
							preview,
						}),
					}],
					...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}),
				};
			} catch (err) {
				scope.logger?.warn?.(
					`[${PLUGIN}] snapshot stub failed: ${err instanceof Error ? err.message : err}`,
				);
			}
		}

		if (text.length <= cap) return decision;
		if (sessionId) {
			try {
				await persistToolCache(sessionId, exec.name, text);
			} catch {
				/* ignore */
			}
		}
		return {
			kind: "accept",
			content: [{ type: "text", text: truncateText(text, cap) }],
			...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}),
		};
	}

	// Legacy immediate shrink (deferToolResultShrink off).
	const allowStub = exec.name !== "browser_snapshot";
	if (allowStub && cfg.stubToolResults && text.length >= cfg.stubAfterChars && sessionId) {
		try {
			const cached = await persistToolCache(sessionId, exec.name, text);
			return {
				kind: "accept",
				content: [
					{
						type: "text",
						text: formatToolResultStub({
							toolName: exec.name,
							ref: cached.ref,
							absPath: cached.absPath,
							relHint: cached.relHint,
							charCount: text.length,
						}),
					},
				],
				...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}),
			};
		} catch (err) {
			scope.logger?.warn?.(
				`[${PLUGIN}] tool cache stub failed: ${err instanceof Error ? err.message : err}`,
			);
		}
	}

	if (!cfg.truncateToolResults) return decision;
	const shouldTruncate = cfg.truncateAllToolResults
		|| TRUNCATE_TOOL_NAMES.has(exec.name)
		|| String(exec.name || "").startsWith("browser_");
	if (!shouldTruncate) return decision;

	const max = cfg.maxInlineChars;
	if (text.length <= max) return decision;

	return {
		kind: "accept",
		content: [{ type: "text", text: truncateText(text, max) }],
		...(decision.additionalContexts ? { additionalContexts: decision.additionalContexts } : {}),
	};
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 * @param {Record<string, unknown>} [cordisConfig]
 */
export function apply(ctx, cordisConfig = {}) {
	ctx.inject(["tools", "connection", "webServer", "systemPrompt", "llm"], (scope) => {
		scope.effect(() => registerRpc(scope), `${PLUGIN}: rpc`);

		applyKvHostConfig(activeConfig);
		installJetsonKvFetch(activeConfig.jetsonKvSlots ?? 1, scope.logger);
		const offLlm = scope.on(
			"llm/stream",
			(options, next) => {
				bindJetsonKvSession(options, activeConfig.jetsonKvSlots ?? 1);
				return wrapStreamAgainstGenerationLoop(options, next, {
					enabled: activeConfig.breakGenerationLoops !== false,
					minChars: activeConfig.generationLoopMinChars,
					maxChars: activeConfig.generationLoopMaxChars,
					logger: scope.logger,
				});
			},
			{ global: true },
		);

		const offGuard = scope.tools.guard((exec) => {
			if (!isToolAllowed(exec.name, activeConfig)) {
				return `Tool "${exec.name}" is disabled by Lite mode (Settings → Agent presets → Lite mode). Enable its category there.`;
			}
			if (
				activeConfig.denyHeavyMedia
				&& (exec.name === "browser_screenshot" || exec.name === "read_image")
			) {
				return (
					`Tool "${exec.name}" is blocked by Lite mode “Deny heavy media” ` +
					`(screenshots blow up small-GPU context). Disable that toggle or use browser_snapshot/text instead.`
				);
			}
			const bashDeny = bashLoopGuardReason(exec);
			if (bashDeny) return bashDeny;
			return undefined;
		});

		// Cull hooks must be host-scoped — agent/created previously used the wrong
		// listener arity so pre-step shrink never installed (zero compaction/prune
		// in long browser sessions).
		const offCull = installGlobalCullHooks(scope);

		const offAgents = scope.on("agent/created", (payload) => {
			const agent = payload?.agent;
			if (!agent) {
				scope.logger?.warn?.(`[${PLUGIN}] agent/created missing agent (payload keys: ${Object.keys(payload || {}).join(",")})`);
				return;
			}
			try {
				applyAgentToolRestrictions(scope.tools, agent, activeConfig);
				scope.logger?.info?.(`[${PLUGIN}] restricted tools for agent ${agent.id}`);
			} catch (err) {
				scope.logger?.warn?.(
					`[${PLUGIN}] agent tool restrict failed for ${agent.id}: ${err instanceof Error ? err.message : err}`,
				);
			}
		});

		const offDisposed = scope.on("agent/disposed", (payload) => {
			const agent = payload?.agent;
			if (!agent) return;
			try {
				agentTeardown.get(agent)?.();
			} catch {
				/* */
			}
			agentTeardown.delete(agent);
		});

		const offPost = scope.on("tools/post-execute", async (exec, result, next) => {
			const decision = await next();
			// Track identical bash failures so the next identical call hits tools.guard STOP.
			if (
				(exec.name === "bash" || exec.name === "pwsh")
				&& (result?.isError || decision?.kind === "accept")
			) {
				const text = flattenTextContent(decision.content ?? result.content) || "";
				const failed =
					result?.isError
					|| /HTTP Error \d+|Error:|Traceback \(most recent call last\)|command not found|No such file/i.test(text);
				if (failed) {
					recordBashFailure(
						exec.agent?.session?.id,
						bashCommandOf(exec.arguments ?? exec.args ?? exec.input),
					);
				}
			}
			return shrinkToolResultForModel(scope, exec, result, decision);
		});

		if (scope.systemPrompt?.context) {
			scope.systemPrompt.context({
				name: "local-agent:hint",
				order: 12,
				text: () => {
					const wantHint = activeConfig.liteSystemHint
						|| activeConfig.sessionHygieneHint
						|| activeConfig.preset === "lite"
						|| activeConfig.preset === "jetson";
					if (!wantHint) return "";
					const parts = [];
					if (activeConfig.liteSystemHint || activeConfig.preset === "lite" || activeConfig.preset === "jetson") {
						parts.push(
							"Local-model mode: keep turns small — prefer targeted read (offset/limit), minimal edits, and avoid repeating full file contents in prose.",
							"Disabled Lite mode categories are omitted from tool lists and blocked at runtime.",
							"Never curl/wget public websites (Cloudflare HTML dumps kill context). For the open web use browser_navigate + browser_snapshot on Remote Chromium; bash is for local/shell work only.",
							"Never rewrite the same plan in Think/prose — call a tool or answer the user in one short reply. Do not narrate retries.",
						);
					}
					if (activeConfig.breakGenerationLoops !== false) {
						parts.push(
							"If you catch yourself restating the same approach, stop thinking and either invoke a tool or finish the turn.",
						);
					}
					if (activeConfig.sessionHygieneHint) {
						parts.push(
							"Session hygiene: after many browser/search tool calls local-GPU prefill becomes minutes-long. Prefer a fresh short session over continuing a bloated thread; if the user says the chat is stuck/slow, tell them to open New Session.",
						);
					}
					if (activeConfig.stubToolResults || activeConfig.deferToolResultShrink) {
						parts.push(
							activeConfig.deferToolResultShrink
								? "Tool outputs stay full during a turn; after the turn ends older ones may become short cache summaries — re-read the cited host path if you need the full body again."
								: "Large tool outputs may be replaced with cache references; use read on the cited host path to recover them.",
						);
					}
					if (activeConfig.denyHeavyMedia) {
						parts.push("Do not use browser_screenshot or read_image — use text/snapshot instead.");
					}
					if (
						lastCompactionPressure
						&& lastCompactionPressure.count > 0
						&& Date.now() - lastCompactionPressure.at < 5 * 60 * 1000
					) {
						parts.push(
							"Context compaction just failed and older tool dumps were emergency-shrunk. " +
							"Answer the user NOW with what you already know — do not call more browser/search tools this turn. " +
							"If you still need more research, tell the user to open a New Session.",
						);
					}
					return parts.join(" ");
				},
			});
		}

		void (async () => {
			try {
				const stored = await tryLoadConfig();
				if (stored) {
					activeConfig = stored;
				} else {
					const merged = normalizeConfig({ ...defaultConfig(), ...cordisConfig });
					activeConfig = merged;
					await saveConfig(merged);
				}
				applyKvHostConfig(activeConfig);
			} catch (err) {
				scope.logger?.warn?.(
					`[${PLUGIN}] config load failed: ${err instanceof Error ? err.message : err}`,
				);
			}
		})();

		return () => {
			for (const off of [offLlm, offGuard, offCull, offAgents, offDisposed, offPost]) {
				try {
					off?.();
				} catch {
					/* */
				}
			}
		};
	}, `${PLUGIN}: runtime`);
}

export {
	CATEGORY_META,
	PRESET_DEFAULTS,
	JETSON_RESCUE_OVERRIDES,
	defaultConfig,
	loadConfig,
	saveConfig,
	normalizeConfig,
	isToolAllowed,
	buildToolDenyList,
};

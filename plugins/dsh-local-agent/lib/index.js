/**
 * dsh-local-agent — host: tool guards, result truncation, settings.yaml stream timeout.
 */
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";
import {
	PLUGIN,
	RPC_CHANNEL,
	CATEGORY_META,
	PRESET_DEFAULTS,
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
import { persistToolCache, formatToolResultStub } from "./tool-cache.js";

export const name = PLUGIN;
export const inject = ["tools", "agents", "connection", "webServer", "systemPrompt"];

/** @type {import('./config.js').LocalAgentConfig} */
let activeConfig = defaultConfig();

/** @type {WeakMap<object, () => void>} */
const agentTeardown = new WeakMap();

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

async function reloadConfig() {
	activeConfig = await loadConfig();
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

/**
 * @param {import('@deepseek-ai/dsh-agent').Agent} agent
 * @param {import('@deepseek-ai/cordis').Context} logCtx
 * @param {import('./config.js').LocalAgentConfig} cfg
 */
function installAgentHooks(agent, logCtx, cfg) {
	const agentCtx = agent?.ctx;
	if (!agentCtx?.on) return;

	const cleanups = [];

	if (cfg.earlyPruneToolResults) {
		const offPre = agentCtx.on("agent/pre-step", async (payload, next) => {
			if (activeConfig.earlyPruneToolResults) {
				try {
					const pruner = agentCtx.get?.("toolResultPruner");
					pruner?.pruneSession?.(payload.agent.session);
				} catch (err) {
					logCtx.logger?.warn?.(
						`[${PLUGIN}] early tool-result prune failed: ${err instanceof Error ? err.message : err}`,
					);
				}
			}
			return next();
		});
		cleanups.push(() => {
			try {
				offPre?.();
			} catch {
				/* */
			}
		});
	}

	agentTeardown.set(agent, () => {
		for (const fn of cleanups) fn();
	});
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
					});
				}
				case "setConfig": {
					const next = normalizeConfig(payload?.config ?? payload);
					await saveConfig(next);
					if (next.patientJetsonStream !== activeConfig.patientJetsonStream) {
						await syncJetsonStreamTimeout(next.patientJetsonStream);
					}
					activeConfig = next;
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
	if (cfg.stubToolResults && text.length >= cfg.stubAfterChars && sessionId) {
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
	if (!TRUNCATE_TOOL_NAMES.has(exec.name)) return decision;

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
	ctx.inject(["tools", "connection", "webServer", "systemPrompt"], (scope) => {
		scope.effect(() => registerRpc(scope), `${PLUGIN}: rpc`);

		const offGuard = scope.tools.guard((exec) => {
			if (!isToolAllowed(exec.name, activeConfig)) {
				return `Tool "${exec.name}" is disabled by Lite mode (Settings → Agent presets → Lite mode). Enable its category there.`;
			}
			return undefined;
		});

		const offAgents = scope.on("agent/created", (_carrier, payload) => {
			const agent = payload?.agent;
			if (!agent) return;
			try {
				applyAgentToolRestrictions(scope.tools, agent, activeConfig);
				installAgentHooks(agent, scope, activeConfig);
			} catch (err) {
				scope.logger?.warn?.(
					`[${PLUGIN}] agent hooks failed for ${agent.id}: ${err instanceof Error ? err.message : err}`,
				);
			}
		});

		const offDisposed = scope.on("agent/disposed", (_carrier, payload) => {
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
			return shrinkToolResultForModel(scope, exec, result, decision);
		});

		if (scope.systemPrompt?.context) {
			scope.systemPrompt.context({
				name: "local-agent:hint",
				order: 12,
				text: () => {
					if (!activeConfig.liteSystemHint && activeConfig.preset !== "lite") return "";
					const parts = [
						"Local-model mode: keep turns small — prefer targeted read (offset/limit), minimal edits, and avoid repeating full file contents in prose.",
						"Disabled Lite mode categories are omitted from tool lists and blocked at runtime.",
					];
					if (activeConfig.stubToolResults) {
						parts.push(
							"Large tool outputs may be replaced with cache references; use read on the cited host path to recover them.",
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
			} catch (err) {
				scope.logger?.warn?.(
					`[${PLUGIN}] config load failed: ${err instanceof Error ? err.message : err}`,
				);
			}
		})();

		return () => {
			for (const off of [offGuard, offAgents, offDisposed, offPost]) {
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
	defaultConfig,
	loadConfig,
	saveConfig,
	normalizeConfig,
	isToolAllowed,
	buildToolDenyList,
};

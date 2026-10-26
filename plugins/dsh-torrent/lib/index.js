/**
 * dsh-torrent — aria2-backed downloads (magnets, torrent files, HTTP) + agent tools.
 */
import { registerRpcChannel } from "dsh-ide-shared/register-rpc-channel.js";
import {
	PLUGIN,
	RPC_CHANNEL,
	loadConfig,
	saveConfig,
	normalizeDownloadDir,
	ensureAria2,
	listDownloads,
	addDownloads,
	aria2Rpc,
	mapDownload,
	stopAria2,
} from "./aria2.js";
import {
	WORKSPACE_DOWNLOAD_FOLDER,
	resolveWorkspaceRoot,
	effectiveDownloadDir,
} from "./workspace.js";

export const name = PLUGIN;
export const inject = ["connection", "webServer", "tools", "agents", "workspaceRegistry"];

let defineTool;
try {
	const mod = await import("../../dsh-cron/node_modules/@deepseek-ai/dsh-tools/lib/index.js");
	defineTool = mod.defineTool;
} catch {
	try {
		const mod = await import("/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js");
		defineTool = mod.defineTool;
	} catch (err) {
		console.warn(`[${PLUGIN}] could not import defineTool:`, err);
	}
}

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

/**
 * @param {import('@deepseek-ai/cordis').Context} hostCtx
 * @param {Awaited<ReturnType<typeof loadConfig>>} cfg
 * @param {unknown} payload
 * @param {import('@deepseek-ai/dsh-tools').ToolExecutionInput | undefined} [exec]
 */
async function resolveDownloadTarget(hostCtx, cfg, payload, exec) {
	const agents = hostCtx.agents ?? hostCtx.get?.("agents");
	const workspaceRegistry = hostCtx.workspaceRegistry ?? hostCtx.get?.("workspaceRegistry");
	const sessionId =
		(typeof payload?.sessionId === "string" && payload.sessionId) ||
		exec?.agent?.session?.header?.id ||
		exec?.agent?.id;
	const workspaceRoot = await resolveWorkspaceRoot(agents, workspaceRegistry, sessionId);
	const targetDir = normalizeDownloadDir(effectiveDownloadDir(cfg, workspaceRoot));
	return { workspaceRoot, targetDir, sessionId };
}

/**
 * @param {import('@deepseek-ai/cordis').Context} scope
 */
function registerTools(scope) {
	const tools = scope.tools || scope.get?.("tools");
	if (!tools?.register || !defineTool) return;

	const register = (toolDef) => {
		try {
			return tools.register(defineTool(toolDef));
		} catch (e) {
			console.warn(`[${PLUGIN}] register tool failed:`, toolDef.name, e);
		}
	};

	register({
		name: "download_add",
		description:
			`Add download(s) via aria2: magnet links, http(s) URLs, or .torrent URLs. Files go in <workspace>/${WORKSPACE_DOWNLOAD_FOLDER}/ (created automatically for the session workspace). Prefer this over curl for magnets, large files, and multi-connection HTTP. Open the Downloads tab to watch progress.`,
		parameters: {
			uris: {
				type: "array",
				required: true,
				description: "One or more magnet:, http(s)://, or ftp:// URIs",
			},
			dir: {
				type: "string",
				description: `Optional subfolder under <workspace>/${WORKSPACE_DOWNLOAD_FOLDER}/`,
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args, exec) => {
			const cfg = await loadConfig();
			const { targetDir } = await resolveDownloadTarget(scope, cfg, {}, exec);
			return addDownloads(cfg, Array.isArray(args.uris) ? args.uris : [args.uris], {
				dir: args.dir,
				targetDir,
			});
		},
	});

	register({
		name: "download_list",
		description: "List aria2 downloads (active, waiting, or recently stopped).",
		parameters: {
			which: {
				type: "string",
				description: "active | waiting | stopped | all (default all)",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args, exec) => {
			const cfg = await loadConfig();
			const { targetDir } = await resolveDownloadTarget(scope, cfg, {}, exec);
			const which = String(args.which || "all").toLowerCase();
			if (which === "all") {
				const [active, waiting, stopped] = await Promise.all([
					listDownloads(cfg, "active"),
					listDownloads(cfg, "waiting"),
					listDownloads(cfg, "stopped"),
				]);
				return { downloadDir: targetDir, active, waiting, stopped };
			}
			if (which === "active" || which === "waiting" || which === "stopped") {
				return { downloadDir: targetDir, items: await listDownloads(cfg, which) };
			}
			throw new Error("which must be active, waiting, stopped, or all");
		},
	});

	register({
		name: "download_status",
		description: "Get status for one download by gid (from download_add or download_list).",
		parameters: {
			gid: { type: "string", required: true, description: "aria2 gid hex string" },
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const cfg = await loadConfig();
			await ensureAria2(cfg);
			const gid = String(args.gid || "").trim();
			if (!gid) throw new Error("gid required");
			const row = await aria2Rpc(cfg, "tellStatus", [
				gid,
				["gid", "status", "totalLength", "completedLength", "downloadSpeed", "uploadSpeed", "files", "dir", "errorMessage"],
			]);
			return mapDownload(row);
		},
	});

	register({
		name: "download_remove",
		description: "Remove a download from aria2. Set force true to delete partial files.",
		parameters: {
			gid: { type: "string", required: true },
			force: { type: "boolean", description: "Also delete downloaded data (default false)" },
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const cfg = await loadConfig();
			await ensureAria2(cfg);
			const gid = String(args.gid || "").trim();
			const force = Boolean(args.force);
			const result = await aria2Rpc(cfg, "remove", [gid, force]);
			return { gid, removed: result === gid, force };
		},
	});

	register({
		name: "download_pause",
		description: "Pause an active download.",
		parameters: { gid: { type: "string", required: true } },
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const cfg = await loadConfig();
			await ensureAria2(cfg);
			const gid = String(args.gid || "").trim();
			return { gid, result: await aria2Rpc(cfg, "pause", [gid]) };
		},
	});

	register({
		name: "download_unpause",
		description: "Resume a paused download.",
		parameters: { gid: { type: "string", required: true } },
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const cfg = await loadConfig();
			await ensureAria2(cfg);
			const gid = String(args.gid || "").trim();
			return { gid, result: await aria2Rpc(cfg, "unpause", [gid]) };
		},
	});
}

/**
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
function registerRpc(ctx) {
	return registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
		try {
			const cfg = await loadConfig();
			const paths = await resolveDownloadTarget(ctx, cfg, payload);
			switch (endpoint) {
				case "getConfig": {
					await ensureAria2(cfg);
					const version = await aria2Rpc(cfg, "getVersion", []);
					return ok({
						config: cfg,
						version,
						workspaceRoot: paths.workspaceRoot,
						downloadFolder: paths.targetDir,
						hasOverride: Boolean(cfg.downloadDir),
					});
				}
				case "setConfig": {
					if (payload?.clearOverride) {
						const next = await saveConfig({ ...cfg, downloadDir: null });
						const refreshed = await resolveDownloadTarget(ctx, next, payload);
						return ok({ config: next, downloadFolder: refreshed.targetDir, hasOverride: false });
					}
					const dir = payload?.downloadDir ?? payload?.config?.downloadDir;
					if (dir === undefined) throw new Error("downloadDir or clearOverride required");
					const next = await saveConfig({
						...cfg,
						downloadDir: normalizeDownloadDir(String(dir)),
					});
					return ok({
						config: next,
						downloadFolder: normalizeDownloadDir(String(dir)),
						hasOverride: true,
					});
				}
				case "list": {
					const [active, waiting, stopped] = await Promise.all([
						listDownloads(cfg, "active"),
						listDownloads(cfg, "waiting"),
						listDownloads(cfg, "stopped"),
					]);
					return ok({
						config: cfg,
						active,
						waiting,
						stopped,
						workspaceRoot: paths.workspaceRoot,
						downloadFolder: paths.targetDir,
					});
				}
				case "add": {
					const uris = payload?.uris;
					const list = Array.isArray(uris) ? uris : uris ? [uris] : [];
					const result = await addDownloads(cfg, list, {
						dir: payload?.dir,
						targetDir: paths.targetDir,
					});
					return ok(result);
				}
				case "pause": {
					await ensureAria2(cfg);
					const gid = String(payload?.gid || "").trim();
					await aria2Rpc(cfg, "pause", [gid]);
					return ok({ gid });
				}
				case "unpause": {
					await ensureAria2(cfg);
					const gid = String(payload?.gid || "").trim();
					await aria2Rpc(cfg, "unpause", [gid]);
					return ok({ gid });
				}
				case "remove": {
					await ensureAria2(cfg);
					const gid = String(payload?.gid || "").trim();
					const force = Boolean(payload?.force);
					await aria2Rpc(cfg, "remove", [gid, force]);
					return ok({ gid, force });
				}
				default:
					return transportError(new Error(`unknown endpoint: ${endpoint}`));
			}
		} catch (error) {
			return transportError(error);
		}
	});
}

export function apply(ctx) {
	ctx.inject(["tools", "agents", "workspaceRegistry"], (toolsScope) => {
		toolsScope.effect(() => registerTools(toolsScope), `${PLUGIN}: tools`);
	});
	ctx.inject(["connection", "webServer", "agents", "workspaceRegistry"], (connScope) => {
		connScope.effect(() => {
			registerRpc(connScope);
			loadConfig()
				.then((cfg) => ensureAria2(cfg))
				.catch((err) => console.warn(`[${PLUGIN}] aria2 bootstrap:`, err));
			return () => stopAria2();
		}, `${PLUGIN}: rpc + aria2`);
	});
}

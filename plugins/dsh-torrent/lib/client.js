window.__ModuleLoader__.load({
	id: "dsh-torrent",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-torrent";
		const RPC = "/torrent";

		const css = `
[class*="_scrollBody"]:has(.dtr_root){overflow:hidden!important;display:flex;flex-direction:column;min-height:0}
[class*="_scrollBody"]:has(.dtr_root)>[class*="_viewArea"],
[class*="_viewArea"]:has(.dtr_root){flex:1 1 0!important;min-height:0!important;overflow:hidden!important;position:relative!important;height:auto!important}
[class*="_viewArea"]:has(.dtr_root)>div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dtr_root{display:flex;flex-direction:column;flex:1 1 0;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base)}
.dtr_bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;flex-shrink:0}
.dtr_meta{flex:1;font-size:12px;color:var(--dsw-alias-label-secondary);min-width:0;font-family:var(--ds-font-family-code)}
.dtr_btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}
.dtr_btn:disabled{opacity:.5;cursor:not-allowed}
.dtr_add{display:flex;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0;align-items:flex-start}
.dtr_textarea{flex:1;min-height:56px;max-height:120px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:8px 10px;font:inherit;font-size:12px;font-family:var(--ds-font-family-code);resize:vertical}
.dtr_list{flex:1 1 0;min-height:0;overflow:auto;padding:8px 14px;-webkit-overflow-scrolling:touch}
.dtr_row{padding:10px 12px;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);margin-bottom:8px;background:var(--dsw-alias-bg-layer-1)}
.dtr_head{display:flex;align-items:center;gap:8px;min-width:0}
.dtr_name{flex:1;font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dtr_status{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.03em;padding:2px 8px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);flex:none}
.dtr_prog{height:6px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);margin-top:8px;overflow:hidden}
.dtr_progFill{height:100%;border-radius:999px;background:var(--dsw-alias-state-business-primary,#3d8bfd);transition:width .25s ease}
.dtr_stats{display:flex;flex-wrap:wrap;gap:10px;margin-top:6px;font-size:11px;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary)}
.dtr_actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap}
.dtr_err{color:var(--dsw-alias-state-error-primary);padding:8px 14px;font-size:12px;flex-shrink:0;white-space:pre-wrap}
.dtr_empty{color:var(--dsw-alias-label-tertiary);padding:24px;font-size:13px;text-align:center}
.dtr_footer{flex-shrink:0;border-top:1px solid var(--dsw-alias-border-l2);padding:10px 14px;display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dtr_input{flex:1;min-width:160px;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px;font-family:var(--ds-font-family-code)}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-torrent-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-torrent-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function formatBytes(n) {
			const v = Number(n) || 0;
			if (v < 1024) return `${v} B`;
			const units = ["KiB", "MiB", "GiB", "TiB"];
			let x = v / 1024;
			for (let i = 0; i < units.length; i++) {
				if (x < 1024 || i === units.length - 1) return `${x.toFixed(x < 10 ? 1 : 0)} ${units[i]}`;
				x /= 1024;
			}
			return `${v} B`;
		}

		function formatSpeed(n) {
			const v = Number(n) || 0;
			if (v <= 0) return "—";
			return `${formatBytes(v)}/s`;
		}

		function parseUris(text) {
			return String(text || "")
				.split(/\r?\n/)
				.map((l) => l.trim())
				.filter((l) => l && !l.startsWith("#"));
		}

		function DownloadRow({ item, busy, onPause, onUnpause, onRemove }) {
			const active = item.status === "active" || item.status === "paused";
			const pct = item.progressPercent ?? 0;
			return React.createElement("div", { className: "dtr_row", key: item.gid },
				React.createElement("div", { className: "dtr_head" },
					React.createElement("div", { className: "dtr_name", title: item.name }, item.name || item.gid),
					React.createElement("span", { className: "dtr_status" }, item.status),
				),
				React.createElement("div", { className: "dtr_prog", "aria-hidden": true },
					React.createElement("div", { className: "dtr_progFill", style: { width: `${pct}%` } }),
				),
				React.createElement("div", { className: "dtr_stats" },
					React.createElement("span", null, `${pct}% · ${formatBytes(item.completedLength)} / ${formatBytes(item.totalLength)}`),
					React.createElement("span", null, `↓ ${formatSpeed(item.downloadSpeed)}`),
					item.gid && React.createElement("span", null, `gid ${item.gid}`),
				),
				item.errorMessage && React.createElement("div", { className: "dtr_err", style: { padding: "4px 0 0" } }, item.errorMessage),
				React.createElement("div", { className: "dtr_actions" },
					active && item.status === "active" && React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy,
						onClick: () => onPause(item.gid),
					}, "Pause"),
					active && item.status === "paused" && React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy,
						onClick: () => onUnpause(item.gid),
					}, "Resume"),
					React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy,
						onClick: () => onRemove(item.gid, false),
					}, "Remove"),
					React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy,
						onClick: () => onRemove(item.gid, true),
					}, "Remove + files"),
				),
			);
		}

		function DownloadsView({ connection, sessionId }) {
			const [active, setActive] = React.useState([]);
			const [waiting, setWaiting] = React.useState([]);
			const [stopped, setStopped] = React.useState([]);
			const [downloadFolder, setDownloadFolder] = React.useState("");
			const [workspaceRoot, setWorkspaceRoot] = React.useState("");
			const [hasOverride, setHasOverride] = React.useState(false);
			const [version, setVersion] = React.useState("");
			const [uriText, setUriText] = React.useState("");
			const [dirEdit, setDirEdit] = React.useState("");
			const [error, setError] = React.useState("");
			const [busy, setBusy] = React.useState(false);

			const rpcBase = React.useCallback(
				() => (sessionId ? { sessionId } : {}),
				[sessionId],
			);

			const applyPaths = React.useCallback((data) => {
				if (data.downloadFolder) setDownloadFolder(String(data.downloadFolder));
				if (data.workspaceRoot) setWorkspaceRoot(String(data.workspaceRoot));
				if (typeof data.hasOverride === "boolean") setHasOverride(data.hasOverride);
			}, []);

			const refresh = React.useCallback(async () => {
				if (!connection) return;
				try {
					const data = await callRpc(connection, "list", rpcBase());
					setActive(data.active || []);
					setWaiting(data.waiting || []);
					setStopped(data.stopped || []);
					applyPaths(data);
					setError("");
				} catch (e) {
					setError(String(e?.message || e));
				}
			}, [connection, rpcBase, applyPaths]);

			React.useEffect(() => {
				ensureStyles();
				if (!connection) return;
				let cancelled = false;
				(async () => {
					try {
						const cfg = await callRpc(connection, "getConfig", rpcBase());
						if (!cancelled) {
							applyPaths(cfg);
							if (cfg.downloadFolder) setDirEdit(String(cfg.downloadFolder));
						}
						if (!cancelled && cfg.version?.version) setVersion(String(cfg.version.version));
					} catch (e) {
						if (!cancelled) setError(String(e?.message || e));
					}
				})();
				refresh();
				const id = setInterval(refresh, 2000);
				return () => {
					cancelled = true;
					clearInterval(id);
				};
			}, [connection, sessionId, refresh, rpcBase, applyPaths]);

			async function run(action) {
				setBusy(true);
				setError("");
				try {
					await action();
					await refresh();
				} catch (e) {
					setError(String(e?.message || e));
				} finally {
					setBusy(false);
				}
			}

			const onAdd = () => run(async () => {
				const uris = parseUris(uriText);
				if (uris.length === 0) throw new Error("Paste at least one magnet or URL (one per line)");
				await callRpc(connection, "add", { ...rpcBase(), uris });
				setUriText("");
			});

			const onSaveDir = () => run(async () => {
				const next = String(dirEdit || "").trim();
				const data = await callRpc(connection, "setConfig", { ...rpcBase(), downloadDir: next });
				applyPaths(data);
				setHasOverride(true);
			});

			const onResetDir = () => run(async () => {
				const data = await callRpc(connection, "setConfig", { ...rpcBase(), clearOverride: true });
				applyPaths(data);
				if (data.downloadFolder) setDirEdit(String(data.downloadFolder));
			});

			const all = [...active, ...waiting, ...stopped];

			return React.createElement("div", { className: "dtr_root" },
				React.createElement("div", { className: "dtr_bar" },
					React.createElement("div", { className: "dtr_meta" },
						`aria2${version ? ` ${version}` : ""} · ${downloadFolder || "…/download"}`,
						workspaceRoot && React.createElement("span", {
							style: { display: "block", fontSize: 11, opacity: 0.85, marginTop: 2 },
						}, `workspace ${workspaceRoot}`),
					),
					React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy || !connection,
						onClick: () => refresh(),
					}, "Refresh"),
				),
				React.createElement("div", { className: "dtr_add" },
					React.createElement("textarea", {
						className: "dtr_textarea",
						placeholder: "magnet:?xt=… or https://… (one per line)",
						value: uriText,
						onChange: (e) => setUriText(e.target.value),
						disabled: busy || !connection,
					}),
					React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy || !connection,
						onClick: onAdd,
					}, "Add"),
				),
				error && React.createElement("div", { className: "dtr_err" }, error),
				React.createElement("div", { className: "dtr_list" },
					all.length === 0
						? React.createElement("div", { className: "dtr_empty" },
							"No downloads yet. Paste a magnet or URL above, or ask the agent to use download_add.",
						)
						: all.map((item) => React.createElement(DownloadRow, {
							key: item.gid,
							item,
							busy,
							onPause: (gid) => run(() => callRpc(connection, "pause", { gid })),
							onUnpause: (gid) => run(() => callRpc(connection, "unpause", { gid })),
							onRemove: (gid, force) => run(() => callRpc(connection, "remove", { gid, force })),
						})),
				),
				React.createElement("div", { className: "dtr_footer" },
					React.createElement("span", {
						style: { fontSize: 12, color: "var(--dsw-alias-label-tertiary)", flex: "1 1 200px" },
					}, hasOverride
						? "Custom folder (overrides workspace/download)"
						: "Saves to download/ in the active workspace (folder created on first add)"),
					React.createElement("input", {
						className: "dtr_input",
						value: dirEdit,
						onChange: (e) => setDirEdit(e.target.value),
						disabled: busy,
						placeholder: downloadFolder || "/workspace/…/download",
					}),
					hasOverride && React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy || !connection,
						onClick: onResetDir,
					}, "Use workspace"),
					React.createElement("button", {
						type: "button",
						className: "dtr_btn",
						disabled: busy || !connection,
						onClick: onSaveDir,
					}, "Apply"),
				),
			);
		}

		const inject = ["slots", "connection"];

		function ensureHeroRegistry() {
			window.__dshHeroToolRegistry = window.__dshHeroToolRegistry || {
				_map: new Map(),
				register(id, factory) {
					this._map.set(id, factory);
					return () => this._map.delete(id);
				},
				get(id) {
					return this._map.get(id);
				},
			};
		}

		function apply(ctx) {
			const connection = ctx.get("connection");
			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "torrent",
				order: 9,
				label: () => "Downloads",
				inject: (sessionId) => ({ connection, sessionId }),
			}, DownloadsView)), `${PLUGIN}: tab`);

			ctx.effect(() => {
				ensureHeroRegistry();
				return window.__dshHeroToolRegistry.register("torrent", () =>
					React.createElement(DownloadsView, { connection, sessionId: null }));
			}, `${PLUGIN}: hero`);
		}

		return { apply, inject };
	},
});

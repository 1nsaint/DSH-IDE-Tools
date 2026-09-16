window.__ModuleLoader__.load({
	id: "dsh-testenv",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-testenv";
		const RPC = "/testenv";
		const GIT_RPC = "/git";
		const DB_RPC = "/database";

		const viewCache = { selectedSlug: "", codePath: "", dbUrl: "" };

		const css = `
[class*="_scrollBody"]:has(.dte_root){overflow:hidden!important;display:flex;flex-direction:column;min-height:0}
[class*="_scrollBody"]:has(.dte_root)>[class*="_viewArea"],
[class*="_viewArea"]:has(.dte_root){flex:1 1 0!important;min-height:0!important;overflow:hidden!important;position:relative!important;height:auto!important}
[class*="_viewArea"]:has(.dte_root)>div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dte_root{display:flex;flex-direction:column;flex:1 1 0;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base)}
.dte_bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;flex-shrink:0}
.dte_meta{flex:1;font-size:13px;color:var(--dsw-alias-label-secondary);min-width:0}
.dte_btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}
.dte_btn:disabled{opacity:.5;cursor:not-allowed}
.dte_btnPrimary{border-color:var(--dsw-alias-accent-primary,#3b82f6);color:var(--dsw-alias-accent-primary,#3b82f6);background:transparent}
.dte_body{flex:1 1 0;min-height:0;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:16px}
.dte_card{border:1px solid var(--dsw-alias-border-l2);border-radius:12px;padding:14px;background:var(--dsw-alias-bg-layer-1);display:flex;flex-direction:column;gap:10px}
.dte_title{font-size:14px;font-weight:600;margin:0}
.dte_hint{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.45;margin:0}
.dte_row{display:flex;gap:8px;align-items:center;flex-wrap:wrap}
.dte_input,.dte_select{height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px}
.dte_input{flex:1;min-width:180px}
.dte_select{min-width:200px;max-width:420px;flex:1}
.dte_list{display:flex;flex-direction:column;gap:8px}
.dte_env{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:10px 12px;display:flex;flex-direction:column;gap:6px}
.dte_envActive{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3d8bfd) 50%,transparent);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3d8bfd) 8%,transparent)}
.dte_envName{font-size:13px;font-weight:600}
.dte_envPath{font-size:11px;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-tertiary);word-break:break-all}
.dte_err{color:var(--dsw-alias-state-error-primary);font-size:13px;padding:0 14px 8px;flex-shrink:0}
.dte_msg{font-size:11px;font-family:var(--ds-font-family-code);white-space:pre-wrap;color:var(--dsw-alias-label-secondary);max-height:160px;overflow:auto}
.dsh-hero-tool-view .dte_root{height:100%;min-height:0}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			const existing = document.getElementById("dsh-testenv-css");
			if (existing) existing.remove();
			const t = document.createElement("style");
			t.id = "dsh-testenv-css";
			t.textContent = css;
			document.head.appendChild(t);
		}

		async function callRpc(connection, channel, endpoint, payload) {
			const result = await connection.rpc.call(channel, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function TestEnvView({ connection }) {
			const [envs, setEnvs] = React.useState([]);
			const [codeRepos, setCodeRepos] = React.useState([]);
			const [dbClones, setDbClones] = React.useState([]);
			const [roots, setRoots] = React.useState(null);
			const [selected, setSelected] = React.useState(() => viewCache.selectedSlug || "");
			const [codePath, setCodePath] = React.useState(() => viewCache.codePath || "");
			const [customPathMode, setCustomPathMode] = React.useState(false);
			const [dbUrl, setDbUrl] = React.useState(() => viewCache.dbUrl || "");
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState("");
			const [msg, setMsg] = React.useState("");

			const refresh = React.useCallback(async () => {
				if (!connection) return;
				setBusy(true);
				setError("");
				try {
					const activeWs = typeof window !== "undefined" && window.__dshCurrentWorkspace?.get?.();
					const [e, r, cand, db] = await Promise.all([
						callRpc(connection, RPC, "list", { workspaceCwd: activeWs?.cwd || undefined }),
						callRpc(connection, RPC, "roots"),
						callRpc(connection, RPC, "candidates", { workspaceCwd: activeWs?.cwd || undefined }).catch(() => ({ candidates: [] })),
						callRpc(connection, DB_RPC, "listClones", {}).catch(() => ({ clones: [] })),
					]);
					setEnvs(e.envs || []);
					setRoots(r);
					const composeFolders = cand.candidates || [];
					setCodeRepos(composeFolders);
					setDbClones(db.clones || []);
					// Do not auto-pick code/DB/env — empty until the user chooses
					setSelected((prev) => {
						const want = prev || viewCache.selectedSlug;
						if (want && (e.envs || []).some((x) => x.slug === want || x.dir === want)) return want;
						return "";
					});
					setCodePath((prev) => {
						const want = prev || viewCache.codePath;
						if (want && composeFolders.some((x) => x.path === want)) return want;
						if (want && customPathMode) return want;
						return "";
					});
					setDbUrl((prev) => {
						const want = prev || viewCache.dbUrl;
						if (!want) return "";
						if ((db.clones || []).some((c) => c.url === want)) return want;
						return "";
					});
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			}, [connection, codePath, customPathMode]);

			React.useEffect(() => {
				ensureStyles();
				refresh();
				if (typeof window === "undefined") return undefined;
				const onWs = () => refresh();
				window.addEventListener("dsh-current-workspace-changed", onWs);
				return () => window.removeEventListener("dsh-current-workspace-changed", onWs);
			}, [refresh]);

			React.useEffect(() => {
				viewCache.selectedSlug = selected;
				viewCache.codePath = codePath;
				viewCache.dbUrl = dbUrl;
			}, [selected, codePath, dbUrl]);

			const selectedEnv = envs.find((e) => e.slug === selected || e.dir === selected) || null;

			const registerAndMaybeUp = async (alsoUp) => {
				if (!codePath) {
					setError("Pick or enter a folder that has docker-compose.yml (or compose.yml)");
					return;
				}
				setBusy(true);
				setError("");
				setMsg(alsoUp ? "Registering + starting…" : "Registering…");
				try {
					const reg = await callRpc(connection, RPC, "register", {
						codePath,
						databaseUrl: dbUrl || undefined,
					});
					setMsg(
						`Ready: ${reg.env?.slug || reg.env?.label}`
						+ (dbUrl ? `\nDB: ${dbUrl}` : "\n(no DB wired — using compose defaults / data-test)"),
					);
					if (alsoUp) {
						const res = await callRpc(connection, RPC, "up", {
							dir: reg.env?.dir || codePath,
							databaseUrl: dbUrl || undefined,
						});
						setMsg(
							(prev) => `${prev}\nUp: ${res.project}`
							+ (res.stderr ? `\n${res.stderr.slice(-600)}` : ""),
						);
					}
					await refresh();
					if (reg.env?.slug) setSelected(reg.env.slug);
					else if (reg.env?.dir) setSelected(reg.env.dir);
				} catch (err) {
					setError(err?.message || String(err));
					setMsg("");
				} finally {
					setBusy(false);
				}
			};

			const act = async (endpoint) => {
				if (!selectedEnv) return;
				setBusy(true);
				setError("");
				setMsg(endpoint === "up" ? "Starting…" : "Stopping…");
				try {
					const res = await callRpc(connection, RPC, endpoint, {
						dir: selectedEnv.dir,
						slug: selectedEnv.slug,
						databaseUrl: dbUrl || undefined,
					});
					setMsg(
						`${endpoint}: ${res.project || selectedEnv.project}`
						+ (res.stderr ? `\n${res.stderr.slice(-800)}` : ""),
					);
					await refresh();
				} catch (err) {
					setError(err?.message || String(err));
					setMsg("");
				} finally {
					setBusy(false);
				}
			};

			const destroy = async (deleteFiles) => {
				if (!selectedEnv) return;
				if (deleteFiles && !window.confirm(`Delete folder ${selectedEnv.slug}?`)) return;
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, RPC, "destroy", {
						dir: selectedEnv.dir,
						deleteFiles: !!deleteFiles,
					});
					setMsg(deleteFiles ? `Removed ${selectedEnv.slug}` : `Down ${selectedEnv.slug}`);
					await refresh();
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			if (!connection) {
				return React.createElement("div", { className: "dte_err" }, "Test envs: connection unavailable");
			}

			return React.createElement("div", { className: "dte_root" },
				React.createElement("div", { className: "dte_bar" },
						React.createElement("span", { className: "dte_meta" },
						`${envs.length} registered · pick code + DB after Git / Database`),
					React.createElement("button", {
						type: "button",
						className: "dte_btn",
						disabled: busy,
						onClick: refresh,
					}, busy ? "…" : "Refresh"),
				),
				error && React.createElement("div", { className: "dte_err" }, error),
				React.createElement("div", { className: "dte_body" },
					React.createElement("div", { className: "dte_card" },
						React.createElement("h3", { className: "dte_title" }, "1 → 2 → 3 workflow"),
						React.createElement("p", { className: "dte_hint" },
							"1. Code: create or clone a project with compose.yml (by AI or Git). 2. Database (optional): pick a cloned DB. 3. Register + Start: spin up isolated remapped containers (+10000 ports)."),
						React.createElement("div", { className: "dte_row" },
							React.createElement("select", {
								className: "dte_select",
								value: customPathMode ? "__custom__" : codePath,
								disabled: busy,
								onChange: (e) => {
									if (e.target.value === "__custom__") {
										setCustomPathMode(true);
									} else {
										setCustomPathMode(false);
										setCodePath(e.target.value);
									}
								},
								title: "Folder containing compose.yml / docker-compose.yml",
							},
								React.createElement("option", { value: "" },
									codeRepos.length ? "Select folder with compose…" : "No compose folders found yet"),
								codeRepos.map((r) => {
									const activeWs = typeof window !== "undefined" && window.__dshCurrentWorkspace?.get?.();
									const inActive = activeWs?.cwd && (r.path === activeWs.cwd || r.path.startsWith(activeWs.cwd + "/"));
									let tag = "";
									if (inActive) tag = " · current workspace";
									else if (r.source === "test-environments") tag = " · test-envs";
									else tag = ` · ${r.relPath || r.name}`;
									if (r.isGit) tag += " (git)";
									return React.createElement("option", {
										key: r.path,
										value: r.path,
									}, `${r.name}${tag}`);
								}),
								React.createElement("option", { value: "__custom__" }, "Enter custom folder path…"),
							),
							customPathMode && React.createElement("input", {
								className: "dte_input",
								type: "text",
								placeholder: "/workspace/my-new-app or relative to workspace",
								value: codePath,
								disabled: busy,
								onChange: (e) => setCodePath(e.target.value),
								title: "Folder path containing compose file",
							}),
							React.createElement("select", {
								className: "dte_select",
								value: dbUrl,
								disabled: busy,
								onChange: (e) => setDbUrl(e.target.value),
								title: "Database clone",
							},
								React.createElement("option", { value: "" }, "No DB wire (optional)"),
								dbClones.map((c) => React.createElement("option", {
									key: c.id,
									value: c.url,
								}, `${c.name} · :${c.port}`)),
							),
						),
						React.createElement("div", { className: "dte_row" },
							React.createElement("button", {
								type: "button",
								className: "dte_btn",
								disabled: busy || !codePath,
								onClick: () => registerAndMaybeUp(false),
							}, "Register"),
							React.createElement("button", {
								type: "button",
								className: "dte_btn dte_btnPrimary",
								disabled: busy || !codePath,
								onClick: () => registerAndMaybeUp(true),
							}, "Register + Start"),
						),
						!dbClones.length && React.createElement("p", { className: "dte_hint" },
							"Tip: Database tab → Create clone (name) on your live Postgres connection first."),
					),

					React.createElement("div", { className: "dte_card" },
						React.createElement("h3", { className: "dte_title" }, "Registered / runnable"),
						!envs.length && React.createElement("p", { className: "dte_hint" },
							"Nothing registered yet. Create or clone a project with compose, optional DB clone, then Register above."),
						React.createElement("div", { className: "dte_list" },
							envs.map((e) => React.createElement("div", {
								key: e.dir || e.slug,
								className: "dte_env" + ((selected === e.slug || selected === e.dir) ? " dte_envActive" : ""),
								onClick: () => {
									setSelected(e.slug || e.dir);
									setCodePath(e.dir);
								},
								style: { cursor: "pointer" },
							},
								React.createElement("div", { className: "dte_envName" },
									e.label || e.slug,
									e.source ? ` · ${e.source}` : "",
									e.hasOverlay ? "" : " (needs overlay)"),
								React.createElement("div", { className: "dte_envPath" },
									`${e.project} · ${e.workspacePath || e.dir}`),
							)),
						),
						selectedEnv && React.createElement("div", { className: "dte_row" },
							React.createElement("button", {
								type: "button",
								className: "dte_btn dte_btnPrimary",
								disabled: busy,
								onClick: () => act("up"),
							}, "Start"),
							React.createElement("button", {
								type: "button",
								className: "dte_btn",
								disabled: busy,
								onClick: () => act("down"),
							}, "Stop"),
							React.createElement("button", {
								type: "button",
								className: "dte_btn",
								disabled: busy,
								onClick: () => destroy(false),
							}, "Compose down"),
							selectedEnv.source === "test-environments" && React.createElement("button", {
								type: "button",
								className: "dte_btn",
								disabled: busy,
								onClick: () => destroy(true),
							}, "Delete folder"),
						),
						msg && React.createElement("div", { className: "dte_msg" }, msg),
						roots && React.createElement("p", { className: "dte_hint" },
							`Roots: workspace repos + ${roots.testEnvRoot}`),
					),
				),
			);
		}

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

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			// No standalone top-level tab: Test envs now lives inside the Containers
			// tab as a collapsible section (toggled from the containers toolbar).
			// The hero registration below is how dsh-containers embeds this view.
			ctx.effect(() => {
				ensureHeroRegistry();
				return window.__dshHeroToolRegistry.register("testenv", () =>
					React.createElement(TestEnvView, { connection }));
			}, `${PLUGIN}: hero`);
		}

		return { apply, inject };
	},
});

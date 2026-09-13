window.__ModuleLoader__.load({
	id: "dsh-terminal",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-terminal";
		const RPC = "/terminal";

		const XTERM_THEME = {
			background: "#0f1115",
			foreground: "#e8eaed",
			cursor: "#e8eaed",
			cursorAccent: "#0f1115",
			selectionBackground: "#3b82f680",
			black: "#1e2127",
			red: "#e06c75",
			green: "#98c379",
			yellow: "#e5c07b",
			blue: "#61afef",
			magenta: "#c678dd",
			cyan: "#56b6c2",
			white: "#abb2bf",
			brightBlack: "#5c6370",
			brightRed: "#e06c75",
			brightGreen: "#98c379",
			brightYellow: "#e5c07b",
			brightBlue: "#61afef",
			brightMagenta: "#c678dd",
			brightCyan: "#56b6c2",
			brightWhite: "#ffffff",
		};

		const css = `
.wSkVaW_scrollBody:has(.dt_root){overflow:hidden!important;display:flex;flex-direction:column;min-height:0}
.wSkVaW_scrollBody:has(.dt_root)>.wSkVaW_viewArea,
.wSkVaW_viewArea:has(.dt_root){flex:1 1 0!important;min-height:0!important;overflow:hidden!important;position:relative!important;height:auto!important}
.wSkVaW_viewArea:has(.dt_root)>div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dt_root{display:flex;flex-direction:column;flex:1 1 0;height:100%;min-height:0;overflow:hidden;background:#0f1115;color:#e8eaed}
.dt_tabbar{
  display:flex;align-items:stretch;flex-shrink:0;height:34px;
  background:#16181d;border-bottom:1px solid #2a2d34;
}
.dt_tabs{
  display:flex;align-items:stretch;flex:1 1 auto;min-width:0;
  overflow-x:auto;scrollbar-width:none;
}
.dt_tabs::-webkit-scrollbar{display:none;height:0}
.dt_tab{
  position:relative;display:inline-flex;align-items:center;gap:6px;
  height:100%;padding:0 10px 0 12px;margin:0;border:none;border-right:1px solid #2a2d34;
  background:transparent;color:#9aa0a6;font:500 12px/1 ui-sans-serif,system-ui,sans-serif;
  cursor:pointer;flex:0 0 auto;max-width:180px;border-radius:0;
}
.dt_tab:hover{background:#1c1f26;color:#c8ccd2}
.dt_tabActive{
  background:#0f1115;color:#e8eaed;
}
.dt_tabActive::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;background:#3b82f6;
}
.dt_tabLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
.dt_tabClose{
  display:inline-flex;align-items:center;justify-content:center;
  width:16px;height:16px;padding:0;border:none;border-radius:3px;
  background:transparent;color:#7a8088;cursor:pointer;font-size:13px;line-height:1;flex:none;
  opacity:0;
}
.dt_tab:hover .dt_tabClose,.dt_tabActive .dt_tabClose{opacity:1}
.dt_tabClose:hover{background:#2a2d34;color:#e8eaed}
.dt_tabAdd{
  display:inline-flex;align-items:center;justify-content:center;
  width:34px;height:100%;border:none;border-right:1px solid #2a2d34;
  background:transparent;color:#9aa0a6;font-size:16px;cursor:pointer;flex:none;
}
.dt_tabAdd:hover{background:#1c1f26;color:#e8eaed}
.dt_actions{
  display:flex;align-items:center;gap:8px;padding:0 10px;flex:none;
  border-left:1px solid #2a2d34;
}
.dt_meta{font-size:11px;color:#8b919a;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dt_btn{
  height:24px;padding:0 10px;border-radius:4px;border:1px solid #3a3d45;
  background:transparent;color:#c8ccd2;font-size:11px;cursor:pointer;
}
.dt_btn:hover{background:#1c1f26;color:#e8eaed}
.dt_stack{flex:1 1 0;min-height:0;position:relative;background:#0f1115}
.dt_host{position:absolute;inset:0;overflow:hidden;padding:4px 8px}
.dt_hostHidden{visibility:hidden;pointer-events:none;z-index:0}
.dt_host:not(.dt_hostHidden){z-index:1}
.dt_host .xterm{height:100%}
.dt_host .xterm-viewport{overflow-y:auto!important}
.dt_err{color:#f87171;padding:6px 12px;font-size:12px;flex-shrink:0;border-bottom:1px solid #2a2d34}
.dt_empty{padding:24px 16px;font-size:13px;color:var(--dsw-alias-label-tertiary,#9aa0a6)}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let tag = document.getElementById("dsh-terminal-css");
			if (!tag) {
				tag = document.createElement("style");
				tag.id = "dsh-terminal-css";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		let xtermReady = null;

		function injectCss(content, id) {
			if (document.getElementById(id)) return;
			const tag = document.createElement("style");
			tag.id = id;
			tag.textContent = content;
			document.head.appendChild(tag);
		}

		function loadScriptText(content, id) {
			const existing = document.getElementById(id);
			if (existing) existing.remove();
			const tag = document.createElement("script");
			tag.id = id;
			tag.textContent = [
				"(function(){",
				"var module=undefined,exports=undefined,define=undefined;",
				String(content || ""),
				"})();",
			].join("\n");
			document.head.appendChild(tag);
			return Promise.resolve();
		}

		async function ensureXterm(connection) {
			if (window.Terminal && (window.FitAddon?.FitAddon || typeof window.FitAddon === "function")) return;
			if (xtermReady) {
				try {
					await xtermReady;
					return;
				} catch {
					xtermReady = null;
				}
			}
			xtermReady = (async () => {
				const [js, cssAsset, fit] = await Promise.all([
					callRpc(connection, "asset", { name: "xterm.js" }),
					callRpc(connection, "asset", { name: "xterm.css" }),
					callRpc(connection, "asset", { name: "addon-fit.js" }),
				]);
				if (!js?.content) throw new Error("xterm.js asset empty");
				injectCss(cssAsset.content, "dsh-terminal-xterm-css");
				await loadScriptText(js.content, "dsh-terminal-xterm-js");
				await loadScriptText(fit.content, "dsh-terminal-fit-js");
				if (!window.Terminal) throw new Error("xterm.js failed to load");
				if (!(window.FitAddon?.FitAddon || typeof window.FitAddon === "function")) {
					throw new Error("FitAddon failed to load");
				}
			})();
			try {
				await xtermReady;
			} catch (err) {
				xtermReady = null;
				throw err;
			}
		}

		function FitCtor() {
			if (window.FitAddon?.FitAddon) return window.FitAddon.FitAddon;
			if (typeof window.FitAddon === "function") return window.FitAddon;
			throw new Error("FitAddon missing");
		}

		function newPaneKey() {
			return typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: "t-" + Math.random().toString(36).slice(2);
		}

		function shellBase(shell) {
			if (!shell || typeof shell !== "string") return "bash";
			const parts = shell.split("/");
			return parts[parts.length - 1] || "bash";
		}

		function TerminalPane({ sessionId, connection, active, onStatus, restartToken }) {
			const hostRef = React.useRef(null);
			const termRef = React.useRef(null);
			const fitRef = React.useRef(null);
			const termIdRef = React.useRef(null);
			const closedRef = React.useRef(false);
			const genRef = React.useRef(0);
			const statusRef = React.useRef(onStatus);
			statusRef.current = onStatus;

			const disposeTerminal = React.useCallback(() => {
				try {
					termRef.current?._dshCleanup?.();
					termRef.current?.dispose();
				} catch {
					/* ignore */
				}
				termRef.current = null;
				fitRef.current = null;
			}, []);

			React.useEffect(() => {
				if (!connection) return undefined;
				const activeWs = typeof window !== "undefined" && window.__dshCurrentWorkspace?.get?.();
				const wsCwd = activeWs?.cwd;
				if (!sessionId && !wsCwd) return undefined;
				let cancelled = false;

				const openTerm = async () => {
					if (!hostRef.current) return;
					const gen = ++genRef.current;
					closedRef.current = false;
					statusRef.current?.({ phase: "loading", meta: "Starting…" });
					try {
						await ensureXterm(connection);
						if (cancelled || gen !== genRef.current) return;

						if (termIdRef.current) {
							await callRpc(connection, "close", { termId: termIdRef.current }).catch(() => {});
							termIdRef.current = null;
						}
						disposeTerminal();
						hostRef.current.innerHTML = "";

						const term = new window.Terminal({
							cursorBlink: true,
							cursorStyle: "bar",
							fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace',
							fontSize: 13,
							lineHeight: 1.2,
							convertEol: true,
							theme: XTERM_THEME,
							allowProposedApi: true,
						});
						const fit = new (FitCtor())();
						term.loadAddon(fit);
						term.open(hostRef.current);
						fit.fit();
						termRef.current = term;
						fitRef.current = fit;

						const cols = Math.max(term.cols || 80, 40);
						const rows = Math.max(term.rows || 24, 10);
						const res = await callRpc(connection, "open", {
							sessionId,
							workspaceCwd: wsCwd || undefined,
							cols,
							rows,
						});
						if (cancelled || gen !== genRef.current) {
							await callRpc(connection, "close", { termId: res.termId }).catch(() => {});
							return;
						}
						termIdRef.current = res.termId;
						const shell = shellBase(res.shell);
						statusRef.current?.({
							phase: "ready",
							meta: `${shell} · ${res.cwd || ""}`,
							shell,
						});

						term.onData((data) => {
							const id = termIdRef.current;
							if (!id || closedRef.current) return;
							callRpc(connection, "write", { termId: id, data }).catch((err) => {
								statusRef.current?.({
									phase: "error",
									meta: err?.message || String(err),
								});
							});
						});

						const onResize = () => {
							try {
								if (!hostRef.current || hostRef.current.clientWidth < 8) return;
								fit.fit();
								const id = termIdRef.current;
								if (id && !closedRef.current) {
									callRpc(connection, "resize", {
										termId: id,
										cols: term.cols,
										rows: term.rows,
									}).catch(() => {});
								}
							} catch {
								/* ignore */
							}
						};
						const ro = typeof ResizeObserver !== "undefined"
							? new ResizeObserver(() => onResize())
							: null;
						if (ro && hostRef.current) ro.observe(hostRef.current);
						window.addEventListener("resize", onResize);
						term._dshCleanup = () => {
							ro?.disconnect();
							window.removeEventListener("resize", onResize);
						};
						requestAnimationFrame(() => onResize());
					} catch (err) {
						if (cancelled || gen !== genRef.current) return;
						statusRef.current?.({
							phase: "error",
							meta: err?.message || String(err),
						});
					}
				};

				const t = setTimeout(openTerm, 0);
				return () => {
					cancelled = true;
					clearTimeout(t);
					genRef.current += 1;
					const id = termIdRef.current;
					termIdRef.current = null;
					disposeTerminal();
					if (id && connection) callRpc(connection, "close", { termId: id }).catch(() => {});
				};
			}, [sessionId, connection, disposeTerminal, restartToken]);

			React.useEffect(() => {
				if (!connection) return undefined;
				let alive = true;
				const tick = async () => {
					const id = termIdRef.current;
					const term = termRef.current;
					if (!id || !term || closedRef.current) return;
					try {
						const res = await callRpc(connection, "read", { termId: id });
						if (!alive) return;
						if (res.data) term.write(res.data);
						if (res.closed) {
							closedRef.current = true;
							statusRef.current?.((prev) => ({
								phase: "exited",
								meta: String(prev?.meta || "").includes("(exited)")
									? prev.meta
									: `${prev?.meta || "shell"} (exited)`,
								shell: prev?.shell,
							}));
						}
					} catch {
						/* ignore */
					}
				};
				const iv = setInterval(tick, 50);
				tick();
				return () => {
					alive = false;
					clearInterval(iv);
				};
			}, [connection, sessionId]);

			React.useEffect(() => {
				if (!active) return;
				try {
					const fit = fitRef.current;
					const term = termRef.current;
					if (fit && hostRef.current && hostRef.current.clientWidth >= 8) {
						fit.fit();
						const id = termIdRef.current;
						if (id && !closedRef.current && term) {
							callRpc(connection, "resize", {
								termId: id,
								cols: term.cols,
								rows: term.rows,
							}).catch(() => {});
						}
					}
					term?.focus();
				} catch {
					/* ignore */
				}
			}, [active, connection]);

			return React.createElement("div", {
				className: "dt_host" + (active ? "" : " dt_hostHidden"),
				ref: hostRef,
				onClick: () => active && termRef.current?.focus(),
			});
		}

		function TerminalView({ sessionId, connection }) {
			const firstKey = React.useMemo(() => newPaneKey(), []);
			const [panes, setPanes] = React.useState(() => [{ key: firstKey, restart: 0 }]);
			const [activeKey, setActiveKey] = React.useState(firstKey);
			const [statusByKey, setStatusByKey] = React.useState({});
			const [error, setError] = React.useState("");

			React.useEffect(() => { ensureStyles(); }, []);

			const setPaneStatus = React.useCallback((key, value) => {
				setStatusByKey((prev) => {
					const cur = prev[key] || {};
					const next = typeof value === "function" ? value(cur) : value;
					if (next?.phase === "error" && next.meta) setError(next.meta);
					else if (next?.phase === "ready") setError("");
					return { ...prev, [key]: next };
				});
			}, []);

			const addPane = () => {
				const key = newPaneKey();
				setPanes((prev) => [...prev, { key, restart: 0 }]);
				setActiveKey(key);
			};

			const closePane = (key) => {
				setPanes((prev) => {
					if (prev.length <= 1) return prev;
					const idx = prev.findIndex((p) => p.key === key);
					const next = prev.filter((p) => p.key !== key);
					if (activeKey === key) {
						const fallback = next[Math.max(0, idx - 1)] || next[0];
						setActiveKey(fallback.key);
					}
					return next;
				});
				setStatusByKey((m) => {
					const copy = { ...m };
					delete copy[key];
					return copy;
				});
			};

			const restartActive = () => {
				setPanes((prev) => prev.map((p) => (
					p.key === activeKey ? { ...p, restart: (p.restart || 0) + 1 } : p
				)));
			};

			if (!connection) {
				return React.createElement("div", { className: "dt_empty" }, "Terminal: connection unavailable");
			}
			const activeWs = typeof window !== "undefined" && window.__dshCurrentWorkspace?.get?.();
			if (!sessionId && !activeWs?.cwd) {
				return React.createElement("div", { className: "dt_empty" },
					"Open or start a session, or select a workspace in the sidebar, so Terminal can use its workspace cwd.");
			}

			const activeStatus = statusByKey[activeKey] || {};

			return React.createElement("div", { className: "dt_root" },
				React.createElement("div", { className: "dt_tabbar", role: "tablist" },
					React.createElement("div", { className: "dt_tabs" },
						panes.map((p, i) => {
							const st = statusByKey[p.key] || {};
							const label = st.shell
								? (panes.length > 1 ? `${st.shell} ${i + 1}` : st.shell)
								: `Terminal ${i + 1}`;
							return React.createElement("button", {
								key: p.key,
								type: "button",
								role: "tab",
								"aria-selected": p.key === activeKey,
								className: "dt_tab" + (p.key === activeKey ? " dt_tabActive" : ""),
								title: st.meta || label,
								onClick: () => setActiveKey(p.key),
								onMouseDown: (e) => {
									if (e.button === 1) {
										e.preventDefault();
										closePane(p.key);
									}
								},
							},
								React.createElement("span", { className: "dt_tabLabel" }, label),
								panes.length > 1 && React.createElement("span", {
									className: "dt_tabClose",
									role: "button",
									title: "Close",
									onClick: (e) => {
										e.stopPropagation();
										closePane(p.key);
									},
								}, "×"),
							);
						}),
						React.createElement("button", {
							type: "button",
							className: "dt_tabAdd",
							title: "New terminal",
							"aria-label": "New terminal",
							onClick: addPane,
						}, "+"),
					),
					React.createElement("div", { className: "dt_actions" },
						React.createElement("span", { className: "dt_meta" }, activeStatus.meta || ""),
						React.createElement("button", {
							type: "button",
							className: "dt_btn",
							onClick: restartActive,
						}, "Restart"),
					),
				),
				error && React.createElement("div", { className: "dt_err" }, error),
				React.createElement("div", { className: "dt_stack" },
					panes.map((p) => React.createElement(TerminalPane, {
						key: p.key,
						sessionId,
						connection,
						active: p.key === activeKey,
						restartToken: p.restart || 0,
						onStatus: (value) => setPaneStatus(p.key, value),
					})),
				),
			);
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			ensureStyles();

			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "terminal",
				order: 8,
				label: () => "Terminal",
				inject: (sessionId) => ({ sessionId, connection }),
			}, TerminalView)), `${PLUGIN}: tab`);

			ctx.effect(() => {
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
				return window.__dshHeroToolRegistry.register("terminal", (opts) =>
					React.createElement(TerminalView, {
						connection,
						sessionId: opts?.sessionId
							|| (() => {
								try {
									const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
									return parsed?.sessionId || null;
								} catch {
									return null;
								}
							})(),
					}));
			}, `${PLUGIN}: hero`);
		}

		return { apply, inject };
	},
});

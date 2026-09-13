window.__ModuleLoader__.load({
	id: "dsh-containers",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-containers";
		const RPC = "/containers";

		/** Survives ContainersView unmount when switching conversation.view tabs. */
		const viewCache = { selected: null, logs: "", envMode: "all" };

		const css = `
/* When Containers tab is active, stop the chat scrollBody from growing with the list. */
.wSkVaW_scrollBody:has(.dc_root){overflow:hidden!important;display:flex;flex-direction:column;min-height:0}
.wSkVaW_scrollBody:has(.dc_root)>.wSkVaW_viewArea,
.wSkVaW_viewArea:has(.dc_root){flex:1 1 0!important;min-height:0!important;overflow:hidden!important;position:relative!important;height:auto!important}
.wSkVaW_viewArea:has(.dc_root)>div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dc_root{display:flex;flex-direction:column;flex:1 1 0;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base)}
.dc_bar{display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:wrap;flex-shrink:0}
.dc_meta{flex:1;font-size:13px;color:var(--dsw-alias-label-secondary);min-width:0}
.dc_select{height:30px;min-width:120px;max-width:220px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:12px}
.dc_btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer}
.dc_btn:disabled{opacity:.5;cursor:not-allowed}
.dc_ports{font-size:11px;color:var(--dsw-alias-label-secondary);font-family:var(--ds-font-family-code);margin-top:2px;line-height:1.35}
.dc_portsEmpty{color:var(--dsw-alias-label-tertiary);font-family:inherit}
.dc_tagTest{font-size:10px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;color:#93c5fd;border:1px solid rgba(59,130,246,.4);background:rgba(59,130,246,.12);border-radius:999px;padding:1px 7px;margin-left:6px;flex:none}
.dc_body{flex:1 1 0;min-height:0;overflow:hidden;display:grid;grid-template-columns:minmax(280px,1fr) minmax(0,1.2fr);grid-template-rows:minmax(0,1fr)}
.dc_list{min-height:0;height:100%;overflow:auto;border-right:1px solid var(--dsw-alias-border-l2);padding:8px;-webkit-overflow-scrolling:touch}
.dc_row{padding:8px 10px 8px 12px;border-radius:10px;cursor:pointer;margin-bottom:4px;border:1px solid transparent;border-left-width:3px;border-left-style:solid;border-left-color:transparent}
.dc_row:hover,.dc_rowActive{background:var(--dsw-alias-interactive-bg-hover);border-color:var(--dsw-alias-border-l2)}
.dc_rowOk,.dc_rowOk:hover,.dc_rowOk.dc_rowActive{border-left-color:#22c55e}
.dc_rowWarn,.dc_rowWarn:hover,.dc_rowWarn.dc_rowActive{border-left-color:#eab308}
.dc_rowOff,.dc_rowOff:hover,.dc_rowOff.dc_rowActive{border-left-color:#ef4444}
.dc_rowMuted,.dc_rowMuted:hover,.dc_rowMuted.dc_rowActive{border-left-color:#6b7280}
.dc_head{display:flex;align-items:center;gap:8px;min-width:0}
.dc_name{font-size:13px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0;flex:1}
.dc_badge{display:inline-flex;align-items:center;gap:5px;flex:none;height:20px;padding:0 8px;border-radius:999px;font-size:10px;font-weight:600;letter-spacing:.02em;text-transform:uppercase}
.dc_badge::before{content:"";width:6px;height:6px;border-radius:50%;background:currentColor;flex:none}
.dc_badgeOk{color:#86efac;background:rgba(34,197,94,.14);border:1px solid rgba(34,197,94,.35)}
.dc_badgeWarn{color:#fde047;background:rgba(234,179,8,.14);border:1px solid rgba(234,179,8,.4)}
.dc_badgeOff{color:#fca5a5;background:rgba(239,68,68,.14);border:1px solid rgba(239,68,68,.35)}
.dc_badgeMuted{color:#9ca3af;background:rgba(107,114,128,.14);border:1px solid rgba(107,114,128,.35)}
.dc_sub{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);margin-top:2px}
.dc_stats{display:flex;gap:10px;margin-top:6px;font-size:11px;font-family:var(--ds-font-family-code);color:var(--dsw-alias-label-secondary);flex-wrap:wrap}
.dc_stat{display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:999px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2)}
.dc_statLabel{color:var(--dsw-alias-label-tertiary);font-size:10px;text-transform:uppercase;letter-spacing:.02em}
.dc_actions{display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center}
.dc_logs{margin:0;min-height:0;height:100%;overflow:auto;padding:12px;font-family:var(--ds-font-family-code);font-size:11px;line-height:1.45;white-space:pre-wrap;-webkit-overflow-scrolling:touch}
.dc_err{color:var(--dsw-alias-state-error-primary);padding:12px 14px;font-size:13px;flex-shrink:0}
.dc_footer{flex-shrink:0;border-top:1px solid var(--dsw-alias-border-l2)}
.dc_settings{padding:10px 14px;display:flex;gap:8px;align-items:center}
.dc_input{flex:1;height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px}
.dc_hint{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:8px 14px 0}
@media (max-width:900px){.dc_body{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) minmax(0,1fr)}.dc_list{border-right:none;border-bottom:1px solid var(--dsw-alias-border-l2)}}
.dc_btnActive{border-color:var(--dsw-alias-state-business-primary,#3d8bfd);color:var(--dsw-alias-state-business-primary,#3d8bfd)}
.dc_btnOpen{display:inline-flex;align-items:center;gap:5px}
.dc_testenvPanel{flex-shrink:0;flex-basis:min(46vh,420px);height:min(46vh,420px);overflow:hidden;border-bottom:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column}
.dc_testenvPanel .dte_root{height:100%;min-height:0}
`;
		function ensureStyles() {
			if (typeof document === "undefined") return;
			const existing = document.getElementById("dsh-containers-css");
			if (existing) existing.remove();
			const t = document.createElement("style");
			t.id = "dsh-containers-css";
			t.textContent = css;
			document.head.appendChild(t);
		}

		/** Extract the host-side port number from a "hostPort→containerPort" entry. */
		function hostPortOf(portStr) {
			const m = /^(\d+)/.exec(String(portStr || "").trim());
			return m ? m[1] : null;
		}

		/** Fallback LAN address for "This host" when the page itself was loaded via a public
		 * domain (e.g. agent.rubberrobo.nl) — that hostname can't reach an arbitrary container
		 * port, but the Browser tab's server-side proxy (/api/browser-gate/...) can reach the
		 * Docker host's LAN IP directly. */
		const LOCAL_HOST_LAN_FALLBACK = "192.168.0.130";
		const IPV4_RE = /^(\d{1,3}\.){3}\d{1,3}$/;

		function hostnameFor(hostId, hosts) {
			const h = Array.isArray(hosts) ? hosts.find((x) => x.id === hostId) : null;
			if (h && h.endpoint) {
				try {
					const u = new URL(h.endpoint.replace(/^ssh:\/\//, "http://").replace(/^tcp:\/\//, "http://"));
					if (u.hostname) return u.hostname;
				} catch { /* fall through */ }
			}
			const pageHost = (typeof window !== "undefined" && window.location && window.location.hostname) || "";
			if (IPV4_RE.test(pageHost) || pageHost === "localhost") return pageHost;
			return LOCAL_HOST_LAN_FALLBACK;
		}

		function globeIcon() {
			return React.createElement("svg", {
				viewBox: "0 0 24 24", width: "13", height: "13", fill: "none", stroke: "currentColor",
				strokeWidth: "2", strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": "true",
				style: { flex: "none" },
			},
				React.createElement("circle", { cx: "12", cy: "12", r: "10" }),
				React.createElement("path", { d: "M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" }),
				React.createElement("path", { d: "M2 12h20" }),
			);
		}

		/** Open a container's published port in the built-in Browser tab. */
		function openContainerPort(hostPort, hostId, hosts) {
			if (typeof window === "undefined" || !hostPort) return;
			const url = `http://${hostnameFor(hostId, hosts)}:${hostPort}`;
			window.dispatchEvent(new CustomEvent("dsh-open-browser-url", { detail: { url } }));
			const tabs = document.querySelectorAll('[role="tab"]');
			for (const tab of tabs) {
				const label = (tab.getAttribute("data-dsh-tab-label") || tab.textContent || "").trim();
				if (label === "Browser") {
					tab.click();
					break;
				}
			}
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		/** @returns {{ tone: "ok"|"warn"|"off"|"muted", label: string }} */
		function statusTone(c) {
			const state = String(c.state || "").toLowerCase();
			const status = String(c.status || "").toLowerCase();
			if (state === "running") {
				if (status.includes("unhealthy")) return { tone: "off", label: "unhealthy" };
				if (status.includes("health: starting") || /\(health:\s*starting\)/.test(status)) {
					return { tone: "warn", label: "starting" };
				}
				if (status.includes("(healthy)")) return { tone: "ok", label: "healthy" };
				return { tone: "ok", label: "running" };
			}
			if (state === "restarting") return { tone: "warn", label: "restarting" };
			if (state === "paused") return { tone: "warn", label: "paused" };
			if (state === "created") return { tone: "warn", label: "ready" };
			if (state === "exited" || state === "dead" || state === "removing") {
				return { tone: "off", label: state === "removing" ? "removing" : "stopped" };
			}
			return { tone: "muted", label: state || "unknown" };
		}

		function formatStats(c) {
			if (!c.cpu && !c.mem) return null;
			return React.createElement("div", { className: "dc_stats" },
				c.cpu && React.createElement("span", { className: "dc_stat" },
					React.createElement("span", { className: "dc_statLabel" }, "CPU"),
					c.cpu,
				),
				c.mem && React.createElement("span", { className: "dc_stat" },
					React.createElement("span", { className: "dc_statLabel" }, "RAM"),
					c.mem + (c.memPerc ? ` (${c.memPerc})` : ""),
				),
			);
		}

		function ContainersView({ connection, sessionId }) {
			const [items, setItems] = React.useState([]);
			const [hosts, setHosts] = React.useState([{ id: "local", label: "This host", endpoint: "" }]);
			const [hostId, setHostId] = React.useState("local");
			const [envMode, setEnvMode] = React.useState(() => {
				const m = viewCache.envMode || "all";
				return m === "sandbox" ? "test" : m;
			});
			const [selected, setSelected] = React.useState(() => viewCache.selected);
			const [logs, setLogs] = React.useState(() => viewCache.logs || "");
			const [error, setError] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [allowText, setAllowText] = React.useState("");
			const [showTestEnv, setShowTestEnv] = React.useState(() => !!viewCache.showTestEnv);

			React.useEffect(() => {
				viewCache.selected = selected;
				viewCache.logs = logs;
				viewCache.envMode = envMode;
				viewCache.showTestEnv = showTestEnv;
			}, [selected, logs, envMode, showTestEnv]);

			const refresh = React.useCallback(async () => {
				if (!connection) return;
				setBusy(true);
				setError("");
				try {
					const res = await callRpc(connection, "list", { hostId, env: envMode });
					const next = res.containers || [];
					setItems(next);
					if (Array.isArray(res.hosts) && res.hosts.length) setHosts(res.hosts);
					if (res.hostId) setHostId(res.hostId);
					setAllowText((res.allowPrefixes || []).join(", "));
					setSelected((prev) => {
						const want = prev || viewCache.selected;
						if (!want) return prev;
						return next.find((c) => c.id === want.id || c.name === want.name) || null;
					});
				} catch (err) {
					setError(err?.message || String(err));
					setItems([]);
				} finally {
					setBusy(false);
				}
			}, [connection, hostId, envMode]);

			React.useEffect(() => {
				ensureStyles();
				refresh();
				const iv = setInterval(() => { refresh(); }, 15000);
				return () => clearInterval(iv);
			}, [refresh]);

			React.useEffect(() => {
				if (!connection || !selected?.id) return;
				let cancelled = false;
				(async () => {
					try {
						const res = await callRpc(connection, "logs", { id: selected.id, tail: 200, hostId });
						if (!cancelled) setLogs(res.logs || "");
					} catch (err) {
						if (!cancelled) setLogs(err?.message || String(err));
					}
				})();
				return () => { cancelled = true; };
			}, [connection, selected?.id, hostId]);

			const act = async (endpoint, id) => {
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, endpoint, { id, hostId });
					await refresh();
					if (selected?.id === id || selected?.name === id) {
						const res = await callRpc(connection, "logs", { id, tail: 200, hostId });
						setLogs(res.logs || "");
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const saveAllow = async () => {
				const allowPrefixes = allowText.split(",").map((s) => s.trim()).filter(Boolean);
				setBusy(true);
				try {
					await callRpc(connection, "setConfig", { allowPrefixes });
					await refresh();
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const switchHost = async (nextId) => {
				setHostId(nextId);
				setSelected(null);
				setLogs("");
				setBusy(true);
				setError("");
				try {
					await callRpc(connection, "setConfig", { activeHostId: nextId });
					const res = await callRpc(connection, "list", { hostId: nextId, env: envMode });
					setItems(res.containers || []);
					if (Array.isArray(res.hosts) && res.hosts.length) setHosts(res.hosts);
				} catch (err) {
					setError(err?.message || String(err));
					setItems([]);
				} finally {
					setBusy(false);
				}
			};

			if (!connection) {
				return React.createElement("div", { className: "dc_err" }, "Containers: connection unavailable");
			}

			const hostLabel = hosts.find((h) => h.id === hostId)?.label || hostId;

			return React.createElement("div", { className: "dc_root" },
				React.createElement("div", { className: "dc_bar" },
					React.createElement("select", {
						className: "dc_select",
						value: hostId,
						title: "Docker host",
						onChange: (e) => switchHost(e.target.value),
						disabled: busy,
					}, hosts.map((h) => React.createElement("option", { key: h.id, value: h.id }, h.label))),
					React.createElement("select", {
						className: "dc_select",
						value: envMode,
						title: "Environment",
						onChange: (e) => {
							setEnvMode(e.target.value);
							setSelected(null);
							setLogs("");
						},
						disabled: busy,
					},
						React.createElement("option", { value: "all" }, "All"),
						React.createElement("option", { value: "live" }, "Live"),
						React.createElement("option", { value: "test" }, "Test"),
					),
					React.createElement("span", { className: "dc_meta" },
						`${items.length} · ${hostLabel}`
						+ (envMode === "test" ? " · test" : envMode === "live" ? " · live" : "")),
					React.createElement("button", {
						type: "button",
						className: "dc_btn" + (showTestEnv ? " dc_btnActive" : ""),
						"aria-pressed": showTestEnv ? "true" : "false",
						title: "Register / manage test environments",
						onClick: () => setShowTestEnv((v) => !v),
					}, showTestEnv ? "▾ Test envs" : "▸ Test envs"),
					React.createElement("button", { type: "button", className: "dc_btn", disabled: busy, onClick: refresh }, busy ? "Refreshing…" : "Refresh"),
					typeof window !== "undefined" && typeof window.__dshSettingsGear === "function"
						? window.__dshSettingsGear(React, { section: "containers", title: "Containers settings" })
						: React.createElement("button", {
							type: "button",
							className: "dsh_tabSettingsBtn dc_btn",
							title: "Containers settings",
							onClick: () => {
								if (typeof window.__dshOpenSettings === "function") window.__dshOpenSettings("containers");
								else window.dispatchEvent(new CustomEvent("dsh:open-settings", { detail: { section: "containers" } }));
							},
						}, "⚙"),
				),
				error && React.createElement("div", { className: "dc_err" }, error),
				showTestEnv && React.createElement("div", { className: "dc_testenvPanel" },
					typeof window !== "undefined" && window.__dshHeroToolRegistry?.get?.("testenv")
						? window.__dshHeroToolRegistry.get("testenv")()
						: React.createElement("div", { className: "dc_hint", style: { padding: 14 } },
							"Test envs module unavailable — is dsh-testenv loaded?"),
				),
				React.createElement("div", { className: "dc_body" },
					React.createElement("div", { className: "dc_list" },
						items.length === 0 && !busy && React.createElement("div", {
							style: { padding: 16, fontSize: 13, color: "var(--dsw-alias-label-tertiary)", lineHeight: 1.45 },
						}, envMode === "test"
							? "No test containers. Open the Test envs section above to clone a stack and Start it."
							: "No containers on this host (or allowlist filtered them all)."),
						items.map((c) => {
							const tone = statusTone(c);
							const toneClass = tone.tone === "ok" ? "Ok"
								: tone.tone === "warn" ? "Warn"
									: tone.tone === "off" ? "Off" : "Muted";
							const ports = Array.isArray(c.portList) ? c.portList : [];
							const isTest = !!(c.test || c.sandbox);
							return React.createElement("div", {
								key: c.id,
								className: `dc_row dc_row${toneClass}` + (selected?.id === c.id ? " dc_rowActive" : ""),
								onClick: () => setSelected(c),
							},
								React.createElement("div", { className: "dc_head" },
									React.createElement("div", { className: "dc_name" },
										c.name || c.id,
										isTest ? React.createElement("span", { className: "dc_tagTest" }, "test") : null,
									),
									React.createElement("span", { className: `dc_badge dc_badge${toneClass}` }, tone.label),
								),
								React.createElement("div", { className: "dc_sub" },
									`${c.status || c.state || ""} · ${c.image || ""}`),
								React.createElement("div", {
									className: "dc_ports" + (ports.length ? "" : " dc_portsEmpty"),
								}, ports.length ? `ports ${ports.join(", ")}` : "no published ports"),
								formatStats(c),
								React.createElement("div", { className: "dc_actions" },
									React.createElement("button", { type: "button", className: "dc_btn", disabled: busy, onClick: (e) => { e.stopPropagation(); act("start", c.id); } }, "Start"),
									React.createElement("button", { type: "button", className: "dc_btn", disabled: busy, onClick: (e) => { e.stopPropagation(); act("stop", c.id); } }, "Stop"),
									React.createElement("button", { type: "button", className: "dc_btn", disabled: busy, onClick: (e) => { e.stopPropagation(); act("restart", c.id); } }, "Restart"),
									...[...new Set(ports.map(hostPortOf).filter(Boolean))].map((hp) =>
										React.createElement("button", {
											type: "button",
											key: "open-" + hp,
											className: "dc_btn dc_btnOpen",
											title: `Open :${hp} in the built-in browser`,
											onClick: (e) => { e.stopPropagation(); openContainerPort(hp, hostId, hosts); },
										}, globeIcon(), `:${hp}`)),
								),
							);
						}),
					),
					React.createElement("pre", { className: "dc_logs" }, logs || "Select a container to view logs."),
				),
				React.createElement("div", { className: "dc_footer" },
					React.createElement("div", { className: "dc_hint" },
						"Allowlist: name prefixes (empty = all). Env = Live vs Test filter. Create/manage stacks in the Test envs section above."),
					React.createElement("div", { className: "dc_settings" },
						React.createElement("input", {
							className: "dc_input",
							value: allowText,
							placeholder: "e.g. cobblemon, pchamp, deepseek",
							onChange: (e) => setAllowText(e.target.value),
						}),
						React.createElement("button", { type: "button", className: "dc_btn", disabled: busy, onClick: saveAllow }, "Save allowlist"),
					),
				),
			);
		}

		function ContainersSettings({ connection }) {
			const [allowText, setAllowText] = React.useState("");
			const [hosts, setHosts] = React.useState([{ id: "local", label: "This host", endpoint: "" }]);
			const [draftLabel, setDraftLabel] = React.useState("Jetson");
			const [draftEndpoint, setDraftEndpoint] = React.useState("ssh://mic-733ao@192.168.0.146");
			const [msg, setMsg] = React.useState("");
			const [busy, setBusy] = React.useState(false);

			const reload = React.useCallback(() => {
				if (!connection) return;
				callRpc(connection, "getConfig").then((c) => {
					setAllowText((c.allowPrefixes || []).join(", "));
					if (Array.isArray(c.hosts) && c.hosts.length) setHosts(c.hosts);
				}).catch((err) => setMsg(err.message));
			}, [connection]);

			React.useEffect(() => { reload(); }, [reload]);

			const saveHosts = async (nextHosts, extra = {}) => {
				setBusy(true);
				setMsg("");
				try {
					const cfg = await callRpc(connection, "setConfig", {
						hosts: nextHosts,
						allowPrefixes: allowText.split(",").map((s) => s.trim()).filter(Boolean),
						...extra,
					});
					setHosts(cfg.hosts || nextHosts);
					setMsg("Saved");
				} catch (err) {
					setMsg(err.message);
				} finally {
					setBusy(false);
				}
			};

			const addHost = async () => {
				const label = draftLabel.trim() || "Remote";
				const endpoint = draftEndpoint.trim();
				if (!endpoint) {
					setMsg("Endpoint required (e.g. ssh://user@192.168.0.146)");
					return;
				}
				const id = label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `host-${Date.now()}`;
				if (hosts.some((h) => h.id === id || h.endpoint === endpoint)) {
					setMsg("Host already exists");
					return;
				}
				await saveHosts([...hosts, { id, label, endpoint }]);
			};

			const removeHost = async (id) => {
				if (id === "local") return;
				await saveHosts(hosts.filter((h) => h.id !== id));
			};

			const testHost = async (h) => {
				setBusy(true);
				setMsg("");
				try {
					const res = await callRpc(connection, "pingHost", { hostId: h.id });
					setMsg(`OK — ${h.label}: Docker engine “${res.name || "unnamed"}”`);
				} catch (err) {
					setMsg(`${h.label}: ${err.message}`);
				} finally {
					setBusy(false);
				}
			};

			return React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 16, maxWidth: 720 } },
				React.createElement("div", null,
					React.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "Docker hosts"),
					React.createElement("p", { style: { margin: "0 0 10px", fontSize: 12, color: "var(--dsw-alias-label-tertiary)", lineHeight: 1.45 } },
						"This Harness container talks to Docker on the machine where it runs (mounted socket). To list containers on another PC (e.g. Jetson), add an SSH or TCP endpoint. SSH needs a key available to the Harness process (HOME/.ssh)."),
					hosts.map((h) => React.createElement("div", {
						key: h.id,
						style: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8, flexWrap: "wrap" },
					},
						React.createElement("span", { style: { minWidth: 100, fontSize: 13 } }, h.label),
						React.createElement("code", { style: { flex: 1, fontSize: 11, opacity: 0.75, minWidth: 160 } },
							h.endpoint || "unix:///var/run/docker.sock (local)"),
						React.createElement("button", {
							type: "button",
							disabled: busy,
							onClick: () => testHost(h),
							style: { height: 28, borderRadius: 8, padding: "0 10px", cursor: "pointer" },
						}, "Test"),
						h.id !== "local" && React.createElement("button", {
							type: "button",
							disabled: busy,
							onClick: () => removeHost(h.id),
							style: { height: 28, borderRadius: 8, padding: "0 10px", cursor: "pointer" },
						}, "Remove"),
					)),
					React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: 8, marginTop: 8 } },
						React.createElement("input", {
							value: draftLabel,
							onChange: (e) => setDraftLabel(e.target.value),
							placeholder: "Label (e.g. Jetson)",
							style: { height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", padding: "0 10px" },
						}),
						React.createElement("input", {
							value: draftEndpoint,
							onChange: (e) => setDraftEndpoint(e.target.value),
							placeholder: "ssh://user@host  or  tcp://host:2375",
							style: { height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", padding: "0 10px", fontFamily: "var(--ds-font-family-code)" },
						}),
						React.createElement("button", {
							type: "button",
							disabled: busy,
							onClick: addHost,
							style: { height: 32, borderRadius: 8, alignSelf: "flex-start", padding: "0 12px", cursor: "pointer" },
						}, "Add host"),
					),
				),
				React.createElement("div", null,
					React.createElement("div", { style: { fontSize: 13, fontWeight: 600, marginBottom: 6 } }, "Name allowlist"),
					React.createElement("p", { style: { margin: "0 0 8px", fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } },
						"Optional container name-prefix filter (applies to every host). Empty = show all."),
					React.createElement("input", {
						value: allowText,
						onChange: (e) => setAllowText(e.target.value),
						placeholder: "prefix1, prefix2",
						style: { height: 32, borderRadius: 8, border: "1px solid var(--dsw-alias-border-l2)", padding: "0 10px", width: "100%", boxSizing: "border-box" },
					}),
					React.createElement("button", {
						type: "button",
						disabled: busy,
						onClick: () => saveHosts(hosts),
						style: { height: 32, borderRadius: 8, alignSelf: "flex-start", padding: "0 12px", cursor: "pointer", marginTop: 8 },
					}, "Save allowlist"),
				),
				msg && React.createElement("div", { style: { fontSize: 12, whiteSpace: "pre-wrap" } }, msg),
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
				id: "containers",
				order: 7,
				label: () => "Containers",
				inject: (sessionId) => ({ sessionId, connection }),
			}, ContainersView)), `${PLUGIN}: tab`);

			ctx.effect(() => {
				ensureHeroRegistry();
				return window.__dshHeroToolRegistry.register("containers", () =>
					React.createElement(ContainersView, { connection, sessionId: null }));
			}, `${PLUGIN}: hero`);

			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "containers",
					order: 190,
					label: () => "Containers",
					inject: () => ({ connection }),
				}, ContainersSettings), `${PLUGIN}: settings`);
			} catch (err) {
				console.warn(`[${PLUGIN}] settings inject failed`, err);
			}
		}

		return { apply, inject };
	},
});

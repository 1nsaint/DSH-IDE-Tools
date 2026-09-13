// dsh-ssh-workspace — SSH hosts, remote workspace picker, sidebar chips, Settings UI.
window.__ModuleLoader__.load({
	id: "dsh-ssh-workspace",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		let ReactDOMClient = null;
		try { ReactDOMClient = require("react-dom/client"); } catch { ReactDOMClient = null; }

		const PLUGIN = "dsh-ssh-workspace";
		const RPC = "/ssh-workspace";
		const HOST_ID = "dsh-ssh-workspace-host";
		const CHIP_CLASS = "dsh-ssh-ws-chip";
		const LOCAL_WORKSPACE_ROOT = "/workspace";

		const css = `
#${HOST_ID}{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:24px}
.dsw-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55)}
.dsw-dialog{position:relative;z-index:2;width:min(560px,96vw);max-height:min(75vh,720px);display:flex;flex-direction:column;border-radius:16px;overflow:hidden;background:var(--dsw-alias-bg-layer-1,#1b1d21);border:1px solid var(--dsw-alias-border-l2,#333);box-shadow:0 18px 48px rgba(0,0,0,.45)}
.dsw-head{padding:14px 16px 10px;border-bottom:1px solid var(--dsw-alias-border-l2,#333)}
.dsw-title{margin:0;font-size:16px;font-weight:600}
.dsw-tabs{display:flex;gap:6px;margin-top:10px}
.dsw-tab{height:30px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:transparent;color:inherit;font:inherit;font-size:12px;cursor:pointer}
.dsw-tabOn{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08));font-weight:600}
.dsw-list{flex:1;min-height:160px;overflow:auto;padding:8px}
.dsw-row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:transparent;color:inherit;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;cursor:pointer}
.dsw-row:hover,.dsw-row.selected{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsw-foot{display:flex;gap:8px;padding:12px 14px;border-top:1px solid var(--dsw-alias-border-l2,#333);align-items:center;flex-wrap:wrap}
.dsw-btn{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#222);color:inherit;font:inherit;font-size:13px;cursor:pointer}
.dsw-btnPrimary{background:var(--dsw-alias-label-primary,#eee);color:#111;border-color:transparent;font-weight:600}
.dsw-status{padding:12px 16px;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}
.dsw-status.err{color:var(--dsw-alias-state-error-primary,#f66)}
.dsw-path{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:4px}
.dsw-crumb{border:none;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:11px;padding:0}
.dsw-crumb:hover{text-decoration:underline}
.${CHIP_CLASS}{
  display:inline-flex;align-items:center;margin-left:6px;padding:1px 6px;border-radius:999px;
  font-size:9px;font-weight:600;letter-spacing:.03em;text-transform:uppercase;vertical-align:middle;
  background:var(--dsw-alias-bg-layer-2,#2a2d33);color:var(--dsw-alias-label-secondary,#aaa);
  border:1px solid var(--dsw-alias-border-l2,#444);max-width:88px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.${CHIP_CLASS}[data-kind="local"]{opacity:.75}
.dsw-settings{max-width:720px;display:flex;flex-direction:column;gap:12px}
.dsw-hostRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 0;border-bottom:1px solid var(--dsw-alias-border-l2,#333)}
.dsw-input{height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:0 10px;font:inherit;font-size:12px;min-width:120px;flex:1}
.dsw-msg{font-size:12px;color:var(--dsw-alias-label-tertiary)}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-ssh-workspace-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-ssh-workspace-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		let activeConnection = null;
		let bindingsCache = { bindings: [], hosts: [] };
		let reactRoot = null;

		async function callRpc(connection, endpoint, payload) {
			const res = await connection.rpc.call(RPC, endpoint, payload || {});
			if (res?.ok === false) throw new Error(res?.error?.message || "RPC failed");
			return res?.value ?? res;
		}

		function closePicker() {
			const host = document.getElementById(HOST_ID);
			if (reactRoot?.unmount) reactRoot.unmount();
			else if (host) ReactDOM.unmountComponentAtNode?.(host);
			reactRoot = null;
			host?.remove();
		}

		function AddWorkspaceDialog({ workspaces, connection, onClose }) {
			const [mode, setMode] = React.useState("local");
			const [hosts, setHosts] = React.useState([]);
			const [hostId, setHostId] = React.useState("");
			const [cwd, setCwd] = React.useState(null);
			const [remotePath, setRemotePath] = React.useState("/");
			const [entries, setEntries] = React.useState([]);
			const [crumbs, setCrumbs] = React.useState([{ name: "Root", path: "/" }]);
			const [selected, setSelected] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState("");

			const loadLocal = React.useCallback(async (path) => {
				setError("");
				try {
					const level = await workspaces.listDirectory(path == null ? undefined : path);
					setEntries((level?.entries || []).filter((e) => e.name && !e.hidden));
					setCwd(level?.path ?? path);
				} catch (err) {
					setError(err?.message || String(err));
				}
			}, [workspaces]);

			const loadRemote = React.useCallback(async (hid, path) => {
				if (!hid) return;
				setError("");
				try {
					const level = await callRpc(connection, "listRemoteDir", { hostId: hid, path: path || "/" });
					setEntries(level?.entries || []);
					setCrumbs(level?.crumbs || [{ name: "Root", path: "/" }]);
					setRemotePath(level?.path || path || "/");
				} catch (err) {
					setError(err?.message || String(err));
				}
			}, [connection]);

			React.useEffect(() => {
				callRpc(connection, "getConfig", {}).then((cfg) => {
					setHosts(cfg?.hosts || []);
					if (cfg?.hosts?.[0]) setHostId(cfg.hosts[0].id);
				}).catch(() => {});
			}, [connection]);

			React.useEffect(() => {
				if (mode === "local") loadLocal(null);
			}, [mode, loadLocal]);

			React.useEffect(() => {
				if (mode === "ssh" && hostId) loadRemote(hostId, remotePath);
			}, [mode, hostId, remotePath, loadRemote]);

			const openLocal = async () => {
				const target = selected?.path || cwd;
				if (!target || busy) return;
				if (target.replace(/\/+$/, "") === LOCAL_WORKSPACE_ROOT) {
					setError("Pick a subfolder — /workspace is the parent mount, not a workspace.");
					return;
				}
				setBusy(true);
				try {
					const ws = await workspaces.create({ path: target });
					const id = ws?.workspaceId || ws?.id;
					if (id) await callRpc(connection, "unbindWorkspace", { workspaceId: id });
					if (id && workspaces.startSession) workspaces.startSession(id);
					onClose();
				} catch (err) {
					setError(err?.message || String(err));
					setBusy(false);
				}
			};

			const openRemote = async () => {
				const target = selected?.path || remotePath;
				if (!hostId || !target || busy) return;
				setBusy(true);
				setError("");
				try {
					const { path: dsshPath } = await callRpc(connection, "makePath", { hostId, remotePath: target });
					const ws = await workspaces.create({ path: dsshPath });
					const id = ws?.workspaceId || ws?.id;
					const host = hosts.find((h) => h.id === hostId);
					const label = selected?.name || target.split("/").filter(Boolean).pop() || host?.label || "remote";
					if (id) {
						await callRpc(connection, "bindWorkspace", {
							workspaceId: id,
							hostId,
							remotePath: target,
							label,
						});
						if (workspaces.startSession) workspaces.startSession(id);
					}
					await refreshBindings(connection);
					onClose();
				} catch (err) {
					setError(err?.message || String(err));
					setBusy(false);
				}
			};

			const list = mode === "local" ? entries : entries;
			const targetPath = mode === "local" ? (selected?.path || cwd) : (selected?.path || remotePath);

			return React.createElement("div", { className: "dsw-dialog", role: "dialog", "aria-modal": "true" },
				React.createElement("div", { className: "dsw-head" },
					React.createElement("h2", { className: "dsw-title" }, "Add workspace"),
					React.createElement("div", { className: "dsw-tabs" },
						React.createElement("button", { type: "button", className: mode === "local" ? "dsw-tab dsw-tabOn" : "dsw-tab", onClick: () => setMode("local") }, "Local"),
						React.createElement("button", { type: "button", className: mode === "ssh" ? "dsw-tab dsw-tabOn" : "dsw-tab", onClick: () => setMode("ssh") }, "SSH"),
					),
				),
				mode === "ssh" && React.createElement("div", { style: { padding: "8px 16px" } },
					React.createElement("select", {
						className: "dsw-input",
						value: hostId,
						onChange: (e) => { setHostId(e.target.value); setSelected(null); setRemotePath("/"); },
					}, hosts.length ? hosts.map((h) => React.createElement("option", { key: h.id, value: h.id }, h.label))
						: React.createElement("option", { value: "" }, "Add SSH hosts in Settings first")),
				),
				mode === "ssh" && React.createElement("div", { className: "dsw-path" },
					crumbs.map((c, i) => React.createElement(React.Fragment, { key: c.path || "root" },
						i > 0 && React.createElement("span", null, "/"),
						React.createElement("button", {
							type: "button",
							className: "dsw-crumb",
							onClick: () => { setRemotePath(c.path); setSelected(null); },
						}, c.name),
					)),
				),
				React.createElement("div", { className: "dsw-list" },
					list.length ? list.map((e) => React.createElement("button", {
						key: e.path || e.name,
						type: "button",
						className: selected?.path === e.path ? "dsw-row selected" : "dsw-row",
						onClick: () => {
							if (mode === "ssh" && e.type === "directory") {
								setRemotePath(e.path);
								setSelected(null);
							} else setSelected(e);
						},
						onDoubleClick: () => {
							if (mode === "ssh" && e.type === "directory") loadRemote(hostId, e.path);
						},
					}, React.createElement("span", null, e.type === "directory" ? "📁" : "📄"), " ", e.name))
						: React.createElement("div", { className: "dsw-status" }, mode === "ssh" && !hosts.length ? "Configure SSH hosts under Settings → SSH." : "Empty"),
				),
				error && React.createElement("div", { className: "dsw-status err" }, error),
				React.createElement("div", { className: "dsw-foot" },
					React.createElement("span", { className: "dsw-msg", style: { flex: 1 } }, targetPath || ""),
					React.createElement("button", { type: "button", className: "dsw-btn", disabled: busy, onClick: onClose }, "Cancel"),
					React.createElement("button", {
						type: "button",
						className: "dsw-btn dsw-btnPrimary",
						disabled: busy || !targetPath || (mode === "ssh" && !hostId),
						onClick: mode === "local" ? openLocal : openRemote,
					}, busy ? "Opening…" : "Open"),
				),
			);
		}

		function SshSettingsPanel({ connection }) {
			const [hosts, setHosts] = React.useState([]);
			const [msg, setMsg] = React.useState("");
			const [draft, setDraft] = React.useState({ label: "", user: "", hostname: "", identityFile: "/home/node/.ssh/id_ed25519", port: 22 });

			const reload = React.useCallback(async () => {
				const cfg = await callRpc(connection, "getConfig", {});
				setHosts(cfg?.hosts || []);
			}, [connection]);

			React.useEffect(() => { reload().catch(() => {}); }, [reload]);

			const addHost = async () => {
				setMsg("");
				try {
					await callRpc(connection, "saveHost", { host: { ...draft, id: draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || undefined } });
					setDraft({ label: "", user: "", hostname: "", identityFile: "/home/node/.ssh/id_ed25519", port: 22 });
					await reload();
					setMsg("Saved.");
				} catch (err) {
					setMsg(err?.message || String(err));
				}
			};

			const testHost = async (host) => {
				setMsg("");
				try {
					const r = await callRpc(connection, "testHost", { host, persist: false });
					setMsg(r?.detail || (r?.ok ? "OK" : "Failed"));
				} catch (err) {
					setMsg(err?.message || String(err));
				}
			};

			const removeHost = async (id) => {
				await callRpc(connection, "removeHost", { id });
				await reload();
				await refreshBindings(connection);
			};

			return React.createElement("div", { className: "dsw-settings" },
				React.createElement("p", { className: "dsw-msg" },
					"Saved SSH targets for remote workspaces (like Cursor Remote SSH). Keys must exist in the Harness container (~/.ssh mount)."),
				hosts.map((h) => React.createElement("div", { key: h.id, className: "dsw-hostRow" },
					React.createElement("strong", null, h.label),
					React.createElement("code", { style: { fontSize: 11 } }, `${h.user}@${h.hostname}`),
					React.createElement("button", { type: "button", className: "dsw-btn", onClick: () => testHost(h) }, "Test"),
					React.createElement("button", { type: "button", className: "dsw-btn", onClick: () => removeHost(h.id) }, "Remove"),
				)),
				React.createElement("div", { className: "dsw-hostRow" },
					React.createElement("input", { className: "dsw-input", placeholder: "Label (Jetson)", value: draft.label, onChange: (e) => setDraft({ ...draft, label: e.target.value }) }),
					React.createElement("input", { className: "dsw-input", placeholder: "User", value: draft.user, onChange: (e) => setDraft({ ...draft, user: e.target.value }) }),
					React.createElement("input", { className: "dsw-input", placeholder: "Host / IP", value: draft.hostname, onChange: (e) => setDraft({ ...draft, hostname: e.target.value }) }),
					React.createElement("input", { className: "dsw-input", placeholder: "Identity file", value: draft.identityFile, onChange: (e) => setDraft({ ...draft, identityFile: e.target.value }) }),
					React.createElement("button", { type: "button", className: "dsw-btn dsw-btnPrimary", onClick: addHost }, "Add host"),
				),
				msg && React.createElement("div", { className: "dsw-msg" }, msg),
			);
		}

		async function refreshBindings(connection) {
			try {
				bindingsCache = await callRpc(connection, "getBindings", {});
			} catch {
				bindingsCache = { bindings: [], hosts: [] };
			}
			scheduleDecorateChips();
		}

		function chipLabelForWorkspace(item) {
			const id = item?.workspaceId || item?.id;
			const path = item?.path || "";
			const binding = bindingsCache.bindings.find((b) => b.workspaceId === id);
			if (binding) {
				const host = bindingsCache.hosts.find((h) => h.id === binding.hostId);
				return host?.label || binding.hostId;
			}
			if (String(path).startsWith("dssh://")) {
				const hostId = path.replace(/^dssh:\/\//, "").split("/")[0];
				const host = bindingsCache.hosts.find((h) => h.id === hostId);
				return host?.label || hostId;
			}
			return "local";
		}

		let chipSchedule = 0;

		function rowTitle(titleEl) {
			const clone = titleEl.cloneNode(true);
			clone.querySelectorAll(`.${CHIP_CLASS}`).forEach((node) => node.remove());
			return (clone.textContent || "").replace(/\s+/g, " ").trim();
		}

		function scheduleDecorateChips() {
			if (chipSchedule) return;
			chipSchedule = requestAnimationFrame(() => {
				chipSchedule = 0;
				decorateWorkspaceChips();
			});
		}

		function decorateWorkspaceChips() {
			const items = window.__dshWorkspacesSnapshot?.items || [];
			document.querySelectorAll(".YDXeBa_projectRow").forEach((row) => {
				const titleEl = row.querySelector(".YDXeBa_title");
				if (!titleEl) return;
				let chip = titleEl.querySelector(`.${CHIP_CLASS}`);
				if (!chip) {
					chip = document.createElement("span");
					chip.className = CHIP_CLASS;
					titleEl.appendChild(chip);
				}
				const title = rowTitle(titleEl);
				const hit = items.find((w) => {
					const t = String(w?.title || w?.name || "").trim();
					return t && (title === t || title.startsWith(`${t} `));
				});
				const label = hit ? chipLabelForWorkspace(hit) : "local";
				if (chip.textContent !== label) chip.textContent = label;
				const kind = label === "local" ? "local" : "remote";
				if (chip.dataset.kind !== kind) chip.dataset.kind = kind;
				const tip = label === "local" ? "Local workspace" : `SSH: ${label}`;
				if (chip.title !== tip) chip.title = tip;
			});
		}

		function openPicker(workspaces, connection) {
			ensureStyles();
			closePicker();
			const host = document.createElement("div");
			host.id = HOST_ID;
			host.addEventListener("mousedown", (e) => { if (e.target === host) closePicker(); });
			document.body.appendChild(host);
			const createRoot = ReactDOMClient?.createRoot || ReactDOM.createRoot;
			reactRoot = typeof createRoot === "function"
				? createRoot(host)
				: { render: (el) => ReactDOM.render(el, host), unmount: () => ReactDOM.unmountComponentAtNode(host) };
			reactRoot.render(React.createElement(React.Fragment, null,
				React.createElement("div", { className: "dsw-backdrop", "aria-hidden": "true" }),
				React.createElement(AddWorkspaceDialog, { workspaces, connection, onClose: closePicker }),
			));
		}

		function isAddWorkspaceButton(el) {
			if (!(el instanceof Element)) return null;
			const btn = el.closest("button");
			if (!(btn instanceof HTMLButtonElement)) return null;
			if ((btn.getAttribute("aria-label") || "").trim() === "Add workspace") return btn;
			return null;
		}

		const inject = ["connection", "workspaces", "slots"];

		function apply(ctx) {
			ensureStyles();
			document.documentElement.setAttribute("data-dsh-ssh-workspace", "0.1.2");

			const connection = ctx.get?.("connection");
			if (ctx.slots?.inject && connection) {
				try {
					ctx.effect(() => ctx.slots.inject("settings.section", () => ctx.slots.register({
						name: "settings.section",
						id: "ssh-workspace",
						order: 195,
						label: () => "SSH",
						inject: () => ({ connection: ctx.get("connection") }),
					}, SshSettingsPanel)), `${PLUGIN}: settings`);
				} catch (err) {
					console.warn(`[${PLUGIN}] settings inject failed`, err);
				}
			}

			ctx.inject(["connection", "workspaces"], (scope) => {
				const conn = scope.connection || scope.get("connection");
				const workspaces = scope.workspaces || scope.get("workspaces");
				if (!conn?.rpc?.call || !workspaces?.create) {
					console.warn(`[${PLUGIN}] connection/workspaces unavailable`);
					return;
				}
				activeConnection = conn;

				scope.effect(() => {
					refreshBindings(conn);
					const iv = setInterval(() => refreshBindings(conn), 30000);
					return () => clearInterval(iv);
				}, `${PLUGIN}: bindings`);

				scope.effect(() => {
					const snap = workspaces?.list?.getSnapshot?.();
					if (snap?.items) window.__dshWorkspacesSnapshot = snap;
					const unsub = workspaces?.list?.subscribe?.((s) => {
						window.__dshWorkspacesSnapshot = s;
						scheduleDecorateChips();
					});
					scheduleDecorateChips();
					return () => { unsub?.(); };
				}, `${PLUGIN}: chips`);

				scope.effect(() => {
					const onClick = (e) => {
						if (e.target instanceof Element && e.target.closest(`#${HOST_ID}`)) return;
						const btn = isAddWorkspaceButton(e.target);
						if (!btn) return;
						e.preventDefault();
						e.stopPropagation();
						if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
						openPicker(workspaces, conn);
					};
					document.addEventListener("click", onClick, true);
					return () => { document.removeEventListener("click", onClick, true); closePicker(); };
				}, `${PLUGIN}: add workspace`);
			});
		}

		window.__dshSshWorkspaceRpc = (connection, endpoint, payload) => callRpc(connection || activeConnection, endpoint, payload);

		return { apply, inject };
	},
});

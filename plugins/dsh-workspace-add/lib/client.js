// dsh-workspace-add — make Workspaces header "Add workspace" open an in-browser picker.
window.__ModuleLoader__.load({
	id: "dsh-workspace-add",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		let ReactDOMClient = null;
		try {
			ReactDOMClient = require("react-dom/client");
		} catch {
			ReactDOMClient = null;
		}

		const PLUGIN = "dsh-workspace-add";
		const HOST_ID = "dsh-workspace-add-host";

		const css = `
#dsh-workspace-add-host{position:fixed;inset:0;z-index:12000;display:flex;align-items:center;justify-content:center;padding:24px;box-sizing:border-box}
.dwa-backdrop{position:absolute;inset:0;background:rgba(0,0,0,.55);pointer-events:none}
.dwa-dialog{
  position:relative;z-index:2;width:min(520px,96vw);max-height:min(70vh,640px);
  display:flex;flex-direction:column;border-radius:16px;overflow:hidden;
  background:var(--dsw-alias-bg-layer-1, #1b1d21);color:var(--dsw-alias-label-primary,#eee);
  border:1px solid var(--dsw-alias-border-l2, #333);box-shadow:0 18px 48px rgba(0,0,0,.45);
  pointer-events:auto;
}
.dwa-head{padding:16px 18px 10px;display:flex;flex-direction:column;gap:8px;border-bottom:1px solid var(--dsw-alias-border-l2,#333)}
.dwa-title{margin:0;font-size:16px;font-weight:600;line-height:22px}
.dwa-path{
  display:flex;align-items:center;gap:6px;flex-wrap:wrap;font-size:12px;line-height:18px;
  color:var(--dsw-alias-label-secondary,#aaa);
}
.dwa-crumb{
  border:none;background:transparent;color:inherit;cursor:pointer;padding:0;font:inherit;
}
.dwa-crumb:hover{color:var(--dsw-alias-label-primary,#fff);text-decoration:underline}
.dwa-crumbSep{opacity:.5}
.dwa-list{flex:1;min-height:180px;overflow:auto;padding:8px}
.dwa-row{
  display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;cursor:pointer;
  background:transparent;color:inherit;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;
}
.dwa-row:hover,.dwa-row.selected{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dwa-ico{width:16px;height:16px;flex:none;opacity:.85}
.dwa-name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwa-status{padding:16px;font-size:13px;color:var(--dsw-alias-label-tertiary,#888)}
.dwa-status.err{color:var(--dsw-alias-state-error-primary,#f66)}
.dwa-foot{
  display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:12px 14px;
  border-top:1px solid var(--dsw-alias-border-l2,#333);
}
.dwa-footGap{flex:1}
.dwa-btn{
  height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);
  background:var(--dsw-alias-bg-layer-2,#222);color:inherit;font:inherit;font-size:13px;cursor:pointer;
}
.dwa-btn:hover{filter:brightness(1.08)}
.dwa-btn:disabled{opacity:.45;cursor:default}
.dwa-btnPrimary{background:var(--dsw-alias-label-primary,#eee);color:#111;border-color:transparent;font-weight:600}
.dwa-newRow{display:flex;gap:8px;align-items:center;width:100%;margin-top:4px}
.dwa-input{
  flex:1;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);
  background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:0 10px;font:inherit;font-size:13px;
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-workspace-add-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-workspace-add-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function folderSvg() {
			return React.createElement("svg", {
				className: "dwa-ico", viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true",
			}, React.createElement("path", { d: "M2.5 4.5h4l1 1.5h6v6.5h-11z" }));
		}

		function normalizeCrumbs(level, path) {
			const home = { name: "Home", path: null };
			const next = level?.crumbs;
			if (!Array.isArray(next) || !next.length) {
				if (path == null) return [home];
				const leaf = String(path).split("/").filter(Boolean).pop() || path;
				return [home, { name: leaf, path }];
			}
			const seen = new Set();
			const mapped = [];
			for (const c of next) {
				const p = c?.path;
				if (p == null || p === "" || p === "/") continue;
				const key = String(p);
				if (seen.has(key)) continue;
				seen.add(key);
				const name = (c.name && String(c.name).trim())
					|| key.split("/").filter(Boolean).pop()
					|| key;
				if (!name || name === "/") continue;
				mapped.push({ name, path: p });
			}
			return mapped.length ? [home, ...mapped] : [home];
		}

		function AddWorkspaceDialog({ workspaces, onClose }) {
			const [cwd, setCwd] = React.useState(null);
			const [crumbs, setCrumbs] = React.useState([{ name: "Home", path: null }]);
			const [entries, setEntries] = React.useState([]);
			const [selected, setSelected] = React.useState(null);
			const [status, setStatus] = React.useState({ state: "loading" });
			const [creating, setCreating] = React.useState(false);
			const [newName, setNewName] = React.useState("");
			const [showNew, setShowNew] = React.useState(false);
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState(null);
			const stateRef = React.useRef({});

			const load = React.useCallback(async (path) => {
				setStatus({ state: "loading" });
				setError(null);
				setSelected(null);
				setShowNew(false);
				setNewName("");
				try {
					const level = await workspaces.listDirectory(path === null || path === undefined ? undefined : path);
					const list = (level?.entries || [])
						.map((e) => ({
							name: e.name,
							path: e.path,
							hidden: !!e.hidden,
						}))
						.filter((e) => e.name && !e.hidden)
						.sort((a, b) => a.name.localeCompare(b.name));
					setEntries(list);
					setCrumbs(normalizeCrumbs(level, path));
					setCwd(typeof level?.path === "string" ? level.path : path);
					setStatus({ state: "ready" });
				} catch (err) {
					setEntries([]);
					setStatus({ state: "error", error: err && err.message || String(err) });
				}
			}, [workspaces]);

			React.useEffect(() => { load(null); }, [load]);

			const openWorkspace = React.useCallback(async () => {
				const targetPath = stateRef.current.selected?.path || stateRef.current.cwd;
				if (!targetPath || stateRef.current.busy) return;
				setBusy(true);
				setError(null);
				try {
					const ws = await workspaces.create({ path: targetPath });
					const id = ws?.workspaceId || ws?.id;
					if (id && typeof workspaces.startSession === "function") {
						workspaces.startSession(id);
					}
					onClose();
				} catch (err) {
					setError(err && err.message || String(err));
					setBusy(false);
				}
			}, [workspaces, onClose]);

			const createFolder = React.useCallback(async () => {
				const name = String(stateRef.current.newName || "").trim();
				const parent = stateRef.current.cwd;
				if (!name || parent == null || stateRef.current.creating) return;
				setCreating(true);
				setError(null);
				try {
					const created = await workspaces.createDirectory(parent, name);
					const createdPath = typeof created === "string" ? created : created?.path;
					setShowNew(false);
					setNewName("");
					await load(parent);
					if (createdPath) setSelected({ name, path: createdPath });
				} catch (err) {
					setError(err && err.message || String(err));
				} finally {
					setCreating(false);
				}
			}, [workspaces, load]);

			stateRef.current = {
				cwd, selected, busy, creating, newName, entries, showNew,
				onClose, load, workspaces, openWorkspace, createFolder,
				setShowNew, setNewName, setSelected, setBusy, setError, setCreating,
			};
			window.__dshWorkspaceAddState = stateRef.current;

			React.useEffect(() => {
				const onKey = (e) => {
					if (e.key === "Escape" && !stateRef.current.busy) {
						if (stateRef.current.showNew) {
							setShowNew(false);
							setNewName("");
							return;
						}
						stateRef.current.onClose();
					}
				};
				document.addEventListener("keydown", onKey, true);
				return () => document.removeEventListener("keydown", onKey, true);
			}, []);

			const targetPath = selected?.path || cwd;

			return React.createElement("div", {
				className: "dwa-dialog",
				role: "dialog",
				"aria-modal": "true",
				"aria-label": "Select Workspace Directory",
				onMouseDown: (e) => e.stopPropagation(),
				onClick: (e) => e.stopPropagation(),
			},
				React.createElement("div", { className: "dwa-head" },
					React.createElement("h2", { className: "dwa-title" }, "Select Workspace Directory"),
					React.createElement("div", { className: "dwa-path" },
						crumbs.map((c, i) => React.createElement(React.Fragment, { key: `${c.path || "home"}-${i}` },
							i > 0 && React.createElement("span", { className: "dwa-crumbSep" }, "/"),
							React.createElement("button", {
								type: "button",
								className: "dwa-crumb",
								disabled: busy,
								"data-dwa-action": c.path == null ? "crumb-home" : `crumb:${c.path}`,
								onClick: (e) => {
									e.preventDefault();
									e.stopPropagation();
									load(c.path);
								},
							}, c.name),
						)),
					),
				),
				status.state === "loading" && React.createElement("div", { className: "dwa-status" }, "Loading…"),
				status.state === "error" && React.createElement("div", { className: "dwa-status err" }, status.error || "Failed to list"),
				status.state === "ready" && React.createElement("div", { className: "dwa-list" },
					!entries.length && React.createElement("div", { className: "dwa-status" }, "Empty folder"),
					entries.map((e) => React.createElement("button", {
						type: "button",
						key: e.path,
						className: "dwa-row" + (selected?.path === e.path ? " selected" : ""),
						disabled: busy,
						"data-dwa-action": `enter:${e.path}`,
						"data-dwa-enter": e.path,
						onClick: (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setSelected(e);
							load(e.path);
						},
						onDoubleClick: (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							load(e.path);
						},
					},
						folderSvg(),
						React.createElement("span", { className: "dwa-name" }, e.name),
						React.createElement("span", { "aria-hidden": "true" }, "›"),
					)),
				),
				error && React.createElement("div", { className: "dwa-status err" }, error),
				React.createElement("div", { className: "dwa-foot" },
					!showNew && React.createElement("button", {
						type: "button",
						className: "dwa-btn",
						disabled: busy || cwd == null,
						"data-dwa-action": "new",
						onClick: (e) => {
							e.preventDefault();
							e.stopPropagation();
							setShowNew(true);
						},
					}, "+ New folder"),
					showNew && React.createElement("div", { className: "dwa-newRow" },
						React.createElement("input", {
							className: "dwa-input",
							value: newName,
							placeholder: "Untitled folder",
							autoFocus: true,
							disabled: creating || busy,
							onChange: (e) => setNewName(e.target.value),
							onKeyDown: (e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									createFolder();
								}
								if (e.key === "Escape") {
									e.stopPropagation();
									setShowNew(false);
									setNewName("");
								}
							},
						}),
						React.createElement("button", {
							type: "button",
							className: "dwa-btn dwa-btnPrimary",
							disabled: creating || !newName.trim(),
							"data-dwa-action": "create",
							onClick: (e) => {
								e.preventDefault();
								e.stopPropagation();
								createFolder();
							},
						}, creating ? "Creating…" : "Create"),
					),
					React.createElement("span", { className: "dwa-footGap" }),
					React.createElement("button", {
						type: "button",
						className: "dwa-btn",
						disabled: busy,
						"data-dwa-action": "close",
						onClick: (e) => {
							e.preventDefault();
							e.stopPropagation();
							onClose();
						},
					}, "Cancel"),
					React.createElement("button", {
						type: "button",
						className: "dwa-btn dwa-btnPrimary",
						disabled: busy || !targetPath,
						"data-dwa-action": "open",
						onClick: (e) => {
							e.preventDefault();
							e.stopPropagation();
							openWorkspace();
						},
					}, busy ? "Opening…" : "Open"),
				),
			);
		}

		let reactRoot = null;

		function closePicker() {
			const host = document.getElementById(HOST_ID);
			if (reactRoot) {
				try { reactRoot.unmount(); } catch { /* ignore */ }
				reactRoot = null;
			}
			if (host) host.remove();
			try { delete window.__dshWorkspaceAddState; } catch { /* ignore */ }
		}

		function openPicker(workspaces) {
			ensureStyles();
			closePicker();
			const host = document.createElement("div");
			host.id = HOST_ID;
			host.addEventListener("mousedown", (e) => {
				if (e.target === host) closePicker();
			});
			document.body.appendChild(host);
			const createRoot = ReactDOMClient?.createRoot || ReactDOM.createRoot;
			reactRoot = typeof createRoot === "function"
				? createRoot(host)
				: {
					render: (el) => ReactDOM.render(el, host),
					unmount: () => ReactDOM.unmountComponentAtNode(host),
				};
			reactRoot.render(React.createElement(React.Fragment, null,
				React.createElement("div", {
					className: "dwa-backdrop",
					"aria-hidden": "true",
				}),
				React.createElement(AddWorkspaceDialog, {
					workspaces,
					onClose: closePicker,
				}),
			));
		}

		function isAddWorkspaceButton(el) {
			if (!(el instanceof Element)) return null;
			const btn = el.closest("button");
			if (!(btn instanceof HTMLButtonElement)) return null;
			if ((btn.getAttribute("aria-label") || "").trim() === "Add workspace") return btn;
			return null;
		}

		const inject = ["workspaces"];

		function apply(ctx) {
			ensureStyles();
			try {
				document.documentElement.setAttribute("data-dsh-workspace-add", "0.1.3");
			} catch { /* ignore */ }

			// Remove leftover overflow chip from older builds
			document.querySelectorAll(".dsh-dwa-headerBtn").forEach((n) => n.remove());

			ctx.inject(["workspaces"], (scope) => {
				const workspaces = scope.workspaces || scope.get("workspaces");
				if (!workspaces?.listDirectory || !workspaces?.create) {
					console.warn(`[${PLUGIN}] workspaces.listDirectory/create unavailable`);
					return;
				}

				scope.effect(() => {
					const openFromEvent = (e) => {
						if (e.target instanceof Element && e.target.closest("#dsh-workspace-add-host")) return;
						const btn = isAddWorkspaceButton(e.target);
						if (!btn) return;
						e.preventDefault();
						e.stopPropagation();
						if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
						openPicker(workspaces);
					};

					document.addEventListener("click", openFromEvent, true);
					return () => {
						document.removeEventListener("click", openFromEvent, true);
						closePicker();
						document.querySelectorAll(".dsh-dwa-headerBtn").forEach((n) => n.remove());
					};
				}, `${PLUGIN}: hijack add workspace`);
			});
		}

		return { apply, inject };
	},
});

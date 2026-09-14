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
.dsw-list{flex:1;min-height:160px;overflow:auto;padding:8px;position:relative}
.dsw-listLoading{position:sticky;top:0;z-index:1;padding:6px 10px;margin:-8px -8px 6px;font-size:11px;color:var(--dsw-alias-label-tertiary);background:color-mix(in srgb,var(--dsw-alias-bg-layer-1,#1b1d21) 92%,transparent);border-bottom:1px solid var(--dsw-alias-border-l2,#333)}
.dsw-listBusy .dsw-row{opacity:.55;pointer-events:none}
.dsw-rowParent{opacity:.85;font-style:italic}
.dsw-row{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:none;background:transparent;color:inherit;border-radius:10px;padding:8px 10px;font:inherit;font-size:13px;cursor:pointer}
.dsw-row:hover,.dsw-row.selected{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsw-foot{display:flex;flex-direction:column;gap:8px;padding:12px 14px;border-top:1px solid var(--dsw-alias-border-l2,#333)}
.dsw-footPath{font-size:11px;color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dsw-footRow{display:flex;gap:8px;align-items:center;min-width:0}
.dsw-footMain{flex:1;min-width:0}
.dsw-nameRow{display:flex;align-items:center;gap:8px;min-width:0}
.dsw-nameLabel{font-size:11px;color:var(--dsw-alias-label-tertiary);white-space:nowrap}
.dsw-nameInput{flex:1;min-width:120px;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:0 10px;font:inherit;font-size:12px;box-sizing:border-box}
.dsw-newRow{display:flex;gap:8px;align-items:center;padding:8px 10px;border-top:1px solid var(--dsw-alias-border-l2,#333)}
.dsw-hint{padding:0 16px 8px;font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.45}
.dsw-footActions{display:flex;gap:8px;flex:none}
.dsw-btn{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#222);color:inherit;font:inherit;font-size:13px;cursor:pointer}
.dsw-btnPrimary{background:var(--dsw-alias-label-primary,#eee);color:#111;border-color:transparent;font-weight:600}
.dsw-status{padding:12px 16px;font-size:12px;color:var(--dsw-alias-label-tertiary,#888)}
.dsw-status.err{color:var(--dsw-alias-state-error-primary,#f66)}
.dsw-path{font-size:11px;color:var(--dsw-alias-label-tertiary);padding:0 16px 8px;display:flex;flex-wrap:wrap;gap:4px}
.dsw-crumb{border:none;background:transparent;color:inherit;cursor:pointer;font:inherit;font-size:11px;padding:0}
.dsw-crumb:hover{text-decoration:underline}
.${CHIP_CLASS}{
  flex:none;font-size:9px;padding:1px 6px;border-radius:999px;
  border:1px solid var(--dsw-alias-border-l2,#444);color:var(--dsw-alias-label-tertiary,#888);
  background:var(--dsw-alias-bg-layer-1,#1b1d21);line-height:1.25;text-transform:uppercase;letter-spacing:.03em;
}
.YDXeBa_projectRow.dsh-ws-pillRow{position:relative;margin-top:8px}
.qDHVXG_treeBody,.qDHVXG_list{padding-top:4px}
.dsh-ws-rowLegend{position:absolute;top:-7px;left:10px;display:flex;flex-wrap:wrap;gap:4px;align-items:center;max-width:calc(100% - 20px);pointer-events:none;z-index:1}
.YDXeBa_projectRow:hover .dsh-ws-rowLegend .${CHIP_CLASS}{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsw-addWorkspaceBtn{
  width:28px;height:28px;padding:0;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);
  background:var(--dsw-alias-bg-layer-2,#222);color:inherit;font:inherit;font-size:16px;line-height:1;cursor:pointer;
}
.dsw-addWorkspaceBtn:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsw-loading{padding:16px;font-size:12px;color:var(--dsw-alias-label-tertiary)}
.dsw-settings{max-width:720px;display:flex;flex-direction:column;gap:14px}
.dsw-section{border:1px solid var(--dsw-alias-border-l2,#333);border-radius:10px;background:var(--dsw-alias-bg-layer-1,#1b1d21);padding:12px 14px;display:flex;flex-direction:column;gap:10px}
.dsw-sectionTitle{font-size:11px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:var(--dsw-alias-label-tertiary)}
.dsw-hostList{display:flex;flex-direction:column;gap:8px}
.dsw-hostRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center;padding:10px 12px;border:1px solid var(--dsw-alias-border-l2,#333);border-radius:8px;background:var(--dsw-alias-bg-layer-2,#222)}
.dsw-hostRowActive{border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 40%,var(--dsw-alias-border-l2,#333));background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 8%,var(--dsw-alias-bg-layer-2,#222))}
.dsw-hostRowEmpty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:4px 2px 2px}
.dsw-hostMeta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;flex:1;min-width:0}
.dsw-hostMeta code{opacity:.85}
.dsw-hostActions{display:flex;flex-wrap:wrap;gap:6px;margin-left:auto}
.dsw-input{height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:0 10px;font:inherit;font-size:12px;min-width:0;box-sizing:border-box}
.dsw-formRow .dsw-input{flex:1 1 140px}
.dsw-formRow--grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;width:100%}
@media (max-width:640px){.dsw-formRow--grid{grid-template-columns:1fr}}
.dsw-textarea{width:100%;min-height:96px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:8px 10px;font-family:var(--ds-font-family-code,monospace);font-size:11px;line-height:1.45;resize:vertical;box-sizing:border-box}
.dsw-help{font-size:12px;color:var(--dsw-alias-label-secondary);line-height:1.5;margin:0}
.dsw-form{display:flex;flex-direction:column;gap:8px;padding:0}
.dsw-formRow{display:flex;flex-wrap:wrap;gap:8px}
.dsw-label{font-size:11px;color:var(--dsw-alias-label-tertiary);margin:4px 0 2px}
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
			const [localPath, setLocalPath] = React.useState(null);
			const [cwd, setCwd] = React.useState(null);
			const [entries, setEntries] = React.useState([]);
			const [localCrumbs, setLocalCrumbs] = React.useState([{ name: "Home", path: null }]);
			const [busy, setBusy] = React.useState(false);
			const [loading, setLoading] = React.useState(false);
			const [error, setError] = React.useState("");
			const [showNewFolder, setShowNewFolder] = React.useState(false);
			const [newFolderName, setNewFolderName] = React.useState("");
			const [creatingFolder, setCreatingFolder] = React.useState(false);

			const [remotePath, setRemotePath] = React.useState("/");
			const [sshEntries, setSshEntries] = React.useState([]);
			const [sshCrumbs, setSshCrumbs] = React.useState([{ name: "Root", path: "/" }]);
			const [sshLoading, setSshLoading] = React.useState(false);
			const [workspaceTitle, setWorkspaceTitle] = React.useState("");
			const sshLoadSeq = React.useRef(0);
			const defaultedTab = React.useRef(false);

			const loadLocal = React.useCallback(async (path) => {
				setError("");
				setLoading(true);
				try {
					const level = await workspaces.listDirectory(path == null ? undefined : path);
					const list = (level?.entries || [])
						.filter((e) => e.name && !e.hidden && e.name !== "dssh:")
						.sort((a, b) => a.name.localeCompare(b.name));
					setEntries(list);
					const resolved = level?.path ?? path ?? null;
					setCwd(resolved);
					const crumbs = [{ name: "Home", path: null }];
					if (resolved && resolved.replace(/\/+$/, "") !== LOCAL_WORKSPACE_ROOT) {
						const parts = String(resolved).split("/").filter(Boolean);
						let acc = "";
						for (const part of parts) {
							acc += `/${part}`;
							crumbs.push({ name: part, path: acc });
						}
					}
					setLocalCrumbs(crumbs);
				} catch (err) {
					setEntries([]);
					setError(err?.message || String(err));
				} finally {
					setLoading(false);
				}
			}, [workspaces]);

			const loadRemote = React.useCallback(async (hid, path) => {
				if (!hid) return;
				const seq = ++sshLoadSeq.current;
				setError("");
				setSshLoading(true);
				try {
					const level = await callRpc(connection, "listRemoteDir", { hostId: hid, path: path || "/" });
					if (seq !== sshLoadSeq.current) return;
					setSshEntries(level?.entries || []);
					setSshCrumbs(level?.crumbs || [{ name: "Root", path: "/" }]);
					setRemotePath(level?.path || path || "/");
				} catch (err) {
					if (seq !== sshLoadSeq.current) return;
					setError(err?.message || String(err));
				} finally {
					if (seq === sshLoadSeq.current) setSshLoading(false);
				}
			}, [connection]);

			const switchMode = (next) => {
				setMode(next);
				setError("");
				setShowNewFolder(false);
				setNewFolderName("");
				if (next === "ssh") {
					sshLoadSeq.current += 1;
					setRemotePath("/");
					setSshEntries([]);
					setSshCrumbs([{ name: "Root", path: "/" }]);
				} else {
					setLocalPath(null);
				}
			};

			React.useEffect(() => {
				callRpc(connection, "getConfig", {}).then((cfg) => {
					setHosts(cfg?.hosts || []);
					if (cfg?.hosts?.[0]) setHostId(cfg.hosts[0].id);
				}).catch(() => {});
			}, [connection]);

			React.useEffect(() => {
				if (defaultedTab.current || !hosts.length) return;
				defaultedTab.current = true;
				setMode("ssh");
			}, [hosts.length]);

			React.useEffect(() => {
				if (mode === "local") loadLocal(localPath);
			}, [mode, localPath, loadLocal]);

			React.useEffect(() => {
				if (mode === "ssh" && hostId) loadRemote(hostId, remotePath);
			}, [mode, hostId, remotePath, loadRemote]);

			React.useEffect(() => {
				const path = mode === "ssh" ? remotePath : (localPath || cwd);
				const leaf = String(path || "").split("/").filter(Boolean).pop() || "";
				setWorkspaceTitle(leaf);
			}, [mode, remotePath, localPath, cwd]);

			const createLocalFolder = async () => {
				const name = newFolderName.trim();
				const parent = cwd;
				if (!name || parent == null || creatingFolder) return;
				setCreatingFolder(true);
				setError("");
				try {
					const created = await workspaces.createDirectory(parent, name);
					const createdPath = typeof created === "string" ? created : created?.path;
					setShowNewFolder(false);
					setNewFolderName("");
					await loadLocal(parent);
					if (createdPath) {
						setLocalPath(createdPath);
						setWorkspaceTitle(name);
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setCreatingFolder(false);
				}
			};

			const openLocal = async () => {
				const target = localPath || cwd;
				const title = workspaceTitle.trim();
				if (!target || busy) return;
				if (!title) {
					setError("Enter a workspace name.");
					return;
				}
				if (target.replace(/\/+$/, "") === LOCAL_WORKSPACE_ROOT) {
					setError("Open a subfolder under /workspace (or create one below).");
					return;
				}
				setBusy(true);
				try {
					const ws = await workspaces.create({ path: target });
					const id = ws?.workspaceId || ws?.id;
					if (id) {
						const defaultName = target.split("/").filter(Boolean).pop() || "";
						if (title !== defaultName && typeof workspaces.rename === "function") {
							await workspaces.rename({ workspaceId: id, title });
						}
						await callRpc(connection, "unbindWorkspace", { workspaceId: id });
					}
					if (id && workspaces.startSession) workspaces.startSession(id);
					onClose();
				} catch (err) {
					setError(err?.message || String(err));
					setBusy(false);
				}
			};

			const openRemote = async () => {
				const target = remotePath;
				const title = workspaceTitle.trim();
				if (!hostId || !target || busy) return;
				if (!title) {
					setError("Enter a workspace name.");
					return;
				}
				setBusy(true);
				setError("");
				try {
					const ws = await callRpc(connection, "createRemoteWorkspace", {
						hostId,
						remotePath: target,
						label: title,
					});
					const id = ws?.workspaceId || ws?.id;
					if (id && workspaces.startSession) workspaces.startSession(id);
					await refreshBindings(connection);
					onClose();
				} catch (err) {
					setError(err?.message || String(err));
					setBusy(false);
				}
			};

			const sshParentPath = remotePath !== "/"
				? remotePath.replace(/\/[^/]+$/, "") || "/"
				: null;
			const sshRows = [];
			if (sshParentPath) {
				sshRows.push({ name: "..", path: sshParentPath, type: "directory", parent: true });
			}
			sshRows.push(...sshEntries.filter((e) => e.name !== "dssh:"));

			const localParentPath = cwd && cwd.replace(/\/+$/, "") !== LOCAL_WORKSPACE_ROOT
				? String(cwd).replace(/\/[^/]+$/, "") || LOCAL_WORKSPACE_ROOT
				: null;
			const localRows = [];
			if (localParentPath != null) {
				localRows.push({
					name: "..",
					path: localParentPath === LOCAL_WORKSPACE_ROOT ? null : localParentPath,
					type: "directory",
					parent: true,
				});
			}
			localRows.push(...entries);

			const targetPath = mode === "local" ? (localPath || cwd) : remotePath;
			const pickerBusy = mode === "local" ? loading : sshLoading;

			return React.createElement("div", { className: "dsw-dialog", role: "dialog", "aria-modal": "true" },
				React.createElement("div", { className: "dsw-head" },
					React.createElement("h2", { className: "dsw-title" }, "Add workspace"),
					React.createElement("div", { className: "dsw-tabs" },
						React.createElement("button", { type: "button", className: mode === "local" ? "dsw-tab dsw-tabOn" : "dsw-tab", onClick: () => switchMode("local") }, "Local"),
						React.createElement("button", { type: "button", className: mode === "ssh" ? "dsw-tab dsw-tabOn" : "dsw-tab", onClick: () => switchMode("ssh") }, "SSH"),
					),
				),
				React.createElement("div", { className: "dsw-hint" },
					mode === "local"
						? "Browse or create a folder under /workspace, name it, then Add workspace."
						: "Browse the remote PC, name the workspace, then Add workspace."),
				mode === "ssh" && React.createElement("div", { style: { padding: "8px 16px" } },
					React.createElement("select", {
						className: "dsw-input",
						value: hostId,
						onChange: (e) => { setHostId(e.target.value); setRemotePath("/"); },
					}, hosts.length ? hosts.map((h) => React.createElement("option", { key: h.id, value: h.id }, h.label))
						: React.createElement("option", { value: "" }, "Add SSH hosts in Settings first")),
				),
				mode === "ssh" && React.createElement("div", { className: "dsw-path" },
					sshCrumbs.map((c, i) => React.createElement(React.Fragment, { key: c.path || "root" },
						i > 0 && React.createElement("span", null, "/"),
						React.createElement("button", {
							type: "button",
							className: "dsw-crumb",
							onClick: () => setRemotePath(c.path),
						}, c.name),
					)),
				),
				mode === "ssh"
					? React.createElement("div", { className: sshLoading ? "dsw-list dsw-listBusy" : "dsw-list" },
						sshLoading && React.createElement("div", { className: "dsw-listLoading", role: "status" }, "Loading remote folders…"),
						sshRows.length ? sshRows.map((e) => React.createElement("button", {
							key: e.path || e.name,
							type: "button",
							className: e.parent ? "dsw-row dsw-rowParent" : "dsw-row",
							disabled: sshLoading || (e.type !== "directory" && !e.parent),
							onClick: (ev) => {
								ev.preventDefault();
								ev.stopPropagation();
								if (e.type === "directory" || e.parent) setRemotePath(e.path);
							},
						}, React.createElement("span", null, e.type === "directory" ? "📁" : "📄"), " ", e.name))
							: !sshLoading && React.createElement("div", { className: "dsw-status" },
								!hosts.length ? "Configure SSH hosts under Settings → SSH." : "Empty"),
					)
					: React.createElement("div", { className: loading ? "dsw-list dsw-listBusy" : "dsw-list" },
						React.createElement("div", { className: "dsw-path", style: { padding: "0 8px 8px" } },
							localCrumbs.map((c, i) => React.createElement(React.Fragment, { key: c.path || "home" },
								i > 0 && React.createElement("span", null, "/"),
								React.createElement("button", {
									type: "button",
									className: "dsw-crumb",
									onClick: () => setLocalPath(c.path),
								}, c.name),
							)),
						),
						loading && React.createElement("div", { className: "dsw-listLoading", role: "status" }, "Loading…"),
						localRows.length ? localRows.map((e) => React.createElement("button", {
							key: e.path || e.name,
							type: "button",
							className: e.parent ? "dsw-row dsw-rowParent" : "dsw-row",
							disabled: loading || creatingFolder,
							onClick: (ev) => {
								ev.preventDefault();
								ev.stopPropagation();
								setLocalPath(e.parent ? e.path : e.path);
							},
						}, React.createElement("span", null, "📁"), " ", e.name))
							: !loading && React.createElement("div", { className: "dsw-status" }, "Empty — create a folder below"),
						!showNewFolder
							? React.createElement("div", { className: "dsw-newRow" },
								React.createElement("button", {
									type: "button",
									className: "dsw-btn",
									disabled: loading || creatingFolder || !cwd,
									onClick: () => setShowNewFolder(true),
								}, "New folder"),
							)
							: React.createElement("div", { className: "dsw-newRow" },
								React.createElement("input", {
									className: "dsw-nameInput",
									placeholder: "Folder name",
									value: newFolderName,
									disabled: creatingFolder,
									onChange: (e) => setNewFolderName(e.target.value),
									onKeyDown: (e) => { if (e.key === "Enter") createLocalFolder(); },
								}),
								React.createElement("button", {
									type: "button",
									className: "dsw-btn dsw-btnPrimary",
									disabled: creatingFolder || !newFolderName.trim(),
									onClick: createLocalFolder,
								}, creatingFolder ? "Creating…" : "Create"),
								React.createElement("button", {
									type: "button",
									className: "dsw-btn",
									disabled: creatingFolder,
									onClick: () => { setShowNewFolder(false); setNewFolderName(""); },
								}, "Cancel"),
							),
					),
				error && React.createElement("div", { className: "dsw-status err" }, error),
				React.createElement("div", { className: "dsw-foot" },
					targetPath
						? React.createElement("span", { className: "dsw-footPath", title: targetPath }, targetPath)
						: null,
					React.createElement("div", { className: "dsw-footRow" },
						React.createElement("div", { className: "dsw-footMain" },
							React.createElement("div", { className: "dsw-nameRow" },
								React.createElement("label", { className: "dsw-nameLabel", htmlFor: "dsw-workspace-title" }, "Name"),
								React.createElement("input", {
									id: "dsw-workspace-title",
									className: "dsw-nameInput",
									value: workspaceTitle,
									placeholder: "Workspace name",
									disabled: busy || pickerBusy,
									onChange: (e) => setWorkspaceTitle(e.target.value),
								}),
							),
						),
						React.createElement("div", { className: "dsw-footActions" },
							React.createElement("button", { type: "button", className: "dsw-btn", disabled: busy, onClick: onClose }, "Cancel"),
							React.createElement("button", {
								type: "button",
								className: "dsw-btn dsw-btnPrimary",
								disabled: busy || !targetPath || !workspaceTitle.trim() || (mode === "ssh" && !hostId) || pickerBusy
									|| (mode === "local" && targetPath.replace(/\/+$/, "") === LOCAL_WORKSPACE_ROOT),
								onClick: mode === "local" ? openLocal : openRemote,
							}, busy ? "Adding…" : "Add workspace"),
						),
					),
				),
			);
		}

		function keyStatusLabel(host) {
			if (host?.identityFile) return "key file";
			if (host?.hasKey) return "key saved";
			return "no key";
		}

		function emptyDraft() {
			return { label: "", user: "", hostname: "", port: 22, privateKey: "", identityFile: "" };
		}

		function SshSettingsPanel({ connection }) {
			const [hosts, setHosts] = React.useState([]);
			const [sshKeysDirPath, setSshKeysDirPath] = React.useState("/home/node/.dsh/ssh");
			const [msg, setMsg] = React.useState("");
			const [editingId, setEditingId] = React.useState(null);
			const [draft, setDraft] = React.useState(emptyDraft());

			const reload = React.useCallback(async () => {
				const cfg = await callRpc(connection, "getConfig", {});
				setHosts(cfg?.hosts || []);
				if (cfg?.sshKeysDir) setSshKeysDirPath(cfg.sshKeysDir);
			}, [connection]);

			React.useEffect(() => { reload().catch(() => {}); }, [reload]);

			const cancelEdit = () => {
				setEditingId(null);
				setDraft(emptyDraft());
				setMsg("");
			};

			const startEdit = (host) => {
				setEditingId(host.id);
				setDraft({
					label: host.label || "",
					user: host.user || "",
					hostname: host.hostname || "",
					port: host.port || 22,
					privateKey: "",
					identityFile: host.identityFile || "",
				});
				setMsg(`Editing ${host.label || host.id}. Leave the key field empty to keep the saved key.`);
			};

			const saveHost = async () => {
				setMsg("");
				const wasEdit = Boolean(editingId);
				try {
					const id = editingId || draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || undefined;
					await callRpc(connection, "saveHost", {
						host: { ...draft, id },
					});
					cancelEdit();
					await reload();
					setMsg(wasEdit ? "PC updated." : "PC saved.");
				} catch (err) {
					setMsg(err?.message || String(err));
				}
			};

			const testDraft = async () => {
				setMsg("");
				try {
					const id = editingId || draft.label.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "draft";
					const r = await callRpc(connection, "testHost", {
						host: { ...draft, id },
						persist: false,
					});
					setMsg(r?.detail || (r?.ok ? "Connection OK." : "Failed"));
				} catch (err) {
					setMsg(err?.message || String(err));
				}
			};

			const testHost = async (host) => {
				setMsg("");
				try {
					const r = await callRpc(connection, "testHost", { host, persist: false });
					setMsg(r?.detail || (r?.ok ? "Connection OK." : "Failed"));
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
				React.createElement("p", { className: "dsw-help" },
					"Saved PCs live in your Harness data folder and survive container rebuilds. ",
					"Pasted private keys are written to ",
					React.createElement("code", null, sshKeysDirPath),
					" (on ProDesk: deepseek-harness/data/home/ssh/). ",
					"Optional: point at a read-only host key such as /home/node/.ssh/id_ed25519 instead."),
				React.createElement("div", { className: "dsw-section" },
					React.createElement("div", { className: "dsw-sectionTitle" }, "Saved PCs"),
					hosts.length
						? React.createElement("div", { className: "dsw-hostList" }, hosts.map((h) => React.createElement("div", {
							key: h.id,
							className: editingId === h.id ? "dsw-hostRow dsw-hostRowActive" : "dsw-hostRow",
						},
							React.createElement("div", { className: "dsw-hostMeta" },
								React.createElement("strong", null, h.label),
								React.createElement("code", null, `${h.user}@${h.hostname}`),
								React.createElement("span", { className: "dsw-msg" }, keyStatusLabel(h)),
							),
							React.createElement("div", { className: "dsw-hostActions" },
								React.createElement("button", { type: "button", className: "dsw-btn", onClick: () => startEdit(h) }, "Edit"),
								React.createElement("button", { type: "button", className: "dsw-btn", onClick: () => testHost(h) }, "Test"),
								React.createElement("button", { type: "button", className: "dsw-btn", onClick: () => removeHost(h.id) }, "Remove"),
							),
						)))
						: React.createElement("div", { className: "dsw-hostRowEmpty" }, "No saved PCs yet."),
				),
				React.createElement("div", { className: "dsw-section" },
					React.createElement("div", { className: "dsw-sectionTitle" }, editingId ? "Edit PC" : "Add PC"),
					React.createElement("div", { className: "dsw-form" },
						editingId && React.createElement("div", { className: "dsw-label" }, `Editing ${editingId}`),
					React.createElement("div", { className: "dsw-formRow dsw-formRow--grid" },
						React.createElement("input", { className: "dsw-input", placeholder: "Name (My Linux PC)", value: draft.label, onChange: (e) => setDraft({ ...draft, label: e.target.value }) }),
						React.createElement("input", { className: "dsw-input", placeholder: "Username", value: draft.user, onChange: (e) => setDraft({ ...draft, user: e.target.value }) }),
						React.createElement("input", { className: "dsw-input", placeholder: "IP address", value: draft.hostname, onChange: (e) => setDraft({ ...draft, hostname: e.target.value }) }),
					),
					React.createElement("div", { className: "dsw-label" }, "Private key — paste the contents of your key file (starts with -----BEGIN OPENSSH PRIVATE KEY-----)"),
					React.createElement("textarea", {
						className: "dsw-textarea",
						placeholder: editingId
							? "Paste a new private key to replace the saved one (leave empty to keep it)…"
							: "Paste private key here…",
						value: draft.privateKey,
						onChange: (e) => setDraft({ ...draft, privateKey: e.target.value }),
					}),
					React.createElement("div", { className: "dsw-label" }, "Or use an existing key file (optional — host mount or a file under the folder above)"),
					React.createElement("input", {
						className: "dsw-input",
						placeholder: `${sshKeysDirPath}/my-linux-pc.key`,
						value: draft.identityFile,
						onChange: (e) => setDraft({ ...draft, identityFile: e.target.value }),
					}),
					React.createElement("div", { className: "dsw-formRow" },
						React.createElement("button", { type: "button", className: "dsw-btn dsw-btnPrimary", onClick: saveHost }, editingId ? "Save changes" : "Add PC"),
						React.createElement("button", { type: "button", className: "dsw-btn", onClick: testDraft }, "Test connection"),
						editingId && React.createElement("button", { type: "button", className: "dsw-btn", onClick: cancelEdit }, "Cancel"),
					),
					),
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
			const path = String(item?.path || "");
			const bindings = bindingsCache.bindings || [];
			const hosts = bindingsCache.hosts || [];
			if (id) {
				const binding = bindings.find((b) => b.workspaceId === id);
				if (binding) {
					const host = hosts.find((h) => h.id === binding.hostId);
					return host?.label || binding.hostId;
				}
			}
			if (path.startsWith("dssh://")) {
				const remoteHostId = path.replace(/^dssh:\/\//, "").split("/")[0];
				const host = hosts.find((h) => h.id === remoteHostId);
				return host?.label || remoteHostId;
			}
			return "local";
		}

		function findWorkspaceForRow(title, items, rowIndex) {
			const byTitle = items.find((w) => {
				const t = String(w?.title || w?.name || "").trim();
				return t && (title === t || title.startsWith(`${t} `));
			});
			if (byTitle) return byTitle;
			if (items[rowIndex]) return items[rowIndex];
			return items.find((w) => {
				const t = String(w?.title || w?.name || "").trim();
				return t && title.includes(t);
			}) || null;
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

		const SKIP_CHIP_TITLES = new Set(["ungrouped"]);

		function decorateWorkspaceChips() {
			const items = window.__dshWorkspacesSnapshot?.items || [];
			document.querySelectorAll(".YDXeBa_projectRow").forEach((row, rowIndex) => {
				const titleEl = row.querySelector(".YDXeBa_title");
				if (!titleEl) return;
				titleEl.querySelectorAll(`.${CHIP_CLASS}`).forEach((node) => node.remove());

				const title = rowTitle(titleEl);
				if (SKIP_CHIP_TITLES.has(title.toLowerCase())) {
					row.classList.remove("dsh-ws-pillRow");
					row.querySelector(".dsh-ws-rowLegend")?.remove();
					return;
				}
				const hit = findWorkspaceForRow(title, items, rowIndex);
				if (!hit) {
					row.classList.remove("dsh-ws-pillRow");
					row.querySelector(".dsh-ws-rowLegend")?.remove();
					return;
				}
				const label = chipLabelForWorkspace(hit);
				const pillText = label === "local" ? "local" : label;

				row.classList.add("dsh-ws-pillRow");
				let legend = row.querySelector(".dsh-ws-rowLegend");
				if (!legend) {
					legend = document.createElement("div");
					legend.className = "dsh-ws-rowLegend";
					legend.setAttribute("aria-hidden", "true");
					row.prepend(legend);
				}
				let pill = legend.querySelector(`.${CHIP_CLASS}`);
				if (!pill) {
					pill = document.createElement("span");
					pill.className = CHIP_CLASS;
					legend.appendChild(pill);
				}
				if (pill.textContent !== pillText) pill.textContent = pillText;
				pill.dataset.kind = label === "local" ? "local" : "remote";
				const tip = label === "local" ? "Local workspace" : `Remote workspace · ${label}`;
				if (pill.title !== tip) pill.title = tip;
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

		function ensureAddWorkspaceButton() {
			document.querySelectorAll(".qDHVXG_sectionHeader").forEach((header) => {
				const label = header.querySelector(".qDHVXG_sectionLabel");
				if (!label || !/workspaces/i.test(label.textContent || "")) return;
				if (header.querySelector('button[aria-label="Add workspace"]') || header.querySelector(".dsw-addWorkspaceBtn")) return;
				const actions = header.querySelector(".qDHVXG_headerActions") || header;
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "dsw-addWorkspaceBtn";
				btn.setAttribute("aria-label", "Add workspace");
				btn.title = "Add workspace";
				btn.textContent = "+";
				actions.appendChild(btn);
			});
		}

		function isAddWorkspaceButton(el) {
			if (!(el instanceof Element)) return null;
			const btn = el.closest("button");
			if (!(btn instanceof HTMLButtonElement)) return null;
			if ((btn.getAttribute("aria-label") || "").trim() === "Add workspace") return btn;
			if (btn.classList.contains("dsw-addWorkspaceBtn")) return btn;
			return null;
		}

		const inject = ["connection", "workspaces", "slots"];

		function apply(ctx) {
			ensureStyles();
			document.documentElement.setAttribute("data-dsh-ssh-workspace", "0.2.0");

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
						void refreshBindings(conn).finally(() => scheduleDecorateChips());
					});
					void refreshBindings(conn).finally(() => scheduleDecorateChips());
					scheduleDecorateChips();
					return () => { unsub?.(); };
				}, `${PLUGIN}: chips`);

				scope.effect(() => {
					ensureAddWorkspaceButton();
					const iv = setInterval(ensureAddWorkspaceButton, 2000);
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
					return () => { clearInterval(iv); document.removeEventListener("click", onClick, true); closePicker(); };
				}, `${PLUGIN}: add workspace`);
			});
		}

		window.__dshSshWorkspaceRpc = (connection, endpoint, payload) => callRpc(connection || activeConnection, endpoint, payload);

		return { apply, inject };
	},
});

// dsh-sidebar-files — Workspaces header Sessions ↔ Files + sidebar file trees.
// Own tree (FileLens list/search API). File click opens the right FileLens panel.
window.__ModuleLoader__.load({
	id: "dsh-sidebar-files",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		let ReactDOMClient = null;
		try {
			ReactDOMClient = require("react-dom/client");
		} catch {
			ReactDOMClient = null;
		}
		const PLUGIN = "dsh-sidebar-files";
		const STORE_KEY = "dsh-sidebar-files.view.v2";
		const DOT_KEY = "dsh-sidebar-files.dot.v1";
		const EXPAND_KEY = "dsh-sidebar-files.expand.v1";
		const MODE_EVENT = "dsh-sidebar-files-mode";
		const PREFS_EVENT = "dsh-sidebar-files-prefs";
		const CURRENT_WS_KEY = "dsh-sidebar-files.currentWorkspace.v1";
		const CURRENT_WS_EVENT = "dsh-current-workspace-changed";
		const WS_SWITCH_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>';
		// Single outline chat bubble shown in place of the workspace folder icon while in Sessions (chat) mode.
		const CHAT_BUBBLE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';

		const css = `
.dsh-sf-chatIcon{
  display:none;
  flex:0 0 auto;
  align-items:center;
  justify-content:center;
  width:18px;height:18px;
  color:var(--dsh-ws-folder-color, currentColor);
  pointer-events:none;
}
.dsh-sf-chatIcon svg{display:block;width:15px;height:15px}
/* Sessions mode: keep stock folder node intact for React, hide it visually,
   and show our own bubble sibling instead (never mutate folder.innerHTML). */
.qDHVXG_groupSection[data-dsh-sf-mode="sessions"] > .YDXeBa_projectRow > .dsh-sf-chatIcon{
  display:inline-flex;
}
.qDHVXG_groupSection[data-dsh-sf-mode="sessions"] > .YDXeBa_projectRow > .YDXeBa_folder{
  width:0 !important;min-width:0 !important;max-width:0 !important;
  height:0 !important;margin:0 !important;padding:0 !important;
  overflow:hidden !important;opacity:0 !important;
  pointer-events:none !important;border:0 !important;
}
.qDHVXG_groupSection[data-dsh-sf-mode="files"] .YDXeBa_sessionRow,
.qDHVXG_groupSection[data-dsh-sf-mode="files"] .qDHVXG_sessionOverflowButton{
  display:none !important;
}
/* If stock session-search ever wins, keep it out of the way in Files mode. */
html[data-dsh-sf-view="files"] .qDHVXG_searchTree,
html[data-dsh-sf-view="files"] .qDHVXG_list .qDHVXG_searchStatus,
html[data-dsh-sf-view="files"] .qDHVXG_list .qDHVXG_searchWarning{
  display:none !important;
}
.qDHVXG_groupSection[data-dsh-sf-mode="files"] > .dsh-sf-tree{
  display:block;
}
.qDHVXG_groupSection[data-dsh-sf-mode="files"][data-dsh-sf-collapsed="1"] > .dsh-sf-tree{
  display:none !important;
}
.qDHVXG_groupSection[data-dsh-sf-mode="files"] > .YDXeBa_projectRow,
.qDHVXG_groupSection[data-dsh-sf-mode="files"] .YDXeBa_projectRow{
  cursor:pointer;
}
.qDHVXG_groupSection[data-dsh-sf-redundant="1"]{
  display:none !important;
}
/* No position/display override on .YDXeBa_projectRow itself — forcing
   position:relative previously broke an existing absolutely-positioned
   native element inside the row (it started filling the whole row and
   swallowed our clicks). The zone below is a plain in-flow element that
   rides along in the row's own (flex) layout, so it never needs the row
   to change position/display, and nothing can silently overlay it. */
.dsh-sf-wsZone{
  display:inline-flex;align-items:center;justify-content:center;
  align-self:stretch;
  flex:0 0 auto;
  width:0;min-width:0;margin:0;padding:0;
  border-radius:6px;
  cursor:pointer;
  background:transparent;
  color:var(--dsw-alias-state-business-primary,#5b9dff);
  overflow:hidden;
  transition:width .12s ease, margin .12s ease, background .12s ease, color .12s ease;
}
.dsh-sf-wsZone svg{
  width:13px;height:13px;flex:none;display:block;
  opacity:0;
  pointer-events:none;
  transition:opacity .12s ease;
}
/* Split only appears while hovering the row — at rest the row is 100% unchanged. */
.YDXeBa_projectRow:hover .dsh-sf-wsZone,
.YDXeBa_projectRow:focus-within .dsh-sf-wsZone{
  width:20%;min-width:22px;max-width:36px;margin-right:6px;
}
.YDXeBa_projectRow:hover .dsh-sf-wsZone svg,
.YDXeBa_projectRow:focus-within .dsh-sf-wsZone svg{
  opacity:.8;
}
.dsh-sf-wsZone:hover{
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#5b9dff) 24%,transparent);
}
.dsh-sf-wsZone:hover svg{
  opacity:1;
}
.dsh-sf-wsZone:focus-visible{
  outline:2px solid var(--dsw-alias-state-business-primary,#5b9dff);
  outline-offset:1px;
}
/* Persistent "current workspace" indicator: a subtle left accent line only —
   no box, no width change, so it never looks like a big highlighted button. */
.YDXeBa_projectRow[data-dsh-sf-current="1"]{
  box-shadow:inset 3px 0 0 0 var(--dsw-alias-state-business-primary,#5b9dff);
}
.qDHVXG_sectionHeader .qDHVXG_headerActions{
  /* Stock caps at ~60px (two icons). Our Files toggle lives here too. */
  width:auto !important;
  max-width:none !important;
  flex:0 0 auto !important;
  display:inline-flex !important;
  align-items:center;
  gap:0;
}
.qDHVXG_sectionHeader .dsh-sf-headerToggle,
.qDHVXG_sectionHeader .dsh-sf-headerDot{
  height:28px;width:28px;padding:0;margin:0;border:none;border-radius:6px;
  background:transparent;color:var(--dsw-alias-label-tertiary,#999);
  display:inline-flex;align-items:center;justify-content:center;flex:none;flex-shrink:0;
  cursor:pointer;position:relative;z-index:2;
}
.qDHVXG_sectionHeader .dsh-sf-headerToggle:hover,
.qDHVXG_sectionHeader .dsh-sf-headerDot:hover{
  color:var(--dsw-alias-label-primary,#fff);
  background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));
}
.qDHVXG_sectionHeader .dsh-sf-headerToggle{
  color:var(--dsw-alias-state-business-primary,#3d8bfd);
}
.qDHVXG_sectionHeader .dsh-sf-headerDot[aria-pressed="true"]{
  color:var(--dsw-alias-state-business-primary,#3d8bfd);
}
.qDHVXG_sectionHeader .dsh-sf-headerToggle svg,
.qDHVXG_sectionHeader .dsh-sf-headerDot svg{width:18px;height:18px;display:block}
/* Eye only in Files mode — no reserved gap in Sessions; toggle stays left of Add */
.qDHVXG_sectionHeader .dsh-sf-headerDot{display:none}
.qDHVXG_sectionHeader[data-dsh-sf-files="1"] .dsh-sf-headerDot{display:inline-flex}
.dsh-sf-tree{
  margin:2px 0 4px;padding:2px 0 4px 4px;
  max-height:min(42vh, 320px);overflow:auto;
  border-left:2px solid var(--dsw-alias-border-l2);
  margin-left:10px;
}
.dsh-sf-tool{
  height:22px;padding:0 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#333);
  background:transparent;color:var(--dsw-alias-label-secondary,#aaa);
  font:inherit;font-size:11px;cursor:pointer;display:inline-flex;align-items:center;gap:4px;
}
.dsh-sf-tool:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsh-sf-newRow{display:flex;flex-wrap:nowrap;gap:4px;align-items:center;padding:4px 4px 6px;width:100%;box-sizing:border-box;margin:2px 0}
.dsh-sf-newInput{
  flex:1;min-width:0;height:22px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#444);
  background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:0 10px;font:inherit;font-size:11px;
}
.dsh-sf-kind{
  display:inline-flex;flex:none;height:22px;padding:1px;gap:0;
  border:1px solid var(--dsw-alias-border-l2,#444);border-radius:7px;
  background:var(--dsw-alias-bg-layer-2,#1a1a1a);box-sizing:border-box;
}
.dsh-sf-kindBtn{
  width:24px;height:18px;padding:0;margin:0;border:none;border-radius:5px;
  background:transparent;color:var(--dsw-alias-label-tertiary,#888);
  cursor:pointer;display:inline-flex;align-items:center;justify-content:center;
}
.dsh-sf-kindBtn svg{width:12px;height:12px;display:block}
.dsh-sf-kindBtn:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06))}
.dsh-sf-kindBtn.on{
  color:var(--dsw-alias-label-primary,#fff);
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#5b9dff) 22%,transparent);
}
.dsh-sf-kindBtn:disabled{opacity:.5;cursor:not-allowed}
.dsh-sf-row{
  display:flex;align-items:center;gap:4px;min-height:26px;padding:0 6px 0 4px;
  border-radius:6px;cursor:pointer;user-select:none;
  color:var(--dsw-alias-label-primary);font-size:12px;line-height:18px;
  box-sizing:border-box;width:100%;text-align:left;background:transparent;border:none;
  position:relative;
}
.dsh-sf-row:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-sf-rowAdd,.dsh-sf-rowRen,.dsh-sf-rowDel,.dsh-sf-rowLive{
  flex:none;width:18px;height:18px;padding:0;border:none;border-radius:4px;
  background:transparent;color:var(--dsw-alias-label-tertiary,#888);
  font:inherit;font-size:14px;line-height:16px;cursor:pointer;
  opacity:0;display:inline-flex;align-items:center;justify-content:center;
}
.dsh-sf-rowActs{
  flex:none;margin-left:auto;display:inline-flex;align-items:center;gap:1px;
}
.dsh-sf-row:hover .dsh-sf-rowAdd,.dsh-sf-row:hover .dsh-sf-rowRen,.dsh-sf-row:hover .dsh-sf-rowDel,.dsh-sf-row:hover .dsh-sf-rowLive,
.dsh-sf-rowAdd:focus,.dsh-sf-rowRen:focus,.dsh-sf-rowDel:focus,.dsh-sf-rowDel.confirm,.dsh-sf-rowLive:focus{opacity:1}
.dsh-sf-rowAdd:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsh-sf-rowRen{font-size:12px}
.dsh-sf-rowRen:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsh-sf-rowLive{font-size:11px;color:var(--dsw-alias-state-business-primary,#3fb950)}
.dsh-sf-rowLive:hover{color:var(--dsw-alias-state-business-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3fb950) 16%,transparent)}
.dsh-sf-rowDel:hover{color:var(--dsw-alias-state-error-primary,#f07178);background:rgba(240,113,120,.12)}
.dsh-sf-renameRow{display:flex;align-items:center;gap:4px;padding:2px 4px 4px;width:100%;box-sizing:border-box}
.dsh-sf-renameInput{
  flex:1;min-width:0;height:22px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2,#444);
  background:var(--dsw-alias-bg-layer-2,#222);color:inherit;padding:0 8px;font:inherit;font-size:11px;
}
.dsh-sf-rowDel.confirm{
  color:var(--dsw-alias-state-error-primary,#f07178);
  background:rgba(240,113,120,.18);
  font-weight:600;
}
.dsh-sf-caret{
  width:12px;height:12px;flex:none;display:inline-flex;align-items:center;justify-content:center;
  color:var(--dsw-alias-label-caption);transition:transform .12s ease;
}
.dsh-sf-caret.open{transform:rotate(90deg)}
.dsh-sf-ico{width:14px;height:14px;flex:none;color:var(--dsw-alias-label-tertiary);display:inline-flex}
.dsh-sf-ico.dir{color:var(--dsw-alias-state-warn-primary,#e8a33d)}
.dsh-sf-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;flex:1}
.dsh-sf-status{
  padding:8px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-tertiary)
}
.dsh-sf-status.err{color:var(--dsw-alias-state-error-primary)}
.dsh-sf-row[draggable="true"]{cursor:grab}
.dsh-sf-composerDrop{outline:2px dashed var(--dsw-alias-state-business-primary)!important;outline-offset:2px}
.dsh-sf-row.dsh-sf-dragging{opacity:.4}
.dsh-sf-row.dsh-sf-dropHover{
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3d8bfd) 18%,transparent) !important;
  outline:1px dashed var(--dsw-alias-state-business-primary,#3d8bfd);outline-offset:-1px;
}
.dsh-sf-tree.dsh-sf-dropHoverRoot{
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3d8bfd) 7%,transparent);
  outline:1px dashed color-mix(in srgb,var(--dsw-alias-state-business-primary,#3d8bfd) 60%,transparent);
  outline-offset:-1px;
}
.YDXeBa_projectRow.dsh-sf-dropHoverWs{
  outline:1px dashed var(--dsw-alias-state-business-primary,#3d8bfd);outline-offset:-2px;border-radius:6px;
}
/* Files mode: stock + means new folder */
.qDHVXG_groupSection[data-dsh-sf-mode="files"] button[aria-label^="New session in "]{
  /* keep hover visibility as stock */
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-sidebar-files-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-sidebar-files-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function getView() {
			try {
				const v = localStorage.getItem(STORE_KEY);
				if (v === "files" || v === "sessions") return v;
				const legacy = JSON.parse(localStorage.getItem("dsh-sidebar-files.mode.v1") || "null");
				if (legacy && typeof legacy === "object" && Object.values(legacy).includes("files")) {
					return "files";
				}
			} catch { /* ignore */ }
			return "sessions";
		}

		function setView(mode) {
			const next = mode === "files" ? "files" : "sessions";
			localStorage.setItem(STORE_KEY, next);
			if (next === "files") {
				// Drop any active session-search so stock UI doesn't replace the tree.
				clearStockSessionSearch();
			} else {
				setFileQuery("");
			}
			try {
				document.documentElement.dataset.dshSfView = next;
			} catch { /* ignore */ }
			window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { view: getView() } }));
		}

		function getShowDot() {
			try { return localStorage.getItem(DOT_KEY) === "1"; } catch { return false; }
		}

		function setShowDot(on) {
			localStorage.setItem(DOT_KEY, on ? "1" : "0");
			window.dispatchEvent(new CustomEvent(PREFS_EVENT));
		}

		function getFileQuery() {
			return typeof window.__dshSfQuery === "string" ? window.__dshSfQuery : "";
		}

		function setFileQuery(q) {
			const next = String(q || "");
			const prev = typeof window.__dshSfQuery === "string" ? window.__dshSfQuery : "";
			if (prev === next) {
				syncFileSearchInput();
				return;
			}
			const wasActive = !!prev.trim();
			const nowActive = !!next.trim();
			window.__dshSfQuery = next;
			window.dispatchEvent(new CustomEvent(PREFS_EVENT));
			// Expand/remount when search starts or ends — not on every keystroke
			if (wasActive !== nowActive) {
				window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { view: getView() } }));
			}
			syncFileSearchInput();
		}

		/** Keep the stock (controlled) search input showing our file query without flipping to session SearchResults. */
		function syncFileSearchInput() {
			if (getView() !== "files") return;
			const input = document.querySelector("input.qDHVXG_searchInput");
			if (!(input instanceof HTMLInputElement)) return;
			const want = getFileQuery();
			if (input.value === want) return;
			try {
				const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
				if (desc && typeof desc.set === "function") desc.set.call(input, want);
				else input.value = want;
			} catch {
				input.value = want;
			}
		}

		/** Collapse stock session search so WorkspaceBrowser keeps rendering SessionTree (our file hosts). */
		function clearStockSessionSearch() {
			const clearBtn = document.querySelector(".qDHVXG_sectionHeader .qDHVXG_clearButton");
			if (clearBtn instanceof HTMLElement) {
				clearBtn.click();
				return;
			}
			const input = document.querySelector("input.qDHVXG_searchInput");
			if (input instanceof HTMLInputElement) {
				input.dispatchEvent(new KeyboardEvent("keydown", {
					key: "Escape", code: "Escape", keyCode: 27, which: 27, bubbles: true, cancelable: true,
				}));
			}
		}

		function getExpandedMap() {
			try {
				const raw = JSON.parse(localStorage.getItem(EXPAND_KEY) || "{}");
				return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
			} catch {
				return {};
			}
		}

		function isWsExpanded(key) {
			return !!getExpandedMap()[key];
		}

		function setWsExpanded(key, on) {
			const m = getExpandedMap();
			if (on) m[key] = 1;
			else delete m[key];
			try { localStorage.setItem(EXPAND_KEY, JSON.stringify(m)); } catch { /* ignore */ }
		}

		function toggleWsExpanded(key) {
			setWsExpanded(key, !isWsExpanded(key));
		}

		/**
		 * "Current workspace" — a lightweight pointer (independent of any open
		 * chat session) that other tools (Git, Containers, Database, Test envs)
		 * can default to when no chat is open. Set by clicking a workspace row's
		 * chevron in the sidebar.
		 */
		function getCurrentWorkspace() {
			try {
				const raw = JSON.parse(localStorage.getItem(CURRENT_WS_KEY) || "null");
				if (raw && typeof raw === "object" && typeof raw.cwd === "string" && raw.cwd) return raw;
			} catch { /* ignore */ }
			return null;
		}

		function setCurrentWorkspace(ws) {
			try {
				if (ws && ws.cwd) localStorage.setItem(CURRENT_WS_KEY, JSON.stringify(ws));
				else localStorage.removeItem(CURRENT_WS_KEY);
			} catch { /* ignore */ }
			window.dispatchEvent(new CustomEvent(CURRENT_WS_EVENT, { detail: ws || null }));
		}

		function workspaceKeyFromItem(w) {
			return w?.workspaceId || w?.id || w?.path || w?.name || w?.title || "default";
		}

		function workspaceLabel(w) {
			return String(w?.title || w?.name || w?.label || w?.path || "").trim();
		}

		function workspaceCwd(w) {
			const p = w?.path || w?.cwd;
			return typeof p === "string" && p ? p : null;
		}

		function resolveWorkspace(workspaces, row) {
			const titleEl = row.querySelector(".YDXeBa_title");
			const title = (titleEl?.textContent || "").trim();
			if (!title) return null;
			const items = workspaces?.list?.getSnapshot?.()?.items || [];
			const hit = items.find((w) => workspaceLabel(w).toLowerCase() === title.toLowerCase());
			if (!hit) return null;
			const cwd = workspaceCwd(hit);
			if (!cwd) return null;
			return { key: workspaceKeyFromItem(hit), label: workspaceLabel(hit) || title, cwd, item: hit };
		}

		function getActiveWorkspace(workspaces, sessions) {
			try {
				const sessSnap = sessions?.list?.getSnapshot?.();
				const wsSnap = workspaces?.list?.getSnapshot?.();
				const current = sessSnap?.current;
				const items = wsSnap?.items || [];
				if (current && items.length > 0) {
					const hit = items.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(current));
					if (hit) {
						const cwd = workspaceCwd(hit);
						if (cwd) return { key: workspaceKeyFromItem(hit), label: workspaceLabel(hit), cwd, item: hit };
					}
				}
			} catch { /* ignore */ }
			return getCurrentWorkspace();
		}

		function switchWorkspace(workspaces, sessions, ws) {
			if (!ws) return;
			// 1. Record as active pointer in localStorage & dispatch custom event
			setCurrentWorkspace({ key: ws.key, cwd: ws.cwd, label: ws.label });

			// 2. Actually switch the body view in Harness to this workspace
			try {
				const wsItem = ws.item;
				const wsId = wsItem?.workspaceId || ws.key;
				const sessSnap = sessions?.list?.getSnapshot?.();
				const wsSnap = workspaces?.list?.getSnapshot?.();
				const archived = new Set(wsSnap?.archivedSessionIds || []);

				let candidateIds = Array.isArray(wsItem?.sessionIds) ? wsItem.sessionIds : [];
				candidateIds = candidateIds.filter((id) => !archived.has(id));

				let targetSessionId = null;
				if (candidateIds.length > 0 && sessSnap?.byId) {
					const valid = candidateIds.filter((id) => sessSnap.byId[id] !== undefined);
					if (valid.length > 0) {
						valid.sort((a, b) => {
							const tA = Number(sessSnap.byId[a]?.updatedAt) || 0;
							const tB = Number(sessSnap.byId[b]?.updatedAt) || 0;
							return tB - tA;
						});
						targetSessionId = valid[0];
					}
				}

				if (targetSessionId && sessions && typeof sessions.open === "function") {
					sessions.open(targetSessionId);
				} else if (wsId && workspaces && typeof workspaces.startSession === "function") {
					workspaces.startSession(wsId);
				}
			} catch (err) {
				console.warn("[dsh-sidebar-files] failed to switch workspace session:", err);
			}
		}

		async function callRemote(method, args) {
			const endpoint = method.slice(5);
			const rpcId = typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: "id-" + Math.random().toString(36).slice(2);
			let res;
			try {
				res = await fetch("/api/files/" + endpoint, {
					method: "POST",
					headers: { "content-type": "application/json" },
					body: JSON.stringify({
						type: "client-request",
						rpcId,
						method: "files/" + endpoint,
						payload: { args: { args } },
					}),
				});
			} catch (err) {
				const e = new Error("files transport failure: " + (err && err.message || String(err)));
				e.kind = "transport";
				throw e;
			}
			if (!res.ok) throw new Error("files transport failure: HTTP " + res.status);
			let full;
			try {
				full = await res.json();
			} catch {
				throw new Error("files transport failure: bad response");
			}
			if (full.rpcId !== rpcId) throw new Error("files transport failure: rpcId mismatch");
			const result = full.result;
			if (!result || result.ok !== true) {
				const err = new Error(result && result.error && result.error.message || "remote " + method + " failed");
				err.kind = result && result.error && result.error.code;
				throw err;
			}
			return result.value;
		}

		const DRAG_MIME = "application/x-dsh-sidebar-file";
		const MOVE_EVENT = "dsh-sf-move";

		function dragHasSidebarFile(dt) {
			if (!dt || !dt.types) return false;
			const types = [...dt.types];
			return types.includes(DRAG_MIME) || types.includes("application/x-dsh-sidebar-file");
		}

		function readDragPayload(ev) {
			let raw;
			try {
				raw = ev.dataTransfer.getData(DRAG_MIME);
			} catch {
				raw = "";
			}
			if (!raw) {
				try {
					// legacy: JSON was stuffed into text/plain
					raw = ev.dataTransfer.getData("text/plain");
				} catch {
					return null;
				}
			}
			if (!raw) return null;
			try {
				const payload = JSON.parse(raw);
				if (payload && typeof payload === "object" && payload.__dshFile && payload.path && payload.root) return payload;
			} catch { /* not ours */ }
			return null;
		}

		function readDroppedPath(ev) {
			const payload = readDragPayload(ev);
			if (payload?.path) return String(payload.path);
			try {
				const plain = ev.dataTransfer.getData("text/plain");
				if (typeof plain === "string" && plain.trim().startsWith("/") && !plain.trim().startsWith("{")) {
					return plain.trim().split(/\r?\n/)[0].trim();
				}
			} catch { /* ignore */ }
			return null;
		}

		async function performMove(args) {
			return callRemote("file.move", args);
		}

		function openInCodeTab(path) {
			if (typeof path !== "string" || !path) return;
			window.dispatchEvent(new CustomEvent("dsh-open-code-file", { detail: { path } }));
			const tabs = document.querySelectorAll('[role="tab"]');
			for (const tab of tabs) {
				if ((tab.textContent || "").trim() === "Code") {
					tab.click();
					return;
				}
			}
		}

		function resolveLiveSessionId() {
			try {
				const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
				if (parsed?.sessionId) return parsed.sessionId;
			} catch { /* ignore */ }
			return null;
		}

		/** Open HTML (or folder with index.html) via dsh-browser Live Server → Browser tab. */
		function openWithLiveServer(path) {
			if (typeof path !== "string" || !path) return;
			const sessionId = resolveLiveSessionId();
			if (!sessionId) {
				console.warn("[dsh-sidebar-files] Live Server needs an active chat session");
				return;
			}
			window.dispatchEvent(new CustomEvent("dsh-open-browser-url", {
				detail: { sessionId, path },
			}));
		}

		function isHtmlEntry(entry) {
			if (!entry) return false;
			if (entry.type === "directory") return true;
			return /\.html?$/i.test(String(entry.name || entry.path || ""));
		}

		function joinPath(parent, name) {
			const base = String(parent || "").replace(/\/+$/, "");
			const leaf = String(name || "").replace(/^\/+/, "");
			if (!base) return "/" + leaf;
			return base + "/" + leaf;
		}

		function isSafeEntryName(name) {
			const n = String(name || "").trim();
			if (!n) return false;
			if (n === "." || n === "..") return false;
			if (/[\\/]/.test(n)) return false;
			return true;
		}

		/** Match FileLens extColor palette (html slightly warmer for contrast). */
		function extColor(name) {
			const m = /\.[^.]+$/.exec(name || "");
			if (!m) return null;
			const e = m[0].slice(1).toLowerCase();
			if (["js", "jsx", "ts", "tsx", "mjs", "cjs", "py", "go", "rs", "java", "c", "h", "cpp", "hpp", "cs", "php", "rb", "sh", "ps1", "bat", "kt", "swift", "lua", "dart", "sql"].includes(e)) return "#5b9dff";
			if (["json", "yaml", "yml", "toml", "xml", "ini", "cfg", "conf"].includes(e)) return "#e8a33d";
			if (["md", "markdown", "mdx", "txt", "rst", "log"].includes(e)) return "#b48ae6";
			if (["html", "htm"].includes(e)) return "#e8875a";
			if (["css", "scss", "less", "vue", "svelte"].includes(e)) return "#e0709a";
			if (["png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "csv", "tsv", "diff", "patch"].includes(e)) return "#55c285";
			return null;
		}

		function iconSvg(kind, color) {
			const strokeProps = {
				viewBox: "0 0 16 16", fill: "none", stroke: "currentColor", strokeWidth: "1.4",
				"aria-hidden": "true", style: color ? { color } : undefined,
			};
			if (kind === "caret") {
				return React.createElement("svg", {
					viewBox: "0 0 12 12", fill: "currentColor", "aria-hidden": "true",
				}, React.createElement("path", { d: "M4.2 2.4 8.4 6 4.2 9.6z" }));
			}
			if (kind === "folder") {
				return React.createElement("svg", {
					viewBox: "0 0 16 16", fill: "currentColor", "aria-hidden": "true",
					style: { color: color || "var(--dsw-alias-state-warn-primary,#e8a33d)" },
				}, React.createElement("path", { d: "M2.5 4.5h4l1 1.5h6v6.5h-11z" }));
			}
			if (kind === "folderPlus") {
				return React.createElement("svg", strokeProps,
					React.createElement("path", { d: "M3 5h3.5l1 1.2H13v6.3H3z", strokeLinejoin: "round" }),
					React.createElement("path", { d: "M8 8v3M6.5 9.5h3", strokeLinecap: "round" }),
				);
			}
			if (kind === "eye") {
				return React.createElement("svg", strokeProps,
					React.createElement("path", { d: "M1.5 8s2.5-4 6.5-4 6.5 4 6.5 4-2.5 4-6.5 4-6.5-4-6.5-4z", strokeLinejoin: "round" }),
					React.createElement("circle", { cx: "8", cy: "8", r: "1.6" }),
				);
			}
			if (kind === "eyeOff") {
				return React.createElement("svg", strokeProps,
					React.createElement("path", { d: "M2 2l12 12M3.2 3.8C2.2 4.7 1.5 6 1.5 8s2.5 4 6.5 4c1.2 0 2.2-.3 3.1-.7M6.2 4.3C6.7 4.1 7.3 4 8 4c4 0 6.5 4 6.5 4a10 10 0 0 1-1.7 2", strokeLinecap: "round", strokeLinejoin: "round" }),
				);
			}
			if (kind === "pen") {
				return React.createElement("svg", strokeProps,
					React.createElement("path", { d: "M10.5 2.5l1 1-7 7-1.5.5.5-1.5 7-7z", strokeLinejoin: "round" }),
					React.createElement("path", { d: "M9 4l3 3", strokeLinecap: "round" }),
				);
			}
			return React.createElement("svg", {
				viewBox: "0 0 16 16",
				fill: color ? "currentColor" : "none",
				fillOpacity: color ? "0.22" : undefined,
				stroke: "currentColor",
				strokeWidth: "1.5",
				"aria-hidden": "true",
				style: color ? { color } : undefined,
			},
				React.createElement("path", { d: "M4.5 2.5h5l2.5 2.5v8.5h-7.5z", strokeLinejoin: "round" }),
			);
		}

		function parentOf(path, fallback) {
			const s = String(path || "").replace(/\/+$/, "");
			const i = s.lastIndexOf("/");
			if (i < 0) return fallback;
			if (i === 0) return "/";
			return s.slice(0, i);
		}

		const NEW_ENTRY_EVENT = "dsh-sf-new-folder"; // legacy event name; creates file or folder

		function SideTree({ root, workspaces }) {
			const [dirs, setDirs] = React.useState(() => ({}));
			const [expanded, setExpanded] = React.useState(() => ({ [root]: true }));
			const [status, setStatus] = React.useState({ state: "loading" });
			const [showDot, setShowDotState] = React.useState(getShowDot);
			const [query, setQueryState] = React.useState(getFileQuery);
			const [newAt, setNewAt] = React.useState(null); // parent path for inline create
			const [newKind, setNewKind] = React.useState("folder"); // 'file' | 'folder'
			const [newName, setNewName] = React.useState("");
			const [creating, setCreating] = React.useState(false);
			const [createErr, setCreateErr] = React.useState(null);
			const [searchHits, setSearchHits] = React.useState(null);
			const [searching, setSearching] = React.useState(false);
			const [deleting, setDeleting] = React.useState(null);
			const [pendingDelete, setPendingDelete] = React.useState(null);
			const [renameAt, setRenameAt] = React.useState(null);
			const [renameName, setRenameName] = React.useState("");
			const [renaming, setRenaming] = React.useState(false);
			const [dragOverPath, setDragOverPath] = React.useState(null);
			const [draggingPath, setDraggingPath] = React.useState(null);

			React.useEffect(() => {
				const onPrefs = () => {
					setShowDotState(getShowDot());
					setQueryState(getFileQuery());
				};
				window.addEventListener(PREFS_EVENT, onPrefs);
				return () => window.removeEventListener(PREFS_EVENT, onPrefs);
			}, []);

			const cancelNewEntry = React.useCallback(() => {
				setNewAt(null);
				setNewName("");
				setCreateErr(null);
			}, []);

			const cancelRename = React.useCallback(() => {
				setRenameAt(null);
				setRenameName("");
			}, []);

			// Cancel inline create when clicking anywhere except the create row.
			React.useEffect(() => {
				if (!newAt) return;
				const onPointerDown = (e) => {
					const t = e.target;
					if (!(t instanceof Element)) return;
					if (t.closest(".dsh-sf-newRow")) return;
					cancelNewEntry();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => document.removeEventListener("pointerdown", onPointerDown, true);
			}, [newAt, cancelNewEntry]);

			React.useEffect(() => {
				if (!renameAt) return;
				const onPointerDown = (e) => {
					const t = e.target;
					if (!(t instanceof Element)) return;
					if (t.closest(".dsh-sf-renameRow")) return;
					cancelRename();
				};
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => document.removeEventListener("pointerdown", onPointerDown, true);
			}, [renameAt, cancelRename]);

			// Clear × → ? confirm if user clicks elsewhere or waits too long.
			React.useEffect(() => {
				if (!pendingDelete) return;
				const onPointerDown = (e) => {
					const t = e.target;
					if (!(t instanceof Element)) return;
					if (t.closest(".dsh-sf-rowDel.confirm")) return;
					setPendingDelete(null);
				};
				const timer = window.setTimeout(() => setPendingDelete(null), 4000);
				document.addEventListener("pointerdown", onPointerDown, true);
				return () => {
					window.clearTimeout(timer);
					document.removeEventListener("pointerdown", onPointerDown, true);
				};
			}, [pendingDelete]);

			const loadPath = React.useCallback((path, force) => {
				setDirs((d) => {
					const cur = d[path];
					if (!force && cur && cur.state === "ready") return d;
					return { ...d, [path]: { state: "loading" } };
				});
				callRemote("file.list", { path, root }).then((res) => {
					setDirs((d) => ({
						...d,
						[path]: res && res.ok
							? { state: "ready", entries: res.entries || [] }
							: { state: "error", error: (res && (res.message || res.error)) || "list failed" },
					}));
					if (path === root) {
						setStatus(res && res.ok
							? { state: "ready" }
							: { state: "error", error: (res && (res.message || res.error)) || "list failed" });
					}
				}).catch((err) => {
					setDirs((d) => ({
						...d,
						[path]: { state: "error", error: err && err.message || String(err) },
					}));
					if (path === root) setStatus({ state: "error", error: err && err.message || String(err) });
				});
			}, [root]);

			React.useEffect(() => {
				const onNew = (e) => {
					const detail = e?.detail || {};
					if (detail.root !== root && detail.cwd !== root) return;
					const parent = detail.parentPath || root;
					const kind = detail.kind === "file" ? "file" : "folder";
					setExpanded((ex) => ({ ...ex, [parent]: true }));
					loadPath(parent);
					setNewAt(parent);
					setNewKind(kind);
					setNewName("");
					setCreateErr(null);
				};
				window.addEventListener(NEW_ENTRY_EVENT, onNew);
				return () => window.removeEventListener(NEW_ENTRY_EVENT, onNew);
			}, [root, loadPath]);

			React.useEffect(() => {
				setDirs({});
				setExpanded({ [root]: true });
				setStatus({ state: "loading" });
				setNewAt(null);
				setNewName("");
				loadPath(root, true);
			}, [root, loadPath]);

			React.useEffect(() => {
				const q = String(query || "").trim();
				if (!q) {
					setSearchHits(null);
					setSearching(false);
					return;
				}
				let alive = true;
				setSearching(true);
				const t = window.setTimeout(() => {
					callRemote("file.search", { root, query: q, family: "sidebar:" + root }).then((res) => {
						if (!alive) return;
						setSearchHits(res && res.ok ? (res.results || []) : []);
						setSearching(false);
					}).catch(() => {
						if (!alive) return;
						setSearchHits([]);
						setSearching(false);
					});
				}, 220);
				return () => {
					alive = false;
					window.clearTimeout(t);
				};
			}, [root, query]);

			const toggleDir = (path) => {
				const next = !expanded[path];
				setExpanded((e) => ({ ...e, [path]: next }));
				if (next) loadPath(path);
			};

			const beginNewEntry = (parentPath, kind) => {
				const parent = parentPath || root;
				setExpanded((ex) => ({ ...ex, [parent]: true }));
				loadPath(parent);
				setNewAt(parent);
				setNewKind(kind === "file" ? "file" : "folder");
				setNewName("");
				setCreateErr(null);
			};

			const filterEntries = (entries) => {
				let list = entries || [];
				if (!showDot) list = list.filter((e) => e && e.name && !String(e.name).startsWith("."));
				return list.filter((e) => e && e.name);
			};

			const createEntry = async () => {
				const name = String(newName || "").trim();
				const parent = newAt || root;
				if (!name || creating || !parent) return;
				if (!isSafeEntryName(name)) {
					setCreateErr("Invalid name");
					return;
				}
				setCreating(true);
				setCreateErr(null);
				try {
					if (newKind === "file") {
						const path = joinPath(parent, name);
						const res = await callRemote("file.write", { path, root, text: "" });
						if (!res || !res.ok) {
							setCreateErr((res && (res.message || res.error)) || "create file failed");
							return;
						}
						setNewAt(null);
						setNewName("");
						loadPath(parent, true);
						openInCodeTab(path);
					} else {
						if (typeof workspaces?.createDirectory !== "function") {
							setCreateErr("createDirectory unavailable");
							return;
						}
						await workspaces.createDirectory(parent, name);
						setNewAt(null);
						setNewName("");
						loadPath(parent, true);
					}
				} catch (err) {
					setCreateErr(err && err.message || String(err));
				} finally {
					setCreating(false);
				}
			};

			const deleteEntry = async (entry) => {
				if (!entry || !entry.path || deleting) return;
				const isDir = entry.type === "directory";
				setPendingDelete(null);
				setDeleting(entry.path);
				setCreateErr(null);
				try {
					const res = await callRemote("file.remove", { path: entry.path, root });
					if (!res || !res.ok) {
						setCreateErr((res && (res.message || res.error)) || "delete failed");
						return;
					}
					const parent = parentOf(entry.path, root);
					setExpanded((ex) => {
						const next = { ...ex };
						delete next[entry.path];
						return next;
					});
					setDirs((d) => {
						const next = { ...d };
						delete next[entry.path];
						return next;
					});
					loadPath(parent || root, true);
					if (String(query || "").trim()) {
						setSearchHits((hits) => (hits || []).filter((h) => h && h.path !== entry.path
							&& !(isDir && h.path && String(h.path).startsWith(entry.path.replace(/\/?$/, "/")))));
					}
				} catch (err) {
					setCreateErr(err && err.message || String(err));
				} finally {
					setDeleting(null);
				}
			};

			const requestDelete = (entry) => {
				if (!entry || !entry.path || deleting) return;
				if (pendingDelete === entry.path) {
					deleteEntry(entry);
					return;
				}
				setPendingDelete(entry.path);
			};

			const beginRename = (entry) => {
				if (!entry || !entry.path || renaming) return;
				setPendingDelete(null);
				setNewAt(null);
				setRenameAt(entry.path);
				setRenameName(entry.name || "");
				setCreateErr(null);
			};

			const renameEntry = async () => {
				const fromPath = renameAt;
				const nextName = String(renameName || "").trim();
				if (!fromPath || !nextName || renaming) return;
				if (!isSafeEntryName(nextName)) {
					setCreateErr("Invalid name");
					return;
				}
				const entry = { path: fromPath, name: nextName };
				const parent = parentOf(fromPath, root);
				setRenaming(true);
				setCreateErr(null);
				try {
					const res = await callRemote("file.rename", { path: fromPath, root, newName: nextName });
					if (!res || !res.ok) {
						setCreateErr((res && (res.message || res.error)) || "rename failed");
						return;
					}
					const newPath = res.path || joinPath(parent, nextName);
					setRenameAt(null);
					setRenameName("");
					setExpanded((ex) => {
						const next = { ...ex };
						if (next[fromPath]) {
							next[newPath] = true;
							delete next[fromPath];
						}
						return next;
					});
					setDirs((d) => {
						const next = { ...d };
						delete next[fromPath];
						return next;
					});
					loadPath(parent, true);
					if (String(query || "").trim()) {
						setSearchHits((hits) => (hits || []).map((h) => (
							h && h.path === fromPath ? { ...h, path: newPath, name: nextName } : h
						)));
					}
				} catch (err) {
					setCreateErr(err && err.message || String(err));
				} finally {
					setRenaming(false);
				}
			};

			const handleDrop = React.useCallback(async (ev, destDir, destRootArg) => {
				const payload = readDragPayload(ev);
				setDraggingPath(null);
				if (!payload) return;
				const destRoot = destRootArg || root;
				if (payload.path === destDir) return;
				setCreateErr(null);
				try {
					const res = await performMove({
						path: payload.path,
						root: payload.root,
						destDir,
						destRoot,
					});
					if (!res || !res.ok) {
						setCreateErr((res && (res.message || res.error)) || "move failed");
						return;
					}
					window.dispatchEvent(new CustomEvent(MOVE_EVENT, {
						detail: { srcPath: payload.path, srcRoot: payload.root, destDir, destRoot },
					}));
				} catch (err) {
					setCreateErr(err && err.message || String(err));
				}
			}, [root]);

			// Refresh this tree if a move touched a path inside it (as source or destination),
			// even if the drag originated in / landed in a different mounted workspace tree.
			React.useEffect(() => {
				const onMove = (e) => {
					const d = e?.detail || {};
					if (d.srcRoot === root) {
						loadPath(parentOf(d.srcPath, root) || root, true);
					}
					if (d.destRoot === root) {
						loadPath(d.destDir || root, true);
						setExpanded((ex) => ({ ...ex, [d.destDir || root]: true }));
					}
				};
				window.addEventListener(MOVE_EVENT, onMove);
				return () => window.removeEventListener(MOVE_EVENT, onMove);
			}, [root, loadPath]);

			const rowActions = (entry, opts) => {
				const isDir = entry.type === "directory";
				const kids = [];
				const confirming = pendingDelete === entry.path;
				if (isHtmlEntry(entry)) {
					kids.push(React.createElement("span", {
						key: "live",
						className: "dsh-sf-rowLive",
						role: "button",
						tabIndex: 0,
						title: isDir
							? "Open with Live Server (index.html in Browser)"
							: "Open with Live Server in Browser",
						"aria-label": "Live Server " + entry.name,
						onClick: (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setPendingDelete(null);
							openWithLiveServer(entry.path);
						},
						onKeyDown: (ev) => {
							if (ev.key === "Enter" || ev.key === " ") {
								ev.preventDefault();
								ev.stopPropagation();
								setPendingDelete(null);
								openWithLiveServer(entry.path);
							}
						},
					}, "▶"));
				}
				if (opts && opts.showAdd && isDir) {
					kids.push(React.createElement("span", {
						key: "add",
						className: "dsh-sf-rowAdd",
						role: "button",
						tabIndex: 0,
						title: "New file or folder",
						"aria-label": "New file or folder in " + entry.name,
						onClick: (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setPendingDelete(null);
							beginNewEntry(entry.path, "folder");
						},
						onKeyDown: (ev) => {
							if (ev.key === "Enter" || ev.key === " ") {
								ev.preventDefault();
								ev.stopPropagation();
								setPendingDelete(null);
								beginNewEntry(entry.path, "folder");
							}
						},
					}, "+"));
				}
				kids.push(React.createElement("span", {
					key: "ren",
					className: "dsh-sf-rowRen",
					role: "button",
					tabIndex: 0,
					title: "Rename",
					"aria-label": "Rename " + entry.name,
					onClick: (ev) => {
						ev.preventDefault();
						ev.stopPropagation();
						beginRename(entry);
					},
					onKeyDown: (ev) => {
						if (ev.key === "Enter" || ev.key === " ") {
							ev.preventDefault();
							ev.stopPropagation();
							beginRename(entry);
						}
				},
			}, "✎"));
				kids.push(React.createElement("span", {
					key: "del",
					className: "dsh-sf-rowDel" + (confirming ? " confirm" : ""),
					role: "button",
					tabIndex: 0,
					"data-path": entry.path,
					title: confirming
						? (isDir ? "Click again to delete folder" : "Click again to delete file")
						: (isDir ? "Delete folder" : "Delete file"),
					"aria-label": confirming
						? "Confirm delete " + entry.name
						: ((isDir ? "Delete folder " : "Delete file ") + entry.name),
					onClick: (ev) => {
						ev.preventDefault();
						ev.stopPropagation();
						requestDelete(entry);
					},
					onKeyDown: (ev) => {
						if (ev.key === "Enter" || ev.key === " ") {
							ev.preventDefault();
							ev.stopPropagation();
							requestDelete(entry);
						}
						if (ev.key === "Escape") {
							ev.preventDefault();
							ev.stopPropagation();
							setPendingDelete(null);
						}
					},
				}, deleting === entry.path ? "…" : (confirming ? "?" : "×")));
				return React.createElement("span", { className: "dsh-sf-rowActs" }, ...kids);
			};

			const newRowAt = (parentPath) => React.createElement("div", {
				key: "new:" + parentPath,
				className: "dsh-sf-newRow",
			},
				React.createElement("div", {
					className: "dsh-sf-kind",
					role: "group",
					"aria-label": "Create type",
				},
					React.createElement("button", {
						type: "button",
						className: "dsh-sf-kindBtn" + (newKind === "folder" ? " on" : ""),
						title: "Folder",
						"aria-label": "Folder",
						"aria-pressed": newKind === "folder",
						disabled: creating,
						onPointerDown: (e) => e.stopPropagation(),
						onClick: (e) => { e.stopPropagation(); setNewKind("folder"); },
					}, iconSvg("folder")),
					React.createElement("button", {
						type: "button",
						className: "dsh-sf-kindBtn" + (newKind === "file" ? " on" : ""),
						title: "File",
						"aria-label": "File",
						"aria-pressed": newKind === "file",
						disabled: creating,
						onPointerDown: (e) => e.stopPropagation(),
						onClick: (e) => { e.stopPropagation(); setNewKind("file"); },
					}, iconSvg("file")),
				),
				React.createElement("input", {
					className: "dsh-sf-newInput",
					value: newName,
					placeholder: newKind === "file" ? "name.html" : "Folder name",
					autoFocus: true,
					disabled: creating,
					onClick: (e) => e.stopPropagation(),
					onPointerDown: (e) => e.stopPropagation(),
					onChange: (e) => setNewName(e.target.value),
					onKeyDown: (e) => {
						e.stopPropagation();
						if (e.key === "Enter") createEntry();
						if (e.key === "Escape") cancelNewEntry();
					},
				}),
				React.createElement("button", {
					type: "button",
					className: "dsh-sf-tool",
					disabled: creating || !newName.trim(),
					onPointerDown: (e) => e.stopPropagation(),
					onClick: (e) => { e.stopPropagation(); createEntry(); },
				}, creating ? "…" : "Create"),
			);

			const renderRows = (path, depth) => {
				const dir = dirs[path];
				if (!dir) return null;
				if (dir.state === "loading") {
					return React.createElement("div", {
						key: path + ":loading",
						className: "dsh-sf-status",
						style: { paddingLeft: 8 + depth * 12 },
					}, "Loading…");
				}
				if (dir.state === "error") {
					return React.createElement("div", {
						key: path + ":err",
						className: "dsh-sf-status err",
						style: { paddingLeft: 8 + depth * 12 },
					}, dir.error || "Failed");
				}
				const entries = filterEntries(dir.entries);
				if (!entries.length && depth === 0 && newAt !== path) {
					return React.createElement("div", { className: "dsh-sf-status" }, "Empty folder");
				}
				const out = [];
				if (newAt === path) out.push(newRowAt(path));
				for (const e of entries) {
					const isDir = e.type === "directory";
					const open = isDir && !!expanded[e.path];
					const color = isDir ? null : extColor(e.name);
					if (renameAt === e.path) {
						out.push(React.createElement("div", {
							key: e.path + ":rename",
							className: "dsh-sf-renameRow",
							style: { paddingLeft: 4 + depth * 12 },
						},
							React.createElement("span", { className: "dsh-sf-caret" }),
							React.createElement("span", {
								className: "dsh-sf-ico" + (isDir ? " dir" : ""),
								style: color ? { color } : undefined,
							}, iconSvg(isDir ? "folder" : "file", color)),
							React.createElement("input", {
								className: "dsh-sf-renameInput",
								value: renameName,
								autoFocus: true,
								disabled: renaming,
								onClick: (ev) => ev.stopPropagation(),
								onPointerDown: (ev) => ev.stopPropagation(),
								onChange: (ev) => setRenameName(ev.target.value),
								onKeyDown: (ev) => {
									ev.stopPropagation();
									if (ev.key === "Enter") renameEntry();
									if (ev.key === "Escape") cancelRename();
								},
							}),
							React.createElement("button", {
								type: "button",
								className: "dsh-sf-tool",
								disabled: renaming || !renameName.trim(),
								onPointerDown: (ev) => ev.stopPropagation(),
								onClick: (ev) => { ev.stopPropagation(); renameEntry(); },
							}, renaming ? "…" : "Save"),
						));
						continue;
					}
					out.push(React.createElement("button", {
						type: "button",
						key: e.path,
						className: "dsh-sf-row"
							+ (dragOverPath === e.path ? " dsh-sf-dropHover" : "")
							+ (draggingPath === e.path ? " dsh-sf-dragging" : ""),
						style: { paddingLeft: 4 + depth * 12 },
						title: e.path,
						draggable: true,
						onClick: (ev) => {
							ev.stopPropagation();
							if (isDir) toggleDir(e.path);
							else openInCodeTab(e.path);
						},
						onDragStart: (ev) => {
							ev.stopPropagation();
							setDraggingPath(e.path);
							ev.dataTransfer.effectAllowed = "copyMove";
							try {
								const payload = JSON.stringify({
									__dshFile: true, path: e.path, root, name: e.name, isDir,
								});
								ev.dataTransfer.setData(DRAG_MIME, payload);
								// Plain path so chat / other text drops get a usable reference
								ev.dataTransfer.setData("text/plain", e.path);
							} catch { /* ignore */ }
						},
						onDragEnd: (ev) => {
							ev.stopPropagation();
							setDraggingPath(null);
						},
						onDragOver: !isDir ? undefined : (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							ev.dataTransfer.dropEffect = "move";
							if (dragOverPath !== e.path) setDragOverPath(e.path);
						},
						onDragLeave: !isDir ? undefined : (ev) => {
							ev.stopPropagation();
							setDragOverPath((p) => (p === e.path ? null : p));
						},
						onDrop: !isDir ? undefined : (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							setDragOverPath(null);
							handleDrop(ev, e.path, root);
						},
					},
						React.createElement("span", {
							className: "dsh-sf-caret" + (open ? " open" : ""),
						}, isDir ? iconSvg("caret") : null),
						React.createElement("span", {
							className: "dsh-sf-ico" + (isDir ? " dir" : ""),
							style: color ? { color } : undefined,
						}, iconSvg(isDir ? "folder" : "file", color)),
						React.createElement("span", { className: "dsh-sf-name" }, e.name),
						rowActions(e, { showAdd: true }),
					));
					if (isDir && open) {
						const nested = renderRows(e.path, depth + 1);
						if (nested) {
							if (Array.isArray(nested)) out.push(...nested);
							else out.push(nested);
						}
					}
				}
				return out;
			};

			const q = String(query || "").trim();
			let body;
			if (q) {
				if (searching && !searchHits) {
					body = React.createElement("div", { className: "dsh-sf-status" }, "Searching…");
				} else {
					const hits = (searchHits || []).filter((r) => {
						if (!r || !r.name) return false;
						if (!showDot && String(r.name).startsWith(".")) return false;
						return true;
					});
					if (!hits.length) {
						body = React.createElement("div", { className: "dsh-sf-status" }, "No matches");
					} else {
						body = hits.slice(0, 80).map((r) => {
							const color = extColor(r.name);
							const entry = { name: r.name, path: r.path, type: r.type || "file" };
							return React.createElement("button", {
								type: "button",
								key: r.path,
								className: "dsh-sf-row",
								title: r.path,
								onClick: (ev) => {
									ev.stopPropagation();
									openInCodeTab(r.path);
								},
							},
								React.createElement("span", { className: "dsh-sf-caret" }),
								React.createElement("span", {
									className: "dsh-sf-ico",
									style: color ? { color } : undefined,
								}, iconSvg("file", color)),
								React.createElement("span", { className: "dsh-sf-name" }, r.name),
								rowActions(entry, { showAdd: false }),
							);
						});
					}
				}
			} else if (status.state === "error") {
				body = React.createElement("div", { className: "dsh-sf-status err" }, status.error || "Failed to list");
			} else if (status.state === "loading" && !dirs[root]) {
				body = React.createElement("div", { className: "dsh-sf-status" }, "Loading…");
			} else {
				body = renderRows(root, 0);
			}

			return React.createElement(React.Fragment, null,
				createErr && React.createElement("div", { className: "dsh-sf-status err" }, createErr),
				body,
			);
		}

		/** @type {Map<string, { host: HTMLElement, root: any, cwd: string, workspaces: any }>} */
		const mounts = new Map();

		function unmountTree(key) {
			const m = mounts.get(key);
			if (!m) return;
			try {
				if (m.root && typeof m.root.unmount === "function") m.root.unmount();
				else if (ReactDOM.unmountComponentAtNode) ReactDOM.unmountComponentAtNode(m.host);
			} catch { /* ignore */ }
			m.host.remove();
			mounts.delete(key);
		}

		/** Fallback drop target: dropping on the tree's own background (not on a
		 * specific folder row) moves the item into the root of this workspace's tree. */
		function wireTreeRootDrop(host) {
			host.addEventListener("dragover", (ev) => {
				if (!ev.dataTransfer || !dragHasSidebarFile(ev.dataTransfer)) return;
				ev.preventDefault();
				ev.dataTransfer.dropEffect = "move";
				host.classList.add("dsh-sf-dropHoverRoot");
			});
			host.addEventListener("dragleave", (ev) => {
				if (ev.target === host || !host.contains(ev.relatedTarget)) {
					host.classList.remove("dsh-sf-dropHoverRoot");
				}
			});
			host.addEventListener("drop", async (ev) => {
				host.classList.remove("dsh-sf-dropHoverRoot");
				const destDir = host.dataset.dshSfRoot;
				if (!destDir) return;
				ev.preventDefault();
				const payload = readDragPayload(ev);
				if (!payload || payload.path === destDir) return;
				try {
					const res = await performMove({
						path: payload.path,
						root: payload.root,
						destDir,
						destRoot: destDir,
					});
					if (res && res.ok) {
						window.dispatchEvent(new CustomEvent(MOVE_EVENT, {
							detail: { srcPath: payload.path, srcRoot: payload.root, destDir, destRoot: destDir },
						}));
					} else {
						console.warn("[dsh-sidebar-files] move failed", res);
					}
				} catch (err) {
					console.warn("[dsh-sidebar-files] move failed", err);
				}
			});
		}

		function mountTree(key, group, cwd, workspaces) {
			let m = mounts.get(key);
			let host = group.querySelector(":scope > .dsh-sf-tree");
			const hostLive = !!(host && host.isConnected && group.contains(host));
			if (!hostLive) {
				if (host) host.remove();
				host = document.createElement("div");
				host.className = "dsh-sf-tree";
				host.setAttribute("data-dsh-sf-key", key);
				wireTreeRootDrop(host);
				const row = group.querySelector(".YDXeBa_projectRow");
				let anchor = row;
				while (anchor && anchor.parentElement && anchor.parentElement !== group) {
					anchor = anchor.parentElement;
				}
				if (anchor && anchor.parentElement === group) {
					group.insertBefore(host, anchor.nextSibling);
				} else {
					group.appendChild(host);
				}
			}
			if (!m || m.host !== host || !m.host.isConnected) {
				if (m) {
					try {
						if (m.root && typeof m.root.unmount === "function") m.root.unmount();
						else if (ReactDOM.unmountComponentAtNode) ReactDOM.unmountComponentAtNode(m.host);
					} catch { /* ignore */ }
					if (m.host && m.host !== host) m.host.remove();
					mounts.delete(key);
				}
				const createRoot = ReactDOMClient?.createRoot || ReactDOM.createRoot;
				let root;
				if (typeof createRoot === "function") {
					root = createRoot(host);
				} else {
					root = {
						render: (el) => ReactDOM.render(el, host),
						unmount: () => ReactDOM.unmountComponentAtNode(host),
					};
				}
				m = { host, root, cwd: null, workspaces: null };
				mounts.set(key, m);
			}
			host.dataset.dshSfRoot = cwd;
			if (m.cwd === cwd && m.workspaces === workspaces && hostLive) return;
			m.cwd = cwd;
			m.workspaces = workspaces;
			m.root.render(React.createElement(SideTree, { root: cwd, workspaces }));
		}

		/** Dropping directly on a workspace row moves the item into that workspace's root
		 * (handy for collapsed workspaces, or dropping without expanding/scrolling to a subfolder). */
		function wireWorkspaceRowDrop(row) {
			if (row.dataset.dshSfDropWired) return;
			row.dataset.dshSfDropWired = "1";
			row.addEventListener("dragover", (ev) => {
				if (getView() !== "files") return;
				if (!ev.dataTransfer || !dragHasSidebarFile(ev.dataTransfer)) return;
				ev.preventDefault();
				ev.dataTransfer.dropEffect = "move";
				row.classList.add("dsh-sf-dropHoverWs");
			});
			row.addEventListener("dragleave", (ev) => {
				if (ev.target === row || !row.contains(ev.relatedTarget)) {
					row.classList.remove("dsh-sf-dropHoverWs");
				}
			});
			row.addEventListener("drop", async (ev) => {
				row.classList.remove("dsh-sf-dropHoverWs");
				if (getView() !== "files") return;
				const destDir = row.dataset.dshSfCwd;
				if (!destDir) return;
				ev.preventDefault();
				const payload = readDragPayload(ev);
				if (!payload || payload.path === destDir) return;
				try {
					const res = await performMove({
						path: payload.path,
						root: payload.root,
						destDir,
						destRoot: destDir,
					});
					if (res && res.ok) {
						window.dispatchEvent(new CustomEvent(MOVE_EVENT, {
							detail: { srcPath: payload.path, srcRoot: payload.root, destDir, destRoot: destDir },
						}));
					} else {
						console.warn("[dsh-sidebar-files] move failed", res);
					}
				} catch (err) {
					console.warn("[dsh-sidebar-files] move failed", err);
				}
			});
		}

		function findGroup(row) {
			return row.closest(".qDHVXG_groupSection") || row.parentElement;
		}

		function normalizePath(p) {
			const s = String(p || "").trim();
			if (!s || s === "/") return "/";
			return s.replace(/\/+$/, "");
		}

		function isAncestorPath(parent, child) {
			const a = normalizePath(parent);
			const b = normalizePath(child);
			if (!a || !b || a === b) return false;
			if (a === "/") return b.startsWith("/");
			return b.startsWith(a + "/");
		}

		function isRedundantParent(ws, all) {
			return all.some((other) => other.key !== ws.key && isAncestorPath(ws.cwd, other.cwd));
		}

		function setHeaderBtnIcon(btn, kind) {
			btn.replaceChildren();
			const svgNs = "http://www.w3.org/2000/svg";
			const svg = document.createElementNS(svgNs, "svg");
			svg.setAttribute("viewBox", "0 0 16 16");
			svg.setAttribute("width", "18");
			svg.setAttribute("height", "18");
			svg.setAttribute("fill", "currentColor");
			svg.setAttribute("aria-hidden", "true");
			if (kind === "sessions") {
				// Three list rows — filled bars, same weight as stock icons
				const mk = (y, w) => {
					const r = document.createElementNS(svgNs, "rect");
					r.setAttribute("x", "1.5");
					r.setAttribute("y", String(y));
					r.setAttribute("width", String(w));
					r.setAttribute("height", "2");
					r.setAttribute("rx", "0.75");
					svg.appendChild(r);
				};
				mk(3.25, 13);
				mk(7, 13);
				mk(10.75, 9.5);
			} else if (kind === "eye") {
				const path = document.createElementNS(svgNs, "path");
				path.setAttribute("d", "M8 3.25C3.9 3.25 1.2 7.1 1.05 7.35a.75.75 0 0 0 0 .8C1.2 8.4 3.9 12.25 8 12.25s6.8-3.85 6.95-4.1a.75.75 0 0 0 0-.8C14.8 7.1 12.1 3.25 8 3.25zm0 7a2.75 2.75 0 1 1 0-5.5 2.75 2.75 0 0 1 0 5.5z");
				svg.appendChild(path);
				const hole = document.createElementNS(svgNs, "circle");
				hole.setAttribute("cx", "8");
				hole.setAttribute("cy", "8");
				hole.setAttribute("r", "1.35");
				hole.setAttribute("fill", "var(--dsw-alias-bg-base,#111)");
				svg.appendChild(hole);
			} else if (kind === "eyeOff") {
				const path = document.createElementNS(svgNs, "path");
				path.setAttribute("d", "M2.22 2.22a.75.75 0 0 0-1.06 1.06l1.2 1.2C1.4 5.3.7 6.55.55 6.8a.75.75 0 0 0 0 .9C.85 8.2 3.7 12.75 8 12.75c1.35 0 2.5-.35 3.45-.85l2.33 2.33a.75.75 0 1 0 1.06-1.06L2.22 2.22zM8 4.75c.4 0 .78.07 1.13.2l-1.1 1.1A2.25 2.25 0 0 0 6.05 8.3L4.9 9.45A3.75 3.75 0 0 1 8 4.75zm6.8 2.05c.12.18.2.35.2.45a.75.75 0 0 1-.1.35c-.25.4-1.05 1.45-2.2 2.3l-1.15-1.15A3.74 3.74 0 0 0 11.95 5.7c.9.5 1.55 1.1 1.95 1.5.35.35.55.6.65.7z");
				svg.appendChild(path);
			} else {
				// Folder — filled, fills most of the 16×16 canvas
				const path = document.createElementNS(svgNs, "path");
				path.setAttribute("d", "M1.25 3.5A1.25 1.25 0 0 1 2.5 2.25h3.2l1.35 1.5H13.5A1.25 1.25 0 0 1 14.75 5v7.25A1.25 1.25 0 0 1 13.5 13.5H2.5A1.25 1.25 0 0 1 1.25 12.25V3.5z");
				svg.appendChild(path);
			}
			btn.appendChild(svg);
		}

		function paintHeaderControls() {
			const headers = document.querySelectorAll(".qDHVXG_sectionHeader");
			const files = getView() === "files";
			const showDot = getShowDot();
			for (const header of headers) {
				const label = header.querySelector(".qDHVXG_sectionLabel");
				if (!label || !/workspaces/i.test(label.textContent || "")) continue;

				header.dataset.dshSfFiles = files ? "1" : "0";

				const stockAdd = header.querySelector('button[aria-label="Add workspace"]');
				const actions = stockAdd?.parentElement || header.querySelector(".qDHVXG_headerActions");

				let btn = header.querySelector(".dsh-sf-headerToggle");
				if (!btn) {
					btn = document.createElement("button");
					btn.type = "button";
					btn.className = "dsh-sf-headerToggle";
				}

				let dot = header.querySelector(".dsh-sf-headerDot");
				if (!dot) {
					dot = document.createElement("button");
					dot.type = "button";
					dot.className = "dsh-sf-headerDot";
				}

				// Order: … | [eye] Sessions↔Files | Add   (Files mode: eye comes first)
				//        … | Sessions↔Files [eye hidden] | Add  (Sessions mode)
				if (actions && stockAdd) {
					if (files) {
						actions.insertBefore(dot, stockAdd);
						actions.insertBefore(btn, stockAdd);
					} else {
						actions.insertBefore(btn, stockAdd);
						actions.insertBefore(dot, stockAdd.nextSibling);
					}
				} else if (actions) {
					if (files) {
						if (dot.parentElement !== actions) actions.appendChild(dot);
						if (btn.parentElement !== actions || dot.nextSibling !== btn) {
							actions.insertBefore(btn, dot.nextSibling);
						}
					} else {
						if (btn.parentElement !== actions) actions.appendChild(btn);
						if (dot.parentElement !== actions) actions.appendChild(dot);
					}
				} else {
					if (files) {
						if (!header.contains(dot)) header.appendChild(dot);
						header.insertBefore(btn, dot.nextSibling);
					} else {
						if (!header.contains(btn)) header.appendChild(btn);
						if (!header.contains(dot)) header.appendChild(dot);
					}
				}

				const wantPressed = files ? "true" : "false";
				const wantLabel = files ? "Show chat sessions" : "Show file trees";
				if (btn.getAttribute("aria-pressed") !== wantPressed || btn.getAttribute("aria-label") !== wantLabel || !btn.querySelector("svg")) {
					btn.setAttribute("aria-pressed", wantPressed);
					btn.setAttribute("aria-label", wantLabel);
					btn.title = files ? "Switch to chat sessions" : "Switch to file trees";
					setHeaderBtnIcon(btn, files ? "sessions" : "files");
				}

				const dotPressed = showDot ? "true" : "false";
				const dotLabel = showDot ? "Hide dotfiles" : "Show dotfiles";
				if (dot.getAttribute("aria-pressed") !== dotPressed || dot.getAttribute("aria-label") !== dotLabel || !dot.querySelector("svg")) {
					dot.setAttribute("aria-pressed", dotPressed);
					dot.setAttribute("aria-label", dotLabel);
					dot.title = dotLabel;
					setHeaderBtnIcon(dot, showDot ? "eyeOff" : "eye");
				}
				dot.tabIndex = files ? 0 : -1;
				dot.setAttribute("aria-hidden", files ? "false" : "true");

				// Search field: sessions vs files
				const searchBtn = header.querySelector(".qDHVXG_searchButton");
				const searchInput = header.querySelector(".qDHVXG_searchInput");
				if (searchBtn) {
					searchBtn.setAttribute("aria-label", files ? "Search files" : "Search sessions");
					searchBtn.title = files ? "Search files" : "Search sessions";
				}
				if (searchInput) {
					const wantPh = files ? "Search files..." : "Search sessions...";
					if (searchInput.placeholder !== wantPh) searchInput.placeholder = wantPh;
					searchInput.dataset.dshSfSearch = files ? "files" : "sessions";
				}
			}
		}

		function paint(workspaces, sessions) {
			ensureStyles();
			document.querySelectorAll(".dsh-sf-toggle").forEach((n) => n.remove());
			document.querySelectorAll(".YDXeBa_projectRow[data-dsh-sf-mode]").forEach((row) => {
				row.removeAttribute("data-dsh-sf-mode");
				row.removeAttribute("data-dsh-sf-key");
			});

			paintHeaderControls();

			const view = getView();
			try {
				document.documentElement.dataset.dshSfView = view;
			} catch { /* ignore */ }

			const fileQueryActive = view === "files" && !!String(getFileQuery() || "").trim();
			syncFileSearchInput();
			const resolved = [];
			for (const row of document.querySelectorAll(".YDXeBa_projectRow")) {
				const ws = resolveWorkspace(workspaces, row);
				if (!ws) continue;
				const group = findGroup(row);
				if (!group) continue;
				resolved.push({ ws, row, group });
			}
			const allWs = resolved.map((r) => r.ws);

			const currentWs = getActiveWorkspace(workspaces, sessions);
			const seen = new Set();
			for (const { ws, row, group } of resolved) {
				seen.add(ws.key);
				const isCurrent = !!currentWs && currentWs.key === ws.key;
				row.dataset.dshSfCurrent = isCurrent ? "1" : "0";
				row.dataset.dshSfCwd = ws.cwd;
				if (view === "files") wireWorkspaceRowDrop(row);
				let zone = row.querySelector(":scope > .dsh-sf-wsZone");
				if (!zone || !zone.isConnected) {
					if (zone) zone.remove();
					zone = document.createElement("span");
					zone.className = "dsh-sf-wsZone";
					zone.setAttribute("role", "button");
					zone.tabIndex = 0;
					zone.innerHTML = WS_SWITCH_ICON;
					row.insertBefore(zone, row.firstChild);
				} else if (!zone.firstElementChild) {
					zone.innerHTML = WS_SWITCH_ICON;
				}
				// NEVER mutate .YDXeBa_folder.innerHTML — React owns that node. Old bubble
				// hack corrupted expand/collapse and wiped the whole sidebar. Undo once,
				// then use a sibling .dsh-sf-chatIcon + CSS hide for Sessions mode.
				try {
					const folderEl = row.querySelector(":scope > .YDXeBa_folder");
					if (folderEl && folderEl.dataset.dshSfBubble === "1") {
						folderEl.innerHTML = folderEl.dataset.dshSfOriginalHtml || "";
						delete folderEl.dataset.dshSfBubble;
						delete folderEl.dataset.dshSfOriginalHtml;
					}
				} catch (err) {
					console.warn("[dsh-sidebar-files] folder restore failed", err);
				}
				let chatIcon = row.querySelector(":scope > .dsh-sf-chatIcon");
				if (!chatIcon || !chatIcon.isConnected) {
					if (chatIcon) chatIcon.remove();
					chatIcon = document.createElement("span");
					chatIcon.className = "dsh-sf-chatIcon";
					chatIcon.setAttribute("aria-hidden", "true");
					chatIcon.innerHTML = CHAT_BUBBLE_ICON;
					const folderEl = row.querySelector(":scope > .YDXeBa_folder");
					if (folderEl) row.insertBefore(chatIcon, folderEl);
					else if (zone.nextSibling) row.insertBefore(chatIcon, zone.nextSibling);
					else row.appendChild(chatIcon);
				}
				zone.dataset.wsKey = ws.key;
				const zoneLabel = isCurrent
					? `Current workspace ("${ws.label}")`
					: `Switch to "${ws.label}" workspace`;
				zone.title = zoneLabel;
				zone.setAttribute("aria-label", zoneLabel);
				zone.setAttribute("aria-pressed", isCurrent ? "true" : "false");
				// Hide parent workspaces whose children are also registered (e.g. /workspace).
				if (isRedundantParent(ws, allWs)) {
					group.removeAttribute("data-dsh-sf-mode");
					group.removeAttribute("data-dsh-sf-key");
					group.removeAttribute("data-dsh-sf-collapsed");
					group.dataset.dshSfRedundant = "1";
					unmountTree(ws.key);
					continue;
				}
				if (view === "files") {
					const expanded = fileQueryActive || isWsExpanded(ws.key);
					group.removeAttribute("data-dsh-sf-redundant");
					group.dataset.dshSfMode = "files";
					group.dataset.dshSfKey = ws.key;
					group.dataset.dshSfCollapsed = expanded ? "0" : "1";
					row.setAttribute("aria-expanded", expanded ? "true" : "false");
					row.title = expanded ? "Collapse files" : "Expand files";
					if (expanded) {
						mountTree(ws.key, group, ws.cwd, workspaces);
					} else {
						// Keep a mounted tree if it already exists (preserves nested open state);
						// otherwise stay unloaded until first expand.
						const existing = group.querySelector(":scope > .dsh-sf-tree");
						if (existing && mounts.has(ws.key)) {
							/* leave mounted; CSS hides */
						} else {
							unmountTree(ws.key);
						}
					}
					// Relabel stock hover + as New folder
					const plus = group.querySelector('button[aria-label^="New session in "], button[data-dsh-sf-newfolder="1"]');
					if (plus) {
						plus.setAttribute("data-dsh-sf-newfolder", "1");
						plus.title = `New folder in ${ws.label}`;
						plus.setAttribute("aria-label", `New folder in ${ws.label}`);
					}
				} else {
					group.removeAttribute("data-dsh-sf-redundant");
					group.dataset.dshSfMode = "sessions";
					group.removeAttribute("data-dsh-sf-key");
					group.removeAttribute("data-dsh-sf-collapsed");
					row.removeAttribute("title");
					// Leave aria-expanded to stock Harness in Sessions mode so it can
					// expand/collapse chat lists. Stale files-mode values confuse it.
					row.removeAttribute("aria-expanded");
					unmountTree(ws.key);
					const plus = group.querySelector('button[data-dsh-sf-newfolder="1"]');
					if (plus) {
						plus.removeAttribute("data-dsh-sf-newfolder");
						plus.title = "";
						plus.setAttribute("aria-label", `New session in ${ws.label}`);
					}
				}
			}
			for (const key of [...mounts.keys()]) {
				if (!seen.has(key) || view !== "files") unmountTree(key);
			}
		}

		const inject = ["workspaces", "sessions", "conversation", "inputTriggers"];
		const REF_SOURCE = "sidebar-file";

		function getActiveSessionId(sessions) {
			try {
				const snap = sessions?.list?.getSnapshot?.();
				if (snap && typeof snap.current === "string" && snap.current) return snap.current;
			} catch { /* ignore */ }
			return null;
		}

		function basenameOf(filePath) {
			const parts = String(filePath || "").split("/").filter(Boolean);
			return parts[parts.length - 1] || filePath;
		}

		function insertPathIntoComposer(conversation, sessions, filePath) {
			const sessionId = getActiveSessionId(sessions);
			if (!sessionId || !conversation?.input) return false;
			const pathText = String(filePath || "").trim();
			if (!pathText) return false;
			try {
				const shell = conversation.input.shell(sessionId);
				let snap = shell.snapshot;
				let draft = String(snap?.draft || "");
				if (draft.length > 0 && !/\s$/.test(draft)) {
					shell.setDraft(`${draft} `);
					snap = shell.snapshot;
					draft = String(snap?.draft || "");
				}
				const start = draft.length;
				const ok = shell.insertReference({
					source: REF_SOURCE,
					ref: pathText,
					label: basenameOf(pathText),
					appearance: "file",
					clipboardText: pathText,
				}, {
					start,
					end: start,
					draftRev: snap.draftRev,
				});
				if (ok) return true;
				const token = `\`${pathText}\``;
				const cur = String(shell.snapshot?.draft || "");
				const next = !cur.trim() ? token : (/\s$/.test(cur) ? cur + token : `${cur} ${token}`);
				shell.setDraft(next);
				return true;
			} catch (err) {
				console.warn("[dsh-sidebar-files] composer insert failed", err);
				return false;
			}
		}

		function isComposerDropTarget(el) {
			if (!(el instanceof Element)) return false;
			return Boolean(
				el.closest?.(".uV2eYG_card")
				|| el.closest?.(".uV2eYG_root")
				|| el.closest?.(".wSkVaW_composerSeat")
				|| el.closest?.("[data-composer-seat]")
				|| el.closest?.("[data-composer-card]")
				|| el.closest?.("textarea.uV2eYG_input"),
			);
		}

		function composerHighlightEl(el) {
			if (!(el instanceof Element)) return null;
			return el.closest(".uV2eYG_card")
				|| el.closest(".wSkVaW_composerSeat")
				|| el.closest("[data-composer-seat]");
		}

		function apply(ctx) {
			ensureStyles();
			try {
				document.documentElement.setAttribute("data-dsh-sidebar-files", "0.3.21");
			} catch { /* ignore */ }

			ctx.inject(["workspaces", "sessions", "conversation", "inputTriggers"], (scope) => {
				const workspaces = scope.workspaces || scope.get("workspaces") || ctx.workspaces || ctx.get?.("workspaces");
				const sessions = scope.sessions || scope.get("sessions") || ctx.sessions || ctx.get?.("sessions");
				const conversation = scope.get("conversation") || ctx.get?.("conversation");
				const inputTriggers = scope.get("inputTriggers") || ctx.get?.("inputTriggers");
				if (!workspaces?.list) {
					console.warn(`[${PLUGIN}] missing workspaces`);
					return;
				}

				if (inputTriggers?.registerSource) {
					scope.effect(() => inputTriggers.registerSource({
						trigger: "@",
						name: REF_SOURCE,
						showGroupTitle: false,
						async candidates() {
							return [];
						},
						codec: {
							clipboardText: (ref) => ref,
							serialize: (ref) => Promise.resolve(ref),
						},
					}), `${PLUGIN}: @sidebar-file chips`);
				}

				const onComposerDragOver = (ev) => {
					if (!ev.dataTransfer || !dragHasSidebarFile(ev.dataTransfer)) return;
					if (!isComposerDropTarget(ev.target)) return;
					ev.preventDefault();
					ev.dataTransfer.dropEffect = "copy";
					const card = composerHighlightEl(ev.target);
					if (card) card.classList.add("dsh-sf-composerDrop");
				};
				const onComposerDragLeave = (ev) => {
					const card = composerHighlightEl(ev.target);
					if (!card) return;
					if (ev.relatedTarget instanceof Node && card.contains(ev.relatedTarget)) return;
					card.classList.remove("dsh-sf-composerDrop");
				};
				const onComposerDrop = (ev) => {
					document.querySelectorAll(".dsh-sf-composerDrop").forEach((n) => n.classList.remove("dsh-sf-composerDrop"));
					if (!isComposerDropTarget(ev.target)) return;
					if (!ev.dataTransfer || !dragHasSidebarFile(ev.dataTransfer)) return;
					const droppedPath = readDroppedPath(ev);
					if (!droppedPath) return;
					ev.preventDefault();
					ev.stopPropagation();
					insertPathIntoComposer(conversation, sessions, droppedPath);
					try {
						document.querySelector("textarea.uV2eYG_input")?.focus?.();
					} catch { /* ignore */ }
				};

				scope.effect(() => {
					document.addEventListener("dragover", onComposerDragOver, true);
					document.addEventListener("dragleave", onComposerDragLeave, true);
					document.addEventListener("drop", onComposerDrop, true);
					return () => {
						document.removeEventListener("dragover", onComposerDragOver, true);
						document.removeEventListener("dragleave", onComposerDragLeave, true);
						document.removeEventListener("drop", onComposerDrop, true);
						document.querySelectorAll(".dsh-sf-composerDrop").forEach((n) => n.classList.remove("dsh-sf-composerDrop"));
					};
				}, `${PLUGIN}: composer-drop`);

				let paintRaf = 0;
				let paintTimer = 0;
				let painting = false;
				const schedulePaint = () => {
					if (painting) return;
					cancelAnimationFrame(paintRaf);
					window.clearTimeout(paintTimer);
					paintTimer = window.setTimeout(() => {
						paintRaf = requestAnimationFrame(() => {
							painting = true;
							try {
								paint(workspaces, sessions);
							} finally {
								window.setTimeout(() => { painting = false; }, 50);
							}
						});
					}, 32);
				};

				const runPaintNow = () => {
					painting = false;
					cancelAnimationFrame(paintRaf);
					window.clearTimeout(paintTimer);
					painting = true;
					try {
						paint(workspaces, sessions);
					} finally {
						window.setTimeout(() => { painting = false; }, 50);
					}
				};

				const toggleView = () => {
					setView(getView() === "files" ? "sessions" : "files");
					if (getView() === "sessions") setFileQuery("");
					runPaintNow();
				};

				window.__dshSidebarFilesToggle = toggleView;
				window.__dshSidebarFilesGetView = getView;
				window.__dshCurrentWorkspace = {
					get: () => getActiveWorkspace(workspaces, sessions),
					set: setCurrentWorkspace,
					EVENT: CURRENT_WS_EVENT,
				};

				scope.effect(() => {
					const u = workspaces.list.subscribe(() => schedulePaint());
					const uSessions = sessions?.list?.subscribe?.(() => schedulePaint());
					const onMode = () => schedulePaint();
					const onPrefs = () => {
						// SideTree listens too; refresh header eye/search chrome
						paintHeaderControls();
					};
					window.addEventListener(MODE_EVENT, onMode);
					window.addEventListener(PREFS_EVENT, onPrefs);
					window.addEventListener(CURRENT_WS_EVENT, onMode);

					const onDocClick = (e) => {
						const t = e.target instanceof Element ? e.target : null;
						if (!t) return;
						const toggle = t.closest(".dsh-sf-headerToggle");
						if (toggle) {
							e.preventDefault();
							e.stopPropagation();
							if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
							toggleView();
							return;
						}
						const dot = t.closest(".dsh-sf-headerDot");
						if (dot) {
							e.preventDefault();
							e.stopPropagation();
							if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
							setShowDot(!getShowDot());
							paintHeaderControls();
							return;
						}
						// Only our explicit switch-zone switches workspace. Do NOT steal
						// .YDXeBa_chevron / .YDXeBa_arrow — those are stock expand/collapse
						// for the chat list under the row (and may overlay most of the row).
						const wsZone = t.closest(".dsh-sf-wsZone");
						if (wsZone) {
							const row = wsZone.closest(".YDXeBa_projectRow");
							const ws = row && resolveWorkspace(workspaces, row);
							if (ws) {
								e.preventDefault();
								e.stopPropagation();
								if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
								switchWorkspace(workspaces, sessions, ws);
								runPaintNow();
							}
							return;
						}
						// Files mode: stock workspace row "+" creates a folder
						if (getView() === "files") {
							const plus = t.closest('button[data-dsh-sf-newfolder="1"], button[aria-label^="New folder in "], button[aria-label^="New session in "]');
							if (plus && plus.closest(".YDXeBa_projectRow")) {
								const row = plus.closest(".YDXeBa_projectRow");
								const ws = resolveWorkspace(workspaces, row);
								if (ws) {
									e.preventDefault();
									e.stopPropagation();
									if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
									if (!isWsExpanded(ws.key)) setWsExpanded(ws.key, true);
									window.dispatchEvent(new CustomEvent(NEW_ENTRY_EVENT, {
										detail: { root: ws.cwd, cwd: ws.cwd, parentPath: ws.cwd },
									}));
									runPaintNow();
								}
								return;
							}
							// Click workspace row → expand/collapse file tree
							const row = t.closest(".YDXeBa_projectRow");
							if (row && !t.closest("button, a, input, .dsh-sf-tree")) {
								const ws = resolveWorkspace(workspaces, row);
								if (ws) {
									e.preventDefault();
									e.stopPropagation();
									if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
									toggleWsExpanded(ws.key);
									runPaintNow();
								}
							}
						}
						// Sessions (chat) mode: leave row / chevron clicks to stock Harness
						// so workspaces expand/collapse their chat lists normally.
					};
					document.addEventListener("click", onDocClick, true);

					const onWsZoneKeydown = (e) => {
						if (e.key !== "Enter" && e.key !== " ") return;
						const t = e.target instanceof Element ? e.target : null;
						// Match click handler: only our switch-zone, never stock chevron/arrow.
						const wsZone = t && t.closest(".dsh-sf-wsZone");
						if (!wsZone) return;
						const row = wsZone.closest(".YDXeBa_projectRow");
						const ws = row && resolveWorkspace(workspaces, row);
						if (!ws) return;
						e.preventDefault();
						e.stopPropagation();
						switchWorkspace(workspaces, sessions, ws);
						runPaintNow();
					};
					document.addEventListener("keydown", onWsZoneKeydown, true);

					const onSearchInput = (e) => {
						const input = e.target;
						if (!(input instanceof HTMLInputElement)) return;
						if (!input.classList.contains("qDHVXG_searchInput")) return;
						if (getView() !== "files") return;
						// Block stock WorkspaceBrowser setQuery → SearchResults (which unmounts our trees).
						e.stopImmediatePropagation();
						setFileQuery(input.value);
					};
					const onSearchKeyDown = (e) => {
						const input = e.target;
						if (!(input instanceof HTMLInputElement)) return;
						if (!input.classList.contains("qDHVXG_searchInput")) return;
						if (getView() !== "files") return;
						if (e.key === "Escape") {
							setFileQuery("");
							// Let stock also collapse the search slot
							return;
						}
					};
					const onSearchClearClick = (e) => {
						if (getView() !== "files") return;
						const t = e.target instanceof Element ? e.target : null;
						if (!t?.closest?.(".qDHVXG_clearButton")) return;
						setFileQuery("");
					};
					document.addEventListener("input", onSearchInput, true);
					document.addEventListener("keydown", onSearchKeyDown, true);
					document.addEventListener("click", onSearchClearClick, true);

					schedulePaint();
					const listRoot = document.querySelector(".qDHVXG_root") || document.getElementById("root") || document.body;
					const mo = new MutationObserver((records) => {
						if (painting) return;
						const relevant = records.some((r) => {
							const nodes = [...(r.addedNodes || []), ...(r.removedNodes || [])];
							if (nodes.some((n) => n instanceof Element && (
								n.classList?.contains("dsh-sf-tree")
								|| n.classList?.contains("dsh-sf-headerToggle")
								|| n.classList?.contains("dsh-sf-headerDot")
								|| n.classList?.contains("dsh-sf-wsZone")
								|| n.classList?.contains("dsh-sf-chatIcon")
								|| n.closest?.(".dsh-sf-tree")
								|| n.closest?.(".dsh-sf-headerToggle")
								|| n.closest?.(".dsh-sf-headerDot")
								|| n.closest?.(".dsh-sf-wsZone")
								|| n.closest?.(".dsh-sf-chatIcon")
							))) return false;
							const target = r.target;
							if (target instanceof Element && (
								target.classList?.contains("dsh-sf-tree")
								|| target.classList?.contains("dsh-sf-headerToggle")
								|| target.classList?.contains("dsh-sf-headerDot")
								|| target.classList?.contains("dsh-sf-wsZone")
								|| target.classList?.contains("dsh-sf-chatIcon")
								|| target.closest?.(".dsh-sf-tree")
								|| target.closest?.(".dsh-sf-headerToggle")
								|| target.closest?.(".dsh-sf-headerDot")
								|| target.closest?.(".dsh-sf-wsZone")
								|| target.closest?.(".dsh-sf-chatIcon")
							)) return false;
							return true;
						});
						if (relevant) schedulePaint();
					});
					mo.observe(listRoot, { childList: true, subtree: true });
					return () => {
						u();
						if (typeof uSessions === "function") uSessions();
						window.removeEventListener(MODE_EVENT, onMode);
						window.removeEventListener(PREFS_EVENT, onPrefs);
						window.removeEventListener(CURRENT_WS_EVENT, onMode);
						document.removeEventListener("click", onDocClick, true);
						document.removeEventListener("keydown", onWsZoneKeydown, true);
						document.removeEventListener("input", onSearchInput, true);
						document.removeEventListener("keydown", onSearchKeyDown, true);
						document.removeEventListener("click", onSearchClearClick, true);
						mo.disconnect();
						cancelAnimationFrame(paintRaf);
						window.clearTimeout(paintTimer);
						for (const key of [...mounts.keys()]) unmountTree(key);
						document.querySelectorAll(".dsh-sf-headerToggle, .dsh-sf-headerDot, .dsh-sf-toggle, .dsh-sf-wsZone, .dsh-sf-chatIcon").forEach((n) => n.remove());
						try {
							delete window.__dshSidebarFilesToggle;
							delete window.__dshSidebarFilesGetView;
							delete window.__dshSfQuery;
							if (window.__dshCurrentWorkspace) {
								delete window.__dshCurrentWorkspace;
							}
						} catch { /* ignore */ }
					};
				}, `${PLUGIN}: paint`);
			});
		}

		return { apply, inject };
	},
});

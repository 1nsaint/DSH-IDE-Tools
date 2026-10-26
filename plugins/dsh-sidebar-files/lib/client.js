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
		/** Upgrade-safe: match CSS-module locals regardless of hash prefix (see _shared/css-modules.js). */
		function hasLocalCss(el, local) {
			if (!el || !el.classList) return false;
			const name = String(local || "").replace(/^_+/, "");
			for (const c of el.classList) {
				if (c === name || c.endsWith("_" + name)) return true;
			}
			return false;
		}
		function cssLocal(local) {
			return '[class*="_' + String(local).replace(/^_+/, "") + '"]';
		}
		function qsExactLocal(root, local) {
			if (!root || !root.querySelectorAll) return null;
			const name = String(local || "").replace(/^_+/, "");
			for (const el of root.querySelectorAll(cssLocal(name))) {
				if (hasLocalCss(el, name)) return el;
			}
			return null;
		}
		const STORE_KEY = "dsh-sidebar-files.view.v2";
		const DOT_KEY = "dsh-sidebar-files.dot.v1";
		const EXPAND_KEY = "dsh-sidebar-files.expand.v1";
		const MODE_EVENT = "dsh-sidebar-files-mode";
		const PREFS_EVENT = "dsh-sidebar-files-prefs";
		const CURRENT_WS_KEY = "dsh-sidebar-files.currentWorkspace.v1";
		const CURRENT_WS_FORCE_UNTIL_KEY = "dsh-sidebar-files.currentWorkspace.forceUntil.v1";
		const CURRENT_WS_EVENT = "dsh-current-workspace-changed";
		const POINTER_FORCE_MS = 8000;
		const WS_SWITCH_ICON = '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 4 4-4 4"/><path d="M20 7H4"/><path d="m8 21-4-4 4-4"/><path d="M4 17h16"/></svg>';
		// Single outline chat bubble shown in place of the workspace folder icon while in Sessions (chat) mode.
		const CHAT_BUBBLE_ICON = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>';
		// Lucide "terminal" (ISC) — https://lucide.dev/icons/terminal — standard >_ prompt, no window chrome.
		const SSH_REMOTE_ICON =
			'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'
			+ '<path d="M12 19h8"/><path d="m4 17 6-6-6-6"/>'
			+ "</svg>";

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
.dsh-sf-chatIcon.dsh-sf-chatIconHidden{display:none!important}
/* Remote workspaces: hide stock folder entirely; show accent-colored >_ mark. */
[class*="_projectRow"][data-dsh-sf-remote="1"] > [class*="_folder"]{
  display:none !important;
}
.dsh-sf-sshFolderIcon{
  display:none;
  flex:0 0 auto;
  align-items:center;
  justify-content:center;
  width:18px;height:18px;
  color:var(--dsh-ws-folder-color, currentColor);
  opacity:0.92;
  pointer-events:none;
}
.dsh-sf-sshFolderIcon svg{display:block;width:16px;height:16px}
[class*="_projectRow"][data-dsh-sf-remote="1"] > .dsh-sf-sshFolderIcon{
  display:inline-flex;
}
/* Chats mode: local = bubble instead of folder; remote = SSH >_ mark. */
[class*="_groupSection"][data-dsh-sf-mode="sessions"] > [class*="_projectRow"]:not([data-dsh-sf-remote="1"]) > .dsh-sf-chatIcon{
  display:inline-flex;
}
[class*="_groupSection"][data-dsh-sf-mode="sessions"] > [class*="_projectRow"]:not([data-dsh-sf-remote="1"]) > [class*="_folder"]{
  width:0 !important;min-width:0 !important;max-width:0 !important;
  height:0 !important;margin:0 !important;padding:0 !important;
  overflow:hidden !important;opacity:0 !important;
  pointer-events:none !important;border:0 !important;
}
[class*="_groupSection"][data-dsh-sf-mode="sessions"] > [class*="_projectRow"][data-dsh-sf-remote="1"] > .dsh-sf-chatIcon{
  display:none!important;
}
[class*="_groupSection"][data-dsh-sf-mode="files"] [class*="_sessionRow"],
[class*="_groupSection"][data-dsh-sf-mode="files"] [class*="_sessionOverflowButton"]{
  display:none !important;
}
/* If stock session-search ever wins, keep it out of the way in Files mode. */
html[data-dsh-sf-view="files"] [class*="_searchTree"],
html[data-dsh-sf-view="files"] [class*="_list"] [class*="_searchStatus"],
html[data-dsh-sf-view="files"] [class*="_list"] [class*="_searchWarning"]{
  display:none !important;
}
[class*="_groupSection"][data-dsh-sf-mode="files"] > .dsh-sf-tree{
  display:block;
}
[class*="_groupSection"][data-dsh-sf-mode="files"][data-dsh-sf-collapsed="1"] > .dsh-sf-tree{
  display:none !important;
}
[class*="_groupSection"][data-dsh-sf-mode="files"] > [class*="_projectRow"],
[class*="_groupSection"][data-dsh-sf-mode="files"] [class*="_projectRow"]{
  cursor:pointer;
}
[class*="_groupSection"][data-dsh-sf-redundant="1"]{
  display:none !important;
}
/* Stock "Ungrouped" bucket = orphan chats with no workspace. Not a real cwd —
   hide in Files mode; in Sessions keep it but don't dress it as a workspace. */
[class*="_groupSection"][data-dsh-sf-ungrouped="1"] .dsh-sf-wsZone,
[class*="_groupSection"][data-dsh-sf-ungrouped="1"] .dsh-sf-chatIcon{
  display:none !important;
}
html[data-dsh-sf-view="files"] [class*="_groupSection"][data-dsh-sf-ungrouped="1"]{
  display:none !important;
}
/* No position/display override on [class*="_projectRow"] itself — forcing
   position:relative previously broke an existing absolutely-positioned
   native element inside the row (it started filling the whole row and
   swallowed our clicks). The zone below is a plain in-flow element that
   rides along in the row's own (flex) layout, so it never needs the row
   to change position/display, and nothing can silently overlay it. */
.dsh-sf-wsZone{
  display:inline-flex;align-items:center;justify-content:center;
  align-self:stretch;
  flex:0 0 auto;
  /* Rest: invisible, no layout — only appear on row hover (pre-upgrade UX).
     Keep pointer-events:none at rest so the zone never steals row clicks.
     On row:hover we expand + re-enable hits (do NOT leave an always-on 22px chrome). */
  width:0;min-width:0;max-width:0;margin:0;padding:0;
  border-radius:6px;
  cursor:pointer;
  background:transparent;
  color:var(--dsw-alias-state-business-primary,#5b9dff);
  overflow:hidden;
  opacity:0;
  pointer-events:none;
  transition:width .12s ease, margin .12s ease, opacity .12s ease, max-width .12s ease;
}
.dsh-sf-wsZone svg{
  width:13px;height:13px;flex:none;display:block;
  opacity:.85;
  pointer-events:none;
  transition:opacity .12s ease, filter .12s ease, transform .12s ease;
}
/* Reveal switch only while the workspace row is hovered / focused. */
[class*="_projectRow"]:hover .dsh-sf-wsZone,
[class*="_projectRow"]:focus-within .dsh-sf-wsZone{
  width:22px;min-width:22px;max-width:36px;margin-right:6px;
  opacity:1;overflow:visible;pointer-events:auto;
}
[class*="_projectRow"]:hover .dsh-sf-wsZone svg,
[class*="_projectRow"]:focus-within .dsh-sf-wsZone svg{
  opacity:.82;
}
.dsh-sf-wsZone:hover,
.dsh-sf-wsZone:focus-visible{
  background:transparent;
}
.dsh-sf-wsZone:hover svg,
.dsh-sf-wsZone:focus-visible svg{
  opacity:1;
  filter:drop-shadow(0 0 2px currentColor) drop-shadow(0 0 6px color-mix(in srgb,currentColor 72%,transparent));
  transform:scale(1.06);
}
.dsh-sf-wsZone:focus-visible{
  outline:none;
  /* Keyboard: keep visible even if not hovering the row. */
  width:22px;min-width:22px;max-width:36px;margin-right:6px;
  opacity:1;overflow:visible;pointer-events:auto;
}
/* Persistent "current workspace" indicator: a subtle left accent line only —
   no box, no width change, so it never looks like a big highlighted button. */
[class*="_projectRow"][data-dsh-sf-current="1"]{
  box-shadow:inset 3px 0 0 0 var(--dsw-alias-state-business-primary,#5b9dff);
}
[class*="_sectionHeader"] [class*="_headerActions"]{
  /* Stock caps at ~60px (two icons). Our Files toggle lives here too. */
  width:auto !important;
  max-width:none !important;
  flex:0 0 auto !important;
  display:inline-flex !important;
  align-items:center;
  gap:0;
}
[class*="_sectionHeader"] .dsh-sf-headerToggle,
[class*="_sectionHeader"] .dsh-sf-headerDot{
  height:28px;width:28px;padding:0;margin:0;border:none;border-radius:6px;
  background:transparent;color:var(--dsw-alias-label-tertiary,#999);
  display:inline-flex;align-items:center;justify-content:center;flex:none;flex-shrink:0;
  cursor:pointer;position:relative;z-index:2;
}
[class*="_sectionHeader"] .dsh-sf-headerToggle:hover,
[class*="_sectionHeader"] .dsh-sf-headerDot:hover{
  color:var(--dsw-alias-label-primary,#fff);
  background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.06));
}
[class*="_sectionHeader"] .dsh-sf-headerToggle{
  color:var(--dsw-alias-state-business-primary,#3d8bfd);
}
[class*="_sectionHeader"] .dsh-sf-headerDot[aria-pressed="true"]{
  color:var(--dsw-alias-state-business-primary,#3d8bfd);
}
[class*="_sectionHeader"] .dsh-sf-headerToggle svg,
[class*="_sectionHeader"] .dsh-sf-headerDot svg{width:18px;height:18px;display:block}
/* Eye only in Files mode — no reserved gap in Sessions; toggle stays left of Add */
[class*="_sectionHeader"] .dsh-sf-headerDot{display:none}
[class*="_sectionHeader"][data-dsh-sf-files="1"] .dsh-sf-headerDot{display:inline-flex}
.dsh-sf-treeModeLabel{
  display:flex;align-items:center;gap:6px;
  padding:4px 12px 2px 4px;
  margin:0;
  font-size:11px;font-weight:600;letter-spacing:.03em;
  text-transform:uppercase;
  color:var(--dsw-alias-label-tertiary,#8b919a);
  user-select:none;
}
.dsh-sf-treeModeLabel svg{
  flex:none;width:14px;height:14px;display:block;
  color:var(--dsw-alias-state-business-primary,#5b9dff);
}
/* Expanded: light rule under Workspaces header */
[class*="_root"]:not([class*="_collapsed"]) [class*="_sectionHeader"][data-dsh-sf-files],
[class*="_root"]:not([class*="_rail"]) [class*="_sectionHeader"][data-dsh-sf-files]{
  border-bottom:1px solid var(--dsw-alias-border-l2,#333);
  margin-bottom:6px;
  padding-bottom:8px;
  box-sizing:border-box;
}
/* Collapsed sidebar rail (~40px): icon-only chrome */
[class*="_collapsed"] .dsh-sf-treeModeLabel,
[class*="_root"][class*="_rail"] .dsh-sf-treeModeLabel{
  display:none!important;
}
[class*="_collapsed"] [class*="_sectionHeader"],
[class*="_root"][class*="_rail"] [class*="_sectionHeader"]{
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  padding:0!important;
  margin:0 0 8px!important;
  border:none!important;
  min-width:0!important;
  width:100%!important;
  box-sizing:border-box!important;
  overflow:visible!important;
}
[class*="_collapsed"] [class*="_sectionLabel"],
[class*="_root"][class*="_rail"] [class*="_sectionLabel"]{
  display:none!important;
}
[class*="_collapsed"] [class*="_headerActions"],
[class*="_root"][class*="_rail"] [class*="_headerActions"]{
  display:flex!important;
  flex-direction:column!important;
  align-items:center!important;
  justify-content:flex-start!important;
  gap:8px!important;
  width:100%!important;
  max-width:none!important;
  flex:none!important;
  margin:0!important;
  padding:0!important;
  overflow:visible!important;
}
/* Keep Sessions↔Files + Search; hide secondary chrome that can't fit */
[class*="_collapsed"] [class*="_sectionHeader"] .dsh-sf-headerDot,
[class*="_root"][class*="_rail"] [class*="_sectionHeader"] .dsh-sf-headerDot,
[class*="_collapsed"] [class*="_sectionHeader"] button[aria-label="Add workspace"],
[class*="_root"][class*="_rail"] [class*="_sectionHeader"] button[aria-label="Add workspace"],
[class*="_collapsed"] [class*="_searchInput"],
[class*="_root"][class*="_rail"] [class*="_searchInput"],
[class*="_collapsed"] [class*="_searchTree"],
[class*="_root"][class*="_rail"] [class*="_searchTree"]{
  display:none!important;
}
[class*="_collapsed"] [class*="_sectionHeader"] .dsh-sf-headerToggle,
[class*="_root"][class*="_rail"] [class*="_sectionHeader"] .dsh-sf-headerToggle,
[class*="_collapsed"] [class*="_searchButton"],
[class*="_root"][class*="_rail"] [class*="_searchButton"]{
  width:32px!important;
  height:32px!important;
  min-width:32px!important;
  max-width:32px!important;
  margin:0!important;
  padding:0!important;
  flex:none!important;
  align-self:center!important;
  border-radius:8px!important;
  box-sizing:border-box!important;
}
[class*="_collapsed"] [class*="_sectionHeader"] .dsh-sf-headerToggle svg,
[class*="_root"][class*="_rail"] [class*="_sectionHeader"] .dsh-sf-headerToggle svg,
[class*="_collapsed"] [class*="_searchButton"] svg,
[class*="_root"][class*="_rail"] [class*="_searchButton"] svg{
  width:18px!important;
  height:18px!important;
  display:block!important;
}
[class*="_collapsed"] .dsh-sf-tree,
[class*="_root"][class*="_rail"] .dsh-sf-tree,
[class*="_collapsed"] .dsh-sf-wsZone,
[class*="_root"][class*="_rail"] .dsh-sf-wsZone,
[class*="_collapsed"] .dsh-ws-rowLegend,
[class*="_root"][class*="_rail"] .dsh-ws-rowLegend,
[class*="_collapsed"] [class*="_sessionRow"],
[class*="_root"][class*="_rail"] [class*="_sessionRow"],
[class*="_collapsed"] [class*="_sessionOverflowButton"],
[class*="_root"][class*="_rail"] [class*="_sessionOverflowButton"],
[class*="_collapsed"] [class*="_projectRow"],
[class*="_root"][class*="_rail"] [class*="_projectRow"],
[class*="_collapsed"] [class*="_list"],
[class*="_root"][class*="_rail"] [class*="_list"],
[class*="_collapsed"] [class*="_listArea"],
[class*="_root"][class*="_rail"] [class*="_listArea"]{
  display:none!important;
}
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
.dsh-sf-rowAdd,.dsh-sf-rowMore,.dsh-sf-rowLive{
  flex:none;width:18px;height:18px;padding:0;border:none;border-radius:4px;
  background:transparent;color:var(--dsw-alias-label-tertiary,#888);
  font:inherit;font-size:14px;line-height:16px;cursor:pointer;
  opacity:0;display:inline-flex;align-items:center;justify-content:center;
}
.dsh-sf-rowActs{
  flex:none;margin-left:auto;display:inline-flex;align-items:center;gap:1px;
  position:relative;
}
.dsh-sf-row:hover .dsh-sf-rowAdd,.dsh-sf-row:hover .dsh-sf-rowMore,.dsh-sf-row:hover .dsh-sf-rowLive,
.dsh-sf-rowAdd:focus,.dsh-sf-rowMore:focus,.dsh-sf-rowMore.open,.dsh-sf-rowLive:focus{opacity:1}
.dsh-sf-rowAdd:hover{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsh-sf-rowMore{font-size:16px;letter-spacing:.02em}
.dsh-sf-rowMore:hover,.dsh-sf-rowMore.open{color:var(--dsw-alias-label-primary,#fff);background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsh-sf-rowMenu{
  position:fixed;z-index:12001;min-width:132px;
  padding:4px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2,#444);
  background:var(--dsw-alias-bg-layer-1,#1b1d21);box-shadow:0 8px 24px rgba(0,0,0,.35);
}
.dsh-sf-rowMenuItem{
  display:block;width:100%;text-align:left;border:none;border-radius:6px;
  background:transparent;color:var(--dsw-alias-label-primary,#eee);
  font:inherit;font-size:12px;line-height:1.3;padding:7px 10px;cursor:pointer;
}
.dsh-sf-rowMenuItem:hover{background:var(--dsw-alias-interactive-bg-hover,rgba(255,255,255,.08))}
.dsh-sf-rowMenuItem:disabled{opacity:.45;cursor:not-allowed}
.dsh-sf-rowMenuItem.danger{color:var(--dsw-alias-state-error-primary,#f07178)}
.dsh-sf-rowMenuItem.danger:hover{background:rgba(240,113,120,.12)}
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
.dsh-sf-rowLive{font-size:11px;color:var(--dsw-alias-state-business-primary,#3fb950)}
.dsh-sf-rowLive:hover{color:var(--dsw-alias-state-business-primary,#3fb950);background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3fb950) 16%,transparent)}
.dsh-sf-row:focus-visible{outline:1px solid var(--dsw-alias-state-business-primary,#5b9dff);outline-offset:-1px}
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
.dsh-sf-status.warn{color:var(--dsw-alias-state-warn-primary,#e8a33d)}
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
[class*="_projectRow"].dsh-sf-dropHoverWs{
  outline:1px dashed var(--dsw-alias-state-business-primary,#3d8bfd);outline-offset:-2px;border-radius:6px;
}
/* Files mode: stock + means new folder */
[class*="_groupSection"][data-dsh-sf-mode="files"] button[aria-label^="New session in "]{
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
			const input = document.querySelector(`input${cssLocal("searchInput")}`);
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
			const clearBtn = document.querySelector(`${cssLocal("sectionHeader")} ${cssLocal("clearButton")}`);
			if (clearBtn instanceof HTMLElement) {
				clearBtn.click();
				return;
			}
			const input = document.querySelector(`input${cssLocal("searchInput")}`);
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

		function setCurrentWorkspace(ws, { force = false } = {}) {
			try {
				if (ws && ws.cwd) localStorage.setItem(CURRENT_WS_KEY, JSON.stringify(ws));
				else localStorage.removeItem(CURRENT_WS_KEY);
				if (force && ws && ws.cwd) {
					localStorage.setItem(CURRENT_WS_FORCE_UNTIL_KEY, String(Date.now() + POINTER_FORCE_MS));
				} else if (!ws) {
					localStorage.removeItem(CURRENT_WS_FORCE_UNTIL_KEY);
				}
			} catch { /* ignore */ }
			window.dispatchEvent(new CustomEvent(CURRENT_WS_EVENT, { detail: ws || null }));
		}

		function pointerForceActive() {
			try {
				const until = Number(localStorage.getItem(CURRENT_WS_FORCE_UNTIL_KEY) || 0);
				return Number.isFinite(until) && Date.now() < until;
			} catch {
				return false;
			}
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

		function syncRowFolderAccent(row, folderEl) {
			if (!row) return;
			const v = folderEl?.style?.getPropertyValue("--dsh-ws-folder-color")?.trim()
				|| (folderEl ? getComputedStyle(folderEl).getPropertyValue("--dsh-ws-folder-color") : "")?.trim();
			if (v) row.style.setProperty("--dsh-ws-folder-color", v);
			else row.style.removeProperty("--dsh-ws-folder-color");
		}

		function isRemotePath(p) {
			return typeof p === "string" && p.startsWith("dssh://");
		}

		function normalizeWsCwd(cwd) {
			const s = String(cwd || "").trim();
			if (!s) return "";
			if (isRemotePath(s)) return s.replace(/\/+$/, "") || s;
			return s.replace(/\/+$/, "") || s;
		}

		function sessionHeaderCwd(sessSnap, sessionId) {
			const row = sessSnap?.byId?.[sessionId];
			if (!row) return null;
			const h = row.header ?? row;
			return typeof h?.cwd === "string" ? h.cwd : null;
		}

		function cwdMatchesWorkspace(sessionCwd, wsCwd) {
			const a = normalizeWsCwd(sessionCwd);
			const b = normalizeWsCwd(wsCwd);
			if (!b) return true;
			if (!a) return false;
			return a === b;
		}

		function dsshHostId(cwd) {
			if (!isRemotePath(cwd)) return null;
			return String(cwd).replace(/^dssh:\/\//, "").split("/")[0] || null;
		}

		function resolveWorkspace(workspaces, row) {
			const titleEl = qsExactLocal(row, "title");
			const title = (titleEl?.textContent || "").replace(/\s+/g, " ").trim();
			const items = workspaces?.list?.getSnapshot?.()?.items || [];
			let hit = title
				? items.find((w) => workspaceLabel(w).toLowerCase() === title.toLowerCase())
				: null;
			if (!hit) {
				const cwd = row?.dataset?.dshSfCwd;
				if (cwd) hit = items.find((w) => workspaceCwd(w) === cwd) || null;
			}
			if (!hit) {
				// Last resort: use stamped row metadata from a previous paint.
				const cwd = row?.dataset?.dshSfCwd;
				const key = row?.querySelector?.(":scope > .dsh-sf-wsZone")?.dataset?.wsKey;
				if (cwd && key) {
					return { key, label: title || cwd, cwd, item: { path: cwd, title, workspaceId: key } };
				}
				return null;
			}
			const cwd = workspaceCwd(hit) || row?.dataset?.dshSfCwd;
			if (!cwd) return null;
			return { key: workspaceKeyFromItem(hit), label: workspaceLabel(hit) || title, cwd, item: hit };
		}

		function getActiveWorkspace(workspaces, sessions) {
			const pointer = getCurrentWorkspace();
			const forcePointer = pointerForceActive();
			try {
				const sessSnap = sessions?.list?.getSnapshot?.();
				const wsSnap = workspaces?.list?.getSnapshot?.();
				const current = sessSnap?.current;
				const items = wsSnap?.items || [];
				if (pointer?.cwd && isRemotePath(pointer.cwd) && items.length > 0) {
					const pinned = items.find((w) => workspaceKeyFromItem(w) === pointer.key)
						|| items.find((w) => cwdMatchesWorkspace(workspaceCwd(w), pointer.cwd));
					if (pinned || pointer.cwd) {
						const pinnedCwd = workspaceCwd(pinned) || pointer.cwd;
						if (current && pinned) {
							const live = items.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(current));
							const liveCwd = live ? workspaceCwd(live) : null;
							if (liveCwd && !cwdMatchesWorkspace(liveCwd, pinnedCwd)) {
								return {
									key: pointer.key || workspaceKeyFromItem(pinned),
									label: workspaceLabel(pinned) || pointer.label,
									cwd: pinnedCwd,
									item: pinned,
									fromPointer: true,
								};
							}
						}
					}
				}
				if (current && items.length > 0) {
					const hit = items.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(current));
					if (hit) {
						const cwd = workspaceCwd(hit);
						const hitKey = workspaceKeyFromItem(hit);
						// After an explicit switch-zone click, trust the pointer until
						// startSession/open lands (or the short force window ends).
						if (forcePointer && pointer?.key && pointer.key !== hitKey) {
							const pinned = items.find((w) => workspaceKeyFromItem(w) === pointer.key);
							if (pinned) {
								const pinnedCwd = workspaceCwd(pinned) || pointer.cwd;
								if (pinnedCwd) {
									return {
										key: pointer.key,
										label: workspaceLabel(pinned) || pointer.label,
										cwd: pinnedCwd,
										item: pinned,
										fromPointer: true,
									};
								}
							} else if (pointer.cwd) {
								return { ...pointer, fromPointer: true };
							}
						}
						if (cwd) return { key: hitKey, label: workspaceLabel(hit), cwd, item: hit };
					}
				}
			} catch { /* ignore */ }
			if (pointer?.key && workspaces?.list?.getSnapshot) {
				try {
					const hit = (workspaces.list.getSnapshot()?.items || []).find((w) => workspaceKeyFromItem(w) === pointer.key);
					if (hit) {
						const cwd = workspaceCwd(hit) || pointer.cwd;
						if (cwd) {
							return {
								key: pointer.key,
								label: workspaceLabel(hit) || pointer.label || workspaceLabel({ cwd }),
								cwd,
								item: hit,
							};
						}
					}
				} catch { /* ignore */ }
			}
			return pointer;
		}

		function resolveWorkspaceId(ws, wsSnap) {
			const fromItem = ws?.item?.workspaceId || ws?.item?.id;
			if (fromItem && wsSnap?.items?.some((w) => w.workspaceId === fromItem)) return fromItem;
			const live = (wsSnap?.items || []).find(
				(w) => workspaceKeyFromItem(w) === ws.key || cwdMatchesWorkspace(workspaceCwd(w), ws.cwd),
			);
			return live?.workspaceId || null;
		}

		/** Mirror stock uiWorkspace.openWorkspace / connectWorkspace (domain workspaces has no startSession). */
		async function navigateToWorkspace(workspaces, sessions, layout, workspaceId) {
			const wsSnap = workspaces?.list?.getSnapshot?.();
			const workspace = wsSnap?.items?.find((w) => w.workspaceId === workspaceId);
			if (!workspace) {
				throw new Error(`unknown workspace ${workspaceId}`);
			}
			const archived = new Set(wsSnap?.archivedSessionIds || []);
			const sessSnap = sessions?.list?.getSnapshot?.();
			for (const id of sessSnap?.ids || []) {
				const summary = sessSnap?.byId?.[id];
				if (
					summary?.blank
					&& summary.cwd === workspace.path
					&& Array.isArray(workspace.sessionIds)
					&& workspace.sessionIds.includes(summary.id)
					&& !archived.has(summary.id)
				) {
					sessions.open(summary.id);
					try {
						layout?.selectPanel?.(null);
					} catch {
						/* ignore */
					}
					return summary.id;
				}
			}
			if (typeof sessions?.create !== "function") {
				throw new Error("sessions.create unavailable");
			}
			const sessionId = await sessions.create({ workspaceId });
			sessions.open(sessionId);
			try {
				layout?.selectPanel?.(null);
			} catch {
				/* ignore */
			}
			return sessionId;
		}

		function switchWorkspace(workspaces, sessions, layout, ws) {
			if (!ws) return;
			// 1. Record as active pointer in localStorage & dispatch custom event
			setCurrentWorkspace({ key: ws.key, cwd: ws.cwd, label: ws.label }, { force: true });

			const warmHostId = dsshHostId(ws.cwd);
			if (warmHostId) {
				window.dispatchEvent(new CustomEvent("dsh-ssh-warm-host", { detail: { hostId: warmHostId } }));
			}

			// 2. Actually switch the body view in Harness to this workspace
			try {
				const wsSnap = workspaces?.list?.getSnapshot?.();
				const wsId = resolveWorkspaceId(ws, wsSnap);
				if (!wsId) {
					console.warn("[dsh-sidebar-files] switch: no workspaceId for", ws.key, ws.cwd);
					return;
				}

				void navigateToWorkspace(workspaces, sessions, layout, wsId)
					.then(() => {
						const hostId = dsshHostId(ws.cwd);
						if (hostId) {
							window.dispatchEvent(new CustomEvent("dsh-ssh-warm-host", { detail: { hostId } }));
						}
						if (typeof window.__dshResyncWorkbenchTab === "function") {
							requestAnimationFrame(() => window.__dshResyncWorkbenchTab());
						}
					})
					.catch((err) => {
						console.warn("[dsh-sidebar-files] navigateToWorkspace failed:", err);
					});
			} catch (err) {
				console.warn("[dsh-sidebar-files] failed to switch workspace session:", err);
			}
			// Re-paint so the accent/pressed state follows the pointer immediately.
			try {
				window.dispatchEvent(new CustomEvent(MODE_EVENT, { detail: { view: getView() } }));
			} catch { /* ignore */ }
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
					credentials: "same-origin",
					headers: { "content-type": "application/json" },
					// Typert 0.2 descriptor param is named `args`; value must be `{ args: <fields> }`
					// (double wrap). Flat `{ path, root }` → gateway/arguments-invalid.
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
		const COPY_EVENT = "dsh-sf-copy";
		const FILES_CHANGED_EVENT = "dsh-sf-files-changed";
		const CLIPBOARD_KEY = "dsh-sf-clipboard/v1";
		const CLIPBOARD_EVENT = "dsh-sf-clipboard";
		/** In-memory drag payload — Chromium often hides custom MIME types during dragover. */
		let activeSidebarDrag = null;

		function getFileClipboard() {
			try {
				const raw = sessionStorage.getItem(CLIPBOARD_KEY);
				if (!raw) return null;
				const item = JSON.parse(raw);
				if (item && item.path && item.root && item.name) return item;
			} catch { /* ignore */ }
			return null;
		}

		function setFileClipboard(item) {
			sessionStorage.setItem(CLIPBOARD_KEY, JSON.stringify(item));
			window.dispatchEvent(new CustomEvent(CLIPBOARD_EVENT));
		}

		function splitEntryName(name) {
			const s = String(name || "");
			const i = s.lastIndexOf(".");
			if (i <= 0) return { base: s, ext: "" };
			return { base: s.slice(0, i), ext: s.slice(i) };
		}

		function nextCopyName(originalName, attempt) {
			const { base, ext } = splitEntryName(originalName);
			if (attempt <= 1) return `${base} copy${ext}`;
			return `${base} copy ${attempt - 1}${ext}`;
		}

		function dragHasSidebarFile(dt) {
			if (activeSidebarDrag?.path) return true;
			if (!dt || !dt.types) return false;
			const types = [...dt.types];
			if (types.includes(DRAG_MIME) || types.includes("application/x-dsh-sidebar-file")) return true;
			// Fallback: we also put JSON / absolute paths on text/plain
			return types.includes("text/plain");
		}

		function clearDropHoverHighlights() {
			if (typeof document === "undefined") return;
			for (const el of document.querySelectorAll(".dsh-sf-dropHoverRoot")) {
				el.classList.remove("dsh-sf-dropHoverRoot");
			}
			for (const el of document.querySelectorAll(".dsh-sf-dropHoverWs")) {
				el.classList.remove("dsh-sf-dropHoverWs");
			}
		}

		function readDragPayload(ev) {
			if (activeSidebarDrag?.path && activeSidebarDrag?.root) {
				return { ...activeSidebarDrag };
			}
			let raw;
			try {
				raw = ev.dataTransfer.getData(DRAG_MIME);
			} catch {
				raw = "";
			}
			if (!raw) {
				try {
					// JSON also on text/plain — custom MIME is unreliable across drag phases
					raw = ev.dataTransfer.getData("text/plain");
				} catch {
					return null;
				}
			}
			if (!raw) return null;
			try {
				const payload = JSON.parse(raw);
				if (payload && typeof payload === "object" && payload.__dshFile && payload.path && payload.root) return payload;
			} catch { /* plain path — not enough for move without root */ }
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

		async function performCopy(args) {
			return callRemote("file.copy", args);
		}

		function noteCopyResult(res, setErr, setWarn) {
			setErr(null);
			setWarn(null);
			if (res?.warning) setWarn(res.warning);
		}

		function openInCodeTab(path) {
			if (typeof path !== "string" || !path) return;
			window.dispatchEvent(new CustomEvent("dsh-open-code-file", { detail: { path } }));
			notifyFilesChanged(path);
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

		function entrySupportsLiveServer(entry, dirCache) {
			if (!entry) return false;
			if (entry.type === "file") {
				return /\.html?$/i.test(String(entry.name || ""));
			}
			if (entry.type !== "directory") return false;
			const listing = dirCache?.[entry.path];
			if (!listing || listing.state !== "ready") return false;
			return (listing.entries || []).some((child) =>
				child?.type === "file" && /^index\.html?$/i.test(String(child.name || "")),
			);
		}

		function rowMenuStyle(anchor) {
			const width = 132;
			const estHeight = 136;
			const gap = 4;
			let top = anchor.bottom + gap;
			if (top + estHeight > window.innerHeight - 8) {
				top = Math.max(8, anchor.top - estHeight - gap);
			}
			let left = anchor.right - width;
			left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
			return { position: "fixed", top, left, width, zIndex: 12001 };
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

		function pathInRoot(p, root) {
			if (!p || !root) return false;
			if (p === root) return true;
			const prefix = root.endsWith("/") ? root : `${root}/`;
			return p.startsWith(prefix);
		}

		function refreshTreePaths(root, targetPath, loadPath, setExpanded) {
			if (targetPath && !pathInRoot(targetPath, root)) {
				const parent = parentOf(targetPath, root);
				if (!parent || !pathInRoot(parent, root)) return;
			}
			let p = targetPath ? parentOf(targetPath, root) || root : root;
			const chain = [];
			while (p) {
				chain.push(p);
				if (p === root) break;
				const up = parentOf(p, root);
				if (!up || up === p) break;
				p = up;
			}
			for (const dir of chain) loadPath(dir, true);
			setExpanded((ex) => {
				const next = { ...ex };
				for (const dir of chain) next[dir] = true;
				return next;
			});
		}

		function notifyFilesChanged(path, root) {
			window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT, { detail: { path, root } }));
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
			const [createWarn, setCreateWarn] = React.useState(null);
			const [searchHits, setSearchHits] = React.useState(null);
			const [searching, setSearching] = React.useState(false);
			const [deleting, setDeleting] = React.useState(null);
			const [pendingDelete, setPendingDelete] = React.useState(null);
			const [renameAt, setRenameAt] = React.useState(null);
			const [renameName, setRenameName] = React.useState("");
			const [renaming, setRenaming] = React.useState(false);
			const [dragOverPath, setDragOverPath] = React.useState(null);
			const [draggingPath, setDraggingPath] = React.useState(null);
			const [menuAt, setMenuAt] = React.useState(null);
			const [menuEntry, setMenuEntry] = React.useState(null);
			const [menuAnchor, setMenuAnchor] = React.useState(null);
			const [clipTick, setClipTick] = React.useState(0);

			const closeRowMenu = React.useCallback(() => {
				setMenuAt(null);
				setMenuEntry(null);
				setMenuAnchor(null);
			}, []);

			const openRowMenu = React.useCallback((entry, anchorEl) => {
				if (!entry?.path || !(anchorEl instanceof Element)) return;
				setPendingDelete((prev) => (prev && prev !== entry.path ? null : prev));
				const rect = anchorEl.getBoundingClientRect();
				setMenuAt(entry.path);
				setMenuEntry(entry);
				setMenuAnchor({
					top: rect.top,
					right: rect.right,
					bottom: rect.bottom,
					left: rect.left,
				});
			}, []);

			React.useEffect(() => {
				const onClip = () => setClipTick((n) => n + 1);
				window.addEventListener(CLIPBOARD_EVENT, onClip);
				return () => window.removeEventListener(CLIPBOARD_EVENT, onClip);
			}, []);

			React.useEffect(() => {
				if (!menuAt) return;
				const close = (e) => {
					const t = e.target;
					if (t instanceof Element && t.closest(".dsh-sf-rowMenu, .dsh-sf-rowMore")) return;
					closeRowMenu();
				};
				const closeOnMove = () => closeRowMenu();
				document.addEventListener("pointerdown", close, true);
				window.addEventListener("resize", closeOnMove);
				document.querySelectorAll(".dsh-sf-tree").forEach((el) => {
					el.addEventListener("scroll", closeOnMove, { passive: true });
				});
				return () => {
					document.removeEventListener("pointerdown", close, true);
					window.removeEventListener("resize", closeOnMove);
					document.querySelectorAll(".dsh-sf-tree").forEach((el) => {
						el.removeEventListener("scroll", closeOnMove);
					});
				};
			}, [menuAt, closeRowMenu]);

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

			// Clear two-step delete confirm if user clicks elsewhere or waits too long.
			React.useEffect(() => {
				if (!pendingDelete) return;
				const onPointerDown = (e) => {
					const t = e.target;
					if (!(t instanceof Element)) return;
					// Old inline × used .dsh-sf-rowDel; current UI uses the ⋯ portal menu.
					if (t.closest(".dsh-sf-rowDel.confirm, .dsh-sf-rowMenu")) return;
					setPendingDelete(null);
				};
				const timer = window.setTimeout(() => setPendingDelete(null), 8000);
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
				if (next) loadPath(path, true);
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
					} else if (isRemotePath(parent) || isRemotePath(root)) {
						const path = joinPath(parent, name);
						const res = await callRemote("file.mkdir", { path, root });
						if (!res || !res.ok) {
							setCreateErr((res && (res.message || res.error)) || "create folder failed");
							return;
						}
						setNewAt(null);
						setNewName("");
						loadPath(parent, true);
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

			const copyEntry = (entry) => {
				if (!entry?.path) return;
				setFileClipboard({
					path: entry.path,
					root,
					name: entry.name,
					type: entry.type || "file",
				});
				closeRowMenu();
				setCreateErr(null);
			};

			const downloadEntry = async (entry) => {
				if (!entry?.path || entry.type === "directory") return;
				closeRowMenu();
				setCreateErr(null);
				setCreateWarn(null);
				try {
					const res = await callRemote("file.download", { path: entry.path, root });
					if (!res?.ok || typeof res.base64 !== "string") {
						setCreateErr((res && (res.message || res.error)) || "download failed");
						return;
					}
					const bin = atob(res.base64);
					const bytes = new Uint8Array(bin.length);
					for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
					const blob = new Blob([bytes], { type: "application/octet-stream" });
					const url = URL.createObjectURL(blob);
					const anchor = document.createElement("a");
					anchor.href = url;
					anchor.download = res.name || entry.name || "download";
					document.body.appendChild(anchor);
					anchor.click();
					anchor.remove();
					URL.revokeObjectURL(url);
				} catch (err) {
					setCreateErr(err && err.message || String(err));
				}
			};

			const resolvePasteName = async (destDir, originalName) => {
				for (let attempt = 0; attempt < 50; attempt++) {
					const name = attempt === 0 ? originalName : nextCopyName(originalName, attempt);
					const target = joinPath(destDir, name);
					const res = await callRemote("file.stat", { path: target, root: destDir }).catch(() => null);
					if (!res?.ok) return name;
				}
				throw new Error("could not find an available paste name");
			};

			const pasteInto = async (destDir) => {
				const clip = getFileClipboard();
				if (!clip?.path || !destDir) return;
				closeRowMenu();
				setCreateErr(null);
				setCreateWarn(null);
				try {
					const name = await resolvePasteName(destDir, clip.name);
					const res = await performCopy({
						path: clip.path,
						root: clip.root,
						destDir,
						destRoot: root,
						newName: name,
					});
					if (!res?.ok) {
						setCreateErr((res && (res.message || res.error)) || "paste failed");
						return;
					}
					noteCopyResult(res, setCreateErr, setCreateWarn);
					setExpanded((ex) => ({ ...ex, [destDir]: true }));
					loadPath(destDir, true);
					window.dispatchEvent(new CustomEvent(COPY_EVENT, {
						detail: { destDir, destRoot: root, path: res.path },
					}));
				} catch (err) {
					setCreateErr(err?.message || String(err));
				}
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
				setCreateWarn(null);
				const copyMode = ev.ctrlKey || ev.metaKey || ev.altKey;
				try {
					if (copyMode) {
						const name = await resolvePasteName(destDir, payload.name || payload.path.split("/").pop());
						const res = await performCopy({
							path: payload.path,
							root: payload.root,
							destDir,
							destRoot,
							newName: name,
						});
						if (!res || !res.ok) {
							setCreateErr((res && (res.message || res.error)) || "copy failed");
							return;
						}
						noteCopyResult(res, setCreateErr, setCreateWarn);
						window.dispatchEvent(new CustomEvent(COPY_EVENT, {
							detail: { srcPath: payload.path, srcRoot: payload.root, destDir, destRoot, path: res.path },
						}));
						return;
					}
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

			React.useEffect(() => {
				const onCopy = (e) => {
					const d = e?.detail || {};
					if (d.destRoot === root) {
						loadPath(d.destDir || root, true);
						setExpanded((ex) => ({ ...ex, [d.destDir || root]: true }));
					}
				};
				window.addEventListener(COPY_EVENT, onCopy);
				return () => window.removeEventListener(COPY_EVENT, onCopy);
			}, [root, loadPath]);

			React.useEffect(() => {
				const onExternalChange = (e) => {
					const d = e?.detail || {};
					if (d.root && d.root !== root) return;
					refreshTreePaths(root, d.path || root, loadPath, setExpanded);
				};
				const onOpenCode = (e) => {
					const p = e?.detail?.path;
					if (typeof p !== "string") return;
					refreshTreePaths(root, p, loadPath, setExpanded);
				};
				const onFilesView = () => {
					if (getView() !== "files") return;
					loadPath(root, true);
					for (const [dir, isOpen] of Object.entries(expanded)) {
						if (isOpen && dir) loadPath(dir, true);
					}
				};
				window.addEventListener(FILES_CHANGED_EVENT, onExternalChange);
				window.addEventListener("dsh-open-code-file", onOpenCode);
				window.addEventListener(MODE_EVENT, onFilesView);
				return () => {
					window.removeEventListener(FILES_CHANGED_EVENT, onExternalChange);
					window.removeEventListener("dsh-open-code-file", onOpenCode);
					window.removeEventListener(MODE_EVENT, onFilesView);
				};
			}, [root, loadPath, expanded]);

			const menuItem = (label, onClick, extraClass, disabled) => React.createElement("button", {
				key: label,
				type: "button",
				className: "dsh-sf-rowMenuItem" + (extraClass ? ` ${extraClass}` : ""),
				role: "menuitem",
				disabled: !!disabled,
				onClick: (ev) => {
					ev.preventDefault();
					ev.stopPropagation();
					if (!disabled) onClick();
				},
			}, label);

			const rowActions = (entry, opts) => {
				const isDir = entry.type === "directory";
				const kids = [];
				const menuOpen = menuAt === entry.path;
				if (entrySupportsLiveServer(entry, dirs)) {
					kids.push(React.createElement("span", {
						key: "live",
						className: "dsh-sf-rowLive",
						role: "button",
						tabIndex: 0,
						title: entry.type === "directory"
							? "Open index.html with Live Server in Browser"
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
					key: "more",
					className: "dsh-sf-rowMore" + (menuOpen ? " open" : ""),
					role: "button",
					tabIndex: 0,
					title: "File actions (Copy, Paste, Download, Rename, Delete)",
					"aria-label": "File actions for " + entry.name,
					"aria-expanded": menuOpen ? "true" : "false",
					"aria-haspopup": "menu",
					onClick: (ev) => {
						ev.preventDefault();
						ev.stopPropagation();
						if (menuOpen) closeRowMenu();
						else openRowMenu(entry, ev.currentTarget);
					},
					onKeyDown: (ev) => {
						if (ev.key === "Enter" || ev.key === " ") {
							ev.preventDefault();
							ev.stopPropagation();
							if (menuOpen) closeRowMenu();
							else openRowMenu(entry, ev.currentTarget);
						}
					},
				}, "⋯"));
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
						title: e.path + (isDir ? " — Ctrl+V paste" : " — Ctrl+C copy"),
						tabIndex: 0,
						draggable: true,
						onClick: (ev) => {
							ev.stopPropagation();
							if (isDir) toggleDir(e.path);
							else openInCodeTab(e.path);
						},
						onKeyDown: (ev) => {
							if (!(ev.ctrlKey || ev.metaKey)) return;
							const key = ev.key.toLowerCase();
							if (key === "c") {
								ev.preventDefault();
								ev.stopPropagation();
								copyEntry(e);
							}
							if (key === "v" && isDir) {
								ev.preventDefault();
								ev.stopPropagation();
								pasteInto(e.path);
							}
						},
						onDragStart: (ev) => {
							ev.stopPropagation();
							setDraggingPath(e.path);
							ev.dataTransfer.effectAllowed = "copyMove";
							const obj = {
								__dshFile: true, path: e.path, root, name: e.name, isDir,
							};
							activeSidebarDrag = obj;
							try {
								const payload = JSON.stringify(obj);
								ev.dataTransfer.setData(DRAG_MIME, payload);
								// Keep JSON on text/plain so drop still works if custom MIME is stripped
								ev.dataTransfer.setData("text/plain", payload);
							} catch { /* ignore */ }
						},
						onDragEnd: (ev) => {
							ev.stopPropagation();
							activeSidebarDrag = null;
							setDraggingPath(null);
							setDragOverPath(null);
							clearDropHoverHighlights();
						},
						onDragOver: !isDir ? undefined : (ev) => {
							ev.preventDefault();
							ev.stopPropagation();
							ev.dataTransfer.dropEffect = (ev.ctrlKey || ev.metaKey || ev.altKey) ? "copy" : "move";
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
				createWarn && React.createElement("div", { className: "dsh-sf-status warn" }, createWarn),
				body,
				menuAt && menuEntry && menuAnchor && typeof document !== "undefined"
					? ReactDOM.createPortal((() => {
						const isDir = menuEntry.type === "directory";
						const confirming = pendingDelete === menuEntry.path;
						const clip = clipTick >= 0 ? getFileClipboard() : null;
						return React.createElement("div", {
							className: "dsh-sf-rowMenu",
							role: "menu",
							style: rowMenuStyle(menuAnchor),
							onClick: (ev) => ev.stopPropagation(),
							onPointerDown: (ev) => ev.stopPropagation(),
						},
							menuItem("Copy", () => copyEntry(menuEntry)),
							isDir ? menuItem("Paste", () => pasteInto(menuEntry.path), null, !clip) : null,
							!isDir ? menuItem("Download", () => { downloadEntry(menuEntry); }) : null,
							menuItem("Rename", () => { closeRowMenu(); beginRename(menuEntry); }),
							menuItem(confirming ? "Confirm delete" : "Delete", () => {
								if (confirming) {
									const entry = menuEntry;
									closeRowMenu();
									setPendingDelete(null);
									deleteEntry(entry);
									return;
								}
								setPendingDelete(menuEntry.path);
							}, "danger" + (confirming ? " confirm" : "")),
						);
					})(), document.body)
					: null,
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
				const row = group.querySelector('[class*="_projectRow"]');
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
				ev.stopPropagation();
				const payload = readDragPayload(ev);
				if (!payload || payload.path === destDir) return;
				try {
					const res = await performMove({
						path: payload.path,
						root: payload.root,
						destDir,
						destRoot: destDir,
					});
					activeSidebarDrag = null;
					if (res && res.ok) {
						window.dispatchEvent(new CustomEvent(MOVE_EVENT, {
							detail: { srcPath: payload.path, srcRoot: payload.root, destDir, destRoot: destDir },
						}));
						window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT, {
							detail: { root: payload.root, path: payload.path },
						}));
						window.dispatchEvent(new CustomEvent(FILES_CHANGED_EVENT, {
							detail: { root: destDir, path: destDir },
						}));
					} else {
						const msg = (res && (res.message || res.error)) || "move failed";
						console.warn("[dsh-sidebar-files] move failed", res);
						window.alert(`Could not move into workspace:\n${msg}`);
					}
				} catch (err) {
					activeSidebarDrag = null;
					console.warn("[dsh-sidebar-files] move failed", err);
					window.alert(`Could not move into workspace:\n${err?.message || err}`);
				}
			});
		}

		function findGroup(row) {
			return row.closest('[class*="_groupSection"]') || row.parentElement;
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

		function createOutlineIconSvg(svgNs, icon, width, height) {
			const svg = document.createElementNS(svgNs, "svg");
			svg.setAttribute("viewBox", "0 0 24 24");
			svg.setAttribute("width", String(width));
			svg.setAttribute("height", String(height));
			svg.setAttribute("fill", "none");
			svg.setAttribute("stroke", "currentColor");
			svg.setAttribute("stroke-width", "1.75");
			svg.setAttribute("stroke-linecap", "round");
			svg.setAttribute("stroke-linejoin", "round");
			svg.setAttribute("aria-hidden", "true");
			const path = document.createElementNS(svgNs, "path");
			path.setAttribute(
				"d",
				icon === "folder"
					? "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"
					: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z",
			);
			svg.appendChild(path);
			return svg;
		}

		function setHeaderBtnIcon(btn, kind) {
			btn.replaceChildren();
			const svgNs = "http://www.w3.org/2000/svg";
			if (kind === "files") {
				btn.appendChild(createOutlineIconSvg(svgNs, "folder", 18, 18));
				return;
			}
			if (kind === "sessions") {
				btn.appendChild(createOutlineIconSvg(svgNs, "chat", 18, 18));
				return;
			}
			const svg = document.createElementNS(svgNs, "svg");
			svg.setAttribute("viewBox", "0 0 16 16");
			svg.setAttribute("width", "18");
			svg.setAttribute("height", "18");
			svg.setAttribute("fill", "currentColor");
			svg.setAttribute("aria-hidden", "true");
			if (kind === "eye") {
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
			}
			btn.appendChild(svg);
		}

		function setModeLabelIcon(host, kind) {
			let target = host.querySelector(".dsh-sf-treeModeLabelIcon");
			if (!target) {
				target = document.createElement("span");
				target.className = "dsh-sf-treeModeLabelIcon";
				target.setAttribute("aria-hidden", "true");
				host.insertBefore(target, host.firstChild);
			}
			target.replaceChildren();
			const svgNs = "http://www.w3.org/2000/svg";
			target.appendChild(
				createOutlineIconSvg(svgNs, kind === "chat" ? "chat" : "folder", 14, 14),
			);
		}

		function paintTreeModeLabel() {
			const headers = document.querySelectorAll('[class*="_sectionHeader"]');
			const files = getView() === "files";
			for (const header of headers) {
				const sectionLabel = header.querySelector('[class*="_sectionLabel"]');
				if (!sectionLabel || !/workspaces/i.test(sectionLabel.textContent || "")) continue;
				const root = header.closest('[class*="_root"]') || header.parentElement;
				if (!root) continue;
				let row = root.querySelector(".dsh-sf-treeModeLabel");
				if (!row) {
					row = document.createElement("div");
					row.className = "dsh-sf-treeModeLabel";
					const listArea = root.querySelector('[class*="_listArea"]');
					if (listArea) root.insertBefore(row, listArea);
					else header.insertAdjacentElement("afterend", row);
				}
				row.dataset.dshSfMode = files ? "files" : "sessions";
				setModeLabelIcon(row, files ? "files" : "chat");
				let textEl = row.querySelector(".dsh-sf-treeModeLabelText");
				if (!textEl) {
					textEl = document.createElement("span");
					textEl.className = "dsh-sf-treeModeLabelText";
					row.appendChild(textEl);
				}
				textEl.textContent = files ? "Files" : "Chats";
			}
		}

		function paintHeaderControls() {
			const headers = document.querySelectorAll('[class*="_sectionHeader"]');
			const files = getView() === "files";
			const showDot = getShowDot();
			for (const header of headers) {
				const label = header.querySelector('[class*="_sectionLabel"]');
				if (!label || !/workspaces/i.test(label.textContent || "")) continue;

				header.dataset.dshSfFiles = files ? "1" : "0";

				const stockAdd = header.querySelector('button[aria-label="Add workspace"]');
				const actions = stockAdd?.parentElement || header.querySelector('[class*="_headerActions"]');

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
				const searchBtn = header.querySelector('[class*="_searchButton"]');
				const searchInput = header.querySelector('[class*="_searchInput"]');
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
			paintTreeModeLabel();
		}

		function paint(workspaces, sessions) {
			ensureStyles();
			document.querySelectorAll(".dsh-sf-toggle").forEach((n) => n.remove());
			document.querySelectorAll(`${cssLocal("projectRow")}[data-dsh-sf-mode]`).forEach((row) => {
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
			const unresolvedGroups = [];
			for (const row of document.querySelectorAll('[class*="_projectRow"]')) {
				const group = findGroup(row);
				if (!group) continue;
				const ws = resolveWorkspace(workspaces, row);
				if (!ws) {
					unresolvedGroups.push({ row, group });
					continue;
				}
				resolved.push({ ws, row, group });
			}
			const allWs = resolved.map((r) => r.ws);

			// Mark stock Ungrouped / orphan buckets — not real workspaces.
			for (const { row, group } of unresolvedGroups) {
				const titleEl = qsExactLocal(row, "title");
				const title = (titleEl?.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
				const isUngrouped = !title || title === "ungrouped" || title === "未分组";
				group.removeAttribute("data-dsh-sf-mode");
				group.removeAttribute("data-dsh-sf-key");
				group.removeAttribute("data-dsh-sf-collapsed");
				row.removeAttribute("data-dsh-sf-current");
				row.removeAttribute("data-dsh-sf-cwd");
				row.querySelectorAll(":scope > .dsh-sf-wsZone, :scope > .dsh-sf-chatIcon").forEach((n) => n.remove());
				if (isUngrouped) {
					group.dataset.dshSfUngrouped = "1";
					// Files mode: no cwd → hide entirely (CSS). Sessions: leave orphan chats reachable.
					if (view === "files") group.dataset.dshSfRedundant = "1";
					else group.removeAttribute("data-dsh-sf-redundant");
				} else {
					group.removeAttribute("data-dsh-sf-ungrouped");
					group.removeAttribute("data-dsh-sf-redundant");
				}
			}

			// Publish for chips / other plugins (ssh-workspace local/remote pills).
			try {
				const snap = workspaces?.list?.getSnapshot?.();
				if (snap && Array.isArray(snap.items)) {
					window.__dshWorkspacesSnapshot = snap;
				} else if (allWs.length) {
					window.__dshWorkspacesSnapshot = {
						items: allWs.map((w) => w.item || { path: w.cwd, title: w.label, workspaceId: w.key }),
					};
				}
				window.dispatchEvent(new CustomEvent("dsh-workspaces-snapshot", { detail: window.__dshWorkspacesSnapshot }));
			} catch { /* ignore */ }

			const currentWs = getActiveWorkspace(workspaces, sessions);
			const seen = new Set();
			for (const { ws, row, group } of resolved) {
				seen.add(ws.key);
				group.removeAttribute("data-dsh-sf-ungrouped");
				const isCurrent = !!currentWs && currentWs.key === ws.key;
				row.dataset.dshSfCurrent = isCurrent ? "1" : "0";
				row.dataset.dshSfCwd = ws.cwd;
				row.dataset.dshSfRemote = isRemotePath(ws.cwd) ? "1" : "0";
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
				// NEVER mutate [class*="_folder"].innerHTML — React owns that node. Old bubble
				// hack corrupted expand/collapse and wiped the whole sidebar. Undo once,
				// then use a sibling .dsh-sf-chatIcon + CSS hide for Sessions mode.
				try {
					const folderEl = row.querySelector(':scope > [class*="_folder"]');
					if (folderEl && folderEl.dataset.dshSfBubble === "1") {
						folderEl.innerHTML = folderEl.dataset.dshSfOriginalHtml || "";
						delete folderEl.dataset.dshSfBubble;
						delete folderEl.dataset.dshSfOriginalHtml;
					}
				} catch (err) {
					console.warn("[dsh-sidebar-files] folder restore failed", err);
				}
				let chatIcon = row.querySelector(":scope > .dsh-sf-chatIcon");
				const remoteWs = isRemotePath(ws.cwd);
				if (!chatIcon || !chatIcon.isConnected) {
					if (chatIcon) chatIcon.remove();
					chatIcon = document.createElement("span");
					chatIcon.className = "dsh-sf-chatIcon";
					chatIcon.setAttribute("aria-hidden", "true");
					const folderEl = row.querySelector(':scope > [class*="_folder"]');
					if (folderEl) row.insertBefore(chatIcon, folderEl);
					else if (zone.nextSibling) row.insertBefore(chatIcon, zone.nextSibling);
					else row.appendChild(chatIcon);
				}
				chatIcon.classList.toggle("dsh-sf-chatIconHidden", remoteWs);
				if (remoteWs) {
					chatIcon.innerHTML = "";
				} else {
					chatIcon.innerHTML = CHAT_BUBBLE_ICON;
				}
				chatIcon.classList.remove("dsh-sf-sshFolderIcon");
				const folderEl = row.querySelector(':scope > [class*="_folder"]');
				row.querySelector(":scope > .dsh-sf-sshMark")?.remove();
				syncRowFolderAccent(row, folderEl);
				let sshFolderIcon = row.querySelector(":scope > .dsh-sf-sshFolderIcon");
				if (remoteWs) {
					if (!sshFolderIcon || !sshFolderIcon.isConnected) {
						if (sshFolderIcon) sshFolderIcon.remove();
						sshFolderIcon = document.createElement("span");
						sshFolderIcon.className = "dsh-sf-sshFolderIcon";
						sshFolderIcon.setAttribute("aria-hidden", "true");
						if (folderEl) folderEl.insertAdjacentElement("beforebegin", sshFolderIcon);
						else if (chatIcon.nextSibling) row.insertBefore(sshFolderIcon, chatIcon.nextSibling);
						else row.appendChild(sshFolderIcon);
					} else if (folderEl && sshFolderIcon.nextElementSibling !== folderEl) {
						folderEl.insertAdjacentElement("beforebegin", sshFolderIcon);
					}
					sshFolderIcon.innerHTML = SSH_REMOTE_ICON;
				} else {
					sshFolderIcon?.remove();
					row.style.removeProperty("--dsh-ws-folder-color");
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

		const inject = ["workspaces", "sessions", "layout", "conversation", "inputTriggers"];
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
				el.closest?.('[class*="_card"]')
				|| el.closest?.('[class*="_root"]')
				|| el.closest?.('[class*="_composerSeat"]')
				|| el.closest?.("[data-composer-seat]")
				|| el.closest?.("[data-composer-card]")
				|| el.closest?.(null),
			);
		}

		function composerHighlightEl(el) {
			if (!(el instanceof Element)) return null;
			return el.closest('[class*="_card"]')
				|| el.closest('[class*="_composerSeat"]')
				|| el.closest("[data-composer-seat]");
		}

		function apply(ctx) {
			ensureStyles();
			try {
				document.documentElement.setAttribute("data-dsh-sidebar-files", "0.3.36");
			} catch { /* ignore */ }
			if (typeof window !== "undefined" && !window.__dshSfDropCleanup) {
				window.__dshSfDropCleanup = true;
				window.addEventListener("dragend", clearDropHoverHighlights);
			}

			ctx.inject(["workspaces", "sessions", "layout", "conversation", "inputTriggers"], (scope) => {
				const workspaces = scope.workspaces || scope.get("workspaces") || ctx.workspaces || ctx.get?.("workspaces");
				const sessions = scope.sessions || scope.get("sessions") || ctx.sessions || ctx.get?.("sessions");
				const layout = scope.layout || scope.get("layout") || ctx.layout || ctx.get?.("layout");
				const conversation = scope.get("conversation") || ctx.get?.("conversation");
				const inputTriggers = scope.get("inputTriggers") || ctx.get?.("inputTriggers");
				if (!workspaces?.list) {
					console.warn(`[${PLUGIN}] missing workspaces`);
					return;
				}
				window.__dshNavigateToWorkspace = (workspaceId) =>
					navigateToWorkspace(workspaces, sessions, layout, workspaceId);

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
						document.querySelector('textarea[class*="_input"]')?.focus?.();
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

				const expandSidebarIfCollapsed = () => {
					const root = document.querySelector('[class*="_root"]');
					if (!root || !hasLocalCss(root, "collapsed")) return;
					const btn =
						document.querySelector('button[class*="_toggle"]')
						|| document.querySelector('[class*="_toggle"]');
					if (btn instanceof HTMLElement) btn.click();
				};

				const toggleView = () => {
					setView(getView() === "files" ? "sessions" : "files");
					if (getView() === "sessions") setFileQuery("");
					expandSidebarIfCollapsed();
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
						// [class*="_chevron"] / [class*="_arrow"] — those are stock expand/collapse
						// for the chat list under the row (and may overlay most of the row).
						const wsZone = t.closest(".dsh-sf-wsZone");
						if (wsZone) {
							const row = wsZone.closest('[class*="_projectRow"]');
							const ws = row && resolveWorkspace(workspaces, row);
							if (ws) {
								e.preventDefault();
								e.stopPropagation();
								if (typeof e.stopImmediatePropagation === "function") e.stopImmediatePropagation();
								switchWorkspace(workspaces, sessions, layout, ws);
								runPaintNow();
							}
							return;
						}
						// Files mode: stock workspace row "+" creates a folder
						if (getView() === "files") {
							const plus = t.closest('button[data-dsh-sf-newfolder="1"], button[aria-label^="New folder in "], button[aria-label^="New session in "]');
							if (plus && plus.closest('[class*="_projectRow"]')) {
								const row = plus.closest('[class*="_projectRow"]');
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
							const row = t.closest('[class*="_projectRow"]');
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
						const row = wsZone.closest('[class*="_projectRow"]');
						const ws = row && resolveWorkspace(workspaces, row);
						if (!ws) return;
						e.preventDefault();
						e.stopPropagation();
						switchWorkspace(workspaces, sessions, layout, ws);
						runPaintNow();
					};
					document.addEventListener("keydown", onWsZoneKeydown, true);

					const onSearchInput = (e) => {
						const input = e.target;
						if (!(input instanceof HTMLInputElement)) return;
						if (!hasLocalCss(input, "searchInput")) return;
						if (getView() !== "files") return;
						// Block stock WorkspaceBrowser setQuery → SearchResults (which unmounts our trees).
						e.stopImmediatePropagation();
						setFileQuery(input.value);
					};
					const onSearchKeyDown = (e) => {
						const input = e.target;
						if (!(input instanceof HTMLInputElement)) return;
						if (!hasLocalCss(input, "searchInput")) return;
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
						if (!t?.closest?.('[class*="_clearButton"]')) return;
						setFileQuery("");
					};
					document.addEventListener("input", onSearchInput, true);
					document.addEventListener("keydown", onSearchKeyDown, true);
					document.addEventListener("click", onSearchClearClick, true);

					schedulePaint();
					const listRoot = document.querySelector('[class*="_root"]') || document.getElementById("root") || document.body;
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

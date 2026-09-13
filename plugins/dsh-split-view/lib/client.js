// Split button → second workbench column (own tabs + view), not a "Split" session tab.
// Left keeps the stock window; right mirrors its tab strip and mounts tools via __dshHeroToolRegistry.
window.__ModuleLoader__.load({
	id: "dsh-split-view",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		const PLUGIN = "dsh-split-view";
		const STORAGE_KEY = "dsh-split-view.v1";
		const DEFAULT_RIGHT = "Browser";
		const MIN_RATIO = 0.22;
		const MAX_RATIO = 0.78;

		/** Tab label → registry id (Chat / Trajectory are left-window only). */
		const LABEL_TO_PANEL = {
			Code: "code",
			Git: "git",
			Containers: "containers",
			Terminal: "terminal",
			Browser: "browser",
			Database: "db",
		};

		const lucide = (paths) =>
			React.createElement(
				"span",
				{
					className: "dsh-tab-icon",
					dangerouslySetInnerHTML: {
						__html: `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`,
					},
				},
			);

		const TAB_ICONS = {
			Chat: lucide(`<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>`),
			Code: lucide(`<path d="m18 16 4-4-4-4"/><path d="m6 8-4 4 4 4"/><path d="m14.5 4-5 16"/>`),
			Git: lucide(`<line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/>`),
			Browser: lucide(`<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/>`),
			Containers: lucide(`<path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/>`),
			Terminal: lucide(`<polyline points="4 17 10 11 4 5"/><line x1="12" x2="20" y1="19" y2="19"/>`),
			Database: lucide(`<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/>`),
			Trajectory: lucide(`<circle cx="6" cy="19" r="3"/><path d="M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15"/><circle cx="18" cy="5" r="3"/>`),
		};

		function iconFor(label) {
			if (!label) return TAB_ICONS.Chat;
			if (TAB_ICONS[label]) return TAB_ICONS[label];
			const norm = label.toLowerCase().trim();
			const key = Object.keys(TAB_ICONS).find((k) => {
				const kn = k.toLowerCase().trim();
				return norm.includes(kn) || kn.includes(norm);
			});
			return key ? TAB_ICONS[key] : TAB_ICONS.Chat;
		}

		const splitIcon = () =>
			React.createElement(
				"svg",
				{
					viewBox: "0 0 24 24",
					width: 15,
					height: 15,
					fill: "none",
					stroke: "currentColor",
					strokeWidth: 2,
					strokeLinecap: "round",
					strokeLinejoin: "round",
					"aria-hidden": true,
				},
				React.createElement("rect", { width: 18, height: 18, x: 3, y: 3, rx: 2 }),
				React.createElement("path", { d: "M12 3v18" }),
			);

		const css = `
/* Hide legacy Split tab if an older build registered it */
.wSkVaW_tab[data-dsh-tab-label="Split"]{display:none!important}

.wSkVaW_root[data-dsh-split="1"] .wSkVaW_scrollBody{
  display:grid!important;
  grid-template-columns:minmax(0,var(--dsh-split-left,50%)) 11px minmax(0,1fr);
  grid-template-rows:minmax(0,1fr) auto;
  overflow:hidden!important;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_viewArea,
.wSkVaW_root[data-dsh-split="1"] [data-slot="conversation.session"]{
  grid-column:1;
  grid-row:1;
  min-width:0;min-height:0;overflow:hidden!important;
  height:auto!important;flex:unset!important;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_viewArea{
  flex:1 1 0!important;min-height:0!important;height:100%!important;
  min-width:0!important;max-width:100%!important;width:auto!important;
}
/* Chat (and other left views) must shrink inside the split cell — follow polish chat width */
.wSkVaW_root[data-dsh-split="1"]{
  --dsh-chat-content-width:min(920px,100%);
  --dsh-composer-card-max-width:min(calc(var(--dsh-chat-content-width) + 32px),100%);
  --dsh-composer-side-clearance:8px;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_viewArea>div,
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_root{
  height:100%!important;
  min-height:0!important;
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box;
  display:flex!important;
  flex-direction:column!important;
  overflow:hidden!important;
}
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_scroll{
  flex:1 1 0!important;
  min-height:0!important;
  min-width:0!important;
  max-width:100%!important;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  box-sizing:border-box;
}
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_column{
  max-width:100%!important;
  width:100%!important;
  min-width:0!important;
  box-sizing:border-box;
}
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_flowItem,
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_callRow{
  min-width:0!important;
  max-width:100%!important;
}
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_scroll .Sxvs8a_root,
.wSkVaW_root[data-dsh-split="1"] .Md3f7G_scroll .Sxvs8a_body{
  min-width:0!important;
  max-width:100%!important;
  overflow-wrap:anywhere;
  word-break:break-word;
}
.wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost{
  grid-column:2;grid-row:1 / span 2;
  cursor:col-resize;
  position:relative;
  touch-action:none;
  z-index:30;
  user-select:none;
  background:transparent;
}
/* Fat invisible hit target (~17px) around the 1px visual line */
.wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost:after{
  content:"";
  position:absolute;
  inset:0 -4px;
  z-index:1;
}
.wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost:before{
  content:"";
  position:absolute;
  top:0;bottom:0;left:50%;
  width:1px;
  transform:translateX(-50%);
  background:var(--dsw-alias-border-l2);
  z-index:0;
  pointer-events:none;
}
.wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost:hover:before,
.wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost.dsplit_dragging:before{
  width:3px;
  background:var(--dsw-alias-state-business-primary);
}
.wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost.dsplit_dragging{
  cursor:col-resize;
}
.wSkVaW_root[data-dsh-split="1"].dsplit_isDragging,
.wSkVaW_root[data-dsh-split="1"].dsplit_isDragging *{
  cursor:col-resize!important;
  user-select:none!important;
}
.wSkVaW_root[data-dsh-split="1"].dsplit_isDragging iframe{
  pointer-events:none!important;
}
.wSkVaW_root[data-dsh-split="1"] .dsplit_rightHost{
  grid-column:3;grid-row:1 / span 2;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;
  border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);
}

/*
 * Hero: left tools live in .dsh-hero-tool-host (scrollBody is hidden on non-Chat).
 * Split must be a root-level grid — not inside the hidden scrollBody.
 */
.wSkVaW_root[data-phase=hero][data-dsh-split="1"]{
  display:grid!important;
  grid-template-columns:minmax(0,var(--dsh-split-left,50%)) 11px minmax(0,1fr);
  grid-template-rows:auto minmax(0,1fr);
  min-height:0;
  height:100%;
  overflow:hidden!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] .dsh-hero-header,
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] [data-dsh-hero-header-host],
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > .dsh-hero-header{
  grid-column:1 / -1!important;
  grid-row:1!important;
  min-width:0;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > [data-dsh-hero-header-host]:not(header){
  display:contents!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > .dsh-hero-tool-host,
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > .wSkVaW_scrollBody{
  grid-column:1;
  grid-row:2;
  min-width:0!important;
  min-height:0!important;
  overflow:hidden!important;
  height:auto!important;
  max-height:none!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > .wSkVaW_scrollBody{
  display:flex!important;
  flex-direction:column!important;
  grid-template-columns:none!important;
  grid-template-rows:none!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"][data-dsh-tool-tab="1"] > .wSkVaW_scrollBody{
  display:none!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"][data-dsh-tool-tab="1"] > .dsh-hero-tool-host{
  display:flex!important;
  flex-direction:column!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"]:not([data-dsh-tool-tab="1"]) > .dsh-hero-tool-host{
  display:none!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > .dsplit_dividerHost{
  grid-column:2;
  grid-row:2;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] > .dsplit_rightHost{
  grid-column:3;
  grid-row:2;
  border-left:1px solid var(--dsw-alias-border-l2);
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] .wSkVaW_scrollBody > .dsplit_dividerHost,
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] .wSkVaW_scrollBody > .dsplit_rightHost{
  display:none!important;
}
.wSkVaW_root[data-phase=hero][data-dsh-split="1"] .wSkVaW_composerSeat{
  grid-column:unset;
  grid-row:unset;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_composerSeat{
  grid-column:1;grid-row:2;
  min-width:0;max-width:100%;
  width:100%;
  box-sizing:border-box;
  z-index:5;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_composerSeat .wSkVaW_composerStack,
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_composerSeat [data-composer-card],
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_composerSeat .uV2eYG_root,
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_composerSeat .uV2eYG_card{
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box;
}
/* Session + hero headers share the same split chrome */
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden){
  display:grid!important;
  grid-template-columns:minmax(0,var(--dsh-split-left,50%)) 11px minmax(0,1fr);
  grid-template-rows:auto auto;
  align-items:end;
  overflow:hidden;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_titleRow{
  grid-column:1 / -1;
  grid-row:1;
  align-self:center;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_tabs{
  grid-column:1;
  grid-row:2;
  max-width:100%!important;
  width:100%!important;
  min-width:0!important;
  box-sizing:border-box;
  margin-top:4px;
  padding-left:4px!important;
  padding-right:4px!important;
  gap:4px!important;
  overflow-x:auto!important;
  overflow-y:hidden!important;
  flex-wrap:nowrap!important;
  scrollbar-width:none;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_tabs::-webkit-scrollbar{display:none;height:0}
/* Dual mode: icon-only on the stock (left) tab strip — override session-tabs 104px desktop widths */
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_tabs .wSkVaW_tab.dsh-tab-enhanced{
  flex:0 0 auto!important;
  gap:0!important;
  width:40px!important;
  min-width:40px!important;
  max-width:40px!important;
  justify-content:center!important;
  padding:4px 0 11px!important;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_tabs .wSkVaW_tab .dsh-tab-label{display:none!important}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_tabs .wSkVaW_tab .dsh-tab-icon svg{width:16px!important;height:16px!important;opacity:1}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .dsplit_headerGap{
  grid-column:2;
  grid-row:2;
  align-self:stretch;
  min-width:0;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .dsplit_rightTabsAnchor{
  grid-column:3;
  grid-row:2;
  position:static;
  display:flex;
  align-items:flex-end;
  min-width:0;
  max-width:100%;
  overflow:hidden;
  padding:0;
  pointer-events:auto;
  z-index:2;
}
.wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .dsplit_rightTabsAnchor>*{width:100%;min-width:0;max-width:100%}

.dsplit_rightFrame{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;overflow:hidden}
.dsplit_rightTabs{
  display:flex;gap:4px;flex:none;margin:0;
  margin-top:4px;padding:0 4px;
  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;
  box-sizing:border-box;width:100%;min-width:0;max-width:100%;
  flex-wrap:nowrap;
}
.dsplit_rightTabs::-webkit-scrollbar{display:none;height:0}
.dsplit_rtab{
  color:var(--dsw-alias-label-tertiary);cursor:pointer;background:0 0;border:none;
  padding:4px 0 11px;font-size:13px;font-weight:500;line-height:16px;position:relative;
  flex:0 0 auto;width:40px;min-width:40px;max-width:40px;
  display:inline-flex;align-items:center;justify-content:center;gap:0;white-space:nowrap;
  box-sizing:border-box;
}
.dsplit_rtab:after{
  content:"";background:0 0;border-radius:2px;height:2px;position:absolute;bottom:1px;left:0;right:0;
}
.dsplit_rtabActive{color:var(--dsw-alias-state-business-primary)}
.dsplit_rtabActive:after{background:var(--dsw-alias-state-business-primary)}
.dsplit_rtab .dsh-tab-icon{display:inline-flex;line-height:0}
.dsplit_rtab .dsh-tab-icon svg{display:block;width:16px;height:16px}
.dsplit_rtab .dsh-tab-label{display:none!important}
.dsplit_rightBody{flex:1 1 0;min-height:0;min-width:0;overflow:hidden;display:flex;flex-direction:column}
.dsplit_rightBody>*{
  flex:1 1 0;min-height:0;height:100%;
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
  touch-action:pan-y;
}
.dsplit_rightBody .db_root,
.dsplit_rightBody .dc_root,
.dsplit_rightBody .dd_root,
.dsplit_rightBody .dte_root,
.dsplit_rightBody .dt_root,
.dsplit_rightBody .dsh-code-tab-root,
.dsplit_rightBody .dg_root{height:100%;min-height:0;max-height:100%}
.dsplit_empty{
  display:flex;align-items:center;justify-content:center;height:100%;padding:28px;
  color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;text-align:center;
}
.fex-ibtn.dsplit-toggle{
  display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;padding:0;
  border:1px solid transparent;border-radius:7px;background:transparent;
  color:var(--dsw-alias-label-secondary);cursor:pointer;
}
.fex-ibtn.dsplit-toggle:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.fex-ibtn.dsplit-toggle.active{
  color:var(--dsw-alias-brand-primary);border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
}
/* Split is desktop-only — hide toggle and tear down chrome on narrow viewports */
@media (max-width:900px){
  .fex-ibtn.dsplit-toggle{display:none!important}
}
@media (max-width:900px){
  .wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden){
    display:flex!important;flex-direction:column;overflow:visible;
  }
  .wSkVaW_root[data-dsh-split="1"] .wSkVaW_header:not(.wSkVaW_headerHidden) .wSkVaW_tabs{max-width:100%;width:100%}
  .wSkVaW_root[data-dsh-split="1"] .dsplit_rightTabsAnchor,
  .wSkVaW_root[data-dsh-split="1"] .dsplit_headerGap{display:none!important}
  .wSkVaW_root[data-dsh-split="1"] .wSkVaW_scrollBody{
    grid-template-columns:minmax(0,1fr)!important;
    /* chat scroll | composer | divider | tool pane */
    grid-template-rows:minmax(0,var(--dsh-split-top,42%)) auto 11px minmax(0,1fr);
    width:100%;
    max-width:100%;
    min-width:0;
    min-height:0!important;
    height:100%!important;
  }
  .wSkVaW_root[data-dsh-split="1"] .wSkVaW_viewArea,
  .wSkVaW_root[data-dsh-split="1"] [data-slot="conversation.session"]{
    grid-column:1;grid-row:1;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:0!important;
    max-height:100%!important;
    overflow:hidden!important;
    overscroll-behavior:contain;
  }
  .wSkVaW_root[data-dsh-split="1"] .wSkVaW_composerSeat{
    grid-column:1;grid-row:2;
    min-width:0;max-width:100%;
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost{
    grid-column:1;grid-row:3;height:11px;width:auto;cursor:row-resize;
    touch-action:none;
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost:after{
    inset:-6px 0;
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost:before{
    top:50%;bottom:auto;left:0;right:0;width:auto;height:1px;
    transform:translateY(-50%);
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost:hover:before,
  .wSkVaW_root[data-dsh-split="1"] .dsplit_dividerHost.dsplit_dragging:before{
    width:auto;height:3px;
  }
  .wSkVaW_root[data-dsh-split="1"].dsplit_isDragging,
  .wSkVaW_root[data-dsh-split="1"].dsplit_isDragging *{
    cursor:row-resize!important;
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_rightHost{
    grid-column:1;grid-row:4;border-left:none;border-top:1px solid var(--dsw-alias-border-l2);
    width:100%!important;max-width:100%!important;min-width:0!important;
    min-height:0!important;max-height:100%!important;
    overflow:hidden!important;
    overscroll-behavior:contain;
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_rightFrame,
  .wSkVaW_root[data-dsh-split="1"] .dsplit_rightBody{
    min-height:0!important;
    max-height:100%!important;
  }
  .wSkVaW_root[data-dsh-split="1"] .dsplit_rightBody>*{
    overflow-y:auto!important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
    touch-action:pan-y;
  }
  .wSkVaW_root[data-dsh-split="1"]{
    --dsh-composer-side-clearance:8px;
    --dsh-chat-content-width:100%;
    --dsh-composer-card-max-width:100%;
  }
  .wSkVaW_root[data-dsh-split="1"] .Md3f7G_scroll{
    padding-left:12px!important;
    padding-right:12px!important;
    overscroll-behavior:contain;
    touch-action:pan-y;
    -webkit-overflow-scrolling:touch;
  }
  .dsplit_rightTabs.dsplit_tabsInBody{
    display:flex;border-bottom:1px solid var(--dsw-alias-border-l2);padding:4px 4px 0;
    flex:none;
  }
}
@media (min-width:901px){
  /* Desktop: right tools tabs live in the header anchor (session + hero) */
  .dsplit_rightTabs.dsplit_tabsInBody{display:none!important}
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let tag = document.getElementById("dsh-split-view-css");
			if (!tag) {
				tag = document.createElement("style");
				tag.id = "dsh-split-view-css";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}

		function loadState() {
			try {
				const raw = localStorage.getItem(STORAGE_KEY);
				if (!raw) return null;
				const parsed = JSON.parse(raw);
				return parsed && typeof parsed === "object" ? parsed : null;
			} catch {
				return null;
			}
		}

		function saveState(partial) {
			try {
				const prev = loadState() || {};
				localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...prev, ...partial }));
			} catch {
				/* ignore */
			}
		}

		function sessionRoot() {
			return document.querySelector(".wSkVaW_root[data-phase]") || document.querySelector(".wSkVaW_root");
		}

		function isHeroPhase(root = sessionRoot()) {
			return root?.getAttribute("data-phase") === "hero";
		}

		/** Real title/tabs header — session or our hero chrome (never the empty stock-hidden shell). */
		function findSessionHeader(root) {
			if (!root) return null;
			const hero = root.querySelector(".dsh-hero-header");
			if (hero) return hero;
			return (
				[...root.querySelectorAll(":scope > .wSkVaW_header")].find(
					(h) => !h.classList.contains("wSkVaW_headerHidden"),
				) || null
			);
		}

		function readStockTabs() {
			const root = sessionRoot();
			if (!root) return [];
			const tabs = root.querySelectorAll('.wSkVaW_tabs [role="tab"]');
			const out = [];
			const seen = new Set();
			tabs.forEach((tab) => {
				const label = (tab.getAttribute("data-dsh-tab-label") || tab.getAttribute("aria-label") || tab.textContent || "").trim();
				if (!label || label === "Split" || seen.has(label)) return;
				seen.add(label);
				out.push(label);
			});
			return out.length
				? out
				: ["Chat", "Code", "Git", "Containers", "Terminal", "Browser", "Database", "Trajectory"];
		}

		function isStackedSplit() {
			try {
				return window.matchMedia("(max-width: 900px)").matches;
			} catch {
				return false;
			}
		}

		/** Desktop-only feature gate (same breakpoint as stacked layout). */
		function isSplitDesktop() {
			return !isStackedSplit();
		}

		function applyRatio(ratio) {
			const root = sessionRoot();
			if (!root) return;
			const left = Math.min(MAX_RATIO, Math.max(MIN_RATIO, ratio));
			const pct = `${(left * 100).toFixed(2)}%`;
			// Desktop: left column width. Mobile stacked: top pane height.
			root.style.setProperty("--dsh-split-left", pct);
			root.style.setProperty("--dsh-split-top", pct);
			root.style.removeProperty("--dsh-split-right");
		}

		function ensureHosts() {
			const root = sessionRoot();
			if (!root) return null;
			const scrollBody =
				root.querySelector(":scope > .wSkVaW_scrollBody") || root.querySelector(".wSkVaW_scrollBody");
			if (!scrollBody) return null;
			const hero = isHeroPhase(root);
			const header = findSessionHeader(root);
			const toolHost = root.querySelector(":scope > .dsh-hero-tool-host");
			/** Session: hosts live inside scrollBody. Hero: siblings of tool-host/scrollBody on root. */
			const mountParent = hero ? root : scrollBody;

			let divider =
				(hero && root.querySelector(":scope > .dsplit_dividerHost"))
				|| scrollBody.querySelector(":scope > .dsplit_dividerHost")
				|| root.querySelector(".dsplit_dividerHost");
			if (!divider) {
				divider = document.createElement("div");
				divider.className = "dsplit_dividerHost";
				divider.setAttribute("role", "separator");
				divider.setAttribute("aria-orientation", "vertical");
			}

			let rightHost =
				(hero && root.querySelector(":scope > .dsplit_rightHost"))
				|| scrollBody.querySelector(":scope > .dsplit_rightHost")
				|| root.querySelector(".dsplit_rightHost");
			if (!rightHost) {
				rightHost = document.createElement("div");
				rightHost.className = "dsplit_rightHost";
			}

			if (hero) {
				// Pull hosts out of the (often hidden) scrollBody onto the root.
				const anchor = scrollBody.nextSibling;
				if (divider.parentElement !== root || rightHost.parentElement !== root) {
					root.insertBefore(divider, anchor);
					root.insertBefore(rightHost, divider.nextSibling);
				}
				// Order: header(s), toolHost, scrollBody, divider, rightHost
				if (toolHost && toolHost.nextSibling !== scrollBody) {
					root.insertBefore(toolHost, scrollBody);
				}
				if (scrollBody.nextSibling !== divider) {
					root.insertBefore(divider, scrollBody.nextSibling);
				}
				if (divider.nextSibling !== rightHost) {
					root.insertBefore(rightHost, divider.nextSibling);
				}
			} else {
				const composer = scrollBody.querySelector(".wSkVaW_composerSeat");
				if (divider.parentElement !== scrollBody) {
					if (composer) scrollBody.insertBefore(divider, composer);
					else scrollBody.appendChild(divider);
				}
				if (rightHost.parentElement !== scrollBody) {
					if (composer) scrollBody.insertBefore(rightHost, composer);
					else scrollBody.appendChild(rightHost);
				} else if (composer && rightHost.nextSibling !== composer) {
					scrollBody.insertBefore(rightHost, composer);
				}
				if (divider.nextSibling !== rightHost) {
					scrollBody.insertBefore(divider, rightHost);
				}
			}

			// No usable header (or still empty stock shell) — tabs stay in the right pane body.
			if (!header) {
				root.querySelectorAll(".dsplit_rightTabsAnchor, .dsplit_headerGap").forEach((el) => el.remove());
				return {
					root,
					scrollBody,
					toolHost,
					mountParent,
					divider,
					rightHost,
					tabsAnchor: null,
					headerGap: null,
					header: null,
					hero,
				};
			}

			let headerGap = header.querySelector(":scope > .dsplit_headerGap");
			if (!headerGap) {
				headerGap = document.createElement("div");
				headerGap.className = "dsplit_headerGap";
				headerGap.setAttribute("aria-hidden", "true");
			}

			let tabsAnchor = header.querySelector(":scope > .dsplit_rightTabsAnchor");
			if (!tabsAnchor) {
				tabsAnchor = document.createElement("div");
				tabsAnchor.className = "dsplit_rightTabsAnchor";
			}

			// Order: titleRow (existing), tabs (existing), gap, right tabs
			const stockTabs = header.querySelector(".wSkVaW_tabs");
			if (headerGap.parentElement !== header) {
				if (stockTabs?.nextSibling) header.insertBefore(headerGap, stockTabs.nextSibling);
				else header.appendChild(headerGap);
			}
			if (tabsAnchor.parentElement !== header) {
				header.insertBefore(tabsAnchor, headerGap.nextSibling);
			} else if (tabsAnchor.previousSibling !== headerGap) {
				header.insertBefore(tabsAnchor, headerGap.nextSibling);
			}

			return { root, scrollBody, toolHost, mountParent, divider, rightHost, tabsAnchor, headerGap, header, hero };
		}

		function clearHosts(root) {
			root?.querySelectorAll(".dsplit_dividerHost, .dsplit_rightHost, .dsplit_rightTabsAnchor, .dsplit_headerGap").forEach((el) => el.remove());
			root?.style.removeProperty("--dsh-split-left");
			root?.style.removeProperty("--dsh-split-top");
			root?.style.removeProperty("--dsh-split-right");
			root?.classList.remove("dsplit_isDragging");
		}

		function resolveSessionId() {
			try {
				const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
				return parsed?.sessionId || null;
			} catch {
				return null;
			}
		}

		function RightTabList({ activeLabel, onSelect, inBody }) {
			const [, bump] = React.useState(0);
			const labels = readStockTabs();

			React.useEffect(() => {
				const t = window.setTimeout(() => bump((n) => n + 1), 200);
				const obs = new MutationObserver(() => bump((n) => n + 1));
				const root = sessionRoot();
				if (root) {
					obs.observe(root, {
						subtree: true,
						childList: true,
						attributes: true,
						attributeFilter: ["data-dsh-tab-label", "aria-selected"],
					});
				}
				return () => {
					window.clearTimeout(t);
					obs.disconnect();
				};
			}, []);

			return React.createElement(
				"div",
				{
					className: "dsplit_rightTabs" + (inBody ? " dsplit_tabsInBody" : ""),
					role: "tablist",
					"aria-label": "Right window",
				},
				labels.map((label) =>
					React.createElement(
						"button",
						{
							key: label,
							type: "button",
							role: "tab",
							className: "dsplit_rtab" + (label === activeLabel ? " dsplit_rtabActive" : ""),
							"aria-selected": label === activeLabel,
							"aria-label": label,
							title: label,
							onClick: () => onSelect(label),
						},
						iconFor(label),
						React.createElement("span", { className: "dsh-tab-label" }, label),
					),
				),
			);
		}

		function RightPane({ activeLabel, onSelect, sessionId }) {
			const panelId = LABEL_TO_PANEL[activeLabel];
			const factory = panelId ? window.__dshHeroToolRegistry?.get(panelId) : null;

			let body;
			if (panelId && factory) {
				try {
					body = factory({ sessionId: sessionId || resolveSessionId() });
				} catch (err) {
					body = React.createElement(
						"div",
						{ className: "dsplit_empty" },
						err instanceof Error ? err.message : String(err),
					);
				}
			} else if (activeLabel === "Chat" || activeLabel === "Trajectory") {
				body = React.createElement(
					"div",
					{ className: "dsplit_empty" },
					`${activeLabel} stays in the left window — pick Code, Browser, Database, or another tool here.`,
				);
			} else {
				body = React.createElement(
					"div",
					{ className: "dsplit_empty" },
					`“${activeLabel}” isn’t available in the split pane yet.`,
				);
			}

			return React.createElement(
				"div",
				{ className: "dsplit_rightFrame" },
				React.createElement(RightTabList, {
					activeLabel,
					onSelect,
					inBody: true,
				}),
				React.createElement("div", { className: "dsplit_rightBody" }, body),
			);
		}

		function SplitChrome({ enabled, ratio, rightLabel, sessionId, onRatio, onRightLabel }) {
			const [hosts, setHosts] = React.useState(null);
			const dragging = React.useRef(false);
			const liveRatio = React.useRef(ratio);
			liveRatio.current = ratio;

			// Mount / unmount hosts — do NOT depend on ratio (that remounted listeners mid-drag).
			React.useEffect(() => {
				ensureStyles();
				const root = sessionRoot();
				if (!root) return;
				if (!enabled) {
					root.removeAttribute("data-dsh-split");
					clearHosts(root);
					setHosts(null);
					return;
				}
				root.setAttribute("data-dsh-split", "1");
				applyRatio(liveRatio.current);
				const next = ensureHosts();
				setHosts(next);

				const obs = new MutationObserver(() => {
					if (!sessionRoot()?.hasAttribute("data-dsh-split")) return;
					if (dragging.current) return;
					const h = ensureHosts();
					setHosts((prev) =>
						prev?.rightHost === h?.rightHost && prev?.tabsAnchor === h?.tabsAnchor && prev?.divider === h?.divider
							? prev
							: h,
					);
				});
				obs.observe(root, { childList: true, subtree: true });
				return () => {
					obs.disconnect();
				};
			}, [enabled]);

			// Keep CSS vars in sync when ratio changes from outside drag (restore / toggle).
			React.useEffect(() => {
				if (!enabled || dragging.current) return;
				applyRatio(ratio);
			}, [enabled, ratio]);

			React.useEffect(() => {
				if (!enabled || !hosts?.divider) return;
				const el = hosts.divider;
				const body = hosts.scrollBody;
				const root = hosts.root;
				const hero = !!hosts.hero;

				const trackRect = () => {
					if (!hero) return body?.getBoundingClientRect() || null;
					const tool = hosts.toolHost || root?.querySelector(":scope > .dsh-hero-tool-host");
					const toolVisible = tool && window.getComputedStyle(tool).display !== "none";
					const leftPane = toolVisible ? tool : body;
					const right = hosts.rightHost;
					if (!leftPane || !right) return null;
					const l = leftPane.getBoundingClientRect();
					const r = right.getBoundingClientRect();
					return {
						left: l.left,
						top: l.top,
						width: Math.max(0, r.right - l.left),
						height: Math.max(l.height, r.height),
					};
				};

				const onDown = (e) => {
					if (e.button !== undefined && e.button !== 0) return;
					e.preventDefault();
					e.stopPropagation();
					dragging.current = true;
					el.classList.add("dsplit_dragging");
					root?.classList.add("dsplit_isDragging");
					try {
						el.setPointerCapture(e.pointerId);
					} catch {
						/* older browsers */
					}
				};

				const onMove = (e) => {
					if (!dragging.current) return;
					const rect = trackRect();
					if (!rect) return;
					let next;
					if (isStackedSplit()) {
						if (rect.height <= 0) return;
						const composer = body?.querySelector(":scope > .wSkVaW_composerSeat");
						const composerH = composer?.getBoundingClientRect().height || 0;
						const y = e.clientY - rect.top;
						const chatBlock = Math.max(0, y - 5);
						const viewH = Math.max(0, chatBlock - composerH);
						next = Math.min(MAX_RATIO, Math.max(MIN_RATIO, viewH / rect.height));
					} else {
						if (rect.width <= 0) return;
						const usable = Math.max(1, rect.width - 11);
						const x = e.clientX - rect.left;
						next = Math.min(MAX_RATIO, Math.max(MIN_RATIO, x / usable));
					}
					liveRatio.current = next;
					applyRatio(next);
				};

				const onUp = (e) => {
					if (!dragging.current) return;
					dragging.current = false;
					el.classList.remove("dsplit_dragging");
					root?.classList.remove("dsplit_isDragging");
					try {
						if (e?.pointerId != null) el.releasePointerCapture(e.pointerId);
					} catch {
						/* ignore */
					}
					onRatio(liveRatio.current);
				};

				el.addEventListener("pointerdown", onDown);
				el.addEventListener("pointermove", onMove);
				el.addEventListener("pointerup", onUp);
				el.addEventListener("pointercancel", onUp);
				return () => {
					el.removeEventListener("pointerdown", onDown);
					el.removeEventListener("pointermove", onMove);
					el.removeEventListener("pointerup", onUp);
					el.removeEventListener("pointercancel", onUp);
					root?.classList.remove("dsplit_isDragging");
				};
			}, [enabled, hosts, onRatio]);

			if (!enabled || !hosts?.rightHost || !ReactDOM?.createPortal) return null;

			const tabs = React.createElement(RightTabList, {
				activeLabel: rightLabel,
				onSelect: onRightLabel,
				inBody: false,
			});
			const bodyWithTabs = React.createElement(RightPane, {
				activeLabel: rightLabel,
				onSelect: onRightLabel,
				sessionId,
			});

			return React.createElement(
				React.Fragment,
				null,
				hosts.tabsAnchor ? ReactDOM.createPortal(tabs, hosts.tabsAnchor) : null,
				ReactDOM.createPortal(bodyWithTabs, hosts.rightHost),
			);
		}

		function isSidebarCollapsed() {
			return !!document.querySelector(".pI_x6G_frame[data-sidebar-collapsed]");
		}

		function clickSidebarToggle() {
			const btn =
				document.querySelector("button.hHd-Xa_toggle") ||
				document.querySelector(".hHd-Xa_toggle");
			if (btn instanceof HTMLElement) {
				btn.click();
				return true;
			}
			return false;
		}

		/** Collapse via ctx.layout; DOM click is the hard fallback. */
		function collapseSidebar(getLayout) {
			if (isSidebarCollapsed()) return false;
			try {
				const layout = typeof getLayout === "function" ? getLayout() : getLayout;
				if (layout && typeof layout.toggleSidebar === "function") {
					layout.toggleSidebar();
					return true;
				}
			} catch {
				/* panels not wired yet — fall through */
			}
			return clickSidebarToggle();
		}

		function expandSidebar(getLayout) {
			if (!isSidebarCollapsed()) return false;
			try {
				const layout = typeof getLayout === "function" ? getLayout() : getLayout;
				if (layout && typeof layout.toggleSidebar === "function") {
					layout.toggleSidebar();
					return true;
				}
			} catch {
				/* fall through */
			}
			return clickSidebarToggle();
		}

		function SplitToggle({ sessionId, getLayout }) {
			const saved = loadState() || {};
			const [desktop, setDesktop] = React.useState(() => isSplitDesktop());
			const [enabled, setEnabled] = React.useState(() => saved.enabled === true);
			const [ratio, setRatio] = React.useState(() =>
				typeof saved.ratio === "number" ? saved.ratio : 0.5,
			);
			const [rightLabel, setRightLabel] = React.useState(() =>
				typeof saved.rightLabel === "string" ? saved.rightLabel : DEFAULT_RIGHT,
			);
			const collapsedForSplit = React.useRef(false);
			const didInitCollapse = React.useRef(false);
			const active = enabled && desktop;

			React.useEffect(() => {
				ensureStyles();
			}, []);

			// Desktop-only: hide/disable chrome under 900px; keep preference for when wide again.
			React.useEffect(() => {
				let mq;
				try {
					mq = window.matchMedia("(max-width: 900px)");
				} catch {
					return undefined;
				}
				const sync = () => {
					const wide = !mq.matches;
					setDesktop(wide);
					if (!wide && collapsedForSplit.current) {
						expandSidebar(getLayout);
						collapsedForSplit.current = false;
					}
				};
				sync();
				if (typeof mq.addEventListener === "function") mq.addEventListener("change", sync);
				else if (typeof mq.addListener === "function") mq.addListener(sync);
				return () => {
					if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", sync);
					else if (typeof mq.removeListener === "function") mq.removeListener(sync);
				};
			}, [getLayout]);

			// Restore-from-storage: if split was already on (desktop), collapse sidebar once.
			React.useEffect(() => {
				if (didInitCollapse.current) return;
				didInitCollapse.current = true;
				if (!active) return;
				const id = requestAnimationFrame(() => {
					if (collapseSidebar(getLayout)) collapsedForSplit.current = true;
				});
				return () => cancelAnimationFrame(id);
			}, [active, getLayout]);

			React.useEffect(() => {
				saveState({ enabled, ratio, rightLabel });
				if (active) applyRatio(ratio);
			}, [enabled, active, ratio, rightLabel]);

			const setSplitEnabled = (next) => {
				if (!isSplitDesktop()) return;
				if (next) {
					collapsedForSplit.current = collapseSidebar(getLayout);
				} else if (collapsedForSplit.current) {
					expandSidebar(getLayout);
					collapsedForSplit.current = false;
				}
				setEnabled(next);
			};

			return React.createElement(
				React.Fragment,
				null,
				desktop && React.createElement(
					"button",
					{
						className: "fex-ibtn dsplit-toggle" + (active ? " active" : ""),
						type: "button",
						title: active ? "Close split window" : "Open split window",
						onClick: () => setSplitEnabled(!active),
					},
					splitIcon(),
				),
				React.createElement(SplitChrome, {
					enabled: active,
					ratio,
					rightLabel,
					sessionId,
					onRatio: setRatio,
					onRightLabel: setRightLabel,
				}),
			);
		}

		const inject = ["slots", "layout"];

		function useIsHero() {
			const [hero, setHero] = React.useState(() => !!document.querySelector(".wSkVaW_root[data-phase=hero]"));
			React.useEffect(() => {
				const check = () => setHero(!!document.querySelector(".wSkVaW_root[data-phase=hero]"));
				check();
				const root = document.getElementById("root") || document.body;
				const mo = new MutationObserver(check);
				mo.observe(root, { attributes: true, subtree: true, attributeFilter: ["data-phase"] });
				return () => mo.disconnect();
			}, []);
			return hero;
		}

		function useHeroHeaderActions(enabled) {
			const [host, setHost] = React.useState(null);
			React.useEffect(() => {
				if (!enabled) {
					setHost(null);
					return undefined;
				}
				let raf = 0;
				const sync = () => {
					cancelAnimationFrame(raf);
					raf = requestAnimationFrame(() => {
						const el = document.querySelector("[data-dsh-hero-header-actions]");
						setHost((prev) => (prev === el ? prev : el));
					});
				};
				sync();
				const root = document.getElementById("root") || document.body;
				const mo = new MutationObserver(sync);
				mo.observe(root, { childList: true, subtree: true });
				return () => {
					cancelAnimationFrame(raf);
					mo.disconnect();
				};
			}, [enabled]);
			return host;
		}

		function HeroSplitToggle({ getLayout }) {
			const hero = useIsHero();
			const actions = useHeroHeaderActions(hero);
			const saved = loadState() || {};
			const [desktop, setDesktop] = React.useState(() => isSplitDesktop());
			// Hero should not revive a previous session split — start closed.
			const [enabled, setEnabled] = React.useState(false);
			const [ratio, setRatio] = React.useState(() =>
				typeof saved.ratio === "number" ? saved.ratio : 0.5,
			);
			const [rightLabel, setRightLabel] = React.useState(() => {
				const label = typeof saved.rightLabel === "string" ? saved.rightLabel : DEFAULT_RIGHT;
				return label === "Chat" || label === "Trajectory" ? DEFAULT_RIGHT : label;
			});
			const activeRef = React.useRef(false);
			const lastToggleAt = React.useRef(0);
			const active = enabled && desktop;
			activeRef.current = active;

			React.useEffect(() => { ensureStyles(); }, []);

			React.useEffect(() => {
				let mq;
				try {
					mq = window.matchMedia("(max-width: 900px)");
				} catch {
					return undefined;
				}
				const sync = () => setDesktop(!mq.matches);
				sync();
				if (typeof mq.addEventListener === "function") mq.addEventListener("change", sync);
				else if (typeof mq.addListener === "function") mq.addListener(sync);
				return () => {
					if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", sync);
					else if (typeof mq.removeListener === "function") mq.removeListener(sync);
				};
			}, []);

			React.useEffect(() => {
				// Keep ratio/label; do not revive session split preference from hero.
				// Never touch sidebar on hero — layout already treats hero specially.
				saveState({ ratio, rightLabel });
				if (active) applyRatio(ratio);
			}, [enabled, active, ratio, rightLabel]);

			React.useEffect(() => {
				if (!hero && enabled) setEnabled(false);
			}, [hero, enabled]);

			if (!hero) return null;

			const setSplitEnabled = (next) => {
				if (!isSplitDesktop()) return;
				if (next && (rightLabel === "Chat" || rightLabel === "Trajectory")) {
					setRightLabel(DEFAULT_RIGHT);
				}
				setEnabled(next);
				saveState({ enabled: next });
			};

			const onToggle = (e) => {
				if (e?.button != null && e.button !== 0) return;
				e?.preventDefault?.();
				e?.stopPropagation?.();
				const now = Date.now();
				if (now - lastToggleAt.current < 350) return;
				lastToggleAt.current = now;
				setSplitEnabled(!activeRef.current);
			};

			const btn = desktop && React.createElement(
				"button",
				{
					className: "fex-ibtn dsplit-toggle" + (active ? " active" : ""),
					type: "button",
					title: active ? "Close split window" : "Open split window",
					"aria-label": active ? "Close split window" : "Open split window",
					onClick: onToggle,
				},
				splitIcon(),
			);

			const portalBtn = btn && actions && ReactDOM?.createPortal
				? ReactDOM.createPortal(btn, actions)
				: null;

			return React.createElement(
				React.Fragment,
				null,
				portalBtn,
				React.createElement(SplitChrome, {
					enabled: active,
					ratio,
					rightLabel,
					sessionId: null,
					onRatio: setRatio,
					onRightLabel: setRightLabel,
				}),
			);
		}

		function apply(ctx) {
			const slots = ctx.slots;
			if (!slots) return;
			const getLayout = () => ctx.layout;
			ensureStyles();

			ctx.effect(
				() =>
					slots.inject("conversation.session.header.actions", () =>
						slots.register(
							{
								name: "conversation.session.header.actions",
								id: "split-toggle",
								order: 14,
								label: "Split",
								inject: (sessionId) => ({ sessionId, getLayout }),
							},
							SplitToggle,
						),
					),
				`${PLUGIN}: header toggle`,
			);

			ctx.effect(
				() =>
					slots.inject("conversation.input.dock", () =>
						slots.register(
							{
								name: "conversation.input.dock",
								id: "split-hero-toggle",
								order: 1,
								inject: () => ({ getLayout }),
							},
							HeroSplitToggle,
						),
					),
				`${PLUGIN}: hero toggle`,
			);
		}

		return { apply, inject };
	},
});

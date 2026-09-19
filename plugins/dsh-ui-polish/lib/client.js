// Cross-cutting chrome polish (mobile layout, tooltips, sidebar brand).
// Feature plugins keep product UI; shared layout/CSS lives here.
window.__ModuleLoader__.load({
	id: "dsh-ui-polish",
	factory: (require) => {
		const PLUGIN = "dsh-ui-polish";
		const STYLE_ID = "dsh-ui-polish-css";
		const React = require("react");

		const PANE_STORAGE_PREFIX = "dsh-pane-resizer:";

		function readPaneRatio(key, fallback) {
			try {
				const raw = localStorage.getItem(`${PANE_STORAGE_PREFIX}${key}`);
				const v = raw === null ? NaN : parseFloat(raw);
				if (Number.isFinite(v) && v >= 0.14 && v <= 0.86) return v;
			} catch {
				/* ignore */
			}
			return fallback;
		}

		function writePaneRatio(key, ratio) {
			try {
				localStorage.setItem(`${PANE_STORAGE_PREFIX}${key}`, String(ratio));
			} catch {
				/* ignore */
			}
		}

		function SplitPane(props) {
			const {
				storageKey,
				defaultRatio = 0.45,
				minFirst = 180,
				minSecond = 200,
				className = "",
				firstClassName = "",
				secondClassName = "",
				children,
			} = props;
			const kids = React.Children.toArray(children);
			const hostRef = React.useRef(null);
			const dragRef = React.useRef(null);
			const [ratio, setRatio] = React.useState(() => readPaneRatio(storageKey, defaultRatio));
			const [dividerDrag, setDividerDrag] = React.useState(false);

			React.useEffect(() => {
				writePaneRatio(storageKey, ratio);
			}, [storageKey, ratio]);

			const onDividerDown = (e) => {
				if (e.button !== 0) return;
				const host = hostRef.current;
				if (!host) return;
				e.preventDefault();
				const rect = host.getBoundingClientRect();
				if (rect.width < minFirst + minSecond + 24) return;
				dragRef.current = { startX: e.clientX, startRatio: ratio, width: rect.width };
				setDividerDrag(true);
				host.classList.add("dsh-pane-splitDragging");
				const onMove = (ev) => {
					const d = dragRef.current;
					if (!d) return;
					const dx = ev.clientX - d.startX;
					let next = d.startRatio + dx / d.width;
					const minR = minFirst / d.width;
					const maxR = 1 - minSecond / d.width;
					next = Math.min(maxR, Math.max(minR, next));
					setRatio(next);
				};
				const onUp = () => {
					dragRef.current = null;
					setDividerDrag(false);
					host.classList.remove("dsh-pane-splitDragging");
					document.removeEventListener("pointermove", onMove);
					document.removeEventListener("pointerup", onUp);
					document.removeEventListener("pointercancel", onUp);
				};
				document.addEventListener("pointermove", onMove);
				document.addEventListener("pointerup", onUp);
				document.addEventListener("pointercancel", onUp);
			};

			return React.createElement(
				"div",
				{
					ref: hostRef,
					className: `dsh-pane-split ${className}`.trim(),
					style: { "--dsh-pane-a": `${(ratio * 100).toFixed(2)}%` },
				},
				React.createElement("div", { className: `dsh-pane-first ${firstClassName}`.trim() }, kids[0]),
				React.createElement("div", {
					className: "dsh-pane-divider" + (dividerDrag ? " dsh-pane-dividerDragging" : ""),
					role: "separator",
					"aria-orientation": "vertical",
					"aria-valuenow": Math.round(ratio * 100),
					tabIndex: 0,
					onPointerDown: onDividerDown,
				}),
				React.createElement("div", { className: `dsh-pane-second ${secondClassName}`.trim() }, kids[1]),
			);
		}

		if (typeof window !== "undefined") {
			window.__dshPaneResizer = { SplitPane, readPaneRatio, writePaneRatio };
		}

		const css = `
/* ---- Draggable column splits inside tool tabs (Containers, Git, …) ---- */
.dsh-pane-split{
  display:flex;flex-direction:row;flex:1 1 0;min-height:0;min-width:0;overflow:hidden;
  --dsh-pane-a:45%;
}
.dsh-pane-split.dsh-pane-splitDragging,
.dsh-pane-split.dsh-pane-splitDragging *{
  cursor:col-resize!important;user-select:none!important;
}
.dsh-pane-first{
  flex:0 0 var(--dsh-pane-a);min-width:0;min-height:0;overflow:hidden;
  display:flex;flex-direction:column;
}
.dsh-pane-second{
  flex:1 1 0;min-width:0;min-height:0;overflow:hidden;
  display:flex;flex-direction:column;
}
.dsh-pane-divider{
  flex:none;width:11px;cursor:col-resize;position:relative;touch-action:none;
  background:transparent;
}
.dsh-pane-divider:after{
  content:"";position:absolute;top:0;bottom:0;left:5px;width:1px;
  background:var(--dsw-alias-border-l2);pointer-events:none;
}
.dsh-pane-divider:before{
  content:"";position:absolute;top:0;bottom:0;left:3px;width:5px;
  background:transparent;transition:background .12s;
}
.dsh-pane-divider:hover:before,
.dsh-pane-divider.dsh-pane-dividerDragging:before{
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#5b9dff) 35%,transparent);
}
@media (max-width:900px){
  .dsh-pane-split{flex-direction:column!important}
  .dsh-pane-first{flex:1 1 0!important;max-height:45vh}
  .dsh-pane-divider{display:none!important}
  .dsh-pane-second{flex:1 1 0!important}
}

/* ---- Chat column: stock is 748px; a bit wider on large screens ---- */
[class*="_root"]{
  --dsh-chat-content-width:min(920px,100%);
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
@media (min-width:1800px){
  [class*="_root"]{
    --dsh-chat-content-width:min(1040px,100%);
  }
}
/*
 * Narrow / mobile: stock keeps chat 32px narrower than the composer card
 * so prose lines up with the input caret — wastes width on a phone or
 * collapsed-rail layout. One shared gutter; column + card same width.
 */
@media (max-width:1200px){
  [class*="_root"]{
    --dsh-composer-side-clearance:8px;
    --dsh-chat-content-width:100%;
    --dsh-composer-card-max-width:100%;
  }
  /* Tool tabs (Git, Code, …): full width — do not apply chat column gutters. */
  [class*="_root"][data-dsh-tool-tab="1"]{
    padding-left:0!important;
    padding-right:0!important;
  }
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_scrollBody"],
  [class*="_root"][data-dsh-tool-tab="1"] .Md3f7G_scroll,
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] > div{
    padding-left:0!important;
    padding-right:0!important;
    max-width:none!important;
  }
  /* CRITICAL: never put chat gutters on plugin tool roots — [class*=_root]
     matches .dg_root / Cron CzXJtG_root / rootInner / picker roots / etc. */
  :is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dt_root,.dsh-code-tab-root){
    padding-left:0!important;
    padding-right:0!important;
    max-width:none!important;
    width:100%!important;
    box-sizing:border-box!important;
  }
  /* Hashed *_root inside tool panes (Cron, pickers, …). Higher specificity
     than the chat gutter rule below so nested roots stay flush. */
  .dsh-tool-surface [class*="_root"],
  .dsh-hero-tool-view [class*="_root"],
  .dsh-hero-tool-host [class*="_root"],
  .dsh-tool-surface [class*="rootInner"],
  .dsh-hero-tool-view [class*="rootInner"]{
    padding-left:0!important;
    padding-right:0!important;
    max-width:none!important;
    box-sizing:border-box!important;
  }
  .Md3f7G_scroll{
    padding-left:var(--dsh-composer-side-clearance)!important;
    padding-right:var(--dsh-composer-side-clearance)!important;
  }
  /*
   * Chat session root ONLY — direct under centerCol. Bare [class*=_root] also
   * matches CSS-module roots like _root_1nxmc_1 (Settings dropdowns) and was
   * forcing width:100%, crushing labels off the left edge.
   */
  [class*="_centerCol"] > div > div > [class*="_root"]:not([data-dsh-tool-tab="1"]){
    box-sizing:border-box!important;
    width:100%!important;
    max-width:100%!important;
    padding-left:var(--dsh-composer-side-clearance)!important;
    padding-right:var(--dsh-composer-side-clearance)!important;
  }
  [class*="_card"],
  [class*="_notice"]{
    max-width:100%!important;
    width:100%!important;
  }
  .FJxK0a_root{
    max-width:100%!important;
    padding-left:var(--dsh-composer-side-clearance)!important;
    padding-right:var(--dsh-composer-side-clearance)!important;
  }

  /* Composer toolbar: keep + / mode / model / send on one row.
     Park the context meter in the card's top-right for space. */
  [class*="_card"]{
    position:relative!important;
  }
  [class*="_card"] .JObwrW_root{
    position:absolute!important;
    top:6px!important;
    right:8px!important;
    z-index:3;
    margin:0!important;
  }
  [class*="_card"] [class*="_input"],
  [class*="_card"] [class*="_mirror"],
  [class*="_card"] [class*="_backdrop"]{
    padding-right:40px!important;
  }
  /* Scope to composer card rows — bare [class*=_row] hits Settings / theme rows. */
  [class*="_card"] [class*="_row"]{
    flex-wrap:nowrap!important;
    gap:6px!important;
    align-items:center!important;
  }
  [class*="_tools"],
  [class*="_modes"]{
    gap:6px!important;
    flex:none!important;
  }
  [class*="_trailing"]{
    flex:1 1 auto!important;
    min-width:0!important;
    gap:6px!important;
    justify-content:flex-end!important;
  }
  [class*="_trailing"] > *:not(.JObwrW_root):not([class*="_primary"]){
    min-width:0!important;
    max-width:min(148px,46vw)!important;
  }
  /* Do NOT use [class*=_select] — it matches themeCube._selected in Settings. */
  [class*="_trailing"] [class*="_select"]{
    max-width:min(148px,46vw)!important;
  }
  .Sh0Q9G_trigger{
    max-width:44px!important;
    padding-left:6px!important;
    padding-right:4px!important;
  }
}

/* ---- Settings sheet (stock is desktop-first) ---- */
@media (max-width:900px){
  .VOzbGW_overlay{
    align-items:stretch !important;
    justify-content:stretch !important;
    padding:0 !important;
  }
  .VOzbGW_panel{
    width:100% !important;
    max-width:100% !important;
    height:100% !important;
    max-height:100% !important;
    border-radius:0 !important;
    margin:0 !important;
    display:flex !important;
    flex-direction:column !important;
    overflow:hidden !important;
  }
  /* Exact .VOzbGW_nav only — class*="VOzbGW_nav" also hit navList (double scrollbars). */
  .VOzbGW_nav{
    flex:none !important;
    width:100% !important;
    max-width:100% !important;
    max-height:min(38vh,280px) !important;
    min-height:0 !important;
    overflow-x:hidden !important;
    overflow-y:auto !important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
    border-right:none !important;
    border-bottom:1px solid var(--dsw-alias-border-l2);
    box-sizing:border-box !important;
  }
  .VOzbGW_navList{
    overflow:visible !important;
    width:100% !important;
    max-width:100% !important;
  }
  .VOzbGW_navCell{
    max-width:100% !important;
    box-sizing:border-box !important;
  }
  .VOzbGW_content{
    flex:1 1 0 !important;
    min-height:0 !important;
    min-width:0 !important;
    max-width:100% !important;
    overflow:hidden !important;
    display:flex !important;
    flex-direction:column !important;
  }
  .VOzbGW_options{
    flex:1 1 0 !important;
    min-height:0 !important;
    max-width:100% !important;
    overflow-x:hidden !important;
    overflow-y:auto !important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
  }
  /* Undo any leaked chat-gutter / composer attribute selectors. */
  .VOzbGW_panel [class*="_root"]{
    width:auto !important;
    max-width:none !important;
    padding-left:unset !important;
    padding-right:unset !important;
  }
  .VOzbGW_panel [class*="rowText"]{
    flex:1 1 auto !important;
    min-width:0 !important;
    max-width:none !important;
  }
  .VOzbGW_panel [class*="cubeRow"]{
    display:flex !important;
    flex-wrap:nowrap !important;
    gap:8px !important;
    width:100% !important;
  }
  .VOzbGW_panel [class*="themeCube"],
  .VOzbGW_panel [class*="cubeRow"] > *{
    flex:1 1 0 !important;
    min-width:0 !important;
    max-width:none !important;
    width:auto !important;
  }
}

/* ---- Hero workspace row: keep chips on one line without squashing ---- */
@media (max-width:900px){
  [class*="_heroWorkspaceRow"].dsh-hero-rowReady{
    flex-wrap:nowrap !important;
    align-items:center !important;
    gap:6px !important;
    min-height:32px;
    overflow-x:auto;
    overflow-y:visible;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  [class*="_heroWorkspaceRow"].dsh-hero-rowReady::-webkit-scrollbar{display:none;height:0}
  [class*="_heroWorkspaceRow"].dsh-hero-rowReady .pXSMma_workspace,
  [class*="_heroWorkspaceRow"].dsh-hero-rowReady .cubgiG_seat{
    padding-left:8px !important;
    padding-right:8px !important;
    max-width:min(40vw, 148px);
    min-width:0;
    flex:0 1 auto;
  }
  [class*="_heroWorkspaceRow"].dsh-hero-rowReady .cubgiG_seat{
    max-width:min(36vw, 132px);
  }
  .dsh-hero-chips{
    flex:none;
    flex-shrink:0;
    margin-left:auto;
    width:auto;
    align-self:center;
  }
  .dsh-hero-chip{
    width:28px !important;
    height:28px !important;
    min-width:28px !important;
    min-height:28px !important;
    flex:none !important;
    flex-shrink:0 !important;
  }
}

/* ---- Slimmer collapsed sidebar rail (grid override lives in dsh-hero-tools) ---- */
@media (max-width:900px){
  .pI_x6G_frame[data-dsh-details-drawer="1"] .pI_x6G_handle[data-side=details]{
    display:none !important;
  }
  .pI_x6G_frame[data-sidebar-collapsed] .pI_x6G_sidebarCol{
    overflow:hidden!important;
  }
}

/*
 * ---- Tool tabs: full-bleed column (any width) + compact density when panel is narrow ----
 */
[class*="_centerCol"]{
  container-type:inline-size;
  container-name:dsh-center-col;
}
.dsh-hero-tool-host,
[class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"]{
  container-type:inline-size;
  container-name:dsh-tool-panel;
}
/* Tool plugin roots: span the center column; no chat/split side gutters. */
:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dt_root,.dsh-code-tab-root,[data-dsh-cron-root]){
  width:100%!important;
  max-width:none!important;
  min-width:0!important;
  box-sizing:border-box!important;
  padding-left:0!important;
  padding-right:0!important;
}
[class*="_root"][data-dsh-tool-tab="1"] [class*="_scrollBody"],
[class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"],
[class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] > div,
[class*="_root"][data-dsh-tool-tab="1"] .dsh-hero-tool-host,
[class*="_root"][data-dsh-tool-tab="1"] .dsh-hero-tool-view,
[class*="_viewArea"]:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)),
[class*="_viewArea"]:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)) > div,
.dsplit_rightBody:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)),
.dsplit_rightFrame:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)){
  padding-left:0!important;
  padding-right:0!important;
  max-width:none!important;
}
[class*="_root"][data-dsh-tool-tab="1"] .Md3f7G_scroll,
[class*="_viewArea"]:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)) .Md3f7G_scroll,
.dsplit_rightBody:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)){
  padding-left:0!important;
  padding-right:0!important;
}
@media (max-width:900px){
  /* dsh-split-view adds 12px scroll gutters on mobile — drop them for tool panes. */
  [class*="_root"][data-dsh-tool-tab="1"] .Md3f7G_scroll,
  [class*="_root"][data-dsh-split="1"][data-dsh-tool-tab="1"] .Md3f7G_scroll,
  [class*="_viewArea"]:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)) .Md3f7G_scroll,
  [class*="_root"][data-dsh-split="1"] .dsplit_rightBody:has(:is(.dg_root,.dc_root,.db_root,.dd_root,.dte_root,.dsh-code-tab-root)){
    padding-left:0!important;
    padding-right:0!important;
  }
}
[class*="_root"][data-dsh-tool-tab="1"] .dsh-hero-tool-host,
[class*="_root"][data-dsh-tool-tab="1"] .dsh-hero-tool-view,
.dsh-hero-tool-host,
.dsh-hero-tool-view{
  max-width:none!important;
  box-sizing:border-box!important;
}
@container dsh-center-col (max-width:720px){
  .dsh-tool-surface,
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] > div,
  .dsh-hero-tool-view > *{
    --dsh-t-pad-x:4px;
    --dsh-t-pad-x-end:10px;
    --dsh-t-bar-pad:10px;
    --dsh-t-pad-y:6px;
    --dsh-t-card-pad:8px;
    --dsh-t-gap:6px;
    --dsh-t-btn-h:28px;
    --dsh-t-input-h:28px;
    --dsh-t-font:11px;
    --dsh-t-font-sm:10px;
    --dsh-t-radius:6px;
  }
  /* Hero title / tabs: keep side breathing room (do not flush to 0). */
  [class*="_root"][data-dsh-tool-tab="1"] .dsh-hero-header,
  .dsh-hero-header[class*="_header"]{
    padding:8px var(--dsh-t-bar-pad,10px) 0!important;
  }
  /* Tool chrome bars: modest inset so Local/GitHub controls are not edge-glued. */
  :is(.dg_root,.dc_root,.db_root,.dd_root) > [class*="authBar"],
  :is(.dg_root,.dc_root,.db_root,.dd_root) > [class~="dg_bar"],
  :is(.dg_root,.dc_root,.db_root,.dd_root) > [class~="dc_bar"],
  :is(.dg_root,.dc_root,.db_root,.dd_root) > [class~="dd_bar"],
  :is(.dg_root,.dc_root,.db_root,.dd_root) > [class~="db_bar"],
  .dsh-tool-surface [class*="authBar"],
  .dsh-tool-surface [class~="dg_bar"],
  .dsh-tool-surface [class~="dc_bar"],
  .dsh-tool-surface [class~="dd_bar"],
  .dsh-tool-surface [class~="db_bar"],
  [class*="_viewArea"] [class*="authBar"],
  [class*="_viewArea"] [class~="dg_bar"]{
    padding-left:var(--dsh-t-bar-pad,10px)!important;
    padding-right:var(--dsh-t-bar-pad,10px)!important;
  }
  /*
   * Outer wrappers: near-flush. Nested setup→hub→column and cron
   * rootInner→bodyPad→panel were each adding 8–16px and crushing cards.
   */
  .dsh-tool-surface [class~="dg_setup"],
  .dsh-tool-surface [class~="dg_hub"],
  .dsh-tool-surface [class*="hubTop"],
  .dsh-tool-surface [class*="bodyPad"],
  .dsh-tool-surface [class*="formStack"],
  .dsh-tool-surface [class*="formSchedule"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_setup"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_hub"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="bodyPad"]{
    padding-left:var(--dsh-t-pad-x,4px)!important;
    padding-right:var(--dsh-t-pad-x-end,10px)!important;
  }
  .dsh-tool-surface [class~="dg_hub"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_hub"]{
    padding-top:var(--dsh-t-pad-y,6px)!important;
    padding-bottom:var(--dsh-t-pad-y,6px)!important;
  }
  .dsh-tool-surface [class*="hubGrid"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="hubGrid"]{
    gap:8px!important;
  }
  /* Cards / panels: keep modest internal padding only. */
  .dsh-tool-surface [class*="hubColumn"],
  .dsh-tool-surface [class*="remoteRow"],
  .dsh-tool-surface [class*="initBox"],
  .dsh-tool-surface [class*="_panel"],
  .dsh-tool-surface [class~="M_Ug7q_panel"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="hubColumn"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="remoteRow"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="_panel"]{
    padding-left:var(--dsh-t-card-pad,8px)!important;
    padding-right:var(--dsh-t-card-pad,8px)!important;
  }
  .dsh-tool-surface [class*="remoteList"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="remoteList"]{
    padding-left:0!important;
    padding-right:0!important;
  }
  .dsh-tool-surface [class~="dg_btn"],
  .dsh-tool-surface [class~="dc_btn"],
  .dsh-tool-surface [class~="dd_btn"],
  .dsh-tool-surface [class~="db_btn"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_btn"]{
    height:var(--dsh-t-btn-h,28px)!important;
    min-height:var(--dsh-t-btn-h,28px)!important;
    padding-left:8px!important;
    padding-right:8px!important;
    font-size:var(--dsh-t-font,11px)!important;
    border-radius:var(--dsh-t-radius,6px)!important;
  }
  .dsh-tool-surface [class*="btnSm"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="btnSm"]{
    height:22px!important;
    min-height:22px!important;
    font-size:var(--dsh-t-font-sm,10px)!important;
  }
  .dsh-tool-surface [class*="modeToggle"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="modeToggle"]{
    height:var(--dsh-t-btn-h,28px)!important;
  }
  .dsh-tool-surface [class*="modeToggle"] button,
  [class*="_root"][data-dsh-tool-tab="1"] [class*="modeToggle"] button{
    font-size:var(--dsh-t-font,11px)!important;
    padding-left:10px!important;
    padding-right:10px!important;
  }
  .dsh-tool-surface [class~="dg_select"],
  .dsh-tool-surface [class~="dg_input"],
  .dsh-tool-surface [class*="filterInput"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_select"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_input"]{
    height:var(--dsh-t-input-h,28px)!important;
    min-height:var(--dsh-t-input-h,28px)!important;
    font-size:var(--dsh-t-font,11px)!important;
  }
  .dsh-tool-surface [class*="remoteName"],
  .dsh-tool-surface [class*="sectionTitle"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="remoteName"]{
    font-size:12px!important;
  }
  .dsh-tool-surface [class*="remoteDesc"],
  .dsh-tool-surface [class~="dg_meta"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="remoteDesc"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_meta"]{
    font-size:var(--dsh-t-font-sm,10px)!important;
  }
  .dsh-tool-surface [class*="authBar"],
  .dsh-tool-surface [class~="dg_bar"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="authBar"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class~="dg_bar"]{
    gap:var(--dsh-t-gap,6px)!important;
    font-size:var(--dsh-t-font,11px)!important;
  }
  /* Cron filter strip — match chrome bar inset (bar only, not the tablist). */
  .dsh-tool-surface [class*="rootInner"] > [class$="_bar"],
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] [class*="rootInner"] > [class$="_bar"]{
    padding-left:var(--dsh-t-bar-pad,10px)!important;
    padding-right:var(--dsh-t-bar-pad,10px)!important;
  }
}
@container dsh-center-col (max-width:480px){
  .dsh-tool-surface,
  [class*="_root"][data-dsh-tool-tab="1"] [class*="_viewArea"] > div,
  .dsh-hero-tool-view > *{
    --dsh-t-pad-x:2px;
    --dsh-t-pad-x-end:10px;
    --dsh-t-bar-pad:8px;
    --dsh-t-card-pad:6px;
    --dsh-t-btn-h:26px;
    --dsh-t-input-h:26px;
    --dsh-t-font:10px;
  }
  [class*="_root"][data-dsh-tool-tab="1"] .dsh-hero-header,
  .dsh-hero-header[class*="_header"]{
    padding:6px var(--dsh-t-bar-pad,8px) 0!important;
  }
}

/* Composer @ / link chips: hover icon → remove (×) */
[class*="_composerSeat"] [class*="_chip"] [class*="_icon"],
[class*="_composerSeat"] [class*="_chip"] [class*="_marker"]{
  position:relative;
  flex:none;
  cursor:pointer;
}
[class*="_composerSeat"] [class*="_chip"]:hover [class*="_icon"] svg,
[class*="_composerSeat"] [class*="_chip"]:hover [class*="_marker"]{
  opacity:0;
}
[class*="_composerSeat"] [class*="_chip"] [class*="_icon"]::after,
[class*="_composerSeat"] [class*="_chip"] [class*="_marker"]::after{
  content:"×";
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  font-size:15px;
  line-height:1;
  font-weight:600;
  opacity:0;
  color:var(--dsw-alias-state-error-primary);
  pointer-events:none;
  border-radius:4px;
}
[class*="_composerSeat"] [class*="_chip"]:hover [class*="_icon"]::after,
[class*="_composerSeat"] [class*="_chip"]:hover [class*="_marker"]::after{
  opacity:1;
  pointer-events:auto;
}
[class*="_composerSeat"] [class*="_chip"]:hover [class*="_icon"]:hover::after,
[class*="_composerSeat"] [class*="_chip"]:hover [class*="_marker"]:hover::after{
  background:color-mix(in srgb,var(--dsw-alias-state-error-primary) 14%,transparent);
}

/* Composer send + plugin primaries: accent outline, no solid fill */
[class*="primaryButton"],

[class*="_primary"],
.dg_btnPrimary,
.db_btnPrimary,
.dd_btnPrimary,
.dsh-code-tab-btnPrimary,
.dam_form .dam_btnSave,
.da_primary{
  background:transparent!important;
  background-color:transparent!important;
  border:2px solid var(--dsw-alias-state-business-primary)!important;
  color:var(--dsw-alias-state-business-primary)!important;
  box-shadow:none!important;
}
[class*="primaryButton"] svg,
[class*="primaryButton"] path,
[class*="_primary"] svg,
[class*="_primary"] path,
.dg_btnPrimary svg,
.db_btnPrimary svg,
.dd_btnPrimary svg,
.dsh-code-tab-btnPrimary svg,
.da_primary svg{
  color:var(--dsw-alias-state-business-primary)!important;
  fill:currentColor!important;
}
[class*="primaryButton"]:hover:not(:disabled),
[class*="_primary"]:hover:not(:disabled),
[class*="_primary"]:focus-visible:not(:disabled),
.dg_btnPrimary:hover:not(:disabled),
.db_btnPrimary:hover:not(:disabled),
.dd_btnPrimary:hover:not(:disabled),
.dsh-code-tab-btnPrimary:hover:not(:disabled),
.dam_form .dam_btnSave:hover:not(:disabled),
.da_primary:hover:not(:disabled){
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)!important;
  border-color:var(--dsw-alias-state-business-primary)!important;
  color:var(--dsw-alias-state-business-primary)!important;
}
[class*="primaryButton"]:disabled,
[class*="_primary"]:disabled,
.dg_btnPrimary:disabled,
.db_btnPrimary:disabled,
.dd_btnPrimary:disabled,
.dsh-code-tab-btnPrimary:disabled,
.dam_form .dam_btnSave:disabled,
.da_primary:disabled{
  opacity:.4;
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById(STYLE_ID);
			if (!t) {
				t = document.createElement("style");
				t.id = STYLE_ID;
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		/**
		 * Stock dsh-web-frontend hardcodes Simplified Chinese for some chrome
		 * (web search sources, tool output collapse, reconnect, etc.) — those
		 * strings bypass dsh-client-locale. Rewrite exact UI phrases only.
		 */
		const ZH_EXACT = {
			复制: "Copy",
			失败: "Failed",
			收起: "Collapse",
			运行中: "Running",
			已完成: "Completed",
			无输出: "No output",
			无结果: "No results",
			复制成功: "Copied",
			收起输出: "Collapse output",
			收起内容: "Collapse content",
			收起差异: "Collapse diff",
			收起结果: "Collapse results",
			未找到结果: "No results found",
			内容已截断: "Content truncated",
			来源列表已截断: "Source list truncated",
			"连接已断开，正在重连…": "Connection lost, reconnecting…",
		};

		const ZH_PATTERNS = [
			[/^信号 (.+)$/, "Signal $1"],
			[/^退出码 (.+)$/, "Exit code $1"],
			[/^(.+) 个路径$/, "$1 paths"],
			[/^… 其余 (.+) 行$/, "… $1 more lines"],
			[/^展开其余 (.+) 行$/, "Expand $1 more lines"],
			[/^展开其余 (.+) 行输出$/, "Expand $1 more lines of output"],
			[/^展开其余 (.+) 行差异$/, "Expand $1 more lines of diff"],
			[/^展开其余 (.+) 行结果$/, "Expand $1 more lines of results"],
			[/^… 已截断，共 (.+) 字符$/, "… truncated, $1 characters total"],
			[/^显示 (.+) \/ 共 (.+)$/, "Showing $1 / $2 total"],
			[/^显示 (.+) \/ (.+) 行$/, "Showing $1 / $2 lines"],
			[/^(.+) 处匹配 · (.+) 个文件$/, "$1 matches · $2 files"],
		];

		function translateZhChrome(raw) {
			const t = String(raw ?? "").trim();
			if (!t || !/[\u4e00-\u9fff]/.test(t)) return null;
			if (Object.prototype.hasOwnProperty.call(ZH_EXACT, t)) return ZH_EXACT[t];
			for (const [re, repl] of ZH_PATTERNS) {
				if (re.test(t)) return t.replace(re, repl);
			}
			return null;
		}

		function skipZhTranslateRoot(el) {
			if (!(el instanceof Element)) return true;
			if (el.closest("textarea, input, select, [contenteditable='true'], pre, code, .fex-body, .fex-code, .cm-editor")) {
				return true;
			}
			return false;
		}

		function rewriteZhInTree(root) {
			if (!root || typeof document === "undefined") return;
			const walkRoot = root.nodeType === Node.TEXT_NODE ? root.parentNode : root;
			if (walkRoot && skipZhTranslateRoot(walkRoot)) return;

			const walker = document.createTreeWalker(
				root.nodeType === Node.TEXT_NODE ? root.parentNode || root : root,
				NodeFilter.SHOW_TEXT,
				{
					acceptNode(node) {
						const p = node.parentElement;
						if (!p || skipZhTranslateRoot(p)) return NodeFilter.FILTER_REJECT;
						const v = node.nodeValue;
						if (!v || !/[\u4e00-\u9fff]/.test(v)) return NodeFilter.FILTER_REJECT;
						return NodeFilter.FILTER_ACCEPT;
					},
				},
			);
			const nodes = [];
			for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n);
			for (const node of nodes) {
				const next = translateZhChrome(node.nodeValue);
				if (next != null && next !== node.nodeValue.trim()) {
					// Preserve surrounding whitespace from the original node.
					const raw = node.nodeValue;
					const lead = raw.match(/^\s*/)?.[0] ?? "";
					const trail = raw.match(/\s*$/)?.[0] ?? "";
					node.nodeValue = lead + next + trail;
				}
			}

			if (root instanceof Element) {
				for (const attr of ["title", "aria-label", "placeholder", "alt"]) {
					if (!root.hasAttribute(attr)) continue;
					const cur = root.getAttribute(attr);
					const next = translateZhChrome(cur);
					if (next != null) root.setAttribute(attr, next);
				}
				for (const el of root.querySelectorAll("[title], [aria-label], [placeholder], [alt]")) {
					if (skipZhTranslateRoot(el)) continue;
					for (const attr of ["title", "aria-label", "placeholder", "alt"]) {
						if (!el.hasAttribute(attr)) continue;
						const cur = el.getAttribute(attr);
						const next = translateZhChrome(cur);
						if (next != null) el.setAttribute(attr, next);
					}
				}
			}
		}

		function installZhChromeEnglish() {
			if (typeof document === "undefined") return () => {};
			rewriteZhInTree(document.body);
			let queued = new Set();
			let scheduled = 0;
			const flush = () => {
				scheduled = 0;
				const batch = [...queued];
				queued.clear();
				for (const node of batch) {
					if (!node.isConnected && node !== document.body) continue;
					rewriteZhInTree(node);
				}
			};
			const enqueue = (node) => {
				if (!node) return;
				queued.add(node.nodeType === Node.TEXT_NODE ? (node.parentNode || node) : node);
				if (scheduled) return;
				scheduled = window.setTimeout(flush, 48);
			};
			const mo = new MutationObserver((mutations) => {
				for (const m of mutations) {
					if (m.type === "characterData") {
						if (/[\u4e00-\u9fff]/.test(m.target?.nodeValue || "")) enqueue(m.target);
						continue;
					}
					if (m.type === "attributes") {
						const v = m.target.getAttribute?.(m.attributeName || "");
						if (v && /[\u4e00-\u9fff]/.test(v)) enqueue(m.target);
						continue;
					}
					for (const n of m.addedNodes) {
						if (n.nodeType === Node.TEXT_NODE) {
							if (/[\u4e00-\u9fff]/.test(n.nodeValue || "")) enqueue(n);
						} else if (n.nodeType === Node.ELEMENT_NODE) {
							enqueue(n);
						}
					}
				}
			});
			mo.observe(document.body, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true,
				attributeFilter: ["title", "aria-label", "placeholder", "alt"],
			});
			return () => {
				mo.disconnect();
				if (scheduled) window.clearTimeout(scheduled);
				queued.clear();
			};
		}

		function isTouchUi() {
			try {
				return window.matchMedia("(hover: none), (pointer: coarse)").matches;
			} catch {
				return false;
			}
		}

		function isSidebarExpanded() {
			const frame = document.querySelector(".pI_x6G_frame");
			if (frame && !frame.hasAttribute("data-sidebar-collapsed")) return true;
			const root = document.querySelector('[class*="_root"]');
			if (root && ![...root.classList].some((c) => c.endsWith("_collapsed"))) return true;
			return false;
		}

		function clickSidebarToggle() {
			const btn =
				document.querySelector('button[class*="_toggle"]') ||
				document.querySelector('[class*="_toggle"]');
			if (btn instanceof HTMLElement) {
				btn.click();
				return true;
			}
			return false;
		}

		/** Strip native title on touch so tooltips don't stick after a tap. */
		function installTooltipGuard() {
			if (typeof document === "undefined") return () => {};

			const stripTitle = (el) => {
				if (!(el instanceof HTMLElement) || !el.title) return;
				if (!el.dataset.dshTitle) el.dataset.dshTitle = el.title;
				el.removeAttribute("title");
			};

			const restoreTitle = (el) => {
				if (!(el instanceof HTMLElement)) return;
				if (el.dataset.dshTitle && !el.title) {
					el.title = el.dataset.dshTitle;
					delete el.dataset.dshTitle;
				}
			};

			/** On touch, never put title back — restoring is what re-pops "Open sidebar". */
			const onPointerDown = (e) => {
				if (!isTouchUi()) return;
				if (e.pointerType && e.pointerType !== "touch" && e.pointerType !== "pen") return;
				const el = e.target && e.target.closest
					? e.target.closest('[title], [data-dsh-title], button[class*="_toggle"], button[class*="_iconButton"], button[class*="_newSession"]')
					: null;
				if (!(el instanceof HTMLElement)) return;
				stripTitle(el);
				// Also strip ancestors that carry the label (toggle wraps an icon).
				let p = el.parentElement;
				for (let i = 0; i < 3 && p; i += 1, p = p.parentElement) {
					if (p instanceof HTMLElement && p.title) stripTitle(p);
				}
			};

			const onClick = (e) => {
				if (!isTouchUi()) return;
				const el = e.target && e.target.closest
					? e.target.closest('button[class*="_toggle"], button[class*="_iconButton"], button[class*="_newSession"], [data-dsh-title]')
					: null;
				if (el instanceof HTMLElement) stripTitle(el);
			};

			const onMouseEnter = (e) => {
				if (isTouchUi()) return;
				const el = e.target && e.target.closest ? e.target.closest("[data-dsh-title]") : null;
				restoreTitle(el);
			};

			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("click", onClick, true);
			document.addEventListener("mouseenter", onMouseEnter, true);
			return () => {
				document.removeEventListener("pointerdown", onPointerDown, true);
				document.removeEventListener("click", onClick, true);
				document.removeEventListener("mouseenter", onMouseEnter, true);
			};
		}

		/**
		 * When the sidebar is expanded, brand / "New session" should collapse the
		 * sidebar instead of navigating to the empty hero.
		 */
		function resolveActiveSessionId(sessions) {
			try {
				const snap = sessions?.list?.getSnapshot?.();
				if (typeof snap?.current === "string" && snap.current) return snap.current;
			} catch { /* ignore */ }
			try {
				const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
				return parsed?.sessionId || null;
			} catch {
				return null;
			}
		}

		function composerEditorFor(conversation, sessions) {
			const sessionId = resolveActiveSessionId(sessions);
			if (!sessionId || !conversation?.input) return null;
			try {
				const shell = conversation.input.shell(sessionId);
				return shell?.editor || null;
			} catch {
				return null;
			}
		}

		/** Remove one reference-chip decorator node whose portal contains chipEl. */
		function removeComposerReferenceChip(editor, chipEl) {
			if (!editor?.update || !chipEl) return false;
			let removed = false;
			editor.update(() => {
				const map = editor.getEditorState()?._nodeMap;
				if (!map) return;
				for (const node of map.values()) {
					if (!node || typeof node.getType !== "function") continue;
					if (node.getType() !== "reference-chip") continue;
					const host = editor.getElementByKey(node.getKey());
					if (!host) continue;
					if (host === chipEl || host.contains(chipEl) || chipEl.contains(host)) {
						node.remove();
						removed = true;
						break;
					}
				}
			}, { discrete: true });
			return removed;
		}

		function installComposerChipRemove(getConversation, getSessions) {
			if (typeof document === "undefined") return () => {};

			const onPointerDown = (e) => {
				if (e.button !== 0) return;
				const icon = e.target?.closest?.('[class*="_icon"], [class*="_marker"]');
				if (!(icon instanceof HTMLElement)) return;
				const chip = icon.closest('[class*="_chip"]');
				if (!(chip instanceof HTMLElement)) return;
				if (!chip.closest('[class*="_composerSeat"]')) return;
				e.preventDefault();
				e.stopPropagation();
				const conversation = typeof getConversation === "function" ? getConversation() : getConversation;
				const sessions = typeof getSessions === "function" ? getSessions() : getSessions;
				const editor = composerEditorFor(conversation, sessions);
				removeComposerReferenceChip(editor, chip);
			};

			document.addEventListener("pointerdown", onPointerDown, true);
			return () => document.removeEventListener("pointerdown", onPointerDown, true);
		}

		function installBrandClosesSidebar(getLayout) {
			if (typeof document === "undefined") return () => {};
			const onClick = (e) => {
				const brand = e.target && e.target.closest
					? e.target.closest('button[class*="_brand"]')
					: null;
				if (!(brand instanceof HTMLElement)) return;
				if (!isSidebarExpanded()) return;
				e.preventDefault();
				e.stopPropagation();
				e.stopImmediatePropagation();
				try {
					const layout = typeof getLayout === "function" ? getLayout() : getLayout;
					if (layout && typeof layout.toggleSidebar === "function") {
						layout.toggleSidebar();
						return;
					}
				} catch {
					/* fall through */
				}
				clickSidebarToggle();
			};
			document.addEventListener("click", onClick, true);
			return () => document.removeEventListener("click", onClick, true);
		}

		const inject = ["layout", "conversation", "sessions"];

		function apply(ctx) {
			ensureStyles();
			const getLayout = () => ctx.layout;
			const getConversation = () => ctx.get("conversation");
			const getSessions = () => ctx.get("sessions");

			ctx.effect(() => {
				ensureStyles();
				const stopTips = installTooltipGuard();
				const stopBrand = installBrandClosesSidebar(getLayout);
				const stopZh = installZhChromeEnglish();
				const stopChipRemove = installComposerChipRemove(getConversation, getSessions);
				return () => {
					stopTips();
					stopBrand();
					stopZh();
					stopChipRemove();
				};
			}, `${PLUGIN}: chrome`);
		}

		return { apply, inject };
	},
});

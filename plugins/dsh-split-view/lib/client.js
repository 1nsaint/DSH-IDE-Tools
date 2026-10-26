// Split button → second workbench column (own tabs + view), not a "Split" session tab.
// Left keeps the stock window; right mirrors its tab strip and mounts tools via __dshHeroToolRegistry.
window.__ModuleLoader__.load({
	id: "dsh-split-view",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		let ReactDOMClient = null;
		try {
			ReactDOMClient = require("react-dom/client");
		} catch {
			ReactDOMClient = null;
		}
		const PLUGIN = "dsh-split-view";
		const STORAGE_KEY = "dsh-split-view.v1";
		const DEFAULT_RIGHT = "Code";
		const MIN_RATIO = 0.22;
		const MAX_RATIO = 0.78;
		const SPLIT_EVENT = "dsh-split-view:change";

		/**
		 * Shared hero/session split state.
		 * SplitChrome must NOT live only under conversation.input.dock — that slot
		 * error-boundaries (data-slot-error) and unmounts, leaving empty .dsplit_rightHost
		 * orphans with data-dsh-split=1 and no React portals.
		 */
		const splitStore = {
			enabled: false,
			ratio: 0.5,
			rightLabel: DEFAULT_RIGHT,
			sessionId: null,
			listeners: new Set(),
			subscribe(fn) {
				this.listeners.add(fn);
				return () => this.listeners.delete(fn);
			},
			emit() {
				for (const fn of this.listeners) {
					try {
						fn(this.snapshot());
					} catch {
						/* ignore */
					}
				}
				try {
					window.dispatchEvent(new CustomEvent(SPLIT_EVENT, { detail: this.snapshot() }));
				} catch {
					/* ignore */
				}
			},
			snapshot() {
				return {
					enabled: this.enabled,
					ratio: this.ratio,
					rightLabel: this.rightLabel,
					sessionId: this.sessionId,
				};
			},
			set(partial) {
				let changed = false;
				for (const [k, v] of Object.entries(partial)) {
					if (this[k] !== v) {
						this[k] = v;
						changed = true;
					}
				}
				if (changed) this.emit();
			},
		};

		function portalApi() {
			const createPortal = ReactDOM?.createPortal || ReactDOM?.default?.createPortal;
			return typeof createPortal === "function" ? createPortal.bind(ReactDOM?.default || ReactDOM) : null;
		}

		/** Fallback when createPortal is missing — keep a createRoot per host element. */
		const hostRoots = new WeakMap();

		/** Catch tool-panel render crashes so they don't kill the whole split inject. */
		class PanelErrorBoundary extends React.Component {
			constructor(props) {
				super(props);
				this.state = { error: null };
			}
			static getDerivedStateFromError(error) {
				return { error };
			}
			componentDidCatch() {
				/* already stored */
			}
			render() {
				if (this.state.error) {
					const msg = this.state.error instanceof Error
						? this.state.error.message
						: String(this.state.error);
					return React.createElement(
						"div",
						{ className: "dsplit_empty" },
						`Split panel crashed: ${msg}`,
					);
				}
				return this.props.children;
			}
		}

		/** Tab label → registry id (Chat / Trajectory are left-window only). */
		const LABEL_TO_PANEL = {
			Code: "code",
			Git: "git",
			Containers: "containers",
			Terminal: "terminal",
			Browser: "browser",
			Database: "db",
			Scheduled: "scheduled",
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
			Scheduled: lucide(`<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>`),
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

		const closeSplitIcon = () =>
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
				React.createElement("path", { d: "M18 6 6 18" }),
				React.createElement("path", { d: "m6 6 12 12" }),
			);

		const css = `
/* Hide legacy Split tab if an older build registered it */
[class*="_tab"][data-dsh-tab-label="Split"]{display:none!important}

[class*="_root"][data-dsh-split="1"] [class*="_scrollBody"]{
  display:grid!important;
  grid-template-columns:minmax(0,var(--dsh-split-left,50%)) 11px minmax(0,1fr);
  grid-template-rows:minmax(0,1fr) auto;
  overflow:hidden!important;
}
[class*="_root"][data-dsh-split="1"] [class*="_viewArea"],
[class*="_root"][data-dsh-split="1"] [data-slot="conversation.session"]{
  grid-column:1;
  grid-row:1;
  min-width:0;min-height:0;
  /* Left cell is the chat scroller — stock Md3f7G_scroll hashes are gone */
  overflow-x:hidden!important;
  overflow-y:auto!important;
  -webkit-overflow-scrolling:touch;
  overscroll-behavior:contain;
  height:auto!important;
  max-height:100%!important;
  flex:unset!important;
}
[class*="_root"][data-dsh-split="1"] [class*="_viewArea"]{
  flex:1 1 0!important;min-height:0!important;height:100%!important;
  min-width:0!important;max-width:100%!important;width:auto!important;
}
/* Chat (and other left views) must shrink inside the split cell — follow polish chat width */
[class*="_root"][data-dsh-split="1"]{
  --dsh-chat-content-width:min(920px,100%);
  --dsh-composer-card-max-width:min(calc(var(--dsh-chat-content-width) + 32px),100%);
  --dsh-composer-side-clearance:8px;
}
/* Let message content grow so the left cell can scroll (do not pin height:100% + overflow:hidden) */
[class*="_root"][data-dsh-split="1"] [class*="_viewArea"]>div{
  height:auto!important;
  min-height:min-content!important;
  min-width:0!important;
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box;
  overflow:visible!important;
}
[class*="_root"][data-dsh-split="1"] [class*="_viewArea"] [class*="_flowItem"],
[class*="_root"][data-dsh-split="1"] [class*="_viewArea"] [class*="_callRow"],
[class*="_root"][data-dsh-split="1"] [class*="_viewArea"] [class*="_column"]{
  min-width:0!important;
  max-width:100%!important;
  overflow-wrap:anywhere;
  word-break:break-word;
}
[class*="_root"][data-dsh-split="1"] .dsplit_dividerHost{
  grid-column:2;grid-row:1 / span 2;
  cursor:col-resize;
  position:relative;
  touch-action:none;
  z-index:30;
  user-select:none;
  background:transparent;
}
/* Fat invisible hit target (~17px) around the 1px visual line */
[class*="_root"][data-dsh-split="1"] .dsplit_dividerHost:after{
  content:"";
  position:absolute;
  inset:0 -4px;
  z-index:1;
}
[class*="_root"][data-dsh-split="1"] .dsplit_dividerHost:before{
  content:"";
  position:absolute;
  top:0;bottom:0;left:50%;
  width:1px;
  transform:translateX(-50%);
  background:var(--dsw-alias-border-l2);
  z-index:0;
  pointer-events:none;
}
[class*="_root"][data-dsh-split="1"] .dsplit_dividerHost:hover:before,
[class*="_root"][data-dsh-split="1"] .dsplit_dividerHost.dsplit_dragging:before{
  width:3px;
  background:var(--dsw-alias-state-business-primary);
}
[class*="_root"][data-dsh-split="1"] .dsplit_dividerHost.dsplit_dragging{
  cursor:col-resize;
}
[class*="_root"][data-dsh-split="1"].dsplit_isDragging,
[class*="_root"][data-dsh-split="1"].dsplit_isDragging *{
  cursor:col-resize!important;
  user-select:none!important;
}
[class*="_root"][data-dsh-split="1"].dsplit_isDragging iframe{
  pointer-events:none!important;
}
[class*="_root"][data-dsh-split="1"] .dsplit_rightHost{
  grid-column:3;grid-row:1 / span 2;min-width:0;min-height:0;overflow:hidden;display:flex;flex-direction:column;
  border-left:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);
}

/*
 * Hero: left tools live in .dsh-hero-tool-host (scrollBody/body hidden on non-Chat).
 * Split is a root-level grid. 0.1.5 nests Chat under root > _body > _scrollBody —
 * never apply the session 3-col grid inside that nested scrollBody (it shrinks Chat
 * to ~50% of the already-split left column).
 */
[class*="_root"][data-phase=hero][data-dsh-split="1"]{
  display:grid!important;
  grid-template-columns:minmax(0,var(--dsh-split-left,50%)) 11px minmax(0,1fr);
  grid-template-rows:auto minmax(0,1fr);
  min-height:0;
  height:100%;
  overflow:hidden!important;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] .dsh-hero-header,
[class*="_root"][data-phase=hero][data-dsh-split="1"] [data-dsh-hero-header-host],
[class*="_root"][data-phase=hero][data-dsh-split="1"] > .dsh-hero-header{
  grid-column:1 / -1!important;
  grid-row:1!important;
  min-width:0;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] > [data-dsh-hero-header-host]:not(header){
  display:contents!important;
}
/* Left column: tool host OR body (0.1.5+) OR legacy direct scrollBody */
[class*="_root"][data-phase=hero][data-dsh-split="1"] > .dsh-hero-tool-host,
[class*="_root"][data-phase=hero][data-dsh-split="1"] > [class*="_body"],
[class*="_root"][data-phase=hero][data-dsh-split="1"] > [class*="_scrollBody"]{
  grid-column:1;
  grid-row:2;
  min-width:0!important;
  min-height:0!important;
  overflow:hidden!important;
  align-self:stretch!important;
  height:100%!important;
  max-height:none!important;
  width:100%!important;
  max-width:100%!important;
  box-sizing:border-box;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] > [class*="_body"]{
  display:flex!important;
  flex-direction:column!important;
}
/* Nested scrollBody must fill the left column — NOT become another split grid */
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_scrollBody"]{
  display:flex!important;
  flex-direction:column!important;
  justify-content:center!important; /* stock hero centers the composer stack */
  grid-template-columns:none!important;
  grid-template-rows:none!important;
  flex:1 1 0!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  min-height:0!important;
  height:100%!important;
  overflow:hidden!important;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"][data-dsh-tool-tab="1"] > [class*="_body"],
[class*="_root"][data-phase=hero][data-dsh-split="1"][data-dsh-tool-tab="1"] > [class*="_scrollBody"]{
  display:none!important;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"][data-dsh-tool-tab="1"] > .dsh-hero-tool-host{
  display:flex!important;
  flex-direction:column!important;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"]:not([data-dsh-tool-tab="1"]) > .dsh-hero-tool-host{
  display:none!important;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] > .dsplit_dividerHost{
  grid-column:2;
  grid-row:2;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] > .dsplit_rightHost{
  grid-column:3;
  grid-row:2;
  min-height:0!important;
  height:100%!important;
  align-self:stretch!important;
  border-left:1px solid var(--dsw-alias-border-l2);
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_scrollBody"] > .dsplit_dividerHost,
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_scrollBody"] > .dsplit_rightHost{
  display:none!important;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_composerSeat"]{
  grid-column:unset!important;
  grid-row:unset!important;
  /* Content-sized (stock is flex:0 0 auto). flex:1 made the seat fill the pane and
     pinned the InputBar to the top despite scrollBody justify-content:center. */
  flex:0 0 auto!important;
  width:100%!important;
  max-width:100%!important;
  min-width:0!important;
  height:auto!important;
  align-self:stretch!important;
  box-sizing:border-box;
}
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_composerSeat"] > *,
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_composerStack"],
[class*="_root"][data-phase=hero][data-dsh-split="1"] [class*="_composerHero"]{
  width:100%!important;
  max-width:min(var(--dsh-composer-card-max-width,920px),100%)!important;
  box-sizing:border-box;
  margin-left:auto;
  margin-right:auto;
}
[class*="_root"][data-dsh-split="1"] [class*="_composerSeat"]{
  grid-column:1;grid-row:2;
  min-width:0;max-width:100%;
  width:100%;
  box-sizing:border-box;
  z-index:5;
}
/* Only the composer shell — NOT nested module roots (bOPqQW_/JObwrW_/uV2eYG_/hSW_).
   Those also contain "_root" and were forced to width:100%, so dock pills stacked on top of each other. */
[class*="_root"][data-dsh-split="1"] [class*="_composerSeat"] [class*="_composerStack"],
[class*="_root"][data-dsh-split="1"] [class*="_composerSeat"] [data-composer-card],
[class*="_root"][data-dsh-split="1"] [class*="_composerSeat"] [class*="_card"]:not([class*="hSW_"]):not([class*="OPqQW_"]):not([class*="ObwrW_"]):not([class*="V2eYG_"]){
  max-width:100%!important;
  width:100%!important;
  box-sizing:border-box;
}
/* Input dock metrics (tok/s, cache, context %) — keep intrinsic width + gap */
[class*="_root"][data-dsh-split="1"] [class*="uV2eYG_dock"],
[class*="_root"][data-dsh-split="1"] [class*="V2eYG_dock"]{
  display:flex!important;
  flex-direction:row!important;
  flex-wrap:nowrap!important;
  align-items:center!important;
  gap:8px!important;
  min-width:0!important;
  width:100%!important;
  box-sizing:border-box!important;
}
/* Always-on dock (dsh-composer-dock) owns the metrics row — do not resurrect
   stock StatsPills / ContextMeter with display:inline-flex (that doubles the bar). */
[class*="_root"][data-dsh-split="1"] [class*="bOPqQW_root"][data-dsh-always-stats],
[class*="_root"][data-dsh-split="1"] [class*="OPqQW_root"][data-dsh-always-stats],
[class*="_root"][data-dsh-split="1"] .dcd_root,
[class*="_root"][data-dsh-split="1"] [data-dsh-always-stats]{
  position:static!important;
  width:auto!important;
  max-width:100%!important;
  min-width:0!important;
  flex:0 1 auto!important;
  display:flex!important;
  gap:8px!important;
}
[class*="_root"][data-dsh-split="1"] .uV2eYG_dock [class*="bOPqQW_root"]:not([data-dsh-always-stats]),
[class*="_root"][data-dsh-split="1"] .uV2eYG_dock [class*="OPqQW_root"]:not([data-dsh-always-stats]),
[class*="_root"][data-dsh-split="1"] .uV2eYG_dock > [class*="JObwrW_root"],
[class*="_root"][data-dsh-split="1"] .uV2eYG_dock > [class*="ObwrW_root"]{
  display:none!important;
}
[class*="_root"][data-dsh-split="1"] [class*="bOPqQW_pill"],
[class*="_root"][data-dsh-split="1"] [class*="OPqQW_pill"],
[class*="_root"][data-dsh-split="1"] [class*="JObwrW_trigger"],
[class*="_root"][data-dsh-split="1"] [class*="ObwrW_trigger"]{
  width:auto!important;
  min-width:0!important;
  max-width:100%!important;
  flex:0 1 auto!important;
}
/* To-dos strip (lXshSW_*): stock width calc subtracts composer insets again inside an
   already-narrow split seat, so "To-dos" wraps on the hyphen. Keep one line. */
[class*="_root"][data-dsh-split="1"] [class*="hSW_root"]{
  width:100%!important;
  max-width:100%!important;
  margin-left:0!important;
  margin-right:0!important;
  box-sizing:border-box!important;
}
[class*="_root"][data-dsh-split="1"] [class*="hSW_body"]{
  min-width:0!important;
}
[class*="_root"][data-dsh-split="1"] [class*="hSW_header"]{
  display:flex!important;
  flex-direction:row!important;
  flex-wrap:nowrap!important;
  align-items:center!important;
  gap:10px!important;
  min-width:0!important;
  width:100%!important;
  /* must NOT inherit session-chrome grid (selector used to match *_header) */
  grid-template-columns:none!important;
  grid-template-rows:none!important;
}
[class*="_root"][data-dsh-split="1"] [class*="hSW_lead"],
[class*="_root"][data-dsh-split="1"] [class*="hSW_chevron"]{
  flex:0 0 auto!important;
  width:auto!important;
  max-width:none!important;
  min-width:0!important;
  display:grid!important;
  place-items:center!important;
}
[class*="_root"][data-dsh-split="1"] [class*="hSW_title"]{
  flex:0 0 auto!important;
  white-space:nowrap!important;
  overflow:hidden!important;
}
[class*="_root"][data-dsh-split="1"] [class*="hSW_progress"]{
  flex:1 1 auto!important;
  min-width:0!important;
  white-space:nowrap!important;
  text-overflow:ellipsis!important;
  overflow:hidden!important;
}
/* Session + hero headers share the same split chrome (0.1.5 session chrome is a <header> child of root) */
[class*="_root"][data-dsh-split="1"] > header:not([class*="_headerHidden"]),
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]){
  display:grid!important;
  grid-template-columns:minmax(0,var(--dsh-split-left,50%)) 11px minmax(0,1fr);
  grid-template-rows:auto auto;
  align-items:end;
  overflow:hidden;
}
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_titleRow"]{
  grid-column:1 / -1;
  grid-row:1;
  align-self:center;
}
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_tabs"]{
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
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_tabs"]::-webkit-scrollbar{display:none;height:0}
/* Dual mode: icon-only on the stock (left) tab strip — override session-tabs 104px desktop widths */
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_tabs"] [class*="_tab"].dsh-tab-enhanced{
  flex:0 0 auto!important;
  gap:0!important;
  width:40px!important;
  min-width:40px!important;
  max-width:40px!important;
  justify-content:center!important;
  padding:4px 0 11px!important;
}
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_tabs"] [class*="_tab"] .dsh-tab-label{display:none!important}
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_tabs"] [class*="_tab"] .dsh-tab-icon svg{width:16px!important;height:16px!important;opacity:1}
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) .dsplit_headerGap{
  grid-column:2;
  grid-row:2;
  align-self:stretch;
  min-width:0;
}
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) .dsplit_rightTabsAnchor{
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
[class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) .dsplit_rightTabsAnchor>*{width:100%;min-width:0;max-width:100%}

.dsplit_rightFrame{display:flex;flex-direction:column;height:100%;min-height:0;min-width:0;overflow:hidden}
.dsplit_rightTabsRow{
  display:flex;align-items:flex-end;gap:4px;
  width:100%;min-width:0;max-width:100%;box-sizing:border-box;
  margin-top:4px;padding:0 4px;
}
.dsplit_rightTabsRow>.dsplit_rightTabs{
  flex:1 1 auto;min-width:0;margin-top:0;padding:0;
}
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
  transition:color .15s ease,filter .15s ease,transform .15s ease;
}
.fex-ibtn.dsplit-toggle:hover{background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}
.fex-ibtn.dsplit-toggle.active{
  color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));
  border-color:transparent;background:transparent;
  filter:drop-shadow(0 0 5px color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 50%,transparent));
}
.fex-ibtn.dsplit-toggle.active:hover{
  background:transparent;
  color:var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary));
  filter:drop-shadow(0 0 8px color-mix(in srgb,var(--dsw-alias-state-business-primary,var(--dsw-alias-brand-primary)) 72%,transparent));
  transform:scale(1.06);
}
.fex-ibtn.dsplit-close{
  display:inline-flex;align-items:center;justify-content:center;
  flex:0 0 auto;width:26px;height:26px;margin:0 0 3px;padding:0;
  border:1px solid transparent;border-radius:7px;background:transparent;
  color:var(--dsw-alias-label-secondary);cursor:pointer;
  transition:color .15s ease,background .15s ease;
}
.fex-ibtn.dsplit-close:hover{
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);
}
/* Split is desktop-only — hide toggle and tear down chrome on narrow viewports */
@media (max-width:900px){
  .fex-ibtn.dsplit-toggle{display:none!important}
}
@media (max-width:900px){
  [class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]){
    display:flex!important;flex-direction:column;overflow:visible;
  }
  [class*="_root"][data-dsh-split="1"] [class*="_header"]:not([class*="_headerHidden"]):not([class*="hSW_header"]) [class*="_tabs"]{max-width:100%;width:100%}
  [class*="_root"][data-dsh-split="1"] .dsplit_rightTabsAnchor,
  [class*="_root"][data-dsh-split="1"] .dsplit_headerGap{display:none!important}
  [class*="_root"][data-dsh-split="1"] [class*="_scrollBody"]{
    grid-template-columns:minmax(0,1fr)!important;
    /* chat scroll | composer | divider | tool pane */
    grid-template-rows:minmax(0,var(--dsh-split-top,42%)) auto 11px minmax(0,1fr);
    width:100%;
    max-width:100%;
    min-width:0;
    min-height:0!important;
    height:100%!important;
  }
  [class*="_root"][data-dsh-split="1"] [class*="_viewArea"],
  [class*="_root"][data-dsh-split="1"] [data-slot="conversation.session"]{
    grid-column:1;grid-row:1;
    width:100%!important;
    max-width:100%!important;
    min-width:0!important;
    min-height:0!important;
    max-height:100%!important;
    overflow-x:hidden!important;
    overflow-y:auto!important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
    touch-action:pan-y;
  }
  [class*="_root"][data-dsh-split="1"] [class*="_composerSeat"]{
    grid-column:1;grid-row:2;
    min-width:0;max-width:100%;
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_dividerHost{
    grid-column:1;grid-row:3;height:11px;width:auto;cursor:row-resize;
    touch-action:none;
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_dividerHost:after{
    inset:-6px 0;
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_dividerHost:before{
    top:50%;bottom:auto;left:0;right:0;width:auto;height:1px;
    transform:translateY(-50%);
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_dividerHost:hover:before,
  [class*="_root"][data-dsh-split="1"] .dsplit_dividerHost.dsplit_dragging:before{
    width:auto;height:3px;
  }
  [class*="_root"][data-dsh-split="1"].dsplit_isDragging,
  [class*="_root"][data-dsh-split="1"].dsplit_isDragging *{
    cursor:row-resize!important;
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_rightHost{
    grid-column:1;grid-row:4;border-left:none;border-top:1px solid var(--dsw-alias-border-l2);
    width:100%!important;max-width:100%!important;min-width:0!important;
    min-height:0!important;max-height:100%!important;
    overflow:hidden!important;
    overscroll-behavior:contain;
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_rightFrame,
  [class*="_root"][data-dsh-split="1"] .dsplit_rightBody{
    min-height:0!important;
    max-height:100%!important;
  }
  [class*="_root"][data-dsh-split="1"] .dsplit_rightBody>*{
    overflow-y:auto!important;
    -webkit-overflow-scrolling:touch;
    overscroll-behavior:contain;
    touch-action:pan-y;
  }
  [class*="_root"][data-dsh-split="1"]{
    --dsh-composer-side-clearance:8px;
    --dsh-chat-content-width:100%;
    --dsh-composer-card-max-width:100%;
  }
  [class*="_root"][data-dsh-split="1"] [class*="_viewArea"]{
    padding-left:12px!important;
    padding-right:12px!important;
  }
  .dsplit_rightTabs.dsplit_tabsInBody,
  .dsplit_rightTabsRow.dsplit_tabsInBody{
    display:flex;border-bottom:1px solid var(--dsw-alias-border-l2);padding:4px 4px 0;
    flex:none;
  }
}
@media (min-width:901px){
  /* Desktop: right tools tabs live in the header anchor (session + hero) */
  .dsplit_rightTabs.dsplit_tabsInBody,
  .dsplit_rightTabsRow.dsplit_tabsInBody{display:none!important}
  [class*="_root"][data-dsh-split-body-tabs="1"] .dsplit_rightTabsRow.dsplit_tabsInBody{
    display:flex!important;
    border-bottom:1px solid var(--dsw-alias-border-l2);
    padding:4px 4px 0;
    flex:none;
  }
  [class*="_root"][data-dsh-split-body-tabs="1"] .dsplit_rightTabs.dsplit_tabsInBody{
    display:flex!important;
    border-bottom:1px solid var(--dsw-alias-border-l2);
    padding:4px 4px 0;
    flex:none;
  }
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
			const split = document.querySelector('[class*="_root"][data-dsh-split="1"]');
			if (split) return split;
			const session = document.querySelector('[data-slot="conversation.session"]')?.closest('[class*="_root"]');
			if (session) return session;
			return (
				document.querySelector('[class*="_root"][data-phase="hero"]')
				|| document.querySelector('[class*="_root"][data-phase]')
				|| document.querySelector('[class*="_root"]')
			);
		}

		function isHeroPhase(root = sessionRoot()) {
			return root?.getAttribute("data-phase") === "hero";
		}

		function isStockSessionHeader(el) {
			if (!el || !(el instanceof HTMLElement)) return false;
			if (el.classList.contains("dsh-hero-header")) return false;
			if (el.hasAttribute("data-dsh-hero-header-host")) return false;
			return ![...el.classList].some((c) => c.endsWith("_headerHidden"));
		}

		/** Real title/tabs header — session `<header>` or hero chrome. */
		function findSessionHeader(root) {
			if (!root) return null;
			if (root.getAttribute("data-phase") === "hero") {
				return (
					root.querySelector(":scope > .dsh-hero-header")
					|| root.querySelector(":scope > [data-dsh-hero-header-host]")
					|| null
				);
			}
			// 0.1.5+: header is often root > (wrapper) > header, not root > header.
			const selectors = [
				":scope > header",
				':scope > [class*="_header"]',
				":scope > * > header",
				':scope > * > [class*="_header"]',
			];
			for (const sel of selectors) {
				for (const el of root.querySelectorAll(sel)) {
					if (isStockSessionHeader(el)) return el;
				}
			}
			return null;
		}

		function readStockTabs() {
			const root = sessionRoot();
			if (!root) return [];
			const tabs = root.querySelectorAll('[class*="_tabs"] [role="tab"]');
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
				: ["Chat", "Code", "Git", "Containers", "Terminal", "Browser", "Database", "Scheduled", "Trajectory"];
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

		function safeInsertBefore(parent, node, ref) {
			if (!parent || !node) return;
			try {
				if (ref && ref.parentNode === parent) parent.insertBefore(node, ref);
				else if (node.parentNode !== parent) parent.appendChild(node);
			} catch {
				try {
					if (node.parentNode !== parent) parent.appendChild(node);
				} catch {
					/* ignore */
				}
			}
		}

		function placeAfter(parent, node, after) {
			if (!parent || !node) return;
			if (after && after.parentNode === parent) {
				if (after.nextSibling === node) return; // already placed — avoid MutationObserver churn
				safeInsertBefore(parent, node, after.nextSibling);
			} else if (node.parentNode !== parent) {
				parent.appendChild(node);
			}
		}

		function ensureHosts() {
			const root = sessionRoot();
			if (!root) return null;
			const body = root.querySelector(':scope > [class*="_body"]');
			const scrollBody =
				root.querySelector(':scope > [class*="_scrollBody"]')
				|| body?.querySelector(':scope > [class*="_scrollBody"]')
				|| root.querySelector('[class*="_scrollBody"]');
			const hero = isHeroPhase(root);
			// Hero split mounts on the root (tool-host + scrollBody siblings). scrollBody may be
			// display:none on tool tabs — still preferred as an order anchor, but not required.
			if (!scrollBody && !hero) return null;
			const header = findSessionHeader(root);
			const toolHost = root.querySelector(":scope > .dsh-hero-tool-host");
			/** Session: hosts live inside scrollBody. Hero: siblings of tool-host/scrollBody on root. */
			const mountParent = hero ? root : scrollBody;

			let divider =
				(hero && root.querySelector(":scope > .dsplit_dividerHost"))
				|| scrollBody?.querySelector(":scope > .dsplit_dividerHost")
				|| root.querySelector(".dsplit_dividerHost");
			if (!divider) {
				divider = document.createElement("div");
				divider.className = "dsplit_dividerHost";
				divider.setAttribute("role", "separator");
				divider.setAttribute("aria-orientation", "vertical");
			}

			let rightHost =
				(hero && root.querySelector(":scope > .dsplit_rightHost"))
				|| scrollBody?.querySelector(":scope > .dsplit_rightHost")
				|| root.querySelector(".dsplit_rightHost");
			if (!rightHost) {
				rightHost = document.createElement("div");
				rightHost.className = "dsplit_rightHost";
			}

			if (hero) {
				// Do NOT reparent React-managed nodes (toolHost/body/scrollBody). Only place our
				// hosts after the left content anchor. 0.1.5+: prefer _body (scrollBody is nested).
				const toolVisible = toolHost && (() => {
					try {
						return window.getComputedStyle(toolHost).display !== "none";
					} catch {
						return true;
					}
				})();
				const leftAnchor =
					(toolVisible && toolHost)
					|| (body && body.parentNode === root ? body : null)
					|| (scrollBody && scrollBody.parentNode === root ? scrollBody : null)
					|| null;
				if (divider.parentElement !== root) root.appendChild(divider);
				if (rightHost.parentElement !== root) root.appendChild(rightHost);
				if (leftAnchor) {
					placeAfter(root, divider, leftAnchor);
					placeAfter(root, rightHost, divider);
				}
			} else {
				const composer = scrollBody.querySelector('[class*="_composerSeat"]');
				if (divider.parentElement !== scrollBody) {
					if (composer && composer.parentNode === scrollBody) safeInsertBefore(scrollBody, divider, composer);
					else scrollBody.appendChild(divider);
				}
				if (rightHost.parentElement !== scrollBody) {
					if (composer && composer.parentNode === scrollBody) safeInsertBefore(scrollBody, rightHost, composer);
					else scrollBody.appendChild(rightHost);
				} else if (composer && composer.parentNode === scrollBody && rightHost.nextSibling !== composer) {
					safeInsertBefore(scrollBody, rightHost, composer);
				}
				if (rightHost.parentNode === scrollBody && divider.nextSibling !== rightHost) {
					safeInsertBefore(scrollBody, divider, rightHost);
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
			const stockTabs = header.querySelector('[class*="_tabs"]');
			if (headerGap.parentElement !== header) {
				if (stockTabs && stockTabs.parentNode === header) {
					placeAfter(header, headerGap, stockTabs);
				} else {
					header.appendChild(headerGap);
				}
			}
			if (tabsAnchor.parentElement !== header) {
				placeAfter(header, tabsAnchor, headerGap);
			} else if (tabsAnchor.previousSibling !== headerGap) {
				placeAfter(header, tabsAnchor, headerGap);
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

		function RightTabList({ activeLabel, onSelect, inBody, onCloseSplit }) {
			const [, bump] = React.useState(0);
			const labels = readStockTabs();

			React.useEffect(() => {
				let timer = 0;
				const schedule = () => {
					window.clearTimeout(timer);
					timer = window.setTimeout(() => bump((n) => n + 1), 150);
				};
				const t = window.setTimeout(() => bump((n) => n + 1), 200);
				const obs = new MutationObserver(schedule);
				const root = sessionRoot();
				if (root) {
					// Attributes only — childList+subtree re-fires on every portal paint and freezes UI.
					obs.observe(root, {
						subtree: true,
						childList: false,
						attributes: true,
						attributeFilter: ["data-dsh-tab-label", "aria-selected"],
					});
				}
				return () => {
					window.clearTimeout(t);
					window.clearTimeout(timer);
					obs.disconnect();
				};
			}, []);

			const tabStrip = React.createElement(
				"div",
				{
					className: "dsplit_rightTabs" + (inBody && !onCloseSplit ? " dsplit_tabsInBody" : ""),
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

			if (!onCloseSplit) return tabStrip;

			return React.createElement(
				"div",
				{
					className: "dsplit_rightTabsRow" + (inBody ? " dsplit_tabsInBody" : ""),
				},
				tabStrip,
				React.createElement(
					"button",
					{
						type: "button",
						className: "fex-ibtn dsplit-close",
						title: "Close split window",
						"aria-label": "Close split window",
						onClick: onCloseSplit,
					},
					closeSplitIcon(),
				),
			);
		}

		function RightPane({ activeLabel, onSelect, sessionId, showBodyTabs, onCloseSplit }) {
			const panelId = LABEL_TO_PANEL[activeLabel];
			const factory = panelId ? window.__dshHeroToolRegistry?.get(panelId) : null;

			let body;
			if (panelId && factory) {
				try {
					body = factory({ sessionId: sessionId || resolveSessionId(), surface: "split" });
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
				showBodyTabs
					? React.createElement(RightTabList, {
							activeLabel,
							onSelect,
							inBody: true,
							onCloseSplit,
						})
					: null,
				React.createElement(
					"div",
					{ className: "dsplit_rightBody" },
					React.createElement(PanelErrorBoundary, { key: activeLabel }, body),
				),
			);
		}

		function SplitChrome({ enabled, ratio, rightLabel, sessionId, onRatio, onRightLabel, onCloseSplit }) {
			const [hosts, setHosts] = React.useState(null);
			const dragging = React.useRef(false);
			const liveRatio = React.useRef(ratio);
			liveRatio.current = ratio;
			const createPortal = portalApi();
			React.useEffect(() => {
				ensureStyles();
				const root = sessionRoot();
				if (!root) return undefined;
				if (!enabled) {
					root.removeAttribute("data-dsh-split");
					root.removeAttribute("data-dsh-split-body-tabs");
					clearHosts(root);
					setHosts(null);
					return undefined;
				}
				root.setAttribute("data-dsh-split", "1");
				applyRatio(liveRatio.current);

				let cancelled = false;
				let mutating = false;
				let debounceTimer = 0;

				const syncHosts = (force) => {
					if (cancelled || dragging.current) return;
					if (mutating && !force) return;
					mutating = true;
					let h = null;
					try {
						h = ensureHosts();
					} catch (err) {
						console.warn("[dsh-split-view] ensureHosts failed", err);
						h = null;
					} finally {
						// Let our own DOM writes settle before observing again.
						queueMicrotask(() => { mutating = false; });
					}
					const r = sessionRoot();
					if (r) {
						if (h?.tabsAnchor) r.removeAttribute("data-dsh-split-body-tabs");
						else r.setAttribute("data-dsh-split-body-tabs", "1");
					}
					setHosts((prev) => {
						if (
							prev
							&& h
							&& prev.rightHost === h.rightHost
							&& prev.tabsAnchor === h.tabsAnchor
							&& prev.divider === h.divider
							&& prev.scrollBody === h.scrollBody
							&& prev.toolHost === h.toolHost
							&& prev.header === h.header
						) {
							return prev;
						}
						return h;
					});
				};

				syncHosts(true);

				// Only react when our hosts disappear or the shell re-parents — NOT on every
				// subtree mutation (portals/React would infinite-loop and freeze the page).
				const obs = new MutationObserver((records) => {
					if (cancelled || mutating || dragging.current) return;
					let needs = false;
					for (const rec of records) {
						if (rec.type !== "childList") continue;
						for (const node of rec.removedNodes) {
							if (!(node instanceof HTMLElement)) continue;
							if (
								node.classList?.contains("dsplit_rightHost")
								|| node.classList?.contains("dsplit_dividerHost")
								|| node.classList?.contains("dsplit_rightTabsAnchor")
								|| node.classList?.contains("dsh-hero-tool-host")
								|| [...(node.classList || [])].some((c) => c.includes("_scrollBody") || c.includes("_body") || c.includes("_header"))
							) {
								needs = true;
								break;
							}
						}
						if (needs) break;
						// Our hosts detached / missing
						if (!root.querySelector(":scope > .dsplit_rightHost") && !root.querySelector(".dsplit_rightHost")) {
							needs = true;
							break;
						}
					}
					if (!needs) return;
					window.clearTimeout(debounceTimer);
					debounceTimer = window.setTimeout(() => syncHosts(false), 80);
				});
				obs.observe(root, { childList: true, subtree: false });
				// Also watch direct header for tab-anchor loss (header is row 1 child).
				const header = findSessionHeader(root);
				if (header) obs.observe(header, { childList: true, subtree: false });

				return () => {
					cancelled = true;
					window.clearTimeout(debounceTimer);
					obs.disconnect();
					const r = sessionRoot();
					if (r?.hasAttribute("data-dsh-split")) {
						r.removeAttribute("data-dsh-split");
						r.removeAttribute("data-dsh-split-body-tabs");
						clearHosts(r);
					}
					setHosts(null);
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
						const composer = body?.querySelector(':scope > [class*="_composerSeat"]');
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

			if (!enabled || !hosts?.rightHost) {
				return null;
			}

			const tabs = React.createElement(RightTabList, {
				activeLabel: rightLabel,
				onSelect: onRightLabel,
				inBody: false,
				onCloseSplit,
			});
			const useHeaderTabs = !!(hosts?.tabsAnchor?.isConnected && isSplitDesktop());
			const bodyWithTabs = React.createElement(RightPane, {
				activeLabel: rightLabel,
				onSelect: onRightLabel,
				sessionId,
				onCloseSplit,
				showBodyTabs:
					!useHeaderTabs
					&& (isStackedSplit() || !!hosts?.root?.hasAttribute("data-dsh-split-body-tabs")),
			});

			if (createPortal) {
				return React.createElement(
					React.Fragment,
					null,
					hosts.tabsAnchor?.isConnected ? createPortal(tabs, hosts.tabsAnchor) : null,
					createPortal(bodyWithTabs, hosts.rightHost),
				);
			}

			// Imperative createRoot fallback (rare — portal API missing).
			return React.createElement(CreateRootHost, {
				rightHost: hosts.rightHost,
				tabsAnchor: hosts.tabsAnchor?.isConnected ? hosts.tabsAnchor : null,
				tabs,
				body: bodyWithTabs,
			});
		}

		function CreateRootHost({ rightHost, tabsAnchor, tabs, body }) {
			React.useEffect(() => {
				if (!ReactDOMClient?.createRoot) return undefined;
				const nodes = [];
				if (tabsAnchor) {
					let root = hostRoots.get(tabsAnchor);
					if (!root) {
						root = ReactDOMClient.createRoot(tabsAnchor);
						hostRoots.set(tabsAnchor, root);
					}
					root.render(tabs);
					nodes.push(tabsAnchor);
				}
				if (rightHost) {
					let root = hostRoots.get(rightHost);
					if (!root) {
						root = ReactDOMClient.createRoot(rightHost);
						hostRoots.set(rightHost, root);
					}
					root.render(body);
					nodes.push(rightHost);
				}
				return () => {
					for (const node of nodes) {
						const root = hostRoots.get(node);
						try {
							root?.unmount();
						} catch {
							/* ignore */
						}
						hostRoots.delete(node);
					}
				};
			}, [rightHost, tabsAnchor, tabs, body]);
			return null;
		}

		function isSidebarCollapsed() {
			return !!document.querySelector(".pI_x6G_frame[data-sidebar-collapsed]");
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

		function useSplitStore() {
			const [snap, setSnap] = React.useState(() => splitStore.snapshot());
			React.useEffect(() => splitStore.subscribe(setSnap), []);
			return snap;
		}

		function SplitChromeHost() {
			const snap = useSplitStore();
			const hero = useIsHero();
			const actions = useHeroHeaderActions(hero);
			const [desktop, setDesktop] = React.useState(() => isSplitDesktop());
			const active = snap.enabled && desktop;
			const createPortal = portalApi();
			const lastToggleAt = React.useRef(0);

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

			// Leaving hero must close split so session chrome doesn't inherit orphan hosts.
			React.useEffect(() => {
				if (!hero && splitStore.enabled) setSplitEnabled(false);
			}, [hero]);

			const onHeroToggle = (e) => {
				if (e?.button != null && e.button !== 0) return;
				e?.preventDefault?.();
				e?.stopPropagation?.();
				const now = Date.now();
				if (now - lastToggleAt.current < 350) return;
				lastToggleAt.current = now;
				setSplitEnabled(!active);
			};

			const heroBtn = hero && desktop
				? React.createElement(
					"button",
					{
						className: "fex-ibtn dsplit-toggle" + (active ? " active" : ""),
						type: "button",
						title: active ? "Close split window" : "Open split window",
						"aria-label": active ? "Close split window" : "Open split window",
						onClick: onHeroToggle,
					},
					splitIcon(),
				)
				: null;

			return React.createElement(
				PanelErrorBoundary,
				null,
				heroBtn && actions && createPortal ? createPortal(heroBtn, actions) : null,
				React.createElement(SplitChrome, {
					enabled: active,
					ratio: snap.ratio,
					rightLabel: snap.rightLabel,
					sessionId: snap.sessionId,
					onRatio: (ratio) => {
						splitStore.set({ ratio });
						saveState({ ratio, rightLabel: splitStore.rightLabel, enabled: splitStore.enabled });
					},
					onRightLabel: (rightLabel) => {
						splitStore.set({ rightLabel });
						saveState({ ratio: splitStore.ratio, rightLabel, enabled: splitStore.enabled });
					},
					onCloseSplit: () => {
						splitStore.set({ enabled: false });
						saveState({ enabled: false, ratio: splitStore.ratio, rightLabel: splitStore.rightLabel });
					},
				}),
			);
		}

		function setSplitEnabled(next, { getLayout, collapseSidebarOnOpen = false } = {}) {
			if (next && !isSplitDesktop()) return;
			if (next) {
				let rightLabel = splitStore.rightLabel;
				if (rightLabel === "Chat" || rightLabel === "Trajectory") {
					rightLabel = DEFAULT_RIGHT;
				}
				if (collapseSidebarOnOpen && typeof getLayout !== "undefined") {
					collapseSidebar(getLayout);
				}
				splitStore.set({ enabled: true, rightLabel });
			} else {
				splitStore.set({ enabled: false });
			}
			saveState({
				enabled: next,
				ratio: splitStore.ratio,
				rightLabel: splitStore.rightLabel,
			});
		}

		function SplitToggle({ sessionId, getLayout }) {
			const snap = useSplitStore();
			const [desktop, setDesktop] = React.useState(() => isSplitDesktop());
			const collapsedForSplit = React.useRef(false);
			const didInitCollapse = React.useRef(false);
			const active = snap.enabled && desktop;

			React.useEffect(() => {
				ensureStyles();
				if (sessionId) splitStore.set({ sessionId });
			}, [sessionId]);

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
				if (active) applyRatio(snap.ratio);
			}, [active, snap.ratio]);

			const onToggle = () => {
				if (!isSplitDesktop()) return;
				if (!active) {
					collapsedForSplit.current = collapseSidebar(getLayout);
					setSplitEnabled(true);
				} else {
					if (collapsedForSplit.current) {
						expandSidebar(getLayout);
						collapsedForSplit.current = false;
					}
					setSplitEnabled(false);
				}
			};

			if (!desktop) return null;

			return React.createElement(
				"button",
				{
					className: "fex-ibtn dsplit-toggle" + (active ? " active" : ""),
					type: "button",
					title: active ? "Close split window" : "Open split window",
					onClick: onToggle,
				},
				splitIcon(),
			);
		}

		const inject = ["slots", "layout"];

		function useIsHero() {
			const [hero, setHero] = React.useState(() => !!document.querySelector('[class*="_root"][data-phase=hero]'));
			React.useEffect(() => {
				const check = () => setHero(!!document.querySelector('[class*="_root"][data-phase=hero]'));
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
				let timer = 0;
				const sync = () => {
					window.clearTimeout(timer);
					timer = window.setTimeout(() => {
						const el = document.querySelector("[data-dsh-hero-header-actions]");
						setHost((prev) => (prev === el ? prev : el));
					}, 100);
				};
				sync();
				const root = document.getElementById("root") || document.body;
				const mo = new MutationObserver(sync);
				mo.observe(root, { childList: true, subtree: true });
				return () => {
					window.clearTimeout(timer);
					mo.disconnect();
				};
			}, [enabled]);
			return host;
		}

		function apply(ctx) {
			const slots = ctx.slots;
			if (!slots) return;
			const getLayout = () => ctx.layout;
			ensureStyles();

			// Seed store from storage (ratio/label). Session may restore enabled; hero starts closed.
			const saved = loadState() || {};
			if (typeof saved.ratio === "number") splitStore.ratio = saved.ratio;
			if (typeof saved.rightLabel === "string" && saved.rightLabel !== "Chat" && saved.rightLabel !== "Trajectory") {
				splitStore.rightLabel = saved.rightLabel;
			}
			const onHero = !!document.querySelector('[class*="_root"][data-phase=hero]');
			if (saved.enabled === true && !onHero) splitStore.enabled = true;

			// Scrub orphans from a previous crashed inject.
			try {
				const root = document.querySelector('[class*="_root"][data-dsh-split="1"]');
				if (root && !splitStore.enabled) {
					root.removeAttribute("data-dsh-split");
					root.removeAttribute("data-dsh-split-body-tabs");
					clearHosts(root);
				}
			} catch {
				/* ignore */
			}

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

			// Mount chrome + hero toggle via createRoot — NOT conversation.session (single slot)
			// and NOT conversation.input.dock (error-boundaries orphan empty hosts).
			ctx.effect(() => {
				if (typeof document === "undefined" || !ReactDOMClient?.createRoot) return undefined;
				let host = document.getElementById("dsh-split-chrome-root");
				if (!host) {
					host = document.createElement("div");
					host.id = "dsh-split-chrome-root";
					host.setAttribute("data-dsh-split-chrome", "1");
					host.style.display = "contents";
					(document.getElementById("root") || document.body).appendChild(host);
				}
				let root = hostRoots.get(host);
				if (!root) {
					root = ReactDOMClient.createRoot(host);
					hostRoots.set(host, root);
				}
				root.render(React.createElement(SplitChromeHost));
				return () => {
					try {
						root.unmount();
					} catch {
						/* ignore */
					}
					hostRoots.delete(host);
					host.remove();
					const sessionRootEl = document.querySelector('[class*="_root"][data-dsh-split="1"]');
					if (sessionRootEl) {
						sessionRootEl.removeAttribute("data-dsh-split");
						sessionRootEl.removeAttribute("data-dsh-split-body-tabs");
						clearHosts(sessionRootEl);
					}
					splitStore.set({ enabled: false });
				};
			}, `${PLUGIN}: chrome host root`);
		}

		return { apply, inject };
	},
});

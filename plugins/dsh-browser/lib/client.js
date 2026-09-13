window.__ModuleLoader__.load({
	id: "dsh-browser",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-browser";
		const RPC = "/browser";
		const REF_SOURCE = "browser-dom";
		const STORE_KEY = "dsh-browser.view.v1";
		const OPEN_EVENT = "dsh-open-browser-url";
		const BUILD = "0.6.25-save-to-css";
		const DT_SIZE = {
			bottomMin: 160,
			bottomMax: 720,
			bottomDefault: 340,
			rightMin: 280,
			rightMax: 900,
			rightDefault: 400,
		};
		/** Blank black home — no site chrome, no invert filter. */
		const DEFAULT_HOME = "data:text/html;charset=utf-8," + encodeURIComponent(
			"<!doctype html><html><head><meta charset=utf-8><title></title>"
			+ "<style>html,body{margin:0;height:100%;background:#000}</style></head><body></body></html>",
		);

		/** Full prompt payloads for minted @chips (keyed by occurrence ref id). */
		const chipPayloads = new Map();

		/** Survives BrowserView unmount while another conversation.view tab is active. */
		const pendingOpen = { url: null, listeners: new Set() };

		function setPendingUrl(url) {
			if (typeof url !== "string" || !url) return;
			pendingOpen.url = url;
			pendingOpen.listeners.forEach((fn) => fn(url));
		}

		function readPersisted() {
			try {
				const raw = JSON.parse(sessionStorage.getItem(STORE_KEY) || "null");
				if (!raw || typeof raw !== "object") return null;
				return raw;
			} catch {
				return null;
			}
		}

		function writePersisted(patch) {
			try {
				const prev = readPersisted() || {};
				sessionStorage.setItem(STORE_KEY, JSON.stringify({ ...prev, ...patch, savedAt: Date.now() }));
			} catch {
				/* quota / private mode */
			}
		}

		function isHttpUrl(raw) {
			try {
				const u = new URL(String(raw || "").trim());
				return u.protocol === "http:" || u.protocol === "https:";
			} catch {
				return false;
			}
		}

		function isBrowseUrl(raw) {
			const s = String(raw || "").trim();
			if (!s) return false;
			if (s.startsWith("data:text/html")) return true;
			if (s.includes("/api/browser-live/") || s.includes("/api/browser-gate/")) return true;
			if (s.startsWith("/") && !s.startsWith("//")) return true;
			return isHttpUrl(s);
		}

		/** Harness SPA in the iframe = recursive UI. Live/gate API paths are fine. */
		function isHarnessAppShell(raw) {
			if (typeof window === "undefined" || !window.location?.origin) return false;
			try {
				const pub = fromGateUrl(normalizeUrl(raw) || String(raw || "").trim());
				if (!pub) return false;
				const u = new URL(pub, window.location.origin);
				if (u.origin !== window.location.origin) return false;
				const path = u.pathname || "/";
				if (path.startsWith("/api/browser-live/") || path.startsWith("/api/browser-gate/")) return false;
				return true;
			} catch {
				return false;
			}
		}

		function sanitizeBrowseUrl(raw) {
			const u = stripRetiredGateUrl(raw);
			if (!u || !isBrowseUrl(u)) return "";
			if (isHarnessAppShell(u)) return "";
			return u;
		}

		function toGateUrl(raw) {
			const url = normalizeUrl(raw);
			if (!url || !isBrowseUrl(url)) return "";
			if (isHarnessAppShell(url)) return "";
			if (url.startsWith("data:")) return url;
			if (url.includes("/api/browser-live/") || url.includes("/api/browser-gate/")) return url;
			try {
				const u = new URL(url);
				if (u.origin === window.location.origin) return url;
				return `${window.location.origin}/api/browser-gate/${u.protocol.replace(":", "")}/${u.host}${u.pathname}${u.search}${u.hash}`;
			} catch {
				return url;
			}
		}

		function fromGateUrl(raw) {
			try {
				const s = String(raw || "").trim();
				if (s.startsWith("data:")) return s;
				const u = new URL(s, window.location.origin);
				const m = u.pathname.match(/^\/api\/browser-gate\/(https?)\/([^/]+)(.*)$/);
				if (!m) return u.href;
				return `${m[1]}://${m[2]}${m[3] || "/"}${u.search}${u.hash}`;
			} catch {
				return String(raw || "");
			}
		}

		function stripRetiredGateUrl(raw) {
			return fromGateUrl(raw);
		}

		function switchToBrowserTab() {
			const tabs = document.querySelectorAll('[role="tab"]');
			for (const tab of tabs) {
				const label = (tab.getAttribute("data-dsh-tab-label") || tab.textContent || "").trim();
				if (label === "Browser") {
					tab.click();
					return;
				}
			}
		}

		function liveUrlFromDetail(detail) {
			if (!detail || typeof detail !== "object") return null;
			if (typeof detail.url === "string" && detail.url.trim()) {
				return normalizeUrl(detail.url.trim());
			}
			return null;
		}

		async function resolveLiveOpen(connection, detail) {
			const direct = liveUrlFromDetail(detail);
			if (direct) return direct;
			const sessionId = typeof detail?.sessionId === "string" ? detail.sessionId.trim() : "";
			const filePath = typeof detail?.path === "string" ? detail.path.trim() : "";
			if (!sessionId || !filePath || !connection) return null;
			const res = await callRpc(connection, "live.urlFor", { sessionId, path: filePath });
			return normalizeUrl(res?.url || "");
		}

		function isLegacyExampleHome(raw) {
			try {
				const u = new URL(fromGateUrl(String(raw || "").trim()));
				return u.hostname === "example.com" && (u.pathname === "/" || u.pathname === "");
			} catch {
				return false;
			}
		}

		const persisted = readPersisted();
		const persistedHistory = Array.isArray(persisted?.history)
			? persisted.history.map(sanitizeBrowseUrl).filter(Boolean)
				.map((u) => (isLegacyExampleHome(u) ? DEFAULT_HOME : u))
			: [];
		let persistedIdx = Number.isInteger(persisted?.histIdx) ? persisted.histIdx : -1;
		if (persistedHistory.length && (persistedIdx < 0 || persistedIdx >= persistedHistory.length)) {
			persistedIdx = persistedHistory.length - 1;
		}
		let persistedUrl = sanitizeBrowseUrl(persisted?.currentUrl || "")
			|| sanitizeBrowseUrl(persistedHistory[persistedIdx] || "")
			|| DEFAULT_HOME;
		if (isLegacyExampleHome(persistedUrl)) persistedUrl = DEFAULT_HOME;
		let persistedInput = sanitizeBrowseUrl(persisted?.urlInput || "")
			|| (persistedUrl.startsWith("data:") ? "" : fromGateUrl(persistedUrl))
			|| "";
		if (isLegacyExampleHome(persistedInput)) persistedInput = "";

		/** Survives tab switches (module memory) + reloads (sessionStorage). */
		const viewCache = {
			urlInput: persistedInput,
			currentUrl: toGateUrl(persistedUrl) || toGateUrl(DEFAULT_HOME),
			mode: "live",
			history: persistedHistory.length ? persistedHistory : [DEFAULT_HOME],
			histIdx: persistedHistory.length ? persistedIdx : 0,
			selections: Array.isArray(persisted?.selections) ? persisted.selections : [],
			sideOpen: persisted?.sideOpen === true,
			devtoolsOpen: false,
			dtTab: "elements",
			dtDock: persisted?.dtDock === "right" ? "right" : "bottom",
			dtHeight: typeof persisted?.dtHeight === "number" ? persisted.dtHeight : DT_SIZE.bottomDefault,
			dtWidth: typeof persisted?.dtWidth === "number" ? persisted.dtWidth : DT_SIZE.rightDefault,
			consoleLogs: [],
		};

		const IconInspect = () => React.createElement("svg", {
			width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
		},
			React.createElement("path", { d: "M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" }),
			React.createElement("path", { d: "M13 13l6 6" }),
		);

		const IconDevtools = () => React.createElement("svg", {
			width: 16, height: 16, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
		},
			React.createElement("rect", { x: 2, y: 3, width: 20, height: 14, rx: 2 }),
			React.createElement("path", { d: "M8 21h8" }),
			React.createElement("path", { d: "M12 17v4" }),
		);

		const IconPanel = () => React.createElement("svg", {
			width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
		},
			React.createElement("path", { d: "M15 18l-6-6 6-6" }),
		);

		const IconPanelOpen = () => React.createElement("svg", {
			width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
		},
			React.createElement("path", { d: "M9 18l6-6-6-6" }),
		);

		const IconDockBottom = () => React.createElement("svg", {
			width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
		},
			React.createElement("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
			React.createElement("path", { d: "M3 15h18" }),
		);

		const IconDockRight = () => React.createElement("svg", {
			width: 14, height: 14, viewBox: "0 0 24 24", fill: "none",
			stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true,
		},
			React.createElement("rect", { x: 3, y: 3, width: 18, height: 18, rx: 2 }),
			React.createElement("path", { d: "M15 3v18" }),
		);

		const css = `
.db_root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base);container-type:inline-size;container-name:db}
/* One row: nav + tools never shrink; only the URL eats leftover space. */
.db_bar{
  display:flex;
  flex-wrap:nowrap;
  align-items:center;
  gap:6px;
  padding:5px 8px;
  border-bottom:1px solid var(--dsw-alias-border-l2);
  flex-shrink:0;
  min-width:0;
  box-sizing:border-box;
  overflow:hidden;
}
.db_nav{display:flex;align-items:center;gap:4px;flex:0 0 auto}
.db_urlForm{
  display:flex;align-items:center;gap:0;
  flex:1 1 0;min-width:0;margin:0;overflow:hidden;
}
.db_tools{
  display:inline-flex;align-items:center;gap:4px;flex:0 0 auto;
  padding-left:8px;
  border-left:1px solid var(--dsw-alias-border-l2);
}
.db_btn{height:28px;padding:0 8px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;gap:4px;box-sizing:border-box;flex:none}
.db_btnIcon{width:28px;padding:0}
.db_btnGo{width:28px;padding:0;border:none;background:transparent;color:var(--dsw-alias-state-business-primary);box-shadow:none}
.db_btnGo:hover:not(:disabled){color:var(--dsw-alias-state-business-primary);filter:brightness(1.15);background:transparent}
.db_btnGo:disabled{filter:none}
.db_btnSide{padding:0 6px;min-width:28px;gap:4px}
.db_split{display:inline-flex;flex:none;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.db_split .db_btn{
  border:none;border-radius:0;height:26px;margin:0;
  background:transparent;
}
.db_split .db_btn+.db_btn{border-left:1px solid var(--dsw-alias-border-l2)}
.db_split .db_btn:disabled{opacity:.45}
.db_split .db_btnActive{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.db_splitBadge{
  min-width:16px;height:16px;padding:0 4px;border-radius:999px;
  background:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-label-primary-foreground);
  font-size:10px;font-weight:600;line-height:16px;text-align:center;
}
.db_splitBadgeMuted{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}
.db_btn:disabled{opacity:.45;cursor:not-allowed}
.db_btnActive{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.db_btnPrimary{background:transparent;color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);border-width:2px}
.db_btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.db_url{
  flex:1 1 0;width:0;min-width:0;height:28px;border-radius:8px;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);
  color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:12px;box-sizing:border-box;
  text-overflow:ellipsis;overflow:hidden;white-space:nowrap;
}
/* Typing: give the field the row; tools step aside. Idle: URL still fills leftover space. */
@container db (max-width:720px){
  .db_bar{gap:4px;padding:4px 6px}
  .db_btn,.db_url{height:26px}
  .db_btnIcon{width:26px}
  .db_split .db_btn{height:24px}
  .db_btnSide svg{display:none}
  .db_btnSide{padding:0 5px;min-width:24px}
  .db_bar:has(.db_urlForm:focus-within) .db_tools{
    display:none;
  }
}
@container db (max-width:480px){
  .db_url{padding:0 6px;font-size:11px}
}
.db_mid{flex:1 1 0;min-height:0;display:flex;flex-direction:column}
.db_mid.db_midDockRight{flex-direction:row}
.db_mid.db_midDockRight > .db_body{flex:1 1 0;min-width:0;min-height:0}
.db_body{flex:1;min-height:0;display:grid;grid-template-columns:minmax(0,1fr) 300px;grid-template-rows:minmax(0,1fr)}
.db_body.db_bodySideCollapsed{grid-template-columns:minmax(0,1fr)}
.db_frameWrap{min-height:0;overflow:hidden;background:#000;position:relative}
.db_frame{width:100%;height:100%;border:0;background:#000}
.db_frameWrap .db_empty{display:flex;align-items:center;justify-content:center;height:100%;color:var(--dsw-alias-label-tertiary);background:#000;font-size:13px}
.db_side{min-height:0;overflow:auto;border-left:1px solid var(--dsw-alias-border-l2);padding:10px;display:flex;flex-direction:column;gap:8px}
.db_sideList{flex:1 1 auto;min-height:0;overflow:auto;display:flex;flex-direction:column;gap:8px;-webkit-overflow-scrolling:touch}
.db_sideTitle{font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);display:flex;align-items:center;justify-content:space-between;gap:8px;flex:none}
.db_sideTitleActions{display:inline-flex;align-items:center;gap:6px;flex:none;margin-left:auto}
.db_sideAddAll{height:26px;padding:0 10px;font-size:11px;flex:none}
.db_sideClose{width:26px;height:26px;padding:0;font-size:14px;line-height:1;flex:none}
.db_hint{font-size:11px;color:var(--dsw-alias-label-tertiary);line-height:1.4}
.db_card{border:1px solid var(--dsw-alias-border-l2);border-radius:10px;padding:8px;background:var(--dsw-alias-bg-layer-1);font-size:11px;font-family:var(--ds-font-family-code)}
.db_cardHead{display:flex;justify-content:space-between;gap:8px;margin-bottom:4px;align-items:center}
.db_sel{color:var(--dsw-alias-state-business-primary);word-break:break-all}
.db_pre{margin:0;white-space:pre-wrap;word-break:break-word;max-height:120px;overflow:auto;color:var(--dsw-alias-label-secondary)}
.db_err{color:var(--dsw-alias-state-error-primary);padding:8px 12px;font-size:12px;flex-shrink:0}
.db_empty{color:var(--dsw-alias-label-tertiary);font-size:12px;padding:12px 0}
.db_devtools{flex:none;height:340px;border-top:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column;min-height:0;background:var(--dsw-alias-bg-layer-1);position:relative}
.db_devtools.db_devtoolsRight{height:auto !important;align-self:stretch;border-top:none;border-left:1px solid var(--dsw-alias-border-l2)}
.db_devtools.db_devtoolsCollapsed{height:32px}
.db_dtResize{position:absolute;z-index:3;background:transparent}
.db_dtResize:hover,.db_dtResize.db_dtResizeActive{background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 35%,transparent)}
.db_dtResizeBottom{left:0;right:0;top:0;height:5px;cursor:ns-resize}
.db_dtResizeRight{top:0;bottom:0;left:0;width:5px;cursor:ew-resize}
.db_dtBar{display:flex;align-items:center;gap:4px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0;flex-wrap:wrap}
.db_dtTab{height:24px;padding:0 8px;border:none;border-radius:6px;background:transparent;color:var(--dsw-alias-label-tertiary);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;gap:4px}
.db_dtTabActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.db_dtBadge{min-width:14px;height:14px;padding:0 4px;border-radius:999px;background:var(--dsw-alias-state-error-primary);color:#fff;font-size:9px;font-weight:600;line-height:14px;text-align:center}
.db_dtBadgeMuted{background:var(--dsw-alias-bg-layer-3);color:var(--dsw-alias-label-tertiary)}
.db_dtBody{flex:1;min-height:0;overflow:hidden;font-family:var(--ds-font-family-code);font-size:11px;padding:0;display:flex;flex-direction:column}
.db_dtFill{flex:1 1 0;min-height:0;min-width:0;display:flex;flex-direction:column;overflow:hidden}
.db_dtBodyPad{padding:8px;flex:1 1 0;min-height:0;overflow:auto}
.db_dtSplit{display:grid;grid-template-columns:1fr 1fr;grid-template-rows:minmax(0,1fr);flex:1 1 0;min-height:0;min-width:0;overflow:hidden}
.db_dtPane{min-height:0;min-width:0;overflow:auto;padding:6px 8px;height:100%;display:flex;flex-direction:column}
.db_dtPane+ .db_dtPane{border-left:1px solid var(--dsw-alias-border-l2)}
.db_dtPaneHtml{flex:1 1 0;min-height:0;margin:0;white-space:pre-wrap;word-break:break-word;overflow:auto;color:var(--dsw-alias-label-secondary);font:inherit}
.db_dtToolbar{display:flex;align-items:center;gap:6px;padding:4px 8px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0}
.db_dtFilter{flex:1;min-width:0;height:24px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 8px;font:inherit;font-size:11px}
.db_treeNode{padding:1px 0 1px 0;cursor:pointer;white-space:nowrap}
.db_treeNode:hover{background:var(--dsw-alias-interactive-bg-hover)}
.db_treeNodeActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-business-primary)}
.db_treeKids{padding-left:12px}
.db_tag{color:#7dd3fc}
.db_consoleLine{padding:2px 6px;border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 50%, transparent);white-space:pre-wrap;word-break:break-word;display:flex;gap:8px}
.db_consoleTs{color:var(--dsw-alias-label-tertiary);flex:none;font-variant-numeric:tabular-nums}
.db_consoleLvl{flex:none;min-width:42px;text-transform:uppercase;font-size:10px;font-weight:600}
.db_console_log .db_consoleLvl,.db_console_info .db_consoleLvl{color:var(--dsw-alias-label-secondary)}
.db_console_warn .db_consoleLvl{color:var(--dsw-alias-state-warn-label)}
.db_console_error .db_consoleLvl{color:var(--dsw-alias-state-error-primary)}
.db_console_debug .db_consoleLvl{color:var(--dsw-alias-label-tertiary)}
.db_console_log,.db_console_info{color:var(--dsw-alias-label-secondary)}
.db_console_warn{color:var(--dsw-alias-state-warn-label)}
.db_console_error{color:var(--dsw-alias-state-error-primary)}
.db_console_debug{color:var(--dsw-alias-label-tertiary)}
.db_consoleEval{display:flex;align-items:center;gap:6px;padding:4px 8px;border-top:1px solid var(--dsw-alias-border-l2);flex-shrink:0;background:var(--dsw-alias-bg-layer-2)}
.db_consoleEvalPrompt{color:var(--dsw-alias-state-business-primary);font-weight:600;flex:none}
.db_consoleEvalInput{flex:1;min-width:0;height:26px;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;outline:none}
.db_styleGroups{display:flex;flex-direction:column;gap:10px}
.db_styleGroupTitle{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-tertiary);margin-bottom:4px}
.db_styleRow{display:grid;grid-template-columns:110px 1fr;gap:6px;align-items:center;margin-bottom:4px}
.db_styleKey{color:var(--dsw-alias-label-tertiary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.db_styleInput{height:24px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 6px;font:inherit;font-size:11px;min-width:0}
.db_styleActions{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
.db_netTable{width:100%;border-collapse:collapse;font-size:11px}
.db_netTable th{text-align:left;padding:4px 6px;color:var(--dsw-alias-label-tertiary);font-weight:500;border-bottom:1px solid var(--dsw-alias-border-l2);position:sticky;top:0;background:var(--dsw-alias-bg-layer-1)}
.db_netTable td{padding:3px 6px;border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 40%, transparent);vertical-align:top}
.db_netFail td{color:var(--dsw-alias-state-error-primary)}
.db_netUrl{word-break:break-all;max-width:0}
.db_netDetail{padding:6px 8px;border-top:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-secondary);flex-shrink:0}
.db_chipRow{display:flex;flex-wrap:wrap;gap:4px}
.db_chip{height:22px;padding:0 8px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-tertiary);font-size:11px;cursor:pointer}
.db_chipActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);border-color:var(--dsw-alias-state-business-primary)}
.db_storageKV{display:grid;grid-template-columns:140px 1fr auto;gap:6px;align-items:start;padding:4px 0;border-bottom:1px solid color-mix(in srgb, var(--dsw-alias-border-l2) 40%, transparent)}
.db_storageKey{word-break:break-all;color:var(--dsw-alias-state-business-primary)}
.db_storageVal{word-break:break-word;color:var(--dsw-alias-label-secondary);white-space:pre-wrap}
@media (max-width:900px){
  .db_body{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr) auto}
  .db_body.db_bodySideCollapsed{grid-template-columns:1fr;grid-template-rows:minmax(0,1fr)}
  .db_side{
    border-left:none;
    border-top:1px solid var(--dsw-alias-border-l2);
    max-height:min(42vh,300px);
    overflow:hidden;
    flex:none;
  }
  .db_side .db_hint{flex:none}
  /* ~2 selection cards visible; the rest scroll inside the list. */
  .db_sideList{
    max-height:220px;
    overflow-x:hidden;
    overflow-y:auto;
  }
  .db_side>.db_btn{flex:none}
  .db_dtSplit{grid-template-columns:1fr}
}
`;
		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-browser-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-browser-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function normalizeUrl(raw) {
			const s = String(raw || "").trim();
			if (!s) return "";
			if (s.startsWith("data:text/html")) return s;
			if (s.startsWith("/") && !s.startsWith("//")) {
				try { return new URL(s, window.location.origin).href; } catch { return s; }
			}
			if (/^https?:\/\//i.test(s)) return s;
			return `https://${s}`;
		}

		function addressBarValue(raw) {
			const s = String(raw || "").trim();
			if (!s || s.startsWith("data:")) return "";
			return fromGateUrl(s) || s;
		}

		function formatSelection(sel) {
			const lines = [
				"### Browser element selection",
				`- **URL:** ${sel.pageUrl || ""}`,
				`- **Tag:** \`${sel.tag}\``,
				sel.selector ? `- **Selector:** \`${sel.selector}\`` : null,
				sel.text ? `- **Text:** ${sel.text.slice(0, 300)}` : null,
			].filter(Boolean);
			if (sel.attrs && Object.keys(sel.attrs).length) {
				lines.push(`- **Attrs:** \`${JSON.stringify(sel.attrs)}\``);
			}
			if (sel.html) {
				lines.push("", "```html", sel.html, "```");
			}
			return lines.join("\n");
		}

		function shortLabel(sel) {
			const tag = sel.tag || "el";
			if (sel.id) return `${tag}#${sel.id}`.slice(0, 48);
			const classes = typeof sel.classes === "string" ? sel.classes.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
			if (classes.length) return `${tag}.${classes.join(".")}`.slice(0, 48);
			const last = String(sel.selector || tag).split(">").pop()?.trim() || tag;
			return last.slice(0, 48);
		}

		function goChatTab() {
			const btn = document.querySelector('.wSkVaW_tabs [role="tab"][data-dsh-tab-label="Chat"]');
			if (btn instanceof HTMLElement) btn.click();
		}

		function isHeroPhase() {
			return !!document.querySelector(".wSkVaW_root[data-phase=hero]");
		}

		function resolveCurrentSessionId(conversation) {
			try {
				const fromConv = conversation?.sessionId
					|| conversation?.activeSessionId
					|| conversation?.active?.sessionId
					|| conversation?.active?.id
					|| conversation?.current?.sessionId
					|| conversation?.current?.id;
				if (fromConv) return fromConv;
			} catch { /* ignore */ }
			try {
				const raw = localStorage.getItem("dsh.sessions.current");
				if (!raw) return null;
				const parsed = JSON.parse(raw);
				return parsed?.sessionId || null;
			} catch {
				return null;
			}
		}

		function focusHeroComposer() {
			const ta = document.querySelector("textarea.uV2eYG_input");
			if (ta instanceof HTMLTextAreaElement) {
				ta.focus();
				try {
					const len = ta.value.length;
					ta.setSelectionRange(len, len);
				} catch { /* ignore */ }
			}
		}

		/** Last-resort plain-text insert when chip shell is unavailable. */
		function appendHeroComposerText(text) {
			const ta = document.querySelector("textarea.uV2eYG_input");
			if (!(ta instanceof HTMLTextAreaElement) || !text) return false;
			const proto = window.HTMLTextAreaElement.prototype;
			const desc = Object.getOwnPropertyDescriptor(proto, "value");
			const next = ta.value
				? (ta.value.endsWith("\n") ? ta.value + text : `${ta.value}\n\n${text}`)
				: text;
			if (desc?.set) desc.set.call(ta, next);
			else ta.value = next;
			ta.dispatchEvent(new Event("input", { bubbles: true }));
			ta.dispatchEvent(new Event("change", { bubbles: true }));
			return true;
		}

		function insertSelectionChips(conversation, sessionId, items) {
			if (!conversation?.input || !sessionId || !items?.length) return false;
			let shell;
			try {
				shell = conversation.input.shell(sessionId);
			} catch (err) {
				console.warn(`[${PLUGIN}] input shell unavailable`, err);
				return false;
			}
			let inserted = 0;
			for (const sel of items) {
				const id = (typeof crypto !== "undefined" && crypto.randomUUID)
					? crypto.randomUUID()
					: `dom-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
				const full = formatSelection(sel);
				chipPayloads.set(id, full);
				const snap = shell.snapshot;
				const ok = shell.insertReference({
					source: REF_SOURCE,
					ref: id,
					label: shortLabel(sel),
					appearance: "file",
					clipboardText: full,
				}, {
					start: snap.draft.length,
					end: snap.draft.length,
					draftRev: snap.draftRev,
				});
				if (ok) inserted += 1;
				else chipPayloads.delete(id);
			}
			return inserted > 0;
		}

		function pushHistory(url, histIdx, setHistory, setHistIdx) {
			setHistory((h) => {
				const base = histIdx >= 0 ? h.slice(0, histIdx + 1) : [];
				const next = [...base, url].slice(-40);
				setHistIdx(next.length - 1);
				return next;
			});
		}

		/** Iframe nodes are not `instanceof Element` in the parent realm — use nodeType. */
		function isElementNode(el) {
			return !!(el && el.nodeType === 1 && typeof el.tagName === "string");
		}

		function summarizeNode(el) {
			if (!isElementNode(el)) return "";
			let s = el.tagName.toLowerCase();
			if (el.id) s += `#${el.id}`;
			else if (typeof el.className === "string" && el.className.trim()) {
				s += `.${el.className.trim().split(/\s+/).slice(0, 2).join(".")}`;
			}
			return s;
		}

		function buildDomTree(doc, maxNodes = 400) {
			if (!doc?.documentElement) return [];
			let count = 0;
			const walk = (el, depth) => {
				if (!el || el.nodeType !== 1 || count >= maxNodes || depth > 12) return null;
				if (el.id === "dsh-browser-hover" || el.id === "dsh-browser-label") return null;
				count += 1;
				const kids = [];
				for (const child of el.children || []) {
					const n = walk(child, depth + 1);
					if (n) kids.push(n);
					if (count >= maxNodes) break;
				}
				return { el, label: summarizeNode(el), kids };
			};
			const root = walk(doc.documentElement, 0);
			return root ? [root] : [];
		}

		function DomTreeNode({ node, activeEl, onPick }) {
			const tag = (node.label || "").split(/[#.]/)[0];
			const [open, setOpen] = React.useState(
				(node.depth ?? 0) < 2 || tag === "body" || tag === "html",
			);
			const active = activeEl === node.el;
			const label = node.label || "?";
			return React.createElement("div", null,
				React.createElement("div", {
					className: "db_treeNode" + (active ? " db_treeNodeActive" : ""),
					style: { paddingLeft: (node.depth || 0) * 10 },
					onClick: (e) => {
						e.stopPropagation();
						onPick(node.el);
					},
				},
					node.kids.length
						? React.createElement("span", {
							onClick: (e) => { e.stopPropagation(); setOpen((v) => !v); },
							style: { display: "inline-block", width: 14, cursor: "pointer", color: "var(--dsw-alias-label-tertiary)" },
						}, open ? "▾" : "▸")
						: React.createElement("span", { style: { display: "inline-block", width: 14, color: "var(--dsw-alias-label-tertiary)" } }, "·"),
					React.createElement("span", { className: "db_tag" }, `<${label}>`),
				),
				open && node.kids.length > 0 && React.createElement("div", { className: "db_treeKids" },
					node.kids.map((k, i) => React.createElement(DomTreeNode, {
						key: `${k.label}-${i}`,
						node: { ...k, depth: (node.depth || 0) + 1 },
						activeEl,
						onPick,
					})),
				),
			);
		}

		function annotateDepth(nodes, depth = 0) {
			return nodes.map((n) => ({
				...n,
				depth,
				kids: annotateDepth(n.kids || [], depth + 1),
			}));
		}

		const STYLE_GROUPS = [
			{ title: "Typography", keys: ["font-size", "font-weight", "color", "line-height", "text-align"] },
			{ title: "Box", keys: ["padding", "margin", "width", "height"] },
			{ title: "Surface", keys: ["background-color", "border-radius", "border", "border-color", "box-shadow", "opacity"] },
		];
		const STYLE_KEYS = STYLE_GROUPS.flatMap((g) => g.keys);

		function readStyleDraft(win, el) {
			const draft = {};
			try {
				const cs = win?.getComputedStyle?.(el);
				if (!cs) return draft;
				for (const k of STYLE_KEYS) draft[k] = cs.getPropertyValue(k) || "";
			} catch { /* ignore */ }
			return draft;
		}

		function selectorForEl(el) {
			if (!isElementNode(el)) return "";
			try {
				if (el.id) return `#${CSS.escape ? CSS.escape(el.id) : el.id}`;
			} catch {
				if (el.id) return `#${el.id}`;
			}
			return summarizeNode(el);
		}

		function filterDomTree(nodes, q) {
			const needle = String(q || "").trim().toLowerCase();
			if (!needle) return nodes;
			const walk = (list) => {
				const out = [];
				for (const n of list || []) {
					const kids = walk(n.kids || []);
					const hit = String(n.label || "").toLowerCase().includes(needle);
					if (hit || kids.length) out.push({ ...n, kids });
				}
				return out;
			};
			return walk(nodes);
		}

		function formatConsoleTime(ts) {
			try {
				const d = new Date(ts || Date.now());
				return [d.getHours(), d.getMinutes(), d.getSeconds()]
					.map((n) => String(n).padStart(2, "0"))
					.join(":");
			} catch {
				return "";
			}
		}

		function shortUrl(url) {
			const s = String(url || "");
			if (s.length <= 72) return s;
			return s.slice(0, 36) + "…" + s.slice(-28);
		}

		function isLiveServerUrl(raw) {
			try {
				const u = new URL(String(raw || "").trim(), typeof window !== "undefined" ? window.location.origin : "http://localhost");
				return u.pathname.includes("/api/browser-live/");
			} catch {
				return String(raw || "").includes("/api/browser-live/");
			}
		}

		function buildStyleCssBody(draft) {
			return STYLE_KEYS
				.map((k) => {
					const v = draft?.[k];
					return v != null && String(v).trim() !== "" ? `  ${k}: ${String(v).trim()};` : null;
				})
				.filter(Boolean)
				.join("\n");
		}

		function approxCssSpecificity(sel) {
			const s = String(sel || "");
			const ids = (s.match(/#[\w-]+/g) || []).length;
			const classes = (s.match(/\.[\w-]+/g) || []).length + (s.match(/\[[^\]]+\]/g) || []).length;
			const tags = (s.match(/(^|[\s>+~])[a-zA-Z][\w-]*/g) || []).length;
			return ids * 100 + classes * 10 + tags;
		}

		/** Pick the stylesheet rule to edit (prefer real .css + modifier class like .equals). */
		function findCssSaveTarget(win, el, dirtyKeys) {
			if (!win || !el) return null;
			const doc = el.ownerDocument || win.document;
			const classList = typeof el.className === "string"
				? el.className.trim().split(/\s+/).filter(Boolean)
				: [];
			const lastClass = classList.length ? classList[classList.length - 1] : "";
			const candidates = [];

			const sheets = Array.from(doc.styleSheets || []);
			for (const sheet of sheets) {
				let href = "";
				try { href = sheet.href || ""; } catch { continue; }
				try {
					const owner = sheet.ownerNode;
					if (owner?.getAttribute?.("data-dsh-style-edits") != null) continue;
				} catch { /* ignore */ }
				if (href && !String(href).includes("/api/browser-live/") && !String(href).startsWith(win.location.origin)) {
					continue;
				}
				let rules;
				try { rules = sheet.cssRules; } catch { continue; }
				if (!rules) continue;

				for (const rule of Array.from(rules)) {
					if (!rule || rule.type !== 1) continue;
					const rawSel = String(rule.selectorText || "").trim();
					if (!rawSel || rawSel.startsWith("@")) continue;
					if (/:(hover|active|focus|visited|before|after|nth-|not\()/i.test(rawSel)) continue;

					const parts = rawSel.split(",").map((p) => p.trim()).filter(Boolean);
					let matchedSel = "";
					for (const part of parts) {
						try {
							if (el.matches(part)) {
								matchedSel = part;
								break;
							}
						} catch { /* invalid selector */ }
					}
					if (!matchedSel) continue;

					const selClasses = (matchedSel.match(/\.([\w-]+)/g) || []).map((c) => c.slice(1));
					const onlyElClasses = selClasses.length > 0 && selClasses.every((c) => classList.includes(c));
					const isLastClass = lastClass && matchedSel === `.${lastClass}`;
					const classCount = selClasses.length;
					let score = approxCssSpecificity(matchedSel);
					if (!href) score -= 40; // prefer linked .css over inline <style>
					if (onlyElClasses) score += 25;
					if (isLastClass) score += 60;
					if (classCount >= 2) score += 15;
					// Prefer tighter class selectors over broad shared ones when element has modifiers
					if (classList.length > 1 && matchedSel === `.${classList[0]}`) score -= 20;

					candidates.push({
						selector: matchedSel,
						cssUrl: href || "",
						score,
						inline: !href,
					});
				}
			}

			candidates.sort((a, b) => b.score - a.score);
			if (candidates[0]) return candidates[0];

			// Fallback: invent .lastClass (or #id) against first live stylesheet
			let cssUrl = "";
			try {
				const link = doc.querySelector?.('link[rel~="stylesheet"][href]');
				if (link?.href) cssUrl = link.href;
			} catch { /* ignore */ }
			let selector = "";
			try {
				if (el.id) selector = `#${CSS.escape ? CSS.escape(el.id) : el.id}`;
				else if (lastClass) selector = `.${lastClass}`;
			} catch {
				if (lastClass) selector = `.${lastClass}`;
			}
			if (!selector) return null;
			return { selector, cssUrl, score: 0, inline: !cssUrl };
		}

		function BrowserView({ connection, conversation, sessionId, inputActions, useInput }) {
			const [urlInput, setUrlInput] = React.useState(() => viewCache.urlInput);
			const [currentUrl, setCurrentUrl] = React.useState(() => viewCache.currentUrl);
			const [mode, setMode] = React.useState("live");
			const [history, setHistory] = React.useState(() => viewCache.history || []);
			const [histIdx, setHistIdx] = React.useState(() => viewCache.histIdx ?? -1);
			const [selectMode, setSelectMode] = React.useState(false);
			const [selections, setSelections] = React.useState(() => viewCache.selections || []);
			const [sideOpen, setSideOpen] = React.useState(() => viewCache.sideOpen === true);
			const [devtoolsOpen, setDevtoolsOpen] = React.useState(false);
			const [dtTab, setDtTab] = React.useState(() => viewCache.dtTab || "elements");
			const [dtDock, setDtDock] = React.useState(() => viewCache.dtDock === "right" ? "right" : "bottom");
			const [dtHeight, setDtHeight] = React.useState(() => {
				const n = Number(viewCache.dtHeight);
				return Number.isFinite(n) ? n : DT_SIZE.bottomDefault;
			});
			const [dtWidth, setDtWidth] = React.useState(() => {
				const n = Number(viewCache.dtWidth);
				return Number.isFinite(n) ? n : DT_SIZE.rightDefault;
			});
			const [dtResizing, setDtResizing] = React.useState(false);
			const [domTree, setDomTree] = React.useState([]);
			const [treeFilter, setTreeFilter] = React.useState("");
			const [inspectEl, setInspectEl] = React.useState(null);
			const [styleDraft, setStyleDraft] = React.useState({});
			const [styleBaseline, setStyleBaseline] = React.useState({});
			const [consoleLogs, setConsoleLogs] = React.useState(() => viewCache.consoleLogs || []);
			const [consoleFilter, setConsoleFilter] = React.useState("all");
			const [evalInput, setEvalInput] = React.useState("");
			const [networkEntries, setNetworkEntries] = React.useState([]);
			const [networkFilter, setNetworkFilter] = React.useState("all");
			const [networkSelected, setNetworkSelected] = React.useState(null);
			const [storageWhich, setStorageWhich] = React.useState("local");
			const [storageData, setStorageData] = React.useState({ localStorage: {}, sessionStorage: {}, cookies: "" });
			const [styleSaveMsg, setStyleSaveMsg] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState("");
			const iframeRef = React.useRef(null);
			const midRef = React.useRef(null);
			const histIdxRef = React.useRef(histIdx);
			const loadGenRef = React.useRef(0);
			const selectModeRef = React.useRef(false);
			const consoleEndRef = React.useRef(null);
			const dtTabRef = React.useRef(dtTab);
			const draft = useInput ? useInput((s) => s?.draft ?? "") : "";

			React.useEffect(() => { histIdxRef.current = histIdx; }, [histIdx]);
			React.useEffect(() => { selectModeRef.current = selectMode; }, [selectMode]);
			React.useEffect(() => { dtTabRef.current = dtTab; }, [dtTab]);

			React.useEffect(() => {
				viewCache.urlInput = urlInput;
				viewCache.currentUrl = currentUrl;
				viewCache.mode = mode;
				viewCache.history = history;
				viewCache.histIdx = histIdx;
				viewCache.selections = selections;
				viewCache.sideOpen = sideOpen;
				viewCache.devtoolsOpen = devtoolsOpen;
				viewCache.dtTab = dtTab;
				viewCache.dtDock = dtDock;
				viewCache.dtHeight = dtHeight;
				viewCache.dtWidth = dtWidth;
				viewCache.consoleLogs = consoleLogs;
				writePersisted({
					urlInput,
					currentUrl,
					mode,
					history,
					histIdx,
					selections,
					sideOpen,
					dtDock,
					dtHeight,
					dtWidth,
				});
			}, [urlInput, currentUrl, mode, history, histIdx, selections, sideOpen, devtoolsOpen, dtTab, dtDock, dtHeight, dtWidth, consoleLogs]);

			React.useEffect(() => {
				if (!inspectEl) {
					setStyleDraft({});
					setStyleBaseline({});
					setStyleSaveMsg("");
					return;
				}
				const draft = readStyleDraft(iframeRef.current?.contentWindow, inspectEl);
				setStyleDraft(draft);
				setStyleBaseline(draft);
				setStyleSaveMsg("");
			}, [inspectEl]);

			function buildChangedStyleCssBody(draft, baseline) {
				return STYLE_KEYS
					.map((k) => {
						const v = draft?.[k];
						if (v == null || String(v).trim() === "") return null;
						const b = baseline?.[k] ?? "";
						if (String(v).trim() === String(b).trim()) return null;
						return `  ${k}: ${String(v).trim()};`;
					})
					.filter(Boolean)
					.join("\n");
			}

			const livePageUrl = React.useMemo(() => {
				for (const c of [currentUrl, urlInput]) {
					const s = String(c || "").trim();
					if (!s || !isLiveServerUrl(s)) continue;
					try {
						return new URL(s, window.location.origin).href;
					} catch {
						return s;
					}
				}
				return "";
			}, [currentUrl, urlInput]);

			React.useEffect(() => {
				if (dtTab !== "console") return;
				try { consoleEndRef.current?.scrollIntoView?.({ block: "end" }); } catch { /* ignore */ }
			}, [consoleLogs, dtTab]);

			const onDtResizeStart = React.useCallback((e) => {
				e.preventDefault();
				e.stopPropagation();
				const dock = dtDock;
				const startX = e.clientX;
				const startY = e.clientY;
				const startH = dtHeight;
				const startW = dtWidth;
				const midRect = midRef.current?.getBoundingClientRect?.();
				const maxH = midRect
					? Math.max(DT_SIZE.bottomMin, Math.min(DT_SIZE.bottomMax, Math.floor(midRect.height * 0.85)))
					: DT_SIZE.bottomMax;
				const maxW = midRect
					? Math.max(DT_SIZE.rightMin, Math.min(DT_SIZE.rightMax, Math.floor(midRect.width * 0.7)))
					: DT_SIZE.rightMax;
				setDtResizing(true);
				const prevCursor = document.body.style.cursor;
				const prevSelect = document.body.style.userSelect;
				document.body.style.cursor = dock === "right" ? "ew-resize" : "ns-resize";
				document.body.style.userSelect = "none";
				const onMove = (ev) => {
					if (dock === "right") {
						const next = Math.round(startW - (ev.clientX - startX));
						setDtWidth(Math.max(DT_SIZE.rightMin, Math.min(maxW, next)));
					} else {
						const next = Math.round(startH - (ev.clientY - startY));
						setDtHeight(Math.max(DT_SIZE.bottomMin, Math.min(maxH, next)));
					}
				};
				const onUp = () => {
					setDtResizing(false);
					document.body.style.cursor = prevCursor;
					document.body.style.userSelect = prevSelect;
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
			}, [dtDock, dtHeight, dtWidth]);

			const consoleErrorCount = React.useMemo(
				() => consoleLogs.filter((l) => l.level === "error").length,
				[consoleLogs],
			);
			const networkFailCount = React.useMemo(
				() => networkEntries.filter((e) => !e.ok || (e.status >= 400)).length,
				[networkEntries],
			);
			const filteredDomTree = React.useMemo(
				() => filterDomTree(domTree, treeFilter),
				[domTree, treeFilter],
			);
			const filteredConsole = React.useMemo(() => {
				if (consoleFilter === "all") return consoleLogs;
				if (consoleFilter === "errors") return consoleLogs.filter((l) => l.level === "error");
				if (consoleFilter === "warnings") return consoleLogs.filter((l) => l.level === "warn");
				return consoleLogs.filter((l) => l.level === "log" || l.level === "info" || l.level === "debug");
			}, [consoleLogs, consoleFilter]);
			const filteredNetwork = React.useMemo(() => {
				if (networkFilter === "failed") return networkEntries.filter((e) => !e.ok || e.status >= 400);
				if (networkFilter === "fetch") return networkEntries.filter((e) => e.source === "fetch" || e.source === "xhr" || e.type === "fetch");
				return networkEntries;
			}, [networkEntries, networkFilter]);

			/** Same-origin / srcdoc only — cross-origin live iframes throw. */
			const readFrameUrl = React.useCallback(() => {
				try {
					const href = iframeRef.current?.contentWindow?.location?.href;
					if (!href || href === "about:blank" || href === "about:srcdoc") return "";
					return href;
				} catch {
					return "";
				}
			}, []);

			const resolveActiveUrl = React.useCallback(() => {
				return readFrameUrl() || normalizeUrl(urlInput) || currentUrl || "";
			}, [readFrameUrl, urlInput, currentUrl]);

			const postSelectMode = React.useCallback((enabled) => {
				const win = iframeRef.current?.contentWindow;
				const doc = iframeRef.current?.contentDocument;
				if (!win) return;
				const on = !!enabled;
				try {
					const st = win.__dshBrowserPicker;
					if (st) {
						st.select = on;
						if (doc?.documentElement) {
							doc.documentElement.style.cursor = on ? "crosshair" : "";
						}
						if (!on) {
							st.hover = null;
							const box = doc?.getElementById("dsh-browser-hover");
							const label = doc?.getElementById("dsh-browser-label");
							if (box) box.style.display = "none";
							if (label) label.style.display = "none";
						}
					}
				} catch {
					/* cross-origin */
				}
				try {
					win.postMessage({ type: "dsh-browser-set-select", enabled: on }, "*");
				} catch {
					/* ignore */
				}
			}, []);

			const refreshDomTree = React.useCallback(() => {
				try {
					const doc = iframeRef.current?.contentDocument;
					if (!doc) {
						setDomTree([]);
						return;
					}
					setDomTree(annotateDepth(buildDomTree(doc)));
				} catch {
					setDomTree([]);
				}
			}, []);

			const loadLive = React.useCallback((raw, { push = true } = {}) => {
				const requested = fromGateUrl(normalizeUrl(raw));
				const selfNav = isHarnessAppShell(requested);
				const publicUrl = selfNav ? DEFAULT_HOME : requested;
				const frameUrl = toGateUrl(publicUrl);
				if (!frameUrl || !isBrowseUrl(frameUrl)) return;
				loadGenRef.current += 1;
				setError(selfNav
					? "Can’t open the Harness UI inside Browser (inception). Loading a blank page instead."
					: "");
				selectModeRef.current = false;
				setSelectMode(false);
				setDevtoolsOpen(false);
				setMode("live");
				setInspectEl(null);
				setDomTree([]);
				setConsoleLogs([]);
				setNetworkEntries([]);
				setNetworkSelected(null);
				setStorageData({ localStorage: {}, sessionStorage: {}, cookies: "" });
				setStyleDraft({});
				setTreeFilter("");
				setCurrentUrl(frameUrl);
				setUrlInput(addressBarValue(publicUrl));
				writePersisted({ urlInput: addressBarValue(publicUrl), currentUrl: frameUrl, mode: "live" });
				if (push) pushHistory(publicUrl, histIdxRef.current, setHistory, setHistIdx);
			}, []);

			React.useEffect(() => {
				const onPending = (url) => {
					if (url) loadLive(url, { push: true });
				};
				pendingOpen.listeners.add(onPending);
				if (pendingOpen.url) {
					const u = pendingOpen.url;
					pendingOpen.url = null;
					loadLive(u, { push: true });
				}
				return () => pendingOpen.listeners.delete(onPending);
			}, [loadLive]);

			React.useEffect(() => { ensureStyles(); }, []);

			React.useEffect(() => {
				const onMsg = (ev) => {
					const data = ev.data || {};
					if (data.type === "dsh-browser-ready") {
						postSelectMode(selectModeRef.current);
						setTimeout(refreshDomTree, 50);
					}
					if (data.type === "dsh-browser-navigate" && data.url) {
						if (!isBrowseUrl(data.url) && !isHttpUrl(data.url)) return;
						loadLive(data.url, { push: true });
					}
					if (data.type === "dsh-browser-locate" && data.url) {
						const pub = fromGateUrl(data.url);
						if (!pub) return;
						setUrlInput(pub);
						writePersisted({ urlInput: pub, mode: "live" });
					}
					if (data.type === "dsh-browser-select" && data.selection) {
						const selection = {
							...data.selection,
							pageUrl: fromGateUrl(data.selection.pageUrl || "") || data.selection.pageUrl,
						};
						setSelections((prev) => [selection, ...prev].slice(0, 20));
						setSideOpen(true);
						try {
							const sel = data.selection.selector;
							const doc = iframeRef.current?.contentDocument;
							const el = sel && doc?.querySelector?.(sel);
							if (el) {
								setInspectEl(el);
								if (selectModeRef.current) {
									setDevtoolsOpen(true);
									if (dtTabRef.current !== "elements" && dtTabRef.current !== "styles") {
										setDtTab("styles");
									}
								}
							}
						} catch { /* ignore */ }
					}
					if (data.type === "dsh-browser-console") {
						setConsoleLogs((prev) => [...prev, {
							level: data.level || "log",
							text: (data.args || []).join(" "),
							ts: data.ts || Date.now(),
						}].slice(-300));
					}
					if (data.type === "dsh-browser-network") {
						setNetworkEntries((prev) => [...prev, {
							id: `${data.ts || Date.now()}-${prev.length}`,
							method: data.method || "GET",
							url: data.url || "",
							status: data.status ?? 0,
							ok: data.ok !== false && !(data.status >= 400),
							type: data.type || "other",
							duration: data.duration || 0,
							source: data.source || "",
							error: data.error || "",
							ts: data.ts || Date.now(),
						}].slice(-250));
					}
					if (data.type === "dsh-browser-eval-result" && data.evalId) {
						setConsoleLogs((prev) => [...prev, {
							level: data.error ? "error" : "log",
							text: data.error
								? String(data.error)
								: `← ${data.result === undefined ? "undefined" : data.result}`,
							ts: Date.now(),
						}].slice(-300));
					}
					if (data.type === "dsh-browser-storage-result" && data.requestId) {
						if (data.localStorage || data.sessionStorage || data.cookies != null) {
							setStorageData({
								localStorage: data.localStorage || {},
								sessionStorage: data.sessionStorage || {},
								cookies: data.cookies || "",
							});
						}
					}
					if (data.type === "dsh-browser-dom-action-result" && data.actionId) {
						window.dispatchEvent(new CustomEvent("dsh-browser-action-response-" + data.actionId, { detail: data }));
					}
				};
				window.addEventListener("message", onMsg);
				return () => window.removeEventListener("message", onMsg);
			}, [loadLive, postSelectMode, refreshDomTree]);

			// Agent / RPC bridge: listen for automation actions directed to the current browser iframe
			React.useEffect(() => {
				const onAgentAction = (e) => {
					const { actionId, action, selector, value } = e.detail || {};
					if (!actionId || !action) return;
					const win = iframeRef.current?.contentWindow;
					if (!win) {
						window.dispatchEvent(new CustomEvent("dsh-browser-action-response-" + actionId, {
							detail: { actionId, ok: false, error: "Browser frame not active or mounted" }
						}));
						return;
					}
					try {
						win.postMessage({
							type: "dsh-browser-dom-action",
							actionId,
							action,
							selector,
							value,
						}, "*");
					} catch (err) {
						window.dispatchEvent(new CustomEvent("dsh-browser-action-response-" + actionId, {
							detail: { actionId, ok: false, error: err?.message || String(err) }
						}));
					}
				};

				window.addEventListener("dsh-browser-perform-action", onAgentAction);
				return () => window.removeEventListener("dsh-browser-perform-action", onAgentAction);
			}, []);

			React.useEffect(() => {
				postSelectMode(selectMode);
				if (selectMode) {
					const t = setTimeout(refreshDomTree, 100);
					return () => clearTimeout(t);
				}
			}, [selectMode, postSelectMode, refreshDomTree]);

			/** Ensure the live iframe has a document (and picker script when possible). Does not enable inspect. */
			const ensurePageReady = async () => {
				try {
					const doc = iframeRef.current?.contentDocument;
					const win = iframeRef.current?.contentWindow;
					if (doc && win && doc.documentElement) {
						return true;
					}
				} catch {
					/* cross-origin */
				}
				const url = fromGateUrl(urlInput || resolveActiveUrl() || currentUrl);
				if (!url) {
					setError("Load a page first (enter a URL and press Go).");
					return false;
				}
				loadLive(url, { push: false });
				return true;
			};

			/** Ready for element picking: page loaded + inspect mode armed in the iframe. */
			const ensurePickMode = async () => {
				try {
					const doc = iframeRef.current?.contentDocument;
					const win = iframeRef.current?.contentWindow;
					if (doc && win && doc.documentElement) {
						if (!win.__dshBrowserPicker) {
							setError("Picker not injected — press Go to reload through the gate.");
							return false;
						}
						return true;
					}
				} catch {
					/* cross-origin */
				}
				const url = fromGateUrl(urlInput || resolveActiveUrl() || currentUrl);
				if (!url) {
					setError("Load a page first (enter a URL and press Go).");
					return false;
				}
				loadLive(url, { push: false });
				return true;
			};

			const stopInspect = React.useCallback(() => {
				selectModeRef.current = false;
				setSelectMode(false);
				postSelectMode(false);
			}, [postSelectMode]);

			const toggleInspect = async () => {
				if (selectMode) {
					stopInspect();
					setError("");
					return;
				}
				const ok = await ensurePickMode();
				if (!ok) return;
				selectModeRef.current = true;
				setError("");
				setSelectMode(true);
				setSideOpen(true);
				postSelectMode(true);
				setTimeout(() => postSelectMode(true), 100);
				setTimeout(() => postSelectMode(true), 400);
				setTimeout(refreshDomTree, 50);
			};

			const toggleDevtools = async () => {
				if (devtoolsOpen) {
					setDevtoolsOpen(false);
					// Resync iframe picker with the Inspect-button state (clears stray enable from older builds).
					postSelectMode(!!selectModeRef.current);
					return;
				}
				const ok = await ensurePageReady();
				if (!ok) return;
				setError("");
				setDevtoolsOpen(true);
				// Do NOT enable page inspect — Elements tree works without the crosshair.
				postSelectMode(!!selectModeRef.current);
				setTimeout(refreshDomTree, 120);
			};

			const requestStorage = React.useCallback(() => {
				try {
					iframeRef.current?.contentWindow?.postMessage({
						type: "dsh-browser-storage-list",
						requestId: `st-${Date.now()}`,
					}, "*");
				} catch { /* ignore */ }
			}, []);

			React.useEffect(() => {
				if (!devtoolsOpen || dtTab !== "storage") return undefined;
				requestStorage();
				const id = setInterval(requestStorage, 2500);
				return () => clearInterval(id);
			}, [devtoolsOpen, dtTab, currentUrl, requestStorage]);

			const runEval = () => {
				const code = String(evalInput || "").trim();
				if (!code) return;
				const evalId = `ev-${Date.now()}`;
				setConsoleLogs((prev) => [...prev, {
					level: "log",
					text: `> ${code}`,
					ts: Date.now(),
				}].slice(-300));
				setEvalInput("");
				try {
					iframeRef.current?.contentWindow?.postMessage({
						type: "dsh-browser-eval",
						evalId,
						code,
					}, "*");
				} catch (err) {
					setConsoleLogs((prev) => [...prev, {
						level: "error",
						text: err?.message || String(err),
						ts: Date.now(),
					}].slice(-300));
				}
			};

			const applyStyles = () => {
				if (!inspectEl) return;
				try {
					for (const k of STYLE_KEYS) {
						const v = styleDraft[k];
						if (v == null || String(v).trim() === "") continue;
						inspectEl.style.setProperty(k, String(v).trim());
					}
					setStyleDraft(readStyleDraft(iframeRef.current?.contentWindow, inspectEl));
				} catch (err) {
					setError(err?.message || "Failed to apply styles");
				}
			};

			const resetStyles = () => {
				if (!inspectEl) return;
				try {
					for (const k of STYLE_KEYS) inspectEl.style.removeProperty(k);
					setStyleDraft(readStyleDraft(iframeRef.current?.contentWindow, inspectEl));
				} catch { /* ignore */ }
			};

			const copyAppliedCss = async () => {
				const block = buildStyleCssBody(styleDraft);
				const text = block ? `{\n${block}\n}` : "";
				try {
					await navigator.clipboard?.writeText?.(text);
				} catch { /* ignore */ }
			};

			const saveStylesToLive = async () => {
				if (!inspectEl) return;
				if (!livePageUrl) {
					setStyleSaveMsg("Only works with Live Server pages");
					return;
				}
				const css = buildChangedStyleCssBody(styleDraft, styleBaseline);
				if (!css) {
					setStyleSaveMsg("Nothing changed — edit a value first");
					return;
				}
				const dirtyKeys = STYLE_KEYS.filter((k) => {
					const v = String(styleDraft[k] ?? "").trim();
					const b = String(styleBaseline[k] ?? "").trim();
					return v !== b && v !== "";
				});
				const win = iframeRef.current?.contentWindow;
				const target = findCssSaveTarget(win, inspectEl, dirtyKeys);
				if (!target?.selector) {
					setStyleSaveMsg("Could not find a CSS rule to update");
					return;
				}
				setStyleSaveMsg("Saving…");
				try {
					applyStyles();
					const res = await callRpc(connection, "style.saveToLive", {
						url: livePageUrl,
						selector: target.selector,
						cssUrl: target.cssUrl || "",
						css,
					});
					setStyleBaseline({ ...styleDraft });
					setStyleSaveMsg(`Saved ${target.selector} → ${res?.rel || "style.css"}`);
				} catch (err) {
					setStyleSaveMsg(err?.message || String(err));
				}
			};

			const copySelector = async () => {
				const sel = selectorForEl(inspectEl);
				if (!sel) return;
				try { await navigator.clipboard?.writeText?.(sel); } catch { /* ignore */ }
			};

			const back = () => {
				if (histIdx <= 0) return;
				const next = histIdx - 1;
				setHistIdx(next);
				const url = history[next];
				if (url) loadLive(url, { push: false });
			};
			const forward = () => {
				if (histIdx >= history.length - 1) return;
				const next = histIdx + 1;
				setHistIdx(next);
				const url = history[next];
				if (url) loadLive(url, { push: false });
			};
			const reload = () => {
				const url = fromGateUrl(resolveActiveUrl() || urlInput || currentUrl);
				if (url) loadLive(url, { push: false });
			};

			const addToChat = (items) => {
				if (!items?.length) return;
				const page = resolveActiveUrl() || currentUrl;
				const normalized = items.map((sel) => ({
					...sel,
					pageUrl: (!sel.pageUrl || sel.pageUrl === "about:srcdoc") ? (page || sel.pageUrl) : sel.pageUrl,
				}));
				const sid = sessionId || resolveCurrentSessionId(conversation);
				const ok = insertSelectionChips(conversation, sid, normalized);
				if (!ok) {
					const block = normalized.map(formatSelection).join("\n\n");
					const prefix = draft && !String(draft).endsWith("\n") ? `${draft}\n\n` : (draft || "");
					if (inputActions?.setDraft) inputActions.setDraft(prefix + block + "\n");
					else if (isHeroPhase() && appendHeroComposerText(block)) {
						/* hero textarea */
					} else {
						try { navigator.clipboard?.writeText?.(block); } catch { /* ignore */ }
					}
				}
				if (isHeroPhase()) {
					window.dispatchEvent(new CustomEvent("dsh-hero-close-tool"));
					requestAnimationFrame(() => focusHeroComposer());
				} else {
					goChatTab();
				}
			};

			const onPickDomEl = (el) => {
				setInspectEl(el);
				try {
					el.scrollIntoView?.({ block: "nearest", behavior: "smooth" });
				} catch { /* ignore */ }
			};

			const showFrame = !!currentUrl;
			const hasUrl = !!(currentUrl || normalizeUrl(urlInput));

			const onFrameLoad = () => {
				// Address bar only — never setCurrentUrl (that remounts and kills Inspect).
				const href = readFrameUrl();
				if (href && isBrowseUrl(href)) {
					const pub = fromGateUrl(href);
					if (pub && pub !== urlInput) {
						setUrlInput(pub);
						writePersisted({ urlInput: pub, mode: "live" });
					}
				}
				if (selectModeRef.current) {
					postSelectMode(true);
					setTimeout(() => postSelectMode(true), 50);
				}
				if (devtoolsOpen || selectModeRef.current) {
					setTimeout(refreshDomTree, 80);
					setTimeout(refreshDomTree, 400);
				}
			};

			React.useEffect(() => {
				if (!devtoolsOpen || (dtTab !== "elements" && dtTab !== "styles")) return undefined;
				refreshDomTree();
				const id = setInterval(refreshDomTree, 2000);
				return () => clearInterval(id);
			}, [devtoolsOpen, dtTab, currentUrl, refreshDomTree]);

			if (!connection) {
				return React.createElement("div", { className: "db_err" }, "Browser: connection unavailable");
			}

			return React.createElement("div", { className: "db_root" },
				React.createElement("div", { className: "db_bar" },
					React.createElement("div", { className: "db_nav" },
						React.createElement("div", {
							className: "db_split",
							role: "group",
							"aria-label": "History",
						},
							React.createElement("button", {
								type: "button",
								className: "db_btn db_btnIcon",
								disabled: histIdx <= 0 || busy,
								onClick: back,
								title: "Back",
							}, "←"),
							React.createElement("button", {
								type: "button",
								className: "db_btn db_btnIcon db_navFwd",
								disabled: histIdx >= history.length - 1 || busy,
								onClick: forward,
								title: "Forward",
							}, "→"),
						),
						React.createElement("button", {
							type: "button",
							className: "db_btn db_btnIcon",
							disabled: busy || !hasUrl,
							onClick: reload,
							title: "Reload",
						}, "↻"),
					),
					React.createElement("form", {
						className: "db_urlForm",
						onSubmit: (e) => {
							e.preventDefault();
							const url = normalizeUrl(urlInput);
							if (!url || !isBrowseUrl(url)) return;
							loadLive(url, { push: true });
						},
					},
						React.createElement("input", {
							className: "db_url",
							value: urlInput,
							onChange: (e) => setUrlInput(e.target.value),
							placeholder: "https://…",
							spellCheck: false,
						}),
						React.createElement("button", {
							type: "submit",
							className: "db_btn db_btnGo",
							disabled: busy,
							title: busy ? "Loading…" : "Go",
							"aria-label": busy ? "Loading" : "Go",
						}, React.createElement(IconPanelOpen)),
					),
					React.createElement("div", { className: "db_tools" },
						React.createElement("div", {
							className: "db_split",
							role: "group",
							"aria-label": "Inspect and selections",
						},
							React.createElement("button", {
								type: "button",
								className: "db_btn db_btnIcon" + (selectMode ? " db_btnActive" : ""),
								disabled: busy || !hasUrl,
								onClick: toggleInspect,
								title: selectMode
									? "Stop inspecting"
									: "Inspect element (opens selections panel)",
							}, React.createElement(IconInspect)),
							React.createElement("button", {
								type: "button",
								className: "db_btn db_btnSide" + (sideOpen ? " db_btnActive" : ""),
								onClick: () => setSideOpen((v) => !v),
								title: sideOpen
									? "Hide selections"
									: (selections.length
										? `Show selections (${selections.length})`
										: "Show selections"),
							},
								sideOpen ? React.createElement(IconPanel) : React.createElement(IconPanelOpen),
								React.createElement("span", {
									className: "db_splitBadge" + (selections.length ? "" : " db_splitBadgeMuted"),
								}, String(selections.length)),
							),
						),
						React.createElement("button", {
							type: "button",
							className: "db_btn db_btnIcon" + (devtoolsOpen ? " db_btnActive" : ""),
							disabled: busy || !hasUrl,
							onClick: toggleDevtools,
							title: "DevTools",
						}, React.createElement(IconDevtools)),
					),
				),
				error && React.createElement("div", { className: "db_err" }, error),
				React.createElement("div", {
					className: "db_mid" + (devtoolsOpen && dtDock === "right" ? " db_midDockRight" : ""),
					ref: midRef,
				},
					React.createElement("div", { className: "db_body" + (sideOpen ? "" : " db_bodySideCollapsed") },
						React.createElement("div", { className: "db_frameWrap" },
							showFrame
								? React.createElement("iframe", {
									key: `live:${currentUrl}`,
									ref: iframeRef,
									className: "db_frame",
									title: "Browser",
									onLoad: onFrameLoad,
									src: currentUrl,
									referrerPolicy: "no-referrer-when-downgrade",
								})
								: React.createElement("div", {
									className: "db_empty",
									style: { padding: 24 },
								}, busy && hasUrl
									? `Loading ${currentUrl || urlInput}…`
									: hasUrl
										? "Page failed to load — use Reload or pick a history entry."
										: "Enter a URL and press Go."),
						),
						sideOpen && React.createElement("div", { className: "db_side" },
							React.createElement("div", { className: "db_sideTitle" },
								React.createElement("span", null, `Selections (${selections.length})`),
								React.createElement("div", { className: "db_sideTitleActions" },
									React.createElement("button", {
										type: "button",
										className: "db_btn db_sideClose",
										onClick: () => setSideOpen(false),
										title: "Close selections",
										"aria-label": "Close selections",
									}, "×"),
									React.createElement("button", {
										type: "button",
										className: "db_btn db_btnPrimary db_sideAddAll",
										disabled: !selections.length,
										onClick: () => addToChat(selections),
									}, "Add to chat"),
								),
							),
							React.createElement("div", { className: "db_hint" },
								"Inspect picks elements on the live page. Add to chat inserts @chips — full HTML/CSS expands when you send."),
							React.createElement("div", { className: "db_sideList" },
								!selections.length && React.createElement("div", { className: "db_empty" }, "No selections yet."),
								selections.map((sel, i) => React.createElement("div", { key: i, className: "db_card" },
									React.createElement("div", { className: "db_cardHead" },
										React.createElement("span", { className: "db_sel" }, sel.selector || sel.tag),
										React.createElement("button", {
											type: "button",
											className: "db_btn",
											onClick: () => setSelections((prev) => prev.filter((_, j) => j !== i)),
										}, "×"),
									),
									sel.text && React.createElement("div", { className: "db_pre" }, sel.text.slice(0, 160)),
									React.createElement("button", {
										type: "button",
										className: "db_btn",
										style: { marginTop: 6, alignSelf: "flex-start" },
										onClick: () => addToChat([sel]),
									}, "Add this"),
								)),
							),
							selections.length > 0 && React.createElement("button", {
								type: "button",
								className: "db_btn",
								onClick: () => setSelections([]),
							}, "Clear all"),
						),
					),
					devtoolsOpen && React.createElement("div", {
						className: "db_devtools" + (dtDock === "right" ? " db_devtoolsRight" : ""),
						style: dtDock === "right"
							? { width: dtWidth, flex: `0 0 ${dtWidth}px` }
							: { height: dtHeight },
					},
						React.createElement("div", {
							className: "db_dtResize "
								+ (dtDock === "right" ? "db_dtResizeRight" : "db_dtResizeBottom")
								+ (dtResizing ? " db_dtResizeActive" : ""),
							onPointerDown: onDtResizeStart,
							title: "Drag to resize",
							role: "separator",
							"aria-orientation": dtDock === "right" ? "vertical" : "horizontal",
						}),
						React.createElement("div", { className: "db_dtBar" },
							React.createElement("button", {
								type: "button",
								className: "db_btn db_btnIcon" + (selectMode ? " db_btnActive" : ""),
								style: { width: 24, height: 24 },
								disabled: busy || !hasUrl,
								onClick: async () => {
									if (!selectMode && (dtTab !== "elements" && dtTab !== "styles")) {
										setDtTab("elements");
									}
									await toggleInspect();
								},
								title: selectMode
									? "Stop inspecting"
									: "Inspect element (pick on the page)",
								"aria-label": selectMode ? "Stop inspecting" : "Inspect element",
							}, React.createElement(IconInspect)),
							React.createElement("button", {
								type: "button",
								className: "db_dtTab" + (dtTab === "elements" ? " db_dtTabActive" : ""),
								onClick: () => {
									setDtTab("elements");
									refreshDomTree();
								},
							}, "Elements"),
							React.createElement("button", {
								type: "button",
								className: "db_dtTab" + (dtTab === "styles" ? " db_dtTabActive" : ""),
								onClick: () => setDtTab("styles"),
							}, "Styles"),
							React.createElement("button", {
								type: "button",
								className: "db_dtTab" + (dtTab === "console" ? " db_dtTabActive" : ""),
								onClick: () => {
									setDtTab("console");
									postSelectMode(!!selectModeRef.current);
								},
							},
								"Console",
								consoleErrorCount > 0 && React.createElement("span", { className: "db_dtBadge" }, String(consoleErrorCount > 99 ? "99+" : consoleErrorCount)),
							),
							React.createElement("button", {
								type: "button",
								className: "db_dtTab" + (dtTab === "network" ? " db_dtTabActive" : ""),
								onClick: () => setDtTab("network"),
							},
								"Network",
								networkFailCount > 0
									? React.createElement("span", { className: "db_dtBadge" }, String(networkFailCount > 99 ? "99+" : networkFailCount))
									: (networkEntries.length > 0 && React.createElement("span", { className: "db_dtBadge db_dtBadgeMuted" }, String(networkEntries.length > 99 ? "99+" : networkEntries.length))),
							),
							React.createElement("button", {
								type: "button",
								className: "db_dtTab" + (dtTab === "storage" ? " db_dtTabActive" : ""),
								onClick: () => {
									setDtTab("storage");
									requestStorage();
								},
							}, "Storage"),
							React.createElement("span", { style: { flex: 1 } }),
							dtTab === "console" && React.createElement("button", {
								type: "button",
								className: "db_btn",
								onClick: () => setConsoleLogs([]),
							}, "Clear"),
							dtTab === "network" && React.createElement("button", {
								type: "button",
								className: "db_btn",
								onClick: () => {
									setNetworkEntries([]);
									setNetworkSelected(null);
								},
							}, "Clear"),
							React.createElement("button", {
								type: "button",
								className: "db_btn db_btnIcon",
								onClick: () => setDtDock((d) => d === "right" ? "bottom" : "right"),
								title: dtDock === "right" ? "Dock DevTools to bottom" : "Dock DevTools to right",
								"aria-label": dtDock === "right" ? "Dock to bottom" : "Dock to right",
							}, dtDock === "right"
								? React.createElement(IconDockBottom)
								: React.createElement(IconDockRight)),
							React.createElement("button", {
								type: "button",
								className: "db_btn",
								onClick: () => {
									setDevtoolsOpen(false);
									postSelectMode(!!selectModeRef.current);
								},
							}, "Close"),
						),
						React.createElement("div", { className: "db_dtBody" },
							dtTab === "elements" && React.createElement("div", { className: "db_dtFill" },
								React.createElement("div", { className: "db_dtToolbar" },
									React.createElement("input", {
										className: "db_dtFilter",
										value: treeFilter,
										onChange: (e) => setTreeFilter(e.target.value),
										placeholder: "Filter DOM (tag, id, class)…",
										spellCheck: false,
									}),
									inspectEl && React.createElement("button", {
										type: "button",
										className: "db_btn",
										onClick: copySelector,
										title: "Copy selector",
									}, "Copy sel"),
								),
								React.createElement("div", { className: "db_dtSplit" },
									React.createElement("div", { className: "db_dtPane" },
										!filteredDomTree.length && React.createElement("div", { className: "db_empty" },
											domTree.length ? "No nodes match filter." : "DOM not available yet — reload the page or wait for Live to finish loading."),
										filteredDomTree.map((n, i) => React.createElement(DomTreeNode, {
											key: i,
											node: n,
											activeEl: inspectEl,
											onPick: onPickDomEl,
										})),
									),
									React.createElement("div", { className: "db_dtPane" },
										!inspectEl && React.createElement("div", { className: "db_empty" }, "Select a node in the tree (or use Inspect on the page). Open Styles to edit CSS."),
										inspectEl && React.createElement(React.Fragment, null,
											React.createElement("div", { className: "db_sideTitle", style: { flex: "none" } }, summarizeNode(inspectEl)),
											React.createElement("pre", { className: "db_dtPaneHtml" },
												(() => {
													try {
														const h = inspectEl.outerHTML || "";
														return h.length > 1200 ? h.slice(0, 1200) + "…" : h;
													} catch { return ""; }
												})(),
											),
											React.createElement("div", { className: "db_styleActions", style: { flex: "none", marginTop: 8 } },
												React.createElement("button", {
													type: "button",
													className: "db_btn",
													onClick: () => setDtTab("styles"),
												}, "Edit styles"),
												React.createElement("button", {
													type: "button",
													className: "db_btn db_btnPrimary",
													onClick: () => {
														try {
															const sel = {
																tag: inspectEl.tagName.toLowerCase(),
																selector: selectorForEl(inspectEl) || summarizeNode(inspectEl),
																id: inspectEl.id || null,
																classes: typeof inspectEl.className === "string" ? inspectEl.className : null,
																text: (inspectEl.innerText || "").trim().slice(0, 500),
																attrs: {},
																html: (inspectEl.outerHTML || "").slice(0, 4000),
																pageUrl: currentUrl,
															};
															setSelections((prev) => [sel, ...prev].slice(0, 20));
															setSideOpen(true);
														} catch { /* ignore */ }
													},
												}, "Add selection"),
											),
										),
									),
								),
							),
							dtTab === "styles" && React.createElement("div", { className: "db_dtBodyPad" },
								!inspectEl && React.createElement("div", { className: "db_empty" },
									"Use Inspect (crosshair) or pick a node in Elements, then edit typography, box, and surface styles here."),
								inspectEl && React.createElement(React.Fragment, null,
									React.createElement("div", { className: "db_sideTitle" },
										React.createElement("span", null, summarizeNode(inspectEl)),
										React.createElement("button", {
											type: "button",
											className: "db_btn",
											onClick: copySelector,
										}, "Copy sel"),
									),
									React.createElement("div", { className: "db_styleGroups" },
										STYLE_GROUPS.map((group) => React.createElement("div", { key: group.title },
											React.createElement("div", { className: "db_styleGroupTitle" }, group.title),
											group.keys.map((key) => React.createElement("div", { key: key, className: "db_styleRow" },
												React.createElement("div", { className: "db_styleKey", title: key }, key),
												React.createElement("input", {
													className: "db_styleInput",
													value: styleDraft[key] || "",
													spellCheck: false,
													onChange: (e) => setStyleDraft((prev) => ({ ...prev, [key]: e.target.value })),
												}),
											)),
										)),
									),
									React.createElement("div", { className: "db_styleActions" },
										React.createElement("button", {
											type: "button",
											className: "db_btn db_btnPrimary",
											onClick: applyStyles,
										}, "Apply"),
										React.createElement("button", {
											type: "button",
											className: "db_btn",
											onClick: resetStyles,
										}, "Reset"),
										React.createElement("button", {
											type: "button",
											className: "db_btn",
											onClick: copyAppliedCss,
										}, "Copy CSS"),
										React.createElement("button", {
											type: "button",
											className: "db_btn" + (livePageUrl ? "" : ""),
											disabled: !livePageUrl || !inspectEl,
											title: livePageUrl
												? "Write changed styles into the linked CSS file (edits the matching rule like .equals)"
												: "Open the page via Live Server to save styles into the CSS file",
											onClick: saveStylesToLive,
										}, "Save to file"),
									),
									styleSaveMsg && React.createElement("div", {
										className: "db_hint",
										style: { marginTop: 8 },
									}, styleSaveMsg),
								),
							),
							dtTab === "console" && React.createElement(React.Fragment, null,
								React.createElement("div", { className: "db_dtToolbar" },
									React.createElement("div", { className: "db_chipRow" },
										[["all", "All"], ["errors", "Errors"], ["warnings", "Warnings"], ["logs", "Logs"]].map(([id, label]) => React.createElement("button", {
											key: id,
											type: "button",
											className: "db_chip" + (consoleFilter === id ? " db_chipActive" : ""),
											onClick: () => setConsoleFilter(id),
										}, label)),
									),
								),
								React.createElement("div", { className: "db_dtBodyPad" },
									!filteredConsole.length && React.createElement("div", { className: "db_empty" },
										"No console output yet. Page log/warn/error appear here — or type JS below."),
									filteredConsole.map((line, i) => React.createElement("div", {
										key: i,
										className: `db_consoleLine db_console_${line.level}`,
									},
										React.createElement("span", { className: "db_consoleTs" }, formatConsoleTime(line.ts)),
										React.createElement("span", { className: "db_consoleLvl" }, line.level),
										React.createElement("span", null, line.text),
									)),
									React.createElement("div", { ref: consoleEndRef }),
								),
								React.createElement("form", {
									className: "db_consoleEval",
									onSubmit: (e) => {
										e.preventDefault();
										runEval();
									},
								},
									React.createElement("span", { className: "db_consoleEvalPrompt" }, ">"),
									React.createElement("input", {
										className: "db_consoleEvalInput",
										value: evalInput,
										onChange: (e) => setEvalInput(e.target.value),
										placeholder: "Evaluate JavaScript in the page…",
										spellCheck: false,
									}),
								),
							),
							dtTab === "network" && React.createElement(React.Fragment, null,
								React.createElement("div", { className: "db_dtToolbar" },
									React.createElement("div", { className: "db_chipRow" },
										[["all", "All"], ["failed", "Failed"], ["fetch", "Fetch"]].map(([id, label]) => React.createElement("button", {
											key: id,
											type: "button",
											className: "db_chip" + (networkFilter === id ? " db_chipActive" : ""),
											onClick: () => setNetworkFilter(id),
										}, label)),
									),
								),
								React.createElement("div", { className: "db_dtBodyPad" },
									!filteredNetwork.length && React.createElement("div", { className: "db_empty" },
										"No requests yet. Reload the page or trigger a fetch."),
									filteredNetwork.length > 0 && React.createElement("table", { className: "db_netTable" },
										React.createElement("thead", null,
											React.createElement("tr", null,
												React.createElement("th", null, "Method"),
												React.createElement("th", null, "Status"),
												React.createElement("th", null, "Type"),
												React.createElement("th", null, "Time"),
												React.createElement("th", null, "URL"),
											),
										),
										React.createElement("tbody", null,
											filteredNetwork.map((row) => React.createElement("tr", {
												key: row.id,
												className: (!row.ok || row.status >= 400) ? "db_netFail" : "",
												style: { cursor: "pointer", background: networkSelected?.id === row.id ? "var(--dsw-alias-interactive-bg-hover)" : undefined },
												onClick: () => setNetworkSelected(row),
												title: row.url,
											},
												React.createElement("td", null, row.method),
												React.createElement("td", null, row.status || (row.error ? "ERR" : "—")),
												React.createElement("td", null, row.type),
												React.createElement("td", null, `${row.duration}ms`),
												React.createElement("td", { className: "db_netUrl" }, shortUrl(row.url)),
											)),
										),
									),
								),
								networkSelected && React.createElement("div", { className: "db_netDetail" },
									React.createElement("div", null, `${networkSelected.method} ${networkSelected.status || "—"} · ${networkSelected.type} · ${networkSelected.duration}ms`),
									React.createElement("div", { style: { wordBreak: "break-all", marginTop: 4 } }, networkSelected.url),
									networkSelected.error && React.createElement("div", { style: { marginTop: 4 } }, networkSelected.error),
								),
							),
							dtTab === "storage" && React.createElement(React.Fragment, null,
								React.createElement("div", { className: "db_dtToolbar" },
									React.createElement("div", { className: "db_chipRow" },
										[["local", "Local"], ["session", "Session"], ["cookies", "Cookies"]].map(([id, label]) => React.createElement("button", {
											key: id,
											type: "button",
											className: "db_chip" + (storageWhich === id ? " db_chipActive" : ""),
											onClick: () => setStorageWhich(id),
										}, label)),
									),
									React.createElement("button", {
										type: "button",
										className: "db_btn",
										onClick: requestStorage,
									}, "Refresh"),
									React.createElement("button", {
										type: "button",
										className: "db_btn",
										onClick: () => {
											try {
												iframeRef.current?.contentWindow?.postMessage({
													type: "dsh-browser-storage-clear",
													requestId: `clr-${Date.now()}`,
													which: storageWhich,
												}, "*");
												setTimeout(requestStorage, 80);
											} catch { /* ignore */ }
										},
									}, "Clear"),
								),
								React.createElement("div", { className: "db_dtBodyPad" },
									(() => {
										if (storageWhich === "cookies") {
											const parts = String(storageData.cookies || "")
												.split(";")
												.map((s) => s.trim())
												.filter(Boolean);
											if (!parts.length) {
												return React.createElement("div", { className: "db_empty" }, "No cookies for this page.");
											}
											return parts.map((part, i) => {
												const eq = part.indexOf("=");
												const k = eq >= 0 ? part.slice(0, eq) : part;
												const v = eq >= 0 ? part.slice(eq + 1) : "";
												return React.createElement("div", { key: i, className: "db_storageKV" },
													React.createElement("div", { className: "db_storageKey" }, k),
													React.createElement("div", { className: "db_storageVal" }, v),
													React.createElement("span", null),
												);
											});
										}
										const bag = storageWhich === "session" ? storageData.sessionStorage : storageData.localStorage;
										const keys = Object.keys(bag || {});
										if (!keys.length) {
											return React.createElement("div", { className: "db_empty" },
												storageWhich === "session" ? "sessionStorage is empty." : "localStorage is empty.");
										}
										return keys.map((k) => React.createElement("div", { key: k, className: "db_storageKV" },
											React.createElement("div", { className: "db_storageKey" }, k),
											React.createElement("div", { className: "db_storageVal" }, bag[k]),
											React.createElement("button", {
												type: "button",
												className: "db_btn",
												onClick: () => {
													try {
														iframeRef.current?.contentWindow?.postMessage({
															type: "dsh-browser-storage-remove",
															requestId: `rm-${Date.now()}`,
															which: storageWhich,
															key: k,
														}, "*");
														setTimeout(requestStorage, 80);
													} catch { /* ignore */ }
												},
											}, "×"),
										));
									})(),
								),
							),
						),
					),
				),
			);
		}

		const inject = ["slots", "connection", "conversation", "inputTriggers"];

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
			const conversation = ctx.get("conversation");
			const inputTriggers = ctx.get("inputTriggers");
			ensureStyles();
			try { window.__DSH_BROWSER_BUILD = BUILD; } catch { /* ignore */ }

			ctx.effect(() => {
				const onOpen = async (ev) => {
					const detail = ev?.detail || {};
					try {
						const url = await resolveLiveOpen(connection, detail);
						if (!url) return;
						setPendingUrl(url);
						switchToBrowserTab();
					} catch (err) {
						console.error("[dsh-browser] live open failed:", err);
					}
				};
				window.addEventListener(OPEN_EVENT, onOpen);
				return () => window.removeEventListener(OPEN_EVENT, onOpen);
			}, `${PLUGIN}: open event`);

			// Register RPC endpoints for browser automation from agent / backend
			ctx.effect(() => {
				if (!connection?.rpc?.handle) return;
				const unhandle = connection.rpc.handle(
					"dsh-browser",
					async (endpoint, payload) => {
						if (endpoint === "navigate") {
							const url = String(payload?.url || "").trim();
							if (!url) return { ok: false, error: "url required" };
							setPendingUrl(url);
							switchToBrowserTab();
							return { ok: true, url };
						}
						if (endpoint === "action") {
							const action = String(payload?.action || "").trim();
							const selector = payload?.selector ? String(payload.selector).trim() : undefined;
							const value = payload?.value !== undefined ? String(payload.value) : undefined;
							const timeoutMs = typeof payload?.timeoutMs === "number" ? payload.timeoutMs : 10000;
							const actionId = "act_" + Math.random().toString(36).slice(2, 10);

							switchToBrowserTab();

							return new Promise((resolve) => {
								let timer = null;
								const onRes = (e) => {
									if (timer) clearTimeout(timer);
									window.removeEventListener("dsh-browser-action-response-" + actionId, onRes);
									resolve(e.detail || { ok: false, error: "empty response" });
								};

								timer = setTimeout(() => {
									window.removeEventListener("dsh-browser-action-response-" + actionId, onRes);
									resolve({ ok: false, error: "action timed out after " + timeoutMs + "ms" });
								}, timeoutMs);

								window.addEventListener("dsh-browser-action-response-" + actionId, onRes);
								window.dispatchEvent(new CustomEvent("dsh-browser-perform-action", {
									detail: { actionId, action, selector, value }
								}));
							});
						}
						return { ok: false, error: `unknown endpoint: ${endpoint}` };
					}
				);
				return () => {
					if (typeof unhandle === "function") unhandle();
				};
			}, `${PLUGIN}: client rpc`);

			ctx.effect(() => inputTriggers.registerSource({
				trigger: "@",
				name: REF_SOURCE,
				showGroupTitle: false,
				async candidates() {
					return [];
				},
				codec: {
					clipboardText: (ref) => chipPayloads.get(ref) || ref,
					serialize: (ref) => Promise.resolve(chipPayloads.get(ref) || ref),
				},
			}), `${PLUGIN}: @browser-dom chips`);

			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "browser",
				order: 9,
				label: () => "Browser",
				inject: (sessionId) => ({ connection, conversation, sessionId }),
			}, BrowserView)), `${PLUGIN}: tab`);

			ctx.effect(() => {
				ensureHeroRegistry();
				return window.__dshHeroToolRegistry.register("browser", () =>
					React.createElement(BrowserView, {
						connection,
						conversation,
						sessionId: resolveCurrentSessionId(conversation),
						useInput: () => "",
						inputActions: null,
					}));
			}, `${PLUGIN}: hero`);
		}

		return { apply, inject };
	},
});

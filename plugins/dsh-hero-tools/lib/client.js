// One workbench chrome for hero + session: shared tab strip (icons, order, drag),
// hero tool host + registry. Chat on hero = start screen; other tabs = tools.
window.__ModuleLoader__.load({
	id: "dsh-hero-tools",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		let ReactDOMClient = null;
		try {
			ReactDOMClient = require("react-dom/client");
		} catch {
			ReactDOMClient = null;
		}
		const PLUGIN = "dsh-hero-tools";
		const OPEN_EVENT = "dsh-hero-open-tool";
		const CLOSE_EVENT = "dsh-hero-close-tool";
		const ROW_SEL = ".wSkVaW_heroWorkspaceRow";
		const ORDER_KEY = "dsh-hero-tabs.order.v1";
		const ORDER_EVENT = "dsh-tabs-order-changed";
		const ACTIVE_KEY = "dsh-hero-tabs.active.v1";
		const DRAG_THRESHOLD_PX = 8;

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

		const DEFAULT_ORDER = [
			"Chat",
			"Code",
			"Git",
			"Containers",
			"Terminal",
			"Browser",
			"Database",
			"Scheduled",
			"Trajectory",
		];

		const TAB_TOOL = {
			Chat: null,
			Code: "code",
			Git: "git",
			Containers: "containers",
			Terminal: "terminal",
			Browser: "browser",
			Database: "db",
			Scheduled: "scheduled",
			Trajectory: "trajectory",
		};

		const lucide = (paths) =>
			`<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;

		const ICONS = {
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

		const css = `
/* --- Shared tab strip (hero + session) --- */
.dsh-tab-icon{display:inline-flex;align-items:center;justify-content:center;flex:none;line-height:0}
.dsh-tab-icon svg{display:block}
.dsh-tab-label{display:inline}
.wSkVaW_tab.dsh-tab-enhanced{
  display:inline-flex;align-items:center;justify-content:center;gap:6px;white-space:nowrap;
  box-sizing:border-box;user-select:none;cursor:pointer;pointer-events:auto;
}
.wSkVaW_tab.dsh-tab-enhanced.dsh-tab-dragging{opacity:.45;cursor:grabbing}
.wSkVaW_header.dsh-tabs-reordering,
.wSkVaW_header.dsh-tabs-reordering .wSkVaW_tabs .wSkVaW_tab{cursor:grabbing}
.wSkVaW_tabs .wSkVaW_tab.dsh-tab-drop-before{
  box-shadow:inset 2px 0 0 var(--dsw-alias-state-business-primary);
}
.wSkVaW_tabs .wSkVaW_tab.dsh-tab-drop-after{
  box-shadow:inset -2px 0 0 var(--dsw-alias-state-business-primary);
}
@media (max-width:768px){
  .SVAs4q_label{
    max-width:none!important;width:22px!important;min-width:22px;padding:0!important;gap:0!important;
    justify-content:center;font-size:0!important;line-height:0!important;
  }
  .SVAs4q_label .SVAs4q_icon{opacity:.85}
  .wSkVaW_header{padding-left:12px!important;padding-right:8px!important}
  .wSkVaW_tabs{
    gap:2px!important;margin-top:4px;padding-left:0!important;padding-right:8px;max-width:100%;
    overflow-x:auto!important;overflow-y:hidden!important;flex-wrap:nowrap!important;
    -webkit-overflow-scrolling:touch;scrollbar-width:none;overscroll-behavior-x:contain;
    mask-image:linear-gradient(90deg,#000 0%,#000 calc(100% - 18px),transparent 100%);
    -webkit-mask-image:linear-gradient(90deg,#000 0%,#000 calc(100% - 18px),transparent 100%);
  }
  .wSkVaW_tabs::-webkit-scrollbar{display:none;height:0}
  .wSkVaW_tab.dsh-tab-enhanced{
    flex:0 0 auto;gap:0;width:32px;min-width:32px;justify-content:center;padding:4px 2px 11px!important;
  }
  .wSkVaW_tab.dsh-tab-enhanced .dsh-tab-label{display:none!important}
  .wSkVaW_tab.dsh-tab-enhanced .dsh-tab-icon svg{width:18px;height:18px}
}
@media (min-width:769px){
  .wSkVaW_tabs{gap:6px!important}
  .wSkVaW_tab.dsh-tab-enhanced{width:auto;min-width:0;padding:4px 10px 11px!important}
  .wSkVaW_tab.dsh-tab-enhanced .dsh-tab-icon svg{width:14px;height:14px;opacity:.9}
}
@media (max-width:1024px){
  .pI_x6G_frame[data-sidebar-collapsed][data-details-collapsed]{
    grid-template-columns:40px minmax(0,1fr) 0px!important;
  }
  .hHd-Xa_root.hHd-Xa_collapsed{padding:10px 4px 6px!important;align-items:center}
  .hHd-Xa_collapsed .hHd-Xa_logoRow{height:32px!important;margin-bottom:8px!important;justify-content:center!important}
  .hHd-Xa_collapsed .hHd-Xa_iconButton,
  .hHd-Xa_collapsed .hHd-Xa_newSession{
    width:32px!important;height:32px!important;margin-left:0!important;margin-right:0!important;
  }
  .hHd-Xa_collapsed .hHd-Xa_newSession{margin-bottom:8px!important;align-self:center!important}
  .hHd-Xa_collapsed .hHd-Xa_regionArea,
  .hHd-Xa_collapsed .qDHVXG_root{
    overflow-x:hidden!important;
    min-width:0!important;
  }
}
.wSkVaW_root[data-dsh-tool-tab="1"] .wSkVaW_composerSeat{display:none!important}
.wSkVaW_root[data-dsh-tool-tab="1"] .wSkVaW_scrollBody{overflow:hidden!important}
.wSkVaW_root[data-dsh-tool-tab="1"][data-phase=active] .wSkVaW_viewArea,
.wSkVaW_root[data-dsh-tool-tab="1"] .wSkVaW_viewArea{
  flex:1 1 0!important;min-height:0!important;overflow:hidden!important;height:auto!important;
}
.wSkVaW_root[data-dsh-tool-tab="1"] .wSkVaW_viewArea>div{
  height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden;
}

/* --- Hero header shell --- */
.dsh-hero-header.wSkVaW_header{
  flex:none;position:relative;z-index:5;padding:12px 28px 0 20px;box-sizing:border-box;
  border-bottom:1px solid transparent;pointer-events:auto;
}
.dsh-hero-header .wSkVaW_titleRow{display:flex;align-items:center;gap:12px;min-width:0;width:100%}
.dsh-hero-header .wSkVaW_titleCluster{display:flex;align-items:center;gap:8px;min-width:0;flex:1 1 auto}
.dsh-hero-header .dsh-hero-title{
  font-size:14px;font-weight:500;line-height:20px;color:var(--dsw-alias-label-primary);
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap;
}
.dsh-ws-locationBadge{
  color:var(--dsw-alias-state-business-primary);
  border:1px solid color-mix(in srgb,var(--dsw-alias-state-business-primary) 42%,var(--dsw-alias-border-l2));
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);
}
.dsh-hero-header .dsh-hero-titleBadge{
  flex:none;font-size:9px;font-weight:500;line-height:1.25;padding:1px 6px;border-radius:999px;
  text-transform:uppercase;letter-spacing:.03em;
}
.wSkVaW_root [class*="previewBadge"][data-dsh-location-badge="1"]{
  text-transform:uppercase;letter-spacing:.03em;
}
.dsh-hero-header .wSkVaW_headerActions{
  display:inline-flex;align-items:center;gap:6px;flex:none;margin-left:auto;
  pointer-events:auto;position:relative;z-index:6;
}
.dsh-hero-header .wSkVaW_tabs{
  display:flex;align-items:flex-end;gap:6px;margin-top:4px;padding:0;min-width:0;max-width:100%;
  overflow-x:auto;overflow-y:hidden;scrollbar-width:none;flex-wrap:nowrap;box-sizing:border-box;
  pointer-events:auto;position:relative;z-index:2;
}
.dsh-hero-header .wSkVaW_tabs::-webkit-scrollbar{display:none;height:0}
.wSkVaW_root[data-phase=hero] > .wSkVaW_header.wSkVaW_headerHidden{display:none!important}

.dsh-hero-tool-host{
  display:none;flex:1 1 0;min-height:0;min-width:0;overflow:hidden;flex-direction:column;
  background:var(--dsw-alias-bg-base);position:relative;z-index:1;
}
.wSkVaW_root[data-phase=hero][data-dsh-tool-tab="1"] > .dsh-hero-tool-host{display:flex!important}
/* 0.1.5 nests scrollBody under .wSkVaW_body; hide that whole column for tool tabs */
.wSkVaW_root[data-phase=hero][data-dsh-tool-tab="1"] > .wSkVaW_body{display:none!important}
.wSkVaW_root[data-phase=hero][data-dsh-tool-tab="1"] > .wSkVaW_scrollBody{display:none!important}
.dsh-hero-tool-view{
  flex:1 1 0;min-height:0;min-width:0;height:100%;display:flex;flex-direction:column;overflow:hidden;
}
.dsh-hero-tool-view > *{flex:1 1 0;min-height:0;height:100%}
.dsh-hero-tool-view .db_root,
.dsh-hero-tool-view .dc_root,
.dsh-hero-tool-view .dd_root,
.dsh-hero-tool-view .dte_root,
.dsh-hero-tool-view .dsh-code-tab-root,
.dsh-hero-tool-view .dg_root,
.dsh-hero-tool-view .dt_root,
.dsh-hero-tool-view [data-dsh-cron-root]{height:100%;min-height:0}
.wSkVaW_scrollBody:has([data-dsh-cron-root]){overflow:hidden!important;display:flex;flex-direction:column;min-height:0}
.wSkVaW_scrollBody:has([data-dsh-cron-root])>.wSkVaW_viewArea,
.wSkVaW_viewArea:has([data-dsh-cron-root]){flex:1 1 0!important;min-height:0!important;overflow:hidden!important;height:auto!important}
.wSkVaW_viewArea:has([data-dsh-cron-root])>div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dsh-hero-tool-view .db_body{grid-template-rows:minmax(0,1fr)}
.dsh-hero-tool-view .db_frameWrap{height:100%;min-height:0}
.dsh-hero-tool-view[hidden]{display:none!important}
.dsh-hero-missing{padding:24px;color:var(--dsw-alias-label-tertiary);font-size:13px;line-height:1.5;max-width:42em}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-hero-tools-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-hero-tools-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
			// Drop legacy dual stylesheet if present.
			document.getElementById("dsh-session-tabs-css")?.remove();
		}

		function iconFor(label) {
			if (ICONS[label]) return ICONS[label];
			const key = Object.keys(ICONS).find((k) => label.toLowerCase().includes(k.toLowerCase()));
			return key ? ICONS[key] : ICONS.Chat;
		}

		function tabLabel(btn) {
			return (btn?.getAttribute?.("data-dsh-tab-label") || btn?.textContent || "").trim();
		}

		function labelsOf(tabsEl) {
			return [...tabsEl.querySelectorAll('[role="tab"]')].map(tabLabel).filter(Boolean);
		}

		function sameOrder(a, b) {
			return a.length === b.length && a.every((v, i) => v === b[i]);
		}

		function allTablists(root) {
			const list = (root || document).querySelectorAll?.('[role="tablist"].wSkVaW_tabs, .wSkVaW_tabs[role="tablist"]');
			return list ? [...list] : [];
		}

		const RPC = "/hero-tools";
		let activeConnection = null;
		/** @type {Map<string, { shell: HTMLElement, root: import('react-dom/client').Root | null }>} */
		const heroToolPanelCache = new Map();
		/** @type {HTMLElement | null} */
		let heroToolMountHost = null;
		let heroToolRestored = false;
		let cachedOrder = null;

		function destroyHeroToolPanels() {
			for (const entry of heroToolPanelCache.values()) {
				try {
					entry.root?.unmount?.();
				} catch {
					/* ignore */
				}
				entry.shell.remove();
			}
			heroToolPanelCache.clear();
			heroToolMountHost = null;
		}

		function ensureHeroToolShell(toolId, toolHost) {
			if (heroToolMountHost !== toolHost) {
				destroyHeroToolPanels();
				heroToolMountHost = toolHost;
			}
			let entry = heroToolPanelCache.get(toolId);
			if (!entry) {
				const shell = document.createElement("div");
				shell.className = "dsh-hero-tool-view";
				shell.setAttribute("data-dsh-hero-tool", toolId);
				shell.hidden = true;
				toolHost.appendChild(shell);
				const root = ReactDOMClient?.createRoot
					? ReactDOMClient.createRoot(shell)
					: null;
				entry = { shell, root };
				heroToolPanelCache.set(toolId, entry);
			}
			return entry;
		}

		function getRawLocalOrder() {
			try {
				const raw = JSON.parse(localStorage.getItem(ORDER_KEY) || "null");
				if (!Array.isArray(raw)) return [...DEFAULT_ORDER];
				const known = new Set(DEFAULT_ORDER);
				const out = [];
				const seen = new Set();
				for (const label of raw) {
					if (typeof label !== "string" || !known.has(label) || seen.has(label)) continue;
					out.push(label);
					seen.add(label);
				}
				for (const label of DEFAULT_ORDER) {
					if (!seen.has(label)) out.push(label);
				}
				return out;
			} catch {
				return [...DEFAULT_ORDER];
			}
		}

		function readOrder() {
			if (Array.isArray(cachedOrder)) return cachedOrder;
			cachedOrder = getRawLocalOrder();
			return cachedOrder;
		}

		function saveLocalOrder(labels) {
			const clean = Array.isArray(labels) ? labels : [...DEFAULT_ORDER];
			cachedOrder = clean;
			try {
				localStorage.setItem(ORDER_KEY, JSON.stringify(clean));
			} catch {}
			window.dispatchEvent(new CustomEvent(ORDER_EVENT, { detail: { order: clean } }));
			return clean;
		}

		async function callRpc(conn, endpoint, payload) {
			const target = conn || activeConnection;
			if (!target) return null;
			const res = await target.rpc.call(RPC, endpoint, payload ?? {});
			if (!res.ok) throw new Error(res.error?.message || `${endpoint} failed`);
			return res.value;
		}

		async function syncOrderWithServer(conn) {
			const target = conn || activeConnection;
			if (!target) return readOrder();
			const local = getRawLocalOrder();
			try {
				const res = await callRpc(target, "syncOrder", { order: local });
				if (Array.isArray(res?.order) && res.order.length > 0) {
					const known = new Set(DEFAULT_ORDER);
					const out = [];
					const seen = new Set();
					for (const label of res.order) {
						if (typeof label !== "string" || !known.has(label) || seen.has(label)) continue;
						out.push(label);
						seen.add(label);
					}
					for (const label of DEFAULT_ORDER) {
						if (!seen.has(label)) out.push(label);
					}
					return saveLocalOrder(out);
				}
			} catch (err) {
				console.warn(`[${PLUGIN}] server sync failed`, err);
			}
			return readOrder();
		}

		function writeOrder(labels) {
			const clean = saveLocalOrder(labels);
			const target = activeConnection;
			if (target) {
				callRpc(target, "saveOrder", { order: clean }).catch((err) => {
					console.warn(`[${PLUGIN}] saveOrder failed`, err);
				});
			}
		}

		function readActiveLabel() {
			try {
				const v = localStorage.getItem(ACTIVE_KEY);
				if (v && Object.prototype.hasOwnProperty.call(TAB_TOOL, v)) return v;
			} catch {
				/* ignore */
			}
			return "Chat";
		}

		function writeActiveLabel(label) {
			try {
				localStorage.setItem(ACTIVE_KEY, label);
			} catch {
				/* ignore */
			}
		}

		function orderedTabs() {
			return readOrder().map((label) => ({ label, toolId: TAB_TOOL[label] ?? null }));
		}

		function applyTabOrder(tabsEl, order) {
			if (!tabsEl) return;
			// Only reorder our hero tab strip. Session workbench tablists are React-controlled;
			// moving their DOM nodes desyncs aria-selected from the mounted panel (empty body).
			if (!tabsEl.closest("[data-dsh-hero-tabs]")) return;
			const byLabel = new Map();
			tabsEl.querySelectorAll('[role="tab"]').forEach((btn) => {
				const label = tabLabel(btn);
				if (label) byLabel.set(label, btn);
			});
			const desired = [];
			for (const label of order) {
				if (byLabel.has(label)) desired.push(label);
			}
			byLabel.forEach((_, label) => {
				if (!desired.includes(label)) desired.push(label);
			});
			if (sameOrder(labelsOf(tabsEl), desired)) return;
			const frag = document.createDocumentFragment();
			for (const label of desired) {
				const btn = byLabel.get(label);
				if (btn) frag.appendChild(btn);
			}
			tabsEl.appendChild(frag);
		}

		function applyOrderEverywhere(order = readOrder()) {
			allTablists(document).forEach((tabs) => applyTabOrder(tabs, order));
		}

		function enhanceTab(btn) {
			if (!(btn instanceof HTMLElement)) return;
			const raw = (btn.getAttribute("data-dsh-tab-label") || btn.textContent || "").trim();
			if (!raw) return;
			const label = btn.getAttribute("data-dsh-tab-label") || raw.replace(/\s+/g, " ");
			const inHero = !!btn.closest("[data-dsh-hero-tabs]");
			if (
				btn.classList.contains("dsh-tab-enhanced")
				&& btn.getAttribute("data-dsh-tab-label") === label
				&& btn.getAttribute("data-dsh-tab-icons") === "lucide"
				&& btn.querySelector(".dsh-tab-icon")
			) {
				return;
			}
			btn.setAttribute("data-dsh-tab-label", label);
			btn.setAttribute("data-dsh-tab-icons", "lucide");
			btn.setAttribute("aria-label", label);
			btn.setAttribute("title", label);
			btn.classList.add("dsh-tab-enhanced");
			btn.removeAttribute("draggable");
			if (inHero) {
				btn.innerHTML = `<span class="dsh-tab-icon">${iconFor(label)}</span><span class="dsh-tab-label">${label}</span>`;
				return;
			}
			if (btn.querySelector(".dsh-tab-icon") && btn.querySelector(".dsh-tab-label")) {
				btn.querySelector(".dsh-tab-label").textContent = label;
				return;
			}
			btn.innerHTML = `<span class="dsh-tab-icon">${iconFor(label)}</span><span class="dsh-tab-label">${label}</span>`;
		}

		function resyncWorkbenchTab() {
			document.querySelectorAll(".wSkVaW_root").forEach((root) => {
				if (root.getAttribute("data-phase") === "hero") {
					const label = readActiveLabel();
					openLabel(label || "Chat");
					return;
				}
				const active = root.querySelector('.wSkVaW_tabs [role="tab"][aria-selected="true"]');
				const label = tabLabel(active);
				syncComposerVisibility();
				if (label && label !== "Chat" && active instanceof HTMLElement) {
					active.click();
				}
			});
		}

		function syncComposerVisibility() {
			document.querySelectorAll(".wSkVaW_root").forEach((root) => {
				const active = root.querySelector('.wSkVaW_tabs [role="tab"][aria-selected="true"]');
				const label = tabLabel(active);
				if (label && label !== "Chat") root.setAttribute("data-dsh-tool-tab", "1");
				else if (!root.hasAttribute("data-phase") || root.getAttribute("data-phase") !== "hero" || label === "Chat") {
					// Hero tool-tab attr is also set by selectHeroTab; only clear when Chat / empty on non-hero or Chat.
					if (root.getAttribute("data-phase") !== "hero" || !label || label === "Chat") {
						if (root.getAttribute("data-phase") !== "hero") root.removeAttribute("data-dsh-tool-tab");
						else if (label === "Chat" || !label) root.removeAttribute("data-dsh-tool-tab");
					}
				}
			});
		}

		let applyingOrder = false;
		/** @type {{ label: string, btn: HTMLElement, tabsEl: HTMLElement, x: number, y: number, active: boolean } | null} */
		let press = null;
		let suppressClick = false;

		function syncHeroToolPanel(toolId) {
			const root = document.querySelector(".wSkVaW_root[data-phase=hero]");
			if (!root) return;
			const { toolHost } = ensureHeroChrome(root);
			if (!(toolHost instanceof HTMLElement)) return;

			if (!toolId) {
				for (const entry of heroToolPanelCache.values()) {
					entry.shell.hidden = true;
				}
				return;
			}

			try {
				const factory = window.__dshHeroToolRegistry?.get?.(toolId);
				const body = factory
					? factory()
					: React.createElement(
						"div",
						{ className: "dsh-hero-missing" },
						toolId === "terminal"
							? "Terminal isn’t available on the start screen yet — open a session first."
							: "Tool unavailable — is the plugin loaded?",
					);
				const { shell, root: reactRoot } = ensureHeroToolShell(toolId, toolHost);
				for (const [id, entry] of heroToolPanelCache) {
					entry.shell.hidden = id !== toolId;
				}
				if (reactRoot?.render) {
					reactRoot.render(body);
				} else {
					ReactDOM.render(body, shell);
				}
				if (toolId === "terminal") {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							window.dispatchEvent(new Event("dsh-terminal-refit"));
						});
					});
				}
			} catch (err) {
				console.error(`[${PLUGIN}] hero tool render failed`, toolId, err);
				const entry = heroToolPanelCache.get(toolId);
				if (entry?.shell) {
					entry.shell.replaceChildren();
					const msg = document.createElement("div");
					msg.className = "dsh-hero-missing";
					msg.textContent = err instanceof Error ? err.message : String(err);
					entry.shell.appendChild(msg);
				}
			}
		}

		function maintainHeroChrome() {
			const root = document.querySelector(".wSkVaW_root[data-phase=hero]");
			if (!root) return;
			ensureHeroChrome(root);
			patchComposerPreviewBadges();
			if (!heroToolRestored) {
				heroToolRestored = true;
				const label = readActiveLabel();
				requestAnimationFrame(() => openLabel(label || "Chat"));
			}
		}

		function clearHeroChromeDom() {
			syncHeroToolPanel(null);
			destroyHeroToolPanels();
			document.querySelectorAll("[data-dsh-hero-header-host], .dsh-hero-tool-host").forEach((el) => el.remove());
			document.querySelector(".wSkVaW_root[data-phase=hero]")?.removeAttribute("data-dsh-tool-tab");
			heroToolRestored = false;
		}

		function enhanceAll(root) {
			allTablists(root).forEach((tabs) => {
				tabs.querySelectorAll('[role="tab"]').forEach(enhanceTab);
			});
			if (!applyingOrder && !press?.active) {
				applyingOrder = true;
				try {
					applyOrderEverywhere();
				} finally {
					applyingOrder = false;
				}
			}
			syncComposerVisibility();
			maintainHeroChrome();
			patchComposerPreviewBadges();
		}

		function decorateHeroTabs(tabsEl) {
			if (!tabsEl) return;
			applyTabOrder(tabsEl, readOrder());
			tabsEl.querySelectorAll('[role="tab"]').forEach(enhanceTab);
		}

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

		function selectHeroTab(label, { persist = true } = {}) {
			const tabsEl = document.querySelector("[data-dsh-hero-tabs]");
			if (tabsEl) {
				tabsEl.querySelectorAll('[role="tab"]').forEach((btn) => {
					const on = btn.getAttribute("data-dsh-tab-label") === label;
					btn.setAttribute("aria-selected", on ? "true" : "false");
					btn.classList.toggle("wSkVaW_tabActive", on);
				});
			}
			const root = document.querySelector(".wSkVaW_root[data-phase=hero]");
			if (!root) return;
			if (label && label !== "Chat") root.setAttribute("data-dsh-tool-tab", "1");
			else root.removeAttribute("data-dsh-tool-tab");
			if (persist) writeActiveLabel(label || "Chat");
		}

		function openLabel(label) {
			const toolId = Object.prototype.hasOwnProperty.call(TAB_TOOL, label) ? TAB_TOOL[label] : null;
			selectHeroTab(label);
			if (toolId) {
				window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { id: toolId } }));
				syncHeroToolPanel(toolId);
			} else {
				window.dispatchEvent(new CustomEvent(CLOSE_EVENT));
				syncHeroToolPanel(null);
			}
		}

		function clearDropMarkers() {
			document.querySelectorAll(".wSkVaW_tabs .dsh-tab-drop-before, .wSkVaW_tabs .dsh-tab-drop-after")
				.forEach((el) => el.classList.remove("dsh-tab-drop-before", "dsh-tab-drop-after"));
		}

		function endPress({ commit = false, clientX = 0, clientY = 0 } = {}) {
			if (!press) return;
			const { label: fromLabel, btn, tabsEl, active } = press;
			btn.closest(".wSkVaW_header")?.classList.remove("dsh-tabs-reordering");
			btn.classList.remove("dsh-tab-dragging");

			if (active && commit && tabsEl) {
				const over = document.elementFromPoint(clientX, clientY)?.closest?.('.wSkVaW_tabs [role="tab"]');
				clearDropMarkers();
				if (over && tabsEl.contains(over)) {
					const toLabel = tabLabel(over);
					if (toLabel && toLabel !== fromLabel) {
						const labels = labelsOf(tabsEl);
						const fromIdx = labels.indexOf(fromLabel);
						const toIdx = labels.indexOf(toLabel);
						if (fromIdx >= 0 && toIdx >= 0) {
							const rect = over.getBoundingClientRect();
							const before = clientX < rect.left + rect.width / 2;
							labels.splice(fromIdx, 1);
							let insertAt = labels.indexOf(toLabel);
							if (insertAt < 0) insertAt = toIdx > fromIdx ? toIdx - 1 : toIdx;
							if (!before) insertAt += 1;
							labels.splice(insertAt, 0, fromLabel);
							writeOrder(labels);
							applyOrderEverywhere(labels);
						}
					}
				}
				suppressClick = true;
			} else {
				clearDropMarkers();
			}
			press = null;
		}

		function onPointerDown(e) {
			if (e.button !== 0) return;
			const btn = e.target?.closest?.('.wSkVaW_tabs [role="tab"]');
			if (!(btn instanceof HTMLElement)) return;
			const tabsEl = btn.closest(".wSkVaW_tabs");
			const label = tabLabel(btn);
			if (!label || !tabsEl) return;
			press = { label, btn, tabsEl, x: e.clientX, y: e.clientY, active: false };
		}

		function onPointerMove(e) {
			if (!press) return;
			const dx = e.clientX - press.x;
			const dy = e.clientY - press.y;
			if (!press.active) {
				if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return;
				press.active = true;
				press.btn.classList.add("dsh-tab-dragging");
				press.btn.closest(".wSkVaW_header")?.classList.add("dsh-tabs-reordering");
			}
			e.preventDefault();
			clearDropMarkers();
			const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.wSkVaW_tabs [role="tab"]');
			if (!over || over === press.btn || !press.tabsEl.contains(over)) return;
			const rect = over.getBoundingClientRect();
			const before = e.clientX < rect.left + rect.width / 2;
			over.classList.add(before ? "dsh-tab-drop-before" : "dsh-tab-drop-after");
		}

		function onPointerUp(e) {
			if (!press) return;
			const wasActive = press.active;
			endPress({ commit: wasActive, clientX: e.clientX, clientY: e.clientY });
			if (wasActive) {
				e.preventDefault();
				e.stopPropagation();
			}
		}

		function onPointerCancel() {
			endPress({ commit: false });
		}

		function onTabClick(e) {
			const btn = e.target?.closest?.('.wSkVaW_tabs [role="tab"]');
			if (!btn) return;
			if (suppressClick) {
				suppressClick = false;
				e.preventDefault();
				e.stopPropagation();
				return;
			}
			// Only hero tabs need synthetic open; session React handles its own clicks.
			if (!btn.closest("[data-dsh-hero-tabs]")) return;
			if (!document.querySelector(".wSkVaW_root[data-phase=hero]")) return;
			e.preventDefault();
			e.stopPropagation();
			openLabel(tabLabel(btn) || "Chat");
		}

		function readLocationBadge() {
			try {
				const api = window.__dshWorkspaceChip;
				if (api && typeof api.labelForCurrent === "function") {
					const raw = api.labelForCurrent();
					return typeof api.displayText === "function" ? api.displayText(raw) : chipDisplayTextFallback(raw);
				}
			} catch {
				/* ignore */
			}
			return chipDisplayTextFallback(fallbackLocationFromPointer());
		}

		function fallbackLocationFromPointer() {
			try {
				const ws = window.__dshCurrentWorkspace?.get?.();
				const cwd = String(ws?.cwd || "");
				if (cwd.startsWith("dssh://")) {
					return cwd.replace(/^dssh:\/\//, "").split("/")[0] || "remote";
				}
			} catch {
				/* ignore */
			}
			return "local";
		}

		function chipDisplayTextFallback(label) {
			const s = String(label || "local").trim();
			return s === "local" ? "local" : s;
		}

		function readHeroTitle() {
			const badge = readLocationBadge();
			try {
				const row = document.querySelector(ROW_SEL);
				const wsInput = row?.querySelector("input[readonly], input");
				const wsBtn = row?.querySelector("button");
				const ws = (wsInput?.value || wsBtn?.textContent || "").replace(/\s+/g, " ").trim();
				if (ws && ws.length < 48 && !/^standard|choose/i.test(ws)) {
					return { title: ws, badge };
				}
				const scroll = document.querySelector(".wSkVaW_root[data-phase=hero] .wSkVaW_scrollBody");
				const headline = scroll?.querySelector("h1, h2, [class*='heroTitle'], [class*='HeroTitle']");
				const headlineText = (headline?.textContent || "").replace(/\s+/g, " ").trim();
				if (headlineText && headlineText.length < 64) {
					return { title: headlineText, badge };
				}
			} catch {
				/* ignore */
			}
			return { title: "Into the Unknown", badge };
		}

		function applyLocationBadgeEl(badgeEl, badge) {
			if (!badgeEl) return;
			const text = String(badge || "").trim();
			if (text) {
				if (badgeEl.textContent !== text) badgeEl.textContent = text;
				badgeEl.classList.add("dsh-ws-locationBadge");
				badgeEl.setAttribute("data-dsh-location-badge", "1");
				const kind = text === "local" ? "local" : "remote";
				badgeEl.dataset.kind = kind;
				badgeEl.title = kind === "local" ? "Local workspace" : `Remote workspace · ${text}`;
				badgeEl.hidden = false;
				badgeEl.removeAttribute("aria-hidden");
			} else {
				badgeEl.hidden = true;
				badgeEl.textContent = "";
				badgeEl.classList.remove("dsh-ws-locationBadge");
				badgeEl.removeAttribute("data-dsh-location-badge");
				delete badgeEl.dataset.kind;
				badgeEl.title = "";
			}
		}

		function writeHeroTitle(host, info) {
			const titleEl = host.querySelector("[data-dsh-hero-title]");
			const badgeEl = host.querySelector("[data-dsh-hero-title-badge]");
			if (titleEl && titleEl.textContent !== info.title) titleEl.textContent = info.title;
			applyLocationBadgeEl(badgeEl, info.badge || "");
		}

		function patchComposerPreviewBadges() {
			const badge = readLocationBadge();
			if (!badge) return;
			document.querySelectorAll('.wSkVaW_root[data-phase=hero] [class*="previewBadge"]').forEach((el) => {
				applyLocationBadgeEl(el, badge);
			});
		}

		function refreshLocationBadges() {
			document.querySelectorAll("[data-dsh-hero-header-host]").forEach((headerHost) => {
				writeHeroTitle(headerHost, readHeroTitle());
			});
			patchComposerPreviewBadges();
		}

		function placeChrome(root, headerHost, toolHost) {
			// 0.1.1: root > scrollBody. 0.1.5+: root > body > scrollBody.
			// Pin our chrome above the stock body (same band as session header).
			const body = root.querySelector(":scope > .wSkVaW_body");
			const scroll =
				root.querySelector(":scope > .wSkVaW_scrollBody")
				|| body?.querySelector(":scope > .wSkVaW_scrollBody")
				|| null;
			const anchor = body || scroll;
			const kids = [...root.children];
			const hi = kids.indexOf(headerHost);
			const ti = kids.indexOf(toolHost);
			const ai = anchor ? kids.indexOf(anchor) : -1;
			const ok =
				hi >= 0
				&& ti >= 0
				&& hi < ti
				&& (ai < 0 || ti < ai);
			if (ok) return;
			headerHost.remove();
			toolHost.remove();
			if (anchor && root.contains(anchor)) {
				root.insertBefore(headerHost, anchor);
				root.insertBefore(toolHost, anchor);
			} else {
				root.prepend(toolHost);
				root.prepend(headerHost);
			}
		}

		function ensureHeroChrome(root) {
			let headerHost = root.querySelector(":scope > [data-dsh-hero-header-host]");
			const needsRebuild =
				!headerHost
				|| !headerHost.querySelector("[data-dsh-hero-tabs]")
				|| !headerHost.querySelector("[data-dsh-hero-header-actions]");
			if (needsRebuild) {
				headerHost?.remove();
				headerHost = document.createElement("header");
				headerHost.className = "wSkVaW_header dsh-hero-header";
				headerHost.setAttribute("data-dsh-hero-header-host", "1");
				headerHost.setAttribute("data-dsh-hero-header", "1");
				const active = readActiveLabel();
				const tabBtns = orderedTabs().map((t) => {
					const on = t.label === active;
					return `<button type="button" role="tab" class="wSkVaW_tab${on ? " wSkVaW_tabActive" : ""}" data-dsh-tab-label="${t.label}" aria-selected="${on ? "true" : "false"}" aria-label="${t.label}" title="${t.label}">${t.label}</button>`;
				}).join("");
				headerHost.innerHTML = `
  <div class="wSkVaW_titleRow">
    <div class="wSkVaW_titleCluster">
      <span class="dsh-hero-title" data-dsh-hero-title></span>
      <span class="dsh-hero-titleBadge" data-dsh-hero-title-badge hidden></span>
      <div class="wSkVaW_headerActions" data-dsh-hero-header-actions="1" aria-label="Workbench controls"></div>
    </div>
  </div>
  <div class="wSkVaW_tabs" role="tablist" aria-label="Views" data-dsh-hero-tabs="1">${tabBtns}</div>`;
			}

			let toolHost = root.querySelector(":scope > .dsh-hero-tool-host");
			if (!toolHost) {
				toolHost = document.createElement("div");
				toolHost.className = "dsh-hero-tool-host";
				toolHost.setAttribute("data-dsh-hero-tool-host", "1");
			}

			placeChrome(root, headerHost, toolHost);
			decorateHeroTabs(headerHost.querySelector("[data-dsh-hero-tabs]"));
			writeHeroTitle(headerHost, readHeroTitle());
			return { headerHost, toolHost };
		}

		function TrajectoryHeroView() {
			return React.createElement(
				"div",
				{ className: "dsh-hero-missing" },
				"Trajectory shows the agent run trail for an active session. Start a chat from the Chat tab, then open Trajectory there.",
			);
		}

		function startTabChrome() {
			if (typeof document === "undefined" || !document.body) return () => {};
			ensureStyles();
			enhanceAll(document);

			const obs = new MutationObserver((mutations) => {
				if (applyingOrder || press?.active) return;
				let touch = false;
				for (const m of mutations) {
					if (m.type === "childList" || m.type === "characterData") {
						touch = true;
						break;
					}
					if (m.type === "attributes") {
						const t = m.target;
						if (t?.getAttribute?.("role") === "tab" || t?.classList?.contains?.("wSkVaW_tabs") || t?.classList?.contains?.("wSkVaW_tab")) {
							touch = true;
							break;
						}
					}
				}
				if (touch) enhanceAll(document);
			});
			obs.observe(document.body, {
				subtree: true,
				childList: true,
				characterData: true,
				attributes: true,
				attributeFilter: ["aria-selected", "class", "data-dsh-tab-label"],
			});

			const onOrder = () => {
				if (press?.active) return;
				applyOrderEverywhere();
			};
			window.addEventListener(ORDER_EVENT, onOrder);
			document.addEventListener("click", onTabClick, true);
			document.addEventListener("pointerdown", onPointerDown, true);
			document.addEventListener("pointermove", onPointerMove, true);
			document.addEventListener("pointerup", onPointerUp, true);
			document.addEventListener("pointercancel", onPointerCancel, true);

			return () => {
				obs.disconnect();
				window.removeEventListener(ORDER_EVENT, onOrder);
				document.removeEventListener("click", onTabClick, true);
				document.removeEventListener("pointerdown", onPointerDown, true);
				document.removeEventListener("pointermove", onPointerMove, true);
				document.removeEventListener("pointerup", onPointerUp, true);
				document.removeEventListener("pointercancel", onPointerCancel, true);
			};
		}

		if (typeof window !== "undefined") {
			window.__dshResyncWorkbenchTab = resyncWorkbenchTab;
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			activeConnection = connection;
			ensureStyles();
			window.__dshHeroToolRegistry.register("trajectory", () => React.createElement(TrajectoryHeroView));

			if (connection) {
				syncOrderWithServer(connection).catch(console.warn);
			}

			ctx.effect(() => startTabChrome(), `${PLUGIN}: shared tab chrome`);

			ctx.effect(() => {
				maintainHeroChrome();
				const id = window.setInterval(maintainHeroChrome, 1500);
				const onOpen = (e) => {
					const toolId = e?.detail?.id;
					if (toolId) syncHeroToolPanel(toolId);
				};
				const onClose = () => syncHeroToolPanel(null);
				const onKey = (e) => {
					if (e.key !== "Escape") return;
					if (!document.querySelector(".wSkVaW_root[data-phase=hero]")?.getAttribute("data-dsh-tool-tab")) return;
					openLabel("Chat");
				};
				const onWorkspaceSwitch = () => {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => resyncWorkbenchTab());
					});
				};
				window.addEventListener(OPEN_EVENT, onOpen);
				window.addEventListener(CLOSE_EVENT, onClose);
				window.addEventListener("keydown", onKey);
				window.addEventListener("dsh-current-workspace-changed", onWorkspaceSwitch);
				window.addEventListener("dsh-current-workspace-changed", refreshLocationBadges);
				return () => {
					window.clearInterval(id);
					window.removeEventListener(OPEN_EVENT, onOpen);
					window.removeEventListener(CLOSE_EVENT, onClose);
					window.removeEventListener("keydown", onKey);
					window.removeEventListener("dsh-current-workspace-changed", onWorkspaceSwitch);
					window.removeEventListener("dsh-current-workspace-changed", refreshLocationBadges);
					if (!document.querySelector(".wSkVaW_root[data-phase=hero]")) {
						clearHeroChromeDom();
					}
				};
			}, `${PLUGIN}: hero header shell`);

			ctx.effect(() => {
				const onClose = () => selectHeroTab("Chat");
				window.addEventListener(CLOSE_EVENT, onClose);
				return () => window.removeEventListener(CLOSE_EVENT, onClose);
			}, `${PLUGIN}: hero close handler`);
		}

		return { apply, inject };
	},
});

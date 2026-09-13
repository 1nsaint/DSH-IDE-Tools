// Cross-cutting chrome polish (mobile layout, tooltips, sidebar brand).
// Feature plugins keep product UI; shared layout/CSS lives here.
window.__ModuleLoader__.load({
	id: "dsh-ui-polish",
	factory: (require) => {
		const PLUGIN = "dsh-ui-polish";
		const STYLE_ID = "dsh-ui-polish-css";

		const css = `
/* ---- Chat column: stock is 748px; a bit wider on large screens ---- */
.wSkVaW_root{
  --dsh-chat-content-width:min(920px,100%);
  --dsh-composer-card-max-width:calc(var(--dsh-chat-content-width) + 32px);
}
@media (min-width:1800px){
  .wSkVaW_root{
    --dsh-chat-content-width:min(1040px,100%);
  }
}
/*
 * Narrow / mobile: stock keeps chat 32px narrower than the composer card
 * so prose lines up with the input caret — wastes width on a phone or
 * collapsed-rail layout. One shared gutter; column + card same width.
 */
@media (max-width:1200px){
  .wSkVaW_root{
    --dsh-composer-side-clearance:8px;
    --dsh-chat-content-width:100%;
    --dsh-composer-card-max-width:100%;
  }
  .Md3f7G_scroll{
    padding-left:var(--dsh-composer-side-clearance)!important;
    padding-right:var(--dsh-composer-side-clearance)!important;
  }
  .uV2eYG_root{
    box-sizing:border-box!important;
    width:100%!important;
    max-width:100%!important;
    padding-left:var(--dsh-composer-side-clearance)!important;
    padding-right:var(--dsh-composer-side-clearance)!important;
  }
  .uV2eYG_card,
  .uV2eYG_notice{
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
  .uV2eYG_card{
    position:relative!important;
  }
  .uV2eYG_card .JObwrW_root{
    position:absolute!important;
    top:6px!important;
    right:8px!important;
    z-index:3;
    margin:0!important;
  }
  .uV2eYG_card .uV2eYG_input,
  .uV2eYG_card .uV2eYG_mirror,
  .uV2eYG_card .uV2eYG_backdrop{
    padding-right:40px!important;
  }
  .uV2eYG_row{
    flex-wrap:nowrap!important;
    gap:6px!important;
    align-items:center!important;
  }
  .uV2eYG_tools,
  .uV2eYG_modes{
    gap:6px!important;
    flex:none!important;
  }
  .uV2eYG_trailing{
    flex:1 1 auto!important;
    min-width:0!important;
    gap:6px!important;
    justify-content:flex-end!important;
  }
  .uV2eYG_trailing > *:not(.JObwrW_root):not(.uV2eYG_primary){
    min-width:0!important;
    max-width:min(148px,46vw)!important;
  }
  .uV2eYG_select{
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
}

/* ---- Hero workspace row: keep chips on one line without squashing ---- */
@media (max-width:900px){
  .wSkVaW_heroWorkspaceRow.dsh-hero-rowReady{
    flex-wrap:nowrap !important;
    align-items:center !important;
    gap:6px !important;
    min-height:32px;
    overflow-x:auto;
    overflow-y:visible;
    -webkit-overflow-scrolling:touch;
    scrollbar-width:none;
  }
  .wSkVaW_heroWorkspaceRow.dsh-hero-rowReady::-webkit-scrollbar{display:none;height:0}
  .wSkVaW_heroWorkspaceRow.dsh-hero-rowReady .pXSMma_workspace,
  .wSkVaW_heroWorkspaceRow.dsh-hero-rowReady .cubgiG_seat{
    padding-left:8px !important;
    padding-right:8px !important;
    max-width:min(40vw, 148px);
    min-width:0;
    flex:0 1 auto;
  }
  .wSkVaW_heroWorkspaceRow.dsh-hero-rowReady .cubgiG_seat{
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

/* ---- Slimmer rail already partly in session-tabs; reinforce details drawer host ---- */
@media (max-width:900px){
  .pI_x6G_frame[data-dsh-details-drawer="1"] .pI_x6G_handle[data-side=details]{
    display:none !important;
  }
}

/* Composer send + plugin primaries: accent outline, no solid fill */
[class*="primaryButton"],

.uV2eYG_primary,
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
.uV2eYG_primary svg,
.uV2eYG_primary path,
.dg_btnPrimary svg,
.db_btnPrimary svg,
.dd_btnPrimary svg,
.dsh-code-tab-btnPrimary svg,
.da_primary svg{
  color:var(--dsw-alias-state-business-primary)!important;
  fill:currentColor!important;
}
[class*="primaryButton"]:hover:not(:disabled),
.uV2eYG_primary:hover:not(:disabled),
.uV2eYG_primary:focus-visible:not(:disabled),
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
.uV2eYG_primary:disabled,
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
			const root = document.querySelector(".hHd-Xa_root");
			if (root && !root.classList.contains("hHd-Xa_collapsed")) return true;
			return false;
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
					? e.target.closest("[title], [data-dsh-title], button.hHd-Xa_toggle, button.hHd-Xa_iconButton, button.hHd-Xa_newSession")
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
					? e.target.closest("button.hHd-Xa_toggle, button.hHd-Xa_iconButton, button.hHd-Xa_newSession, [data-dsh-title]")
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
		function installBrandClosesSidebar(getLayout) {
			if (typeof document === "undefined") return () => {};
			const onClick = (e) => {
				const brand = e.target && e.target.closest
					? e.target.closest("button.hHd-Xa_brand")
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

		const inject = ["layout"];

		function apply(ctx) {
			ensureStyles();
			const getLayout = () => ctx.layout;

			ctx.effect(() => {
				ensureStyles();
				const stopTips = installTooltipGuard();
				const stopBrand = installBrandClosesSidebar(getLayout);
				const stopZh = installZhChromeEnglish();
				return () => {
					stopTips();
					stopBrand();
					stopZh();
				};
			}, `${PLUGIN}: chrome`);
		}

		return { apply, inject };
	},
});

window.__ModuleLoader__.load({
	id: "dsh-terminal",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-terminal";
		const RPC = "/terminal";

		const XTERM_THEME = {
			background: "#0f1115",
			foreground: "#e8eaed",
			cursor: "#e8eaed",
			cursorAccent: "#0f1115",
			selectionBackground: "#3b82f680",
			black: "#1e2127",
			red: "#e06c75",
			green: "#98c379",
			yellow: "#e5c07b",
			blue: "#61afef",
			magenta: "#c678dd",
			cyan: "#56b6c2",
			white: "#abb2bf",
			brightBlack: "#5c6370",
			brightRed: "#e06c75",
			brightGreen: "#98c379",
			brightYellow: "#e5c07b",
			brightBlue: "#61afef",
			brightMagenta: "#c678dd",
			brightCyan: "#56b6c2",
			brightWhite: "#ffffff",
		};

		const ESC = "\u001b";
		const ANSI = {
			reset: `${ESC}[0m`,
			bold: `${ESC}[1m`,
			dim: `${ESC}[2m`,
			underline: `${ESC}[4m`,
			underlineOff: `${ESC}[24m`,
			green: `${ESC}[32m`,
			yellow: `${ESC}[33m`,
			blue: `${ESC}[34m`,
			magenta: `${ESC}[35m`,
			cyan: `${ESC}[36m`,
			brightGreen: `${ESC}[92m`,
			brightYellow: `${ESC}[93m`,
			brightBlue: `${ESC}[94m`,
			brightCyan: `${ESC}[96m`,
		};

		const URL_RE = /https?:\/\/[^\s\]\)>'"\u001b]+/g;
		const IPV4_RE = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;
		const CSI_RE = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;
		const OSC_RE = /\u001b\][^\u0007]*(?:\u0007|\u001b\\)/g;
		/** user@host:~/path$ or user@host:path# */
		const PROMPT_RE = /^([A-Za-z0-9._-]+@[A-Za-z0-9._-]+):(.+[#\$])\s*$/;
		const ACCENT_FALLBACK_RGB = { r: 59, g: 130, b: 246 };
		const accentCtx = { el: null };

		function setTerminalAccentElement(el) {
			accentCtx.el = el || null;
			accentStylesCache.key = "";
		}

		function parseCssColor(raw) {
			const s = String(raw || "").trim();
			if (!s) return null;
			if (s.startsWith("#")) {
				let h = s.slice(1);
				if (h.length === 3) h = h.split("").map((c) => c + c).join("");
				if (h.length === 6) {
					return {
						r: parseInt(h.slice(0, 2), 16),
						g: parseInt(h.slice(2, 4), 16),
						b: parseInt(h.slice(4, 6), 16),
					};
				}
			}
			const m = s.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/);
			if (m) {
				return { r: Math.round(+m[1]), g: Math.round(+m[2]), b: Math.round(+m[3]) };
			}
			return null;
		}

		function blendRgb(a, b, t) {
			return {
				r: Math.round(a.r * (1 - t) + b.r * t),
				g: Math.round(a.g * (1 - t) + b.g * t),
				b: Math.round(a.b * (1 - t) + b.b * t),
			};
		}

		function readWorkspaceAccentRgb(el) {
			const nodes = [el, el?.closest?.(".dt_root"), document.documentElement].filter(Boolean);
			for (const node of nodes) {
				const cs = getComputedStyle(node);
				for (const prop of ["--dsw-alias-state-business-primary", "--dsw-alias-brand-primary"]) {
					const parsed = parseCssColor(cs.getPropertyValue(prop));
					if (parsed) return parsed;
				}
			}
			return ACCENT_FALLBACK_RGB;
		}

		function rgbToAnsiFg({ r, g, b }) {
			return `${ESC}[38;2;${r};${g};${b}m`;
		}

		function rgbToHex({ r, g, b }) {
			return `#${[r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("")}`;
		}

		let accentStylesCache = { key: "", fg: "", fgBold: "", fgMuted: "", link: "" };

		function getWorkspaceAccentStyles() {
			const rgb = readWorkspaceAccentRgb(accentCtx.el);
			const key = `${rgb.r},${rgb.g},${rgb.b}`;
			if (accentStylesCache.key === key) return accentStylesCache;
			const muted = blendRgb(rgb, { r: 184, g: 188, b: 197 }, 0.35);
			accentStylesCache = {
				key,
				fg: rgbToAnsiFg(rgb),
				fgBold: `${ANSI.bold}${rgbToAnsiFg(rgb)}`,
				fgMuted: rgbToAnsiFg(muted),
				link: `${rgbToAnsiFg(rgb)}${ANSI.underline}`,
			};
			return accentStylesCache;
		}

		function themeWithWorkspaceAccent(el) {
			const rgb = readWorkspaceAccentRgb(el);
			const muted = blendRgb(rgb, { r: 184, g: 188, b: 197 }, 0.35);
			const hex = rgbToHex(rgb);
			const hexMuted = rgbToHex(muted);
			return {
				...XTERM_THEME,
				green: hex,
				brightGreen: hex,
				blue: hex,
				brightBlue: hex,
				cyan: hexMuted,
				brightCyan: hexMuted,
			};
		}

		function applyWorkspaceTerminalTheme(term, el) {
			if (!term) return;
			term.options.theme = themeWithWorkspaceAccent(el);
		}

		function hasAnsi(s) {
			return s.includes(ESC);
		}

		function stripAnsi(s) {
			return String(s || "").replace(OSC_RE, "").replace(CSI_RE, "");
		}

		/** Leading \\r and CSI (clear line, bracketed paste) before a redrawn prompt. */
		function splitPromptPrefix(raw) {
			let i = 0;
			while (i < raw.length) {
				if (raw[i] === "\r") {
					i += 1;
					continue;
				}
				if (raw[i] === ESC) {
					const tail = raw.slice(i);
					const osc = tail.match(/^(\u001b\][^\u0007]*(?:\u0007|\u001b\\))/);
					if (osc) {
						i += osc[1].length;
						continue;
					}
					const csi = tail.match(/^(\u001b\[[0-9;?]*[ -/]*[@-~])/);
					if (csi) {
						i += csi[1].length;
						continue;
					}
				}
				break;
			}
			return { prefix: raw.slice(0, i), body: raw.slice(i) };
		}

		function colorizeShellPrompt(line) {
			const acc = getWorkspaceAccentStyles();
			const { prefix, body } = splitPromptPrefix(line);
			const plain = stripAnsi(body).replace(/\s+$/, "");
			const m = plain.match(PROMPT_RE);
			if (!m || plain.length > 320) return null;
			const trail = body.match(/(\s+)$/);
			const colored =
				`${acc.fgBold}${m[1]}${ANSI.reset}:${acc.fg}${m[2]}${ANSI.reset}` +
				(trail ? trail[1] : "");
			return prefix + colored;
		}

		function highlightUrls(text) {
			const acc = getWorkspaceAccentStyles();
			return text.replace(
				URL_RE,
				(url) => `${acc.link}${url}${ANSI.underlineOff}${ANSI.reset}`,
			);
		}

		/** Colorize plain SSH/MOTD/shell lines; leave TUI/ANSI streams untouched. */
		function colorizePlainLine(line) {
			if (!line) return line;

			const promptColored = colorizeShellPrompt(line);
			if (promptColored) return promptColored;

			// Rich TUI output (Gemini, vim, etc.) — do not touch.
			if (hasAnsi(line)) return line;

			if (/^Welcome to /i.test(line) || /^DeepSeek Harness/i.test(line)) {
				const acc = getWorkspaceAccentStyles();
				return `${acc.fgBold}${line}${ANSI.reset}`;
			}
			if (/^─+$/.test(line.trim())) {
				const acc = getWorkspaceAccentStyles();
				return `${acc.fgMuted}${line}${ANSI.reset}`;
			}
			if (/^Last login:/i.test(line)) {
				return `${ANSI.dim}${line}${ANSI.reset}`;
			}
			if (/^Web console:/i.test(line)) {
				const acc = getWorkspaceAccentStyles();
				return highlightUrls(
					line.replace(/^Web console:/i, `${acc.fgBold}Web console:${ANSI.reset}`),
				);
			}
			if (/^\s*\*\s/.test(line)) {
				const acc = getWorkspaceAccentStyles();
				const head = line.replace(/^(\s*\*\s+)/, `${acc.fg}$1${ANSI.reset}`);
				return highlightUrls(head);
			}
			if (/^(Run |To see |For upgrade|\d+\s+(updates?|device))/i.test(line)) {
				const acc = getWorkspaceAccentStyles();
				const body = highlightUrls(
					line.replace(/`([^`]+)`/g, `${acc.fgMuted}$1${ANSI.reset}`),
				);
				return `${ANSI.dim}${body}${ANSI.reset}`;
			}
			if (/^cd (\/|'|~)/.test(line)) {
				const acc = getWorkspaceAccentStyles();
				return `${ANSI.dim}${acc.fgMuted}${line}${ANSI.reset}`;
			}

			let out = highlightUrls(line);
			const acc = getWorkspaceAccentStyles();
			out = out.replace(IPV4_RE, (ip) => `${acc.fgMuted}${ip}${ANSI.reset}`);
			return out;
		}

		function colorizeTerminalOutput(text) {
			if (typeof text !== "string" || !text) return text;
			const parts = text.split(/(\r\n|\n|\r)/);
			let out = "";
			for (const part of parts) {
				if (part === "\r\n" || part === "\n" || part === "\r") {
					out += part;
					continue;
				}
				out += colorizePlainLine(part);
			}
			return out;
		}

		function openTerminalExternalLink(url) {
			const u = String(url || "").trim();
			if (!/^https?:\/\//i.test(u)) return;
			// User's desktop browser (Google session), not the Harness Browser tab.
			window.open(u, "_blank", "noopener,noreferrer");
		}

		function registerTerminalLinkProvider(term) {
			if (!term?.registerLinkProvider) return;
			term.registerLinkProvider({
				provideLinks(bufferLineNumber, callback) {
					try {
						const line = term.buffer.active.getLine(bufferLineNumber - 1);
						if (!line) {
							callback(undefined);
							return;
						}
						const text = line.translateToString(false);
						const links = [];
						URL_RE.lastIndex = 0;
						let m;
						while ((m = URL_RE.exec(text))) {
							const start = m.index;
							const end = start + m[0].length;
							links.push({
								text: m[0],
								range: {
									start: { x: start, y: bufferLineNumber - 1 },
									end: { x: end, y: bufferLineNumber - 1 },
								},
								activate: (_event, linkText) => {
									openTerminalExternalLink(linkText);
								},
							});
						}
						callback(links.length ? links : undefined);
					} catch {
						callback(undefined);
					}
				},
			});
		}

		const css = `
[class*="_scrollBody"]:has(.dt_root){overflow:hidden!important;display:flex;flex-direction:column;min-height:0}
[class*="_scrollBody"]:has(.dt_root)>[class*="_viewArea"],
[class*="_viewArea"]:has(.dt_root){flex:1 1 0!important;min-height:0!important;overflow:hidden!important;position:relative!important;height:auto!important}
[class*="_viewArea"]:has(.dt_root)>div{height:100%;min-height:0;display:flex;flex-direction:column;overflow:hidden}
.dt_root{display:flex;flex-direction:column;flex:1 1 0;height:100%;min-height:0;overflow:hidden;background:#0f1115;color:#e8eaed}
.dt_tabbar{
  display:flex;align-items:stretch;flex-shrink:0;height:34px;
  background:#16181d;border-bottom:1px solid #2a2d34;
}
.dt_tabs{
  display:flex;align-items:stretch;flex:1 1 auto;min-width:0;
  overflow-x:auto;scrollbar-width:none;
}
.dt_tabs::-webkit-scrollbar{display:none;height:0}
.dt_tab{
  position:relative;display:inline-flex;align-items:center;gap:6px;
  height:100%;padding:0 10px 0 12px;margin:0;border:none;border-right:1px solid #2a2d34;
  background:transparent;color:#9aa0a6;font:500 12px/1 ui-sans-serif,system-ui,sans-serif;
  cursor:pointer;flex:0 0 auto;max-width:180px;border-radius:0;
}
.dt_tab:hover{background:#1c1f26;color:#c8ccd2}
.dt_tabActive{
  background:#0f1115;color:#e8eaed;
}
.dt_tabActive::after{
  content:"";position:absolute;left:0;right:0;bottom:-1px;height:2px;
  background:var(--dsw-alias-state-business-primary,#3b82f6);
}
.dt_tabLabel{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:120px}
.dt_tabClose{
  display:inline-flex;align-items:center;justify-content:center;
  width:16px;height:16px;padding:0;border:none;border-radius:3px;
  background:transparent;color:#7a8088;cursor:pointer;font-size:13px;line-height:1;flex:none;
  opacity:0;
}
.dt_tab:hover .dt_tabClose,.dt_tabActive .dt_tabClose{opacity:1}
.dt_tabClose:hover{background:#2a2d34;color:#e8eaed}
.dt_tabAdd{
  display:inline-flex;align-items:center;justify-content:center;
  width:34px;height:100%;border:none;border-right:1px solid #2a2d34;
  background:transparent;color:#9aa0a6;font-size:16px;cursor:pointer;flex:none;
}
.dt_tabAdd:hover{background:#1c1f26;color:#e8eaed}
.dt_actions{
  display:flex;align-items:center;gap:8px;padding:0 10px;flex:none;
  border-left:1px solid #2a2d34;
}
.dt_meta{font-size:11px;color:#8b919a;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dt_btn{
  height:24px;padding:0 10px;border-radius:4px;border:1px solid #3a3d45;
  background:transparent;color:#c8ccd2;font-size:11px;cursor:pointer;
}
.dt_btn:hover{background:#1c1f26;color:#e8eaed}
.dt_btnActive{
  background:var(--dsw-alias-interactive-bg-hover,#1c1f26);
  color:var(--dsw-alias-state-business-primary,#e8eaed);
  border-color:var(--dsw-alias-state-business-primary,#3b82f6);
}
.dt_body{display:flex;flex:1 1 0;min-height:0;min-width:0;overflow:hidden}
.dt_main{display:flex;flex-direction:column;flex:1 1 0;min-width:0;min-height:0;overflow:hidden}
.dt_cmdSidebar{
  width:var(--dt-cmd-sidebar-width,300px);flex:0 0 var(--dt-cmd-sidebar-width,300px);
  max-width:60vw;min-width:220px;min-height:0;
  display:flex;flex-direction:column;overflow:hidden;position:relative;
  border-left:1px solid #2a2d34;background:#12141a;
}
.dt_cmdResize{
  position:absolute;left:0;top:0;bottom:0;width:11px;margin-left:-5px;
  cursor:col-resize;z-index:3;touch-action:none;
}
.dt_cmdResize:before{
  content:"";position:absolute;top:0;bottom:0;left:50%;width:1px;
  transform:translateX(-50%);background:var(--dsw-alias-border-l2);pointer-events:none;
}
.dt_cmdResize:hover:before,.dt_cmdResize.dt_dragging:before{
  width:3px;background:var(--dsw-alias-state-business-primary,#3b82f6);
}
body.dt_cmdResizing,body.dt_cmdResizing *{cursor:col-resize!important;user-select:none!important}
.dt_cmdHead{
  display:flex;align-items:center;justify-content:space-between;gap:8px;
  padding:8px 10px;border-bottom:1px solid #2a2d34;flex-shrink:0;
}
.dt_cmdTitle{font-size:12px;font-weight:600;color:#e8eaed}
.dt_cmdClose{
  width:22px;height:22px;padding:0;border:none;border-radius:4px;
  background:transparent;color:#7a8088;cursor:pointer;font-size:14px;line-height:1;
}
.dt_cmdClose:hover{background:#2a2d34;color:#e8eaed}
.dt_cmdPanel{
  flex:1 1 auto;min-height:0;display:flex;flex-direction:column;overflow:hidden;
}
.dt_cmdCats{
  display:flex;flex-direction:column;gap:4px;padding:8px;
  border-bottom:1px solid #2a2d34;flex-shrink:0;
}
.dt_cmdCat{
  width:100%;height:auto;padding:6px 10px;border-radius:6px;border:1px solid transparent;
  background:transparent;color:#9aa0a6;font:500 11px/1.3 ui-sans-serif,system-ui,sans-serif;
  cursor:pointer;text-align:left;
}
.dt_cmdCat:hover{background:#1c1f26;color:#c8ccd2}
.dt_cmdCatActive{
  color:var(--dsw-alias-state-business-primary,#e8eaed);
  border-color:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 45%,#2a2d34);
  background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#3b82f6) 10%,#1c1f26);
}
.dt_cmdList{
  flex:1 1 auto;min-height:0;overflow-y:auto;padding:6px 12px 6px 6px;
}
.dt_cmdRow{
  display:flex;flex-direction:row;align-items:stretch;gap:8px;
  width:100%;padding:8px 4px 8px 8px;margin:0 0 4px;border:none;border-radius:6px;
  background:transparent;color:#c8ccd2;font-size:11px;text-align:left;cursor:pointer;
}
.dt_cmdRow:hover{background:#1c1f26}
.dt_cmdRowMain{
  flex:1 1 auto;min-width:0;display:flex;flex-direction:column;gap:3px;
}
.dt_cmdLabel{color:#e8eaed;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;min-width:0}
.dt_cmdText{
  font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;
  color:#8b919a;font-size:10px;line-height:1.35;word-break:break-all;
}
.dt_cmdRun{
  display:flex;align-items:center;justify-content:center;align-self:stretch;
  width:28px;min-width:28px;padding:0;margin:0 4px 0 0;border:none;border-radius:0;
  background:transparent;color:#7a8088;cursor:pointer;flex:none;font-size:14px;line-height:1;
}
.dt_cmdRow:hover .dt_cmdRun{color:#9aa0a6}
.dt_cmdRun:hover{
  color:var(--dsw-alias-state-business-primary,#98c379)!important;
  background:transparent!important;
}
.dt_cmdHint{
  padding:6px 10px 8px;font-size:10px;line-height:14px;color:#6b7280;flex-shrink:0;
  border-bottom:1px solid #2a2d34;
}
.dt_stack{flex:1 1 0;min-height:0;position:relative;background:#0f1115}
.dt_host{position:absolute;inset:0;overflow:hidden;padding:4px 8px}
.dt_hostHidden{visibility:hidden;pointer-events:none;z-index:0}
.dt_host:not(.dt_hostHidden){z-index:1}
.dt_host .xterm{height:100%}
.dt_host .xterm-viewport{overflow-y:auto!important}
.dt_host .xterm-link{cursor:pointer;text-decoration:underline}
.dt_err{color:#f87171;padding:6px 12px;font-size:12px;flex-shrink:0;border-bottom:1px solid #2a2d34}
.dt_empty{padding:24px 16px;font-size:13px;color:var(--dsw-alias-label-tertiary,#9aa0a6)}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let tag = document.getElementById("dsh-terminal-css");
			if (!tag) {
				tag = document.createElement("style");
				tag.id = "dsh-terminal-css";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		let xtermReady = null;

		function injectCss(content, id) {
			if (document.getElementById(id)) return;
			const tag = document.createElement("style");
			tag.id = id;
			tag.textContent = content;
			document.head.appendChild(tag);
		}

		function loadScriptText(content, id) {
			const existing = document.getElementById(id);
			if (existing) existing.remove();
			const tag = document.createElement("script");
			tag.id = id;
			tag.textContent = [
				"(function(){",
				"var module=undefined,exports=undefined,define=undefined;",
				String(content || ""),
				"})();",
			].join("\n");
			document.head.appendChild(tag);
			return Promise.resolve();
		}

		async function ensureXterm(connection) {
			if (window.Terminal && (window.FitAddon?.FitAddon || typeof window.FitAddon === "function")) return;
			if (xtermReady) {
				try {
					await xtermReady;
					return;
				} catch {
					xtermReady = null;
				}
			}
			xtermReady = (async () => {
				const [js, cssAsset, fit] = await Promise.all([
					callRpc(connection, "asset", { name: "xterm.js" }),
					callRpc(connection, "asset", { name: "xterm.css" }),
					callRpc(connection, "asset", { name: "addon-fit.js" }),
				]);
				if (!js?.content) throw new Error("xterm.js asset empty");
				injectCss(cssAsset.content, "dsh-terminal-xterm-css");
				await loadScriptText(js.content, "dsh-terminal-xterm-js");
				await loadScriptText(fit.content, "dsh-terminal-fit-js");
				if (!window.Terminal) throw new Error("xterm.js failed to load");
				if (!(window.FitAddon?.FitAddon || typeof window.FitAddon === "function")) {
					throw new Error("FitAddon failed to load");
				}
			})();
			try {
				await xtermReady;
			} catch (err) {
				xtermReady = null;
				throw err;
			}
		}

		function FitCtor() {
			if (window.FitAddon?.FitAddon) return window.FitAddon.FitAddon;
			if (typeof window.FitAddon === "function") return window.FitAddon;
			throw new Error("FitAddon missing");
		}

		function newPaneKey() {
			return typeof crypto !== "undefined" && crypto.randomUUID
				? crypto.randomUUID()
				: "t-" + Math.random().toString(36).slice(2);
		}

		const CMD_SIDEBAR_WIDTH_KEY = "dsh-terminal.cmdSidebarWidth.v1";
		const CMD_SIDEBAR_MIN = 220;
		const CMD_SIDEBAR_MAX = 560;
		const CMD_SIDEBAR_DEFAULT = 300;

		const TERM_STORAGE_PREFIX = "dsh-terminal.termId.v1:";
		const LAYOUT_STORAGE_PREFIX = "dsh-terminal.layout.v1:";

		function workspaceScopeKey(ws) {
			if (!ws || typeof ws !== "object") return "default";
			if (typeof ws.cwd === "string" && ws.cwd) return ws.cwd;
			if (typeof ws.key === "string" && ws.key) return ws.key;
			return "default";
		}

		function resolveTerminalScope(sessionId) {
			const ws = typeof window !== "undefined" && window.__dshCurrentWorkspace?.get?.();
			const wsCwd = ws?.cwd || "";
			return {
				sessionId: sessionId || "",
				wsCwd,
				key: workspaceScopeKey(ws),
			};
		}

		function layoutStorageKey(scopeKey) {
			return `${LAYOUT_STORAGE_PREFIX}${scopeKey}`;
		}

		function loadWorkspaceLayout(scopeKey) {
			try {
				const raw = JSON.parse(sessionStorage.getItem(layoutStorageKey(scopeKey)) || "null");
				if (raw && Array.isArray(raw.panes) && raw.panes.length > 0) {
					const panes = raw.panes.map((p) => ({
						key: String(p.key),
						restart: Number(p.restart) || 0,
					}));
					const activeKey = raw.activeKey && panes.some((p) => p.key === raw.activeKey)
						? String(raw.activeKey)
						: panes[0].key;
					return { panes, activeKey };
				}
			} catch { /* ignore */ }
			const key = newPaneKey();
			return { panes: [{ key, restart: 0 }], activeKey: key };
		}

		function saveWorkspaceLayout(scopeKey, panes, activeKey) {
			if (!scopeKey) return;
			try {
				sessionStorage.setItem(layoutStorageKey(scopeKey), JSON.stringify({
					panes: panes.map((p) => ({ key: p.key, restart: p.restart || 0 })),
					activeKey,
				}));
			} catch { /* ignore */ }
		}

		function termStorageKey(_sessionId, paneKey, wsCwd) {
			const scope = wsCwd || "none";
			return `${TERM_STORAGE_PREFIX}${scope}:${paneKey}`;
		}

		function loadStoredTermId(key) {
			try {
				return sessionStorage.getItem(key) || "";
			} catch {
				return "";
			}
		}

		function saveStoredTermId(key, termId) {
			try {
				if (termId) sessionStorage.setItem(key, termId);
				else sessionStorage.removeItem(key);
			} catch { /* ignore */ }
		}

		function clearAllStoredTermIds() {
			try {
				for (let i = sessionStorage.length - 1; i >= 0; i -= 1) {
					const key = sessionStorage.key(i);
					if (key && key.startsWith(TERM_STORAGE_PREFIX)) sessionStorage.removeItem(key);
				}
			} catch { /* ignore */ }
		}

		async function openTerminalSession(connection, payload) {
			try {
				return await callRpc(connection, "open", payload);
			} catch (err) {
				const msg = err?.message || String(err);
				if (!/too many terminal/i.test(msg)) throw err;
				await callRpc(connection, "closeAll", {}).catch(() => {});
				clearAllStoredTermIds();
				return await callRpc(connection, "open", payload);
			}
		}

		function loadCmdSidebarWidth() {
			try {
				const n = parseInt(localStorage.getItem(CMD_SIDEBAR_WIDTH_KEY), 10);
				if (n >= CMD_SIDEBAR_MIN && n <= CMD_SIDEBAR_MAX) return n;
			} catch { /* ignore */ }
			return CMD_SIDEBAR_DEFAULT;
		}

		/** Quick-reference commands (→ active terminal prompt). Tooltip: item.desc || item.label */
		function cmdTooltip(item) {
			return item.desc || item.label || item.cmd || "";
		}

		const COMMAND_GROUPS = [
			{
				id: "linux",
				label: "Linux",
				commands: [
					{ label: "List directory (long)", desc: "Detailed listing with permissions, owner, size, date", cmd: "ls -la" },
					{ label: "List with sizes", desc: "Long list with human-readable file sizes", cmd: "ls -lah" },
					{ label: "Current directory", desc: "Print the full path of the working directory", cmd: "pwd" },
					{ label: "Change directory", desc: "Move into a folder (add path after command)", cmd: "cd " },
					{ label: "Home directory", desc: "Jump to your home folder", cmd: "cd ~" },
					{ label: "Parent directory", desc: "Go up one directory level", cmd: "cd .." },
					{ label: "Tree view (2 levels)", desc: "Show folder structure two levels deep", cmd: "tree -L 2" },
					{ label: "Find files by name", desc: "Search current tree for a filename pattern", cmd: 'find . -iname "*pattern*"' },
					{ label: "Find files by type", desc: "Find files matching a name pattern (e.g. *.yml)", cmd: "find . -type f -name '*.yml'" },
					{ label: "Search in files", desc: "Find a text pattern in file contents recursively", cmd: 'grep -rn "pattern" .' },
					{ label: "Search (ignore binary)", desc: "Same as grep but skip binary files", cmd: 'grep -rI "pattern" .' },
					{ label: "Disk space", desc: "Free space on mounted filesystems", cmd: "df -h" },
					{ label: "Folder sizes", desc: "Size of each item in the current directory", cmd: "du -sh *" },
					{ label: "Memory usage", desc: "RAM and swap summary", cmd: "free -h" },
					{ label: "CPU / processes (top)", desc: "Live view of CPU and processes (q to quit)", cmd: "top" },
					{ label: "Process list", desc: "Top processes sorted by memory use", cmd: "ps aux --sort=-%mem | head -20" },
					{ label: "Kill process by PID", desc: "Send signal to a process ID", cmd: "kill " },
					{ label: "Kill by name", desc: "Stop processes matching a command name", cmd: 'pkill -f "process-name"' },
					{ label: "Listening ports", desc: "TCP ports open on this machine", cmd: "ss -tlnp" },
					{ label: "Network interfaces", desc: "Brief list of interfaces and IP addresses", cmd: "ip -br a" },
					{ label: "Ping host", desc: "Check reachability (replace HOST)", cmd: "ping -c 4 HOST" },
					{ label: "Download URL", desc: "Download a file keeping its remote name", cmd: "curl -LO " },
					{ label: "Follow log file", desc: "Stream new lines as they are appended", cmd: "tail -f " },
					{ label: "Last 100 log lines", desc: "Show the most recent lines of a file", cmd: "tail -n 100 " },
					{ label: "Make directory", desc: "Create a folder (and parents if needed)", cmd: "mkdir -p " },
					{ label: "Copy recursive", desc: "Copy a file or directory tree", cmd: "cp -r src/ dest/" },
					{ label: "Move / rename", desc: "Move or rename files and folders", cmd: "mv old new" },
					{ label: "Remove file", desc: "Delete a file (add path)", cmd: "rm " },
					{ label: "Remove directory", desc: "Delete a folder and everything inside", cmd: "rm -rf " },
					{ label: "Make executable", desc: "Allow a script to be run as a program", cmd: "chmod +x " },
					{ label: "Archive extract", desc: "Unpack a .tar.gz archive", cmd: "tar -xvf archive.tar.gz" },
					{ label: "Archive create", desc: "Compress a folder into .tar.gz", cmd: "tar -czvf backup.tar.gz folder/" },
					{ label: "System uptime", desc: "How long the system has been running", cmd: "uptime" },
					{ label: "Kernel / arch", desc: "Kernel version and CPU architecture", cmd: "uname -a" },
					{ label: "Service status", desc: "Check a systemd unit (replace service name)", cmd: "systemctl status " },
					{ label: "Follow service logs", desc: "Live journal for a systemd service", cmd: "journalctl -u service-name -f" },
					{ label: "SSH to remote", desc: "Open a shell on another machine", cmd: "ssh user@host" },
					{ label: "Copy to remote (scp)", desc: "Copy a file to a remote path over SSH", cmd: "scp file.txt user@host:/path/" },
				],
			},
			{
				id: "docker",
				label: "Docker",
				commands: [
					{ label: "Running containers", desc: "List containers that are currently up", cmd: "docker ps" },
					{ label: "All containers", desc: "Include stopped and exited containers", cmd: "docker ps -a" },
					{ label: "Compose projects", desc: "List Docker Compose projects on this host", cmd: "docker compose ls" },
					{ label: "Compose — status", desc: "Services in the current compose project", cmd: "docker compose ps" },
					{ label: "Compose — all (incl. stopped)", desc: "All services including stopped", cmd: "docker compose ps -a" },
					{ label: "Compose — up (detached)", desc: "Start stack in background", cmd: "docker compose up -d" },
					{ label: "Compose — rebuild + up", desc: "Rebuild images then start detached", cmd: "docker compose up -d --build" },
					{ label: "Compose — pull images", desc: "Download latest images for the stack", cmd: "docker compose pull" },
					{ label: "Compose — logs (follow)", desc: "Tail logs from all services", cmd: "docker compose logs -f --tail=100" },
					{ label: "Compose — logs one service", desc: "Follow logs for a single service name", cmd: "docker compose logs -f SERVICE" },
					{ label: "Compose — stop", desc: "Stop services without removing containers", cmd: "docker compose stop" },
					{ label: "Compose — restart", desc: "Restart all services in the project", cmd: "docker compose restart" },
					{ label: "Compose — down", desc: "Stop and remove containers (keep volumes)", cmd: "docker compose down" },
					{ label: "Compose — down + volumes", desc: "Teardown including named volumes", cmd: "docker compose down -v" },
					{ label: "Compose — exec shell", desc: "Open a shell in a running service", cmd: "docker compose exec SERVICE sh" },
					{ label: "Compose — one-off run", desc: "Run a command in a new temporary container", cmd: "docker compose run --rm SERVICE sh" },
					{ label: "Compose — validate config", desc: "Render and validate compose files", cmd: "docker compose config" },
					{ label: "Compose — rebuild service", desc: "Rebuild and restart one service only", cmd: "docker compose up -d --no-deps --build SERVICE" },
					{ label: "Compose — watch (dev)", desc: "Auto-sync and rebuild on file changes", cmd: "docker compose watch" },
					{ label: "Inspect container", desc: "Full JSON metadata for a container", cmd: "docker inspect CONTAINER" },
					{ label: "Container logs", desc: "Follow logs for one container", cmd: "docker logs -f --tail=100 CONTAINER" },
					{ label: "Exec into container", desc: "Interactive shell inside a running container", cmd: "docker exec -it CONTAINER sh" },
					{ label: "Remove container", desc: "Force-remove a container", cmd: "docker rm -f CONTAINER" },
					{ label: "List images", desc: "Show local Docker images", cmd: "docker images" },
					{ label: "Remove dangling images", desc: "Delete unused intermediate images", cmd: "docker image prune" },
					{ label: "Remove stopped containers", desc: "Delete all stopped containers", cmd: "docker container prune" },
					{ label: "Disk usage summary", desc: "Space used by images, containers, volumes", cmd: "docker system df" },
					{ label: "Live stats", desc: "Live CPU/memory per container", cmd: "docker stats" },
					{ label: "Prune unused (safe)", desc: "Remove unused data (not named volumes)", cmd: "docker system prune" },
					{ label: "Networks list", desc: "Docker networks on this host", cmd: "docker network ls" },
					{ label: "Volumes list", desc: "Named volumes stored by Docker", cmd: "docker volume ls" },
				],
			},
			{
				id: "git",
				label: "Git",
				commands: [
					{ label: "Status", desc: "Show modified, staged, and untracked files", cmd: "git status" },
					{ label: "Short status", desc: "Compact status (branch + changed paths)", cmd: "git status -sb" },
					{ label: "Diff (unstaged)", desc: "Line changes not yet staged", cmd: "git diff" },
					{ label: "Diff (staged)", desc: "Changes already added for commit", cmd: "git diff --staged" },
					{ label: "Stage file", desc: "Add a path to the next commit", cmd: "git add " },
					{ label: "Stage all", desc: "Stage every change in the repo", cmd: "git add -A" },
					{ label: "Unstage file", desc: "Remove a path from the staging area", cmd: "git restore --staged " },
					{ label: "Discard file changes", desc: "Revert a file to last commit (careful)", cmd: "git restore " },
					{ label: "Commit", desc: "Create a commit with a message", cmd: 'git commit -m "message"' },
					{ label: "Amend last commit", desc: "Replace the previous commit (same message edit)", cmd: 'git commit --amend -m "message"' },
					{ label: "Log (oneline)", desc: "Recent commits, one line each", cmd: "git log --oneline -15" },
					{ label: "Log (graph)", desc: "History with branch graph", cmd: "git log --oneline --graph -15" },
					{ label: "Show commit", desc: "Patch and metadata for one commit", cmd: "git show " },
					{ label: "Current branch", desc: "Print the checked-out branch name", cmd: "git branch --show-current" },
					{ label: "List branches", desc: "Local branches and current marker", cmd: "git branch -vv" },
					{ label: "Fetch", desc: "Download new commits from remote (no merge)", cmd: "git fetch" },
					{ label: "Pull", desc: "Fetch and merge the current branch", cmd: "git pull" },
					{ label: "Push", desc: "Upload local commits to remote", cmd: "git push" },
					{ label: "Push new branch", desc: "Publish branch and set upstream", cmd: "git push -u origin BRANCH" },
					{ label: "Stash changes", desc: "Save WIP changes and clean working tree", cmd: "git stash push -m \"wip\"" },
					{ label: "Stash pop", desc: "Re-apply the latest stash", cmd: "git stash pop" },
					{ label: "Clone repo", desc: "Copy a remote repository locally", cmd: "git clone URL" },
					{ label: "Remote list", desc: "Show configured remotes (origin, etc.)", cmd: "git remote -v" },
				],
			},
			{
				id: "node",
				label: "Node",
				commands: [
					{ label: "Node version", desc: "Check installed Node.js version", cmd: "node -v" },
					{ label: "npm version", desc: "Check npm CLI version", cmd: "npm -v" },
					{ label: "Install dependencies", desc: "Install packages from package.json", cmd: "npm install" },
					{ label: "Install (clean CI)", desc: "Fresh install from lockfile only", cmd: "npm ci" },
					{ label: "Run script", desc: "Run a package.json script by name", cmd: "npm run " },
					{ label: "Run dev", desc: "Start the usual dev server script", cmd: "npm run dev" },
					{ label: "Run build", desc: "Run the production build script", cmd: "npm run build" },
					{ label: "Run tests", desc: "Run the test script", cmd: "npm test" },
					{ label: "List scripts", desc: "Show available npm scripts", cmd: "npm run" },
					{ label: "pnpm install", desc: "Install with pnpm (monorepos)", cmd: "pnpm install" },
					{ label: "pnpm run dev", desc: "Run dev script via pnpm", cmd: "pnpm run dev" },
					{ label: "npx (one-off)", desc: "Run a package binary without global install", cmd: "npx " },
					{ label: "Install Gemini CLI", desc: "Once per workspace volume (~/.local); persists across container recreates", cmd: "npm install -g @google/gemini-cli --allow-scripts=@github/keytar" },
					{ label: "Gemini CLI", desc: "Interactive CLI — pick Login with Google; Ctrl+click auth URL, paste code", cmd: "gemini" },
					{ label: "Check outdated", desc: "See which dependencies have updates", cmd: "npm outdated" },
					{ label: "Audit", desc: "Report known vulnerabilities in deps", cmd: "npm audit" },
				],
			},
			{
				id: "ollama",
				label: "Ollama",
				commands: [
					{ label: "List models", desc: "Show models installed locally", cmd: "ollama list" },
					{ label: "List models (alias)", desc: "Same as list (short command)", cmd: "ollama ls" },
					{ label: "Running models", desc: "Models loaded in memory right now", cmd: "ollama ps" },
					{ label: "Pull model", desc: "Download a model from the library", cmd: "ollama pull MODEL" },
					{ label: "Run interactive chat", desc: "Chat in the terminal with a model", cmd: "ollama run MODEL" },
					{ label: "One-shot prompt", desc: "Single question without interactive mode", cmd: 'ollama run MODEL "Hello"' },
					{ label: "Show model info", desc: "Parameters and metadata for a model", cmd: "ollama show MODEL" },
					{ label: "Show modelfile", desc: "Print the Modelfile definition", cmd: "ollama show MODEL --modelfile" },
					{ label: "Stop / unload model", desc: "Free GPU/RAM by unloading a model", cmd: "ollama stop MODEL" },
					{ label: "Remove model", desc: "Delete a model from disk", cmd: "ollama rm MODEL" },
					{ label: "Copy model", desc: "Duplicate a model under a new name", cmd: "ollama cp MODEL my-model" },
					{ label: "Create from Modelfile", desc: "Build a custom model from a Modelfile", cmd: "ollama create mymodel -f Modelfile" },
					{ label: "CLI help", desc: "Ollama command overview", cmd: "ollama --help" },
					{ label: "Run command help", desc: "Help for ollama run options", cmd: "ollama run --help" },
					{ label: "API — list models", desc: "HTTP: list installed Ollama models", cmd: "curl -s localhost:11434/api/tags" },
					{ label: "API — remote", desc: "List models on another host running Ollama", cmd: "curl -s HOST:11434/api/tags" },
					{ label: "API — POST body from file", desc: "Send chat/generate JSON from a file", cmd: "curl -s localhost:11434/api/chat -d @body.json" },
					{ label: "Service status", desc: "systemd status for the Ollama service", cmd: "systemctl status ollama --no-pager" },
					{ label: "Service logs", desc: "Follow Ollama journal logs", cmd: "journalctl -u ollama -f" },
					{ label: "Models directory", desc: "List files in the local model store", cmd: "ls -lah ~/.ollama/models" },
				],
			},
			{
				id: "llamacpp",
				label: "llama.cpp",
				commands: [
					{ label: "List models", desc: "OpenAI-compatible API: list loaded models", cmd: "curl -s localhost:8080/v1/models" },
					{ label: "Remote — list models", desc: "Same API on another host (port 8080)", cmd: "curl -s HOST:8080/v1/models" },
					{ label: "Health check", desc: "See if the llama.cpp HTTP server responds", cmd: "curl -s localhost:8080/health" },
					{ label: "Chat API (JSON file)", desc: "POST chat completion body from req.json", cmd: "curl -s localhost:8080/v1/chat/completions -H 'Content-Type: application/json' -d @req.json" },
					{ label: "Follow service logs", desc: "Follow llama-server systemd journal", cmd: "journalctl -u llama-server -f" },
					{ label: "Check port 8080", desc: "See if something is listening on 8080", cmd: "ss -tlnp | grep 8080" },
					{ label: "GPU (NVIDIA)", desc: "GPU utilization and memory (NVIDIA)", cmd: "nvidia-smi" },
					{ label: "Process — llama", desc: "Find llama-related processes", cmd: "ps aux | grep -i llama" },
				],
			},
		];

		function shellBase(shell) {
			if (!shell || typeof shell !== "string") return "bash";
			const parts = shell.split("/");
			return parts[parts.length - 1] || "bash";
		}

		const TERMINAL_REFIT_EVENT = "dsh-terminal-refit";
		const terminalRefitHandlers = new Set();
		const PARK_HOST_ID = "dsh-terminal-park-host";
		/** @type {Map<string, { term: any, fit: any, termId: string, closed: boolean }>} */
		const parkedTerminalPanes = new Map();

		function ensureParkHost() {
			let el = document.getElementById(PARK_HOST_ID);
			if (!el) {
				el = document.createElement("div");
				el.id = PARK_HOST_ID;
				el.setAttribute("aria-hidden", "true");
				el.style.cssText = "position:fixed;left:-10000px;top:0;width:900px;height:600px;overflow:hidden;visibility:hidden;pointer-events:none;";
				document.body.appendChild(el);
			}
			return el;
		}

		function disposeParkedTerm(entry) {
			if (!entry?.term) return;
			try {
				entry.term._dshCleanup?.();
				entry.term.dispose();
			} catch {
				/* ignore */
			}
		}

		function parkTerminalPane(storageKey, entry) {
			if (!entry?.term?.element) return;
			try {
				entry.term._dshCleanup?.();
			} catch {
				/* ignore */
			}
			entry.term._dshCleanup = null;
			try {
				ensureParkHost().appendChild(entry.term.element);
			} catch {
				/* ignore */
			}
			parkedTerminalPanes.set(storageKey, {
				term: entry.term,
				fit: entry.fit,
				termId: entry.termId,
				closed: !!entry.closed,
			});
		}

		function takeParkedTerminalPane(storageKey, expectedTermId) {
			const parked = parkedTerminalPanes.get(storageKey);
			if (!parked) return null;
			if (expectedTermId && parked.termId !== expectedTermId) {
				parkedTerminalPanes.delete(storageKey);
				disposeParkedTerm(parked);
				return null;
			}
			parkedTerminalPanes.delete(storageKey);
			return parked;
		}

		function attachTerminalResize(hostRef, termRef, fitRef, termIdRef, closedRef, connection, syncFn) {
			const onResize = () => syncFn(false);
			let resizeRaf = 0;
			const scheduleResize = () => {
				if (resizeRaf) return;
				resizeRaf = requestAnimationFrame(() => {
					resizeRaf = 0;
					onResize();
				});
			};
			const ro = typeof ResizeObserver !== "undefined" && hostRef.current
				? new ResizeObserver(() => scheduleResize())
				: null;
			if (ro && hostRef.current) ro.observe(hostRef.current);
			window.addEventListener("resize", scheduleResize);
			requestAnimationFrame(() => scheduleResize());
			return () => {
				ro?.disconnect();
				window.removeEventListener("resize", scheduleResize);
				if (resizeRaf) cancelAnimationFrame(resizeRaf);
			};
		}

		function waitForHostLayout(host, { maxFrames = 120 } = {}) {
			return new Promise((resolve) => {
				let frames = 0;
				const step = () => {
					if (!host || !host.isConnected) {
						resolve(false);
						return;
					}
					if (host.clientWidth >= 8 && host.clientHeight >= 8) {
						resolve(true);
						return;
					}
					if (frames >= maxFrames) {
						resolve(false);
						return;
					}
					frames += 1;
					requestAnimationFrame(step);
				};
				step();
			});
		}

		function TerminalPane({
			sessionId,
			connection,
			active,
			workspaceCwd,
			keepServerOnUnmount,
			onStatus,
			restartToken,
			onInjector,
			layoutKey,
			paneKey,
		}) {
			const hostRef = React.useRef(null);
			const bindHostRef = React.useCallback((node) => {
				hostRef.current = node;
				if (node) setTerminalAccentElement(node.closest(".dt_root") || node);
			}, []);
			const termRef = React.useRef(null);
			const fitRef = React.useRef(null);
			const termIdRef = React.useRef(null);
			const closedRef = React.useRef(false);
			const genRef = React.useRef(0);
			const statusRef = React.useRef(onStatus);
			const onInjectorRef = React.useRef(onInjector);
			const sessionIdRef = React.useRef(sessionId);
			statusRef.current = onStatus;
			onInjectorRef.current = onInjector;
			sessionIdRef.current = sessionId;

			const publishInjector = React.useCallback((inj) => {
				onInjectorRef.current?.(inj);
			}, []);

			const syncTerminalGeometry = React.useCallback((focus = false) => {
				try {
					const host = hostRef.current;
					const fitAddon = fitRef.current;
					const termInst = termRef.current;
					if (!host || !fitAddon || !termInst || !host.isConnected) return false;
					if (host.clientWidth < 8 || host.clientHeight < 8) return false;
					fitAddon.fit();
					const id = termIdRef.current;
					if (id && !closedRef.current && connection) {
						callRpc(connection, "resize", {
							termId: id,
							cols: termInst.cols,
							rows: termInst.rows,
						}).catch(() => {});
					}
					termInst.refresh(0, Math.max(0, termInst.rows - 1));
					if (focus) termInst.focus();
					return true;
				} catch {
					return false;
				}
			}, [connection]);

			const syncGeometryRef = React.useRef(syncTerminalGeometry);
			syncGeometryRef.current = syncTerminalGeometry;

			const disposeTerminal = React.useCallback(() => {
				try {
					termRef.current?._dshCleanup?.();
					termRef.current?.dispose();
				} catch {
					/* ignore */
				}
				termRef.current = null;
				fitRef.current = null;
				onInjectorRef.current?.(null);
			}, []);

			React.useEffect(() => {
				if (!connection || !active) return undefined;
				const wsCwd = workspaceCwd || "";
				const storageKey = termStorageKey(sessionId, paneKey, wsCwd);
				if (!sessionId && !wsCwd) return undefined;
				let cancelled = false;

				const wireInjector = (term) => {
					publishInjector({
						write: (text, execute = false) => {
							const id = termIdRef.current;
							if (!id || closedRef.current || !connection) return false;
							const payload = execute && !/[\r\n]$/.test(text) ? `${text}\r` : text;
							callRpc(connection, "write", { termId: id, data: payload }).catch((err) => {
								statusRef.current?.({
									phase: "error",
									meta: err?.message || String(err),
								});
							});
							term.focus();
							return true;
						},
						focus: () => term.focus(),
					});
				};

				const restoreParked = async () => {
					if (!keepServerOnUnmount || !hostRef.current) return false;
					const expectedId = loadStoredTermId(storageKey);
					if (!expectedId) return false;
					const parked = takeParkedTerminalPane(storageKey, expectedId);
					if (!parked?.term) return false;
					const sized = await waitForHostLayout(hostRef.current);
					if (cancelled || !hostRef.current) {
						parkTerminalPane(storageKey, {
							term: parked.term,
							fit: parked.fit,
							termId: parked.termId,
							closed: parked.closed,
						});
						return true;
					}
					if (!sized) {
						parkTerminalPane(storageKey, {
							term: parked.term,
							fit: parked.fit,
							termId: parked.termId,
							closed: parked.closed,
						});
						return false;
					}
					hostRef.current.replaceChildren();
					hostRef.current.appendChild(parked.term.element);
					termRef.current = parked.term;
					fitRef.current = parked.fit;
					termIdRef.current = parked.termId;
					closedRef.current = parked.closed;
					parked.term._dshCleanup = attachTerminalResize(
						hostRef,
						termRef,
						fitRef,
						termIdRef,
						closedRef,
						connection,
						(v) => syncGeometryRef.current(v),
					);
					wireInjector(parked.term);
					syncGeometryRef.current(true);
					requestAnimationFrame(() => syncGeometryRef.current(true));
					return true;
				};

				const openTerm = async (hostAttempt = 0) => {
					if (!hostRef.current) {
						if (hostAttempt < 30 && !cancelled) {
							setTimeout(() => openTerm(hostAttempt + 1), 50);
						}
						return;
					}
					if (await restoreParked()) return;

					const gen = ++genRef.current;
					const sized = await waitForHostLayout(hostRef.current);
					if (cancelled || gen !== genRef.current) return;
					if (!sized) {
						if (hostAttempt < 120 && !cancelled) {
							setTimeout(() => openTerm(hostAttempt + 1), 32);
						} else if (!cancelled) {
							statusRef.current?.({
								phase: "error",
								meta: "Terminal area has no size — resize the panel or click Restart",
							});
						}
						return;
					}
					closedRef.current = false;
					statusRef.current?.({ phase: "loading", meta: "Starting…" });
					try {
						await ensureXterm(connection);
						if (cancelled || gen !== genRef.current) return;

						disposeTerminal();
						hostRef.current.replaceChildren();

						const term = new window.Terminal({
							cursorBlink: true,
							cursorStyle: "bar",
							fontFamily: 'Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
							fontSize: 13,
							// Ink/Gemini HalfLinePaddedBox (▄▀) needs tight line metrics.
							lineHeight: 1,
							letterSpacing: 0,
							customGlyphs: false,
							convertEol: true,
							theme: themeWithWorkspaceAccent(
								hostRef.current?.closest?.(".dt_root") || hostRef.current,
							),
							allowProposedApi: true,
							linkHandler: {
								activate: (event, uri) => {
									openTerminalExternalLink(uri);
								},
							},
						});
						const fit = new (FitCtor())();
						term.loadAddon(fit);
						term.open(hostRef.current);
						const accentEl = hostRef.current?.closest?.(".dt_root") || hostRef.current;
						setTerminalAccentElement(accentEl);
						applyWorkspaceTerminalTheme(term, accentEl);
						registerTerminalLinkProvider(term);
						fit.fit();
						if (typeof document !== "undefined" && document.fonts?.ready) {
							document.fonts.ready.then(() => { try { fit.fit(); } catch { /* ignore */ } }).catch(() => {});
						}
						termRef.current = term;
						fitRef.current = fit;

						const cols = Math.max(term.cols || 80, 40);
						const rows = Math.max(term.rows || 24, 10);
						const savedId = loadStoredTermId(storageKey);
						let res = null;
						if (savedId) {
							try {
								res = await callRpc(connection, "attach", {
									termId: savedId,
									cols,
									rows,
								});
							} catch {
								saveStoredTermId(storageKey, "");
							}
						}
						if (!res) {
							res = await openTerminalSession(connection, {
								sessionId: sessionIdRef.current || undefined,
								workspaceCwd: wsCwd || undefined,
								cols,
								rows,
							});
							saveStoredTermId(storageKey, res.termId);
						}
						if (cancelled || gen !== genRef.current) {
							if (!res.attached) {
								await callRpc(connection, "close", { termId: res.termId }).catch(() => {});
								saveStoredTermId(storageKey, "");
							}
							return;
						}
						termIdRef.current = res.termId;
						if (res.banner) term.write(colorizeTerminalOutput(res.banner));
						if (res.replay) term.write(colorizeTerminalOutput(res.replay));
						syncGeometryRef.current(false);
						requestAnimationFrame(() => syncGeometryRef.current(false));
						requestAnimationFrame(() => requestAnimationFrame(() => syncGeometryRef.current(false)));
						const shell = res.remote ? "ssh" : shellBase(res.shell);
						statusRef.current?.({
							phase: "ready",
							meta: res.remote
								? `SSH · ${res.shell || res.hostId || "remote"} · ${res.cwd || ""}`
								: `${shell} · ${res.cwd || ""}`,
							shell,
						});

						term.onData((data) => {
							const id = termIdRef.current;
							if (!id || closedRef.current) return;
							callRpc(connection, "write", { termId: id, data }).catch((err) => {
								statusRef.current?.({
									phase: "error",
									meta: err?.message || String(err),
								});
							});
						});

						term._dshCleanup = attachTerminalResize(
							hostRef,
							termRef,
							fitRef,
							termIdRef,
							closedRef,
							connection,
							(v) => syncGeometryRef.current(v),
						);

						wireInjector(term);
					} catch (err) {
						if (cancelled || gen !== genRef.current) return;
						statusRef.current?.({
							phase: "error",
							meta: err?.message || String(err),
						});
					}
				};

				const t = setTimeout(openTerm, 0);
				return () => {
					cancelled = true;
					clearTimeout(t);
					genRef.current += 1;
					const term = termRef.current;
					const fit = fitRef.current;
					const id = termIdRef.current;
					const storedId = loadStoredTermId(storageKey);
					const canPark = keepServerOnUnmount && term && id && storedId === id;
					termIdRef.current = null;
					onInjectorRef.current?.(null);
					if (canPark) {
						parkTerminalPane(storageKey, {
							term,
							fit,
							termId: id,
							closed: closedRef.current,
						});
						termRef.current = null;
						fitRef.current = null;
					} else {
						disposeTerminal();
						if (id && connection && !keepServerOnUnmount) {
							callRpc(connection, "close", { termId: id }).catch(() => {});
							saveStoredTermId(storageKey, "");
						}
					}
				};
			}, [connection, restartToken, paneKey, workspaceCwd, keepServerOnUnmount, sessionId, active]);

			React.useEffect(() => {
				if (!connection) return undefined;
				let alive = true;
				const tick = async () => {
					const id = termIdRef.current;
					const term = termRef.current;
					if (!id || !term || closedRef.current) return;
					if (!active) return;
					try {
						const res = await callRpc(connection, "read", { termId: id });
						if (!alive) return;
						if (res.data) term.write(colorizeTerminalOutput(res.data));
						if (res.closed) {
							closedRef.current = true;
							statusRef.current?.((prev) => ({
								phase: "exited",
								meta: String(prev?.meta || "").includes("(exited)")
									? prev.meta
									: `${prev?.meta || "shell"} (exited)`,
								shell: prev?.shell,
							}));
						}
					} catch {
						/* ignore */
					}
				};
				const iv = setInterval(tick, 50);
				tick();
				return () => {
					alive = false;
					clearInterval(iv);
				};
			}, [connection, sessionId, active]);

			React.useEffect(() => {
				if (!active) return undefined;
				const refit = () => {
					if (!active) return;
					waitForHostLayout(hostRef.current).then(() => {
						syncGeometryRef.current(true);
					});
				};
				terminalRefitHandlers.add(refit);
				const onGlobalRefit = () => refit();
				window.addEventListener(TERMINAL_REFIT_EVENT, onGlobalRefit);
				const host = hostRef.current;
				let io = null;
				if (host && typeof IntersectionObserver !== "undefined") {
					io = new IntersectionObserver((entries) => {
						if (!entries.some((e) => e.isIntersecting)) return;
						refit();
					}, { threshold: 0.01 });
					io.observe(host);
				}
				refit();
				return () => {
					terminalRefitHandlers.delete(refit);
					window.removeEventListener(TERMINAL_REFIT_EVENT, onGlobalRefit);
					io?.disconnect();
				};
			}, [active, layoutKey, restartToken, paneKey]);

			React.useEffect(() => {
				if (!active) return;
				const accentEl = hostRef.current?.closest?.(".dt_root") || hostRef.current;
				if (accentEl) setTerminalAccentElement(accentEl);
				applyWorkspaceTerminalTheme(termRef.current, accentEl);
				waitForHostLayout(hostRef.current).then(() => syncGeometryRef.current(true));
			}, [active, connection, layoutKey, sessionId]);

			return React.createElement("div", {
				className: "dt_host" + (active ? "" : " dt_hostHidden"),
				ref: bindHostRef,
				onClick: () => active && termRef.current?.focus(),
			});
		}

		function CommandSidebarResize({ bodyRef, width, onWidth }) {
			const dragging = React.useRef(false);
			const [isDragging, setIsDragging] = React.useState(false);
			const liveWidth = React.useRef(width);
			const resizeRaf = React.useRef(0);
			liveWidth.current = width;

			const scheduleTerminalResize = React.useCallback(() => {
				if (resizeRaf.current) return;
				resizeRaf.current = requestAnimationFrame(() => {
					resizeRaf.current = 0;
					window.dispatchEvent(new Event("resize"));
				});
			}, []);

			React.useEffect(() => {
				const onMove = (e) => {
					if (!dragging.current || !bodyRef.current) return;
					const rect = bodyRef.current.getBoundingClientRect();
					const next = Math.min(
						CMD_SIDEBAR_MAX,
						Math.max(CMD_SIDEBAR_MIN, rect.right - e.clientX),
					);
					onWidth(next);
					scheduleTerminalResize();
				};
				const onUp = () => {
					if (!dragging.current) return;
					dragging.current = false;
					setIsDragging(false);
					document.body.classList.remove("dt_cmdResizing");
					try {
						localStorage.setItem(CMD_SIDEBAR_WIDTH_KEY, String(liveWidth.current));
					} catch { /* ignore */ }
					scheduleTerminalResize();
				};
				window.addEventListener("pointermove", onMove);
				window.addEventListener("pointerup", onUp);
				return () => {
					window.removeEventListener("pointermove", onMove);
					window.removeEventListener("pointerup", onUp);
					document.body.classList.remove("dt_cmdResizing");
					setIsDragging(false);
					if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);
				};
			}, [bodyRef, onWidth, scheduleTerminalResize]);

			return React.createElement("div", {
				className: "dt_cmdResize" + (isDragging ? " dt_dragging" : ""),
				role: "separator",
				"aria-orientation": "vertical",
				"aria-valuenow": width,
				title: "Drag to resize command panel",
				onPointerDown: (e) => {
					if (e.button !== 0) return;
					e.preventDefault();
					e.stopPropagation();
					dragging.current = true;
					setIsDragging(true);
					document.body.classList.add("dt_cmdResizing");
				},
			});
		}

		function CommandPanel({ groupId, onGroup, onInsert, onClose, bodyRef, width, onWidth }) {
			const group = COMMAND_GROUPS.find((g) => g.id === groupId) || COMMAND_GROUPS[0];
			return React.createElement("aside", {
				className: "dt_cmdSidebar",
				style: { "--dt-cmd-sidebar-width": `${width}px` },
			},
				React.createElement(CommandSidebarResize, { bodyRef, width, onWidth }),
				React.createElement("div", { className: "dt_cmdHead" },
					React.createElement("span", { className: "dt_cmdTitle" }, "Commands"),
					React.createElement("button", {
						type: "button",
						className: "dt_cmdClose",
						title: "Hide command list",
						"aria-label": "Hide command list",
						onClick: onClose,
					}, "×"),
				),
				React.createElement("div", { className: "dt_cmdPanel" },
					React.createElement("div", { className: "dt_cmdCats", role: "tablist", "aria-label": "Command categories" },
						COMMAND_GROUPS.map((g) => React.createElement("button", {
							key: g.id,
							type: "button",
							role: "tab",
							"aria-selected": g.id === group.id,
							className: "dt_cmdCat" + (g.id === group.id ? " dt_cmdCatActive" : ""),
							onClick: () => onGroup(g.id),
						}, g.label)),
					),
					React.createElement("div", { className: "dt_cmdHint" },
						"Click row or ▶ inserts at shell prompt — press Enter to run",
					),
					React.createElement("div", { className: "dt_cmdList" },
						group.commands.map((item) => React.createElement("div", {
							key: item.label + item.cmd,
							className: "dt_cmdRow",
							role: "button",
							tabIndex: 0,
							title: cmdTooltip(item),
							onClick: () => onInsert(item.cmd),
							onKeyDown: (ev) => {
								if (ev.key === "Enter" || ev.key === " ") {
									ev.preventDefault();
									onInsert(item.cmd);
								}
							},
						},
							React.createElement("div", { className: "dt_cmdRowMain" },
								React.createElement("span", { className: "dt_cmdLabel" }, item.label),
								React.createElement("span", { className: "dt_cmdText" }, item.cmd),
							),
							React.createElement("button", {
								type: "button",
								className: "dt_cmdRun",
								title: cmdTooltip(item),
								"aria-label": `Insert ${item.label} into terminal`,
								onClick: (ev) => {
									ev.stopPropagation();
									onInsert(item.cmd);
								},
							}, "▶"),
						)),
					),
				),
			);
		}

		function TerminalView({ sessionId, connection }) {
			const initial = React.useMemo(
				() => {
					const s = resolveTerminalScope(sessionId);
					const layout = loadWorkspaceLayout(s.key);
					return { scope: s, panes: layout.panes, activeKey: layout.activeKey };
				},
				[],
			);
			const [scope, setScope] = React.useState(initial.scope);
			const [panes, setPanes] = React.useState(initial.panes);
			const [activeKey, setActiveKey] = React.useState(initial.activeKey);
			const [statusByKey, setStatusByKey] = React.useState({});
			const [error, setError] = React.useState("");
			const [showCommands, setShowCommands] = React.useState(false);
			const [cmdGroup, setCmdGroup] = React.useState("linux");
			const [cmdWidth, setCmdWidth] = React.useState(loadCmdSidebarWidth);
			const bodyRef = React.useRef(null);
			const mainRef = React.useRef(null);
			const injectorsRef = React.useRef({});
			const paneInjectorHandlers = React.useRef(new Map());
			const panesRef = React.useRef(panes);
			const activeKeyRef = React.useRef(activeKey);
			panesRef.current = panes;
			activeKeyRef.current = activeKey;

			React.useEffect(() => {
				const sync = () => {
					const next = resolveTerminalScope(sessionId);
					setScope((prev) => {
						if (prev.key === next.key) {
							return prev.sessionId === next.sessionId && prev.wsCwd === next.wsCwd
								? prev
								: { ...prev, sessionId: next.sessionId, wsCwd: next.wsCwd };
						}
						saveWorkspaceLayout(prev.key, panesRef.current, activeKeyRef.current);
						return next;
					});
				};
				const onWs = () => {
					sync();
					// Session cwd may land after the pointer; nudge active pane to reconnect SSH.
					requestAnimationFrame(() => {
						window.dispatchEvent(new Event(TERMINAL_REFIT_EVENT));
					});
				};
				sync();
				window.addEventListener("dsh-current-workspace-changed", onWs);
				return () => window.removeEventListener("dsh-current-workspace-changed", onWs);
			}, [sessionId]);

			React.useEffect(() => {
				const layout = loadWorkspaceLayout(scope.key);
				setPanes(layout.panes);
				setActiveKey(layout.activeKey);
				setStatusByKey({});
				setError("");
			}, [scope.key]);

			React.useEffect(() => {
				saveWorkspaceLayout(scope.key, panes, activeKey);
			}, [scope.key, panes, activeKey]);

			const getPaneInjector = React.useCallback((key) => {
				let handler = paneInjectorHandlers.current.get(key);
				if (!handler) {
					handler = (inj) => {
						if (inj) injectorsRef.current[key] = inj;
						else delete injectorsRef.current[key];
					};
					paneInjectorHandlers.current.set(key, handler);
				}
				return handler;
			}, []);

			React.useEffect(() => { ensureStyles(); }, []);

			const layoutKey = `${showCommands ? 1 : 0}:${cmdWidth}`;

			React.useEffect(() => {
				const el = mainRef.current;
				if (!el || typeof ResizeObserver === "undefined") return undefined;
				const fire = () => {
					requestAnimationFrame(() => window.dispatchEvent(new Event("resize")));
				};
				const ro = new ResizeObserver(fire);
				ro.observe(el);
				return () => ro.disconnect();
			}, []);

			React.useEffect(() => {
				let raf2 = 0;
				const raf1 = requestAnimationFrame(() => {
					raf2 = requestAnimationFrame(() => {
						window.dispatchEvent(new Event("resize"));
					});
				});
				return () => {
					cancelAnimationFrame(raf1);
					if (raf2) cancelAnimationFrame(raf2);
				};
			}, [showCommands, cmdWidth]);

			const injectCommand = React.useCallback((cmd) => {
				const inj = injectorsRef.current[activeKey];
				if (!inj?.write?.(cmd, false)) {
					setError("Terminal not ready — wait for the shell prompt or click Restart");
					return;
				}
				setError("");
				inj.focus?.();
			}, [activeKey]);

			const setPaneStatus = React.useCallback((key, value) => {
				setStatusByKey((prev) => {
					const cur = prev[key] || {};
					const next = typeof value === "function" ? value(cur) : value;
					if (next?.phase === "error" && next.meta) setError(next.meta);
					else if (next?.phase === "ready") setError("");
					return { ...prev, [key]: next };
				});
			}, []);

			const addPane = () => {
				const key = newPaneKey();
				setPanes((prev) => [...prev, { key, restart: 0 }]);
				setActiveKey(key);
			};

			const closePane = (key) => {
				const sk = termStorageKey(sessionId, key, scope.wsCwd);
				const tid = loadStoredTermId(sk);
				if (tid && connection) callRpc(connection, "close", { termId: tid }).catch(() => {});
				saveStoredTermId(sk, "");
				paneInjectorHandlers.current.delete(key);
				setPanes((prev) => {
					if (prev.length <= 1) return prev;
					const idx = prev.findIndex((p) => p.key === key);
					const next = prev.filter((p) => p.key !== key);
					if (activeKey === key) {
						const fallback = next[Math.max(0, idx - 1)] || next[0];
						setActiveKey(fallback.key);
					}
					return next;
				});
				setStatusByKey((m) => {
					const copy = { ...m };
					delete copy[key];
					return copy;
				});
			};

			const restartActive = () => {
				const sk = termStorageKey(sessionId, activeKey, scope.wsCwd);
				const tid = loadStoredTermId(sk);
				if (tid && connection) callRpc(connection, "close", { termId: tid }).catch(() => {});
				saveStoredTermId(sk, "");
				setPanes((prev) => prev.map((p) => (
					p.key === activeKey ? { ...p, restart: (p.restart || 0) + 1 } : p
				)));
			};

			if (!connection) {
				return React.createElement("div", { className: "dt_empty" }, "Terminal: connection unavailable");
			}
			if (!sessionId && !scope.wsCwd) {
				return React.createElement("div", { className: "dt_empty" },
					"Open or start a session, or select a workspace in the sidebar, so Terminal can use its workspace cwd.");
			}

			const activeStatus = statusByKey[activeKey] || {};

			return React.createElement("div", {
				className: "dt_root" + (showCommands ? " dt_cmdsOpen" : ""),
				style: showCommands ? { "--dt-cmd-sidebar-width": `${cmdWidth}px` } : undefined,
			},
				React.createElement("div", { className: "dt_tabbar", role: "tablist" },
					React.createElement("div", { className: "dt_tabs" },
						panes.map((p, i) => {
							const st = statusByKey[p.key] || {};
							const label = st.shell
								? (panes.length > 1 ? `${st.shell} ${i + 1}` : st.shell)
								: `Terminal ${i + 1}`;
							return React.createElement("button", {
								key: p.key,
								type: "button",
								role: "tab",
								"aria-selected": p.key === activeKey,
								className: "dt_tab" + (p.key === activeKey ? " dt_tabActive" : ""),
								title: st.meta || label,
								onClick: () => setActiveKey(p.key),
								onMouseDown: (e) => {
									if (e.button === 1) {
										e.preventDefault();
										closePane(p.key);
									}
								},
							},
								React.createElement("span", { className: "dt_tabLabel" }, label),
								panes.length > 1 && React.createElement("span", {
									className: "dt_tabClose",
									role: "button",
									title: "Close",
									onClick: (e) => {
										e.stopPropagation();
										closePane(p.key);
									},
								}, "×"),
							);
						}),
						React.createElement("button", {
							type: "button",
							className: "dt_tabAdd",
							title: "New terminal",
							"aria-label": "New terminal",
							onClick: addPane,
						}, "+"),
					),
					React.createElement("div", { className: "dt_actions" },
						React.createElement("span", { className: "dt_meta" }, activeStatus.meta || ""),
						React.createElement("button", {
							type: "button",
							className: "dt_btn" + (showCommands ? " dt_btnActive" : ""),
							title: showCommands ? "Hide command reference" : "Show command reference",
							onClick: () => setShowCommands((v) => !v),
						}, "Commands"),
						React.createElement("button", {
							type: "button",
							className: "dt_btn",
							onClick: restartActive,
						}, "Restart"),
					),
				),
				error && React.createElement("div", { className: "dt_err" }, error),
				React.createElement("div", { className: "dt_body", ref: bodyRef },
					React.createElement("div", { className: "dt_main", ref: mainRef },
						React.createElement("div", { className: "dt_stack" },
							panes.map((p) => React.createElement(TerminalPane, {
								key: p.key,
								sessionId,
								connection,
								workspaceCwd: scope.wsCwd,
								keepServerOnUnmount: true,
								active: p.key === activeKey,
								restartToken: p.restart || 0,
								layoutKey,
								paneKey: p.key,
								onStatus: (value) => setPaneStatus(p.key, value),
								onInjector: getPaneInjector(p.key),
							})),
						),
					),
					showCommands && React.createElement(CommandPanel, {
						groupId: cmdGroup,
						onGroup: setCmdGroup,
						onInsert: injectCommand,
						onClose: () => setShowCommands(false),
						bodyRef,
						width: cmdWidth,
						onWidth: setCmdWidth,
					}),
				),
			);
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			ensureStyles();

			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "terminal",
				order: 8,
				label: () => "Terminal",
				inject: (sessionId) => ({ sessionId, connection }),
			}, TerminalView)), `${PLUGIN}: tab`);

			ctx.effect(() => {
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
				return window.__dshHeroToolRegistry.register("terminal", (opts) =>
					React.createElement(TerminalView, {
						connection,
						sessionId: opts?.sessionId
							|| (() => {
								try {
									const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
									return parsed?.sessionId || null;
								} catch {
									return null;
								}
							})(),
					}));
			}, `${PLUGIN}: hero`);

			ctx.effect(() => {
				const scheduleRefit = () => {
					requestAnimationFrame(() => {
						requestAnimationFrame(() => {
							window.dispatchEvent(new Event(TERMINAL_REFIT_EVENT));
						});
					});
				};
				const onTabClick = (e) => {
					const btn = e.target?.closest?.('[class*="_tabs"] [role="tab"]');
					if (!btn) return;
					const label = (
						btn.getAttribute("data-dsh-tab-label")
						|| btn.getAttribute("aria-label")
						|| btn.textContent
						|| ""
					).replace(/\s+/g, " ").trim();
					if (label === "Terminal") scheduleRefit();
				};
				document.addEventListener("click", onTabClick, true);
				return () => document.removeEventListener("click", onTabClick, true);
			}, `${PLUGIN}: tab refit`);
		}

		return { apply, inject };
	},
});

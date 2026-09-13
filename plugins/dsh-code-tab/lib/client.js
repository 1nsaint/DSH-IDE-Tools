// Center "Code" conversation tab: view + edit + download; intercepts chat / file-panel opens.
window.__ModuleLoader__.load({
	id: "dsh-code-tab",
	factory: (require) => {
		const React = require("react");

		const PLUGIN = "dsh-code-tab";
		const OPEN_EVENT = "dsh-open-code-file";

		/** Survives CodeView unmount while another conversation.view tab is active. */
		const pending = { path: null, listeners: new Set() };

		function setPendingPath(path) {
			if (typeof path !== "string" || !path) return;
			pending.path = path;
			pending.listeners.forEach((fn) => fn(path));
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
			const full = await res.json();
			if (full.rpcId !== rpcId) throw new Error("files transport failure: rpcId mismatch");
			const result = full.result;
			if (!result || result.ok !== true) {
				const err = new Error(result && result.error && result.error.message || "remote " + method + " failed");
				err.kind = result && result.error && result.error.code;
				throw err;
			}
			return result.value;
		}

		function isMissingRead(res) {
			if (!res || typeof res !== "object") return true;
			if (res.ok === false) {
				const kind = String(res.kind || "");
				return kind === "missing" || kind === "not-file" || /not found|missing/i.test(String(res.message || ""));
			}
			return false;
		}

		function readFailureMessage(res, path) {
			if (!res || typeof res !== "object") return `Could not read ${path}`;
			if (res.ok === false) return res.message || res.kind || `Could not read ${path}`;
			if (typeof res.text !== "string") return `Could not read ${path}`;
			return null;
		}

		function parentDir(p) {
			const s = String(p || "");
			const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
			if (i <= 0) return "/";
			return s.slice(0, i) || "/";
		}

		function resolveSessionId(sessionId) {
			if (typeof sessionId === "string" && sessionId) return sessionId;
			try {
				const parsed = JSON.parse(localStorage.getItem("dsh.sessions.current") || "null");
				return parsed?.sessionId || null;
			} catch {
				return null;
			}
		}

		/** When a produced/chat path no longer exists (moved/renamed), find unique basename under workspace. */
		async function recoverRelocatedPath(sessionId, missingPath) {
			const name = basenameOf(missingPath);
			if (!name || name === missingPath) return null;
			let root = null;
			try {
				const rootRes = await callRemote("file.root", { sessionId });
				if (typeof rootRes?.root === "string" && rootRes.root) root = rootRes.root;
			} catch { /* ignore */ }
			if (!root) {
				// /workspace/Test env/index.html → try /workspace/Test env, then /workspace
				const dir = parentDir(missingPath);
				root = dir && dir !== "/" ? dir : "/workspace";
			}
			const roots = [];
			const push = (r) => {
				if (typeof r === "string" && r && !roots.includes(r)) roots.push(r);
			};
			push(root);
			push(parentDir(root));
			if (String(root).startsWith("/workspace")) push("/workspace");

			for (const searchRoot of roots) {
				let search;
				try {
					search = await callRemote("file.search", {
						root: searchRoot,
						query: name,
						family: `code-tab-recover:${searchRoot}`,
					});
				} catch {
					continue;
				}
				if (!search || search.ok === false) continue;
				const hits = (search.results || []).filter((r) =>
					r && (r.name === name || basenameOf(r.path) === name) && r.path !== missingPath,
				);
				if (hits.length === 1) return hits[0].path;
				if (hits.length > 1) {
					const underRoot = hits.filter((h) => String(h.path).startsWith(String(root).replace(/\/$/, "") + "/") || h.path === root);
					if (underRoot.length === 1) return underRoot[0].path;
					// Prefer shortest path distance from the missing file's directory
					const dir = parentDir(missingPath);
					const scored = hits
						.map((h) => ({
							path: h.path,
							score: String(h.path).startsWith(dir + "/") ? 0 : String(h.path).startsWith(parentDir(dir) + "/") ? 1 : 2,
						}))
						.sort((a, b) => a.score - b.score || a.path.length - b.path.length);
					if (scored[0] && scored.filter((s) => s.score === scored[0].score).length === 1) {
						return scored[0].path;
					}
				}
			}
			return null;
		}

		async function readFileForCodeTab(sessionId, path) {
			const res = await callRemote("file.read", { sessionId, path });
			const fail = readFailureMessage(res, path);
			if (!fail) return { res, path, relocatedFrom: null };
			if (isMissingRead(res)) {
				const found = await recoverRelocatedPath(sessionId, path);
				if (found && found !== path) {
					const again = await callRemote("file.read", { sessionId, path: found });
					const againFail = readFailureMessage(again, found);
					if (!againFail) return { res: again, path: found, relocatedFrom: path };
				}
			}
			const err = new Error(fail);
			err.kind = res?.kind || "read";
			throw err;
		}

		const looksLikePath = (s) => /^[A-Za-z]:[\\/]/.test(s) || /^\\\\/.test(s) || /^\/[^/]/.test(s);

		const basenameOf = (p) => {
			const s = String(p);
			const i = Math.max(s.lastIndexOf("/"), s.lastIndexOf("\\"));
			return i === -1 ? s : s.slice(i + 1);
		};

		const extOf = (p) => {
			const base = basenameOf(p);
			const i = base.lastIndexOf(".");
			return i === -1 ? "" : base.slice(i + 1).toLowerCase();
		};

		/* Lightweight syntax highlight (same idea as FileLens — not a linter). */
		const def = (o) => Object.assign({
			str: true, line: [], block: null, kw: [], types: false, fnCall: false,
			backtick: false, hex: false, xml: false, ident: /[A-Za-z_$]/,
		}, o);
		const LANGS = {
			text: def({ str: false, kw: null }),
			json: def({ kw: ["true", "false", "null"] }),
			js: def({ backtick: true, line: ["//"], block: ["/*", "*/"], types: true, fnCall: true, kw: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "class", "extends", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "this", "super", "null", "undefined", "true", "false", "in", "of", "delete", "void", "yield", "static", "get", "set"] }),
			ts: def({ backtick: true, line: ["//"], block: ["/*", "*/"], types: true, fnCall: true, kw: ["const", "let", "var", "function", "return", "if", "else", "for", "while", "do", "switch", "case", "break", "continue", "new", "class", "extends", "implements", "import", "export", "from", "default", "async", "await", "try", "catch", "finally", "throw", "typeof", "instanceof", "this", "super", "null", "undefined", "true", "false", "in", "of", "delete", "void", "yield", "static", "interface", "type", "enum", "namespace", "declare", "readonly", "public", "private", "protected", "abstract", "as", "keyof", "infer", "satisfies"] }),
			py: def({ line: ["#"], types: true, fnCall: true, kw: ["def", "return", "if", "elif", "else", "for", "while", "in", "not", "and", "or", "import", "from", "as", "class", "try", "except", "finally", "raise", "with", "lambda", "None", "True", "False", "pass", "break", "continue", "yield", "global", "nonlocal", "async", "await", "match", "case"] }),
			go: def({ line: ["//"], block: ["/*", "*/"], types: true, fnCall: true, kw: ["package", "import", "func", "var", "const", "type", "struct", "interface", "return", "if", "else", "for", "range", "switch", "case", "break", "continue", "defer", "go", "chan", "map", "select", "true", "false", "nil"] }),
			sql: def({ line: ["--"], types: true, kw: ["select", "from", "where", "insert", "into", "values", "update", "set", "delete", "create", "table", "join", "left", "right", "inner", "outer", "on", "group", "by", "order", "having", "limit", "offset", "as", "and", "or", "not", "null", "primary", "key", "distinct", "asc", "desc", "drop", "alter"] }),
			sh: def({ line: ["#"], kw: ["if", "then", "else", "elif", "fi", "for", "do", "done", "while", "case", "esac", "function", "echo", "exit", "return", "export", "local", "true", "false"] }),
			xml: def({ block: ["<!--", "-->"], xml: true }),
			css: def({
				block: ["/*", "*/"], hex: true, css: true, fnCall: true,
				ident: /[A-Za-z_\-@.]/,
				kw: ["important", "from", "to", "and", "or", "not", "only"],
			}),
			json2: def({ kw: ["true", "false", "null"] }),
		};
		LANGS.json2 = LANGS.json;
		Object.keys(LANGS).forEach((k) => {
			if (LANGS[k].kw) LANGS[k].kwSet = new Set(LANGS[k].kw);
		});
		const EXT_TO_LANG = {
			js: "js", mjs: "js", cjs: "js", jsx: "js",
			ts: "ts", tsx: "ts",
			py: "py", go: "go",
			sql: "sql", sh: "sh", bash: "sh", zsh: "sh",
			html: "xml", htm: "xml", xml: "xml", svg: "xml", vue: "xml",
			css: "css", scss: "css", less: "css",
			json: "json",
		};
		const langOfPath = (p) => EXT_TO_LANG[extOf(p)] || "text";

		function highlight(text, lang) {
			const d = LANGS[lang] || LANGS.text;
			const out = [];
			let buf = "";
			const flush = () => { if (buf) { out.push(buf); buf = ""; } };
			const emit = (cls, s) => {
				flush();
				out.push(React.createElement("span", { key: out.length, className: "dsh-hl-" + cls }, s));
			};
			let i = 0;
			while (i < text.length) {
				const ch = text[i];
				if (d.str && (ch === '"' || ch === "'" || (ch === "`" && d.backtick))) {
					const q = ch;
					let j = i + 1;
					let s = q;
					while (j < text.length) {
						const c = text[j];
						if (c === "\\") {
							s += c;
							if (j + 1 < text.length) { s += text[j + 1]; j += 2; }
							else j++;
							continue;
						}
						s += c;
						j++;
						if (c === q) break;
						if (c === "\n" && q !== "`") break;
					}
					emit("str", s);
					i = j;
					continue;
				}
				if (d.line) {
					const hit = d.line.find((c) => text.startsWith(c, i));
					if (hit) {
						const nl = text.indexOf("\n", i);
						const end = nl === -1 ? text.length : nl;
						emit("com", text.slice(i, end));
						i = end;
						continue;
					}
				}
				if (d.block) {
					const [open, close] = d.block;
					if (text.startsWith(open, i)) {
						const ci = text.indexOf(close, i + open.length);
						const end = ci === -1 ? text.length : ci + close.length;
						emit("com", text.slice(i, end));
						i = end;
						continue;
					}
				}
				if (d.xml && ch === "<") {
					const m = /^<\/?[A-Za-z][A-Za-z0-9:-]*/.exec(text.slice(i));
					if (m) { emit("tag", m[0]); i += m[0].length; continue; }
				}
				if (d.xml && ch === ">") { emit("tag", ">"); i++; continue; }
				if (d.xml && /[A-Za-z-]/.test(ch)) {
					const m = /^[A-Za-z-]+(?=\s*=)/.exec(text.slice(i));
					if (m) { emit("attr", m[0]); i += m[0].length; continue; }
				}
				if (d.hex && ch === "#") {
					const hex = /^#[0-9a-fA-F]{3,8}\b/.exec(text.slice(i));
					if (hex) { emit("num", hex[0]); i += hex[0].length; continue; }
					if (d.css) {
						const id = /^#[A-Za-z_][\w-]*/.exec(text.slice(i));
						if (id) { emit("type", id[0]); i += id[0].length; continue; }
					}
				}
				if (d.css && ch === ".") {
					const sel = /^\.[A-Za-z_][\w-]*/.exec(text.slice(i));
					if (sel) { emit("type", sel[0]); i += sel[0].length; continue; }
				}
				if (d.css && ch === "@") {
					const at = /^@[A-Za-z-][\w-]*/.exec(text.slice(i));
					if (at) { emit("kw", at[0]); i += at[0].length; continue; }
				}
				if (d.css && ch === "!") {
					const imp = /^!important\b/.exec(text.slice(i));
					if (imp) { emit("kw", imp[0]); i += imp[0].length; continue; }
				}
				if (/[0-9]/.test(ch)) {
					const m = /^[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?/.exec(text.slice(i));
					if (!m) { buf += ch; i++; continue; }
					let tok = m[0];
					i += tok.length;
					if (d.css) {
						const unit = /^(?:px|em|rem|vh|vw|vmin|vmax|%|s|ms|deg|rad|fr|ch|ex|cm|mm|in|pt|pc)\b/i.exec(text.slice(i));
						if (unit) { tok += unit[0]; i += unit[0].length; }
					}
					emit("num", tok);
					continue;
				}
				if (d.ident.test(ch)) {
					const m = d.css
						? /^-{0,2}[A-Za-z_][\w-]*/.exec(text.slice(i))
						: /^[A-Za-z_$][\w$]*/.exec(text.slice(i));
					if (!m) { buf += ch; i++; continue; }
					const word = m[0];
					const rest = text.slice(i + word.length);
					if (d.kwSet && d.kwSet.has(word)) emit("kw", word);
					else if (d.css && /^\s*:/.test(rest) && !/^\s::/.test(rest)) emit("attr", word);
					else if (d.types && /^[A-Z]/.test(word)) emit("type", word);
					else if (d.fnCall && /^\s*\(/.test(rest)) emit("fn", word);
					else if (d.css && /^(?:html|body|div|span|a|p|ul|ol|li|h[1-6]|img|input|button|table|tr|td|th|form|nav|header|footer|section|main|aside)\b/i.test(word)) emit("tag", word);
					else buf += word;
					i += word.length;
					continue;
				}
				buf += ch;
				i++;
			}
			flush();
			return out;
		}

		function switchToCodeTab() {
			const tabs = document.querySelectorAll('[role="tab"]');
			for (const tab of tabs) {
				if (tab.textContent?.trim() === "Code") {
					tab.click();
					return;
				}
			}
		}

		function openFileInWorkbench(path) {
			setPendingPath(path);
			window.dispatchEvent(new CustomEvent(OPEN_EVENT, { detail: { path } }));
			switchToCodeTab();
		}

		const css = `
.dsh-code-tab-root{display:flex;flex-direction:column;height:100%;min-height:0;background:var(--dsw-alias-bg-base)}
.dsh-code-tab-header{display:flex;align-items:center;gap:8px;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-shrink:0;flex-wrap:wrap}
.dsh-code-tab-path{flex:1;min-width:0;font-size:13px;color:var(--dsw-alias-label-secondary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-family:var(--ds-font-family-code)}
.dsh-code-tab-btn{height:32px;padding:0 12px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:13px;cursor:pointer;flex-shrink:0}
.dsh-code-tab-btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dsh-code-tab-btn:disabled{opacity:.5;cursor:not-allowed}
.dsh-code-tab-btnPrimary{background:transparent;color:var(--dsw-alias-state-business-primary);border:2px solid var(--dsw-alias-state-business-primary)}
.dsh-code-tab-btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent);filter:none}
.dsh-code-tab-btnActive{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.dsh-code-tab-find{display:flex;align-items:center;gap:6px;flex:1 1 220px;min-width:180px;max-width:420px}
.dsh-code-tab-findInput{flex:1;min-width:0;height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:13px;box-sizing:border-box}
.dsh-code-tab-findInput:focus{outline:none;border-color:var(--dsw-alias-state-business-primary)}
.dsh-code-tab-findCount{font-size:12px;color:var(--dsw-alias-label-tertiary);flex-shrink:0;min-width:3.5em;text-align:center;font-variant-numeric:tabular-nums}
.dsh-code-tab-btnIcon{width:32px;padding:0;display:inline-flex;align-items:center;justify-content:center}
.dsh-code-tab-status{font-size:12px;color:var(--dsw-alias-label-tertiary);flex-shrink:0}
.dsh-code-tab-statusErr{color:var(--dsw-alias-state-error-primary)}
.dsh-code-tab-statusOk{color:var(--dsw-alias-state-success-primary)}
.dsh-code-tab-body{flex:1;min-height:0;overflow:auto;padding:0;display:flex;flex-direction:column}
.dsh-code-tab-pre{margin:0;padding:16px;font-family:var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace);font-size:13px;line-height:1.6;font-variant-ligatures:none;font-feature-settings:normal;-webkit-text-size-adjust:100%;color:var(--dsw-alias-label-primary);white-space:pre;tab-size:2;-moz-tab-size:2;letter-spacing:0;word-break:keep-all;word-wrap:normal}
.dsh-code-tab-pre.dsh-hl{color:var(--dsw-alias-label-primary)}
.dsh-code-tab-mark{background:color-mix(in srgb,#e5c07b 55%,transparent);color:inherit;border-radius:2px;padding:0}
.dsh-code-tab-markActive{background:color-mix(in srgb,#e5c07b 90%,#000 10%);outline:1px solid #d19a66}
.dsh-hl-kw{color:#c678dd}
.dsh-hl-str{color:#98c379}
.dsh-hl-num{color:#d19a66}
.dsh-hl-com{color:var(--dsw-alias-label-secondary);font-style:italic}
.dsh-hl-fn{color:#61afef}
.dsh-hl-type{color:#56b6c2}
.dsh-hl-tag{color:#e06c75}
.dsh-hl-attr{color:#d19a66}
.dsh-code-tab-editorWrap{position:relative;flex:1;min-height:0;width:100%;box-sizing:border-box;overflow:hidden}
.dsh-code-tab-editorPre{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;overflow:hidden;pointer-events:none;background:var(--dsw-alias-bg-base)}
.dsh-code-tab-editor{position:absolute;inset:0;width:100%;height:100%;box-sizing:border-box;margin:0;padding:16px;border:none;resize:none;outline:none;background:transparent;color:transparent;caret-color:var(--dsw-alias-label-primary,#fff);font-family:var(--ds-font-family-code, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace);font-size:13px;line-height:1.6;font-variant-ligatures:none;font-feature-settings:normal;-webkit-text-size-adjust:100%;tab-size:2;-moz-tab-size:2;letter-spacing:0;white-space:pre;word-break:keep-all;word-wrap:normal;overflow:auto}
.dsh-code-tab-editor::selection{background:color-mix(in srgb,var(--dsw-alias-state-business-primary,#5b9dff) 35%,transparent);color:transparent}
.dsh-code-tab-empty,.dsh-code-tab-error,.dsh-code-tab-loading{color:var(--dsw-alias-label-tertiary);font-size:14px;line-height:1.5;padding:16px}
.dsh-code-tab-error{color:var(--dsw-alias-state-error-primary)}

/* Nudge: switch Workspaces → Files when Code tab has nothing loaded (sessions mode only) */
html[data-dsh-code-empty="1"] .qDHVXG_sectionHeader,
html[data-dsh-code-empty="1"] .qDHVXG_sectionHeader .qDHVXG_headerActions{
  overflow:visible !important;
}
html[data-dsh-code-empty="1"] .dsh-sf-headerToggle:not([aria-pressed="true"]){
  position:relative;
  z-index:3;
  overflow:visible;
}
html[data-dsh-code-empty="1"] .dsh-sf-headerToggle:not([aria-pressed="true"])::after{
  content:"";
  position:absolute;
  left:50%;
  top:50%;
  width:34px;
  height:34px;
  margin:-17px 0 0 -17px;
  box-sizing:border-box;
  border-radius:50%;
  border:2px solid var(--dsw-alias-state-business-primary);
  pointer-events:none;
  animation:dsh-code-sf-pulse 2.2s ease-in-out infinite;
}
@keyframes dsh-code-sf-pulse{
  0%,100%{opacity:.22;transform:scale(.88)}
  50%{opacity:1;transform:scale(1)}
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let tag = document.getElementById("dsh-code-tab-styles");
			if (!tag) {
				tag = document.createElement("style");
				tag.id = "dsh-code-tab-styles";
				document.head.appendChild(tag);
			}
			tag.textContent = css;
		}

		function setCodeEmptyHint(on) {
			try {
				if (on) document.documentElement.dataset.dshCodeEmpty = "1";
				else delete document.documentElement.dataset.dshCodeEmpty;
			} catch { /* ignore */ }
		}

		function escapeRegExp(s) {
			return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
		}

		function countSearchHits(text, query) {
			const q = String(query || "");
			if (!q || typeof text !== "string" || !text) return 0;
			const re = new RegExp(escapeRegExp(q), "gi");
			const m = text.match(re);
			return m ? m.length : 0;
		}

		/** Wrap case-insensitive query hits in <mark> while preserving highlight spans. */
		function wrapSearchHits(node, query, state) {
			const q = String(query || "");
			if (!q) return node;
			if (typeof node === "string") {
				const re = new RegExp(escapeRegExp(q), "gi");
				const parts = [];
				let last = 0;
				let m;
				while ((m = re.exec(node)) !== null) {
					if (m.index > last) parts.push(node.slice(last, m.index));
					const idx = state.index++;
					parts.push(React.createElement("mark", {
						key: `dsh-mark-${idx}`,
						className: "dsh-code-tab-mark" + (idx === state.active ? " dsh-code-tab-markActive" : ""),
						"data-dsh-mark": String(idx),
					}, m[0]));
					last = m.index + m[0].length;
					if (m[0].length === 0) re.lastIndex += 1;
				}
				if (!parts.length) return node;
				if (last < node.length) parts.push(node.slice(last));
				return parts.length === 1 ? parts[0] : parts;
			}
			if (Array.isArray(node)) {
				return node.map((child) => wrapSearchHits(child, query, state));
			}
			if (React.isValidElement(node) && node.props && node.props.children != null) {
				return React.cloneElement(node, {
					...node.props,
					children: wrapSearchHits(node.props.children, query, state),
				});
			}
			return node;
		}

		function CodeView({ sessionId }) {
			const [path, setPath] = React.useState(() => pending.path);
			const [content, setContent] = React.useState("");
			const [draft, setDraft] = React.useState("");
			const [version, setVersion] = React.useState(null);
			const [root, setRoot] = React.useState(null);
			const [editing, setEditing] = React.useState(false);
			const [loading, setLoading] = React.useState(false);
			const [saving, setSaving] = React.useState(false);
			const [error, setError] = React.useState(null);
			const [status, setStatus] = React.useState("");
			const [truncated, setTruncated] = React.useState(false);
			const [findOpen, setFindOpen] = React.useState(false);
			const [findQuery, setFindQuery] = React.useState("");
			const [findIndex, setFindIndex] = React.useState(0);

			const dirty = editing && draft !== content;
			const findInputRef = React.useRef(null);
			const viewPreRef = React.useRef(null);
			const bodyRef = React.useRef(null);

			React.useEffect(() => {
				ensureStyles();
				const onPending = (next) => setPath(next);
				pending.listeners.add(onPending);
				if (pending.path) setPath(pending.path);
				const onOpen = (event) => {
					const next = event?.detail?.path;
					if (typeof next === "string") {
						setPendingPath(next);
						setPath(next);
						setEditing(false);
					}
				};
				window.addEventListener(OPEN_EVENT, onOpen);
				return () => {
					pending.listeners.delete(onPending);
					window.removeEventListener(OPEN_EVENT, onOpen);
					setCodeEmptyHint(false);
				};
			}, []);

			React.useEffect(() => {
				setCodeEmptyHint(!path && !loading);
				return () => setCodeEmptyHint(false);
			}, [path, loading]);

			React.useEffect(() => {
				const sid = resolveSessionId(sessionId);
				if (!path || !sid) {
					if (path && !sid) setError("No active session — open a chat session, then try again.");
					return;
				}
				let alive = true;
				setLoading(true);
				setError(null);
				setContent("");
				setDraft("");
				setVersion(null);
				setTruncated(false);
				setStatus("");
				setEditing(false);
				setFindOpen(false);
				setFindQuery("");
				setFindIndex(0);
				Promise.all([
					readFileForCodeTab(sid, path),
					callRemote("file.root", { sessionId: sid }).catch(() => null),
				]).then(([loaded, rootRes]) => {
					if (!alive) return;
					const { res, path: resolvedPath, relocatedFrom } = loaded;
					if (resolvedPath && resolvedPath !== path) {
						setPendingPath(resolvedPath);
						setPath(resolvedPath);
						setStatus(`Moved — opened ${basenameOf(resolvedPath)}`);
						return;
					}
					const text = typeof res?.text === "string" ? res.text : "";
					setContent(text);
					setDraft(text);
					setVersion(res?.version ?? null);
					setTruncated(res?.truncated === true);
					const r = rootRes?.root;
					if (typeof r === "string" && r) setRoot(r);
					else if (path.startsWith("/")) {
						const parts = path.split("/");
						setRoot(parts.length > 2 ? parts.slice(0, 2).join("/") || "/" : "/");
					}
					if (relocatedFrom) setStatus(`Opened ${basenameOf(path)}`);
				}).catch((err) => {
					if (!alive) return;
					setError(err?.message || String(err));
				}).finally(() => {
					if (alive) setLoading(false);
				});
				return () => {
					alive = false;
				};
			}, [path, sessionId]);

			const onDownload = () => {
				const text = editing ? draft : content;
				if (!path || !text) return;
				const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
				const url = URL.createObjectURL(blob);
				const anchor = document.createElement("a");
				anchor.href = url;
				anchor.download = basenameOf(path);
				anchor.click();
				URL.revokeObjectURL(url);
			};

			const onSave = async () => {
				if (!path || !root || typeof draft !== "string") return;
				setSaving(true);
				setStatus("");
				try {
					const res = await callRemote("file.write", {
						path,
						root,
						text: draft,
						expectedVersion: version || undefined,
					});
					if (res && res.ok === false) {
						throw new Error(res.message || res.kind || "save failed");
					}
					setContent(draft);
					setVersion(res?.version ?? version);
					setEditing(false);
					setStatus("Saved");
				} catch (err) {
					setStatus(err?.message || String(err));
				} finally {
					setSaving(false);
				}
			};

			const onCancelEdit = () => {
				setDraft(content);
				setEditing(false);
				setStatus("");
			};

			const preRef = React.useRef(null);
			const textareaRef = React.useRef(null);

			const lang = path ? langOfPath(path) : "text";
			const textToHighlight = editing ? draft : content;
			const findCount = React.useMemo(
				() => countSearchHits(textToHighlight, findQuery),
				[textToHighlight, findQuery],
			);
			const highlighted = React.useMemo(() => {
				if (!textToHighlight) return null;
				let base = textToHighlight;
				if (lang !== "text") {
					try {
						const hl = highlight(textToHighlight, lang);
						if (editing && typeof textToHighlight === "string" && textToHighlight.endsWith("\n")) {
							base = Array.isArray(hl) ? [...hl, " "] : [hl, " "];
						} else {
							base = hl;
						}
					} catch {
						base = textToHighlight;
					}
				}
				const q = String(findQuery || "").trim();
				if (!q) return base;
				const state = { index: 0, active: Math.max(0, findIndex) };
				return wrapSearchHits(base, q, state);
			}, [textToHighlight, lang, editing, findQuery, findIndex]);

			React.useEffect(() => {
				if (findCount <= 0) {
					if (findIndex !== 0) setFindIndex(0);
					return;
				}
				if (findIndex >= findCount) setFindIndex(0);
			}, [findCount, findIndex]);

			React.useEffect(() => {
				if (!findOpen || !findQuery.trim() || findCount <= 0) return;
				const root = editing ? preRef.current : viewPreRef.current;
				const el = root?.querySelector?.(`[data-dsh-mark="${findIndex}"]`);
				try {
					el?.scrollIntoView?.({ block: "center", inline: "nearest", behavior: "smooth" });
				} catch { /* ignore */ }
			}, [findOpen, findQuery, findIndex, findCount, editing, highlighted]);

			const openFind = React.useCallback(() => {
				setFindOpen(true);
				requestAnimationFrame(() => {
					try {
						findInputRef.current?.focus?.();
						findInputRef.current?.select?.();
					} catch { /* ignore */ }
				});
			}, []);

			const closeFind = React.useCallback(() => {
				setFindOpen(false);
				setFindQuery("");
				setFindIndex(0);
			}, []);

			const goFind = React.useCallback((delta) => {
				if (findCount <= 0) return;
				setFindIndex((i) => (i + delta + findCount) % findCount);
			}, [findCount]);

			React.useEffect(() => {
				const onKey = (e) => {
					const root = bodyRef.current?.closest?.(".dsh-code-tab-root");
					if (!root || !path) return;
					const rect = root.getBoundingClientRect?.();
					if (!rect || rect.width < 2 || rect.height < 2) return;

					if (e.key === "Escape" && findOpen) {
						e.preventDefault();
						closeFind();
						return;
					}
					if ((e.metaKey || e.ctrlKey) && !e.altKey && String(e.key).toLowerCase() === "f") {
						e.preventDefault();
						e.stopPropagation();
						openFind();
					}
					if (findOpen && e.key === "Enter" && document.activeElement === findInputRef.current) {
						e.preventDefault();
						goFind(e.shiftKey ? -1 : 1);
					}
				};
				window.addEventListener("keydown", onKey, true);
				return () => window.removeEventListener("keydown", onKey, true);
			}, [openFind, closeFind, findOpen, path, goFind]);

			const handleEditorScroll = (e) => {
				if (preRef.current) {
					preRef.current.scrollTop = e.target.scrollTop;
					preRef.current.scrollLeft = e.target.scrollLeft;
				}
			};

			React.useEffect(() => {
				if (editing && textareaRef.current && preRef.current) {
					preRef.current.scrollTop = textareaRef.current.scrollTop;
					preRef.current.scrollLeft = textareaRef.current.scrollLeft;
				}
			}, [editing]);

			const handleEditorKeyDown = (e) => {
				if ((e.metaKey || e.ctrlKey) && e.key === "s") {
					e.preventDefault();
					if (dirty && root && !saving) onSave();
					return;
				}
				if (e.key === "Tab" && !e.ctrlKey && !e.metaKey && !e.altKey) {
					e.preventDefault();
					const textarea = e.currentTarget;
					const start = textarea.selectionStart;
					const end = textarea.selectionEnd;
					const val = textarea.value;
					const next = val.substring(0, start) + "  " + val.substring(end);
					setDraft(next);
					requestAnimationFrame(() => {
						if (textarea) {
							textarea.selectionStart = textarea.selectionEnd = start + 2;
						}
					});
				}
			};

			return React.createElement("div", { className: "dsh-code-tab-root", ref: bodyRef },
				React.createElement("div", { className: "dsh-code-tab-header" },
					React.createElement("span", {
						className: "dsh-code-tab-path",
						title: path || "",
					}, path || "Open a file from Workspaces → Files or chat"),
					findOpen && React.createElement("div", { className: "dsh-code-tab-find" },
						React.createElement("input", {
							ref: findInputRef,
							className: "dsh-code-tab-findInput",
							value: findQuery,
							placeholder: "Find in file…",
							spellCheck: false,
							onChange: (e) => {
								setFindQuery(e.target.value);
								setFindIndex(0);
							},
							onKeyDown: (e) => {
								if (e.key === "Escape") {
									e.preventDefault();
									closeFind();
								}
							},
						}),
						React.createElement("span", { className: "dsh-code-tab-findCount" },
							findQuery.trim()
								? (findCount ? `${findIndex + 1}/${findCount}` : "0/0")
								: "",
						),
						React.createElement("button", {
							type: "button",
							className: "dsh-code-tab-btn dsh-code-tab-btnIcon",
							disabled: findCount <= 0,
							title: "Previous match (Shift+Enter)",
							onClick: () => goFind(-1),
						}, "↑"),
						React.createElement("button", {
							type: "button",
							className: "dsh-code-tab-btn dsh-code-tab-btnIcon",
							disabled: findCount <= 0,
							title: "Next match (Enter)",
							onClick: () => goFind(1),
						}, "↓"),
						React.createElement("button", {
							type: "button",
							className: "dsh-code-tab-btn dsh-code-tab-btnIcon",
							title: "Close find",
							onClick: closeFind,
						}, "×"),
					),
					status && React.createElement("span", {
						className: "dsh-code-tab-status " + (status === "Saved" ? "dsh-code-tab-statusOk" : status && status !== "Saved" ? "dsh-code-tab-statusErr" : ""),
					}, status),
					React.createElement("button", {
						type: "button",
						className: "dsh-code-tab-btn" + (findOpen ? " dsh-code-tab-btnActive" : ""),
						disabled: !path || loading || !!error || truncated,
						title: "Find in file (Ctrl+F)",
						onClick: () => (findOpen ? closeFind() : openFind()),
					}, "Find"),
					!editing && React.createElement("button", {
						type: "button",
						className: "dsh-code-tab-btn",
						disabled: !path || loading || !!error || truncated,
						onClick: () => { setEditing(true); setStatus(""); },
					}, "Edit"),
					editing && React.createElement("button", {
						type: "button",
						className: "dsh-code-tab-btn",
						disabled: saving,
						onClick: onCancelEdit,
					}, "Cancel"),
					editing && React.createElement("button", {
						type: "button",
						className: "dsh-code-tab-btn dsh-code-tab-btnPrimary",
						disabled: saving || !dirty || !root,
						onClick: onSave,
					}, saving ? "Saving…" : "Save"),
					/\.html?$/i.test(path || "") && React.createElement("button", {
						type: "button",
						className: "dsh-code-tab-btn dsh-code-tab-btnPrimary",
						disabled: !path || loading || !!error,
						title: "Open with Live Server in the Browser tab (serves linked CSS/JS/images from this folder)",
						onClick: () => {
							const sid = resolveSessionId(sessionId);
							if (!sid || !path) {
								setStatus("No active session");
								return;
							}
							window.dispatchEvent(new CustomEvent("dsh-open-browser-url", {
								detail: { sessionId: sid, path },
							}));
						},
					}, "Live"),
					React.createElement("button", {
						type: "button",
						className: "dsh-code-tab-btn",
						disabled: !path || !(editing ? draft : content) || loading,
						onClick: onDownload,
					}, "Download"),
				),
				React.createElement("div", {
					className: "dsh-code-tab-body",
					style: editing ? { overflow: "hidden" } : undefined,
				},
					loading && React.createElement("div", { className: "dsh-code-tab-loading" }, "Loading…"),
					!loading && error && React.createElement("div", { className: "dsh-code-tab-error" }, error),
					!loading && !error && !path && React.createElement("div", { className: "dsh-code-tab-empty" },
						"Switch Workspaces to Files and pick a file (or open a file link in chat)."),
					!loading && !error && path && truncated && React.createElement("div", { className: "dsh-code-tab-empty" },
						"Preview truncated — file is larger than the Code tab preview limit."),
					!loading && !error && path && !truncated && !editing && React.createElement("pre", {
						ref: viewPreRef,
						className: "dsh-code-tab-pre" + (lang !== "text" ? " dsh-hl" : ""),
					}, highlighted),
					!loading && !error && path && !truncated && editing && React.createElement("div", {
						className: "dsh-code-tab-editorWrap",
					},
						React.createElement("pre", {
							ref: preRef,
							className: "dsh-code-tab-pre dsh-code-tab-editorPre" + (lang !== "text" ? " dsh-hl" : ""),
							"aria-hidden": "true",
						}, highlighted),
						React.createElement("textarea", {
							ref: textareaRef,
							className: "dsh-code-tab-editor",
							value: draft,
							spellCheck: false,
							autoCapitalize: "off",
							autoComplete: "off",
							autoCorrect: "off",
							onScroll: handleEditorScroll,
							onChange: (e) => {
								setDraft(e.target.value);
								if (preRef.current) {
									preRef.current.scrollTop = e.target.scrollTop;
									preRef.current.scrollLeft = e.target.scrollLeft;
								}
							},
							onKeyUp: () => {
								if (preRef.current && textareaRef.current) {
									preRef.current.scrollTop = textareaRef.current.scrollTop;
									preRef.current.scrollLeft = textareaRef.current.scrollLeft;
								}
							},
							onKeyDown: handleEditorKeyDown,
						}),
					),
				),
			);
		}

		const inject = ["slots"];

		function apply(ctx) {
			const slots = ctx.slots;
			if (!slots) return;

			ctx.effect(() => {
				const onOpen = (event) => {
					const next = event?.detail?.path;
					if (typeof next === "string") setPendingPath(next);
				};
				window.addEventListener(OPEN_EVENT, onOpen);
				return () => window.removeEventListener(OPEN_EVENT, onOpen);
			}, `${PLUGIN}: pending path`);

			ctx.effect(() => slots.inject("conversation.view", () => slots.register({
				name: "conversation.view",
				id: "code",
				order: 5,
				label: () => "Code",
				inject: (sessionId) => ({ sessionId }),
			}, CodeView)), `${PLUGIN}: Code tab`);

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
				return window.__dshHeroToolRegistry.register("code", (opts) =>
					React.createElement(CodeView, {
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
			}, `${PLUGIN}: workbench panel`);

			ctx.effect(() => {
				if (typeof document === "undefined" || !document.addEventListener) return;
				const onDocClick = (event) => {
					const target = event?.target;
					const btn = target?.closest?.("code button[title], [data-produced-files-row] button[title]");
					if (!btn) return;
					const title = btn.getAttribute?.("title");
					if (typeof title !== "string" || !looksLikePath(title)) return;
					event.preventDefault();
					event.stopImmediatePropagation();
					openFileInWorkbench(title);
				};
				document.addEventListener("click", onDocClick, true);
				return () => document.removeEventListener("click", onDocClick, true);
			}, `${PLUGIN}: file link intercept`);
		}

		return { apply, inject };
	},
});

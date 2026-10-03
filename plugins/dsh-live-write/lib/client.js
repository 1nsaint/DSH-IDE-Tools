/**
 * dsh-live-write — mid-stream write/edit preview in the chat transcript.
 * Mimics stock expandable Tool call rows (chevron · Tool call · name · path · IN/OUT).
 */
window.__ModuleLoader__.load({
	id: "dsh-live-write",
	factory: (require) => {
		const React = require("react");
		let ReactDOMClient = null;
		try {
			ReactDOMClient = require("react-dom/client");
		} catch {
			ReactDOMClient = null;
		}

		const PLUGIN = "dsh-live-write";
		const HOST_ID = "dsh-live-write-flow";
		const PREVIEW_TAIL_LINES = 80;

		const css = `
#${HOST_ID} {
  display: block;
  width: 100%;
  max-width: 100%;
  margin: 0.35rem 0 0.5rem;
  box-sizing: border-box;
  font-family: inherit;
}
.dlw_wrap {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  width: 100%;
  max-width: 42rem;
}
.dlw_head {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  width: fit-content;
  max-width: 100%;
  margin: 0;
  padding: 0.15rem 0.35rem 0.15rem 0.2rem;
  border: 1px solid color-mix(in srgb, CanvasText 22%, transparent);
  border-radius: 0.35rem;
  background: transparent;
  color: color-mix(in srgb, CanvasText 78%, transparent);
  font: inherit;
  font-size: 0.8125rem;
  line-height: 1.35;
  cursor: pointer;
  text-align: left;
}
.dlw_head:hover {
  border-color: color-mix(in srgb, CanvasText 38%, transparent);
  color: CanvasText;
}
.dlw_chev {
  flex: 0 0 auto;
  width: 0.9rem;
  text-align: center;
  opacity: 0.75;
  font-size: 0.7rem;
}
.dlw_title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.dlw_title em {
  font-style: normal;
  opacity: 0.55;
  margin: 0 0.25rem;
}
.dlw_body {
  border: 1px solid color-mix(in srgb, CanvasText 14%, transparent);
  border-radius: 0.55rem;
  background: color-mix(in srgb, Canvas 92%, CanvasText 8%);
  overflow: hidden;
}
.dlw_section {
  display: grid;
  grid-template-columns: 2.25rem 1fr;
  gap: 0.5rem;
  padding: 0.55rem 0.7rem;
  align-items: start;
}
.dlw_section + .dlw_section {
  border-top: 1px solid color-mix(in srgb, CanvasText 10%, transparent);
}
.dlw_tag {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  color: color-mix(in srgb, CanvasText 45%, transparent);
  padding-top: 0.15rem;
}
.dlw_pre {
  margin: 0;
  padding: 0;
  max-height: 14rem;
  overflow: auto;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 0.75rem;
  line-height: 1.45;
  white-space: pre-wrap;
  word-break: break-word;
  color: CanvasText;
  background: transparent;
}
.dlw_metaLine {
  margin-top: 0.35rem;
  font-size: 0.7rem;
  color: color-mix(in srgb, CanvasText 50%, transparent);
}
.dlw_foot {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}
.dlw_pill {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.2rem 0.55rem;
  border: 1px solid color-mix(in srgb, CanvasText 18%, transparent);
  border-radius: 999px;
  background: color-mix(in srgb, Canvas 94%, CanvasText 6%);
  color: color-mix(in srgb, CanvasText 70%, transparent);
  font-size: 0.7rem;
  line-height: 1.3;
}
@media (prefers-color-scheme: dark) {
  .dlw_body { background: color-mix(in srgb, #1a1a1a 88%, #fff 12%); }
}
`;

		function ensureStyles() {
			if (document.getElementById(`${PLUGIN}-css`)) return;
			const el = document.createElement("style");
			el.id = `${PLUGIN}-css`;
			el.textContent = css;
			document.head.appendChild(el);
		}

		function shortPath(p) {
			if (!p || typeof p !== "string") return "";
			const parts = p.replace(/\\/g, "/").split("/").filter(Boolean);
			if (parts.length <= 2) return parts.join("/") || p;
			return parts.slice(-2).join("/");
		}

		function formatBytes(n) {
			if (!n || n < 1024) return `${n || 0} B`;
			if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
			return `${(n / (1024 * 1024)).toFixed(2)} MB`;
		}

		function formatElapsed(ms) {
			const s = Math.max(0, Math.floor(ms / 1000));
			if (s < 60) return `${s}s`;
			const m = Math.floor(s / 60);
			const r = s % 60;
			return `${m}m ${r}s`;
		}

		function tryParsePartialJson(raw) {
			if (!raw || typeof raw !== "string") return null;
			const s = raw.trim();
			if (!s.startsWith("{")) return null;
			try {
				return JSON.parse(s);
			} catch {
				/* continue */
			}
			let depth = 0;
			let inStr = false;
			let esc = false;
			for (let i = 0; i < s.length; i++) {
				const c = s[i];
				if (inStr) {
					if (esc) esc = false;
					else if (c === "\\") esc = true;
					else if (c === '"') inStr = false;
					continue;
				}
				if (c === '"') inStr = true;
				else if (c === "{") depth++;
				else if (c === "}") {
					depth--;
					if (depth === 0) {
						try {
							return JSON.parse(s.slice(0, i + 1));
						} catch {
							return null;
						}
					}
				}
			}
			const repaired = s.replace(/,\s*$/, "") + "}".repeat(Math.max(0, depth));
			try {
				return JSON.parse(repaired);
			} catch {
				return null;
			}
		}

		function extractStringField(raw, key) {
			if (!raw || typeof raw !== "string") return "";
			const re = new RegExp(`"${key}"\\s*:\\s*"`);
			const m = re.exec(raw);
			if (!m) return "";
			let i = m.index + m[0].length;
			let out = "";
			let esc = false;
			for (; i < raw.length; i++) {
				const c = raw[i];
				if (esc) {
					if (c === "n") out += "\n";
					else if (c === "t") out += "\t";
					else if (c === "r") out += "\r";
					else if (c === '"') out += '"';
					else if (c === "\\") out += "\\";
					else if (c === "u" && i + 4 < raw.length) {
						const hex = raw.slice(i + 1, i + 5);
						if (/^[0-9a-fA-F]{4}$/.test(hex)) {
							out += String.fromCharCode(parseInt(hex, 16));
							i += 4;
						} else out += c;
					} else out += c;
					esc = false;
					continue;
				}
				if (c === "\\") {
					esc = true;
					continue;
				}
				if (c === '"') break;
				out += c;
			}
			return out;
		}

		function parseStreamingArgs(argsRaw, name) {
			const parsed = tryParsePartialJson(argsRaw) || {};
			const filePath =
				parsed.path ||
				parsed.file_path ||
				parsed.filePath ||
				extractStringField(argsRaw, "path") ||
				extractStringField(argsRaw, "file_path") ||
				"";
			let body = "";
			if (name === "edit") {
				body =
					parsed.new_string ||
					parsed.newString ||
					extractStringField(argsRaw, "new_string") ||
					extractStringField(argsRaw, "newString") ||
					"";
			} else {
				body =
					parsed.contents ||
					parsed.content ||
					extractStringField(argsRaw, "contents") ||
					extractStringField(argsRaw, "content") ||
					"";
			}
			const lines = body ? body.split("\n").length : 0;
			return {
				filePath,
				body,
				bytes: body ? new TextEncoder().encode(body).length : (argsRaw || "").length,
				lines,
				oldSnippet:
					name === "edit"
						? parsed.old_string ||
							parsed.oldString ||
							extractStringField(argsRaw, "old_string") ||
							extractStringField(argsRaw, "oldString") ||
							""
						: "",
			};
		}

		function walkNodes(node, visit) {
			if (!node || typeof node !== "object") return;
			visit(node);
			if (Array.isArray(node.children)) {
				for (const c of node.children) walkNodes(c, visit);
			}
			if (node.child) walkNodes(node.child, visit);
			if (Array.isArray(node.items)) {
				for (const c of node.items) walkNodes(c, visit);
			}
			if (Array.isArray(node.parts)) {
				for (const c of node.parts) walkNodes(c, visit);
			}
			if (Array.isArray(node.content)) {
				for (const c of node.content) walkNodes(c, visit);
			}
		}

		function extractLiveWrites(snapshot) {
			const hits = [];
			const visit = (n) => {
				const name = n.name || n.tool || n.toolName || n.function?.name;
				const isWrite = name === "write" || name === "edit" || name === "Write" || name === "Edit";
				if (!isWrite) return;
				const status = (n.status || n.state || "").toString().toLowerCase();
				const done =
					status === "completed" ||
					status === "done" ||
					status === "success" ||
					status === "error" ||
					status === "failed" ||
					n.result != null ||
					n.output != null;
				if (done) return;
				const argsRaw =
					(typeof n.arguments === "string" && n.arguments) ||
					(typeof n.args === "string" && n.args) ||
					(typeof n.input === "string" && n.input) ||
					(typeof n.partialArguments === "string" && n.partialArguments) ||
					(n.arguments && typeof n.arguments === "object" ? JSON.stringify(n.arguments) : "") ||
					"";
				if (!argsRaw && !n.streaming) return;
				hits.push({
					name: String(name).toLowerCase(),
					argsRaw,
					callId: n.id || n.callId || n.toolCallId || `${name}-${hits.length}`,
				});
			};
			if (Array.isArray(snapshot)) {
				for (const n of snapshot) walkNodes(n, visit);
			} else {
				walkNodes(snapshot, visit);
			}
			return hits[hits.length - 1] || null;
		}

		function currentSessionId(sessions) {
			try {
				const list = sessions?.list?.getSnapshot?.() ?? sessions?.list;
				if (Array.isArray(list)) {
					const active = list.find((s) => s.active || s.selected || s.focused);
					if (active?.id) return active.id;
					if (list[0]?.id) return list[0].id;
				}
				if (list && typeof list === "object") {
					if (list.activeId) return list.activeId;
					if (list.currentId) return list.currentId;
					if (list.selectedId) return list.selectedId;
				}
			} catch {
				/* */
			}
			return null;
		}

		function findChatAnchor() {
			const selectors = [
				"[data-conversation-scroll]",
				".EvIC1a_scroll",
				"[class*='Conversation'] [class*='scroll']",
				"main [class*='messages']",
			];
			for (const sel of selectors) {
				const el = document.querySelector(sel);
				if (el) return { parent: el, before: null };
			}
			const composer =
				document.querySelector("textarea[placeholder]") ||
				document.querySelector("[contenteditable='true']") ||
				document.querySelector("form textarea");
			if (composer) {
				const col = composer.closest("[class*='column'], [class*='Chat'], main, section") || composer.parentElement;
				if (col) return { parent: col, before: composer.closest("form") || composer };
			}
			return null;
		}

		function ensureFlowHost() {
			let host = document.getElementById(HOST_ID);
			if (host?.isConnected) return host;
			const anchor = findChatAnchor();
			if (!anchor) return null;
			host = document.createElement("div");
			host.id = HOST_ID;
			host.setAttribute("data-dsh-live-write", "1");
			if (anchor.before && anchor.before.parentElement === anchor.parent) {
				anchor.parent.insertBefore(host, anchor.before);
			} else {
				anchor.parent.appendChild(host);
			}
			return host;
		}

		function LiveWriteCard({ live, open, setOpen, now }) {
			if (!live) return null;
			const toolName = live.name === "edit" ? "edit" : "write";
			const pathLabel = shortPath(live.filePath) || "…";
			const elapsed = formatElapsed(now - (live.startedAt || now));
			const preview = live.body
				? live.body.split("\n").slice(-PREVIEW_TAIL_LINES).join("\n")
				: "";
			const inJson = JSON.stringify(
				live.name === "edit"
					? {
							path: live.filePath || "",
							old_string: live.oldSnippet
								? `${live.oldSnippet.slice(0, 200)}${live.oldSnippet.length > 200 ? "…" : ""}`
								: "(streaming…)",
							new_string: preview
								? `${preview.slice(0, 400)}${preview.length > 400 ? "…" : ""}`
								: "(streaming…)",
						}
					: {
							path: live.filePath || "",
							contents: preview
								? `${preview.slice(0, 600)}${preview.length > 600 ? "…" : ""}`
								: "(streaming…)",
						},
				null,
				2,
			);

			return React.createElement(
				"div",
				{
					className: "dlw_wrap",
					"data-live-write": "1",
					role: "status",
					"aria-live": "polite",
				},
				React.createElement(
					"button",
					{
						type: "button",
						className: "dlw_head",
						"aria-expanded": open ? "true" : "false",
						title: "Streaming write/edit — expand to see draft",
						onClick: () => setOpen((v) => !v),
					},
					React.createElement("span", { className: "dlw_chev", "aria-hidden": true }, open ? "▾" : "▸"),
					React.createElement(
						"span",
						{ className: "dlw_title" },
						"Tool call",
						React.createElement("em", null, "•"),
						toolName,
						React.createElement("em", null, "•"),
						pathLabel,
					),
				),
				open &&
					React.createElement(
						"div",
						{ className: "dlw_body" },
						React.createElement(
							"div",
							{ className: "dlw_section" },
							React.createElement("div", { className: "dlw_tag" }, "IN"),
							React.createElement(
								"div",
								null,
								React.createElement("pre", { className: "dlw_pre" }, inJson),
								React.createElement(
									"div",
									{ className: "dlw_metaLine" },
									`${formatBytes(live.bytes)}${live.lines ? ` · ${live.lines} lines` : ""} · ${elapsed} · still streaming`,
								),
							),
						),
						React.createElement(
							"div",
							{ className: "dlw_section" },
							React.createElement("div", { className: "dlw_tag" }, "OUT"),
							React.createElement(
								"pre",
								{ className: "dlw_pre" },
								'{"status":"streaming","note":"Not on disk until the tool finishes. Agent review / Undo appear after commit."}',
							),
						),
					),
				React.createElement(
					"div",
					{ className: "dlw_foot" },
					React.createElement(
						"span",
						{ className: "dlw_pill", title: "Live draft from trajectory stream" },
						"</> Live draft",
					),
				),
			);
		}

		const inject = ["uiConversation", "sessions"];

		function apply(ctx) {
			ensureStyles();
			if (!ReactDOMClient?.createRoot) {
				console.warn("[dsh-live-write] react-dom/client missing");
				return;
			}

			ctx.inject(["uiConversation", "sessions"], (scope) => {
				const uiConversation = scope.get("uiConversation") || scope.uiConversation;
				const sessions = scope.get("sessions") || scope.sessions;
				if (!uiConversation) return;

				scope.effect(() => {
					let root = null;
					let host = null;
					let open = true;
					let now = Date.now();
					let live = null;
					const started = new Map();
					let unsubTraj = () => {};
					let sessionId = null;
					let disposed = false;

					const render = () => {
						if (disposed) return;
						if (!live) {
							if (host?.parentElement) host.remove();
							if (root) {
								try {
									root.render(null);
								} catch {
									/* */
								}
							}
							return;
						}
						host = ensureFlowHost();
						if (!host) return;
						if (!root) root = ReactDOMClient.createRoot(host);
						root.render(
							React.createElement(LiveWriteCard, {
								live,
								open,
								now,
								setOpen: (updater) => {
									open = typeof updater === "function" ? updater(open) : updater;
									render();
								},
							}),
						);
						try {
							const scroll = host.closest(".EvIC1a_scroll, [data-conversation-scroll]");
							if (scroll) {
								const dist = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight;
								if (dist < 180) host.scrollIntoView({ block: "nearest", behavior: "smooth" });
							}
						} catch {
							/* */
						}
					};

					const bindSession = (id) => {
						unsubTraj();
						unsubTraj = () => {};
						sessionId = id;
						live = null;
						open = true;
						if (!id) {
							render();
							return;
						}
						const tick = () => {
							if (disposed || sessionId !== id) return;
							try {
								const binding = uiConversation.binding(id);
								const target = binding.target("trajectory");
								const snap = target.getSnapshot?.() ?? null;
								const hit = extractLiveWrites(snap);
								if (hit) {
									if (!started.has(hit.callId)) started.set(hit.callId, Date.now());
									const parsed = parseStreamingArgs(hit.argsRaw, hit.name);
									live = {
										...hit,
										...parsed,
										startedAt: started.get(hit.callId) || Date.now(),
									};
								} else {
									live = null;
									open = true;
								}
							} catch {
								live = null;
							}
							render();
						};
						try {
							const binding = uiConversation.binding(id);
							const target = binding.target("trajectory");
							unsubTraj = target.subscribe(tick);
							tick();
						} catch {
							live = null;
							render();
						}
					};

					const syncSession = () => {
						const next = currentSessionId(sessions);
						if (next !== sessionId) bindSession(next);
						else if (live) {
							ensureFlowHost();
						}
					};

					bindSession(currentSessionId(sessions));
					const unsubSessions = sessions?.list?.subscribe?.(syncSession) || (() => {});
					const poll = setInterval(() => {
						syncSession();
						if (sessionId) {
							try {
								const binding = uiConversation.binding(sessionId);
								const snap = binding.target("trajectory").getSnapshot?.();
								const hit = extractLiveWrites(snap);
								if (hit) {
									if (!started.has(hit.callId)) started.set(hit.callId, Date.now());
									live = {
										...hit,
										...parseStreamingArgs(hit.argsRaw, hit.name),
										startedAt: started.get(hit.callId) || Date.now(),
									};
									render();
								} else if (live) {
									live = null;
									open = true;
									render();
								}
							} catch {
								/* */
							}
						}
					}, 750);
					const clock = setInterval(() => {
						if (!live) return;
						now = Date.now();
						render();
					}, 1000);

					const mo = new MutationObserver(() => {
						if (!live) return;
						const h = ensureFlowHost();
						if (h && root) render();
					});
					mo.observe(document.body, { childList: true, subtree: true });

					return () => {
						disposed = true;
						unsubTraj();
						unsubSessions();
						clearInterval(poll);
						clearInterval(clock);
						mo.disconnect();
						try {
							root?.unmount?.();
						} catch {
							/* */
						}
						document.getElementById(HOST_ID)?.remove();
					};
				}, `${PLUGIN}: transcript mount`);
			});
		}

		return { apply, inject };
	},
});

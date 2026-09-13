window.__ModuleLoader__.load({
	id: "dsh-agent-review",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-agent-review";
		const RPC = "/agent-review";
		const OPEN_CODE = "dsh-open-code-file";

		const css = `
.dar_wrap{box-sizing:border-box;width:calc(100% - 2 * var(--dsh-composer-side-clearance, 16px));max-width:var(--dsh-composer-card-max-width, 780px);margin:0 auto;padding:0;flex:none}
.dar_bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:2px 2px 4px;margin:0;border:none;border-radius:0;background:transparent;box-shadow:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dar_barIdle{opacity:.72}
.dar_idleHint{font-size:11px;color:var(--dsw-alias-label-tertiary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:min(360px,42vw)}
.dar_filesBtn{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 8px;border-radius:8px;border:none;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.dar_filesBtn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dar_filesBtn:disabled{cursor:default;opacity:.85}
.dar_chev{opacity:.7;font-size:11px}
.dar_spacer{flex:1;min-width:8px}
.dar_btn{height:26px;padding:0 8px;border-radius:8px;border:none;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:12px;cursor:pointer}
.dar_btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dar_btn:disabled{opacity:.4;cursor:not-allowed}
.dar_btnPrimary{color:var(--dsw-alias-label-primary)}
.dar_btnDanger{color:var(--dsw-alias-state-error-primary)}
.dar_panel{margin:4px 0 0;border-radius:12px;border:1px solid var(--dsw-alias-border-l2);background:color-mix(in srgb,var(--dsw-alias-bg-base) 88%,transparent);backdrop-filter:blur(8px);overflow:hidden;max-height:min(52vh,480px);display:flex;flex-direction:column;box-shadow:var(--dsw-shadow-lv2)}
.dar_list{overflow:auto;padding:6px;flex:none;max-height:160px}
.dar_row{display:flex;align-items:center;gap:8px;padding:7px 8px;border-radius:8px;cursor:pointer;font-size:12px}
.dar_row:hover,.dar_rowActive{background:var(--dsw-alias-interactive-bg-hover)}
.dar_name{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--dsw-alias-label-primary)}
.dar_statAdd{color:#3fb950;font-family:var(--ds-font-family-code);font-size:11px}
.dar_statDel{color:#f85149;font-family:var(--ds-font-family-code);font-size:11px}
.dar_rowActions{display:flex;gap:4px;flex:none}
.dar_iconBtn{height:22px;min-width:22px;padding:0 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l2);background:transparent;color:var(--dsw-alias-label-secondary);cursor:pointer;font-size:11px}
.dar_iconBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dar_diffPane{flex:1;min-height:120px;overflow:auto;border-top:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base)}
.dar_diff{margin:0;padding:0;font-family:var(--ds-font-family-code);font-size:12px;line-height:1.5}
.dar_diffLine{display:block;padding:0 12px;white-space:pre-wrap;word-break:break-word}
.dar_diffAdd{color:#3fb950;background:rgba(63,185,80,.12)}
.dar_diffDel{color:#f85149;background:rgba(248,81,73,.12)}
.dar_diffHunk{color:#79c0ff;background:rgba(56,139,253,.1)}
.dar_diffMeta{color:var(--dsw-alias-label-tertiary)}
.dar_empty{padding:16px;color:var(--dsw-alias-label-tertiary);font-size:12px}
.dar_err{padding:4px 2px 0;color:var(--dsw-alias-state-error-primary);font-size:12px}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-agent-review-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-agent-review-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function openInCodeTab(filePath) {
			if (typeof window === "undefined" || !filePath) return;
			window.dispatchEvent(new CustomEvent(OPEN_CODE, { detail: { path: filePath } }));
		}

		function unifiedDiff(path, before, after) {
			const oldLines = String(before ?? "").split("\n");
			const newLines = String(after ?? "").split("\n");
			const lines = [
				`diff --git a/${path} b/${path}`,
				before == null ? "--- /dev/null" : `--- a/${path}`,
				`+++ b/${path}`,
				`@@ -1,${oldLines.length} +1,${newLines.length} @@`,
			];
			if (before == null) {
				for (const l of newLines) lines.push(`+${l}`);
			} else {
				// Simple full-file diff (readable; not Myers) — fine for review
				const max = Math.max(oldLines.length, newLines.length);
				for (let i = 0; i < max; i += 1) {
					const a = oldLines[i];
					const b = newLines[i];
					if (a === b) {
						if (a !== undefined) lines.push(` ${a}`);
					} else {
						if (a !== undefined) lines.push(`-${a}`);
						if (b !== undefined) lines.push(`+${b}`);
					}
				}
			}
			return lines.join("\n");
		}

		function DiffView({ text, empty }) {
			const content = text == null || text === "" ? "" : String(text);
			if (!content) {
				return React.createElement("pre", { className: "dar_empty" }, empty || "");
			}
			const lines = content.split("\n");
			return React.createElement(
				"pre",
				{ className: "dar_diff" },
				lines.map((line, i) => {
					let cls = "dar_diffLine";
					if (line.startsWith("+++") || line.startsWith("---") || line.startsWith("diff ") || line.startsWith("index ")) {
						cls += " dar_diffMeta";
					} else if (line.startsWith("@@")) {
						cls += " dar_diffHunk";
					} else if (line.startsWith("+")) {
						cls += " dar_diffAdd";
					} else if (line.startsWith("-")) {
						cls += " dar_diffDel";
					}
					return React.createElement("span", { key: i, className: cls }, line || " ");
				}),
			);
		}

		function ReviewBar({ sessionId, connection }) {
			const [files, setFiles] = React.useState([]);
			const [generation, setGeneration] = React.useState(0);
			const [open, setOpen] = React.useState(false);
			const [selected, setSelected] = React.useState(null);
			const [diffText, setDiffText] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [error, setError] = React.useState("");

			const refresh = React.useCallback(async () => {
				if (!connection || !sessionId) return;
				try {
					const res = await callRpc(connection, "list", { sessionId });
					setFiles(res.files || []);
					setGeneration(res.generation || 0);
					if (!(res.files || []).length) {
						setOpen(false);
						setSelected(null);
						setDiffText("");
					}
				} catch {
					/* ignore poll errors */
				}
			}, [connection, sessionId]);

			React.useEffect(() => {
				refresh();
				const id = setInterval(refresh, 1500);
				return () => clearInterval(id);
			}, [refresh]);

			const loadDiff = async (file) => {
				if (!file?.path) return;
				setSelected(file);
				setBusy(true);
				setError("");
				try {
					const res = await callRpc(connection, "diff", { sessionId, path: file.path });
					setDiffText(unifiedDiff(res.path, res.before, res.after));
				} catch (err) {
					setError(err?.message || String(err));
					setDiffText("");
				} finally {
					setBusy(false);
				}
			};

			const run = async (endpoint, path) => {
				setBusy(true);
				setError("");
				try {
					const res = await callRpc(connection, endpoint, { sessionId, path });
					setFiles(res.files || []);
					setGeneration(res.generation || generation);
					if (path && selected?.path === path) {
						setSelected(null);
						setDiffText("");
					}
					if (!(res.files || []).length) {
						setOpen(false);
						setSelected(null);
						setDiffText("");
					} else if (selected && !(res.files || []).some((f) => f.path === selected.path)) {
						setSelected(null);
						setDiffText("");
					}
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			if (!connection || !sessionId) return null;

			const count = files.length;
			const hasPending = count > 0;

			return React.createElement(
				"div",
				{ className: "dar_wrap", "data-agent-review": "1" },
				React.createElement(
					"div",
					{
						className: "dar_bar" + (hasPending ? "" : " dar_barIdle"),
						"data-agent-review-bar": "1",
						title: hasPending
							? "Pending agent file changes for this session"
							: "Agent review — appears with actions when the agent edits files in this session",
					},
					React.createElement(
						"button",
						{
							type: "button",
							className: "dar_filesBtn",
							disabled: busy || !hasPending,
							onClick: () => {
								if (!hasPending) return;
								const next = !open;
								setOpen(next);
								if (next && !selected && files[0]) loadDiff(files[0]);
							},
							title: hasPending ? "Review files the agent changed" : "No pending agent file changes yet",
						},
						React.createElement("span", { className: "dar_chev" }, open && hasPending ? "▾" : "▸"),
						hasPending
							? `${count} File${count === 1 ? "" : "s"}`
							: "Agent review",
					),
					!hasPending && React.createElement(
						"span",
						{ className: "dar_idleHint" },
						"No pending changes — will fill after the agent writes/edits files",
					),
					React.createElement("span", { className: "dar_spacer" }),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dar_btn dar_btnDanger",
							disabled: busy || !hasPending,
							onClick: () => run("undoAll"),
							title: "Restore every pending file to its pre-agent content",
						},
						"Undo All",
					),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dar_btn",
							disabled: busy || !hasPending,
							onClick: () => run("keepAll"),
							title: "Accept all agent changes (dismiss review)",
						},
						"Keep All",
					),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dar_btn dar_btnPrimary",
							disabled: busy || !hasPending,
							onClick: () => {
								setOpen(true);
								if (!selected && files[0]) loadDiff(files[0]);
							},
						},
						"Review",
					),
				),
				error && React.createElement("div", { className: "dar_err" }, error),
				open && hasPending && React.createElement(
					"div",
					{ className: "dar_panel" },
					React.createElement(
						"div",
						{ className: "dar_list" },
						files.map((f) =>
							React.createElement(
								"div",
								{
									key: f.path,
									className: "dar_row" + (selected?.path === f.path ? " dar_rowActive" : ""),
									onClick: () => loadDiff(f),
									title: f.absPath || f.path,
								},
								React.createElement("span", { className: "dar_name" }, f.path),
								React.createElement("span", { className: "dar_statAdd" }, `+${f.additions || 0}`),
								React.createElement("span", { className: "dar_statDel" }, `−${f.deletions || 0}`),
								React.createElement(
									"div",
									{
										className: "dar_rowActions",
										onClick: (e) => e.stopPropagation(),
									},
									React.createElement(
										"button",
										{
											type: "button",
											className: "dar_iconBtn",
											disabled: busy,
											title: "Undo this file",
											onClick: () => run("undo", f.path),
										},
										"Undo",
									),
									React.createElement(
										"button",
										{
											type: "button",
											className: "dar_iconBtn",
											disabled: busy,
											title: "Keep this file",
											onClick: () => run("keep", f.path),
										},
										"Keep",
									),
									React.createElement(
										"button",
										{
											type: "button",
											className: "dar_iconBtn",
											disabled: busy,
											title: "Open in Code tab",
											onClick: () => openInCodeTab(f.absPath || f.path),
										},
										"Open",
									),
								),
							),
						),
					),
					React.createElement(
						"div",
						{ className: "dar_diffPane" },
						React.createElement(DiffView, {
							text: diffText,
							empty: busy ? "Loading…" : "Select a file to review the agent diff.",
						}),
					),
				),
			);
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			ensureStyles();

			ctx.inject(["slots", "connection"], (scope) => {
				const slots = scope.get("slots") || scope.slots;
				const connection = scope.get("connection") || scope.connection;
				if (!slots?.inject) return;

				scope.effect(
					() =>
						slots.inject("conversation.input.dock", () =>
							slots.register(
								{
									name: "conversation.input.dock",
									id: "dsh-agent-review-bar",
									order: 5,
									inject: (sessionId) => ({
										sessionId,
										connection,
									}),
								},
								function AgentReviewDock({ sessionId, connection: conn }) {
									if (!sessionId || !conn) return null;
									return React.createElement(ReviewBar, {
										sessionId,
										connection: conn,
									});
								},
							),
						),
					`${PLUGIN}: dock`,
				);
			});
		}

		return { apply, inject };
	},
});

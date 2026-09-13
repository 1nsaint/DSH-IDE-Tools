// dsh-archive — browser half: Settings → Archived (restore / permanent delete).
window.__ModuleLoader__.load({
	id: "dsh-archive",
	factory: (require) => {
		const react = require("react");
		const jsx = require("react/jsx-runtime");

		const PLUGIN = "dsh-archive";
		const RPC_CHANNEL = "/archive";

		const css = [
			".da_sec{display:flex;flex-direction:column;gap:16px;max-width:640px}",
			".da_intro{color:var(--dsw-alias-label-tertiary);margin:0;font-size:12px;line-height:18px}",
			".da_error{background:var(--dsw-alias-interactive-bg-hover-danger);color:var(--dsw-alias-state-error-primary);border-radius:8px;padding:8px 12px;font-size:12px;line-height:18px}",
			".da_toolbar{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
			".da_empty{text-align:center;min-height:180px;color:var(--dsw-alias-label-tertiary);flex-direction:column;justify-content:center;align-items:center;display:flex;gap:8px;border:1px dashed var(--dsw-alias-border-l2);border-radius:14px;padding:24px}",
			".da_list{flex-direction:column;gap:8px;display:flex}",
			".da_row{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:14px;padding:12px 14px;display:flex;flex-direction:column;gap:10px}",
			".da_row:hover{border-color:var(--dsw-alias-border-l1)}",
			".da_rowTitle{font-size:14px;font-weight:500;line-height:21px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".da_rowMeta{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:18px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
			".da_actions{display:flex;gap:8px;justify-content:flex-end;flex-wrap:wrap}",
			".da_primary,.da_secondary,.da_danger{min-height:30px;font:inherit;cursor:pointer;border:1px solid transparent;border-radius:9px;padding:0 12px;font-size:13px}",
			".da_primary{background:transparent;color:var(--dsw-alias-state-business-primary);border:2px solid var(--dsw-alias-state-business-primary)}",
			".da_primary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}",
			".da_secondary{border-color:var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary)}",
			".da_danger{background:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-label-primary-foreground)}",
			".da_primary:disabled,.da_secondary:disabled,.da_danger:disabled{opacity:.5;cursor:default}",
			".da_confirm{color:var(--dsw-alias-label-secondary);font-size:12px;display:flex;align-items:center;gap:8px;margin-left:auto;flex-wrap:wrap}",
		].join("");

		const tagId = "dsh-archive/settings.v2.css";
		if (typeof document !== "undefined" && !document.querySelector(`style[data-plugin-css="${tagId}"]`)) {
			const tag = document.createElement("style");
			tag.dataset.plugin = PLUGIN;
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		async function callRpc(connection, endpoint, payload, signal) {
			const result = await connection.rpc.call(RPC_CHANNEL, endpoint, payload ?? {}, signal);
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function ArchiveIcon({ size = 18 }) {
			return jsx.jsx("svg", {
				width: size,
				height: size,
				viewBox: "0 0 20 20",
				fill: "none",
				"aria-hidden": true,
				children: jsx.jsx("path", {
					d: "M3.5 5.5h13v2.25H3.5V5.5Zm1.25 3.5h10.5V15a1.5 1.5 0 0 1-1.5 1.5h-7.5a1.5 1.5 0 0 1-1.5-1.5V9Zm3.75 2.25h3v1.5h-3v-1.5Z",
					fill: "currentColor",
				}),
			});
		}

		function ArchiveSection({ connection }) {
			const [items, setItems] = react.useState([]);
			const [loading, setLoading] = react.useState(true);
			const [error, setError] = react.useState("");
			const [busyId, setBusyId] = react.useState(null);
			const [confirmId, setConfirmId] = react.useState(null);

			const refresh = react.useCallback(async (signal) => {
				setLoading(true);
				setError("");
				try {
					const next = await callRpc(connection, "list", {}, signal);
					if (!signal?.aborted) setItems(next.items || []);
				} catch (err) {
					if (!signal?.aborted) setError(err?.message || String(err));
				} finally {
					if (!signal?.aborted) setLoading(false);
				}
			}, [connection]);

			react.useEffect(() => {
				const ac = new AbortController();
				refresh(ac.signal);
				return () => ac.abort();
			}, [refresh]);

			async function onRestore(sessionId) {
				setBusyId(sessionId);
				setError("");
				try {
					await callRpc(connection, "unarchive", { sessionId });
					setItems((prev) => prev.filter((item) => item.sessionId !== sessionId));
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusyId(null);
				}
			}

			async function onDelete(sessionId) {
				setBusyId(sessionId);
				setError("");
				try {
					await callRpc(connection, "delete", { sessionId });
					setItems((prev) => prev.filter((item) => item.sessionId !== sessionId));
					setConfirmId(null);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusyId(null);
				}
			}

			return jsx.jsxs("div", {
				className: "da_sec",
				children: [
					jsx.jsx("p", {
						className: "da_intro",
						children: "Restore archived chats to the sidebar, or delete them permanently (session files on disk).",
					}),
					jsx.jsxs("div", {
						className: "da_toolbar",
						children: [
							jsx.jsx("button", {
								type: "button",
								className: "da_secondary",
								disabled: loading || busyId != null,
								onClick: () => refresh(),
								children: loading ? "Refreshing…" : "Refresh",
							}),
							!loading
								? jsx.jsx("span", {
									className: "da_intro",
									children: `${items.length} archived`,
								})
								: null,
						],
					}),
					error ? jsx.jsx("div", { className: "da_error", children: error }) : null,
					loading
						? jsx.jsx("div", { className: "da_empty", children: "Loading…" })
						: items.length === 0
							? jsx.jsxs("div", {
								className: "da_empty",
								children: [
									jsx.jsx(ArchiveIcon, { size: 28 }),
									jsx.jsx("div", { children: "No archived chats" }),
									jsx.jsx("div", {
										style: { fontSize: 12 },
										children: "Archive from a chat’s ⋯ menu — they land here.",
									}),
								],
							})
							: jsx.jsx("div", {
								className: "da_list",
								children: items.map((item) => {
									const busy = busyId === item.sessionId;
									const confirming = confirmId === item.sessionId;
									return jsx.jsxs("div", {
										className: "da_row",
										children: [
											jsx.jsx("div", {
												className: "da_rowTitle",
												title: item.title,
												children: item.title,
											}),
											jsx.jsx("div", {
												className: "da_rowMeta",
												children: item.workspaceTitle
													? `${item.workspaceTitle} · ${item.sessionId.slice(0, 18)}…`
													: item.sessionId,
											}),
											jsx.jsx("div", {
												className: "da_actions",
												children: confirming
													? jsx.jsxs("div", {
														className: "da_confirm",
														children: [
															jsx.jsx("span", { children: "Delete forever?" }),
															jsx.jsx("button", {
																type: "button",
																className: "da_secondary",
																disabled: busy,
																onClick: () => setConfirmId(null),
																children: "Cancel",
															}),
															jsx.jsx("button", {
																type: "button",
																className: "da_danger",
																disabled: busy,
																onClick: () => onDelete(item.sessionId),
																children: busy ? "Deleting…" : "Delete",
															}),
														],
													})
													: jsx.jsxs(jsx.Fragment, {
														children: [
															jsx.jsx("button", {
																type: "button",
																className: "da_secondary",
																disabled: busy,
																onClick: () => setConfirmId(item.sessionId),
																children: "Delete",
															}),
															jsx.jsx("button", {
																type: "button",
																className: "da_primary",
																disabled: busy,
																onClick: () => onRestore(item.sessionId),
																children: busy ? "…" : "Restore",
															}),
														],
													}),
											}),
										],
									}, item.sessionId);
								}),
							}),
				],
			});
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			try {
				ctx.slots.inject(
					"settings.section",
					() =>
						ctx.slots.register(
							{
								name: "settings.section",
								id: "archive",
								order: 180,
								label: () => "Archived",
								inject: () => ({ connection }),
							},
							ArchiveSection
						),
					"dsh-archive settings page"
				);
			} catch (error) {
				console.error("[dsh-archive] settings page inject failed:", error);
			}
		}

		return { apply, inject };
	},
});

// Settings → MCP: add/enable stdio (uvx/npx) and streamable-http MCP servers.
window.__ModuleLoader__.load({
	id: "dsh-mcp-manager",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-mcp-manager";
		const RPC = "/mcp-manager";

		const css = `
.dmm_root{display:flex;flex-direction:column;gap:14px;max-width:720px}
.dmm_intro{font-size:12px;line-height:1.45;color:var(--dsw-alias-label-secondary)}
.dmm_intro code{font-size:11px;font-family:var(--ds-font-family-code,ui-monospace,monospace)}
.dmm_toolbar{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dmm_list{display:flex;flex-direction:column;gap:8px}
.dmm_row{display:flex;flex-direction:column;gap:8px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.dmm_rowTop{display:flex;align-items:center;gap:10px;min-width:0}
.dmm_title{flex:1;min-width:0;font-size:13px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dmm_meta{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code,ui-monospace,monospace)}
.dmm_status{font-size:11px;font-weight:500}
.dmm_status_running{color:var(--dsw-alias-state-business-primary)}
.dmm_status_error{color:var(--dsw-alias-state-error-primary)}
.dmm_status_stopped,.dmm_status_starting{color:var(--dsw-alias-label-tertiary)}
.dmm_err{font-size:11px;color:var(--dsw-alias-state-error-primary);line-height:1.4;word-break:break-word}
.dmm_actions{display:flex;flex-wrap:wrap;gap:6px}
.dmm_btn{height:28px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;cursor:pointer}
.dmm_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dmm_btnPrimary{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.dmm_btnDanger{color:var(--dsw-alias-state-error-primary)}
.dmm_form{display:flex;flex-direction:column;gap:10px;padding:12px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-1)}
.dmm_field{display:flex;flex-direction:column;gap:4px;min-width:0}
.dmm_field span{font-size:11px;font-weight:500;color:var(--dsw-alias-label-secondary)}
.dmm_field small{font-size:10px;color:var(--dsw-alias-label-tertiary);line-height:1.35}
.dmm_input,.dmm_select,.dmm_textarea{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px}
.dmm_textarea{height:auto;min-height:64px;padding:8px 10px;resize:vertical;font-family:var(--ds-font-family-code,ui-monospace,monospace)}
.dmm_grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
@media (max-width:720px){.dmm_grid{grid-template-columns:1fr}}
.dmm_empty{font-size:12px;color:var(--dsw-alias-label-tertiary);padding:8px 0}
.dmm_presets{display:flex;flex-wrap:wrap;gap:6px}
`;

		let stylesReady = false;
		function ensureStyles() {
			if (stylesReady || typeof document === "undefined") return;
			const el = document.createElement("style");
			el.id = "dsh-mcp-manager-css";
			el.textContent = css;
			document.head.appendChild(el);
			stylesReady = true;
		}

		async function callRpc(connection, endpoint, payload, signal) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {}, signal);
			if (!result?.ok) {
				const msg = result?.error?.message || `RPC ${endpoint} failed`;
				throw new Error(msg);
			}
			return result.value;
		}

		function emptyDraft(preset) {
			const base = {
				id: "",
				label: "",
				enabled: true,
				serverName: "",
				transport: "stdio",
				command: "uvx",
				argsText: "",
				envText: "",
				cwd: "",
				url: "",
				headersText: "",
				toolCallTimeoutMs: 60000,
			};
			if (!preset) return base;
			return {
				...base,
				label: preset.label || "",
				serverName: preset.serverName || "",
				transport: preset.transport || "stdio",
				command: preset.command || "uvx",
				argsText: Array.isArray(preset.args) ? preset.args.join(" ") : "",
				envText: preset.env ? Object.entries(preset.env).map(([k, v]) => `${k}=${v}`).join("\n") : "",
				url: preset.url || "",
				headersText: preset.headers
					? Object.entries(preset.headers).map(([k, v]) => `${k}: ${v}`).join("\n")
					: "",
			};
		}

		function parseEnv(text) {
			const env = {};
			for (const line of String(text || "").split("\n")) {
				const t = line.trim();
				if (!t || t.startsWith("#")) continue;
				const i = t.indexOf("=");
				if (i <= 0) continue;
				env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
			}
			return env;
		}

		function parseHeaders(text) {
			const headers = {};
			for (const line of String(text || "").split("\n")) {
				const t = line.trim();
				if (!t || t.startsWith("#")) continue;
				const i = t.indexOf(":");
				if (i <= 0) continue;
				headers[t.slice(0, i).trim()] = t.slice(i + 1).trim();
			}
			return headers;
		}

		function splitArgs(text) {
			const out = [];
			const re = /"([^"\\]*(?:\\.[^"\\]*)*)"|'([^'\\]*(?:\\.[^'\\]*)*)'|(\S+)/g;
			let m;
			while ((m = re.exec(String(text || "")))) {
				out.push((m[1] ?? m[2] ?? m[3] ?? "").replace(/\\(["'\\])/g, "$1"));
			}
			return out;
		}

		function draftToServer(draft) {
			const server = {
				id: draft.id || undefined,
				label: draft.label.trim(),
				enabled: Boolean(draft.enabled),
				serverName: draft.serverName.trim(),
				transport: draft.transport,
				toolCallTimeoutMs: Number(draft.toolCallTimeoutMs) || 60000,
			};
			if (draft.transport === "streamable-http") {
				server.url = draft.url.trim();
				server.headers = parseHeaders(draft.headersText);
			} else {
				server.command = draft.command.trim();
				server.args = splitArgs(draft.argsText);
				server.env = parseEnv(draft.envText);
				server.cwd = draft.cwd.trim();
			}
			return server;
		}

		function serverToDraft(server) {
			return {
				id: server.id,
				label: server.label || "",
				enabled: Boolean(server.enabled),
				serverName: server.serverName || "",
				transport: server.transport || "stdio",
				command: server.command || "uvx",
				argsText: Array.isArray(server.args) ? server.args.join(" ") : "",
				envText: server.env
					? Object.entries(server.env).map(([k, v]) => `${k}=${v}`).join("\n")
					: "",
				cwd: server.cwd || "",
				url: server.url || "",
				headersText: server.headers
					? Object.entries(server.headers).map(([k, v]) => `${k}: ${v}`).join("\n")
					: "",
				toolCallTimeoutMs: server.toolCallTimeoutMs || 60000,
			};
		}

		function McpSettings({ connection }) {
			const [servers, setServers] = React.useState([]);
			const [presets, setPresets] = React.useState([]);
			const [draft, setDraft] = React.useState(null);
			const [busy, setBusy] = React.useState(false);
			const [msg, setMsg] = React.useState("");
			const [err, setErr] = React.useState("");

			const refresh = React.useCallback(async () => {
				const value = await callRpc(connection, "list", {});
				setServers(value.servers || []);
				setPresets(value.presets || []);
			}, [connection]);

			React.useEffect(() => {
				ensureStyles();
				refresh().catch((e) => setErr(e.message || String(e)));
			}, [refresh]);

			const patchDraft = (patch) => setDraft((d) => (d ? { ...d, ...patch } : d));

			async function run(fn) {
				setBusy(true);
				setErr("");
				setMsg("");
				try {
					await fn();
					await refresh();
				} catch (e) {
					setErr(e instanceof Error ? e.message : String(e));
				} finally {
					setBusy(false);
				}
			}

			return React.createElement(
				"div",
				{ className: "dmm_root" },
				React.createElement(
					"div",
					{ className: "dmm_intro" },
					"Connect MCP servers to this Harness. Stdio commands (",
					React.createElement("code", null, "uvx"),
					", ",
					React.createElement("code", null, "npx"),
					", …) run ",
					React.createElement("strong", null, "inside the Harness container"),
					". HTTP mode connects to a URL on your LAN. Tools appear as ",
					React.createElement("code", null, "mcp__name__tool"),
					".",
				),
				React.createElement(
					"div",
					{ className: "dmm_toolbar" },
					React.createElement(
						"button",
						{
							type: "button",
							className: "dmm_btn dmm_btnPrimary",
							disabled: busy || !!draft,
							onClick: () => setDraft(emptyDraft()),
						},
						"Add server",
					),
					React.createElement(
						"button",
						{
							type: "button",
							className: "dmm_btn",
							disabled: busy,
							onClick: () => run(refresh),
						},
						"Refresh",
					),
				),
				presets.length > 0 && React.createElement(
					"div",
					{ className: "dmm_presets" },
					presets.map((p) =>
						React.createElement(
							"button",
							{
								key: p.id,
								type: "button",
								className: "dmm_btn",
								disabled: busy || !!draft,
								title: p.hint || p.label,
								onClick: () => setDraft(emptyDraft(p)),
							},
							`+ ${p.label}`,
						),
					),
				),
				draft && React.createElement(
					"form",
					{
						className: "dmm_form",
						onSubmit: (ev) => {
							ev.preventDefault();
							run(async () => {
								await callRpc(connection, "upsert", { server: draftToServer(draft) });
								setDraft(null);
								setMsg("Saved");
							});
						},
					},
					React.createElement("div", { className: "dmm_grid" },
						React.createElement("label", { className: "dmm_field" },
							React.createElement("span", null, "Label"),
							React.createElement("input", {
								className: "dmm_input",
								value: draft.label,
								required: true,
								onChange: (e) => patchDraft({ label: e.target.value }),
							}),
						),
						React.createElement("label", { className: "dmm_field" },
							React.createElement("span", null, "Server name (mcp__… namespace)"),
							React.createElement("input", {
								className: "dmm_input",
								value: draft.serverName,
								required: true,
								pattern: "[A-Za-z0-9_-]{1,32}",
								onChange: (e) => patchDraft({ serverName: e.target.value }),
							}),
							React.createElement("small", null, "Letters, numbers, _ and - only. Unique."),
						),
					),
					React.createElement("label", { className: "dmm_field" },
						React.createElement("span", null, "Transport"),
						React.createElement(
							"select",
							{
								className: "dmm_select",
								value: draft.transport,
								onChange: (e) => patchDraft({ transport: e.target.value }),
							},
							React.createElement("option", { value: "stdio" }, "stdio (uvx / npx / command)"),
							React.createElement("option", { value: "streamable-http" }, "streamable-http (URL)"),
						),
					),
					draft.transport === "stdio"
						? React.createElement(React.Fragment, null,
							React.createElement("div", { className: "dmm_grid" },
								React.createElement("label", { className: "dmm_field" },
									React.createElement("span", null, "Command"),
									React.createElement("input", {
										className: "dmm_input",
										value: draft.command,
										required: true,
										placeholder: "uvx",
										onChange: (e) => patchDraft({ command: e.target.value }),
									}),
								),
								React.createElement("label", { className: "dmm_field" },
									React.createElement("span", null, "Args"),
									React.createElement("input", {
										className: "dmm_input",
										value: draft.argsText,
										placeholder: "mcp-for-blender",
										onChange: (e) => patchDraft({ argsText: e.target.value }),
									}),
								),
							),
							React.createElement("label", { className: "dmm_field" },
								React.createElement("span", null, "Env (KEY=value per line)"),
								React.createElement("textarea", {
									className: "dmm_textarea",
									value: draft.envText,
									placeholder: "BLENDER_HOST=192.168.0.50",
									onChange: (e) => patchDraft({ envText: e.target.value }),
								}),
							),
							React.createElement("label", { className: "dmm_field" },
								React.createElement("span", null, "Working directory (optional)"),
								React.createElement("input", {
									className: "dmm_input",
									value: draft.cwd,
									onChange: (e) => patchDraft({ cwd: e.target.value }),
								}),
							),
						)
						: React.createElement(React.Fragment, null,
							React.createElement("label", { className: "dmm_field" },
								React.createElement("span", null, "MCP URL"),
								React.createElement("input", {
									className: "dmm_input",
									value: draft.url,
									required: true,
									placeholder: "http://192.168.0.50:3000/mcp",
									onChange: (e) => patchDraft({ url: e.target.value }),
								}),
							),
							React.createElement("label", { className: "dmm_field" },
								React.createElement("span", null, "Headers (Name: value per line)"),
								React.createElement("textarea", {
									className: "dmm_textarea",
									value: draft.headersText,
									placeholder: "Authorization: Bearer …",
									onChange: (e) => patchDraft({ headersText: e.target.value }),
								}),
							),
						),
					React.createElement("label", { className: "dmm_field" },
						React.createElement("span", null, "Enable after save"),
						React.createElement("select", {
							className: "dmm_select",
							value: draft.enabled ? "1" : "0",
							onChange: (e) => patchDraft({ enabled: e.target.value === "1" }),
						},
							React.createElement("option", { value: "1" }, "On"),
							React.createElement("option", { value: "0" }, "Off"),
						),
					),
					React.createElement(
						"div",
						{ className: "dmm_actions" },
						React.createElement(
							"button",
							{ type: "submit", className: "dmm_btn dmm_btnPrimary", disabled: busy },
							draft.id ? "Save" : "Add",
						),
						React.createElement(
							"button",
							{
								type: "button",
								className: "dmm_btn",
								disabled: busy,
								onClick: () => setDraft(null),
							},
							"Cancel",
						),
					),
				),
				React.createElement(
					"div",
					{ className: "dmm_list" },
					servers.length === 0 && !draft
						? React.createElement("div", { className: "dmm_empty" }, "No MCP servers yet. Add one or pick a preset.")
						: servers.map((s) =>
							React.createElement(
								"div",
								{ key: s.id, className: "dmm_row" },
								React.createElement(
									"div",
									{ className: "dmm_rowTop" },
									React.createElement("div", { className: "dmm_title" }, s.label),
									React.createElement(
										"span",
										{ className: `dmm_status dmm_status_${s.status || "stopped"}` },
										s.enabled ? (s.status || "stopped") : "off",
									),
								),
								React.createElement(
									"div",
									{ className: "dmm_meta" },
									`mcp__${s.serverName}__* · ${s.transport}`,
									s.transport === "stdio"
										? ` · ${s.command} ${(s.args || []).join(" ")}`
										: ` · ${s.url}`,
								),
								s.lastError && React.createElement("div", { className: "dmm_err" }, s.lastError),
								React.createElement(
									"div",
									{ className: "dmm_actions" },
									React.createElement(
										"button",
										{
											type: "button",
											className: "dmm_btn",
											disabled: busy || !!draft,
											onClick: () =>
												run(async () => {
													await callRpc(connection, "setEnabled", {
														id: s.id,
														enabled: !s.enabled,
													});
												}),
										},
										s.enabled ? "Turn off" : "Turn on",
									),
									React.createElement(
										"button",
										{
											type: "button",
											className: "dmm_btn",
											disabled: busy || !!draft || !s.enabled,
											onClick: () =>
												run(async () => {
													await callRpc(connection, "restart", { id: s.id });
												}),
										},
										"Restart",
									),
									React.createElement(
										"button",
										{
											type: "button",
											className: "dmm_btn",
											disabled: busy || !!draft,
											onClick: () => setDraft(serverToDraft(s)),
										},
										"Edit",
									),
									React.createElement(
										"button",
										{
											type: "button",
											className: "dmm_btn dmm_btnDanger",
											disabled: busy || !!draft,
											onClick: () => {
												if (!confirm(`Remove MCP server “${s.label}”?`)) return;
												run(async () => {
													await callRpc(connection, "remove", { id: s.id });
												});
											},
										},
										"Delete",
									),
								),
							),
						),
				),
				msg && React.createElement("div", { className: "dmm_meta" }, msg),
				err && React.createElement("div", { className: "dmm_err" }, err),
			);
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			ensureStyles();
			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "mcp",
					order: 188,
					label: () => "MCP",
					inject: () => ({ connection }),
				}, McpSettings), `${PLUGIN}: settings`);
			} catch (err) {
				console.warn(`[${PLUGIN}] settings inject failed`, err);
			}
		}

		return { apply, inject };
	},
});

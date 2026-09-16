// Lite mode: tool profiles under Settings → Agent presets (Lite mode tab).
window.__ModuleLoader__.load({
	id: "dsh-local-agent",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-local-agent";
		const RPC = "/local-agent";
		const TAB_KEY = "dla-agent-presets-tab";

		const css = `
.dla_ap_chrome{display:flex;flex-direction:column;gap:0;width:100%}
.dla_ap_tabs{border-bottom:.5px solid var(--dsw-alias-border-l2);align-items:flex-end;gap:22px;margin:0 0 4px;display:flex}
.dla_ap_tab{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:0;padding:7px 1px 9px;font-size:13px;line-height:20px;position:relative}
.dla_ap_tab:hover,.dla_ap_tab[data-active=true]{color:var(--dsw-alias-label-primary)}
.dla_ap_tab[data-active=true]:after{background:var(--dsw-alias-label-primary);content:"";border-radius:2px 2px 0 0;height:2px;position:absolute;bottom:-1px;left:0;right:0}
.dla_ap_mount{min-width:0;padding-top:8px}
.rtSEdW_section.dla_ap_section[data-dla-tab="lite"] > :not(.dla_ap_chrome){display:none!important}
.dla_lite_section{max-width:720px;color:var(--dsw-alias-label-primary);flex-direction:column;gap:12px;display:flex}
.dla_presetRow{grid-template-columns:repeat(auto-fit,minmax(118px,1fr));gap:10px;margin:0;padding:0;list-style:none;display:grid}
.dla_presetRow > li{min-width:0;display:flex}
.dla_presetChip{box-sizing:border-box;width:100%;appearance:none;font:inherit;text-align:left;cursor:pointer;background:0 0;border:.5px solid var(--dsw-alias-border-l4);border-radius:16px;padding:10px 12px;color:var(--dsw-alias-label-primary);flex-direction:column;flex:1;gap:4px;min-height:0;transition:border-color .16s,background .16s;display:flex}
.dla_presetChip:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}
.dla_presetChip[data-active=true]{background:var(--dsw-alias-bg-module-platform);border-color:var(--dsw-static-neutral-bluish-400)}
.dla_presetChip:disabled{opacity:.55;cursor:default}
.dla_presetChip strong{font-size:13px;font-weight:600;line-height:1.3}
.dla_presetChip span{font-size:11px;line-height:1.35;color:var(--dsw-alias-label-tertiary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dla_catGrid{grid-template-columns:repeat(auto-fill,minmax(248px,1fr));gap:10px;margin:0;padding:0;list-style:none;display:grid}
.dla_catItem{border:.5px solid var(--dsw-alias-border-l4);border-radius:14px;padding:10px 12px;display:flex;gap:8px;align-items:flex-start;font-size:13px;color:var(--dsw-alias-label-primary)}
.dla_catItem input{margin-top:3px;flex:none}
.dla_catItem small{display:block;margin-top:4px;font-size:11px;line-height:1.35;color:var(--dsw-alias-label-tertiary)}
.dla_fieldRow{align-items:center;gap:10px;display:flex;flex-wrap:wrap}
.dla_fieldRow .rtSEdW_input{width:120px;height:36px;padding:6px 10px}
.dla_toggleRow{display:flex;flex-direction:column;gap:8px}
.dla_toggle{align-items:flex-start;gap:8px;display:flex;font-size:13px;line-height:1.45;color:var(--dsw-alias-label-primary)}
.dla_toggle input{margin-top:3px;flex:none}
.dla_actions{align-items:center;gap:12px;display:flex;flex-wrap:wrap;margin-top:4px}
.dla_status{margin:0;font-size:12px;color:var(--dsw-alias-label-tertiary)}
`;

		function injectCss() {
			if (document.getElementById(`${PLUGIN}-css`)) return;
			const tag = document.createElement("style");
			tag.id = `${PLUGIN}-css`;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		async function callRpc(connection, endpoint, payload) {
			const rpc = connection?.rpc;
			if (!rpc?.call) throw new Error("RPC unavailable");
			const res = await rpc.call(RPC, endpoint, payload ?? {});
			if (res?.ok === false) {
				throw new Error(res?.error?.message || "RPC failed");
			}
			return res?.value ?? res;
		}

		const PRESET_BLURBS = {
			lite: "Files + shell only",
			balanced: "+ web, search & agent meta (todo, goals)",
			jetson: "Goals/todo, no cron/browser",
			full: "All tool categories",
			custom: "Per-category toggles",
		};

		const PRESET_LABELS = {
			lite: "Lite",
			balanced: "Balanced",
			jetson: "Jetson",
			full: "Full",
			custom: "Custom",
		};

		function LocalAgentSettings(props) {
			const { connection } = props;
			const [loading, setLoading] = React.useState(true);
			const [saving, setSaving] = React.useState(false);
			const [status, setStatus] = React.useState("");
			const [meta, setMeta] = React.useState({ categoryMeta: [], presets: [] });
			const [cfg, setCfg] = React.useState(null);

			const load = React.useCallback(async () => {
				setLoading(true);
				setStatus("");
				try {
					const data = await callRpc(connection, "getConfig");
					setCfg(data.config);
					setMeta({ categoryMeta: data.categoryMeta || [], presets: data.presets || [] });
				} catch (err) {
					setStatus(err instanceof Error ? err.message : String(err));
				} finally {
					setLoading(false);
				}
			}, [connection]);

			React.useEffect(() => {
				injectCss();
				load();
			}, [load]);

			const setField = (key, value) => {
				setCfg((prev) => (prev ? { ...prev, [key]: value } : prev));
			};

			const setCategory = (id, on) => {
				setCfg((prev) =>
					prev
						? {
								...prev,
								preset: "custom",
								useCustomCategories: true,
								categories: { ...prev.categories, [id]: on },
							}
						: prev,
				);
			};

			const applyPreset = async (preset) => {
				setSaving(true);
				setStatus("");
				try {
					const data = await callRpc(connection, "applyPreset", { preset });
					setCfg(data.config);
					setStatus(`Applied “${preset}”.`);
				} catch (err) {
					setStatus(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};

			const save = async () => {
				if (!cfg) return;
				setSaving(true);
				setStatus("");
				try {
					const data = await callRpc(connection, "setConfig", { config: cfg });
					setCfg(data.config);
					setStatus("Saved — guard/truncation/stub apply on next tool results; tool restrict & early prune on new chats.");
				} catch (err) {
					setStatus(err instanceof Error ? err.message : String(err));
				} finally {
					setSaving(false);
				}
			};

			if (loading || !cfg) {
				return React.createElement(
					"div",
					{ className: "dla_lite_section" },
					React.createElement("p", { className: "rtSEdW_intro" }, loading ? "Loading…" : status || "Failed to load"),
				);
			}

			const cats = cfg.categories || {};
			const customMode = cfg.preset === "custom" || cfg.useCustomCategories;
			const presetList = meta.presets?.length
				? meta.presets
				: ["lite", "balanced", "jetson", "full", "custom"];

			return React.createElement(
				"div",
				{ className: "dla_lite_section" },
				React.createElement("p", { className: "rtSEdW_intro" }, "Trim agent context for local GPUs: disabled categories are removed from each model request (not just blocked at runtime), with optional truncation of large tool output."),
				React.createElement(
					"div",
					{ className: "rtSEdW_group" },
					React.createElement("p", { className: "rtSEdW_groupHead" }, "Profile"),
					React.createElement(
						"ul",
						{ className: "dla_presetRow", role: "list" },
						presetList.map((p) =>
							React.createElement(
								"li",
								{ key: p },
								React.createElement(
									"button",
									{
										type: "button",
										className: "dla_presetChip",
										"data-active": cfg.preset === p ? "true" : undefined,
										disabled: saving,
										onClick: () => applyPreset(p),
									},
									React.createElement("strong", null, PRESET_LABELS[p] || p),
									React.createElement("span", null, PRESET_BLURBS[p] || ""),
								),
							),
						),
					),
				),
				React.createElement(
					"div",
					{ className: "rtSEdW_group" },
					React.createElement("p", { className: "rtSEdW_groupHead" }, "Tool categories"),
					!customMode &&
						React.createElement(
							"p",
							{ className: "rtSEdW_intro", style: { marginBottom: 4 } },
							"Checkboxes follow the profile above. Toggle any category to switch to custom.",
						),
					React.createElement(
						"ul",
						{ className: "dla_catGrid", role: "list" },
						(meta.categoryMeta || []).map((c) =>
							React.createElement(
								"li",
								{ key: c.id },
								React.createElement(
									"label",
									{ className: "dla_catItem" },
									React.createElement("input", {
										type: "checkbox",
										checked: cats[c.id] !== false,
										disabled: !customMode && cfg.preset !== "custom",
										onChange: (e) => setCategory(c.id, e.target.checked),
									}),
									React.createElement(
										"span",
										null,
										c.label,
										React.createElement("small", null, c.hint),
									),
								),
							),
						),
					),
				),
				React.createElement(
					"div",
					{ className: "rtSEdW_group" },
					React.createElement("p", { className: "rtSEdW_groupHead" }, "Context limits"),
					React.createElement(
						"div",
						{ className: "dla_toggleRow" },
						React.createElement(
							"label",
							{ className: "dla_toggle" },
							React.createElement("input", {
								type: "checkbox",
								checked: Boolean(cfg.truncateToolResults),
								onChange: (e) => setField("truncateToolResults", e.target.checked),
							}),
							"Truncate large read / shell / search / browser results before they enter chat history",
						),
						React.createElement(
							"div",
							{ className: "dla_fieldRow" },
							React.createElement("span", { className: "rtSEdW_fieldLabel" }, "Max inline characters"),
							React.createElement("input", {
								type: "number",
								className: "rtSEdW_input",
								min: 2000,
								max: 120000,
								step: 1000,
								value: cfg.maxInlineChars,
								onChange: (e) => setField("maxInlineChars", Number(e.target.value)),
							}),
						),
						React.createElement(
							"label",
							{ className: "dla_toggle" },
							React.createElement("input", {
								type: "checkbox",
								checked: Boolean(cfg.stubToolResults),
								onChange: (e) => setField("stubToolResults", e.target.checked),
							}),
							"Replace large tool results with cache references (full body on host; model sees index + path only)",
						),
						cfg.stubToolResults &&
							React.createElement(
								"div",
								{ className: "dla_fieldRow" },
								React.createElement("span", { className: "rtSEdW_fieldLabel" }, "Stub after (chars)"),
								React.createElement("input", {
									type: "number",
									className: "rtSEdW_input",
									min: 500,
									max: 80000,
									step: 500,
									value: cfg.stubAfterChars,
									onChange: (e) => setField("stubAfterChars", Number(e.target.value)),
								}),
							),
						React.createElement(
							"label",
							{ className: "dla_toggle" },
							React.createElement("input", {
								type: "checkbox",
								checked: Boolean(cfg.earlyPruneToolResults),
								onChange: (e) => setField("earlyPruneToolResults", e.target.checked),
							}),
							"Early prune tool results before each LLM step (stock head/tail pruner, not only at auto-compaction)",
						),
					),
				),
				React.createElement(
					"div",
					{ className: "rtSEdW_group" },
					React.createElement("p", { className: "rtSEdW_groupHead" }, "Local LLM"),
					React.createElement(
						"div",
						{ className: "dla_toggleRow" },
						React.createElement(
							"label",
							{ className: "dla_toggle" },
							React.createElement("input", {
								type: "checkbox",
								checked: Boolean(cfg.patientJetsonStream),
								onChange: (e) => setField("patientJetsonStream", e.target.checked),
							}),
							"Patient stream idle timeout (15 min) for jetson-llamacpp — avoids abort during slow prefill",
						),
						React.createElement(
							"label",
							{ className: "dla_toggle" },
							React.createElement("input", {
								type: "checkbox",
								checked: Boolean(cfg.liteSystemHint),
								onChange: (e) => setField("liteSystemHint", e.target.checked),
							}),
							"Short system hint for local models (included on Lite profile)",
						),
					),
				),
				React.createElement(
					"div",
					{ className: "dla_actions" },
					React.createElement(
						"button",
						{ type: "button", className: "rtSEdW_creatorButton", style: { height: 40, alignSelf: "flex-start", minWidth: 120 }, disabled: saving, onClick: save },
						saving ? "Saving…" : "Save changes",
					),
					status && React.createElement("p", { className: "dla_status" }, status),
				),
			);
		}

		let liteRoot = null;
		let liteMountEl = null;
		let pendingTab = null;

		function readPendingTab() {
			try {
				const v = sessionStorage.getItem(TAB_KEY);
				if (v === "lite" || v === "presets") return v;
			} catch { /* ignore */ }
			return null;
		}

		function setAgentPresetsTab(tab, section) {
			const next = tab === "lite" ? "lite" : "presets";
			try {
				sessionStorage.setItem(TAB_KEY, next);
			} catch { /* ignore */ }
			if (section) applyTabToSection(section, next);
			else pendingTab = next;
		}

		function renderLitePanel(connection, mount) {
			if (!mount) return;
			const RDC = require("react-dom/client");
			if (!liteRoot || liteMountEl !== mount) {
				liteRoot?.unmount?.();
				liteRoot = RDC.createRoot(mount);
				liteMountEl = mount;
			}
			liteRoot.render(React.createElement(LocalAgentSettings, { connection }));
		}

		function applyTabToSection(section, tab) {
			const next = tab === "lite" ? "lite" : "presets";
			section.dataset.dlaTab = next;
			const chrome = section.querySelector(".dla_ap_chrome");
			if (!chrome) return;
			for (const btn of chrome.querySelectorAll(".dla_ap_tab")) {
				btn.dataset.active = btn.dataset.dlaTabTarget === next ? "true" : "false";
			}
			const mount = chrome.querySelector(".dla_ap_mount");
			if (mount) mount.hidden = next !== "lite";
		}

		function ensureAgentPresetsTabs(connection) {
			const panel = document.querySelector('.VOzbGW_panel[role="dialog"], [class*="_panel"][role="dialog"]');
			if (!panel) return;
			const section = panel.querySelector(".rtSEdW_section");
			if (!section || section.dataset.dlaTabs === "1") return;

			section.dataset.dlaTabs = "1";
			section.classList.add("dla_ap_section");

			const chrome = document.createElement("div");
			chrome.className = "dla_ap_chrome";

			const tabs = document.createElement("div");
			tabs.className = "dla_ap_tabs";
			tabs.setAttribute("role", "tablist");

			const mount = document.createElement("div");
			mount.className = "dla_ap_mount";
			mount.hidden = true;

			for (const [id, label] of [
				["presets", "Presets"],
				["lite", "Lite mode"],
			]) {
				const btn = document.createElement("button");
				btn.type = "button";
				btn.className = "dla_ap_tab";
				btn.dataset.dlaTabTarget = id;
				btn.setAttribute("role", "tab");
				btn.textContent = label;
				btn.addEventListener("click", () => {
					setAgentPresetsTab(id, section);
					if (id === "lite") renderLitePanel(connection, mount);
				});
				tabs.appendChild(btn);
			}

			chrome.append(tabs, mount);
			section.insertBefore(chrome, section.firstChild);

			const initial = pendingTab || readPendingTab() || "presets";
			pendingTab = null;
			applyTabToSection(section, initial);
			if (initial === "lite") {
				mount.hidden = false;
				renderLitePanel(connection, mount);
			}
		}

		function teardownAgentPresetsTabs() {
			liteRoot?.unmount?.();
			liteRoot = null;
			liteMountEl = null;
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");

			window.__dshAgentPresetsTab = (tab) => setAgentPresetsTab(tab);

			ctx.effect(() => {
				if (!connection) return;
				injectCss();
				const root = document.getElementById("root") || document.body;
				const mo = new MutationObserver(() => {
					try {
						ensureAgentPresetsTabs(connection);
					} catch (err) {
						console.warn(`[${PLUGIN}] agent presets tabs`, err);
					}
				});
				mo.observe(root, { childList: true, subtree: true });
				ensureAgentPresetsTabs(connection);
				return () => {
					mo.disconnect();
					teardownAgentPresetsTabs();
					if (window.__dshAgentPresetsTab) delete window.__dshAgentPresetsTab;
				};
			}, `${PLUGIN}: agent-presets tab`);
		}

		return { apply, inject };
	},
});

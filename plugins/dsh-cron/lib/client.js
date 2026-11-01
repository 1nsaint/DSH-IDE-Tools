window.__ModuleLoader__.load({
	id: "dsh-cron",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");
		//#region \0dsh-css:/home/insaint/Containers/DSH-IDE-Tools/plugins/dsh-cron/src/client/CronPanel.module.css.mjs
		const css$2 = ".CzXJtG_root{background:var(--dsw-alias-bg-base);height:100%;min-height:0;color:var(--dsw-alias-label-primary);flex-direction:column;flex:1 1 0;display:flex;overflow:hidden;container:CzXJtG_cron/inline-size}.CzXJtG_rootInner{flex-direction:column;flex:1 1 0;height:100%;min-height:0;display:flex;overflow:hidden}.CzXJtG_bar{border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:nowrap;flex:none;align-items:center;gap:6px;min-width:0;padding:6px 12px;display:flex}.CzXJtG_filterMode{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;flex:none;display:inline-flex;overflow:hidden}.CzXJtG_filterBtn{height:30px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;justify-content:center;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:inline-flex}.CzXJtG_filterIcon{flex:none;display:block}.CzXJtG_filterLabel{flex:none}.CzXJtG_filterBtn+.CzXJtG_filterBtn{border-left:1px solid var(--dsw-alias-border-l2)}.CzXJtG_filterBtn:hover{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.CzXJtG_filterBtnActive{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}.CzXJtG_count{font-variant-numeric:tabular-nums;min-width:1.2em;color:var(--dsw-alias-label-tertiary);font-size:10px}.CzXJtG_filterBtnActive .CzXJtG_count{color:inherit;opacity:.85}.CzXJtG_filterBtnCreate{font-weight:500}.CzXJtG_meta{text-overflow:ellipsis;white-space:nowrap;flex:1 1 0;min-width:0;font-size:11px;line-height:1.35;overflow:hidden}.CzXJtG_metaPrimary{color:var(--dsw-alias-label-secondary)}.CzXJtG_metaSep,.CzXJtG_metaHint{color:var(--dsw-alias-label-tertiary)}.CzXJtG_body{-webkit-overflow-scrolling:touch;flex:1 1 0;min-height:0;padding:0;overflow:auto}.CzXJtG_bodyPad{padding:8px 12px 12px}.CzXJtG_btn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:30px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;border-radius:8px;flex:none;justify-content:center;align-items:center;gap:6px;padding:0 10px;font-size:12px;display:inline-flex}.CzXJtG_btn:disabled{opacity:.5;cursor:default}.CzXJtG_btnPrimary{color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);background:0 0;border-width:2px}.CzXJtG_btnPrimary:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)}.CzXJtG_btnDanger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}.CzXJtG_btnDanger:hover:not(:disabled){background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 12%, transparent)}.CzXJtG_sectionTitle{color:var(--dsw-alias-label-primary);margin:0 0 8px;font-size:13px;font-weight:600;line-height:1.35}.CzXJtG_error,.CzXJtG_notice{border-bottom:1px solid var(--dsw-alias-border-l2);flex:none;margin:0;padding:8px 14px;font-size:12px;line-height:1.4}.CzXJtG_error{color:var(--dsw-alias-state-error-primary);background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 10%, var(--dsw-alias-bg-layer-1))}.CzXJtG_notice{color:var(--dsw-alias-label-secondary);background:var(--dsw-alias-bg-layer-1)}.CzXJtG_jobList{flex-direction:column;gap:4px;padding:8px;display:flex}.CzXJtG_job{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;overflow:hidden}.CzXJtG_job:hover{border-color:color-mix(in srgb, var(--dsw-alias-border-l1) 80%, var(--dsw-alias-border-l2))}.CzXJtG_jobMain{width:100%;min-height:56px;color:inherit;font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;grid-template-columns:28px minmax(0,1fr) auto 24px;align-items:center;gap:8px;padding:8px 10px;display:grid}.CzXJtG_statusIcon{background:var(--dsw-alias-interactive-bg-hover);width:26px;height:26px;color:var(--dsw-alias-label-secondary);border-radius:8px;justify-content:center;align-items:center;display:inline-flex}.CzXJtG_statusIcon.CzXJtG_active{color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)}.CzXJtG_statusIcon.CzXJtG_done{color:var(--dsw-alias-state-success-primary)}.CzXJtG_jobText{flex-direction:column;gap:2px;min-width:0;display:flex}.CzXJtG_jobText strong,.CzXJtG_jobText>span{text-overflow:ellipsis;white-space:nowrap;overflow:hidden}.CzXJtG_jobText strong{font-size:13px;font-weight:500;line-height:1.35}.CzXJtG_jobText>span,.CzXJtG_jobNext{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.35;font-family:var(--ds-font-family-code)}.CzXJtG_jobNext{text-align:right;max-width:160px;font-family:inherit}.CzXJtG_statusPill{background:var(--dsw-alias-interactive-bg-hover);max-width:none;color:var(--dsw-alias-label-secondary);white-space:nowrap;border-radius:999px;padding:2px 8px;font-size:10px;line-height:16px}.CzXJtG_disclosure{width:24px;height:24px;color:var(--dsw-alias-label-tertiary);border-radius:6px;justify-content:center;align-items:center;transition:transform .16s;display:inline-flex}.CzXJtG_jobMain:hover .CzXJtG_disclosure{color:var(--dsw-alias-label-primary);background:var(--dsw-alias-interactive-bg-hover)}.CzXJtG_disclosureOpen{transform:rotate(180deg)}.CzXJtG_details{border-top:1px solid var(--dsw-alias-border-l2);padding:0 10px 10px 44px}.CzXJtG_details dl{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;margin:10px 0;display:grid}.CzXJtG_details dt{color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.03em;font-size:10px;line-height:1.3}.CzXJtG_details dd{color:var(--dsw-alias-label-secondary);font-size:11px;line-height:1.35;font-family:var(--ds-font-family-code);text-overflow:ellipsis;white-space:nowrap;margin:2px 0 0;overflow:hidden}.CzXJtG_excerpt{background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);white-space:pre-wrap;font-size:11px;line-height:1.45;font-family:var(--ds-font-family-code);border-radius:8px;margin-bottom:10px;padding:8px 10px}.CzXJtG_jobActions,.CzXJtG_formActions,.CzXJtG_confirm{flex-wrap:wrap;justify-content:flex-end;align-items:center;gap:6px;display:flex}.CzXJtG_dangerLink,.CzXJtG_linkButton{font:inherit;cursor:pointer;background:0 0;border:none;padding:2px 6px;font-size:11px}.CzXJtG_dangerLink{color:var(--dsw-alias-state-error-primary);margin-left:auto}.CzXJtG_linkButton{color:var(--dsw-alias-label-secondary)}.CzXJtG_confirm{color:var(--dsw-alias-label-secondary);margin-left:auto;font-size:11px}.CzXJtG_form{flex-direction:column;gap:12px;max-width:640px;display:flex}.CzXJtG_formWide{grid-template-columns:minmax(0,1.25fr) minmax(300px,440px);align-items:start;gap:16px 24px;max-width:none;display:grid}.CzXJtG_formStack{flex-direction:column;gap:14px;width:100%;max-width:none;display:flex}.CzXJtG_formStack .CzXJtG_formSchedule{justify-self:stretch;width:100%;max-width:none}.CzXJtG_formStack .CzXJtG_fieldGrid{grid-template-columns:repeat(2,minmax(0,1fr))}.CzXJtG_formStack .CzXJtG_formActions{border-top:1px solid var(--dsw-alias-border-l2);margin-top:4px;padding-top:4px}.CzXJtG_formSpan{grid-column:1/-1}.CzXJtG_formMain{flex-direction:column;gap:12px;min-width:0;display:flex}.CzXJtG_formSchedule{justify-self:stretch;width:100%;min-width:0;max-width:440px}.CzXJtG_formSchedule>*{max-height:none}.CzXJtG_field,.CzXJtG_fieldset{border:none;flex-direction:column;gap:6px;min-width:0;margin:0;padding:0;display:flex}.CzXJtG_field>span,.CzXJtG_fieldset legend{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500;line-height:1.35}.CzXJtG_field textarea,.CzXJtG_field input,.CzXJtG_field select{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;outline:none;font-size:12px}.CzXJtG_field textarea{resize:vertical;padding:8px 10px}.CzXJtG_field input,.CzXJtG_field select{height:30px;padding:0 10px}.CzXJtG_field textarea:focus,.CzXJtG_field input:focus,.CzXJtG_field select:focus{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent)}.CzXJtG_field small{color:var(--dsw-alias-label-tertiary);font-size:11px;line-height:1.35}.CzXJtG_fieldGrid{grid-template-columns:1.25fr 1fr;gap:12px;display:grid}.CzXJtG_segmented{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;align-self:flex-start;padding:2px;display:inline-flex}.CzXJtG_segmented button{min-width:96px;height:28px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:6px;padding:0 10px;font-size:12px}.CzXJtG_segmented .CzXJtG_segmentActive{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-state-business-primary)}.CzXJtG_formActions{flex-wrap:wrap;align-items:center;gap:8px;padding-top:4px;display:flex}.CzXJtG_spacer{flex:8px;min-width:8px}.CzXJtG_empty{color:var(--dsw-alias-label-tertiary);max-width:42em;padding:12px 14px;font-size:13px;line-height:1.45}.CzXJtG_emptyIcon{display:none}@container CzXJtG_cron (width<=900px){.CzXJtG_bar{flex-wrap:wrap;gap:6px;padding:6px 8px}.CzXJtG_filterMode{order:1;width:100%;display:flex;overflow:hidden}.CzXJtG_filterBtn{flex:1 1 0;gap:3px;min-width:0;height:34px;padding:0 4px}.CzXJtG_filterLabel{display:none}.CzXJtG_count{min-width:0;font-size:9px}.CzXJtG_meta{white-space:normal}.CzXJtG_metaHint{display:none}.CzXJtG_fieldGrid,.CzXJtG_details dl,.CzXJtG_formWide,.CzXJtG_formStack .CzXJtG_fieldGrid{grid-template-columns:1fr}.CzXJtG_formSchedule{justify-self:stretch;max-width:none}.CzXJtG_jobNext{display:none}.CzXJtG_jobNext.CzXJtG_statusPill{display:inline-block}}";
		const tagId$2 = "dsh-cron/CronPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cron";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var CronPanel_module_css_default = {
			"rootInner": "CzXJtG_rootInner",
			"filterBtn": "CzXJtG_filterBtn",
			"btnDanger": "CzXJtG_btnDanger",
			"body": "CzXJtG_body",
			"disclosure": "CzXJtG_disclosure",
			"formStack": "CzXJtG_formStack",
			"filterBtnActive": "CzXJtG_filterBtnActive",
			"error": "CzXJtG_error",
			"filterLabel": "CzXJtG_filterLabel",
			"metaHint": "CzXJtG_metaHint",
			"jobMain": "CzXJtG_jobMain",
			"btn": "CzXJtG_btn",
			"notice": "CzXJtG_notice",
			"done": "CzXJtG_done",
			"jobActions": "CzXJtG_jobActions",
			"root": "CzXJtG_root",
			"jobNext": "CzXJtG_jobNext",
			"meta": "CzXJtG_meta",
			"confirm": "CzXJtG_confirm",
			"bar": "CzXJtG_bar",
			"jobList": "CzXJtG_jobList",
			"metaSep": "CzXJtG_metaSep",
			"formActions": "CzXJtG_formActions",
			"filterBtnCreate": "CzXJtG_filterBtnCreate",
			"filterMode": "CzXJtG_filterMode",
			"linkButton": "CzXJtG_linkButton",
			"form": "CzXJtG_form",
			"formWide": "CzXJtG_formWide",
			"formSchedule": "CzXJtG_formSchedule",
			"formMain": "CzXJtG_formMain",
			"field": "CzXJtG_field",
			"fieldset": "CzXJtG_fieldset",
			"fieldGrid": "CzXJtG_fieldGrid",
			"segmentActive": "CzXJtG_segmentActive",
			"statusPill": "CzXJtG_statusPill",
			"details": "CzXJtG_details",
			"jobText": "CzXJtG_jobText",
			"formSpan": "CzXJtG_formSpan",
			"empty": "CzXJtG_empty",
			"emptyIcon": "CzXJtG_emptyIcon",
			"bodyPad": "CzXJtG_bodyPad",
			"sectionTitle": "CzXJtG_sectionTitle",
			"filterIcon": "CzXJtG_filterIcon",
			"active": "CzXJtG_active",
			"btnPrimary": "CzXJtG_btnPrimary",
			"excerpt": "CzXJtG_excerpt",
			"disclosureOpen": "CzXJtG_disclosureOpen",
			"segmented": "CzXJtG_segmented",
			"spacer": "CzXJtG_spacer",
			"dangerLink": "CzXJtG_dangerLink",
			"statusIcon": "CzXJtG_statusIcon",
			"job": "CzXJtG_job",
			"metaPrimary": "CzXJtG_metaPrimary",
			"count": "CzXJtG_count",
			"cron": "CzXJtG_cron"
		};
		//#endregion
		//#region src/client/icons.tsx
		/** Filled folder (sidebar workspace glyph style). */
		const IconFolderFilled16 = ({ size = 16, className, color }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			"aria-hidden": true,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				fillRule: "evenodd",
				clipRule: "evenodd",
				d: "M1.75 4.25C1.75 3.42 2.42 2.75 3.25 2.75H6.04C6.31 2.75 6.57 2.86 6.76 3.06L7.94 4.25H12.75C13.58 4.25 14.25 4.92 14.25 5.75V11.75C14.25 12.58 13.58 13.25 12.75 13.25H3.25C2.42 13.25 1.75 12.58 1.75 11.75V4.25ZM3.25 4.25H6.04L7.22 5.44H12.75V11.75H3.25V4.25Z",
				fill: color ?? "currentColor"
			})
		});
		/** ic_ds_clock_outline_16: ring + 10:10 rounded hands (design-system style). */
		const IconClockOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					fillRule: "evenodd",
					clipRule: "evenodd",
					d: "M8 0.45C12.17 0.45 15.55 3.83 15.55 8C15.55 12.17 12.17 15.55 8 15.55C3.83 15.55 0.45 12.17 0.45 8C0.45 3.83 3.83 0.45 8 0.45ZM8 1.95C4.65817 1.95 1.95 4.65817 1.95 8C1.95 11.3418 4.65817 14.05 8 14.05C11.3418 14.05 14.05 11.3418 14.05 8C14.05 4.65817 11.3418 1.95 8 1.95Z",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "7.6",
					y: "7.6",
					width: "4.7",
					height: "0.8",
					rx: "0.4",
					transform: "rotate(-30 8 8)",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("rect", {
					x: "7.6",
					y: "7.6",
					width: "3.3",
					height: "0.8",
					rx: "0.4",
					transform: "rotate(-145 8 8)",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("circle", {
					cx: "8",
					cy: "8",
					r: "0.75",
					fill: "currentColor"
				})
			]
		});
		/** ic_ds_pause_outline_16 (mirrors @deepseek-ai/dsh-client-ui-primitives). */
		const IconPauseOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M14.1448 8.00024C14.1448 4.60644 11.394 1.85563 8.00024 1.85563C4.60644 1.85563 1.85563 4.60644 1.85563 8.00024C1.85563 11.394 4.60644 14.1448 8.00024 14.1448C11.394 14.1448 14.1448 11.394 14.1448 8.00024ZM15.5112 8.00024C15.5112 12.1482 12.1482 15.5112 8.00024 15.5112C3.85226 15.5112 0.489258 12.1482 0.489258 8.00024C0.489258 3.85226 3.85226 0.489258 8.00024 0.489258C12.1482 0.489258 15.5112 3.85226 15.5112 8.00024Z",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M7.14244 5.14258V10.8569H5.71387V5.14258H7.14244Z",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M10.286 5.14258V10.8569H8.85742V5.14258H10.286Z",
					fill: "currentColor"
				})
			]
		});
		/** ic_ds_check_outline_14 (mirrors @deepseek-ai/dsh-client-ui-primitives). */
		const IconCheckOutline14 = ({ size = 14, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 14 14",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M11.5635 4.58984L7.61426 9.07715C7.35154 9.37561 7.11346 9.64812 6.89453 9.84668C6.66593 10.054 6.38519 10.2506 6.01465 10.3164C5.82079 10.3508 5.62207 10.3529 5.42773 10.3213C5.0561 10.2609 4.77266 10.0674 4.54102 9.86328C4.31926 9.66791 4.07752 9.39911 3.81055 9.10449L2.44531 7.59863L3.55664 6.59082L4.92188 8.09766C5.21256 8.41844 5.38878 8.61191 5.53223 8.73828C5.61022 8.80699 5.65253 8.83192 5.66895 8.83984C5.69648 8.84429 5.72449 8.84467 5.75195 8.83984C5.72657 8.84451 5.75564 8.85422 5.88672 8.73535C6.02833 8.60692 6.20225 8.41088 6.48828 8.08594L10.4385 3.59961L11.5635 4.58984Z",
				fill: "currentColor"
			})
		});
		/** Compact list glyph for "all tasks". */
		const IconListOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			"aria-hidden": true,
			children: [
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.25 4.25h9.5a.75.75 0 0 0 0-1.5H3.25a.75.75 0 0 0 0 1.5Z",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.25 8.75h9.5a.75.75 0 0 0 0-1.5H3.25a.75.75 0 0 0 0 1.5Z",
					fill: "currentColor"
				}),
				/* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
					d: "M3.25 13.25h9.5a.75.75 0 0 0 0-1.5H3.25a.75.75 0 0 0 0 1.5Z",
					fill: "currentColor"
				})
			]
		});
		/** Compact plus glyph for the create action. */
		const IconPlusOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			"aria-hidden": true,
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M8 2.25a.75.75 0 0 1 .75.75v4.25H13a.75.75 0 0 1 0 1.5H8.75V13a.75.75 0 0 1-1.5 0V8.75H3a.75.75 0 0 1 0-1.5h4.25V3A.75.75 0 0 1 8 2.25Z",
				fill: "currentColor"
			})
		});
		/** Compact disclosure chevron for expandable task rows. */
		const IconChevronDownOutline16 = ({ size = 16, className }) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("svg", {
			width: size,
			height: size,
			className,
			viewBox: "0 0 16 16",
			fill: "none",
			xmlns: "http://www.w3.org/2000/svg",
			children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("path", {
				d: "M3.75 6 8 10.25 12.25 6",
				stroke: "currentColor",
				strokeWidth: "1.4",
				strokeLinecap: "round",
				strokeLinejoin: "round"
			})
		});
		//#endregion
		//#region src/client/rpc.ts
		const CRON_RPC_CHANNEL = "/cron";
		/** Call one `/cron` endpoint; non-ok results throw with the error message. */
		async function callRpc(connection, endpoint, payload, signal) {
			const result = await connection.rpc.call(CRON_RPC_CHANNEL, endpoint, payload ?? {}, signal);
			if (!result.ok) throw new Error(`dsh-cron RPC ${endpoint} failed: ${result.error.message}`);
			return result.value;
		}
		//#endregion
		//#region \0dsh-css:/home/insaint/Containers/DSH-IDE-Tools/plugins/dsh-cron/src/client/schedule-picker.module.css.mjs
		const css$1 = ".M_Ug7q_panel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);border-radius:10px;flex-direction:column;gap:12px;min-width:0;padding:16px 18px;display:flex}.M_Ug7q_fieldset{border:none;flex-direction:column;gap:8px;margin:0;padding:0;display:flex}.M_Ug7q_fieldset legend{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}.M_Ug7q_segmented{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);border-radius:8px;align-self:flex-start;padding:2px;display:inline-flex}.M_Ug7q_segmented button{min-width:96px;height:28px;color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;border-radius:6px;padding:0 12px;font-size:12px}.M_Ug7q_segmented button.M_Ug7q_segmentActive{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);color:var(--dsw-alias-state-business-primary);font-weight:600}.M_Ug7q_onceGrid{grid-template-columns:minmax(0,1fr) minmax(128px,148px);align-items:start;gap:14px 16px;display:grid}.M_Ug7q_calendar{min-width:0}.M_Ug7q_calHead{justify-content:space-between;align-items:center;gap:8px;margin-bottom:8px;display:flex}.M_Ug7q_calTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600}.M_Ug7q_calNav{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:28px;height:28px;color:var(--dsw-alias-label-primary);cursor:pointer;border-radius:8px;font-size:16px;line-height:1}.M_Ug7q_calNav:hover{background:var(--dsw-alias-interactive-bg-hover)}.M_Ug7q_calWeekdays{grid-template-columns:repeat(7,1fr);gap:2px;margin-bottom:4px;display:grid}.M_Ug7q_calWeekday{text-align:center;color:var(--dsw-alias-label-tertiary);text-transform:uppercase;letter-spacing:.04em;font-size:10px;font-weight:500}.M_Ug7q_calGrid{grid-template-columns:repeat(7,1fr);gap:2px;display:grid}.M_Ug7q_calDay{height:32px;min-height:32px;color:var(--dsw-alias-label-primary);font:inherit;cursor:pointer;background:0 0;border:1px solid #0000;border-radius:7px;font-size:12px}.M_Ug7q_calDay:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}.M_Ug7q_calDaySelected{border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 14%, transparent);color:var(--dsw-alias-state-business-primary);font-weight:600}.M_Ug7q_calDaySelected:not(:disabled):hover{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)}.M_Ug7q_calDayMuted{color:var(--dsw-alias-label-tertiary);opacity:.45;cursor:default}.M_Ug7q_onceSide{flex-direction:column;gap:12px;padding-left:4px;display:flex}.M_Ug7q_timeRow{flex-direction:column;gap:6px;display:flex}.M_Ug7q_timeLabel{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}.M_Ug7q_timeInputs{align-items:center;gap:8px;padding-top:2px;display:flex}.M_Ug7q_timeSelect{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);min-width:68px;height:34px;color:var(--dsw-alias-label-primary);font:inherit;font-variant-numeric:tabular-nums;border-radius:8px;padding:0 10px;font-size:14px}.M_Ug7q_timeSep{color:var(--dsw-alias-label-tertiary);font-size:16px;font-weight:600}.M_Ug7q_hint{color:var(--dsw-alias-label-tertiary);margin:0;font-size:11px;line-height:1.4}.M_Ug7q_dowRow{flex-direction:column;gap:8px;display:flex}.M_Ug7q_dowPresets{flex-wrap:wrap;gap:6px;display:flex}.M_Ug7q_presetBtn{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:26px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:999px;padding:0 10px;font-size:11px}.M_Ug7q_presetBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.M_Ug7q_dowChips{grid-template-columns:repeat(7,minmax(0,1fr));gap:6px;display:grid}.M_Ug7q_dowChip{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);height:30px;color:var(--dsw-alias-label-secondary);font:inherit;cursor:pointer;border-radius:8px;font-size:11px;font-weight:600}.M_Ug7q_dowChipOn{border-color:var(--dsw-alias-state-business-primary);background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);color:var(--dsw-alias-state-business-primary)}.M_Ug7q_tzField{flex-direction:column;gap:6px;min-width:0;display:flex}.M_Ug7q_tzField>span{color:var(--dsw-alias-label-secondary);font-size:12px;font-weight:500}.M_Ug7q_tzField input,.M_Ug7q_tzField select,.M_Ug7q_tzSelect{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;max-width:420px;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 10px;font-size:12px}.M_Ug7q_tzSelect{max-width:100%}.M_Ug7q_patternSelect{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);width:100%;max-width:320px;height:32px;color:var(--dsw-alias-label-primary);font:inherit;border-radius:8px;padding:0 10px;font-size:12px}.M_Ug7q_tzField small{color:var(--dsw-alias-label-tertiary);font-size:11px}.M_Ug7q_advancedToggle{color:var(--dsw-alias-label-tertiary);font:inherit;cursor:pointer;background:0 0;border:none;align-self:flex-start;padding:0;font-size:11px;text-decoration:underline}.M_Ug7q_advancedToggle:hover{color:var(--dsw-alias-label-secondary)}@container (width<=900px){.M_Ug7q_onceGrid{grid-template-columns:1fr}.M_Ug7q_onceSide{flex-flow:wrap;align-items:flex-start;gap:12px 16px;padding-left:0}.M_Ug7q_timeRow{flex:none}.M_Ug7q_hint{flex:160px;align-self:center;min-width:140px}.M_Ug7q_tzField{flex:180px;min-width:160px}.M_Ug7q_tzField select,.M_Ug7q_tzField input{max-width:none}}@media (width<=900px){.M_Ug7q_onceGrid{grid-template-columns:1fr}.M_Ug7q_onceSide{flex-flow:wrap;align-items:flex-start;gap:12px 16px;padding-left:0}.M_Ug7q_timeRow{flex:none}.M_Ug7q_hint{flex:160px;align-self:center;min-width:140px}.M_Ug7q_tzField{flex:180px;min-width:160px}.M_Ug7q_tzField select,.M_Ug7q_tzField input{max-width:none}}";
		const tagId$1 = "dsh-cron/schedule-picker.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cron";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var schedule_picker_module_css_default = {
			"timeRow": "M_Ug7q_timeRow",
			"calDayMuted": "M_Ug7q_calDayMuted",
			"calTitle": "M_Ug7q_calTitle",
			"dowChip": "M_Ug7q_dowChip",
			"timeLabel": "M_Ug7q_timeLabel",
			"timeSelect": "M_Ug7q_timeSelect",
			"tzField": "M_Ug7q_tzField",
			"presetBtn": "M_Ug7q_presetBtn",
			"onceSide": "M_Ug7q_onceSide",
			"dowChips": "M_Ug7q_dowChips",
			"calNav": "M_Ug7q_calNav",
			"calHead": "M_Ug7q_calHead",
			"panel": "M_Ug7q_panel",
			"calWeekdays": "M_Ug7q_calWeekdays",
			"calGrid": "M_Ug7q_calGrid",
			"segmentActive": "M_Ug7q_segmentActive",
			"calWeekday": "M_Ug7q_calWeekday",
			"dowChipOn": "M_Ug7q_dowChipOn",
			"timeSep": "M_Ug7q_timeSep",
			"onceGrid": "M_Ug7q_onceGrid",
			"dowRow": "M_Ug7q_dowRow",
			"patternSelect": "M_Ug7q_patternSelect",
			"calDay": "M_Ug7q_calDay",
			"advancedToggle": "M_Ug7q_advancedToggle",
			"calDaySelected": "M_Ug7q_calDaySelected",
			"timeInputs": "M_Ug7q_timeInputs",
			"hint": "M_Ug7q_hint",
			"calendar": "M_Ug7q_calendar",
			"tzSelect": "M_Ug7q_tzSelect",
			"dowPresets": "M_Ug7q_dowPresets",
			"segmented": "M_Ug7q_segmented",
			"fieldset": "M_Ug7q_fieldset"
		};
		//#endregion
		//#region src/client/timezones.ts
		/**
		* Curated IANA time zones for the schedule picker (24 common choices).
		* @module
		*/
		const ZONES_24 = [
			"UTC",
			"Europe/London",
			"Europe/Amsterdam",
			"Europe/Berlin",
			"Europe/Paris",
			"Europe/Rome",
			"Europe/Stockholm",
			"Europe/Athens",
			"Europe/Istanbul",
			"Africa/Johannesburg",
			"Asia/Dubai",
			"Asia/Kolkata",
			"Asia/Bangkok",
			"Asia/Singapore",
			"Asia/Shanghai",
			"Asia/Tokyo",
			"Asia/Seoul",
			"Australia/Sydney",
			"Pacific/Auckland",
			"America/Sao_Paulo",
			"America/New_York",
			"America/Chicago",
			"America/Denver",
			"America/Los_Angeles"
		];
		function listIanaTimeZones() {
			return ZONES_24;
		}
		function isValidIanaTimeZone(timeZone) {
			if (!timeZone.trim()) return false;
			try {
				Intl.DateTimeFormat("en-US", { timeZone: timeZone.trim() });
				return true;
			} catch {
				return false;
			}
		}
		/** Pick a value that works in the zone list (keeps custom valid zones as extra option). */
		function resolveTimeZoneChoice(value, zones) {
			const trimmed = value.trim();
			if (trimmed && zones.includes(trimmed)) return trimmed;
			if (trimmed && isValidIanaTimeZone(trimmed)) return trimmed;
			const local = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "";
			if (local && zones.includes(local)) return local;
			if (local && isValidIanaTimeZone(local)) return local;
			return "UTC";
		}
		//#endregion
		//#region src/client/TimezoneSelect.tsx
		/**
		* IANA time zone dropdown for scheduled tasks.
		* @module
		*/
		function TimezoneSelect({ value, label, hint, onChange }) {
			const zones = (0, react.useMemo)(() => listIanaTimeZones(), []);
			const selected = (0, react.useMemo)(() => resolveTimeZoneChoice(value, zones), [value, zones]);
			const showCustom = Boolean(value.trim()) && !zones.includes(value.trim()) && value.trim() !== selected;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
				className: schedule_picker_module_css_default.tzField,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: label }),
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
						className: schedule_picker_module_css_default.tzSelect,
						value: showCustom ? value.trim() : selected,
						onChange: (e) => {
							onChange(e.target.value);
						},
						children: [showCustom ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: value.trim(),
							children: value.trim()
						}) : null, zones.map((zone) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: zone,
							children: zone
						}, zone))]
					}),
					hint ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: hint }) : null
				]
			});
		}
		//#endregion
		//#region src/client/schedule-picker.tsx
		/**
		* Schedule builder: one-time calendar, or recurring presets (hourly / interval / daily / weekly / monthly).
		* @module
		*/
		const DOW_VALUES = [
			0,
			1,
			2,
			3,
			4,
			5,
			6
		];
		const INTERVAL_HOURS = [
			1,
			2,
			3,
			4,
			6,
			8,
			12
		];
		function pad2$1(n) {
			return String(n).padStart(2, "0");
		}
		function dateKey(d) {
			return `${d.getFullYear()}-${pad2$1(d.getMonth() + 1)}-${pad2$1(d.getDate())}`;
		}
		function parseAtLocal(at) {
			if (!at) {
				const d = /* @__PURE__ */ new Date();
				d.setMinutes(d.getMinutes() + 30, 0, 0);
				return {
					date: dateKey(d),
					hour: d.getHours(),
					minute: d.getMinutes()
				};
			}
			const d = new Date(at);
			if (Number.isNaN(d.getTime())) return {
				date: dateKey(/* @__PURE__ */ new Date()),
				hour: 9,
				minute: 0
			};
			return {
				date: dateKey(d),
				hour: d.getHours(),
				minute: d.getMinutes()
			};
		}
		function combineAtLocal(date, hour, minute) {
			return `${date}T${pad2$1(hour)}:${pad2$1(minute)}`;
		}
		function defaultAtLocal() {
			const { date, hour, minute } = parseAtLocal("");
			return combineAtLocal(date, hour, minute);
		}
		function parseIntField(value, fallback) {
			const n = Number.parseInt(value ?? "", 10);
			return Number.isFinite(n) ? n : fallback;
		}
		function parseRecurringCron(expr) {
			const parts = expr.trim().split(/\s+/);
			if (parts.length < 5) return {
				pattern: "daily",
				minute: 0,
				hour: 9,
				intervalHours: 6,
				daysOfWeek: null,
				dayOfMonth: 1
			};
			const minute = parseIntField(parts[0], 0);
			const hourField = parts[1] ?? "9";
			const dom = parts[2] ?? "*";
			const month = parts[3] ?? "*";
			const dowField = parts[4] ?? "*";
			if (hourField.startsWith("*/")) return {
				pattern: "interval",
				minute,
				hour: 0,
				intervalHours: parseIntField(hourField.slice(2), 6),
				daysOfWeek: null,
				dayOfMonth: 1
			};
			if (hourField === "*" && dom === "*" && month === "*" && dowField === "*") return {
				pattern: "hourly",
				minute,
				hour: 0,
				intervalHours: 1,
				daysOfWeek: null,
				dayOfMonth: 1
			};
			if (dom !== "*" && month === "*" && dowField === "*") return {
				pattern: "monthly",
				minute,
				hour: parseIntField(hourField, 9),
				intervalHours: 6,
				daysOfWeek: null,
				dayOfMonth: Math.min(31, Math.max(1, parseIntField(dom, 1)))
			};
			if (dom === "*" && month === "*" && dowField !== "*") {
				const days = /* @__PURE__ */ new Set();
				for (const chunk of dowField.split(",")) if (chunk.includes("-")) {
					const [aStr, bStr] = chunk.split("-");
					const a = parseIntField(aStr, 0);
					const b = parseIntField(bStr, 0);
					for (let i = a; i <= b; i += 1) days.add(i);
				} else {
					const v = parseIntField(chunk, -1);
					if (v >= 0) days.add(v);
				}
				return {
					pattern: "weekly",
					minute,
					hour: parseIntField(hourField, 9),
					intervalHours: 6,
					daysOfWeek: days.size ? days : /* @__PURE__ */ new Set([
						1,
						2,
						3,
						4,
						5
					]),
					dayOfMonth: 1
				};
			}
			if (dom === "*" && month === "*" && dowField === "*") return {
				pattern: "daily",
				minute,
				hour: parseIntField(hourField, 9),
				intervalHours: 6,
				daysOfWeek: null,
				dayOfMonth: 1
			};
			return {
				pattern: "custom",
				minute,
				hour: parseIntField(hourField, 9),
				intervalHours: 6,
				daysOfWeek: null,
				dayOfMonth: 1
			};
		}
		function buildRecurringCron(state) {
			const m = Number.isFinite(state.minute) ? state.minute : 0;
			switch (state.pattern) {
				case "hourly": return `${m} * * * *`;
				case "interval": return `${m} */${Math.min(24, Math.max(1, state.intervalHours))} * * *`;
				case "daily": return `${m} ${state.hour} * * *`;
				case "weekly": {
					const days = state.daysOfWeek && state.daysOfWeek.size > 0 ? [...state.daysOfWeek].sort((a, b) => a - b).join(",") : "1,2,3,4,5";
					return `${m} ${state.hour} * * ${days}`;
				}
				case "monthly": return `${m} ${state.hour} ${Math.min(31, Math.max(1, state.dayOfMonth))} * *`;
				default: return `${m} ${state.hour} * * *`;
			}
		}
		function weekdayLabels() {
			const base = new Date(2024, 0, 7);
			return DOW_VALUES.map((_, i) => {
				const d = new Date(base);
				d.setDate(base.getDate() + i);
				return new Intl.DateTimeFormat(void 0, { weekday: "short" }).format(d);
			});
		}
		function monthMatrix(view) {
			const year = view.getFullYear();
			const month = view.getMonth();
			const first = new Date(year, month, 1);
			const start = new Date(first);
			start.setDate(first.getDate() - first.getDay());
			const rows = [];
			const cursor = new Date(start);
			for (let r = 0; r < 6; r += 1) {
				const row = [];
				for (let c = 0; c < 7; c += 1) {
					row.push({
						date: new Date(cursor),
						inMonth: cursor.getMonth() === month
					});
					cursor.setDate(cursor.getDate() + 1);
				}
				rows.push(row);
			}
			return rows;
		}
		function TimeRow(props) {
			const hours = (0, react.useMemo)(() => Array.from({ length: 24 }, (_, i) => i), []);
			const minutes = (0, react.useMemo)(() => Array.from({ length: 12 }, (_, i) => i * 5), []);
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: schedule_picker_module_css_default.timeRow,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
					className: schedule_picker_module_css_default.timeLabel,
					children: props.label
				}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: schedule_picker_module_css_default.timeInputs,
					children: [!props.minuteOnly && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: schedule_picker_module_css_default.timeSelect,
						value: props.hour,
						"aria-label": "Hour",
						onChange: (e) => {
							props.onHour(Number.parseInt(e.target.value, 10));
						},
						children: hours.map((h) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: h,
							children: pad2$1(h)
						}, h))
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: schedule_picker_module_css_default.timeSep,
						children: ":"
					})] }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
						className: schedule_picker_module_css_default.timeSelect,
						value: props.minute - props.minute % 5,
						"aria-label": "Minute",
						onChange: (e) => {
							props.onMinute(Number.parseInt(e.target.value, 10));
						},
						children: minutes.map((mv) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
							value: mv,
							children: pad2$1(mv)
						}, mv))
					})]
				})]
			});
		}
		function SchedulePicker(props) {
			const { kind, cron, timeZone, at, onKindChange, onChange, t } = props;
			const recurring = (0, react.useMemo)(() => parseRecurringCron(cron), [cron]);
			const parsedAt = (0, react.useMemo)(() => parseAtLocal(at), [at]);
			const [monthView, setMonthView] = (0, react.useState)(() => {
				const d = /* @__PURE__ */ new Date(`${parsedAt.date}T12:00:00`);
				return Number.isNaN(d.getTime()) ? /* @__PURE__ */ new Date() : d;
			});
			const [showAdvancedCron, setShowAdvancedCron] = (0, react.useState)(() => recurring.pattern === "custom");
			const weekdays = (0, react.useMemo)(() => weekdayLabels(), []);
			const matrix = (0, react.useMemo)(() => monthMatrix(monthView), [monthView]);
			const patchRecurring = (patch) => {
				const next = {
					...recurring,
					...patch
				};
				if (patch.pattern && patch.pattern !== "custom") {
					onChange({ cron: buildRecurringCron(next) });
					return;
				}
				onChange({ cron: buildRecurringCron(next) });
			};
			const setAtParts = (date, hour, minute) => {
				onChange({ at: combineAtLocal(date, hour, minute) });
			};
			const monthTitle = new Intl.DateTimeFormat(void 0, {
				month: "long",
				year: "numeric"
			}).format(monthView);
			const toggleDay = (dow) => {
				const base = recurring.daysOfWeek ?? /* @__PURE__ */ new Set([
					1,
					2,
					3,
					4,
					5
				]);
				const next = new Set(base);
				if (next.has(dow)) next.delete(dow);
				else next.add(dow);
				patchRecurring({
					pattern: "weekly",
					daysOfWeek: next.size ? next : /* @__PURE__ */ new Set([dow])
				});
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: schedule_picker_module_css_default.panel,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("fieldset", {
					className: schedule_picker_module_css_default.fieldset,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("legend", { children: t("fieldScheduleType") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: schedule_picker_module_css_default.segmented,
						children: ["cron", "at"].map((k) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
							type: "button",
							className: kind === k ? schedule_picker_module_css_default.segmentActive : void 0,
							"aria-pressed": kind === k,
							onClick: () => {
								onKindChange(k);
							},
							children: t(`kind.${k}`)
						}, k))
					})]
				}), kind === "at" ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: schedule_picker_module_css_default.onceGrid,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: schedule_picker_module_css_default.calendar,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: schedule_picker_module_css_default.calHead,
								children: [
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: schedule_picker_module_css_default.calNav,
										"aria-label": "Previous month",
										onClick: () => {
											setMonthView((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
										},
										children: "‹"
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: schedule_picker_module_css_default.calTitle,
										children: monthTitle
									}),
									/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										className: schedule_picker_module_css_default.calNav,
										"aria-label": "Next month",
										onClick: () => {
											setMonthView((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
										},
										children: "›"
									})
								]
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: schedule_picker_module_css_default.calWeekdays,
								children: weekdays.map((w) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: schedule_picker_module_css_default.calWeekday,
									children: w
								}, w))
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: schedule_picker_module_css_default.calGrid,
								children: matrix.flat().map(({ date, inMonth }) => {
									const key = dateKey(date);
									const selected = key === parsedAt.date;
									return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
										type: "button",
										disabled: !inMonth,
										className: `${schedule_picker_module_css_default.calDay}${selected ? ` ${schedule_picker_module_css_default.calDaySelected}` : ""}${!inMonth ? ` ${schedule_picker_module_css_default.calDayMuted}` : ""}`,
										onClick: () => {
											setAtParts(key, parsedAt.hour, parsedAt.minute);
										},
										children: date.getDate()
									}, key + String(inMonth));
								})
							})
						]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: schedule_picker_module_css_default.onceSide,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
								label: t("fieldTime"),
								hour: parsedAt.hour,
								minute: parsedAt.minute,
								onHour: (h) => {
									setAtParts(parsedAt.date, h, parsedAt.minute);
								},
								onMinute: (m) => {
									setAtParts(parsedAt.date, parsedAt.hour, m);
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("p", {
								className: schedule_picker_module_css_default.hint,
								children: t("atHint")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimezoneSelect, {
								value: timeZone,
								label: t("fieldTimeZone"),
								hint: t("timeZoneHint"),
								onChange: (tz) => {
									onChange({ timeZone: tz });
								}
							})
						]
					})]
				}) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: schedule_picker_module_css_default.tzField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("recurPattern") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
							className: schedule_picker_module_css_default.patternSelect,
							value: recurring.pattern === "custom" ? "custom" : recurring.pattern,
							onChange: (e) => {
								const pattern = e.target.value;
								if (pattern === "custom") {
									setShowAdvancedCron(true);
									patchRecurring({ pattern: "custom" });
									return;
								}
								setShowAdvancedCron(false);
								patchRecurring({
									pattern,
									daysOfWeek: pattern === "weekly" ? recurring.daysOfWeek ?? /* @__PURE__ */ new Set([
										1,
										2,
										3,
										4,
										5
									]) : null
								});
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "hourly",
									children: t("recurHourly")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "interval",
									children: t("recurInterval")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "daily",
									children: t("recurDaily")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "weekly",
									children: t("recurWeekly")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "monthly",
									children: t("recurMonthly")
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
									value: "custom",
									children: t("recurAdvanced")
								})
							]
						})]
					}),
					recurring.pattern === "interval" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: schedule_picker_module_css_default.tzField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldIntervalHours") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: schedule_picker_module_css_default.patternSelect,
							value: recurring.intervalHours,
							onChange: (e) => {
								patchRecurring({
									pattern: "interval",
									intervalHours: Number.parseInt(e.target.value, 10)
								});
							},
							children: INTERVAL_HOURS.map((n) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: n,
								children: t("intervalHoursOption", { count: n })
							}, n))
						})]
					}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("fieldAtMinute"),
						hour: 0,
						minute: recurring.minute,
						minuteOnly: true,
						onHour: () => {},
						onMinute: (m) => {
							patchRecurring({
								pattern: "interval",
								minute: m
							});
						}
					})] }),
					recurring.pattern === "hourly" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("fieldAtMinute"),
						hour: 0,
						minute: recurring.minute,
						minuteOnly: true,
						onHour: () => {},
						onMinute: (m) => {
							patchRecurring({
								pattern: "hourly",
								minute: m
							});
						}
					}),
					(recurring.pattern === "daily" || recurring.pattern === "weekly" || recurring.pattern === "monthly") && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimeRow, {
						label: t("fieldTime"),
						hour: recurring.hour,
						minute: recurring.minute,
						onHour: (h) => {
							patchRecurring({ hour: h });
						},
						onMinute: (m) => {
							patchRecurring({ minute: m });
						}
					}),
					recurring.pattern === "weekly" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: schedule_picker_module_css_default.dowRow,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: schedule_picker_module_css_default.timeLabel,
							children: t("fieldDays")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: schedule_picker_module_css_default.dowChips,
							role: "group",
							"aria-label": t("fieldDays"),
							children: DOW_VALUES.map((dow, i) => {
								const on = recurring.daysOfWeek?.has(dow) ?? false;
								return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
									type: "button",
									className: `${schedule_picker_module_css_default.dowChip}${on ? ` ${schedule_picker_module_css_default.dowChipOn}` : ""}`,
									"aria-pressed": on,
									onClick: () => {
										toggleDay(dow);
									},
									children: weekdays[i]?.slice(0, 2) ?? dow
								}, dow);
							})
						})]
					}),
					recurring.pattern === "monthly" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: schedule_picker_module_css_default.tzField,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldDayOfMonth") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("select", {
							className: schedule_picker_module_css_default.patternSelect,
							value: recurring.dayOfMonth,
							onChange: (e) => {
								patchRecurring({
									pattern: "monthly",
									dayOfMonth: Number.parseInt(e.target.value, 10)
								});
							},
							children: Array.from({ length: 31 }, (_, i) => i + 1).map((d) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
								value: d,
								children: d
							}, d))
						})]
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)(TimezoneSelect, {
						value: timeZone,
						label: t("fieldTimeZone"),
						hint: t("timeZoneHint"),
						onChange: (tz) => {
							onChange({ timeZone: tz });
						}
					}),
					(showAdvancedCron || recurring.pattern === "custom") && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
						className: schedule_picker_module_css_default.tzField,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldCron") }),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
								value: cron,
								spellCheck: false,
								onChange: (e) => {
									onChange({ cron: e.target.value });
								}
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("cronHint") })
						]
					}),
					recurring.pattern !== "custom" && !showAdvancedCron && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
						type: "button",
						className: schedule_picker_module_css_default.advancedToggle,
						onClick: () => {
							setShowAdvancedCron(true);
						},
						children: t("recurAdvanced")
					})
				] })]
			});
		}
		//#endregion
		//#region src/client/runtime-stores.ts
		/**
		* Subscribe to Harness workspace/session lists for hero tools and other mounts
		* that do not receive sidebar.footer.action runtime props.
		* @module
		*/
		const MOUNT_ROOT = "/workspace";
		let workspacesList = null;
		let sessionsList = null;
		const EMPTY_WORKSPACES = { items: [] };
		const EMPTY_SESSIONS = {};
		function normPath(value) {
			return String(value ?? "").replace(/\/+$/, "") || "/";
		}
		function isMountRootWorkspace(path) {
			return normPath(path) === MOUNT_ROOT;
		}
		function pickList(scope, key) {
			if (!scope || typeof scope !== "object") return null;
			const record = scope;
			const bag = record[key] ?? (typeof record.get === "function" ? record.get(key) : void 0);
			if (!bag || typeof bag !== "object") return null;
			const list = bag.list;
			if (!list?.subscribe || !list.getSnapshot) return null;
			return list;
		}
		function bindHarnessRuntimeStores(scope) {
			workspacesList = pickList(scope, "workspaces");
			sessionsList = pickList(scope, "sessions");
		}
		function unbindHarnessRuntimeStores() {
			workspacesList = null;
			sessionsList = null;
		}
		function subscribeWorkspaces(onStoreChange) {
			return workspacesList?.subscribe(onStoreChange) ?? (() => {});
		}
		function getWorkspacesSnapshot() {
			if (!workspacesList) return EMPTY_WORKSPACES;
			return workspacesList.getSnapshot();
		}
		function subscribeSessions(onStoreChange) {
			return sessionsList?.subscribe(onStoreChange) ?? (() => {});
		}
		function getSessionsSnapshot() {
			if (!sessionsList) return EMPTY_SESSIONS;
			return sessionsList.getSnapshot();
		}
		const useCronWorkspaces = (selector) => selector((0, react.useSyncExternalStore)(subscribeWorkspaces, getWorkspacesSnapshot, () => EMPTY_WORKSPACES));
		const useCronSessions = (selector) => selector((0, react.useSyncExternalStore)(subscribeSessions, getSessionsSnapshot, () => EMPTY_SESSIONS));
		//#endregion
		//#region src/client/workspace-accent-bridge.ts
		const CONFIG_EVENT = "dsh-workspace-accent-config";
		function workspaceAccentKey(row) {
			const api = typeof window !== "undefined" ? window.__dshWorkspaceAccent : void 0;
			if (api?.keyFromItem) return api.keyFromItem(row);
			return row.workspaceId ?? row.path ?? row.name ?? row.title ?? "default";
		}
		function workspaceFolderColor(row) {
			if (!row) return void 0;
			const api = typeof window !== "undefined" ? window.__dshWorkspaceAccent : void 0;
			if (!api?.colorForKey) return void 0;
			return api.colorForKey(workspaceAccentKey(row));
		}
		function subscribeWorkspaceAccent(onChange) {
			if (typeof window === "undefined") return () => {};
			const onCfg = () => {
				onChange();
			};
			window.addEventListener(CONFIG_EVENT, onCfg);
			const mq = window.matchMedia?.("(prefers-color-scheme: dark)");
			const onScheme = () => {
				onChange();
			};
			mq?.addEventListener?.("change", onScheme);
			return () => {
				window.removeEventListener(CONFIG_EVENT, onCfg);
				mq?.removeEventListener?.("change", onScheme);
			};
		}
		//#endregion
		//#region \0dsh-css:/home/insaint/Containers/DSH-IDE-Tools/plugins/dsh-cron/src/client/workspace-select.module.css.mjs
		const css = ".O49FbW_root{width:100%;min-width:0;position:relative}.O49FbW_trigger{box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);width:100%;height:30px;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;border-radius:8px;align-items:center;gap:8px;padding:0 10px;font-size:12px;display:flex}.O49FbW_trigger:hover{border-color:color-mix(in srgb, var(--dsw-alias-border-l2) 70%, var(--dsw-alias-label-tertiary))}.O49FbW_trigger:focus-visible{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 12%, transparent);outline:none}.O49FbW_triggerLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.O49FbW_chevron{color:var(--dsw-alias-label-tertiary);flex:none}.O49FbW_menu{z-index:40;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);max-height:min(280px,50vh);box-shadow:0 8px 24px color-mix(in srgb, var(--dsw-alias-label-primary) 12%, transparent);border-radius:8px;margin:0;padding:4px;list-style:none;position:absolute;top:calc(100% + 4px);left:0;right:0;overflow:auto}.O49FbW_option{width:100%;min-height:32px;color:var(--dsw-alias-label-primary);font:inherit;text-align:left;cursor:pointer;background:0 0;border:none;border-radius:6px;align-items:center;gap:8px;padding:6px 8px;font-size:12px;display:flex}.O49FbW_option:hover{background:var(--dsw-alias-interactive-bg-hover)}.O49FbW_optionActive{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, transparent)}.O49FbW_optionLabel{text-overflow:ellipsis;white-space:nowrap;flex:1;min-width:0;overflow:hidden}.O49FbW_folderIcon{flex:none}";
		const tagId = "dsh-cron/workspace-select.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-cron";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var workspace_select_module_css_default = {
			"triggerLabel": "O49FbW_triggerLabel",
			"folderIcon": "O49FbW_folderIcon",
			"optionLabel": "O49FbW_optionLabel",
			"chevron": "O49FbW_chevron",
			"menu": "O49FbW_menu",
			"root": "O49FbW_root",
			"trigger": "O49FbW_trigger",
			"option": "O49FbW_option",
			"optionActive": "O49FbW_optionActive"
		};
		//#endregion
		//#region src/client/workspace-select.tsx
		/**
		* Workspace picker with sidebar-matching colored folder icons.
		* @module
		*/
		function workspaceLabel(row) {
			return String(row.title || row.name || row.path || "").trim() || row.path || "";
		}
		function folderColorForPath(path, workspaces) {
			if (!path) return void 0;
			const hit = workspaces.find((w) => w.path === path);
			return hit ? workspaceFolderColor(hit) : void 0;
		}
		function WorkspaceSelect({ value, onChange, workspaces, defaultLabel, extraOptions = [] }) {
			const listId = (0, react.useId)();
			const rootRef = (0, react.useRef)(null);
			const [open, setOpen] = (0, react.useState)(false);
			const [, setAccentTick] = (0, react.useState)(0);
			(0, react.useEffect)(() => subscribeWorkspaceAccent(() => {
				setAccentTick((t) => t + 1);
			}), []);
			(0, react.useEffect)(() => {
				if (!open) return;
				const onDoc = (event) => {
					const node = rootRef.current;
					if (node && event.target instanceof Node && !node.contains(event.target)) setOpen(false);
				};
				const onKey = (event) => {
					if (event.key === "Escape") setOpen(false);
				};
				document.addEventListener("mousedown", onDoc);
				document.addEventListener("keydown", onKey);
				return () => {
					document.removeEventListener("mousedown", onDoc);
					document.removeEventListener("keydown", onKey);
				};
			}, [open]);
			const selectedLabel = (0, react.useMemo)(() => {
				if (!value) return defaultLabel;
				const hit = workspaces.find((w) => w.path === value);
				if (hit) return workspaceLabel(hit);
				return extraOptions.find((o) => o.value === value)?.label ?? value;
			}, [
				value,
				workspaces,
				defaultLabel,
				extraOptions
			]);
			const triggerFolderColor = (0, react.useMemo)(() => folderColorForPath(value, workspaces), [value, workspaces]);
			const pick = (path) => {
				onChange(path);
				setOpen(false);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: workspace_select_module_css_default.root,
				ref: rootRef,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: workspace_select_module_css_default.trigger,
					"aria-expanded": open,
					"aria-haspopup": "listbox",
					"aria-controls": open ? listId : void 0,
					onClick: () => {
						setOpen((current) => !current);
					},
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolderFilled16, {
							size: 16,
							className: workspace_select_module_css_default.folderIcon,
							color: triggerFolderColor ?? "var(--dsw-alias-label-tertiary)"
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: workspace_select_module_css_default.triggerLabel,
							children: selectedLabel
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDownOutline16, {
							size: 16,
							className: workspace_select_module_css_default.chevron
						})
					]
				}), open ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("ul", {
					id: listId,
					className: workspace_select_module_css_default.menu,
					role: "listbox",
					"aria-label": defaultLabel,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
							role: "none",
							children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
								type: "button",
								role: "option",
								"aria-selected": !value,
								className: `${workspace_select_module_css_default.option}${!value ? ` ${workspace_select_module_css_default.optionActive}` : ""}`,
								onClick: () => {
									pick("");
								},
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolderFilled16, {
									size: 16,
									className: workspace_select_module_css_default.folderIcon,
									color: "var(--dsw-alias-label-tertiary)"
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: workspace_select_module_css_default.optionLabel,
									children: defaultLabel
								})]
							})
						}),
						workspaces.map((workspace) => {
							const path = workspace.path ?? "";
							const label = workspaceLabel(workspace);
							const color = workspaceFolderColor(workspace);
							const active = value === path;
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								role: "none",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "option",
									"aria-selected": active,
									className: `${workspace_select_module_css_default.option}${active ? ` ${workspace_select_module_css_default.optionActive}` : ""}`,
									onClick: () => {
										pick(path);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolderFilled16, {
										size: 16,
										className: workspace_select_module_css_default.folderIcon,
										color: color ?? "var(--dsw-alias-label-secondary)"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workspace_select_module_css_default.optionLabel,
										children: label
									})]
								})
							}, workspace.workspaceId ?? path);
						}),
						extraOptions.map((option) => {
							const active = value === option.value;
							const color = folderColorForPath(option.value, workspaces);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("li", {
								role: "none",
								children: /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "option",
									"aria-selected": active,
									className: `${workspace_select_module_css_default.option}${active ? ` ${workspace_select_module_css_default.optionActive}` : ""}`,
									onClick: () => {
										pick(option.value);
									},
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconFolderFilled16, {
										size: 16,
										className: workspace_select_module_css_default.folderIcon,
										color: color ?? "var(--dsw-alias-label-secondary)"
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: workspace_select_module_css_default.optionLabel,
										children: option.label
									})]
								})
							}, option.value);
						})
					]
				}) : null]
			});
		}
		//#endregion
		//#region src/client/model-catalog.ts
		/** Returns provider/model groups, or null when the API is unavailable. */
		async function fetchCronModelGroups(signal) {
			try {
				const rpcId = `dsh-cron-models-${Math.random().toString(36).slice(2, 10)}`;
				const response = await fetch("/api/session/modelCatalog", {
					method: "POST",
					headers: { "content-type": "application/json" },
					credentials: "include",
					...signal === void 0 ? {} : { signal },
					body: JSON.stringify({
						type: "client-request",
						rpcId,
						method: "session/modelCatalog",
						payload: { args: {} }
					})
				});
				if (!response.ok) return null;
				const data = await response.json();
				if (!data?.result?.ok) return null;
				return data.result.value?.groups ?? [];
			} catch {
				return null;
			}
		}
		//#endregion
		//#region src/standing.ts
		/**
		* Cron-only standing instructions — injected into every scheduled Automation
		* run, never into interactive chat / AGENTS.md.
		* @module dsh-cron/standing
		*/
		/** Default unattended-work protocol shown (and used) until the operator edits it. */
		const DEFAULT_STANDING_INSTRUCTIONS = [
			"You are continuing an unattended build in this workspace.",
			"",
			"1. Read PROGRESS.md and TODO.md if they exist; create them if missing.",
			"2. Inspect the repo: what exists, what's broken, what's next.",
			"3. Do the next concrete slice of work (implement, test, fix). Prefer one clean slice over many half-done ones.",
			"4. Do not ask the human questions. If unclear, pick a reasonable default and note it in PROGRESS.md.",
			"5. Before you stop, update:",
			"   - PROGRESS.md — what you did this run, current state, blockers, decisions",
			"   - TODO.md — ordered next steps for the following run",
			"6. Leave the tree buildable / runnable if possible."
		].join("\n");
		//#endregion
		//#region src/client/CronPanel.tsx
		/**
		* Scheduled tasks UI: workbench tab view and shared schedule editor.
		* Polls the host `/cron` channel — no model involvement in the browser.
		* @module
		*/
		const POLL_MS = 3e4;
		const TAB_ORDER = [
			"create",
			"all",
			"active",
			"paused",
			"done"
		];
		function tabIcon(id) {
			switch (id) {
				case "create": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPlusOutline16, {
					size: 15,
					className: CronPanel_module_css_default.filterIcon
				});
				case "all": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconListOutline16, {
					size: 15,
					className: CronPanel_module_css_default.filterIcon
				});
				case "active": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClockOutline16, {
					size: 15,
					className: CronPanel_module_css_default.filterIcon
				});
				case "paused": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPauseOutline16, {
					size: 15,
					className: CronPanel_module_css_default.filterIcon
				});
				case "done": return /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheckOutline14, {
					size: 14,
					className: CronPanel_module_css_default.filterIcon
				});
			}
		}
		const MODEL_SEP = "::";
		function CronTabView(props) {
			const { connection, remote, t, useSessions, useWorkspaces } = props;
			return /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
				className: CronPanel_module_css_default.root,
				"data-dsh-cron-root": "1",
				children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(CronScheduleView, {
					connection,
					...remote === void 0 ? {} : { remote },
					t,
					useSessions,
					useWorkspaces
				})
			});
		}
		function defaultTimeZone() {
			try {
				return Intl.DateTimeFormat().resolvedOptions().timeZone;
			} catch {
				return "UTC";
			}
		}
		function initialDraft(cwd = "") {
			return {
				prompt: "",
				kind: "cron",
				cron: "0 9 * * *",
				timeZone: defaultTimeZone(),
				at: "",
				cwd,
				modelKey: ""
			};
		}
		function encodeModelKey(provider, model) {
			return `${provider}${MODEL_SEP}${model}`;
		}
		function decodeModelKey(key) {
			const i = key.indexOf(MODEL_SEP);
			if (i <= 0) return null;
			const provider = key.slice(0, i).trim();
			const model = key.slice(i + 2).trim();
			if (!provider || !model) return null;
			return {
				provider,
				model
			};
		}
		function pad2(n) {
			return String(n).padStart(2, "0");
		}
		function isoToLocalAt(iso) {
			const d = new Date(iso);
			if (Number.isNaN(d.getTime())) return defaultAtLocal();
			return combineAtLocal(`${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`, d.getHours(), d.getMinutes());
		}
		function draftFromJob(job, fallbackCwd = "") {
			const cwd = job.target?.cwd ?? fallbackCwd;
			const modelKey = job.target?.provider && job.target?.model ? encodeModelKey(job.target.provider, job.target.model) : "";
			if (job.schedule.kind === "cron") return {
				prompt: job.prompt,
				kind: "cron",
				cron: job.schedule.expression,
				timeZone: job.schedule.timeZone,
				at: "",
				cwd,
				modelKey
			};
			return {
				prompt: job.prompt,
				kind: "at",
				cron: "0 9 * * *",
				timeZone: defaultTimeZone(),
				at: isoToLocalAt(job.schedule.at),
				cwd,
				modelKey
			};
		}
		/** Format a wire timestamp in the browser's locale and time zone. */
		function formatDateTime(value) {
			const parsed = new Date(value);
			if (Number.isNaN(parsed.getTime())) return value;
			return new Intl.DateTimeFormat(void 0, {
				dateStyle: "medium",
				timeStyle: "short"
			}).format(parsed);
		}
		function outcomeLabel(run, t) {
			return t(`outcome.${run.outcome ?? run.state}`);
		}
		function scheduleLabel(job, t) {
			if (job.schedule.kind === "at") return t("scheduleOnce");
			return t("scheduleRecurring", { timeZone: job.schedule.timeZone });
		}
		function visibleFor(job, filter) {
			if (filter === "all") return true;
			if (filter === "done") return job.state === "done";
			if (filter === "paused") return job.state === "active" && job.paused;
			return job.state === "active" && !job.paused;
		}
		function createPayload(draft, createdBy) {
			const owner = createdBy === void 0 ? {} : { createdBy };
			const cwd = draft.cwd.trim();
			const model = decodeModelKey(draft.modelKey);
			const target = {
				...cwd ? { cwd } : {},
				...cwd && model ? {
					provider: model.provider,
					model: model.model
				} : {}
			};
			if (draft.kind === "cron") return {
				prompt: draft.prompt,
				cron: draft.cron,
				timeZone: draft.timeZone,
				...owner,
				...target
			};
			return {
				prompt: draft.prompt,
				at: new Date(draft.at).toISOString(),
				...owner,
				...target
			};
		}
		function createErrorMessage(cause, t) {
			const message = cause instanceof Error ? cause.message : String(cause);
			if (message.includes("invalid_prompt:")) return t("createErrorPrompt");
			if (message.includes("invalid_cron_expression:")) return t("createErrorCron");
			if (message.includes("invalid_time_zone:")) return t("createErrorTimeZone");
			if (message.includes("not_future:")) return t("createErrorFuture");
			if (message.includes("too_frequent:")) return t("createErrorFrequent");
			if (message.includes("too_many_jobs:")) return t("createErrorLimit");
			if (message.includes("schedule_unreachable:")) return t("createErrorUnreachable");
			if (message.includes("invalid_selector:")) return t("createErrorSchedule");
			if (message.includes("invalid_target:")) return t("createErrorTarget");
			if (message.includes("payload.cwd")) return t("createErrorTarget");
			if (message.includes("not_found:")) return t("errorMissing", { id: "task" });
			return message;
		}
		function CronScheduleView({ connection, t, useSessions, useWorkspaces }) {
			const [list, setList] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(null);
			const [notice, setNotice] = (0, react.useState)(null);
			const [filter, setFilter] = (0, react.useState)("create");
			const [draft, setDraft] = (0, react.useState)(() => initialDraft());
			const [editingId, setEditingId] = (0, react.useState)(null);
			const [expanded, setExpanded] = (0, react.useState)(null);
			const [confirmRemove, setConfirmRemove] = (0, react.useState)(null);
			const [busy, setBusy] = (0, react.useState)(null);
			const [standing, setStanding] = (0, react.useState)(DEFAULT_STANDING_INSTRUCTIONS);
			const [standingDirty, setStandingDirty] = (0, react.useState)(false);
			const [modelOptions, setModelOptions] = (0, react.useState)([]);
			const [modelsState, setModelsState] = (0, react.useState)("idle");
			const titleId = (0, react.useId)();
			const currentSession = useSessions((state) => state.current);
			const workspaceItems = useWorkspaces((state) => state.items ?? []);
			const workspaces = (0, react.useMemo)(() => workspaceItems.filter((item) => !isMountRootWorkspace(item.path)), [workspaceItems]);
			const suggestedCwd = (0, react.useMemo)(() => {
				if (currentSession) {
					const owned = workspaces.find((workspace) => workspace.sessionIds?.includes(currentSession));
					if (owned?.path) return owned.path;
				}
				return workspaces[0]?.path ?? "";
			}, [currentSession, workspaces]);
			const creating = filter === "create";
			const editing = editingId !== null;
			(0, react.useEffect)(() => {
				if (!creating || editing || (draft.cwd ?? "").trim()) return;
				if (suggestedCwd) setDraft((current) => ({
					...current,
					cwd: suggestedCwd
				}));
			}, [
				creating,
				draft.cwd,
				editing,
				suggestedCwd
			]);
			const resetDraft = (0, react.useCallback)(() => {
				setDraft(initialDraft(suggestedCwd));
				setEditingId(null);
			}, [suggestedCwd]);
			const beginEdit = (0, react.useCallback)((job) => {
				setEditingId(job.id);
				setDraft(draftFromJob(job, suggestedCwd));
				setFilter("create");
				setExpanded(null);
				setConfirmRemove(null);
				setError(null);
				setNotice(null);
			}, [suggestedCwd]);
			const refresh = (0, react.useCallback)(async (signal) => {
				const next = await callRpc(connection, "list", {}, signal);
				setList(next);
				if (!standingDirty && typeof next.standingInstructions === "string") setStanding(next.standingInstructions);
				else if (!standingDirty && next.standingInstructions === void 0) setStanding(DEFAULT_STANDING_INSTRUCTIONS);
				setError(null);
			}, [connection, standingDirty]);
			const saveStanding = (0, react.useCallback)(async () => {
				setBusy("standing");
				setError(null);
				setNotice(null);
				try {
					const outcome = await callRpc(connection, "setStanding", { standingInstructions: standing });
					setStanding(outcome.standingInstructions);
					setStandingDirty(false);
					setNotice(t("standingSaved"));
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(null);
				}
			}, [
				connection,
				standing,
				t
			]);
			const loadModels = (0, react.useCallback)(async (signal) => {
				setModelsState("loading");
				try {
					let groups = await fetchCronModelGroups(signal);
					if (signal?.aborted) return;
					if (groups === null) {
						setModelsState("error");
						setModelOptions([]);
						return;
					}
					const options = [];
					for (const group of groups) for (const model of group.models ?? []) options.push({
						key: encodeModelKey(group.id, model.id),
						provider: group.id,
						model: model.id,
						label: `${group.name} / ${model.name || model.id}`
					});
					setModelOptions(options);
					setModelsState("ready");
				} catch {
					if (!signal?.aborted) {
						setModelsState("error");
						setModelOptions([]);
					}
				}
			}, []);
			(0, react.useEffect)(() => {
				const controller = new AbortController();
				refresh(controller.signal).catch(() => {
					if (!controller.signal.aborted) setError(t("errorLoad"));
				});
				loadModels(controller.signal);
				const timer = setInterval(() => {
					refresh(controller.signal).catch(() => {});
				}, POLL_MS);
				return () => {
					controller.abort();
					clearInterval(timer);
				};
			}, [
				loadModels,
				refresh,
				t
			]);
			const jobs = list?.jobs ?? [];
			const listFilter = creating ? "all" : filter;
			const visibleJobs = (0, react.useMemo)(() => jobs.filter((job) => visibleFor(job, listFilter)), [listFilter, jobs]);
			const counts = (0, react.useMemo)(() => ({
				all: jobs.length,
				active: jobs.filter((job) => job.state === "active" && !job.paused).length,
				paused: jobs.filter((job) => job.state === "active" && job.paused).length,
				done: jobs.filter((job) => job.state === "done").length
			}), [jobs]);
			const runAction = async (kind, job) => {
				setBusy(`${kind}:${job.id}`);
				setError(null);
				setNotice(null);
				try {
					if (kind === "fire") {
						const outcome = await callRpc(connection, "fire", { id: job.id });
						if (outcome.result !== "submitted") throw new Error(outcome.result === "target_required" ? t("errorNoTarget", { id: job.id }) : t("errorMissing", { id: job.id }));
						setNotice(t("noticeFired", { id: job.id }));
					} else if (kind === "pause") {
						if (!(await callRpc(connection, "update", {
							id: job.id,
							paused: !job.paused
						})).updated) throw new Error(t("errorUpdate", { id: job.id }));
						setNotice(job.paused ? t("noticeResumed", { id: job.id }) : t("noticePaused", { id: job.id }));
					} else {
						if (!(await callRpc(connection, "remove", { id: job.id })).removed) throw new Error(t("errorMissing", { id: job.id }));
						setConfirmRemove(null);
						setExpanded(null);
						setNotice(t("noticeRemoved", { id: job.id }));
					}
					await refresh();
				} catch (cause) {
					setError(cause instanceof Error ? cause.message : String(cause));
				} finally {
					setBusy(null);
				}
			};
			const submitForm = async () => {
				if (draft.prompt.trim().length === 0) {
					setError(t("errorPrompt"));
					return;
				}
				if (draft.kind === "cron" && (draft.cron.trim().length === 0 || draft.timeZone.trim().length === 0)) {
					setError(t("errorSchedule"));
					return;
				}
				if (draft.kind === "at" && (draft.at.length === 0 || Number.isNaN(new Date(draft.at).getTime()))) {
					setError(t("errorSchedule"));
					return;
				}
				if (draft.modelKey && !draft.cwd.trim()) {
					setError(t("errorWorkspaceForModel"));
					return;
				}
				setBusy(editing ? `edit:${editingId}` : "create");
				setError(null);
				setNotice(null);
				try {
					if (standingDirty) {
						await callRpc(connection, "setStanding", { standingInstructions: standing });
						setStandingDirty(false);
					}
					if (editing && editingId) {
						const outcome = await callRpc(connection, "edit", {
							id: editingId,
							...createPayload(draft, void 0)
						});
						setNotice(t("noticeUpdated", { id: outcome.job.id }));
					} else {
						const outcome = await callRpc(connection, "add", createPayload(draft, currentSession));
						setNotice(outcome.deduplicated ? t("noticeDeduplicated", { id: outcome.job.id }) : t("noticeCreated", { id: outcome.job.id }));
					}
					resetDraft();
					setFilter("all");
					await refresh();
				} catch (cause) {
					setError(createErrorMessage(cause, t));
				} finally {
					setBusy(null);
				}
			};
			const cancelCreate = () => {
				setFilter("all");
				resetDraft();
				setError(null);
				setNotice(null);
			};
			const selectTab = (next) => {
				setFilter(next);
				if (next === "create") resetDraft();
				else {
					setDraft(initialDraft(suggestedCwd));
					setEditingId(null);
				}
				setExpanded(null);
				setConfirmRemove(null);
				setError(null);
				setNotice(null);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: CronPanel_module_css_default.rootInner,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: CronPanel_module_css_default.bar,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CronPanel_module_css_default.filterMode,
							role: "tablist",
							"aria-label": t("label"),
							children: TAB_ORDER.map((id) => {
								const label = id === "create" && editing ? t("filter.edit") : t(`filter.${id}`);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
									type: "button",
									role: "tab",
									id: id === filter ? titleId : void 0,
									className: `${CronPanel_module_css_default.filterBtn}${filter === id ? ` ${CronPanel_module_css_default.filterBtnActive}` : ""}${id === "create" ? ` ${CronPanel_module_css_default.filterBtnCreate}` : ""}`,
									"aria-selected": filter === id,
									"aria-label": id === "create" ? label : `${label} ${counts[id]}`,
									title: id === "create" ? label : `${label} (${counts[id]})`,
									onClick: () => {
										selectTab(id);
									},
									children: [
										tabIcon(id),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: CronPanel_module_css_default.filterLabel,
											children: label
										}),
										id !== "create" && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: CronPanel_module_css_default.count,
											children: counts[id]
										})
									]
								}, id);
							})
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: CronPanel_module_css_default.meta,
							children: creating ? editing ? t("editSubtitle") : t("createSubtitle") : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CronPanel_module_css_default.metaPrimary,
									children: t("headerSummary", { count: visibleJobs.length })
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CronPanel_module_css_default.metaSep,
									"aria-hidden": "true",
									children: " · "
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
									className: CronPanel_module_css_default.metaHint,
									children: t("navHint")
								})
							] })
						})]
					}),
					(error !== null || notice !== null) && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: error !== null ? CronPanel_module_css_default.error : CronPanel_module_css_default.notice,
						role: error !== null ? "alert" : "status",
						children: error ?? notice
					}),
					/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: `${CronPanel_module_css_default.body}${creating ? ` ${CronPanel_module_css_default.bodyPad}` : ""}`,
						children: creating ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("form", {
							className: `${CronPanel_module_css_default.form} ${CronPanel_module_css_default.formStack}`,
							onSubmit: (event) => {
								event.preventDefault();
								submitForm();
							},
							children: [
								/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: CronPanel_module_css_default.formSchedule,
									children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(SchedulePicker, {
										kind: draft.kind,
										cron: draft.cron,
										timeZone: draft.timeZone,
										at: draft.at,
										t,
										onKindChange: (kind) => {
											setDraft((current) => {
												if (kind === "at" && !current.at.trim()) return {
													...current,
													kind,
													at: defaultAtLocal()
												};
												return {
													...current,
													kind
												};
											});
											setError(null);
										},
										onChange: (patch) => {
											setDraft((current) => ({
												...current,
												...patch
											}));
											setError(null);
										}
									})
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CronPanel_module_css_default.fieldGrid,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: CronPanel_module_css_default.field,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldWorkspace") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)(WorkspaceSelect, {
												value: draft.cwd,
												defaultLabel: t("workspaceDefault"),
												workspaces,
												extraOptions: draft.cwd && !workspaces.some((workspace) => workspace.path === draft.cwd) ? [{
													value: draft.cwd,
													label: draft.cwd
												}] : [],
												onChange: (path) => {
													setDraft((current) => ({
														...current,
														cwd: path
													}));
													setError(null);
												}
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("workspaceHint") })
										]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
										className: CronPanel_module_css_default.field,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldModel") }),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("select", {
												value: draft.modelKey,
												disabled: modelsState === "loading",
												onChange: (event) => {
													setDraft((current) => ({
														...current,
														modelKey: event.target.value
													}));
													setError(null);
												},
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: "",
													children: t("modelDefault")
												}), modelOptions.map((option) => /* @__PURE__ */ (0, react_jsx_runtime.jsx)("option", {
													value: option.key,
													children: option.label
												}, option.key))]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: modelsState === "loading" ? t("modelLoading") : modelsState === "error" ? t("modelUnavailable") : t("modelHint") })
										]
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: CronPanel_module_css_default.field,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldPrompt") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
										value: draft.prompt,
										rows: 5,
										placeholder: t("promptPlaceholder"),
										onChange: (event) => {
											setDraft((current) => ({
												...current,
												prompt: event.target.value
											}));
											setError(null);
										}
									})]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
									className: CronPanel_module_css_default.field,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("fieldStanding") }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("textarea", {
											value: standing,
											rows: 8,
											onChange: (event) => {
												setStanding(event.target.value);
												setStandingDirty(true);
												setError(null);
											}
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("small", { children: t("standingHint") })
									]
								}),
								/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: CronPanel_module_css_default.formActions,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: CronPanel_module_css_default.btn,
											disabled: busy === "standing",
											onClick: () => {
												setStanding(DEFAULT_STANDING_INSTRUCTIONS);
												setStandingDirty(true);
											},
											children: t("standingReset")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: CronPanel_module_css_default.btn,
											disabled: busy === "standing" || !standingDirty,
											onClick: () => {
												saveStanding();
											},
											children: busy === "standing" ? t("standingSaving") : t("standingSave")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { className: CronPanel_module_css_default.spacer }),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: CronPanel_module_css_default.btn,
											onClick: cancelCreate,
											children: t("cancel")
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "submit",
											className: `${CronPanel_module_css_default.btn} ${CronPanel_module_css_default.btnPrimary}`,
											disabled: busy === "create" || editingId !== null && busy === `edit:${editingId}`,
											children: editing ? busy === `edit:${editingId}` ? t("saving") : t("save") : busy === "create" ? t("creating") : t("create")
										})
									]
								})
							]
						}) : list === null ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CronPanel_module_css_default.empty,
							children: t("loading")
						}) : visibleJobs.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CronPanel_module_css_default.empty,
							children: listFilter === "all" ? t("emptyAll") : t("emptyFilter")
						}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: CronPanel_module_css_default.jobList,
							children: visibleJobs.map((job) => {
								const isExpanded = expanded === job.id;
								const status = job.state === "done" ? "done" : job.paused ? "paused" : "active";
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("article", {
									className: CronPanel_module_css_default.job,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
										type: "button",
										className: CronPanel_module_css_default.jobMain,
										"aria-expanded": isExpanded,
										"aria-controls": `cron-details-${job.id}`,
										onClick: () => {
											setExpanded(isExpanded ? null : job.id);
											setConfirmRemove(null);
										},
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${CronPanel_module_css_default.statusIcon} ${CronPanel_module_css_default[status]}`,
												children: status === "done" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconCheckOutline14, { size: 14 }) : status === "paused" ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconPauseOutline16, { size: 14 }) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconClockOutline16, { size: 14 })
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
												className: CronPanel_module_css_default.jobText,
												children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("strong", { children: job.prompt }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", { children: [
													scheduleLabel(job, t),
													" · ",
													job.schedule.kind === "cron" ? job.schedule.expression : formatDateTime(job.schedule.at)
												] })]
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${CronPanel_module_css_default.jobNext}${status === "active" ? "" : ` ${CronPanel_module_css_default.statusPill}`}`,
												children: status === "active" ? t("nextShort", { at: formatDateTime(job.nextAt) }) : t(`state.${status}`)
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: `${CronPanel_module_css_default.disclosure}${isExpanded ? ` ${CronPanel_module_css_default.disclosureOpen}` : ""}`,
												"aria-hidden": "true",
												children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(IconChevronDownOutline16, { size: 16 })
											})
										]
									}), isExpanded && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
										className: CronPanel_module_css_default.details,
										id: `cron-details-${job.id}`,
										children: [
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dl", { children: [
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("detailId") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: job.id }) })] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("detailCreated") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: formatDateTime(job.createdAt) })] }),
												/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("detailFires") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: t("firedCount", { count: job.fireCount }) })] }),
												job.target?.cwd !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("detailWorkspace") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: job.target.cwd }) })] }),
												job.target?.model !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("detailModel") }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("dd", { children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)("code", { children: job.target.provider ? `${job.target.provider} / ${job.target.model}` : job.target.model }) })] }),
												job.lastRun !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("dt", { children: t("detailLastRun") }), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("dd", { children: [
													outcomeLabel(job.lastRun, t),
													" · ",
													formatDateTime(job.lastRun.firedAt)
												] })] })
											] }),
											job.lastRun?.excerpt !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
												className: CronPanel_module_css_default.excerpt,
												children: job.lastRun.excerpt
											}),
											/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
												className: CronPanel_module_css_default.jobActions,
												children: [job.state === "active" && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: CronPanel_module_css_default.btn,
														disabled: busy !== null,
														onClick: () => {
															beginEdit(job);
														},
														children: t("edit")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: CronPanel_module_css_default.btn,
														disabled: busy !== null,
														onClick: () => {
															runAction("fire", job);
														},
														children: t("runNow")
													}),
													/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
														type: "button",
														className: CronPanel_module_css_default.btn,
														disabled: busy !== null,
														onClick: () => {
															runAction("pause", job);
														},
														children: job.paused ? t("resume") : t("pause")
													})
												] }), confirmRemove === job.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
													className: CronPanel_module_css_default.confirm,
													children: [
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", { children: t("confirmRemove") }),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: CronPanel_module_css_default.linkButton,
															onClick: () => {
																setConfirmRemove(null);
															},
															children: t("cancel")
														}),
														/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
															type: "button",
															className: `${CronPanel_module_css_default.btn} ${CronPanel_module_css_default.btnDanger}`,
															disabled: busy !== null,
															onClick: () => {
																runAction("remove", job);
															},
															children: t("confirm")
														})
													]
												}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
													type: "button",
													className: CronPanel_module_css_default.dangerLink,
													onClick: () => {
														setConfirmRemove(job.id);
													},
													children: t("remove")
												})]
											})
										]
									})]
								}, job.id);
							})
						})
					})
				]
			});
		}
		//#endregion
		//#region src/client/locales.ts
		/** Simple `{name}` interpolation for hero fallback copy. */
		function formatCronMessage(dict, key, params) {
			let message = dict[key] ?? String(key);
			if (params) for (const [name, value] of Object.entries(params)) message = message.replace(new RegExp(`\\{${name}\\}`, "g"), String(value));
			return message;
		}
		const en = {
			label: "Scheduled tasks",
			"filter.create": "Create task",
			"filter.edit": "Edit task",
			"filter.all": "All tasks",
			"filter.active": "Scheduled",
			"filter.paused": "Paused",
			"filter.done": "Completed",
			navHint: "Tasks are shared across sessions and survive restarts.",
			headerSummary: "{count} tasks in this view",
			newTask: "New task",
			close: "Close scheduled tasks",
			createTitle: "Create a scheduled task",
			createSubtitle: "Pick when the task runs, then describe what the agent should do.",
			editSubtitle: "Update when the task runs and what the agent should do.",
			fieldPrompt: "Task instructions",
			promptPlaceholder: "Describe what the agent should do when this task runs…",
			fieldStanding: "Standing instructions (all scheduled tasks)",
			standingHint: "Injected into every cron run only — not regular Chat. Shared across all jobs. Task instructions above are per job.",
			standingReset: "Reset to default",
			standingSaving: "Saving…",
			standingSaved: "Standing instructions saved.",
			standingSave: "Save standing instructions",
			fieldScheduleType: "Schedule type",
			"kind.cron": "Recurring",
			"kind.at": "One time",
			fieldCron: "Cron expression",
			cronHint: "Five fields: minute, hour, day, month, weekday.",
			fieldTimeZone: "Time zone",
			timeZoneHint: "Times follow the selected IANA time zone.",
			fieldAt: "Run at",
			fieldTime: "Time",
			fieldDays: "On days",
			recurPattern: "Repeat",
			recurHourly: "Every hour",
			recurInterval: "Every few hours",
			recurWeekly: "Weekly",
			recurMonthly: "Monthly",
			fieldIntervalHours: "Hours between runs",
			fieldAtMinute: "At minute",
			fieldDayOfMonth: "Day of month",
			intervalHoursOption: "Every {count} hours",
			recurDaily: "Daily",
			recurWeekdays: "Weekdays",
			recurAdvanced: "Custom cron expression",
			atHint: "Interpreted in your browser’s local time zone.",
			fieldWorkspace: "Workspace folder",
			workspaceHint: "Where the agent runs and saves files. Defaults to the profile default if unset.",
			workspaceDefault: "Profile default",
			fieldModel: "Model",
			modelHint: "Used when this task fires. Host default follows Settings → Models.",
			modelDefault: "Host default",
			modelLoading: "Loading models…",
			modelUnavailable: "Could not load models — host default will be used.",
			detailWorkspace: "Workspace",
			detailModel: "Model",
			cancel: "Cancel",
			create: "Create task",
			creating: "Creating…",
			edit: "Edit",
			save: "Save changes",
			saving: "Saving…",
			loading: "Loading scheduled tasks…",
			emptyTitle: "No tasks here",
			emptyAll: "Create a task to run work at a specific time or on a recurring schedule.",
			emptyFilter: "Tasks matching this status will appear here.",
			scheduleOnce: "One time",
			scheduleRecurring: "Recurring · {timeZone}",
			nextShort: "Next {at}",
			"state.active": "Scheduled",
			"state.paused": "Paused",
			"state.done": "Completed",
			detailId: "Task ID",
			detailCreated: "Created",
			detailFires: "Activity",
			detailLastRun: "Last run",
			firedCount: "Fired {count} times",
			"outcome.delivered": "Delivered",
			"outcome.completed": "Completed",
			"outcome.error": "Failed",
			"outcome.cancelled": "Cancelled",
			"outcome.timeout": "Timed out",
			"outcome.submitting": "Submitting",
			"outcome.queued": "Queued",
			"outcome.claimed": "Claimed",
			"outcome.running": "Running",
			"outcome.cancelling": "Cancelling",
			"outcome.succeeded": "Completed",
			"outcome.failed": "Failed",
			"outcome.indeterminate": "Needs review",
			"outcome.interrupted": "Needs review",
			"outcome.blocked": "Blocked",
			"outcome.max-tokens": "Token limit",
			"outcome.aborted": "Aborted",
			"outcome.not-dispatched": "Not dispatched",
			"outcome.legacy": "Legacy result",
			runNow: "Run now",
			pause: "Pause",
			resume: "Resume",
			remove: "Delete",
			confirmRemove: "Delete this task?",
			confirm: "Delete",
			errorLoad: "Could not load scheduled tasks. Retrying in the background.",
			errorPrompt: "Enter task instructions.",
			errorSchedule: "Complete the schedule fields.",
			createErrorPrompt: "Enter task instructions.",
			createErrorCron: "Enter a valid five-field cron expression.",
			createErrorTimeZone: "Enter a recognized IANA time zone.",
			createErrorFuture: "Choose a time in the future.",
			createErrorFrequent: "This schedule runs more frequently than the configured minimum.",
			createErrorLimit: "The active task limit has been reached.",
			createErrorUnreachable: "This schedule has no reachable occurrence.",
			createErrorSchedule: "Complete one valid schedule.",
			createErrorTarget: "Choose a valid absolute workspace folder.",
			errorWorkspaceForModel: "Pick a workspace folder when choosing a model.",
			errorNoTarget: "{id}: no session is available to run this task.",
			errorMissing: "{id}: task not found.",
			errorUpdate: "{id}: this task can no longer be updated.",
			noticeCreated: "{id} created.",
			noticeUpdated: "{id} updated.",
			noticeDeduplicated: "An identical active task already exists as {id}.",
			noticeFired: "{id} was dispatched.",
			noticePaused: "{id} paused.",
			noticeResumed: "{id} resumed.",
			noticeRemoved: "{id} deleted."
		};
		const zh = {
			label: "定时任务",
			"filter.create": "新建任务",
			"filter.edit": "编辑任务",
			"filter.all": "全部任务",
			"filter.active": "待执行",
			"filter.paused": "已暂停",
			"filter.done": "已完成",
			navHint: "任务跨会话共享，并在 Harness 重启后继续保留。",
			headerSummary: "当前视图共 {count} 个任务",
			newTask: "新建任务",
			close: "关闭定时任务",
			createTitle: "新建定时任务",
			createSubtitle: "选择运行时间，并描述 Agent 需要完成的工作。",
			editSubtitle: "更新任务的运行时间与 Agent 需要完成的工作。",
			fieldPrompt: "任务说明",
			promptPlaceholder: "描述任务触发时希望 Agent 完成的工作…",
			fieldStanding: "常驻说明（所有定时任务）",
			standingHint: "仅注入到每次 cron 运行，不影响普通对话。所有任务共用。上方「任务说明」仍按任务区分。",
			standingReset: "恢复默认",
			standingSaving: "正在保存…",
			standingSaved: "常驻说明已保存。",
			standingSave: "保存常驻说明",
			fieldScheduleType: "调度方式",
			"kind.cron": "周期执行",
			"kind.at": "单次执行",
			fieldCron: "Cron 表达式",
			cronHint: "五段格式：分钟、小时、日期、月份、星期。",
			fieldTimeZone: "时区",
			timeZoneHint: "任务时间按所选 IANA 时区计算。",
			fieldAt: "执行时间",
			fieldTime: "时间",
			fieldDays: "星期",
			recurPattern: "重复",
			recurHourly: "每小时",
			recurInterval: "每隔数小时",
			recurWeekly: "每周",
			recurMonthly: "每月",
			fieldIntervalHours: "间隔（小时）",
			fieldAtMinute: "分钟",
			fieldDayOfMonth: "每月第几天",
			intervalHoursOption: "每 {count} 小时",
			recurDaily: "每天",
			recurWeekdays: "工作日",
			recurAdvanced: "自定义 cron",
			atHint: "按浏览器本地时区解释。",
			fieldWorkspace: "工作区目录",
			workspaceHint: "任务运行与写文件的目录。留空则使用配置中的默认目录。",
			workspaceDefault: "使用默认目录",
			fieldModel: "模型",
			modelHint: "任务触发时使用的模型。主机默认跟随「设置 → 模型」。",
			modelDefault: "主机默认",
			modelLoading: "正在加载模型…",
			modelUnavailable: "无法加载模型列表，将使用主机默认模型。",
			detailWorkspace: "工作区",
			detailModel: "模型",
			cancel: "取消",
			create: "创建任务",
			creating: "正在创建…",
			edit: "编辑",
			save: "保存更改",
			saving: "正在保存…",
			loading: "正在加载定时任务…",
			emptyTitle: "这里还没有任务",
			emptyAll: "创建任务，让 Agent 在指定时间或固定周期自动执行工作。",
			emptyFilter: "符合此状态的任务会显示在这里。",
			scheduleOnce: "单次执行",
			scheduleRecurring: "周期执行 · {timeZone}",
			nextShort: "下次 {at}",
			"state.active": "待执行",
			"state.paused": "已暂停",
			"state.done": "已完成",
			detailId: "任务 ID",
			detailCreated: "创建时间",
			detailFires: "触发情况",
			detailLastRun: "最近运行",
			firedCount: "已触发 {count} 次",
			"outcome.delivered": "已投递",
			"outcome.completed": "已完成",
			"outcome.error": "执行失败",
			"outcome.cancelled": "已取消",
			"outcome.timeout": "执行超时",
			"outcome.submitting": "正在提交",
			"outcome.queued": "已排队",
			"outcome.claimed": "已领取",
			"outcome.running": "执行中",
			"outcome.cancelling": "正在取消",
			"outcome.succeeded": "已完成",
			"outcome.failed": "执行失败",
			"outcome.indeterminate": "需要人工确认",
			"outcome.interrupted": "需要人工确认",
			"outcome.blocked": "已阻止",
			"outcome.max-tokens": "达到 Token 上限",
			"outcome.aborted": "已中止",
			"outcome.not-dispatched": "未投递",
			"outcome.legacy": "旧版结果",
			runNow: "立即运行",
			pause: "暂停",
			resume: "恢复",
			remove: "删除",
			confirmRemove: "确定删除此任务？",
			confirm: "确认删除",
			errorLoad: "无法加载定时任务，后台将自动重试。",
			errorPrompt: "请输入任务说明。",
			errorSchedule: "请完整填写调度信息。",
			createErrorPrompt: "请输入任务说明。",
			createErrorCron: "请输入有效的五段 Cron 表达式。",
			createErrorTimeZone: "请输入有效的 IANA 时区名称。",
			createErrorFuture: "请选择未来的执行时间。",
			createErrorFrequent: "此规则的执行频率超过了当前允许的最小间隔。",
			createErrorLimit: "活动任务数量已达到上限。",
			createErrorUnreachable: "此规则在可计算范围内没有执行时间。",
			createErrorSchedule: "请填写一种完整有效的调度方式。",
			createErrorTarget: "请选择有效的绝对路径工作区目录。",
			errorWorkspaceForModel: "选择模型时请同时指定工作区目录。",
			errorNoTarget: "{id}：当前没有可用会话执行此任务。",
			errorMissing: "{id}：任务不存在。",
			errorUpdate: "{id}：此任务已无法更新。",
			noticeCreated: "已创建 {id}。",
			noticeUpdated: "已更新 {id}。",
			noticeDeduplicated: "相同的活动任务已经存在：{id}。",
			noticeFired: "已投递 {id}。",
			noticePaused: "已暂停 {id}。",
			noticeResumed: "已恢复 {id}。",
			noticeRemoved: "已删除 {id}。"
		};
		//#endregion
		//#region src/client/index.ts
		/**
		* dsh-cron browser half: scheduled tasks in the workbench tab strip.
		* Polls the host `/cron` channel — no model involvement.
		* @module
		*/
		/** Namespace owning the cron panel copy; merged into LocaleNamespaceMap. */
		const CRON_LOCALE_NS = "sidebar.cron";
		const CRON_TAB_LABEL = "Scheduled";
		const CRON_HERO_TOOL_ID = "scheduled";
		const inject = [
			"slots",
			"connection",
			"locale",
			"workspaces",
			"sessions"
		];
		const heroSessionsHook = useCronSessions;
		const heroWorkspacesHook = useCronWorkspaces;
		function ensureHeroRegistry() {
			if (typeof window === "undefined") return {
				register: () => () => {},
				get: () => void 0
			};
			if (!window.__dshHeroToolRegistry) {
				const map = /* @__PURE__ */ new Map();
				window.__dshHeroToolRegistry = {
					_map: map,
					register(id, factory) {
						map.set(id, factory);
						return () => {
							map.delete(id);
						};
					},
					get(id) {
						return map.get(id);
					}
				};
			}
			return window.__dshHeroToolRegistry;
		}
		function heroCronView(connection) {
			const t = (key, params) => formatCronMessage(en, key, params);
			return (0, react.createElement)(CronTabView, {
				connection,
				t,
				useSessions: heroSessionsHook,
				useWorkspaces: heroWorkspacesHook
			});
		}
		function bindFromContext(ctx) {
			bindHarnessRuntimeStores({
				workspaces: ctx.get("workspaces"),
				sessions: ctx.get("sessions")
			});
		}
		function apply(ctx) {
			const connection = ctx.get("connection");
			bindFromContext(ctx);
			ctx.effect(() => {
				bindFromContext(ctx);
				return () => {
					unbindHarnessRuntimeStores();
				};
			}, "dsh-cron: runtime stores");
			ctx.effect(() => ctx.locale.register(CRON_LOCALE_NS, {
				zh,
				en
			}), "dsh-cron: panel dictionaries");
			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: CRON_HERO_TOOL_ID,
				order: 46,
				label: () => CRON_TAB_LABEL,
				locale: CRON_LOCALE_NS,
				inject: () => ({
					connection,
					useSessions: heroSessionsHook,
					useWorkspaces: heroWorkspacesHook
				})
			}, CronTabView)), "dsh-cron: workbench tab");
			ctx.effect(() => {
				return ensureHeroRegistry().register(CRON_HERO_TOOL_ID, () => heroCronView(connection));
			}, "dsh-cron: hero tool");
		}
		//#endregion
		exports.CRON_HERO_TOOL_ID = CRON_HERO_TOOL_ID;
		exports.CRON_LOCALE_NS = CRON_LOCALE_NS;
		exports.CRON_TAB_LABEL = CRON_TAB_LABEL;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map
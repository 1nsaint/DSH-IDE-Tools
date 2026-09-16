// Settings polish: distinct nav icons for plugin sections; optional remote Settings unlock.
window.__ModuleLoader__.load({
	id: "dsh-settings-polish",
	factory: (require) => {
		const PLUGIN = "dsh-settings-polish";
		const FORCE_KEY = "dsh-settings-polish.forceLoopback";

		const ICON_CLASS = "dsh-settings-navIcon";

		/** Lucide-ish 16px outline SVGs (currentColor). */
		const ICONS = {
			Notifications: `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M8 1.5c-.41 0-.75.34-.75.75v.28A3.76 3.76 0 0 0 4.25 6.2v1.38c0 .55-.17 1.09-.49 1.55l-.62.9A.75.75 0 0 0 3.76 11.5h8.48a.75.75 0 0 0 .62-1.17l-.62-.9a2.76 2.76 0 0 1-.49-1.55V6.2A3.76 3.76 0 0 0 8.75 2.53V2.25c0-.41-.34-.75-.75-.75Zm0 11.25c.64 0 1.2-.34 1.5-.85H6.5c.3.51.86.85 1.5.85ZM3.5 6.2A4.5 4.5 0 0 1 8 1.75a4.5 4.5 0 0 1 4.5 4.45v1.38c0 .36.11.7.32 1l.62.9A1.5 1.5 0 0 1 12.24 12.25H3.76a1.5 1.5 0 0 1-1.2-2.42l.62-.9c.21-.3.32-.64.32-1V6.2Zm3.35 6.55A2.25 2.25 0 0 0 8 13.5c.72 0 1.36-.34 1.75-.85H6.85Z"/></svg>`,
			Archived: `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 4.5h11v1.5H2.5z"/><path d="M3.5 6v6.5a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1V6"/><path d="M6.5 8.5h3"/></svg>`,
			"Web Search": `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="7" cy="7" r="4.25"/><path d="m10.5 10.5 3 3"/></svg>`,
			Containers: `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 7.7c0-.6-.4-1.2-.8-1.5l-6.3-3.9a1.72 1.72 0 0 0-1.7 0l-10.3 6c-.5.2-.9.8-.9 1.4v6.6c0 .5.4 1.2.8 1.5l6.3 3.9a1.72 1.72 0 0 0 1.7 0l10.3-6c.5-.3.9-1 .9-1.5Z"/><path d="M10 21.9V14L2.1 9.1"/><path d="m10 14 11.9-6.9"/><path d="M14 19.8v-8.1"/><path d="M18 17.5V9.4"/></svg>`,
			Database: `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5V19A9 3 0 0 0 21 19V5"/><path d="M3 12A9 3 0 0 0 21 12"/></svg>`,
			"AI Metrics": `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>`,
			"Workspace colors": `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="13.5" cy="6.5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="12" r="2.5"/><circle cx="8.5" cy="18.5" r="2.5"/><circle cx="15.5" cy="18.5" r="2.5"/></svg>`,
			Git: `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><line x1="6" x2="6" y1="3" y2="15"/><circle cx="18" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M18 9a9 9 0 0 1-9 9"/></svg>`,
			SSH: `<svg width="16" height="16" class="${ICON_CLASS}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,
		};

		const css = `
.${ICON_CLASS}{width:16px;height:16px;flex:none;display:block}
button[class*="_navCell"] svg.${ICON_CLASS}{margin:0}
.dsh_tabSettingsBtn{box-sizing:border-box;height:30px;width:30px;padding:0;margin-left:auto;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
.dsh_tabSettingsBtn:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
.dsh_tabSettingsBtn svg{display:block}
`;

		/** section id → Settings nav label (must match settings.section label text). */
		const SECTION_LABELS = {
			database: "Database",
			containers: "Containers",
			"ai-metrics": "AI Metrics",
			"web-search-router": "Web Search",
			archive: "Archived",
			"workspace-accent": "Workspace colors",
			notify: "Notifications",
			git: "Git",
			"ssh-workspace": "SSH",
			"agent-presets": "Agent presets",
		};

		/** Deep-link aliases → nav section + optional Agent presets sub-tab. */
		const SECTION_ALIASES = {
			"local-agent": { label: "Agent presets", agentPresetsTab: "lite" },
			"lite-mode": { label: "Agent presets", agentPresetsTab: "lite" },
		};

		const GEAR_SVG = `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-settings-polish-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-settings-polish-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function cellLabel(btn) {
			const clone = btn.cloneNode(true);
			clone.querySelectorAll("svg").forEach((s) => s.remove());
			return (clone.textContent || "").trim();
		}

		function polishNav() {
			const cells = document.querySelectorAll('button[class*="_navCell"]');
			for (const btn of cells) {
				const label = cellLabel(btn);
				const svg = ICONS[label];
				if (!svg) continue;
				if (btn.getAttribute("data-dsh-settings-icon") === label && btn.querySelector(`svg.${ICON_CLASS}`)) {
					continue;
				}
				const existing = btn.querySelector("svg");
				const wrap = document.createElement("span");
				wrap.innerHTML = svg;
				const next = wrap.firstElementChild;
				if (!next) continue;
				if (existing) existing.replaceWith(next);
				else btn.prepend(next);
				btn.setAttribute("data-dsh-settings-icon", label);
			}
		}

		function resolveSectionLabel(section) {
			const key = String(section || "").trim();
			if (!key) return null;
			if (SECTION_ALIASES[key]) return SECTION_ALIASES[key].label;
			if (SECTION_LABELS[key]) return SECTION_LABELS[key];
			// Accept nav label directly.
			for (const label of Object.values(SECTION_LABELS)) {
				if (label.toLowerCase() === key.toLowerCase()) return label;
			}
			return key;
		}

		function resolveSectionAlias(section) {
			const key = String(section || "").trim();
			return SECTION_ALIASES[key] || null;
		}

		function settingsPanelOpen() {
			return !!document.querySelector('.VOzbGW_panel[role="dialog"], [class*="_panel"][role="dialog"]');
		}

		function clickSettingsTrigger() {
			const btn =
				document.querySelector('[class*="_settingsArea"] button[aria-haspopup="dialog"]') ||
				document.querySelector("button.VOzbGW_trigger") ||
				document.querySelector('[class*="_settingsArea"] button');
			if (btn instanceof HTMLElement) {
				btn.click();
				return true;
			}
			return false;
		}

		function clickNavCell(label) {
			polishNav();
			let cell = document.querySelector(`button[data-dsh-settings-icon="${CSS.escape(label)}"]`);
			if (!cell) {
				for (const btn of document.querySelectorAll('button[class*="_navCell"]')) {
					if (cellLabel(btn) === label) {
						cell = btn;
						break;
					}
				}
			}
			if (cell instanceof HTMLElement) {
				cell.click();
				return true;
			}
			return false;
		}

		/** Open Settings and select a section by id or nav label. */
		function openSettingsSection(section) {
			const alias = resolveSectionAlias(section);
			const label = resolveSectionLabel(section);
			if (!label) return false;
			if (alias?.agentPresetsTab && typeof window.__dshAgentPresetsTab === "function") {
				window.__dshAgentPresetsTab(alias.agentPresetsTab);
			}
			if (!settingsPanelOpen()) clickSettingsTrigger();
			let tries = 0;
			const tick = () => {
				if (clickNavCell(label)) {
					if (alias?.agentPresetsTab && typeof window.__dshAgentPresetsTab === "function") {
						window.__dshAgentPresetsTab(alias.agentPresetsTab);
					}
					return;
				}
				if (tries++ > 30) return;
				requestAnimationFrame(tick);
			};
			requestAnimationFrame(tick);
			return true;
		}

		function gearButton(React, { section, title }) {
			const label = resolveSectionLabel(section) || section;
			return React.createElement("button", {
				type: "button",
				className: "dsh_tabSettingsBtn",
				title: title || `${label} settings`,
				"aria-label": title || `${label} settings`,
				onClick: (e) => {
					e.stopPropagation();
					openSettingsSection(section);
				},
				dangerouslySetInnerHTML: { __html: GEAR_SVG },
			});
		}

		function isLoopbackHost(hostname) {
			const h = String(hostname || "").toLowerCase();
			return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || h === "::1";
		}

		function wantForceLoopback() {
			try {
				const v = localStorage.getItem(FORCE_KEY);
				if (v === "0" || v === "false") return false;
				if (v === "1" || v === "true") return true;
			} catch { /* ignore */ }
			// Default: unlock Settings when UI is served on a non-loopback host
			// (typical reverse-proxy deploy). Opt out with localStorage key = "0".
			return typeof location !== "undefined" && !isLoopbackHost(location.hostname);
		}

		function tryForceLoopback(connection) {
			if (!wantForceLoopback() || !connection) return;
			try {
				const desc = Object.getOwnPropertyDescriptor(connection, "isLoopback");
				if (desc && desc.configurable === false && !desc.set && desc.get) {
					// already a non-configurable getter — may still be our image patch
					return;
				}
				Object.defineProperty(connection, "isLoopback", {
					configurable: true,
					enumerable: true,
					get: () => true,
					set: () => {},
				});
				console.info(`[${PLUGIN}] connection.isLoopback forced true (remote Settings). Set localStorage['${FORCE_KEY}']='0' to disable.`);
			} catch (err) {
				console.warn(`[${PLUGIN}] could not override isLoopback — keep image patch or proxy Host rewrite`, err);
			}
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			ensureStyles();
			const connection = ctx.get("connection");
			tryForceLoopback(connection);

			window.__dshOpenSettings = openSettingsSection;
			window.__dshSettingsGear = gearButton;

			ctx.effect(() => {
				ensureStyles();
				polishNav();
				const root = document.getElementById("root") || document.body;
				const mo = new MutationObserver(() => polishNav());
				mo.observe(root, { childList: true, subtree: true });
				const onOpen = (ev) => {
					const section = ev?.detail?.section ?? ev?.detail;
					openSettingsSection(section);
				};
				window.addEventListener("dsh:open-settings", onOpen);
				return () => {
					mo.disconnect();
					window.removeEventListener("dsh:open-settings", onOpen);
					if (window.__dshOpenSettings === openSettingsSection) delete window.__dshOpenSettings;
					if (window.__dshSettingsGear === gearButton) delete window.__dshSettingsGear;
				};
			}, `${PLUGIN}: nav icons + open settings`);
		}

		return { apply, inject };
	},
});

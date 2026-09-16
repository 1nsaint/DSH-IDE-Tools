// Peacock-lite: per-workspace accent (hash default + Settings overrides).
// Tints sidebar folder icons; active workspace drives chrome tokens.
// Overrides: palette id, or a custom #rrggbb hex.
window.__ModuleLoader__.load({
	id: "dsh-workspace-accent",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-workspace-accent";
		const STORE_KEY = "dsh-workspace-accent.overrides.v1";
		const CONFIG_EVENT = "dsh-workspace-accent-config";

		const PALETTE = [
			{ id: "teal", primary: { light: "#0d9488", dark: "#2dd4bf" }, tertiary: { light: "#ccfbf1", dark: "#134e4a" } },
			{ id: "cyan", primary: { light: "#0891b2", dark: "#22d3ee" }, tertiary: { light: "#cffafe", dark: "#164e63" } },
			{ id: "sky", primary: { light: "#0284c7", dark: "#38bdf8" }, tertiary: { light: "#e0f2fe", dark: "#0c4a6e" } },
			{ id: "blue", primary: { light: "#2563eb", dark: "#60a5fa" }, tertiary: { light: "#dbeafe", dark: "#1e3a8a" } },
			{ id: "indigo", primary: { light: "#4f46e5", dark: "#818cf8" }, tertiary: { light: "#e0e7ff", dark: "#312e81" } },
			{ id: "violet", primary: { light: "#7c3aed", dark: "#a78bfa" }, tertiary: { light: "#ede9fe", dark: "#4c1d95" } },
			{ id: "fuchsia", primary: { light: "#c026d3", dark: "#e879f9" }, tertiary: { light: "#fae8ff", dark: "#701a75" } },
			{ id: "pink", primary: { light: "#db2777", dark: "#f472b6" }, tertiary: { light: "#fce7f3", dark: "#831843" } },
			{ id: "rose", primary: { light: "#e11d48", dark: "#fb7185" }, tertiary: { light: "#ffe4e6", dark: "#881337" } },
			{ id: "red", primary: { light: "#dc2626", dark: "#f87171" }, tertiary: { light: "#fee2e2", dark: "#7f1d1d" } },
			{ id: "orange", primary: { light: "#ea580c", dark: "#fb923c" }, tertiary: { light: "#ffedd5", dark: "#7c2d12" } },
			{ id: "amber", primary: { light: "#d97706", dark: "#fbbf24" }, tertiary: { light: "#fef3c7", dark: "#78350f" } },
			{ id: "yellow", primary: { light: "#ca8a04", dark: "#facc15" }, tertiary: { light: "#fef9c3", dark: "#713f12" } },
			{ id: "lime", primary: { light: "#65a30d", dark: "#a3e635" }, tertiary: { light: "#ecfccb", dark: "#365314" } },
			{ id: "green", primary: { light: "#16a34a", dark: "#4ade80" }, tertiary: { light: "#dcfce7", dark: "#14532d" } },
			{ id: "emerald", primary: { light: "#059669", dark: "#34d399" }, tertiary: { light: "#d1fae5", dark: "#064e3b" } },
			{ id: "slate", primary: { light: "#475569", dark: "#94a3b8" }, tertiary: { light: "#e2e8f0", dark: "#1e293b" } },
			{ id: "stone", primary: { light: "#57534e", dark: "#a8a29e" }, tertiary: { light: "#e7e5e4", dark: "#292524" } },
		];

		const css = `
[class*="_folder"].dsh-ws-accent-folder,
[class*="_folder"].dsh-ws-accent-folder svg,
[class*="_folder"].dsh-ws-accent-folder path{
  color: var(--dsh-ws-folder-color) !important;
  fill: var(--dsh-ws-folder-color) !important;
}
[class*="_folder"].dsh-ws-accent-folder:not([class*="_folderActive"]){opacity:0.92}
.dwa_form{display:flex;flex-direction:column;gap:14px;max-width:640px}
.dwa_hint{margin:0;font-size:12px;line-height:1.45;color:var(--dsw-alias-label-tertiary)}
.dwa_row{display:flex;flex-direction:column;gap:8px;padding:12px 0;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dwa_row:last-child{border-bottom:none}
.dwa_rowHead{display:flex;align-items:center;gap:10px}
.dwa_swatch{width:14px;height:14px;border-radius:4px;flex:none;border:1px solid var(--dsw-alias-border-l2)}
.dwa_name{flex:1;font-size:13px;font-weight:500;color:var(--dsw-alias-label-primary);min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dwa_meta{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code, ui-monospace, monospace)}
.dwa_picks{
  display:flex;flex-wrap:nowrap;gap:6px;align-items:center;
  overflow-x:auto;overflow-y:hidden;
  max-width:100%;padding:2px 0 6px;
  scroll-snap-type:x proximity;
  -webkit-overflow-scrolling:touch;
  scrollbar-width:thin;
}
.dwa_picks::-webkit-scrollbar{height:4px}
.dwa_picks::-webkit-scrollbar-thumb{background:var(--dsw-alias-border-l2);border-radius:4px}
.dwa_pick{
  width:28px;height:28px;border-radius:8px;border:2px solid transparent;cursor:pointer;padding:0;
  background:var(--dwa-pick);box-sizing:border-box;
  flex:none;scroll-snap-align:start;
}
.dwa_pick:hover{filter:brightness(1.08)}
.dwa_pickActive{border-color:var(--dsw-alias-label-primary);box-shadow:0 0 0 1px var(--dsw-alias-bg-base)}
.dwa_pickAuto{
  width:auto;min-width:28px;padding:0 8px;background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);font:inherit;font-size:11px;font-weight:500;
  border:1px solid var(--dsw-alias-border-l2);
  flex:none;scroll-snap-align:start;
}
.dwa_pickAuto.dwa_pickActive{border-color:var(--dsw-alias-state-business-primary);color:var(--dsw-alias-state-business-primary)}
.dwa_customRow{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
.dwa_hex{
  height:28px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);
  padding:0 10px;width:110px;box-sizing:border-box;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:12px;font-family:var(--ds-font-family-code, ui-monospace, monospace);
}
.dwa_hex:focus{outline:2px solid var(--dsw-alias-state-business-primary);outline-offset:1px}
.dwa_nativeColor{
  width:28px;height:28px;padding:0;border:1px solid var(--dsw-alias-border-l2);
  border-radius:8px;cursor:pointer;background:transparent;overflow:hidden;
}
.dwa_nativeColor::-webkit-color-swatch-wrapper{padding:2px}
.dwa_nativeColor::-webkit-color-swatch{border:none;border-radius:5px}
.dwa_apply{
  height:28px;border-radius:8px;padding:0 10px;cursor:pointer;font:inherit;font-size:11px;font-weight:500;
  border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);
  color:var(--dsw-alias-label-secondary);
}
.dwa_apply:hover{color:var(--dsw-alias-label-primary)}
.dwa_apply:disabled{opacity:0.5;cursor:default}
.dwa_empty{font-size:13px;color:var(--dsw-alias-label-tertiary);padding:8px 0}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-workspace-accent-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-workspace-accent-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		const RPC = "/workspace-accent";
		let activeConnection = null;
		let cachedOverrides = null;

		function getRawLocalOverrides() {
			try {
				const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
				return raw && typeof raw === "object" ? raw : {};
			} catch {
				return {};
			}
		}

		function loadOverrides() {
			if (cachedOverrides && typeof cachedOverrides === "object") return cachedOverrides;
			cachedOverrides = getRawLocalOverrides();
			return cachedOverrides;
		}

		function saveLocalOverrides(map) {
			const clean = map && typeof map === "object" ? map : {};
			cachedOverrides = clean;
			try {
				localStorage.setItem(STORE_KEY, JSON.stringify(clean));
			} catch {}
			window.dispatchEvent(new CustomEvent(CONFIG_EVENT, { detail: clean }));
			return clean;
		}

		async function callRpc(conn, endpoint, payload) {
			const target = conn || activeConnection;
			if (!target) return null;
			const res = await target.rpc.call(RPC, endpoint, payload ?? {});
			if (!res.ok) throw new Error(res.error?.message || `${endpoint} failed`);
			return res.value;
		}

		async function syncOverridesWithServer(conn) {
			const target = conn || activeConnection;
			if (!target) return loadOverrides();
			const local = getRawLocalOverrides();
			try {
				const res = await callRpc(target, "syncOverrides", { overrides: local });
				if (res?.overrides && typeof res.overrides === "object") {
					return saveLocalOverrides(res.overrides);
				}
			} catch (err) {
				console.warn(`[${PLUGIN}] server sync failed`, err);
			}
			return loadOverrides();
		}

		async function saveOverrides(map) {
			const clean = saveLocalOverrides(map);
			const target = activeConnection;
			if (target) {
				try {
					await callRpc(target, "saveOverrides", { overrides: clean });
				} catch (err) {
					console.warn(`[${PLUGIN}] saveOverrides failed`, err);
				}
			}
			return clean;
		}

		function hashKey(key) {
			let h = 2166136261;
			const s = String(key || "default");
			for (let i = 0; i < s.length; i++) {
				h ^= s.charCodeAt(i);
				h = Math.imul(h, 16777619);
			}
			return h >>> 0;
		}

		function clampByte(n) {
			return Math.max(0, Math.min(255, Math.round(n)));
		}

		function hexToRgb(hex) {
			const m = /^#([0-9a-f]{6})$/i.exec(hex);
			if (!m) return null;
			const n = parseInt(m[1], 16);
			return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
		}

		function rgbToHex(r, g, b) {
			return `#${[r, g, b].map((v) => clampByte(v).toString(16).padStart(2, "0")).join("")}`;
		}

		function mixRgb(a, b, t) {
			return {
				r: a.r + (b.r - a.r) * t,
				g: a.g + (b.g - a.g) * t,
				b: a.b + (b.b - a.b) * t,
			};
		}

		/** Normalize user input to #rrggbb, or null. */
		function normalizeHex(input) {
			if (typeof input !== "string") return null;
			let s = input.trim().toLowerCase();
			if (!s) return null;
			if (s.startsWith("custom:")) s = s.slice(7).trim();
			if (!s.startsWith("#")) s = `#${s}`;
			if (/^#[0-9a-f]{3}$/i.test(s)) {
				s = `#${s[1]}${s[1]}${s[2]}${s[2]}${s[3]}${s[3]}`;
			}
			return /^#[0-9a-f]{6}$/i.test(s) ? s.toLowerCase() : null;
		}

		function isCustomOverride(ov) {
			return Boolean(normalizeHex(typeof ov === "string" ? ov : ""));
		}

		function accentFromHex(hexRaw) {
			const hex = normalizeHex(hexRaw);
			if (!hex) return null;
			const rgb = hexToRgb(hex);
			const white = { r: 255, g: 255, b: 255 };
			const black = { r: 0, g: 0, b: 0 };
			const lightPrimary = mixRgb(rgb, black, 0.08);
			const darkPrimary = mixRgb(rgb, white, 0.28);
			const lightTertiary = mixRgb(rgb, white, 0.88);
			const darkTertiary = mixRgb(rgb, black, 0.72);
			return {
				id: `custom:${hex}`,
				custom: true,
				hex,
				primary: {
					light: rgbToHex(lightPrimary.r, lightPrimary.g, lightPrimary.b),
					dark: rgbToHex(darkPrimary.r, darkPrimary.g, darkPrimary.b),
				},
				tertiary: {
					light: rgbToHex(lightTertiary.r, lightTertiary.g, lightTertiary.b),
					dark: rgbToHex(darkTertiary.r, darkTertiary.g, darkTertiary.b),
				},
			};
		}

		function accentById(id) {
			return PALETTE.find((p) => p.id === id) || null;
		}

		function autoAccent(key) {
			return PALETTE[hashKey(key) % PALETTE.length];
		}

		function pickAccent(key) {
			const ov = loadOverrides()[key];
			if (ov && ov !== "auto") {
				const custom = accentFromHex(ov);
				if (custom) return custom;
				const hit = accentById(ov);
				if (hit) return hit;
			}
			return autoAccent(key);
		}

		function isDarkTheme() {
			try {
				const raw = document.documentElement.dataset.theme
					|| document.documentElement.getAttribute("data-theme")
					|| document.body?.dataset?.theme
					|| "";
				if (/dark/i.test(raw)) return true;
				if (/light/i.test(raw)) return false;
				return window.matchMedia?.("(prefers-color-scheme: dark)")?.matches ?? true;
			} catch {
				return true;
			}
		}

		function accentColor(accent) {
			return isDarkTheme() ? accent.primary.dark : accent.primary.light;
		}

		function overrideLabel(current, effective) {
			if (current === "auto") return `auto · ${effective.id}`;
			if (isCustomOverride(current)) return normalizeHex(current) || current;
			return current;
		}

		function workspaceKeyFromItem(w) {
			return w?.workspaceId || w?.id || w?.path || w?.name || w?.title || "default";
		}

		function workspaceLabel(w) {
			return String(w?.name || w?.title || w?.label || w?.path || "").trim();
		}

		function resolveWorkspaceKey(sessions, workspaces) {
			try {
				const sessSnap = sessions?.list?.getSnapshot?.();
				const wsSnap = workspaces?.list?.getSnapshot?.();
				const current = sessSnap?.current;
				const items = wsSnap?.items || [];
				if (current) {
					const hit = items.find((w) => Array.isArray(w.sessionIds) && w.sessionIds.includes(current));
					if (hit) return workspaceKeyFromItem(hit);
				}
				if (typeof window !== "undefined" && window.__dshCurrentWorkspace?.get) {
					const active = window.__dshCurrentWorkspace.get();
					if (active?.key) return active.key;
				}
				try {
					const raw = localStorage.getItem("dsh-sidebar-files.currentWorkspace.v1");
					if (raw) {
						const parsed = JSON.parse(raw);
						if (parsed?.key) return parsed.key;
					}
				} catch { /* ignore */ }
				if (wsSnap?.recentWorkspaceId) return wsSnap.recentWorkspaceId;
				const summary = current && sessSnap?.byId?.[current];
				if (summary?.cwd) return summary.cwd;
			} catch {
				/* ignore */
			}
			return "default";
		}

		function paintFolderIcons(workspaces) {
			ensureStyles();
			const items = workspaces?.list?.getSnapshot?.()?.items || [];
			const byLabel = new Map();
			for (const w of items) {
				const label = workspaceLabel(w);
				if (label) byLabel.set(label.toLowerCase(), w);
			}
			for (const row of document.querySelectorAll('[class*="_projectRow"]')) {
				// Exact local `title` / `folder` — not titleRow / folderActive-only misses.
				const titleEl = [...row.querySelectorAll('[class*="_title"]')].find((el) =>
					[...el.classList].some((c) => c === "title" || c.endsWith("_title"))
				);
				const folder = [...row.querySelectorAll('[class*="_folder"]')].find((el) =>
					[...el.classList].some((c) => c === "folder" || c.endsWith("_folder"))
				);
				if (!titleEl || !folder) continue;
				const title = (titleEl.textContent || "").replace(/\s+/g, " ").trim();
				// Stock "Ungrouped" is an orphan-session bucket, not a workspace — don't accent it.
				if (!title || /^ungrouped$/i.test(title) || title === "未分组") {
					folder.classList.remove("dsh-ws-accent-folder");
					folder.style.removeProperty("--dsh-ws-folder-color");
					delete folder.dataset.dshWsAccent;
					continue;
				}
				const hit = byLabel.get(title.toLowerCase());
				if (!hit) {
					// Don't invent colors for rows that aren't registered workspaces.
					folder.classList.remove("dsh-ws-accent-folder");
					folder.style.removeProperty("--dsh-ws-folder-color");
					delete folder.dataset.dshWsAccent;
					continue;
				}
				const key = workspaceKeyFromItem(hit);
				const accent = pickAccent(key);
				folder.classList.add("dsh-ws-accent-folder");
				folder.style.setProperty("--dsh-ws-folder-color", accentColor(accent));
				folder.dataset.dshWsAccent = accent.id;
			}
		}

		function HexRow({ value, onApply }) {
			const [draft, setDraft] = React.useState(value || "#");
			React.useEffect(() => {
				setDraft(value || "#");
			}, [value]);

			const normalized = normalizeHex(draft);
			const pickerValue = normalized || "#808080";

			const commit = (raw) => {
				const hex = normalizeHex(raw);
				if (!hex) return;
				setDraft(hex);
				onApply(hex);
			};

			return React.createElement("div", { className: "dwa_customRow" },
				React.createElement("input", {
					type: "color",
					className: "dwa_nativeColor",
					title: "Pick any color",
					value: pickerValue,
					onChange: (e) => commit(e.target.value),
				}),
				React.createElement("input", {
					className: "dwa_hex",
					value: draft,
					spellCheck: false,
					autoComplete: "off",
					placeholder: "#rrggbb",
					title: "Hex color (#rgb or #rrggbb)",
					onChange: (e) => setDraft(e.target.value),
					onKeyDown: (e) => {
						if (e.key === "Enter") {
							e.preventDefault();
							commit(draft);
						}
					},
					onBlur: () => {
						if (normalizeHex(draft)) commit(draft);
					},
				}),
				React.createElement("button", {
					type: "button",
					className: "dwa_apply",
					disabled: !normalized,
					onClick: () => commit(draft),
				}, "Apply hex"),
			);
		}

		function AccentSettings({ workspaces }) {
			const [overrides, setOverrides] = React.useState(loadOverrides);
			const [, setTick] = React.useState(0);

			React.useEffect(() => {
				ensureStyles();
				const onCfg = () => setOverrides(loadOverrides());
				window.addEventListener(CONFIG_EVENT, onCfg);
				const id = window.setInterval(() => setTick((t) => t + 1), 2500);
				return () => {
					window.removeEventListener(CONFIG_EVENT, onCfg);
					window.clearInterval(id);
				};
			}, []);

			const items = workspaces?.list?.getSnapshot?.()?.items || [];

			const setColor = (key, accentId) => {
				const next = { ...loadOverrides() };
				if (!accentId || accentId === "auto") delete next[key];
				else {
					const hex = normalizeHex(accentId);
					next[key] = hex || accentId;
				}
				saveOverrides(next);
				setOverrides(next);
			};

			return React.createElement("div", { className: "dwa_form" },
				React.createElement("p", { className: "dwa_hint" },
					"Sidebar folder color per workspace, plus subtle chrome when that workspace is active. ",
					"Auto hashes the workspace id; pick a swatch, or set any #hex / use the color picker."),
				!items.length && React.createElement("div", { className: "dwa_empty" },
					"No workspaces yet — create one in the sidebar."),
				items.map((w) => {
					const key = workspaceKeyFromItem(w);
					const label = workspaceLabel(w) || key;
					const current = overrides[key] || "auto";
					const effective = pickAccent(key);
					const customHex = isCustomOverride(current) ? normalizeHex(current) : (effective.hex || null);
					return React.createElement("div", { key, className: "dwa_row" },
						React.createElement("div", { className: "dwa_rowHead" },
							React.createElement("span", {
								className: "dwa_swatch",
								style: { background: accentColor(effective) },
							}),
							React.createElement("span", { className: "dwa_name", title: key }, label),
							React.createElement("span", { className: "dwa_meta" },
								overrideLabel(current, effective)),
						),
						React.createElement("div", { className: "dwa_picks" },
							React.createElement("button", {
								type: "button",
								className: "dwa_pick dwa_pickAuto" + (current === "auto" ? " dwa_pickActive" : ""),
								title: "Automatic",
								onClick: () => setColor(key, "auto"),
							}, "Auto"),
							...PALETTE.map((p) => React.createElement("button", {
								type: "button",
								key: p.id,
								className: "dwa_pick" + (current === p.id ? " dwa_pickActive" : ""),
								title: p.id,
								style: { ["--dwa-pick"]: isDarkTheme() ? p.primary.dark : p.primary.light },
								onClick: () => setColor(key, p.id),
							})),
						),
						React.createElement(HexRow, {
							value: customHex || "#",
							onApply: (hex) => setColor(key, hex),
						}),
					);
				}),
			);
		}

		const inject = ["theme", "sessions", "workspaces", "slots", "connection"];

		function apply(ctx) {
			ensureStyles();
			ctx.inject(["theme", "sessions", "workspaces", "slots", "connection"], (scope) => {
				const theme = scope.get("theme");
				const sessions = scope.sessions || scope.get("sessions");
				const workspaces = scope.workspaces || scope.get("workspaces");
				const slots = scope.slots || scope.get("slots") || ctx.slots;
				const connection = scope.get("connection");
				activeConnection = connection;
				if (connection) {
					syncOverridesWithServer(connection).catch(console.warn);
				}
				if (!theme?.overrideTokens || !sessions?.list || !workspaces?.list) {
					console.warn(`[${PLUGIN}] missing theme/sessions/workspaces`);
					return;
				}

				let lastKey = null;
				let lastAccentId = null;
				let disposeLayer = null;
				let paintRaf = 0;

				const schedulePaint = () => {
					cancelAnimationFrame(paintRaf);
					paintRaf = requestAnimationFrame(() => paintFolderIcons(workspaces));
				};

				const sync = (force) => {
					const key = resolveWorkspaceKey(sessions, workspaces);
					const accent = pickAccent(key);
					schedulePaint();
					if (!force && key === lastKey && accent.id === lastAccentId) return;
					lastKey = key;
					lastAccentId = accent.id;
					disposeLayer?.();
					disposeLayer = theme.overrideTokens(PLUGIN, {
						"--dsw-alias-state-business-primary": {
							light: accent.primary.light,
							dark: accent.primary.dark,
						},
						"--dsw-alias-state-business-tertiary": {
							light: accent.tertiary.light,
							dark: accent.tertiary.dark,
						},
						"--dsw-specific-sidebar-nav-item-active-accent": {
							light: accent.tertiary.light,
							dark: accent.tertiary.dark,
						},
						"--dsw-alias-button-info-fill": {
							light: accent.primary.light,
							dark: accent.primary.dark,
						},
						"--dsw-specific-bubble": {
							light: accent.tertiary.light,
							dark: accent.tertiary.dark,
						},
					});
					try {
						document.documentElement.dataset.workspaceAccent = accent.id;
					} catch {
						/* ignore */
					}
				};

				scope.effect(() => {
					const u1 = sessions.list.subscribe(() => sync(false));
					const u2 = workspaces.list.subscribe(() => sync(false));
					const onCfg = () => sync(true);
					window.addEventListener(CONFIG_EVENT, onCfg);
					window.addEventListener("dsh-current-workspace-changed", onCfg);
					sync(true);
					const root = document.getElementById("root") || document.body;
					const mo = new MutationObserver(schedulePaint);
					mo.observe(root, { childList: true, subtree: true });
					return () => {
						u1();
						u2();
						window.removeEventListener(CONFIG_EVENT, onCfg);
						window.removeEventListener("dsh-current-workspace-changed", onCfg);
						mo.disconnect();
						cancelAnimationFrame(paintRaf);
						disposeLayer?.();
						disposeLayer = null;
						lastKey = null;
						lastAccentId = null;
					};
				}, `${PLUGIN}: accent sync`);

				if (slots?.inject) {
					scope.effect(() => slots.inject("settings.section", () => slots.register({
						name: "settings.section",
						id: "workspace-accent",
						order: 185,
						label: () => "Workspace colors",
						inject: () => ({ workspaces }),
					}, AccentSettings)), `${PLUGIN}: settings`);
				}
			});
		}

		if (typeof window !== "undefined") {
			window.__dshWorkspaceAccent = {
				keyFromItem: workspaceKeyFromItem,
				colorForKey: (key) => accentColor(pickAccent(String(key || "default"))),
			};
		}

		return { apply, inject };
	},
});

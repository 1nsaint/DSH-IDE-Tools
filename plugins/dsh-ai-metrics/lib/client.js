// Configurable AI host memory donut (sidebar) + Settings.
// Adapters: off | json | ollama | prometheus | jetson
window.__ModuleLoader__.load({
	id: "dsh-ai-metrics",
	factory: (require) => {
		const React = require("react");
		const ReactDOM = require("react-dom");
		const PLUGIN = "dsh-ai-metrics";
		const STORE_KEY = "dsh-ai-metrics.config.v1";
		const POLL_MS = 12_000;
		const CONFIG_EVENT = "dsh-ai-metrics-config";

		const ADAPTERS = [
			{ id: "off", label: "Off (hide widget)" },
			{ id: "json", label: "JSON (total_bytes + used/available)" },
			{ id: "ollama", label: "Ollama (/api/ps)" },
			{ id: "prometheus", label: "Prometheus (/metrics text)" },
			{ id: "jetson", label: "Jetson / rubberrobo metrics-api" },
		];

		const DEFAULT_COLORS = {
			used: "rgba(37, 117, 252, 0.9)",
			model: "rgba(37, 117, 252, 0.9)",
			programs: "rgba(155, 89, 182, 0.88)",
			system: "rgba(255, 193, 7, 0.85)",
			free: "rgba(108, 116, 128, 0.75)",
			track: "rgba(128, 136, 152, 0.22)",
			error: "rgba(231, 76, 60, 0.75)",
			cpu: "rgba(52, 211, 153, 0.9)",
			gpu: "rgba(96, 165, 250, 0.9)",
		};

		const COLOR_FIELDS = [
			{ key: "used", label: "Used / models", hint: "JSON / Ollama / Prometheus used slice" },
			{ key: "model", label: "Model (Jetson)", hint: "Active model weight" },
			{ key: "programs", label: "Apps (Jetson)", hint: "Containers / programs" },
			{ key: "system", label: "System (Jetson)", hint: "OS / other used" },
			{ key: "free", label: "Free", hint: "Available slice" },
			{ key: "cpu", label: "CPU bar", hint: "CPU load bar fill" },
			{ key: "gpu", label: "GPU bar", hint: "GPU load bar fill" },
			{ key: "track", label: "Ring / bar track", hint: "Empty background" },
			{ key: "error", label: "Error", hint: "Fetch failure ring" },
		];

		const DEFAULTS = {
			adapter: "jetson",
			url: "/jetson-metrics-api/api/ai/active",
			label: "Jetson RAM",
			clickUrl: "https://rubberrobo.nl/ai/",
			totalBytes: "",
			colors: { ...DEFAULT_COLORS },
		};

		const css = `
.hHd-Xa_footerActions{flex-direction:column;align-items:stretch;width:100%}
.dam_layer{width:100%;max-width:100%;box-sizing:border-box}
.dam_layer.dam_rail{width:36px;align-self:center}
.dam_tipWrap{position:relative;display:block;width:100%;max-width:100%;box-sizing:border-box}
.dam_btn{box-sizing:border-box;width:100%;max-width:100%;min-height:42px;height:auto;margin:4px 0;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:6px 8px;font:inherit;font-size:14px;display:flex;flex-direction:row;overflow:hidden}
.dam_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dam_btnMain{display:flex;flex-direction:column;align-items:stretch;gap:4px;min-width:0;flex:1}
.dam_btnTop{display:flex;align-items:center;gap:6px;min-width:0;width:100%}
.dam_rail .dam_btn{width:36px;min-height:36px;margin:8px 0 6px;border-radius:12px;justify-content:center;padding:4px;flex-direction:column;align-items:center;gap:4px}
.dam_rail .dam_btnMain{display:none}
.dam_line{display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden}
.dam_label{font-size:14px;font-weight:500;line-height:20px;white-space:nowrap}
.dam_sub{font-size:14px;line-height:20px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}
.dam_donut{flex:none;display:block}
.dam_loads{display:flex;flex-direction:column;gap:3px;width:100%;min-width:0;box-sizing:border-box}
.dam_rail .dam_loads{width:100%;gap:2px}
.dam_loadRow{display:flex;align-items:center;gap:6px;min-width:0}
.dam_rail .dam_loadRow{gap:0}
.dam_loadName{flex:none;width:26px;font-size:9px;font-weight:600;letter-spacing:0.02em;line-height:1;color:var(--dsw-alias-label-tertiary);text-transform:uppercase}
.dam_rail .dam_loadName{display:none}
.dam_loadTrack{flex:1;min-width:0;height:3px;border-radius:999px;background:var(--dam-load-track, rgba(128,136,152,0.22));overflow:hidden}
.dam_rail .dam_loadTrack{height:2px}
.dam_loadFill{display:block;height:100%;border-radius:inherit;width:0;max-width:100%;transition:width .35s ease}
.dam_loadPct{flex:none;width:28px;font-size:9px;line-height:1;text-align:right;color:var(--dsw-alias-label-tertiary);font-variant-numeric:tabular-nums}
.dam_rail .dam_loadPct{display:none}
.dam_tip{font-size:12px;line-height:18px;max-width:min(260px,calc(100vw - 24px));min-width:160px;box-sizing:border-box;color:var(--dsw-alias-label-primary);padding:8px 10px;border-radius:10px;background:var(--dsw-alias-bg-layer-3,#2a2d34);box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.35));pointer-events:none;white-space:normal}
.dam_tipPortal{position:fixed;z-index:10050;opacity:0;visibility:hidden;transition:opacity .12s ease;pointer-events:none}
.dam_tipPortal.dam_tipOpen{opacity:1;visibility:visible}
.dam_tip strong{display:block;font-size:12px;font-weight:600;margin-bottom:4px}
.dam_tipRow{display:flex;justify-content:space-between;gap:12px}
.dam_form{display:flex;flex-direction:column;gap:10px;max-width:640px}
.dam_form label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dam_form input:not([type="color"]),.dam_form select{height:32px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px}
.dam_form .dam_hint{font-size:12px;color:var(--dsw-alias-label-tertiary);line-height:1.45;margin:0}
.dam_form .dam_btnSave{align-self:flex-start;height:32px;padding:0 12px;border-radius:8px;border:2px solid var(--dsw-alias-state-business-primary);cursor:pointer;background:transparent;color:var(--dsw-alias-state-business-primary);font:inherit;font-size:12px}
.dam_form .dam_btnSave:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.dam_colors{display:flex;flex-direction:column;gap:8px;margin-top:4px;padding-top:8px;border-top:1px solid var(--dsw-alias-border-l2)}
.dam_colorsHead{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dam_colorRow{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
.dam_colorLabel{width:120px;flex:none;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dam_nativeColor{
  -webkit-appearance:none;appearance:none;
  width:28px;height:28px;min-width:28px;padding:0;margin:0;
  border:1px solid var(--dsw-alias-border-l2);
  border-radius:8px;cursor:pointer;background:transparent;overflow:hidden;flex:none;
  box-sizing:border-box;
}
.dam_nativeColor::-webkit-color-swatch-wrapper{padding:0;border:none}
.dam_nativeColor::-webkit-color-swatch{border:none;border-radius:7px;padding:0}
.dam_nativeColor::-moz-color-swatch{border:none;border-radius:7px}
.dam_hex{
  height:28px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);
  padding:0 10px;width:150px;box-sizing:border-box;
  background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);
  font:inherit;font-size:11px;font-family:var(--ds-font-family-code, ui-monospace, monospace);
}
.dam_resetColors{
  align-self:flex-start;height:28px;padding:0 10px;border-radius:8px;cursor:pointer;
  font:inherit;font-size:11px;border:1px solid var(--dsw-alias-border-l2);
  background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);
}
`;

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-ai-metrics-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-ai-metrics-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function normalizeColor(input) {
			if (typeof input !== "string") return null;
			const s = input.trim();
			if (!s) return null;
			if (/^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(s)) return s.toLowerCase();
			if (/^rgba?\(\s*[\d.]+\s*,\s*[\d.]+\s*,\s*[\d.]+(?:\s*,\s*[\d.]+\s*)?\)$/i.test(s)) return s;
			return null;
		}

		function colorToPickerHex(cssColor) {
			const s = String(cssColor || "").trim();
			const hex = /^#([0-9a-f]{6})$/i.exec(s);
			if (hex) return `#${hex[1].toLowerCase()}`;
			const short = /^#([0-9a-f]{3})$/i.exec(s);
			if (short) {
				const h = short[1];
				return `#${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`.toLowerCase();
			}
			const rgb = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i.exec(s);
			if (rgb) {
				const to = (n) => Math.max(0, Math.min(255, Math.round(Number(n)))).toString(16).padStart(2, "0");
				return `#${to(rgb[1])}${to(rgb[2])}${to(rgb[3])}`;
			}
			return "#808080";
		}

		function resolveColors(cfg) {
			const out = { ...DEFAULT_COLORS };
			const src = cfg?.colors && typeof cfg.colors === "object" ? cfg.colors : {};
			for (const key of Object.keys(DEFAULT_COLORS)) {
				const n = normalizeColor(src[key]);
				if (n) out[key] = n;
			}
			return out;
		}

		const RPC = "/ai-metrics-config";
		let activeConnection = null;
		let cachedConfig = null;

		function getRawLocalConfig() {
			try {
				const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
				if (!raw || typeof raw !== "object") return { ...DEFAULTS, colors: { ...DEFAULT_COLORS } };
				return {
					adapter: ADAPTERS.some((a) => a.id === raw.adapter) ? raw.adapter : DEFAULTS.adapter,
					url: typeof raw.url === "string" ? raw.url : DEFAULTS.url,
					label: typeof raw.label === "string" && raw.label.trim() ? raw.label.trim() : DEFAULTS.label,
					clickUrl: typeof raw.clickUrl === "string" ? raw.clickUrl : DEFAULTS.clickUrl,
					totalBytes: raw.totalBytes != null ? String(raw.totalBytes) : "",
					colors: resolveColors({ colors: raw.colors }),
				};
			} catch {
				return { ...DEFAULTS, colors: { ...DEFAULT_COLORS } };
			}
		}

		function loadConfig() {
			if (cachedConfig) return cachedConfig;
			cachedConfig = getRawLocalConfig();
			return cachedConfig;
		}

		function saveLocalConfig(next) {
			const clean = next && typeof next === "object" ? next : { ...DEFAULTS, colors: { ...DEFAULT_COLORS } };
			cachedConfig = clean;
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

		async function syncConfigWithServer(conn) {
			const target = conn || activeConnection;
			if (!target) return loadConfig();
			const local = getRawLocalConfig();
			try {
				const res = await callRpc(target, "syncConfig", { config: local });
				if (res?.config && typeof res.config === "object") {
					const s = res.config;
					const merged = {
						adapter: ADAPTERS.some((a) => a.id === s.adapter) ? s.adapter : DEFAULTS.adapter,
						url: typeof s.url === "string" ? s.url : DEFAULTS.url,
						label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : DEFAULTS.label,
						clickUrl: typeof s.clickUrl === "string" ? s.clickUrl : DEFAULTS.clickUrl,
						totalBytes: s.totalBytes != null ? String(s.totalBytes) : "",
						colors: resolveColors({ colors: s.colors }),
					};
					return saveLocalConfig(merged);
				}
			} catch (err) {
				console.warn(`[${PLUGIN}] server sync failed`, err);
			}
			return loadConfig();
		}

		function saveConfig(next) {
			const clean = saveLocalConfig(next);
			const target = activeConnection;
			if (target) {
				callRpc(target, "saveConfig", { config: clean }).catch((err) => {
					console.warn(`[${PLUGIN}] saveConfig failed`, err);
				});
			}
		}

		function formatBytes(bytes) {
			const n = Number(bytes);
			if (!Number.isFinite(n) || n <= 0) return "0 B";
			const gb = n / (1024 ** 3);
			if (gb >= 1) return `${gb.toFixed(1)} GB`;
			const mb = n / (1024 ** 2);
			if (mb >= 1) return `${mb.toFixed(0)} MB`;
			return `${Math.round(n / 1024)} KB`;
		}

		function clampPercent(n) {
			const v = Number(n);
			if (!Number.isFinite(v)) return null;
			return Math.max(0, Math.min(100, v));
		}

		/** Accept 0–100 or 0–1 fractions. */
		function parseLoadPercent(raw) {
			const v = Number(raw);
			if (!Number.isFinite(v)) return null;
			if (v >= 0 && v <= 1) return clampPercent(v * 100);
			return clampPercent(v);
		}

		function jetsonOverviewUrl(activeUrl) {
			const u = String(activeUrl || DEFAULTS.url).replace(/\/+$/, "");
			if (/\/api\/ai\/active$/i.test(u)) {
				return u.replace(/\/api\/ai\/active$/i, "/api/system/overview");
			}
			if (/\/ai\/active$/i.test(u)) {
				return u.replace(/\/ai\/active$/i, "/system/overview");
			}
			return null;
		}

		async function fetchJetsonLoads(activeUrl, snapshot) {
			let cpuPercent = null;
			let gpuPercent = parseLoadPercent(
				snapshot?.gpu?.gpu_util_percent
				?? snapshot?.gpu?.utilization
				?? snapshot?.gpu_util_percent,
			);
			const overviewUrl = jetsonOverviewUrl(activeUrl);
			if (overviewUrl) {
				try {
					const res = await fetch(overviewUrl, { cache: "no-store" });
					if (res.ok) {
						const ov = await res.json();
						cpuPercent = parseLoadPercent(ov?.cpu_percent ?? ov?.cpu_percent_raw);
						if (gpuPercent == null) {
							gpuPercent = parseLoadPercent(
								ov?.gpu?.gpu_util_percent
								?? ov?.gpu?.utilization
								?? ov?.gpu_util_percent,
							);
						}
					}
				} catch {
					/* memory donut still works without loads */
				}
			}
			return { cpuPercent, gpuPercent };
		}

		function parseTotalOverride(cfg) {
			const n = Number(String(cfg.totalBytes || "").replace(/[_\s,]/g, ""));
			return Number.isFinite(n) && n > 0 ? n : 0;
		}

		function parsePromGauge(text, names) {
			for (const name of names) {
				const escaped = String(name).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
				const re = new RegExp(`^${escaped}(?:\\{[^}]*\\})?\\s+([0-9.eE+-]+)\\s*$`, "m");
				const m = text.match(re);
				if (m) {
					const v = Number(m[1]);
					if (Number.isFinite(v)) return v;
				}
			}
			return null;
		}

		/** @returns {{ title: string, segments: {key,bytes,color,label}[], detail?: string } | null} */
		async function fetchSnapshot(cfg) {
			if (cfg.adapter === "off") return null;
			const url = (cfg.url || "").trim();
			if (!url && cfg.adapter !== "off") throw new Error("URL required");
			const COLORS = resolveColors(cfg);

			if (cfg.adapter === "json") {
				const res = await fetch(url, { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				if (Array.isArray(data.segments) && data.segments.length) {
					const segments = data.segments.map((s, i) => ({
						key: s.key || `s${i}`,
						bytes: Math.max(0, Number(s.bytes) || 0),
						color: s.color || COLORS.used,
						label: s.label || s.key || `Seg ${i + 1}`,
					}));
					return {
						title: data.label || cfg.label,
						segments,
						detail: data.detail || "",
						cpuPercent: parseLoadPercent(data.cpu_percent ?? data.cpu),
						gpuPercent: parseLoadPercent(data.gpu_percent ?? data.gpu_util_percent ?? data.gpu),
					};
				}
				const total = Number(data.total_bytes) || parseTotalOverride(cfg);
				const available = Number(data.available_bytes);
				const used = Number.isFinite(Number(data.used_bytes))
					? Number(data.used_bytes)
					: (total && Number.isFinite(available) ? Math.max(0, total - available) : 0);
				const free = Number.isFinite(available) ? Math.max(0, available) : Math.max(0, total - used);
				if (!(total > 0)) throw new Error("JSON needs total_bytes (or set Total bytes in Settings)");
				return {
					title: data.label || cfg.label,
					segments: [
						{ key: "used", bytes: used, color: COLORS.used, label: "Used" },
						{ key: "free", bytes: free, color: COLORS.free, label: "Free" },
					],
					cpuPercent: parseLoadPercent(data.cpu_percent ?? data.cpu),
					gpuPercent: parseLoadPercent(data.gpu_percent ?? data.gpu_util_percent ?? data.gpu),
				};
			}

			if (cfg.adapter === "ollama") {
				const base = url.replace(/\/+$/, "");
				const res = await fetch(`${base}/api/ps`, { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const data = await res.json();
				const models = Array.isArray(data.models) ? data.models : [];
				let used = 0;
				const names = [];
				for (const m of models) {
					used += Math.max(0, Number(m.size_vram) || Number(m.size) || 0);
					if (m.name || m.model) names.push(m.name || m.model);
				}
				const total = parseTotalOverride(cfg);
				if (total > 0) {
					return {
						title: cfg.label || "Ollama",
						detail: names.join(", ") || `${models.length} loaded`,
						segments: [
							{ key: "used", bytes: used, color: COLORS.used, label: "Models" },
							{ key: "free", bytes: Math.max(0, total - used), color: COLORS.free, label: "Free" },
						],
					};
				}
				// No total configured — single-slice “used” gauge (still useful)
				return {
					title: cfg.label || "Ollama",
					detail: names.join(", ") || "No total set — used only",
					segments: [
						{ key: "used", bytes: Math.max(used, 1), color: COLORS.used, label: "Models" },
						{ key: "rest", bytes: 1, color: COLORS.track, label: "—" },
					],
				};
			}

			if (cfg.adapter === "prometheus") {
				const res = await fetch(url, { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const text = await res.text();
				const used = parsePromGauge(text, [
					"gpu_memory_used_bytes",
					"nvidia_gpu_memory_used_bytes",
					"process_resident_memory_bytes",
					"llamacpp:model_size_bytes",
				]);
				let total = parsePromGauge(text, [
					"gpu_memory_total_bytes",
					"nvidia_gpu_memory_total_bytes",
				]);
				let free = parsePromGauge(text, [
					"gpu_memory_free_bytes",
				]);
				// node_exporter style
				const memTotal = parsePromGauge(text, ["node_memory_MemTotal_bytes"]);
				const memAvail = parsePromGauge(text, ["node_memory_MemAvailable_bytes"]);
				if (memTotal != null && memAvail != null) {
					total = memTotal;
					free = memAvail;
				}
				const override = parseTotalOverride(cfg);
				if (override > 0) total = override;
				if (total == null || !(total > 0)) throw new Error("No total gauge found — set Total bytes in Settings");
				const usedBytes = free != null
					? Math.max(0, total - free)
					: (used != null ? used : 0);
				const freeBytes = free != null ? Math.max(0, free) : Math.max(0, total - usedBytes);
				const cpuPercent = parseLoadPercent(
					parsePromGauge(text, [
						"node_cpu_usage_percent",
						"cpu_usage_percent",
						"cpu_util_percent",
						"host_cpu_percent",
					]),
				);
				const gpuPercent = parseLoadPercent(
					parsePromGauge(text, [
						"gpu_utilization",
						"nvidia_gpu_duty_cycle",
						"DCGM_FI_DEV_GPU_UTIL",
						"jetson_gpu_utilization",
						"gpu_util_percent",
					]),
				);
				return {
					title: cfg.label || "Prometheus",
					segments: [
						{ key: "used", bytes: usedBytes, color: COLORS.used, label: "Used" },
						{ key: "free", bytes: freeBytes, color: COLORS.free, label: "Free" },
					],
					cpuPercent,
					gpuPercent,
				};
			}

			if (cfg.adapter === "jetson") {
				const res = await fetch(url || DEFAULTS.url, { cache: "no-store" });
				if (!res.ok) throw new Error(`HTTP ${res.status}`);
				const snapshot = await res.json();
				const layout = resolveJetsonLayout(snapshot);
				if (!layout) throw new Error("No memory in Jetson payload");
				const segments = [];
				if (layout.model_bytes > 0) {
					segments.push({ key: "model", bytes: layout.model_bytes, color: COLORS.model, label: "Model" });
				}
				if (layout.programs_bytes > 0) {
					segments.push({ key: "programs", bytes: layout.programs_bytes, color: COLORS.programs, label: "Apps" });
				}
				if (layout.system_used_bytes > 0) {
					segments.push({ key: "system", bytes: layout.system_used_bytes, color: COLORS.system, label: "System" });
				}
				segments.push({ key: "free", bytes: layout.free_bytes, color: COLORS.free, label: "Free" });
				const active = snapshot.active?.model || "";
				const loads = await fetchJetsonLoads(url || DEFAULTS.url, snapshot);
				return {
					title: cfg.label || "Jetson RAM",
					detail: active,
					segments,
					_free: layout.free_bytes,
					cpuPercent: loads.cpuPercent,
					gpuPercent: loads.gpuPercent,
				};
			}

			throw new Error(`Unknown adapter: ${cfg.adapter}`);
		}

		const VRAM_BUDGET = 32 * (1024 ** 3);
		const DOCKER_INFERENCE_ENGINES = new Set(["ollama", "vllm", "bitnet", "comfyui"]);

		function jetsonHostMemory(hostMemory) {
			const total = Number(hostMemory?.total_bytes) > 0
				? Number(hostMemory.total_bytes)
				: VRAM_BUDGET;
			const available = Number(hostMemory?.available_bytes) || 0;
			const used = Number.isFinite(Number(hostMemory?.used_bytes))
				? Number(hostMemory.used_bytes)
				: Math.max(0, total - available);
			return { totalBytes: total, usedBytes: used, availableBytes: available };
		}

		function activeModelBytes(snapshot) {
			const active = snapshot?.active;
			if (!active) return 0;
			if (active.engine === "ollama") return 0;
			if (active.engine === "comfyui") {
				const comfy = snapshot?.engines?.comfyui;
				if (comfy?.weights_in_vram) return Math.max(0, Number(comfy.vram_reserved_bytes) || 0);
				return 0;
			}
			return Math.max(0, Number(active.size_bytes) || 0);
		}

		function resolveJetsonLayout(snapshot) {
			const hostMemory = snapshot?.memory;
			if (!hostMemory) return null;
			const active = snapshot?.active;
			const host = jetsonHostMemory(hostMemory);
			const model = activeModelBytes(snapshot) + Math.max(0, Number(active?.context_bytes) || 0);
			const apiModel = Number(hostMemory.model_bytes) || 0;
			const modelMatchesApi = Math.abs(apiModel - model) < (64 * 1024 * 1024);

			let programs;
			if (modelMatchesApi && Number.isFinite(Number(hostMemory.programs_bytes))) {
				programs = Math.max(0, Number(hostMemory.programs_bytes));
			} else {
				const anon = Number(hostMemory.anon_bytes) || 0;
				const cappedModel = anon > 0 ? Math.min(model, anon) : model;
				programs = Math.max(0, anon - cappedModel);
				if (programs === 0) {
					const containers = Number(hostMemory.containers_bytes) || 0;
					const engine = active?.engine || "";
					programs = (DOCKER_INFERENCE_ENGINES.has(engine) && model > 0)
						? Math.max(0, containers - model)
						: Math.max(0, containers);
				}
			}

			let systemUsed;
			if (modelMatchesApi && Number.isFinite(Number(hostMemory.system_used_bytes))) {
				systemUsed = Math.max(0, Number(hostMemory.system_used_bytes));
			} else if (Number.isFinite(Number(hostMemory.system_bytes)) && !Number(hostMemory.cache_bytes)) {
				systemUsed = Math.max(0, Number(hostMemory.system_bytes));
			} else {
				systemUsed = Math.max(0, host.totalBytes - host.availableBytes - model - programs);
			}

			const free = Math.max(0, host.totalBytes - model - programs - systemUsed);
			return {
				total_bytes: host.totalBytes,
				model_bytes: model,
				programs_bytes: programs,
				system_used_bytes: systemUsed,
				free_bytes: free,
			};
		}

		function MemoryDonut({ segments, size = 28, error = false, colors }) {
			const COLORS = colors || DEFAULT_COLORS;
			const stroke = 4;
			const r = (size - stroke) / 2;
			const cx = size / 2;
			const cy = size / 2;
			const circumference = 2 * Math.PI * r;
			const total = (segments || []).reduce((sum, seg) => sum + seg.bytes, 0) || 1;
			let offset = 0;
			const arcs = (segments || []).map((seg) => {
				const len = (seg.bytes / total) * circumference;
				const dash = `${Math.max(0.001, len)} ${circumference}`;
				const dashOffset = -offset;
				offset += len;
				return { ...seg, dash, dashOffset };
			});
			return React.createElement("svg", {
				className: "dam_donut",
				width: size,
				height: size,
				viewBox: `0 0 ${size} ${size}`,
				"aria-hidden": true,
			},
				React.createElement("circle", {
					cx, cy, r, fill: "none", stroke: COLORS.track, strokeWidth: stroke,
				}),
				error
					? React.createElement("circle", {
						cx, cy, r, fill: "none", stroke: COLORS.error, strokeWidth: stroke,
						strokeDasharray: `${circumference * 0.22} ${circumference * 0.12}`,
					})
					: arcs.map((seg) => React.createElement("circle", {
						key: seg.key,
						cx, cy, r,
						fill: "none",
						stroke: seg.color,
						strokeWidth: stroke,
						strokeDasharray: seg.dash,
						strokeDashoffset: seg.dashOffset,
						transform: `rotate(-90 ${cx} ${cy})`,
					})),
			);
		}

		function LoadBars({ cpuPercent, gpuPercent, colors, compact }) {
			const COLORS = colors || DEFAULT_COLORS;
			const rows = [
				{ key: "cpu", label: "CPU", value: cpuPercent, fill: COLORS.cpu },
				{ key: "gpu", label: "GPU", value: gpuPercent, fill: COLORS.gpu },
			].filter((r) => r.value != null);
			if (!rows.length) return null;
			return React.createElement("div", {
				className: "dam_loads",
				style: { ["--dam-load-track"]: COLORS.track },
				"aria-hidden": compact ? true : undefined,
			},
				...rows.map((row) => {
					const pct = Math.round(row.value);
					return React.createElement("div", {
						key: row.key,
						className: "dam_loadRow",
						title: `${row.label} ${pct}%`,
					},
						React.createElement("span", { className: "dam_loadName" }, row.label),
						React.createElement("div", { className: "dam_loadTrack" },
							React.createElement("span", {
								className: "dam_loadFill",
								style: { width: `${pct}%`, background: row.fill },
							}),
						),
						React.createElement("span", { className: "dam_loadPct" }, `${pct}%`),
					);
				}),
			);
		}

		function MetricsWidget({ wide }) {
			const rootRef = React.useRef(null);
			const tipWrapRef = React.useRef(null);
			const [cfg, setCfg] = React.useState(loadConfig);
			const [snap, setSnap] = React.useState(null);
			const [error, setError] = React.useState(false);
			const [loading, setLoading] = React.useState(true);
			const [errMsg, setErrMsg] = React.useState("");
			const [tipOpen, setTipOpen] = React.useState(false);
			const [tipPos, setTipPos] = React.useState({ left: 0, bottom: 8, maxHeight: 320 });
			const tipPortalRef = React.useRef(null);

			const placeTip = React.useCallback(() => {
				const el = tipWrapRef.current;
				if (!el) return;
				const rect = el.getBoundingClientRect();
				const gap = 8;
				const maxW = Math.min(260, window.innerWidth - 24);
				let left = rect.right + gap;
				if (left + maxW > window.innerWidth - 8) {
					left = Math.max(8, rect.left - maxW - gap);
				}
				// Anchor to the widget bottom so the tip grows upward (footer slot).
				const bottom = Math.max(gap, window.innerHeight - rect.bottom);
				const maxHeight = Math.max(96, rect.bottom - gap);
				setTipPos({ left, bottom, maxHeight });
			}, []);

			const showTip = React.useCallback(() => {
				placeTip();
				setTipOpen(true);
			}, [placeTip]);

			const hideTip = React.useCallback(() => setTipOpen(false), []);

			React.useLayoutEffect(() => {
				if (!tipOpen) return;
				placeTip();
				const node = tipPortalRef.current;
				if (!node) return;
				const tipH = node.getBoundingClientRect().height;
				const el = tipWrapRef.current;
				if (!el || tipH <= 0) return;
				const rect = el.getBoundingClientRect();
				const gap = 8;
				const spaceAbove = rect.bottom - gap;
				if (tipH > spaceAbove) {
					setTipPos((p) => ({
						...p,
						bottom: gap,
						maxHeight: Math.max(96, window.innerHeight - gap * 2),
					}));
				}
			}, [tipOpen, placeTip, snap, loading, error]);

			React.useEffect(() => {
				if (!tipOpen) return undefined;
				const onMove = () => placeTip();
				window.addEventListener("scroll", onMove, true);
				window.addEventListener("resize", onMove);
				return () => {
					window.removeEventListener("scroll", onMove, true);
					window.removeEventListener("resize", onMove);
				};
			}, [tipOpen, placeTip]);

			React.useEffect(() => {
				const onCfg = (e) => setCfg(e?.detail || loadConfig());
				window.addEventListener(CONFIG_EVENT, onCfg);
				return () => window.removeEventListener(CONFIG_EVENT, onCfg);
			}, []);

			React.useEffect(() => {
				const root = rootRef.current;
				if (!root) return;
				const slotHost = root.parentElement;
				const footArea = root.closest(".hHd-Xa_footArea");
				const settings = footArea?.querySelector(".hHd-Xa_settingsArea");
				if (!slotHost || !footArea || !settings) return;
				if (settings.nextElementSibling !== slotHost) {
					footArea.appendChild(slotHost);
				}
			}, [wide, cfg.adapter]);

			const refresh = React.useCallback(async () => {
				if (cfg.adapter === "off") {
					setSnap(null);
					setError(false);
					setLoading(false);
					return;
				}
				try {
					const data = await fetchSnapshot(cfg);
					setSnap(data);
					setError(false);
					setErrMsg("");
				} catch (err) {
					console.warn(`[${PLUGIN}] fetch failed:`, err);
					setError(true);
					setErrMsg(err?.message || String(err));
					setSnap(null);
				} finally {
					setLoading(false);
				}
			}, [cfg]);

			React.useEffect(() => {
				setLoading(true);
				refresh();
				if (cfg.adapter === "off") return undefined;
				const id = window.setInterval(refresh, POLL_MS);
				const onVisible = () => {
					if (document.visibilityState === "visible") refresh();
				};
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					window.clearInterval(id);
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, [refresh, cfg.adapter]);

			if (cfg.adapter === "off") return null;

			const COLORS = resolveColors(cfg);
			const segments = snap?.segments || [{ key: "free", bytes: 1, color: COLORS.free, label: "Free" }];
			const freeSeg = segments.find((s) => s.key === "free");
			const freeBytes = snap?._free ?? freeSeg?.bytes ?? 0;
			const cpuPercent = snap?.cpuPercent ?? null;
			const gpuPercent = snap?.gpuPercent ?? null;

			const tip = (() => {
				if (loading) {
					return [React.createElement("strong", { key: "t" }, cfg.label), "Loading…"];
				}
				if (error || !snap) {
					return [
						React.createElement("strong", { key: "t" }, cfg.label),
						errMsg || "Could not reach metrics URL.",
						React.createElement("div", { key: "h", style: { marginTop: 6, opacity: 0.8 } },
							"Settings → AI Metrics"),
					];
				}
				const loadRows = [];
				if (cpuPercent != null) {
					loadRows.push(React.createElement("div", { key: "cpu", className: "dam_tipRow" },
						React.createElement("span", null, "CPU"),
						React.createElement("span", null, `${Math.round(cpuPercent)}%`),
					));
				}
				if (gpuPercent != null) {
					loadRows.push(React.createElement("div", { key: "gpu", className: "dam_tipRow" },
						React.createElement("span", null, "GPU"),
						React.createElement("span", null, `${Math.round(gpuPercent)}%`),
					));
				}
				return [
					React.createElement("strong", { key: "t" },
						snap.title + (snap.detail ? ` · ${snap.detail}` : "")),
					...segments.map((seg) => React.createElement("div", {
						key: seg.key,
						className: "dam_tipRow",
					},
						React.createElement("span", null, seg.label),
						React.createElement("span", null, formatBytes(seg.bytes)),
					)),
					...loadRows,
				];
			})();

			const button = React.createElement("button", {
				type: "button",
				className: "dam_btn",
				onClick: () => {
					const href = (cfg.clickUrl || "").trim();
					if (href) window.open(href, "_blank", "noopener");
				},
			},
				React.createElement(MemoryDonut, {
					segments,
					size: wide ? 33 : 20,
					error,
					colors: COLORS,
				}),
				wide
					? React.createElement("div", { className: "dam_btnMain" },
						React.createElement("div", { className: "dam_btnTop" },
							React.createElement("span", { className: "dam_line" },
								React.createElement("span", { className: "dam_label" }, cfg.label),
								React.createElement("span", { className: "dam_sub" },
									"·\u00a0", formatBytes(freeBytes), "\u00a0free"),
							),
						),
						React.createElement(LoadBars, {
							cpuPercent,
							gpuPercent,
							colors: COLORS,
							compact: false,
						}),
					)
					: React.createElement(LoadBars, {
						cpuPercent,
						gpuPercent,
						colors: COLORS,
						compact: true,
					}),
			);

			const tipPortal = typeof document !== "undefined" && ReactDOM?.createPortal
				? ReactDOM.createPortal(
					React.createElement("div", {
						ref: tipPortalRef,
						className: "dam_tipPortal" + (tipOpen ? " dam_tipOpen" : ""),
						style: {
							top: "auto",
							left: tipPos.left,
							bottom: tipPos.bottom,
							transform: "none",
							maxHeight: tipPos.maxHeight,
							overflow: "visible",
						},
						role: "tooltip",
					}, React.createElement("div", { className: "dam_tip" }, tip)),
					document.body,
				)
				: null;

			return React.createElement("div", {
				ref: rootRef,
				className: wide ? "dam_layer" : "dam_layer dam_rail",
			},
				React.createElement("div", {
					className: "dam_tipWrap",
					ref: tipWrapRef,
					onMouseEnter: showTip,
					onMouseLeave: hideTip,
					onFocus: showTip,
					onBlur: hideTip,
				}, button),
				tipPortal,
			);
		}

		function MetricsSettings() {
			const [cfg, setCfg] = React.useState(loadConfig);
			const [msg, setMsg] = React.useState("");

			React.useEffect(() => { ensureStyles(); }, []);

			const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
			const setColor = (key, value) => {
				setCfg((c) => ({
					...c,
					colors: { ...DEFAULT_COLORS, ...(c.colors || {}), [key]: value },
				}));
			};

			return React.createElement("div", { className: "dam_form" },
				React.createElement("p", { className: "dam_hint" },
					"Sidebar memory donut. Point at any reachable URL. JSON expects ",
					React.createElement("code", null, "total_bytes"), " + ",
					React.createElement("code", null, "used_bytes"), " or ",
					React.createElement("code", null, "available_bytes"),
					". Ollama uses ", React.createElement("code", null, "/api/ps"),
					" (set Total bytes for a real free slice). Prometheus scrapes text gauges. Jetson uses the rubberrobo metrics-api shape. ",
					"CPU/GPU bars appear when the source exposes load (Jetson overview + gpu util; JSON ",
					React.createElement("code", null, "cpu_percent"), "/",
					React.createElement("code", null, "gpu_percent"),
					"; some Prometheus gauges)."),
				React.createElement("label", null, "Adapter"),
				React.createElement("select", {
					value: cfg.adapter,
					onChange: (e) => set({ adapter: e.target.value }),
				}, ADAPTERS.map((a) => React.createElement("option", { key: a.id, value: a.id }, a.label))),
				React.createElement("label", null, "URL"),
				React.createElement("input", {
					value: cfg.url,
					onChange: (e) => set({ url: e.target.value }),
					placeholder: cfg.adapter === "ollama"
						? "http://192.168.0.146:11434"
						: cfg.adapter === "prometheus"
							? "http://host:8080/metrics"
							: "/jetson-metrics-api/api/ai/active",
				}),
				React.createElement("label", null, "Label"),
				React.createElement("input", {
					value: cfg.label,
					onChange: (e) => set({ label: e.target.value }),
					placeholder: "AI RAM",
				}),
				React.createElement("label", null, "Total bytes (optional override / required for Ollama free slice)"),
				React.createElement("input", {
					value: cfg.totalBytes,
					onChange: (e) => set({ totalBytes: e.target.value }),
					placeholder: "e.g. 34359738368 for 32 GiB",
				}),
				React.createElement("label", null, "Click opens URL (optional)"),
				React.createElement("input", {
					value: cfg.clickUrl,
					onChange: (e) => set({ clickUrl: e.target.value }),
					placeholder: "https://…",
				}),
				React.createElement("div", { className: "dam_colors" },
					React.createElement("div", { className: "dam_colorsHead" }, "Donut colors"),
					React.createElement("p", { className: "dam_hint" },
						"Hex (#rrggbb) or rgba(…). Jetson uses model / apps / system / free; other adapters mostly use Used + Free."),
					...COLOR_FIELDS.map((field) => {
						const saved = resolveColors(cfg)[field.key];
						const draft = (cfg.colors && cfg.colors[field.key] != null)
							? String(cfg.colors[field.key])
							: saved;
						return React.createElement("div", { key: field.key, className: "dam_colorRow" },
							React.createElement("span", {
								className: "dam_colorLabel",
								title: field.hint,
							}, field.label),
							React.createElement("input", {
								type: "color",
								className: "dam_nativeColor",
								title: field.hint,
								value: colorToPickerHex(normalizeColor(draft) || saved),
								onChange: (e) => setColor(field.key, e.target.value),
							}),
							React.createElement("input", {
								className: "dam_hex",
								value: draft,
								spellCheck: false,
								autoComplete: "off",
								placeholder: "#rrggbb or rgba(…)",
								title: field.hint,
								onChange: (e) => setColor(field.key, e.target.value),
								onBlur: () => {
									const n = normalizeColor(draft);
									if (n) setColor(field.key, n);
									else setColor(field.key, saved);
								},
							}),
						);
					}),
					React.createElement("button", {
						type: "button",
						className: "dam_resetColors",
						onClick: () => set({ colors: { ...DEFAULT_COLORS } }),
					}, "Reset colors"),
				),
				React.createElement("button", {
					type: "button",
					className: "dam_btnSave",
					onClick: () => {
						const colors = resolveColors(cfg);
						const next = {
							...cfg,
							label: cfg.label.trim() || DEFAULTS.label,
							colors,
						};
						saveConfig(next);
						setCfg(next);
						setMsg("Saved");
					},
				}, "Save"),
				msg && React.createElement("div", { className: "dam_hint" }, msg),
			);
		}

		const inject = ["slots", "connection"];

		function apply(ctx) {
			const connection = ctx.get("connection");
			activeConnection = connection;
			ensureStyles();
			if (connection) {
				syncConfigWithServer(connection).catch(console.warn);
			}

			ctx.effect(() => ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "ai-metrics",
				order: 25,
			}, MetricsWidget)), `${PLUGIN}: widget`);

			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "ai-metrics",
					order: 196,
					label: () => "AI Metrics",
					inject: () => ({ connection }),
				}, MetricsSettings), `${PLUGIN}: settings`);
			} catch (err) {
				console.warn(`[${PLUGIN}] settings inject failed`, err);
			}
		}

		return { apply, inject };
	},
});

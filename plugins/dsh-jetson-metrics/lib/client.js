// Deprecated host RAM donut — polls /jetson-metrics-api/api/ai/active.
// Prefer dsh-ai-metrics (Settings → AI Metrics).
window.__ModuleLoader__.load({
	id: "dsh-jetson-metrics",
	factory: (require) => {
		let react = require("react");
		let react_jsx_runtime = require("react/jsx-runtime");

		const PLUGIN = "dsh-jetson-metrics";
		const METRICS_URL = "/jetson-metrics-api/api/ai/active";
		const POLL_MS = 12_000;
		const VRAM_BUDGET = 32 * (1024 ** 3);

		const COLORS = {
			model: "rgba(37, 117, 252, 0.9)",
			programs: "rgba(155, 89, 182, 0.88)",
			system: "rgba(255, 193, 7, 0.85)",
			free: "rgba(108, 116, 128, 0.75)",
			track: "rgba(128, 136, 152, 0.22)",
			error: "rgba(231, 76, 60, 0.75)",
		};

		const css = [
			'[class*="_footerActions"]{flex-direction:column;align-items:stretch;width:100%}',
			".djm_layer{width:100%;max-width:100%;box-sizing:border-box}",
			".djm_layer.djm_rail{width:36px;align-self:center}",
			".djm_tipWrap{position:relative;display:block;width:100%;max-width:100%;box-sizing:border-box}",
			".djm_btn{box-sizing:border-box;width:100%;max-width:100%;height:42px;margin:4px 0;color:var(--dsw-alias-label-primary);cursor:pointer;background:0 0;border:none;border-radius:12px;align-items:center;gap:8px;padding:0 8px;font:inherit;font-size:14px;display:flex;overflow:hidden}",
			".djm_btn:hover{background:var(--dsw-alias-interactive-bg-hover)}",
			".djm_rail .djm_btn{width:36px;height:36px;margin:8px 0 10px;border-radius:50%;justify-content:center;padding:0}",
			".djm_line{display:inline-flex;align-items:center;gap:6px;min-width:0;overflow:hidden}",
			".djm_label{font-size:14px;font-weight:500;line-height:20px;white-space:nowrap}",
			".djm_sub{font-size:14px;line-height:20px;color:var(--dsw-alias-label-tertiary);white-space:nowrap;font-variant-numeric:tabular-nums}",
			".djm_donut{flex:none;display:block}",
			".djm_tip{font-size:12px;line-height:18px;max-width:220px}",
			".djm_tip strong{display:block;font-size:12px;font-weight:600;margin-bottom:4px}",
			".djm_tipRow{display:flex;justify-content:space-between;gap:12px}",
			".djm_tipWrap .djm_tip{visibility:hidden;opacity:0;pointer-events:none;position:absolute;left:0;bottom:calc(100% + 6px);z-index:20;padding:8px 10px;border-radius:10px;background:var(--dsw-alias-bg-layer-3,#2a2d34);box-shadow:var(--dsw-shadow-lv2,0 4px 16px rgba(0,0,0,.35));transition:opacity .12s ease}",
			".djm_tipWrap:hover .djm_tip,.djm_tipWrap:focus-within .djm_tip{visibility:visible;opacity:1}",
		].join("");
		const tagId = "dsh-jetson-metrics/widget.v3.css";
		if (typeof document !== "undefined") {
			for (const old of document.querySelectorAll('style[data-plugin="dsh-jetson-metrics"]')) old.remove();
			if (!document.querySelector(`style[data-plugin-css="${tagId}"]`)) {
				const tag = document.createElement("style");
				tag.dataset.plugin = PLUGIN;
				tag.dataset.pluginCss = tagId;
				tag.textContent = css;
				document.head.appendChild(tag);
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

		const DOCKER_INFERENCE_ENGINES = new Set(["ollama", "vllm", "bitnet", "comfyui"]);

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

		/** Same breakdown as AI Hub (`ollama-status-utils.js` → jetsonMemoryLayout). */
		function resolveMemoryLayout(snapshot) {
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

		function memorySegments(layout) {
			if (!layout) return [{ key: "free", bytes: VRAM_BUDGET, color: COLORS.free, label: "Free" }];
			const total = Number(layout.total_bytes) > 0 ? Number(layout.total_bytes) : VRAM_BUDGET;
			const model = Math.max(0, Number(layout.model_bytes) || 0);
			const programs = Math.max(0, Number(layout.programs_bytes) || 0);
			const system = Math.max(0, Number(layout.system_used_bytes) || 0);
			const free = Math.max(0, Number(layout.free_bytes) ?? (total - model - programs - system));
			const out = [];
			if (model > 0) out.push({ key: "model", bytes: model, color: COLORS.model, label: "Model" });
			if (programs > 0) out.push({ key: "programs", bytes: programs, color: COLORS.programs, label: "Apps" });
			if (system > 0) out.push({ key: "system", bytes: system, color: COLORS.system, label: "System" });
			out.push({ key: "free", bytes: free, color: COLORS.free, label: "Free" });
			return out;
		}

		function MemoryDonut({ segments, size = 28, error = false }) {
			const stroke = 4;
			const r = (size - stroke) / 2;
			const cx = size / 2;
			const cy = size / 2;
			const circumference = 2 * Math.PI * r;
			const total = segments.reduce((sum, seg) => sum + seg.bytes, 0) || 1;
			let offset = 0;
			const arcs = segments.map((seg) => {
				const len = (seg.bytes / total) * circumference;
				const dash = `${Math.max(0.001, len)} ${circumference}`;
				const dashOffset = -offset;
				offset += len;
				return { ...seg, dash, dashOffset };
			});
			return (0, react_jsx_runtime.jsxs)("svg", {
				className: "djm_donut",
				width: size,
				height: size,
				viewBox: `0 0 ${size} ${size}`,
				"aria-hidden": true,
				children: [
					(0, react_jsx_runtime.jsx)("circle", {
						cx, cy, r, fill: "none", stroke: COLORS.track, strokeWidth: stroke,
					}),
					error
						? (0, react_jsx_runtime.jsx)("circle", {
							cx, cy, r, fill: "none", stroke: COLORS.error, strokeWidth: stroke,
							strokeDasharray: `${circumference * 0.22} ${circumference * 0.12}`,
						})
						: arcs.map((seg) => (0, react_jsx_runtime.jsx)("circle", {
							key: seg.key,
							cx, cy, r,
							fill: "none",
							stroke: seg.color,
							strokeWidth: stroke,
							strokeDasharray: seg.dash,
							strokeDashoffset: seg.dashOffset,
							transform: `rotate(-90 ${cx} ${cy})`,
						})),
				],
			});
		}

		function tooltipContent(snapshot, loading) {
			if (loading) {
				return [
					(0, react_jsx_runtime.jsx)("strong", { children: "Host memory" }),
					"Loading…",
				];
			}
			if (!snapshot) {
				return [
					(0, react_jsx_runtime.jsx)("strong", { children: "Host memory" }),
					"Could not reach metrics-api.",
				];
			}
			const layout = resolveMemoryLayout(snapshot);
			const total = layout?.total_bytes || VRAM_BUDGET;
			const segs = memorySegments(layout);
			const active = snapshot.active;
			return [
				(0, react_jsx_runtime.jsxs)("strong", {
					children: [
						"Host · ",
						formatBytes(total),
						active?.model ? ` · ${active.model}` : "",
					],
				}),
				...segs.map((seg) => (0, react_jsx_runtime.jsxs)("div", {
					className: "djm_tipRow",
					children: [
						(0, react_jsx_runtime.jsx)("span", { children: seg.label }),
						(0, react_jsx_runtime.jsx)("span", { children: formatBytes(seg.bytes) }),
					],
				}, seg.key)),
			];
		}

		function JetsonMemoryWidget({ wide }) {
			const rootRef = (0, react.useRef)(null);
			const [snapshot, setSnapshot] = (0, react.useState)(null);
			const [error, setError] = (0, react.useState)(false);
			const [loading, setLoading] = (0, react.useState)(true);

			(0, react.useEffect)(() => {
				const root = rootRef.current;
				if (!root) return;
				const slotHost = root.parentElement;
				const footArea = root.closest('[class*="_footArea"]');
				const settings = footArea?.querySelector('[class*="_settingsArea"]');
				if (!slotHost || !footArea || !settings) return;
				if (settings.nextElementSibling !== slotHost) {
					footArea.appendChild(slotHost);
				}
			}, [wide]);

			const refresh = (0, react.useCallback)(async () => {
				try {
					const res = await fetch(METRICS_URL, { cache: "no-store" });
					if (!res.ok) throw new Error(`HTTP ${res.status}`);
					const data = await res.json();
					setSnapshot(data);
					setError(false);
				} catch (err) {
					console.warn("[dsh-jetson-metrics] fetch failed:", err);
					setError(true);
				} finally {
					setLoading(false);
				}
			}, []);

			(0, react.useEffect)(() => {
				refresh();
				const id = window.setInterval(refresh, POLL_MS);
				const onVisible = () => {
					if (document.visibilityState === "visible") refresh();
				};
				document.addEventListener("visibilitychange", onVisible);
				return () => {
					window.clearInterval(id);
					document.removeEventListener("visibilitychange", onVisible);
				};
			}, [refresh]);

			const layout = resolveMemoryLayout(snapshot);
			const total = layout?.total_bytes || VRAM_BUDGET;
			const segments = memorySegments(layout);
			const freeBytes = layout?.free_bytes ?? total;

			const button = (0, react_jsx_runtime.jsxs)("button", {
				type: "button",
				className: "djm_btn",
				title: "Host memory",
				onClick: () => {},
				children: [
					(0, react_jsx_runtime.jsx)(MemoryDonut, {
						segments,
						size: wide ? 28 : 26,
						error,
					}),
					wide && (0, react_jsx_runtime.jsxs)("span", {
						className: "djm_line",
						children: [
							(0, react_jsx_runtime.jsx)("span", { className: "djm_label", children: "Host RAM" }),
							(0, react_jsx_runtime.jsxs)("span", {
								className: "djm_sub",
								children: ["·\u00a0", formatBytes(freeBytes), "\u00a0free"],
							}),
						],
					}),
				],
			});

			return (0, react_jsx_runtime.jsx)("div", {
				ref: rootRef,
				className: wide ? "djm_layer" : "djm_layer djm_rail",
				children: (0, react_jsx_runtime.jsxs)("div", {
					className: "djm_tipWrap",
					children: [
						button,
						(0, react_jsx_runtime.jsx)("div", {
							className: "djm_tip",
							children: tooltipContent(error ? null : snapshot, loading),
						}),
					],
				}),
			});
		}

		const inject = ["slots"];

		function apply(ctx) {
			ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
				name: "sidebar.footer.action",
				id: "jetson-metrics",
				order: 25,
			}, JetsonMemoryWidget), "jetson memory widget");
		}

		return { apply, inject };
	},
});

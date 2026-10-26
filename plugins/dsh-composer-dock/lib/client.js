// Always paint steps / tokens / context under the composer card.
// Stock StatsPills + ContextMeter return null when projections are empty or
// while the activity slot is expanded — this entry never does.
window.__ModuleLoader__.load({
	id: "dsh-composer-dock",
	factory: (require) => {
		const React = require("react");
		const { jsx, jsxs } = require("react/jsx-runtime");

		const PLUGIN = "dsh-composer-dock";
		const RADIUS = 5.5;
		const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

		const css = [
			".dcd_root{box-sizing:border-box;min-width:0;max-width:100%;font-size:calc(var(--dsh-content-font-size-secondary,13px) - 1px);line-height:calc(20px + var(--dsh-content-font-delta-secondary,0px));justify-content:center;align-items:center;gap:12px;display:flex;flex-wrap:wrap}",
			".dcd_pill{box-sizing:border-box;max-width:100%;color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;background:0 0;border:none;border-radius:999px;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}",
			".dcd_pill svg{flex:none;width:14px;height:14px}",
			".dcd_sep{color:var(--dsw-alias-separator-primary);margin:0 6px}",
			".dcd_meter{flex:none;display:inline-flex}",
			".dcd_meterBtn{border-radius:var(--dsw-radius-sm);color:var(--dsw-alias-label-tertiary);font:inherit;font-variant-numeric:tabular-nums;line-height:inherit;white-space:nowrap;cursor:default;background:0 0;border:none;flex:none;align-items:center;gap:6px;padding:1px 8px;display:inline-flex}",
			".dcd_track{fill:none;stroke:var(--dsw-alias-border-l3);stroke-width:2px}",
			".dcd_fill{fill:none;stroke:var(--dsw-alias-label-tertiary);stroke-width:2px;stroke-linecap:round}",
			/* Keep the dock row from collapsing when stock entries render nothing. */
			".uV2eYG_dock{min-height:24px!important;width:100%!important;justify-content:center!important}",
			/* Prefer our always-on pills. Split-view also forces display:inline-flex on
			   stock bOPqQW_/JObwrW_ — beat that with higher specificity. */
			".uV2eYG_dock [data-composer-stats]:not([data-dsh-always-stats]),"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock [data-composer-stats]:not([data-dsh-always-stats]),"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock [class*=\"bOPqQW_root\"]:not([data-dsh-always-stats]),"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock [class*=\"OPqQW_root\"]:not([data-dsh-always-stats])"
			+ "{display:none!important}",
			".uV2eYG_dock > .JObwrW_root,"
			+ ".uV2eYG_dock > [class*=\"JObwrW_root\"],"
			+ ".uV2eYG_dock > [class*=\"ObwrW_root\"],"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock > .JObwrW_root,"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock > [class*=\"JObwrW_root\"],"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock > [class*=\"ObwrW_root\"]"
			+ "{display:none!important}",
			"[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock .dcd_root,"
			+ "[class*=\"_root\"][data-dsh-split=\"1\"] .uV2eYG_dock [data-dsh-always-stats]"
			+ "{display:flex!important;flex-wrap:wrap!important;width:auto!important;max-width:100%!important}",
		].join("");

		const tagId = `${PLUGIN}/dock.v3.css`;
		if (typeof document !== "undefined") {
			for (const old of document.querySelectorAll(`style[data-plugin="${PLUGIN}"]`)) old.remove();
			const tag = document.createElement("style");
			tag.dataset.plugin = PLUGIN;
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}

		function billedInput(usage) {
			if (!usage) return 0;
			return (usage.uncachedInputTokens ?? 0) + (usage.cacheReadTokens ?? 0) + (usage.cacheWriteTokens ?? 0);
		}

		function formatTokens(n) {
			const v = Number(n) || 0;
			if (v < 1000) return String(Math.round(v));
			if (v < 1e6) {
				const k = v / 1000;
				return `${k >= 100 ? Math.round(k) : Math.round(k * 10) / 10}K`;
			}
			const m = v / 1e6;
			return `${m >= 100 ? Math.round(m) : Math.round(m * 10) / 10}M`;
		}

		function formatTps(stats) {
			if (!stats || !(stats.decodeMs > 0) || !(stats.decodeTokens > 0)) return null;
			const tps = stats.decodeTokens / (stats.decodeMs / 1000);
			return `${tps >= 100 ? Math.round(tps) : Math.round(tps * 10) / 10} tok/s`;
		}

		function cacheHitPercent(usage) {
			const denom = billedInput(usage);
			if (!(denom > 0)) return null;
			const pct = (usage.cacheReadTokens ?? 0) / denom * 100;
			if (pct >= 99.95) return "100";
			if (pct >= 10) return String(Math.round(pct));
			return String(Math.round(pct * 10) / 10);
		}

		function occupancy(pressure) {
			if (!pressure) return null;
			const used = pressure.projectedTokens ?? pressure.pressureTokens;
			const window = pressure.contextWindow;
			if (used === undefined || window === undefined || !(window > 0)) return null;
			return {
				percent: Math.min(100, Math.round(used / window * 100)),
				used,
				window,
			};
		}

		function deriveStats(nodes) {
			const turns = new Set();
			let steps = 0;
			let decodeMs = 0;
			let decodeTokens = 0;
			if (!Array.isArray(nodes)) {
				return { turns: 0, steps: 0, decodeMs: 0, decodeTokens: 0 };
			}
			for (const node of nodes) {
				if (node?.kind !== "assistant") continue;
				turns.add(node.turn);
				steps += 1;
			}
			return { turns: turns.size, steps, decodeMs, decodeTokens };
		}

		function isLiveStats(stats) {
			return !!(stats && ((stats.steps ?? 0) > 0 || (stats.turns ?? 0) > 0 || (stats.decodeTokens ?? 0) > 0));
		}

		function isLiveUsage(usage) {
			return !!(usage && (billedInput(usage) > 0 || (usage.outputTokens ?? 0) > 0));
		}

		function isLivePressure(pressure) {
			return occupancy(pressure) !== null;
		}

		function GaugeIcon() {
			return jsx("svg", {
				viewBox: "0 0 16 16",
				width: "14",
				height: "14",
				"aria-hidden": true,
				children: jsx("path", {
					fill: "currentColor",
					d: "M8 1.5A6.5 6.5 0 1 0 14.5 8h-1.5A5 5 0 1 1 8 3v1.5L11 2 8 1.5zM7.25 8.75l3.5-3.5.95.95-3.5 3.5-.95-.95z",
				}),
			});
		}

		function DbIcon() {
			return jsx("svg", {
				viewBox: "0 0 16 16",
				width: "14",
				height: "14",
				"aria-hidden": true,
				children: jsx("path", {
					fill: "currentColor",
					d: "M8 1.5c-2.9 0-5.25 1-5.25 2.25v8.5C2.75 13.5 5.1 14.5 8 14.5s5.25-1 5.25-2.25v-8.5C13.25 2.5 10.9 1.5 8 1.5zm0 1.25c2.35 0 3.75.75 3.75 1s-1.4 1-3.75 1-3.75-.75-3.75-1 1.4-1 3.75-1zM4.25 7c0 .25 1.4 1 3.75 1s3.75-.75 3.75-1v1.75c0 .25-1.4 1-3.75 1s-3.75-.75-3.75-1V7zm0 3.5c0 .25 1.4 1 3.75 1s3.75-.75 3.75-1V12.25c0 .25-1.4 1-3.75 1s-3.75-.75-3.75-1V10.5z",
				}),
			});
		}

		function newerStats(a, b) {
			if (!isLiveStats(a)) return b;
			if (!isLiveStats(b)) return a;
			const aSteps = a.steps ?? 0;
			const bSteps = b.steps ?? 0;
			if (aSteps !== bSteps) return aSteps > bSteps ? a : b;
			const aTok = a.decodeTokens ?? 0;
			const bTok = b.decodeTokens ?? 0;
			if (aTok !== bTok) return aTok > bTok ? a : b;
			return a;
		}

		function newerUsage(a, b) {
			if (!isLiveUsage(a)) return b;
			if (!isLiveUsage(b)) return a;
			const aTotal = billedInput(a) + (a.outputTokens ?? 0);
			const bTotal = billedInput(b) + (b.outputTokens ?? 0);
			return aTotal >= bTotal ? a : b;
		}

		function newerPressure(a, b) {
			if (!isLivePressure(a)) return b;
			if (!isLivePressure(b)) return a;
			const ao = occupancy(a);
			const bo = occupancy(b);
			if (!ao) return b;
			if (!bo) return a;
			return ao.used >= bo.used ? a : b;
		}

		function AlwaysDock({ useProjection, useChat, useSession }) {
			const sessionId = useSession((s) => s?.sessionId ?? s?.id ?? null);
			const running = useSession((s) => s?.running === true);
			const usageRaw = useProjection("tokenUsage");
			const statsRaw = useProjection("sessionStats");
			const pressureRaw = useProjection("contextPressure");
			const nodes = useChat((s) => s?.legacy?.nodes ?? null);
			// Safety net: if projection faces miss a notify, re-read while the agent runs.
			const [, setPulse] = React.useState(0);
			React.useEffect(() => {
				if (!running) return undefined;
				const id = window.setInterval(() => setPulse((n) => n + 1), 1000);
				return () => window.clearInterval(id);
			}, [running]);

			const sticky = React.useRef({ sessionId: null, stats: null, usage: null, pressure: null });
			if (sticky.current.sessionId !== sessionId) {
				sticky.current = { sessionId, stats: null, usage: null, pressure: null };
			}

			const derived = React.useMemo(() => deriveStats(nodes), [nodes]);
			const projectedStats = statsRaw && typeof statsRaw === "object" ? statsRaw : null;
			// Live projection first; chat-node fold while projections lag; sticky only
			// bridges empty frames — never wins over a higher live count.
			const feedStats = isLiveStats(projectedStats)
				? projectedStats
				: (isLiveStats(derived) ? derived : null);
			const feedUsage = isLiveUsage(usageRaw) ? usageRaw : null;
			const feedPressure = isLivePressure(pressureRaw) ? pressureRaw : null;

			const stats = newerStats(feedStats, sticky.current.stats)
				|| { turns: 0, steps: 0, decodeMs: 0, decodeTokens: 0 };
			const usage = newerUsage(feedUsage, sticky.current.usage) || usageRaw || null;
			const pressure = newerPressure(feedPressure, sticky.current.pressure) || pressureRaw || null;

			if (isLiveStats(stats)) sticky.current.stats = stats;
			if (isLiveUsage(usage)) sticky.current.usage = usage;
			if (isLivePressure(pressure)) sticky.current.pressure = pressure;

			const occ = occupancy(pressure);

			const turns = stats.turns ?? 0;
			const steps = stats.steps ?? 0;
			const tps = formatTps(stats);
			const totalTokens = usage ? billedInput(usage) + (usage.outputTokens ?? 0) : 0;
			const cache = usage ? cacheHitPercent(usage) : null;
			const pct = occ?.percent;
			const dashOffset = pct === undefined ? CIRCUMFERENCE : CIRCUMFERENCE * (1 - pct / 100);

			return jsxs("div", {
				className: "dcd_root",
				"data-composer-stats": true,
				"data-dsh-always-stats": true,
				children: [
					jsxs("span", {
						className: "dcd_pill",
						title: "Session steps",
						children: [
							jsx(GaugeIcon, {}),
							jsxs("span", {
								children: [
									`${turns} turn${turns === 1 ? "" : "s"}`,
									jsx("span", { className: "dcd_sep", "aria-hidden": true, children: "·" }),
									`${steps} step${steps === 1 ? "" : "s"}`,
									tps !== null && jsxs(React.Fragment, {
										children: [
											jsx("span", { className: "dcd_sep", "aria-hidden": true, children: "·" }),
											tps,
										],
									}),
								],
							}),
						],
					}),
					jsxs("span", {
						className: "dcd_pill",
						title: "Token usage",
						children: [
							jsx(DbIcon, {}),
							jsxs("span", {
								children: [
									formatTokens(totalTokens),
									cache !== null && jsxs(React.Fragment, {
										children: [
											jsx("span", { className: "dcd_sep", "aria-hidden": true, children: "·" }),
											`${cache}% cache`,
										],
									}),
								],
							}),
						],
					}),
					jsx("span", {
						className: "dcd_meter",
						title: occ
							? `${pct}% of context · ${formatTokens(occ.used)} / ${formatTokens(occ.window)}`
							: "Context usage",
						children: jsxs("span", {
							className: "dcd_meterBtn",
							children: [
								jsxs("svg", {
									viewBox: "0 0 14 14",
									width: "14",
									height: "14",
									"aria-hidden": true,
									children: [
										jsx("circle", {
											className: "dcd_track",
											cx: "7",
											cy: "7",
											r: RADIUS,
										}),
										jsx("circle", {
											className: "dcd_fill",
											cx: "7",
											cy: "7",
											r: RADIUS,
											strokeDasharray: String(CIRCUMFERENCE),
											strokeDashoffset: String(dashOffset),
											transform: "rotate(-90 7 7)",
											opacity: pct === undefined ? 0.35 : 1,
										}),
									],
								}),
								pct === undefined ? "—" : `${pct}%`,
							],
						}),
					}),
				],
			});
		}

		const inject = ["slots"];

		function apply(ctx) {
			ctx.effect(() => ctx.slots.inject("conversation.composer.dock", () => ctx.slots.register({
				name: "conversation.composer.dock",
				id: "dsh-always-stats",
				order: 5,
			}, AlwaysDock)), `${PLUGIN}: dock`);
		}

		return { apply, inject };
	},
});

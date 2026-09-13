/** @deprecated Use dsh-ai-metrics (adapter: jetson). Kept for reference; disabled in web cordis.patch.yml. */
const name = "dsh-jetson-metrics";
function apply() {
	console.info("[dsh-jetson-metrics] disabled — use dsh-ai-metrics (Settings → AI Metrics)");
}
export { apply, name };

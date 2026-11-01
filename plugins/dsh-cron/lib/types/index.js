/**
 * Cross-session scheduled tasks (cron) for DeepSeek Harness.
 * @module dsh-cron
 */
/** Cordis plugin name; keep this stable after publishing. */
export const name = 'dsh-cron';
/** Services that must exist before the plugin is applied. */
export const inject = ['automation', 'tools'];
export { Config } from "./config.js";
export { apply } from "./runtime.js";
//# sourceMappingURL=index.js.map
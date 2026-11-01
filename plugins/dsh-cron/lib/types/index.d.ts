/**
 * Cross-session scheduled tasks (cron) for DeepSeek Harness.
 * @module dsh-cron
 */
/** Cordis plugin name; keep this stable after publishing. */
export declare const name = "dsh-cron";
/** Services that must exist before the plugin is applied. */
export declare const inject: string[];
export { Config } from './config.ts';
export type { ResolvedConfig } from './config.ts';
export { apply } from './runtime.ts';
export type { PluginRuntime } from './runtime.ts';
export type { CronService, AddJobInput } from './scheduler.ts';
export type { CronJob, JobSchedule } from './store.ts';
//# sourceMappingURL=index.d.ts.map
/**
 * Model-facing tools: cron_add, cron_list, cron_remove.
 * @module dsh-cron/tools
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CronScheduler } from './scheduler.ts';
/**
 * Register the three management tools on the global tool registry.
 * @param ctx - plugin context carrying the `tools` service.
 * @param scheduler - the running scheduler.
 */
export declare function registerCronTools(ctx: Context, scheduler: CronScheduler): void;
//# sourceMappingURL=tools.d.ts.map
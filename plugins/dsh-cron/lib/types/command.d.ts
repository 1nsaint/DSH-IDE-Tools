/**
 * Human-facing `/cron` slash command: list, add, add-at, remove.
 * @module dsh-cron/command
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CronScheduler } from './scheduler.ts';
/**
 * Register the `/cron` command on the commands service.
 * @param ctx - context carrying the `commands` service.
 * @param scheduler - the running scheduler.
 * @returns the registration disposer.
 */
export declare function registerCronCommand(ctx: Context, scheduler: CronScheduler): () => void;
//# sourceMappingURL=command.d.ts.map
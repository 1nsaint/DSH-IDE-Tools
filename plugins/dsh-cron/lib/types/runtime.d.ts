/** Cordis activation for the cron Trigger adapter. */
import type { Context } from '@deepseek-ai/cordis';
import { type Config } from './config.ts';
import { type CronRunRecord } from './store.ts';
export interface PluginRuntime {
    now(): number;
    warn(message: string): void;
    info(message: string): void;
}
export declare function createPluginRuntime(ctx: Context): PluginRuntime;
export interface CronSettledEvent {
    readonly jobId: string;
    readonly run: CronRunRecord;
}
declare module '@deepseek-ai/cordis' {
    interface Events {
        'cron/settled'(event: CronSettledEvent): void;
    }
}
export declare function apply(ctx: Context, config: Config): void;
//# sourceMappingURL=runtime.d.ts.map
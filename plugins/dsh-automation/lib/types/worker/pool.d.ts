/** Single-process parallel Worker slots with independent fenced lease ownership. */
import type { Context } from '@deepseek-ai/cordis';
import type { RunId } from '../domain.ts';
import type { AutomationService } from '../index.ts';
import { type WorkerLog, type WorkerOptions } from '../worker.ts';
export interface WorkerPoolOptions extends WorkerOptions {
    readonly slots: number;
}
export interface WorkerPoolCycleResult {
    readonly recovered: number;
    readonly claimedRunIds: readonly RunId[];
}
export declare class AutomationWorkerPool {
    private readonly workers;
    constructor(ctx: Context, automation: AutomationService, options: WorkerPoolOptions, log: WorkerLog);
    runOnce(): Promise<WorkerPoolCycleResult>;
    start(): () => Promise<void>;
}
//# sourceMappingURL=pool.d.ts.map
/** Long-lived Worker that leases Runs and executes canonical DSH turns. */
import type { Context } from '@deepseek-ai/cordis';
import type { RunClaim, RunId } from './domain.ts';
import type { AutomationService } from './index.ts';
export { isRecoveryWakeMessage, recoveryWakeMessage, safeToResumeBeforeTurn, settlementFromEvents } from './worker/recovery.ts';
/** Worker deployment settings resolved from the application command. */
export interface WorkerOptions {
    readonly workerId?: string;
    readonly pollMs: number;
    readonly leaseMs: number;
    readonly shutdownGraceMs?: number;
}
/** Result of one bounded recovery-and-claim cycle. */
export interface WorkerCycleResult {
    readonly recovered: number;
    readonly claimedRunId?: RunId;
}
/** Internal deterministic checkpoints used by process-crash integration tests. */
export interface WorkerHooks {
    checkpoint?(point: 'after-claim' | 'after-dispatch' | 'before-settle', claim: RunClaim): void | Promise<void>;
}
/** Process logger used by the Worker. */
export interface WorkerLog {
    info(message: string): void;
    warn(message: string): void;
}
/** One long-lived queue consumer owned by the automation app fiber. */
export declare class AutomationWorker {
    private readonly ctx;
    private readonly automation;
    private readonly options;
    private readonly log;
    private readonly hooks;
    private readonly workerId;
    private timer;
    private pumpTask;
    private stopping;
    private activeAgent;
    constructor(ctx: Context, automation: AutomationService, options: WorkerOptions, log: WorkerLog, hooks?: WorkerHooks);
    /** Execute one bounded cycle and propagate operational failures to the caller. */
    runOnce(): Promise<WorkerCycleResult>;
    /** Start polling immediately and keep the process live until disposed. */
    start(): () => Promise<void>;
    private requestPump;
    private pump;
    private recoverExpiredDispatched;
    private execute;
    private checkpoint;
}
//# sourceMappingURL=worker.d.ts.map
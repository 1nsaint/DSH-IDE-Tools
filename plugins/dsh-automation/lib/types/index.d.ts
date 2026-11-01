/** Cordis service exposing the durable automation store to DSH plugins. */
import { Context, Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { RunClaim, RunId, RunSettlement, RunState, RunView, SubmitRunRequest } from './domain.ts';
import { type AutomationStatus, type EventConsumer, type EventPage, type EventQuery, type ExpiredAttempt, type PurgeResult, type QueueControl, type RetryOptions, type RunEvent, type RunPage, type RunQuery } from './store.ts';
export * from './domain.ts';
export { AutomationStore, SCHEMA_VERSION } from './store.ts';
declare module '@deepseek-ai/cordis' {
    interface Context {
        automation: AutomationService;
    }
}
/** Plugin configuration. */
export interface Config {
    readonly databasePath?: string;
    readonly busyTimeoutMs?: number;
}
/** Durable Run service shared by Trigger adapters and management surfaces. */
export declare class AutomationService extends Service {
    private readonly config;
    static Config: z<Config>;
    private store;
    constructor(ctx: Context, config: Config);
    protected [Service.init](): AsyncGenerator<() => void, void, void>;
    /** Submit an immutable Run, idempotently when the Trigger carries a key. */
    submit(request: SubmitRunRequest): {
        readonly run: RunView;
        readonly created: boolean;
    };
    /** Read one Run. */
    get(id: RunId): RunView;
    /** List Runs newest-first. */
    list(state?: RunState): RunView[];
    /** Query bounded Runs for management and Trigger reconciliation. */
    query(query?: RunQuery): RunPage;
    /** Read the durable global Run event stream after a sequence cursor. */
    changes(query?: EventQuery): EventPage;
    /** Checkpoint one durable adapter event consumer. */
    checkpointConsumer(id: string, seq: number): EventConsumer;
    /** List registered durable adapter event consumers. */
    consumers(): EventConsumer[];
    /** Explicitly unregister one durable adapter event consumer. */
    removeConsumer(id: string): boolean;
    /** Purge bounded terminal Automation bookkeeping without deleting Sessions. */
    purge(before: number, limit: number): PurgeResult;
    /** Read bounded store and queue health for operators. */
    status(now?: number): AutomationStatus;
    /** Read durable queue admission state. */
    control(): QueueControl;
    /** Pause new claims without interrupting active Attempts. */
    pause(reason?: string): QueueControl;
    /** Enter durable drain mode; callers may wait for status.active to reach zero. */
    drain(reason?: string): QueueControl;
    /** Resume new claims. */
    resume(): QueueControl;
    /** Atomically claim the next eligible Run. */
    claimNext(workerId: string, now: number, leaseDurationMs: number): RunClaim | undefined;
    /** Extend the exact currently owned Attempt lease. */
    heartbeat(claim: RunClaim, now: number, leaseDurationMs: number): RunClaim;
    /** Record that canonical DSH dispatch has passed its durability checkpoint. */
    markRunning(claim: RunClaim, now: number): RunView;
    /** Settle the exact currently owned Attempt. */
    settle(claim: RunClaim, settlement: RunSettlement, now: number): RunView;
    /** Requeue expired claims only when no durable dispatch occurred. */
    recoverUndispatchedExpired(now: number): RunId[];
    /** List expired dispatched Attempts requiring canonical Session inspection. */
    expiredDispatched(now: number): ExpiredAttempt[];
    /** Take over a dispatched Attempt only after canonical inspection proves resume is safe. */
    reclaimDispatched(ref: ExpiredAttempt, workerId: string, now: number, leaseDurationMs: number): RunClaim | undefined;
    /** Settle an expired Attempt from canonical recovery evidence. */
    settleExpired(ref: ExpiredAttempt, settlement: RunSettlement, now: number): RunView;
    /** Read the append-only audit stream for one Run. */
    events(id: RunId): RunEvent[];
    /** Request cancellation; queued Runs settle immediately. */
    cancel(id: RunId): RunView;
    /** Explicitly create a replacement for a terminal Run. */
    retry(id: RunId, options: RetryOptions): {
        readonly run: RunView;
        readonly created: boolean;
    };
}
export default AutomationService;
//# sourceMappingURL=index.d.ts.map
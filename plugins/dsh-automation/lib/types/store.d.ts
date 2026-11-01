/** SQLite WAL persistence and transactional Run state transitions. */
import { type RunClaim, type RunId, type RunSettlement, type RunState, type RunView, type SubmitRunRequest } from './domain.ts';
import type { AutomationStatus, EventConsumer, EventPage, EventQuery, ExpiredAttempt, PurgeResult, QueueControl, RetryOptions, RunEvent, RunPage, RunQuery, StoreOptions } from './store/types.ts';
export { SCHEMA_VERSION } from './store/database.ts';
export type { AutomationStatus, EventConsumer, EventPage, EventQuery, ExpiredAttempt, PurgeResult, QueueControl, RetryOptions, RunCursor, RunEvent, RunPage, RunQuery, StoreOptions } from './store/types.ts';
/** Durable store shared by management processes and one or more local Workers. */
export declare class AutomationStore {
    private readonly database;
    private constructor();
    /** Validate the path, open SQLite, and transactionally reach the current schema. */
    static open(options: StoreOptions): Promise<AutomationStore>;
    /** Close this process's SQLite connection. */
    close(): void;
    /** Submit one immutable Run, returning the existing Run for a duplicate idempotency key. */
    submit(request: SubmitRunRequest, now?: number): {
        readonly run: RunView;
        readonly created: boolean;
    };
    /** Return one Run by id. */
    get(id: RunId): RunView;
    /** List Runs newest-first, optionally restricted to one state. */
    list(state?: RunState): RunView[];
    /** Query Runs through a bounded stable cursor. */
    query(query?: RunQuery): RunPage;
    /** Read the durable global Run event stream after one sequence cursor. */
    changes(query?: EventQuery): EventPage;
    /** Monotonically checkpoint one durable event-feed consumer. */
    checkpointConsumer(id: string, seq: number, now?: number): EventConsumer;
    /** List durable event-feed consumers that protect retention. */
    consumers(): EventConsumer[];
    /** Explicitly unregister one event consumer. */
    removeConsumer(id: string): boolean;
    /** Purge a bounded set of terminal bookkeeping protected by consumer cursors. */
    purge(before: number, limit: number): PurgeResult;
    /** Return a bounded health projection without reading prompts or Session data. */
    status(now?: number): AutomationStatus;
    /** Read durable queue admission state. */
    control(): QueueControl;
    /** Stop every Worker from claiming new Runs without interrupting active Attempts. */
    pause(reason?: string, now?: number): QueueControl;
    /** Stop admission and persist that operators are waiting for active Attempts to finish. */
    drain(reason?: string, now?: number): QueueControl;
    /** Allow Workers to claim queued Runs again. */
    resume(now?: number): QueueControl;
    /** Atomically claim the next eligible Run and mint its fenced Attempt. */
    claimNext(workerId: string, now: number, leaseDurationMs: number): RunClaim | undefined;
    /** Extend a currently owned claim or running Attempt. */
    heartbeat(claim: RunClaim, now: number, leaseDurationMs: number): RunClaim;
    /** Commit the checkpoint that canonical DSH dispatch has become durable. */
    markRunning(claim: RunClaim, now: number): RunView;
    /** Settle a Run from a Worker that still owns the exact Attempt lease. */
    settle(claim: RunClaim, settlement: RunSettlement, now: number): RunView;
    /** Request cancellation, atomically terminating a queued Run. */
    requestCancel(id: RunId, now: number): RunView;
    /** Create an explicit replacement Run linked to one terminal original. */
    retry(id: RunId, options: RetryOptions, now?: number): {
        readonly run: RunView;
        readonly created: boolean;
    };
    /** Requeue expired claims that provably never crossed the durable dispatch checkpoint. */
    recoverUndispatchedExpired(now: number): RunId[];
    /** List expired dispatched Attempts that require canonical Session inspection. */
    expiredDispatched(now: number): ExpiredAttempt[];
    /** Fence and take ownership of an expired dispatched Attempt for safe pre-turn resume. */
    reclaimDispatched(ref: ExpiredAttempt, workerId: string, now: number, leaseDurationMs: number): RunClaim | undefined;
    /** Settle an expired dispatched Attempt from canonical Session recovery evidence. */
    settleExpired(ref: ExpiredAttempt, settlement: RunSettlement, now: number): RunView;
    /** Settle an expired dispatched Attempt whose canonical outcome is unknowable. */
    settleExpiredIndeterminate(ref: ExpiredAttempt, diagnostic: string, now: number): RunView;
    /** Read the append-only audit stream for one Run. */
    events(id: RunId): RunEvent[];
    private requireRun;
}
//# sourceMappingURL=store.d.ts.map
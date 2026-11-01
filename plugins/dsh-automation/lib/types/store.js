/** SQLite WAL persistence and transactional Run state transitions. */
import { claimNext, heartbeat, markRunning, settle } from "./store/attempts.js";
import { StoreDatabase } from "./store/database.js";
import { drainQueue, pauseQueue, readQueueControl, resumeQueue } from "./store/control.js";
import { expiredDispatched as findExpiredDispatched, reclaimDispatched as reclaimExpiredDispatched, recoverUndispatchedExpired as recoverExpiredUndispatched, settleExpired as settleExpiredAttempt, } from "./store/recovery.js";
import { queryEvents, queryRuns } from "./store/query.js";
import { checkpointConsumer, listConsumers, purgeTerminal, removeConsumer } from "./store/retention.js";
import { automationStatus, listRuns, requestRunCancel, retryRun, runEvents, submitRun } from "./store/runs.js";
export { SCHEMA_VERSION } from "./store/database.js";
/** Durable store shared by management processes and one or more local Workers. */
export class AutomationStore {
    database;
    constructor(database) {
        this.database = database;
    }
    /** Validate the path, open SQLite, and transactionally reach the current schema. */
    static async open(options) {
        return new AutomationStore(await StoreDatabase.open(options));
    }
    /** Close this process's SQLite connection. */
    close() {
        this.database.close();
    }
    /** Submit one immutable Run, returning the existing Run for a duplicate idempotency key. */
    submit(request, now = Date.now()) {
        return submitRun(this.database, request, now);
    }
    /** Return one Run by id. */
    get(id) {
        return this.requireRun(id);
    }
    /** List Runs newest-first, optionally restricted to one state. */
    list(state) {
        return listRuns(this.database, state);
    }
    /** Query Runs through a bounded stable cursor. */
    query(query = {}) {
        return queryRuns(this.database, query);
    }
    /** Read the durable global Run event stream after one sequence cursor. */
    changes(query = {}) {
        return queryEvents(this.database, query);
    }
    /** Monotonically checkpoint one durable event-feed consumer. */
    checkpointConsumer(id, seq, now = Date.now()) {
        return checkpointConsumer(this.database, id, seq, now);
    }
    /** List durable event-feed consumers that protect retention. */
    consumers() {
        return listConsumers(this.database);
    }
    /** Explicitly unregister one event consumer. */
    removeConsumer(id) {
        return removeConsumer(this.database, id);
    }
    /** Purge a bounded set of terminal bookkeeping protected by consumer cursors. */
    purge(before, limit) {
        return purgeTerminal(this.database, before, limit);
    }
    /** Return a bounded health projection without reading prompts or Session data. */
    status(now = Date.now()) {
        return automationStatus(this.database, now);
    }
    /** Read durable queue admission state. */
    control() {
        return readQueueControl(this.database);
    }
    /** Stop every Worker from claiming new Runs without interrupting active Attempts. */
    pause(reason, now = Date.now()) {
        return pauseQueue(this.database, now, reason);
    }
    /** Stop admission and persist that operators are waiting for active Attempts to finish. */
    drain(reason, now = Date.now()) {
        return drainQueue(this.database, now, reason);
    }
    /** Allow Workers to claim queued Runs again. */
    resume(now = Date.now()) {
        return resumeQueue(this.database, now);
    }
    /** Atomically claim the next eligible Run and mint its fenced Attempt. */
    claimNext(workerId, now, leaseDurationMs) {
        return claimNext(this.database, workerId, now, leaseDurationMs);
    }
    /** Extend a currently owned claim or running Attempt. */
    heartbeat(claim, now, leaseDurationMs) {
        return heartbeat(this.database, claim, now, leaseDurationMs);
    }
    /** Commit the checkpoint that canonical DSH dispatch has become durable. */
    markRunning(claim, now) {
        return markRunning(this.database, claim, now);
    }
    /** Settle a Run from a Worker that still owns the exact Attempt lease. */
    settle(claim, settlement, now) {
        return settle(this.database, claim, settlement, now);
    }
    /** Request cancellation, atomically terminating a queued Run. */
    requestCancel(id, now) {
        return requestRunCancel(this.database, id, now);
    }
    /** Create an explicit replacement Run linked to one terminal original. */
    retry(id, options, now = Date.now()) {
        return retryRun(this.database, id, options, now);
    }
    /** Requeue expired claims that provably never crossed the durable dispatch checkpoint. */
    recoverUndispatchedExpired(now) {
        return recoverExpiredUndispatched(this.database, now);
    }
    /** List expired dispatched Attempts that require canonical Session inspection. */
    expiredDispatched(now) {
        return findExpiredDispatched(this.database, now);
    }
    /** Fence and take ownership of an expired dispatched Attempt for safe pre-turn resume. */
    reclaimDispatched(ref, workerId, now, leaseDurationMs) {
        return reclaimExpiredDispatched(this.database, ref, workerId, now, leaseDurationMs);
    }
    /** Settle an expired dispatched Attempt from canonical Session recovery evidence. */
    settleExpired(ref, settlement, now) {
        return settleExpiredAttempt(this.database, ref, settlement, now);
    }
    /** Settle an expired dispatched Attempt whose canonical outcome is unknowable. */
    settleExpiredIndeterminate(ref, diagnostic, now) {
        return this.settleExpired(ref, { state: 'indeterminate', outcome: 'interrupted', error: diagnostic }, now);
    }
    /** Read the append-only audit stream for one Run. */
    events(id) {
        return runEvents(this.database, id);
    }
    requireRun(id) {
        return this.database.requireRun(id);
    }
}
//# sourceMappingURL=store.js.map
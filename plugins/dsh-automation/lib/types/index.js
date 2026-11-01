/** Cordis service exposing the durable automation store to DSH plugins. */
import { join } from 'node:path';
import { Service } from '@deepseek-ai/cordis';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import z from '@deepseek-ai/schemastery';
import { AutomationStore } from "./store.js";
export * from "./domain.js";
export { AutomationStore, SCHEMA_VERSION } from "./store.js";
/** Durable Run service shared by Trigger adapters and management surfaces. */
export class AutomationService extends Service {
    config;
    static Config = z.object({
        databasePath: z.string(),
        busyTimeoutMs: z.number().step(1).min(0).max(2_147_483_647).default(5_000),
    });
    store;
    constructor(ctx, config) {
        super(ctx, 'automation');
        this.config = config;
    }
    async *[Service.init]() {
        this.store = await AutomationStore.open({
            path: this.config.databasePath ?? join(resolveDshHome(), 'automation', 'automation.db'),
            ...(this.config.busyTimeoutMs === undefined ? {} : { busyTimeoutMs: this.config.busyTimeoutMs }),
        });
        yield () => { this.store.close(); };
    }
    /** Submit an immutable Run, idempotently when the Trigger carries a key. */
    submit(request) {
        return this.store.submit(request);
    }
    /** Read one Run. */
    get(id) {
        return this.store.get(id);
    }
    /** List Runs newest-first. */
    list(state) {
        return this.store.list(state);
    }
    /** Query bounded Runs for management and Trigger reconciliation. */
    query(query = {}) {
        return this.store.query(query);
    }
    /** Read the durable global Run event stream after a sequence cursor. */
    changes(query = {}) {
        return this.store.changes(query);
    }
    /** Checkpoint one durable adapter event consumer. */
    checkpointConsumer(id, seq) {
        return this.store.checkpointConsumer(id, seq);
    }
    /** List registered durable adapter event consumers. */
    consumers() {
        return this.store.consumers();
    }
    /** Explicitly unregister one durable adapter event consumer. */
    removeConsumer(id) {
        return this.store.removeConsumer(id);
    }
    /** Purge bounded terminal Automation bookkeeping without deleting Sessions. */
    purge(before, limit) {
        return this.store.purge(before, limit);
    }
    /** Read bounded store and queue health for operators. */
    status(now = Date.now()) {
        return this.store.status(now);
    }
    /** Read durable queue admission state. */
    control() {
        return this.store.control();
    }
    /** Pause new claims without interrupting active Attempts. */
    pause(reason) {
        return this.store.pause(reason);
    }
    /** Enter durable drain mode; callers may wait for status.active to reach zero. */
    drain(reason) {
        return this.store.drain(reason);
    }
    /** Resume new claims. */
    resume() {
        return this.store.resume();
    }
    /** Atomically claim the next eligible Run. */
    claimNext(workerId, now, leaseDurationMs) {
        return this.store.claimNext(workerId, now, leaseDurationMs);
    }
    /** Extend the exact currently owned Attempt lease. */
    heartbeat(claim, now, leaseDurationMs) {
        return this.store.heartbeat(claim, now, leaseDurationMs);
    }
    /** Record that canonical DSH dispatch has passed its durability checkpoint. */
    markRunning(claim, now) {
        return this.store.markRunning(claim, now);
    }
    /** Settle the exact currently owned Attempt. */
    settle(claim, settlement, now) {
        return this.store.settle(claim, settlement, now);
    }
    /** Requeue expired claims only when no durable dispatch occurred. */
    recoverUndispatchedExpired(now) {
        return this.store.recoverUndispatchedExpired(now);
    }
    /** List expired dispatched Attempts requiring canonical Session inspection. */
    expiredDispatched(now) {
        return this.store.expiredDispatched(now);
    }
    /** Take over a dispatched Attempt only after canonical inspection proves resume is safe. */
    reclaimDispatched(ref, workerId, now, leaseDurationMs) {
        return this.store.reclaimDispatched(ref, workerId, now, leaseDurationMs);
    }
    /** Settle an expired Attempt from canonical recovery evidence. */
    settleExpired(ref, settlement, now) {
        return this.store.settleExpired(ref, settlement, now);
    }
    /** Read the append-only audit stream for one Run. */
    events(id) {
        return this.store.events(id);
    }
    /** Request cancellation; queued Runs settle immediately. */
    cancel(id) {
        return this.store.requestCancel(id, Date.now());
    }
    /** Explicitly create a replacement for a terminal Run. */
    retry(id, options) {
        return this.store.retry(id, options);
    }
}
export default AutomationService;
//# sourceMappingURL=index.js.map
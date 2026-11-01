/** Idempotent Automation submission and durable event-feed reconciliation. */
import { buildAutomationPrompt } from "./standing.js";
const CONSUMER_ID = 'cron.adapter.v1';
const EVENT_PAGE_SIZE = 200;
export class CronAutomationAdapter {
    store;
    automation;
    now;
    warn;
    onSettled;
    onSessionReady;
    reconcileTask;
    constructor(store, automation, now, warn, onSettled, onSessionReady) {
        this.store = store;
        this.automation = automation;
        this.now = now;
        this.warn = warn;
        this.onSettled = onSettled;
        this.onSessionReady = onSessionReady;
    }
    /** Resume every source occurrence that was persisted before a process loss. */
    async submitPending() {
        for (const job of this.store.list()) {
            for (const run of job.runs) {
                if (run.state === 'submitting' && run.automationRunId === undefined)
                    await this.submit(job, run);
            }
        }
    }
    /** Re-attach known Sessions after restart (Ungrouped → workspace). */
    async reattachKnownSessions() {
        for (const job of this.store.list()) {
            for (const run of job.runs) {
                const known = run.sessionId;
                if (known) {
                    this.onSessionReady?.(job, run, known);
                    continue;
                }
                if (run.automationRunId === undefined)
                    continue;
                try {
                    const view = this.automation.get(run.automationRunId);
                    const sessionId = view.finalSessionId;
                    if (sessionId)
                        this.noteSession(job, run, sessionId);
                }
                catch (error) {
                    this.warn(`dsh-cron: reattach lookup failed for ${run.automationRunId}: ${message(error)}`);
                }
            }
        }
    }
    /** Submit one already-persisted occurrence through the idempotent boundary. */
    async submit(job, record) {
        if (job.target === null) {
            this.warn(`dsh-cron: ${job.id} occurrence ${record.occurrenceId} awaits a fresh Session target`);
            return;
        }
        try {
            const result = this.automation.submit({
                prompt: buildAutomationPrompt(job, record.scheduledAt, this.store.standingInstructions()),
                target: job.target,
                trigger: {
                    kind: 'cron',
                    sourceId: job.id,
                    occurrenceId: record.occurrenceId,
                    idempotencyKey: record.idempotencyKey,
                },
                concurrency: { key: `cron:${job.id}`, limit: job.concurrencyLimit },
            });
            record.automationRunId = result.run.id;
            record.firedAt = new Date(this.now()).toISOString();
            const settled = applyProjection(record, result.run);
            if (result.run.finalSessionId)
                this.noteSession(job, record, result.run.finalSessionId);
            this.store.flush();
            if (settled)
                this.onSettled?.(job, record);
        }
        catch (error) {
            this.warn(`dsh-cron: Automation submission failed for ${job.id}/${record.occurrenceId}: ${message(error)}`);
        }
    }
    /** Reconcile to the newest scanned global event cursor, coalescing concurrent polls. */
    async reconcile() {
        if (this.reconcileTask !== undefined)
            return await this.reconcileTask;
        const task = this.reconcileFeed().finally(() => {
            if (this.reconcileTask === task)
                this.reconcileTask = undefined;
        });
        this.reconcileTask = task;
        return await task;
    }
    async reconcileFeed() {
        while (true) {
            let page;
            try {
                page = this.automation.changes({
                    afterSeq: this.store.eventCursor(), triggerKind: 'cron', limit: EVENT_PAGE_SIZE,
                });
            }
            catch (error) {
                if (!cursorExpired(error))
                    throw error;
                this.refreshLinkedRuns();
                const cursor = this.automation.status().eventFeed.prunedThroughSeq;
                this.store.advanceEventCursor(cursor);
                this.automation.checkpointConsumer(CONSUMER_ID, cursor);
                continue;
            }
            for (const event of page.events) {
                const sessionId = sessionIdFromEvent(event);
                if (sessionId !== undefined) {
                    const found = findRun(this.store, event.runId);
                    if (found !== undefined)
                        this.noteSession(found.job, found.record, sessionId);
                }
                this.refreshRun(event.runId);
            }
            this.store.advanceEventCursor(page.nextSeq);
            this.automation.checkpointConsumer(CONSUMER_ID, page.nextSeq);
            if (!page.hasMore)
                return;
        }
    }
    refreshLinkedRuns() {
        for (const job of this.store.list()) {
            for (const record of job.runs) {
                if (record.automationRunId !== undefined)
                    this.refreshRun(record.automationRunId);
            }
        }
    }
    refreshRun(runId) {
        const found = findRun(this.store, runId);
        if (found === undefined)
            return;
        try {
            const view = this.automation.get(runId);
            const settled = applyProjection(found.record, view);
            if (view.finalSessionId)
                this.noteSession(found.job, found.record, view.finalSessionId);
            this.store.flush();
            if (settled)
                this.onSettled?.(found.job, found.record);
        }
        catch (error) {
            this.warn(`dsh-cron: could not reconcile Automation Run ${runId}: ${message(error)}`);
        }
    }
    noteSession(job, record, sessionId) {
        if (record.sessionId === sessionId) {
            this.onSessionReady?.(job, record, sessionId);
            return;
        }
        record.sessionId = sessionId;
        this.store.flush();
        this.onSessionReady?.(job, record, sessionId);
    }
}
function applyProjection(record, run) {
    const wasTerminal = terminalRecord(record);
    record.state = run.state;
    record.lastEventSeq ??= 0;
    if (run.outcome === undefined)
        delete record.outcome;
    else
        record.outcome = run.outcome;
    if (run.resultExcerpt === undefined)
        delete record.excerpt;
    else
        record.excerpt = run.resultExcerpt;
    if (run.error === undefined)
        delete record.error;
    else
        record.error = run.error;
    if (terminal(run.state))
        record.completedAt = new Date(run.updatedAt).toISOString();
    return !wasTerminal && terminal(run.state);
}
function findRun(store, runId) {
    for (const job of store.list()) {
        const found = job.runs.find(run => run.automationRunId === runId);
        if (found !== undefined)
            return { job, record: found };
    }
    return undefined;
}
function sessionIdFromEvent(event) {
    if (event.data === null || typeof event.data !== 'object')
        return undefined;
    const sessionId = event.data.sessionId;
    return typeof sessionId === 'string' && sessionId.length > 0 ? sessionId : undefined;
}
function terminalRecord(run) {
    return run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled' || run.state === 'indeterminate';
}
function terminal(state) {
    return state === 'succeeded' || state === 'failed' || state === 'cancelled' || state === 'indeterminate';
}
function cursorExpired(error) {
    return typeof error === 'object' && error !== null && 'code' in error && error.code === 'EVENT_CURSOR_EXPIRED';
}
function message(error) {
    return error instanceof Error ? error.message : String(error);
}
//# sourceMappingURL=adapter.js.map
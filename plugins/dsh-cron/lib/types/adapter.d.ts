/** Idempotent Automation submission and durable event-feed reconciliation. */
import type { AutomationPort } from './automation.ts';
import type { CronJob, CronRunRecord, CronStore } from './store.ts';
export type CronSessionReady = (job: CronJob, record: CronRunRecord, sessionId: string) => void;
export declare class CronAutomationAdapter {
    private readonly store;
    private readonly automation;
    private readonly now;
    private readonly warn;
    private readonly onSettled?;
    private readonly onSessionReady?;
    private reconcileTask;
    constructor(store: CronStore, automation: AutomationPort, now: () => number, warn: (message: string) => void, onSettled?: ((job: CronJob, run: CronRunRecord) => void) | undefined, onSessionReady?: CronSessionReady | undefined);
    /** Resume every source occurrence that was persisted before a process loss. */
    submitPending(): Promise<void>;
    /** Re-attach known Sessions after restart (Ungrouped → workspace). */
    reattachKnownSessions(): Promise<void>;
    /** Submit one already-persisted occurrence through the idempotent boundary. */
    submit(job: CronJob, record: CronRunRecord): Promise<void>;
    /** Reconcile to the newest scanned global event cursor, coalescing concurrent polls. */
    reconcile(): Promise<void>;
    private reconcileFeed;
    private refreshLinkedRuns;
    private refreshRun;
    private noteSession;
}
//# sourceMappingURL=adapter.d.ts.map
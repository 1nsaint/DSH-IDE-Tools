/**
 * Single-instance scheduler lock. Two dsh processes sharing one Harness home
 * both load this plugin; without coordination each would fire every job. The
 * lock holder runs the scheduler; other instances stay management-only.
 * @module dsh-cron/lock
 */
export interface SchedulerLock {
    /** Whether this process holds the lock and may run the scheduler. */
    readonly acquired: boolean;
    /** Release the lock; a no-op when not held. */
    release(): void;
}
/**
 * Acquire the scheduler lock under the store directory.
 * @param dataDir - the cron store directory.
 * @param warn - sink for the passive-mode notice.
 * @returns the lock handle; `acquired: false` means another live process owns it.
 */
export declare function acquireSchedulerLock(dataDir: string, warn: (message: string) => void): SchedulerLock;
//# sourceMappingURL=lock.d.ts.map
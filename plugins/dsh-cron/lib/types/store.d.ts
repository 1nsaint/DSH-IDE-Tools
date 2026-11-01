/**
 * Durable JSON job store for dsh-cron. One atomic-write file holds every job;
 * the file is the source of truth and in-memory state is its projection.
 * @module dsh-cron/store
 */
import type { AutomationRunState, AutomationTarget } from './automation.ts';
/** One-shot absolute schedule, RFC 3339 UTC. */
export interface AtSchedule {
    readonly kind: 'at';
    readonly at: string;
}
/** Recurring five-field cron schedule interpreted in one IANA zone. */
export interface CronSchedule {
    readonly kind: 'cron';
    readonly expression: string;
    readonly timeZone: string;
}
/** Job schedule union persisted in the store. */
export type JobSchedule = AtSchedule | CronSchedule;
/** The recorded outcome of one dispatch. */
export interface CronRunRecord {
    /** Stable source occurrence identity. */
    readonly occurrenceId: string;
    readonly scheduledAt: string;
    readonly idempotencyKey: string;
    /** RFC 3339 UTC submission time. */
    firedAt: string;
    automationRunId?: string;
    state: 'submitting' | AutomationRunState | 'legacy';
    completedAt?: string;
    outcome?: string;
    excerpt?: string;
    error?: string;
    lastEventSeq?: number;
    /** Automation Attempt Session id once claimed. */
    sessionId?: string;
}
/** One durable scheduled job. */
export interface CronJob {
    /** Stable store-local id, never reused within one store file. */
    readonly id: string;
    /** Task prompt delivered when the schedule fires. */
    readonly prompt: string;
    readonly schedule: JobSchedule;
    /** Session id of the creating agent, preferred at dispatch; null when unknown. */
    readonly createdBy: string | null;
    /** Fresh canonical Session target owned by Automation; null means a legacy job awaiting retarget. */
    target: AutomationTarget | null;
    concurrencyLimit: number;
    migrationIssue?: string;
    /** RFC 3339 UTC creation time. */
    readonly createdAt: string;
    /** RFC 3339 UTC of the next pending fire; in the past while overdue. */
    nextAt: string;
    /** RFC 3339 UTC of the most recent dispatch, or null. */
    lastFiredAt: string | null;
    /** Number of completed dispatches. */
    fireCount: number;
    /** `done` one-shots stay in the store as history; they never fire again. */
    state: 'active' | 'done';
    /** Paused jobs are kept but excluded from dispatch. */
    paused: boolean;
    /** The most recent dispatch outcome, or null. */
    lastRun: CronRunRecord | null;
    runs: CronRunRecord[];
}
/**
 * JSON-file job store. Writes are atomic (temporary file plus rename). A
 * corrupt store file is quarantined aside and the store starts empty, because
 * a plugin must not take down the whole host boot.
 */
export declare class CronStore {
    private readonly filePath;
    private readonly warn;
    private readonly fallbackTarget?;
    private readonly maxRunHistory;
    private seq;
    private jobList;
    private standingText;
    private watcher;
    private lastWritten;
    private lastStat;
    private eventSeq;
    private loadedVersion;
    private readonly writeLockDir;
    private readonly seqFile;
    private readonly baseJobs;
    private readonly deletedIds;
    /**
     * @param filePath - absolute path of the JSON store file.
     * @param warn - sink for recoverable store problems (quarantine, dropped entries).
     */
    constructor(filePath: string, warn: (message: string) => void, fallbackTarget?: AutomationTarget | undefined, maxRunHistory?: number);
    /** Load the store from disk; a missing file means an empty store. */
    load(): void;
    /**
     * Replace the in-memory projection with the given file content. Hot reloads
     * (external writes from another process sharing this store) degrade to a
     * warning on an unsupported format instead of failing the host boot.
     */
    private applyRaw;
    /** Cron-only preamble injected into every scheduled Automation run. */
    standingInstructions(): string;
    /** Replace the shared standing instructions and persist. */
    setStandingInstructions(text: string): void;
    private rebase;
    /** List jobs in insertion order. */
    list(): readonly CronJob[];
    /** Find one job by id. */
    get(id: string): CronJob | undefined;
    /** Allocate the next never-reused job id. */
    allocateId(): string;
    /** Insert a job and persist. */
    insert(job: CronJob): void;
    /** Remove a job by id and persist; returns false when unknown. */
    remove(id: string): boolean;
    /** Persist after an in-place job mutation. */
    flush(): void;
    /** Last globally applied Automation event sequence. */
    eventCursor(): number;
    /** Persist a monotonic Automation event cursor after local effects are applied. */
    advanceEventCursor(seq: number): void;
    /** Append one source occurrence before any external submission. */
    appendRun(job: CronJob, run: CronRunRecord): void;
    /**
     * Watch the store file for external changes (another dsh process sharing
     * this Harness home) and hot-reload the in-memory projection. Polling is
     * used instead of `fs.watch`: libuv's fs-event on Windows aborts the
     * process when the watched directory is deleted, which the tests' teardown
     * (and a removed data dir in production) would trigger. Self-writes are
     * recognized by content equality and skipped. Returns a disposer.
     * @param onReload - called once per applied external reload.
     * @param intervalMs - poll interval; tests use a short one.
     */
    watch(onReload?: (jobs: number) => void, intervalMs?: number): () => void;
    /** One poll tick: reload when the file changed since our last sighting. */
    private poll;
    /** Whether the file changed since our last write; reloads when it did. */
    private reloadIfChanged;
    private stopWatch;
    private persist;
    private writeSnapshot;
    private mergeFromDisk;
    private readSeqSidecar;
    private writeSeqSidecar;
}
//# sourceMappingURL=store.d.ts.map
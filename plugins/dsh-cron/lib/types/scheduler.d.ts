/** Durable calendar scheduling that produces idempotent Automation occurrences. */
import type { CronAutomationAdapter } from './adapter.ts';
import type { AutomationTarget } from './automation.ts';
import type { CronJob, CronStore } from './store.ts';
export interface AddJobInput {
    readonly prompt: string;
    readonly cron?: string;
    readonly timeZone?: string;
    readonly at?: string;
    readonly createdBy?: string | null;
    readonly target?: AutomationTarget;
    readonly concurrencyLimit?: number;
}
export interface AddJobResult {
    readonly job: CronJob;
    readonly deduplicated: boolean;
    readonly nextOccurrences: readonly string[];
}
export interface CronSchedulerOptions {
    readonly store: CronStore;
    readonly adapter: CronAutomationAdapter;
    readonly now: () => number;
    readonly armTimer: (callback: () => void, delayMs: number) => () => void;
    readonly warn?: (message: string) => void;
    readonly defaultTarget?: AutomationTarget;
    readonly defaultTimeZone: string;
    readonly maxJobs: number;
    readonly minIntervalMinutes: number;
}
export interface CronService {
    add(input: AddJobInput): AddJobResult;
    edit(id: string, input: AddJobInput): AddJobResult;
    remove(id: string): boolean;
    list(): readonly CronJob[];
    standingInstructions(): string;
    setStandingInstructions(text: string): string;
    fireNow(id: string): Promise<'submitted' | 'not_found' | 'target_required'>;
    setPaused(id: string, paused: boolean): boolean;
    setTarget(id: string, target: AutomationTarget): boolean;
}
export declare class CronScheduler {
    private readonly options;
    private cancelTimer;
    private firing;
    private pendingFire;
    private running;
    private readonly specs;
    constructor(options: CronSchedulerOptions);
    service(): CronService;
    start(): void;
    stop(): void;
    storeChanged(): void;
    listJobs(): readonly CronJob[];
    reconcile(): Promise<void>;
    addJob(input: AddJobInput): AddJobResult;
    /** Update prompt / schedule / target on an active job. Preserves pause state and run history. */
    editJob(id: string, input: AddJobInput): AddJobResult;
    removeJob(id: string): boolean;
    setPaused(id: string, paused: boolean): boolean;
    setTarget(id: string, target: AutomationTarget): boolean;
    fireNow(id: string): Promise<'submitted' | 'not_found' | 'target_required'>;
    private resolveSchedule;
    private requestFire;
    private runFireDue;
    private beginOccurrence;
    private advanceRecurring;
    private preview;
    private specFor;
    private arm;
}
//# sourceMappingURL=scheduler.d.ts.map
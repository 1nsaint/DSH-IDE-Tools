/** Run submission, management reads, health, cancellation, and audit queries. */
import { type RunId, type RunState, type RunView, type SubmitRunRequest } from '../domain.ts';
import { type StoreDatabase } from './database.ts';
import type { AutomationStatus, RetryOptions, RunEvent } from './types.ts';
export declare function submitRun(database: StoreDatabase, request: SubmitRunRequest, now: number): {
    readonly run: RunView;
    readonly created: boolean;
};
export declare function listRuns(database: StoreDatabase, state?: RunState): RunView[];
export declare function automationStatus(database: StoreDatabase, now: number): AutomationStatus;
export declare function requestRunCancel(database: StoreDatabase, id: RunId, now: number): RunView;
export declare function retryRun(database: StoreDatabase, id: RunId, options: RetryOptions, now: number): {
    readonly run: RunView;
    readonly created: boolean;
};
export declare function runEvents(database: StoreDatabase, id: RunId): RunEvent[];
//# sourceMappingURL=runs.d.ts.map
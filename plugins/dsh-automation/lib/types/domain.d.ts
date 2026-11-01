/** Durable, transport-safe automation domain types. */
declare const runIdBrand: unique symbol;
declare const leaseTokenBrand: unique symbol;
/** Stable identifier of one durable automation Run. */
export type RunId = string & {
    readonly [runIdBrand]: 'RunId';
};
/** Unforgeable capability fencing writes from an expired Worker Attempt. */
export type LeaseToken = string & {
    readonly [leaseTokenBrand]: 'LeaseToken';
};
/** Current lifecycle state of a durable Run. */
export type RunState = 'queued' | 'claimed' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled' | 'indeterminate';
/** Current lifecycle state of one concrete execution Attempt. */
export type AttemptState = 'claimed' | 'running' | 'cancelling' | 'succeeded' | 'failed' | 'cancelled' | 'lost' | 'indeterminate';
/** Normalized reason derived from a canonical DSH turn or recovery decision. */
export type RunOutcome = 'completed' | 'blocked' | 'max-tokens' | 'error' | 'aborted' | 'cancelled' | 'interrupted' | 'not-dispatched';
/** Trigger provenance used for audit and idempotent submission. */
export interface TriggerSpec {
    /** Stable lowercase adapter namespace such as manual, cron, or webhook. */
    readonly kind: string;
    readonly sourceId: string;
    readonly occurrenceId?: string;
    readonly idempotencyKey?: string;
}
/** Optional database-enforced admission group shared across Worker processes. */
export interface ConcurrencySpec {
    readonly key: string;
    readonly limit: number;
}
/** A fresh canonical DSH Session target. */
export interface FreshTarget {
    readonly kind: 'fresh';
    readonly cwd: string;
    readonly preset?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly permissionPreset?: string;
}
/** Target accepted by the first automation release. */
export type TargetSpec = FreshTarget;
/** Request accepted by the durable submission boundary. */
export interface SubmitRunRequest {
    readonly prompt: string;
    readonly target: TargetSpec;
    readonly trigger: TriggerSpec;
    readonly priority?: number;
    readonly availableAt?: number;
    readonly maxAttempts?: number;
    readonly retryOf?: RunId;
    readonly concurrency?: ConcurrencySpec;
}
/** Read-only public projection of one Run. */
export interface RunView {
    readonly id: RunId;
    readonly state: RunState;
    readonly prompt: string;
    readonly target: TargetSpec;
    readonly trigger: TriggerSpec;
    readonly priority: number;
    readonly maxAttempts: number;
    readonly attemptCount: number;
    readonly currentAttempt?: number;
    readonly createdAt: number;
    readonly updatedAt: number;
    readonly availableAt: number;
    readonly cancelRequestedAt?: number;
    readonly finalSessionId?: string;
    readonly outcome?: RunOutcome;
    readonly resultExcerpt?: string;
    readonly error?: string;
    readonly retryOf?: RunId;
    readonly concurrency?: ConcurrencySpec;
}
/** Lease-fenced execution capability returned by an atomic claim. */
export interface RunClaim {
    readonly run: RunView;
    readonly attempt: number;
    readonly workerId: string;
    readonly leaseToken: LeaseToken;
    readonly leaseExpiresAt: number;
    readonly sessionId: string;
}
/** Terminal update committed by the Worker that still owns a lease. */
export interface RunSettlement {
    readonly state: 'succeeded' | 'failed' | 'cancelled' | 'indeterminate';
    readonly outcome: RunOutcome;
    readonly resultExcerpt?: string;
    readonly error?: string;
}
/** Validate runtime settlement payloads before they cross the durable boundary. */
export declare function resolveSettlement(settlement: RunSettlement): RunSettlement;
/** Stable coded failure from a domain or persistence precondition. */
export declare class AutomationError extends Error {
    readonly code: 'INVALID_REQUEST' | 'RUN_NOT_FOUND' | 'LEASE_LOST' | 'INVALID_TRANSITION' | 'STORE_INCOMPATIBLE' | 'EVENT_CURSOR_EXPIRED';
    constructor(code: 'INVALID_REQUEST' | 'RUN_NOT_FOUND' | 'LEASE_LOST' | 'INVALID_TRANSITION' | 'STORE_INCOMPATIBLE' | 'EVENT_CURSOR_EXPIRED', message: string);
}
/** Validate and normalize one submission at the durable boundary. */
export declare function resolveSubmitRequest(request: SubmitRunRequest, now: number): Required<Pick<SubmitRunRequest, 'priority' | 'availableAt' | 'maxAttempts'>> & SubmitRunRequest;
/** Parse and validate persisted Trigger JSON. */
export declare function decodeTrigger(value: unknown): TriggerSpec;
/** Parse and validate persisted concurrency JSON-compatible columns. */
export declare function decodeConcurrency(key: unknown, limit: unknown): ConcurrencySpec | undefined;
/** Parse and validate persisted Target JSON. */
export declare function decodeTarget(value: unknown): TargetSpec;
export {};
//# sourceMappingURL=domain.d.ts.map
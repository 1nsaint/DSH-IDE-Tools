/** Lease-expiry transitions and recovery ownership fencing. */
import { type RunClaim, type RunId, type RunSettlement, type RunView } from '../domain.ts';
import type { StoreDatabase } from './database.ts';
import type { ExpiredAttempt } from './types.ts';
export declare function recoverUndispatchedExpired(database: StoreDatabase, now: number): RunId[];
export declare function expiredDispatched(database: StoreDatabase, now: number): ExpiredAttempt[];
export declare function reclaimDispatched(database: StoreDatabase, ref: ExpiredAttempt, workerId: string, now: number, leaseDurationMs: number): RunClaim | undefined;
export declare function settleExpired(database: StoreDatabase, ref: ExpiredAttempt, settlement: RunSettlement, now: number): RunView;
//# sourceMappingURL=recovery.d.ts.map
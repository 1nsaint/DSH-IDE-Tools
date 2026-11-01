/** Lease-fenced live Attempt lifecycle and database-level claim admission. */
import { type RunClaim, type RunSettlement, type RunView } from '../domain.ts';
import { type StoreDatabase } from './database.ts';
export declare function claimNext(database: StoreDatabase, workerId: string, now: number, leaseDurationMs: number): RunClaim | undefined;
export declare function heartbeat(database: StoreDatabase, claim: RunClaim, now: number, leaseDurationMs: number): RunClaim;
export declare function markRunning(database: StoreDatabase, claim: RunClaim, now: number): RunView;
export declare function settle(database: StoreDatabase, claim: RunClaim, settlement: RunSettlement, now: number): RunView;
//# sourceMappingURL=attempts.d.ts.map
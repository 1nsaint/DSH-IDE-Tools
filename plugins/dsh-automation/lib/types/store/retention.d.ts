/** Durable event-consumer checkpoints and bounded terminal Run retention. */
import type { StoreDatabase } from './database.ts';
import type { EventConsumer, PurgeResult } from './types.ts';
export declare function checkpointConsumer(database: StoreDatabase, id: string, seq: number, now: number): EventConsumer;
export declare function listConsumers(database: StoreDatabase): EventConsumer[];
export declare function removeConsumer(database: StoreDatabase, id: string): boolean;
export declare function purgeTerminal(database: StoreDatabase, before: number, limit: number): PurgeResult;
//# sourceMappingURL=retention.d.ts.map
/** Durable queue admission control shared by every Worker process. */
import type { StoreDatabase } from './database.ts';
import type { QueueControl } from './types.ts';
export declare function readQueueControl(database: StoreDatabase): QueueControl;
export declare function pauseQueue(database: StoreDatabase, now: number, reason?: string): QueueControl;
export declare function drainQueue(database: StoreDatabase, now: number, reason?: string): QueueControl;
export declare function resumeQueue(database: StoreDatabase, now: number): QueueControl;
//# sourceMappingURL=control.d.ts.map
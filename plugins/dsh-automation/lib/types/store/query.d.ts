/** Cursor-paginated Run reads and durable global event feed. */
import { type StoreDatabase } from './database.ts';
import type { EventPage, EventQuery, RunPage, RunQuery } from './types.ts';
export declare function queryRuns(database: StoreDatabase, query?: RunQuery): RunPage;
export declare function queryEvents(database: StoreDatabase, query?: EventQuery): EventPage;
//# sourceMappingURL=query.d.ts.map
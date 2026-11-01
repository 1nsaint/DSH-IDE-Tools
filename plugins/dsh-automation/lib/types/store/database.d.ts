/** SQLite lifecycle, schema, row decoding, and transaction primitives. */
import { DatabaseSync } from 'node:sqlite';
import { type RunId, type RunView } from '../domain.ts';
import type { SqlRow, StoreOptions } from './types.ts';
export { SCHEMA_VERSION } from './schema.ts';
export declare class StoreDatabase {
    readonly sql: DatabaseSync;
    private constructor();
    static open(options: StoreOptions): Promise<StoreDatabase>;
    close(): void;
    currentAttempt(runId: RunId, attempt: number): SqlRow;
    requireRun(id: RunId): RunView;
    event(runId: RunId, at: number, type: string, data: unknown): void;
    transaction<T>(operation: () => T): T;
}
export declare function decodeRun(row: SqlRow): RunView;
//# sourceMappingURL=database.d.ts.map
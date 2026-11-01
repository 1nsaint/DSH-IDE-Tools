/** Sequential, transactional SQLite schema creation and migration. */
import type { DatabaseSync } from 'node:sqlite';
/** Current on-disk schema. Unknown future readers fail closed. */
export declare const SCHEMA_VERSION = 2;
export declare function initializeSchema(db: DatabaseSync): void;
//# sourceMappingURL=schema.d.ts.map
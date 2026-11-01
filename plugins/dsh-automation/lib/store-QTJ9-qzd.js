import { AutomationError, decodeConcurrency, decodeTarget, decodeTrigger, resolveSettlement, resolveSubmitRequest } from "./domain.js";
import { dirname, resolve } from "node:path";
import { randomUUID } from "node:crypto";
import { chmod, lstat, mkdir, open } from "node:fs/promises";
import { DatabaseSync } from "node:sqlite";
//#region lib/types/store/schema.js
/** Sequential, transactional SQLite schema creation and migration. */
/** Current on-disk schema. Unknown future readers fail closed. */
const SCHEMA_VERSION = 2;
function initializeSchema(db) {
	let version = Number(db.prepare("PRAGMA user_version").get().user_version);
	if (!Number.isSafeInteger(version) || version < 0 || version > 2) throw new AutomationError("STORE_INCOMPATIBLE", `automation store schema ${version} is not supported by schema 2`);
	if (version === 0) {
		createCurrentSchema(db);
		return;
	}
	while (version < 2) {
		if (version === 1) migrateV1ToV2(db);
		else throw new AutomationError("STORE_INCOMPATIBLE", `automation store schema ${version} has no migration to schema 2`);
		version += 1;
	}
}
function createCurrentSchema(db) {
	db.exec(`
    BEGIN IMMEDIATE;
    CREATE TABLE store_meta (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      schema_version INTEGER NOT NULL,
      store_id TEXT NOT NULL
    ) STRICT;
    INSERT INTO store_meta VALUES (1, 2, '${randomUUID()}');
    CREATE TABLE runs (
      id TEXT PRIMARY KEY,
      state TEXT NOT NULL CHECK (state IN ('queued','claimed','running','cancelling','succeeded','failed','cancelled','indeterminate')),
      prompt TEXT NOT NULL CHECK (length(trim(prompt)) > 0),
      target_json TEXT NOT NULL,
      trigger_json TEXT NOT NULL,
      trigger_kind TEXT NOT NULL,
      trigger_source_id TEXT NOT NULL,
      idempotency_key TEXT,
      priority INTEGER NOT NULL,
      max_attempts INTEGER NOT NULL CHECK (max_attempts > 0),
      attempt_count INTEGER NOT NULL CHECK (attempt_count >= 0),
      current_attempt INTEGER,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      available_at INTEGER NOT NULL,
      cancel_requested_at INTEGER,
      final_session_id TEXT,
      outcome TEXT,
      result_excerpt TEXT,
      error TEXT,
      retry_of TEXT REFERENCES runs(id),
      trigger_occurrence_id TEXT,
      concurrency_key TEXT,
      concurrency_limit INTEGER CHECK (concurrency_limit IS NULL OR (concurrency_limit >= 1 AND concurrency_limit <= 1000))
    ) STRICT;
    CREATE UNIQUE INDEX runs_idempotency ON runs(trigger_kind, trigger_source_id, idempotency_key) WHERE idempotency_key IS NOT NULL;
    CREATE INDEX runs_claim_order ON runs(state, available_at, priority DESC, created_at, id);
    CREATE INDEX runs_by_trigger ON runs(trigger_kind, trigger_source_id, created_at DESC, id DESC);
    CREATE INDEX runs_active_concurrency ON runs(concurrency_key, state) WHERE concurrency_key IS NOT NULL;
    CREATE TABLE attempts (
      run_id TEXT NOT NULL REFERENCES runs(id),
      attempt_no INTEGER NOT NULL CHECK (attempt_no > 0),
      state TEXT NOT NULL CHECK (state IN ('claimed','running','cancelling','succeeded','failed','cancelled','lost','indeterminate')),
      worker_id TEXT NOT NULL,
      lease_token TEXT NOT NULL UNIQUE,
      lease_expires_at INTEGER NOT NULL,
      session_id TEXT NOT NULL UNIQUE,
      claimed_at INTEGER NOT NULL,
      dispatched_at INTEGER,
      finished_at INTEGER,
      outcome TEXT,
      result_excerpt TEXT,
      error TEXT,
      PRIMARY KEY (run_id, attempt_no)
    ) STRICT;
    CREATE INDEX attempts_expired ON attempts(state, lease_expires_at);
    CREATE TABLE run_events (
      seq INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id TEXT NOT NULL REFERENCES runs(id),
      at INTEGER NOT NULL,
      type TEXT NOT NULL,
      data_json TEXT NOT NULL
    ) STRICT;
    CREATE INDEX run_events_by_run ON run_events(run_id, seq);
    CREATE TABLE event_consumers (
      consumer_id TEXT PRIMARY KEY,
      last_seq INTEGER NOT NULL CHECK (last_seq >= 0),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE event_retention (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      pruned_through_seq INTEGER NOT NULL CHECK (pruned_through_seq >= 0)
    ) STRICT;
    INSERT INTO event_retention VALUES (1, 0);
    CREATE TABLE automation_control (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      mode TEXT NOT NULL CHECK (mode IN ('running','paused','draining')),
      paused_at INTEGER,
      pause_reason TEXT,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO automation_control VALUES (1, 'running', NULL, NULL, 0);
    PRAGMA user_version = 2;
    COMMIT;
  `);
}
function migrateV1ToV2(db) {
	db.exec(`
    BEGIN IMMEDIATE;
    ALTER TABLE runs ADD COLUMN trigger_occurrence_id TEXT;
    ALTER TABLE runs ADD COLUMN concurrency_key TEXT;
    ALTER TABLE runs ADD COLUMN concurrency_limit INTEGER CHECK (concurrency_limit IS NULL OR (concurrency_limit >= 1 AND concurrency_limit <= 1000));
    UPDATE runs SET trigger_occurrence_id = json_extract(trigger_json, '$.occurrenceId');
    CREATE INDEX runs_by_trigger ON runs(trigger_kind, trigger_source_id, created_at DESC, id DESC);
    CREATE INDEX runs_active_concurrency ON runs(concurrency_key, state) WHERE concurrency_key IS NOT NULL;
    CREATE TABLE automation_control (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      mode TEXT NOT NULL CHECK (mode IN ('running','paused','draining')),
      paused_at INTEGER,
      pause_reason TEXT,
      updated_at INTEGER NOT NULL
    ) STRICT;
    INSERT INTO automation_control VALUES (1, 'running', NULL, NULL, 0);
    CREATE TABLE event_consumers (
      consumer_id TEXT PRIMARY KEY,
      last_seq INTEGER NOT NULL CHECK (last_seq >= 0),
      updated_at INTEGER NOT NULL
    ) STRICT;
    CREATE TABLE event_retention (
      singleton INTEGER PRIMARY KEY CHECK (singleton = 1),
      pruned_through_seq INTEGER NOT NULL CHECK (pruned_through_seq >= 0)
    ) STRICT;
    INSERT INTO event_retention VALUES (1, 0);
    UPDATE store_meta SET schema_version = 2 WHERE singleton = 1;
    PRAGMA user_version = 2;
    COMMIT;
  `);
}
//#endregion
//#region lib/types/store/database.js
/** SQLite lifecycle, schema, row decoding, and transaction primitives. */
var StoreDatabase = class StoreDatabase {
	sql;
	constructor(sql) {
		this.sql = sql;
	}
	static async open(options) {
		const path = options.path === ":memory:" ? ":memory:" : resolve(options.path);
		if (path !== ":memory:") await preparePrivateDatabase(path);
		const sql = new DatabaseSync(path);
		try {
			sql.exec("PRAGMA foreign_keys = ON");
			sql.exec(`PRAGMA busy_timeout = ${busyTimeout(options.busyTimeoutMs)}`);
			if (path !== ":memory:") sql.exec("PRAGMA journal_mode = WAL");
			initializeSchema(sql);
			return new StoreDatabase(sql);
		} catch (error) {
			sql.close();
			throw error;
		}
	}
	close() {
		this.sql.close();
	}
	currentAttempt(runId, attempt) {
		const row = this.sql.prepare("SELECT * FROM attempts WHERE run_id = ? AND attempt_no = ?").get(runId, attempt);
		if (row === void 0) throw new AutomationError("INVALID_TRANSITION", `attempt ${runId}/${attempt} does not exist`);
		return row;
	}
	requireRun(id) {
		const row = this.sql.prepare("SELECT * FROM runs WHERE id = ?").get(id);
		if (row === void 0) throw new AutomationError("RUN_NOT_FOUND", `run ${id} does not exist`);
		return decodeRun(row);
	}
	event(runId, at, type, data) {
		this.sql.prepare("INSERT INTO run_events (run_id, at, type, data_json) VALUES (?, ?, ?, ?)").run(runId, at, type, JSON.stringify(data));
	}
	transaction(operation) {
		this.sql.exec("BEGIN IMMEDIATE");
		try {
			const result = operation();
			this.sql.exec("COMMIT");
			return result;
		} catch (error) {
			try {
				this.sql.exec("ROLLBACK");
			} catch {}
			throw error;
		}
	}
};
function decodeRun(row) {
	const concurrency = decodeConcurrency(row["concurrency_key"], row["concurrency_limit"]);
	return {
		id: row["id"],
		state: String(row["state"]),
		prompt: String(row["prompt"]),
		target: decodeTarget(JSON.parse(String(row["target_json"]))),
		trigger: decodeTrigger(JSON.parse(String(row["trigger_json"]))),
		priority: Number(row["priority"]),
		maxAttempts: Number(row["max_attempts"]),
		attemptCount: Number(row["attempt_count"]),
		...row["current_attempt"] === null ? {} : { currentAttempt: Number(row["current_attempt"]) },
		createdAt: Number(row["created_at"]),
		updatedAt: Number(row["updated_at"]),
		availableAt: Number(row["available_at"]),
		...row["cancel_requested_at"] === null ? {} : { cancelRequestedAt: Number(row["cancel_requested_at"]) },
		...row["final_session_id"] === null ? {} : { finalSessionId: String(row["final_session_id"]) },
		...row["outcome"] === null ? {} : { outcome: String(row["outcome"]) },
		...row["result_excerpt"] === null ? {} : { resultExcerpt: String(row["result_excerpt"]) },
		...row["error"] === null ? {} : { error: String(row["error"]) },
		...row["retry_of"] === null ? {} : { retryOf: row["retry_of"] },
		...concurrency === void 0 ? {} : { concurrency }
	};
}
async function preparePrivateDatabase(path) {
	const parent = dirname(path);
	await mkdir(parent, {
		recursive: true,
		mode: 448
	});
	const parentInfo = await lstat(parent);
	if (!parentInfo.isDirectory() || parentInfo.isSymbolicLink()) throw new Error(`automation database parent is not a real directory: ${parent}`);
	assertOwned(parentInfo.uid, parent);
	await chmod(parent, 448);
	try {
		const file = await lstat(path);
		if (!file.isFile() || file.isSymbolicLink()) throw new Error(`automation database is not a regular file: ${path}`);
		assertOwned(file.uid, path);
		await chmod(path, 384);
	} catch (error) {
		if (!isNotFound(error)) throw error;
		await (await open(path, "wx", 384)).close();
	}
}
function assertOwned(owner, path) {
	const uid = process.getuid?.();
	if (uid !== void 0 && owner !== uid) throw new Error(`automation storage path is not owned by the current user: ${path}`);
}
function busyTimeout(value) {
	const timeout = value ?? 5e3;
	if (!Number.isSafeInteger(timeout) || timeout < 0 || timeout > 2147483647) throw new AutomationError("INVALID_REQUEST", "busyTimeoutMs must be an integer between 0 and 2147483647");
	return timeout;
}
function isNotFound(error) {
	return error instanceof Error && "code" in error && error.code === "ENOENT";
}
//#endregion
//#region lib/types/store/attempts.js
/** Lease-fenced live Attempt lifecycle and database-level claim admission. */
function claimNext(database, workerId, now, leaseDurationMs) {
	validateWorkerLease$1(workerId, now, leaseDurationMs);
	return database.transaction(() => {
		const row = database.sql.prepare(`
      SELECT r.* FROM runs r
      WHERE (SELECT mode FROM automation_control WHERE singleton = 1) = 'running'
        AND r.state = 'queued' AND r.available_at <= ? AND r.cancel_requested_at IS NULL AND r.attempt_count < r.max_attempts
        AND (
          r.concurrency_key IS NULL OR (
            SELECT count(*) FROM runs active
            WHERE active.concurrency_key = r.concurrency_key
              AND active.state IN ('claimed', 'running', 'cancelling')
          ) < r.concurrency_limit
        )
      ORDER BY r.priority DESC, r.available_at ASC, r.created_at ASC, r.id ASC
      LIMIT 1
    `).get(now);
		if (row === void 0) return void 0;
		const run = decodeRun(row);
		const attempt = run.attemptCount + 1;
		const token = randomUUID();
		const leaseExpiresAt = now + leaseDurationMs;
		const sessionId = `dsh-automation-${run.id}-a${attempt}`;
		if (database.sql.prepare(`
      UPDATE runs SET state = 'claimed', attempt_count = ?, current_attempt = ?, updated_at = ?
      WHERE id = ? AND state = 'queued'
    `).run(attempt, attempt, now, run.id).changes !== 1) throw new AutomationError("INVALID_TRANSITION", `run ${run.id} was claimed concurrently`);
		database.sql.prepare(`
      INSERT INTO attempts (
        run_id, attempt_no, state, worker_id, lease_token, lease_expires_at, session_id, claimed_at
      ) VALUES (?, ?, 'claimed', ?, ?, ?, ?, ?)
    `).run(run.id, attempt, workerId, token, leaseExpiresAt, sessionId, now);
		database.event(run.id, now, "claimed", {
			attempt,
			workerId,
			leaseExpiresAt,
			sessionId
		});
		return {
			run: database.requireRun(run.id),
			attempt,
			workerId,
			leaseToken: token,
			leaseExpiresAt,
			sessionId
		};
	});
}
function heartbeat(database, claim, now, leaseDurationMs) {
	validateWorkerLease$1(claim.workerId, now, leaseDurationMs);
	const expires = now + leaseDurationMs;
	if (database.sql.prepare(`
    UPDATE attempts SET lease_expires_at = ?
    WHERE run_id = ? AND attempt_no = ? AND lease_token = ?
      AND state IN ('claimed', 'running', 'cancelling') AND lease_expires_at > ?
  `).run(expires, claim.run.id, claim.attempt, claim.leaseToken, now).changes !== 1) leaseLost(claim);
	return {
		...claim,
		run: database.requireRun(claim.run.id),
		leaseExpiresAt: expires
	};
}
function markRunning(database, claim, now) {
	return database.transaction(() => {
		if (database.sql.prepare(`
      UPDATE attempts SET state = CASE WHEN state = 'cancelling' THEN 'cancelling' ELSE 'running' END, dispatched_at = ?
      WHERE run_id = ? AND attempt_no = ? AND lease_token = ?
        AND state IN ('claimed', 'cancelling') AND lease_expires_at > ?
    `).run(now, claim.run.id, claim.attempt, claim.leaseToken, now).changes !== 1) leaseLost(claim);
		if (database.sql.prepare(`
      UPDATE runs SET state = CASE WHEN state = 'cancelling' THEN 'cancelling' ELSE 'running' END, updated_at = ?
      WHERE id = ? AND state IN ('claimed', 'cancelling') AND current_attempt = ?
    `).run(now, claim.run.id, claim.attempt).changes !== 1) leaseLost(claim);
		database.event(claim.run.id, now, "running", {
			attempt: claim.attempt,
			sessionId: claim.sessionId
		});
		return database.requireRun(claim.run.id);
	});
}
function settle(database, claim, settlement, now) {
	resolveSettlement(settlement);
	return database.transaction(() => {
		const current = database.currentAttempt(claim.run.id, claim.attempt);
		if (current["lease_token"] !== claim.leaseToken || Number(current["lease_expires_at"]) <= now) leaseLost(claim);
		if (database.sql.prepare(`
      UPDATE attempts SET state = ?, finished_at = ?, outcome = ?, result_excerpt = ?, error = ?
      WHERE run_id = ? AND attempt_no = ? AND lease_token = ?
        AND state IN ('claimed', 'running', 'cancelling') AND lease_expires_at > ?
    `).run(settlement.state, now, settlement.outcome, settlement.resultExcerpt ?? null, settlement.error ?? null, claim.run.id, claim.attempt, claim.leaseToken, now).changes !== 1) leaseLost(claim);
		if (database.sql.prepare(`
      UPDATE runs SET state = ?, updated_at = ?, final_session_id = ?, outcome = ?, result_excerpt = ?, error = ?
      WHERE id = ? AND current_attempt = ? AND state IN ('claimed', 'running', 'cancelling')
    `).run(settlement.state, now, claim.sessionId, settlement.outcome, settlement.resultExcerpt ?? null, settlement.error ?? null, claim.run.id, claim.attempt).changes !== 1) leaseLost(claim);
		database.event(claim.run.id, now, "settled", {
			attempt: claim.attempt,
			...settlement
		});
		return database.requireRun(claim.run.id);
	});
}
function validateWorkerLease$1(workerId, now, duration) {
	if (workerId.trim() === "") throw new AutomationError("INVALID_REQUEST", "workerId must not be empty");
	if (!Number.isSafeInteger(now) || now < 0) throw new AutomationError("INVALID_REQUEST", "now must be a non-negative safe integer");
	if (!Number.isSafeInteger(duration) || duration < 1 || now + duration > Number.MAX_SAFE_INTEGER) throw new AutomationError("INVALID_REQUEST", "lease duration must be a positive safe integer");
}
function leaseLost(claim) {
	throw new AutomationError("LEASE_LOST", `worker ${claim.workerId} no longer owns ${claim.run.id} attempt ${claim.attempt}`);
}
//#endregion
//#region lib/types/store/control.js
/** Durable queue admission control shared by every Worker process. */
function readQueueControl(database) {
	const row = database.sql.prepare("SELECT * FROM automation_control WHERE singleton = 1").get();
	if (row === void 0) throw new AutomationError("STORE_INCOMPATIBLE", "automation control row is missing");
	return decodeControl(row);
}
function pauseQueue(database, now, reason) {
	validNow(now);
	if (reason !== void 0 && (reason.trim() === "" || reason.length > 500)) throw new AutomationError("INVALID_REQUEST", "pause reason must be between 1 and 500 characters");
	database.sql.prepare(`
    UPDATE automation_control SET mode = 'paused', paused_at = COALESCE(paused_at, ?), pause_reason = ?, updated_at = ? WHERE singleton = 1
  `).run(now, reason ?? null, now);
	return readQueueControl(database);
}
function drainQueue(database, now, reason) {
	validNow(now);
	if (reason !== void 0 && (reason.trim() === "" || reason.length > 500)) throw new AutomationError("INVALID_REQUEST", "drain reason must be between 1 and 500 characters");
	database.sql.prepare(`
    UPDATE automation_control SET mode = 'draining', paused_at = COALESCE(paused_at, ?), pause_reason = ?, updated_at = ? WHERE singleton = 1
  `).run(now, reason ?? null, now);
	return readQueueControl(database);
}
function resumeQueue(database, now) {
	validNow(now);
	database.sql.prepare(`
    UPDATE automation_control SET mode = 'running', paused_at = NULL, pause_reason = NULL, updated_at = ? WHERE singleton = 1
  `).run(now);
	return readQueueControl(database);
}
function decodeControl(row) {
	const pausedAt = row["paused_at"] === null ? void 0 : Number(row["paused_at"]);
	const reason = row["pause_reason"] === null ? void 0 : String(row["pause_reason"]);
	return {
		mode: String(row["mode"]),
		paused: pausedAt !== void 0,
		updatedAt: Number(row["updated_at"]),
		...pausedAt === void 0 ? {} : { pausedAt },
		...reason === void 0 ? {} : { reason }
	};
}
function validNow(now) {
	if (!Number.isSafeInteger(now) || now < 0) throw new AutomationError("INVALID_REQUEST", "now must be a non-negative safe integer");
}
//#endregion
//#region lib/types/store/recovery.js
/** Lease-expiry transitions and recovery ownership fencing. */
function recoverUndispatchedExpired(database, now) {
	return database.transaction(() => {
		const rows = database.sql.prepare(`
      SELECT a.run_id, a.attempt_no, r.max_attempts
      FROM attempts a JOIN runs r ON r.id = a.run_id AND r.current_attempt = a.attempt_no
      WHERE r.state IN ('claimed', 'cancelling') AND a.state IN ('claimed', 'cancelling')
        AND a.dispatched_at IS NULL AND a.lease_expires_at <= ?
    `).all(now);
		const recovered = [];
		for (const row of rows) {
			const runId = row["run_id"];
			const attempt = Number(row["attempt_no"]);
			const exhausted = attempt >= Number(row["max_attempts"]);
			database.sql.prepare(`
        UPDATE attempts SET state = 'lost', finished_at = ?, outcome = 'not-dispatched', error = 'worker lease expired before durable dispatch'
        WHERE run_id = ? AND attempt_no = ? AND dispatched_at IS NULL AND lease_expires_at <= ?
      `).run(now, runId, attempt, now);
			database.sql.prepare(`
        UPDATE runs SET state = ?, updated_at = ?, current_attempt = NULL, outcome = ?, error = ?
        WHERE id = ? AND current_attempt = ? AND state IN ('claimed', 'cancelling')
      `).run(exhausted ? "failed" : "queued", now, exhausted ? "not-dispatched" : null, exhausted ? "all Attempts were lost before durable dispatch" : null, runId, attempt);
			database.event(runId, now, exhausted ? "failed" : "requeued", {
				attempt,
				reason: "lease-expired-before-dispatch"
			});
			recovered.push(runId);
		}
		return recovered;
	});
}
function expiredDispatched(database, now) {
	return database.sql.prepare(`
    SELECT a.run_id, a.attempt_no, a.session_id
    FROM attempts a JOIN runs r ON r.id = a.run_id AND r.current_attempt = a.attempt_no
    WHERE r.state IN ('running', 'cancelling') AND a.dispatched_at IS NOT NULL AND a.lease_expires_at <= ?
    ORDER BY a.lease_expires_at ASC, a.run_id ASC
  `).all(now).map((row) => ({
		runId: row["run_id"],
		attempt: Number(row["attempt_no"]),
		sessionId: String(row["session_id"])
	}));
}
function reclaimDispatched(database, ref, workerId, now, leaseDurationMs) {
	validateWorkerLease(workerId, now, leaseDurationMs);
	return database.transaction(() => {
		const token = randomUUID();
		const leaseExpiresAt = now + leaseDurationMs;
		if (database.sql.prepare(`
      UPDATE attempts SET worker_id = ?, lease_token = ?, lease_expires_at = ?
      WHERE run_id = ? AND attempt_no = ? AND session_id = ?
        AND state IN ('running', 'cancelling') AND dispatched_at IS NOT NULL
        AND lease_expires_at <= ?
    `).run(workerId, token, leaseExpiresAt, ref.runId, ref.attempt, ref.sessionId, now).changes !== 1) return void 0;
		const run = database.requireRun(ref.runId);
		if (run.currentAttempt !== ref.attempt || run.state !== "running" && run.state !== "cancelling") throw new AutomationError("INVALID_TRANSITION", `run ${ref.runId} no longer owns attempt ${ref.attempt}`);
		database.event(ref.runId, now, "recovered-claim", {
			attempt: ref.attempt,
			workerId,
			leaseExpiresAt
		});
		return {
			run,
			attempt: ref.attempt,
			workerId,
			leaseToken: token,
			leaseExpiresAt,
			sessionId: ref.sessionId
		};
	});
}
function settleExpired(database, ref, settlement, now) {
	resolveSettlement(settlement);
	return database.transaction(() => {
		if (database.sql.prepare(`
      UPDATE attempts SET state = ?, finished_at = ?, outcome = ?, result_excerpt = ?, error = ?
      WHERE run_id = ? AND attempt_no = ? AND state IN ('running', 'cancelling') AND lease_expires_at <= ?
    `).run(settlement.state, now, settlement.outcome, settlement.resultExcerpt ?? null, settlement.error ?? null, ref.runId, ref.attempt, now).changes !== 1) throw new AutomationError("INVALID_TRANSITION", `attempt ${ref.runId}/${ref.attempt} is not expired and dispatched`);
		database.sql.prepare(`
      UPDATE runs SET state = ?, updated_at = ?, final_session_id = ?, outcome = ?, result_excerpt = ?, error = ?
      WHERE id = ? AND current_attempt = ? AND state IN ('running', 'cancelling')
    `).run(settlement.state, now, ref.sessionId, settlement.outcome, settlement.resultExcerpt ?? null, settlement.error ?? null, ref.runId, ref.attempt);
		database.event(ref.runId, now, "recovered-settlement", {
			attempt: ref.attempt,
			...settlement
		});
		return database.requireRun(ref.runId);
	});
}
function validateWorkerLease(workerId, now, duration) {
	if (workerId.trim() === "") throw new AutomationError("INVALID_REQUEST", "workerId must not be empty");
	if (!Number.isSafeInteger(now) || now < 0) throw new AutomationError("INVALID_REQUEST", "now must be a non-negative safe integer");
	if (!Number.isSafeInteger(duration) || duration < 1 || now + duration > Number.MAX_SAFE_INTEGER) throw new AutomationError("INVALID_REQUEST", "lease duration must be a positive safe integer");
}
//#endregion
//#region lib/types/store/query.js
/** Cursor-paginated Run reads and durable global event feed. */
const RUN_STATES = /* @__PURE__ */ new Set([
	"queued",
	"claimed",
	"running",
	"cancelling",
	"succeeded",
	"failed",
	"cancelled",
	"indeterminate"
]);
function queryRuns(database, query = {}) {
	const limit = pageLimit(query.limit);
	const clauses = [];
	const values = [];
	if (query.states !== void 0) {
		if (query.states.length === 0 || query.states.some((state) => !RUN_STATES.has(state))) invalid("states must contain known Run states");
		clauses.push(`state IN (${query.states.map(() => "?").join(", ")})`);
		values.push(...query.states);
	}
	addTriggerFilter(clauses, values, query.triggerKind, query.triggerSourceId);
	if (query.before !== void 0) {
		if (!Number.isSafeInteger(query.before.createdAt) || query.before.createdAt < 0 || query.before.id === "") invalid("invalid Run cursor");
		clauses.push("(created_at < ? OR (created_at = ? AND id < ?))");
		values.push(query.before.createdAt, query.before.createdAt, query.before.id);
	}
	const where = clauses.length === 0 ? "" : `WHERE ${clauses.join(" AND ")}`;
	const rows = database.sql.prepare(`
    SELECT * FROM runs ${where} ORDER BY created_at DESC, id DESC LIMIT ?
  `).all(...values, limit + 1);
	const hasMore = rows.length > limit;
	const runs = rows.slice(0, limit).map(decodeRun);
	const last = runs.at(-1);
	return {
		runs,
		hasMore,
		...hasMore && last !== void 0 ? { nextCursor: {
			createdAt: last.createdAt,
			id: last.id
		} } : {}
	};
}
function queryEvents(database, query = {}) {
	const limit = pageLimit(query.limit);
	const afterSeq = query.afterSeq ?? 0;
	if (!Number.isSafeInteger(afterSeq) || afterSeq < 0) invalid("afterSeq must be a non-negative safe integer");
	const oldestAvailableSeq = Number(database.sql.prepare("SELECT coalesce(min(seq), 0) AS seq FROM run_events").get()["seq"]);
	const prunedThroughSeq = Number(database.sql.prepare("SELECT pruned_through_seq FROM event_retention WHERE singleton = 1").get()["pruned_through_seq"]);
	if (afterSeq < prunedThroughSeq) throw new AutomationError("EVENT_CURSOR_EXPIRED", `event cursor ${afterSeq} is at or before pruned sequence ${prunedThroughSeq}`);
	if (query.runId !== void 0) {
		if (query.runId === "") invalid("runId must not be empty");
	}
	addTriggerFilter([], [], query.triggerKind, query.triggerSourceId);
	const rows = database.sql.prepare(`
    SELECT e.*, r.trigger_kind AS event_trigger_kind, r.trigger_source_id AS event_trigger_source_id
    FROM run_events e JOIN runs r ON r.id = e.run_id
    WHERE e.seq > ? ORDER BY e.seq ASC LIMIT ?
  `).all(afterSeq, limit + 1);
	const hasMore = rows.length > limit;
	const scanned = rows.slice(0, limit);
	return {
		events: scanned.filter((row) => query.runId === void 0 || row["run_id"] === query.runId).filter((row) => query.triggerKind === void 0 || row["event_trigger_kind"] === query.triggerKind).filter((row) => query.triggerSourceId === void 0 || row["event_trigger_source_id"] === query.triggerSourceId).map(decodeEvent),
		oldestAvailableSeq,
		prunedThroughSeq,
		nextSeq: scanned.at(-1) === void 0 ? afterSeq : Number(scanned.at(-1)["seq"]),
		hasMore
	};
}
function addTriggerFilter(clauses, values, kind, sourceId, prefix = "") {
	if (kind !== void 0) {
		if (!/^[a-z][a-z0-9-]{0,63}$/.test(kind)) invalid("invalid trigger kind filter");
		clauses.push(`${prefix}trigger_kind = ?`);
		values.push(kind);
	}
	if (sourceId !== void 0) {
		if (sourceId.trim() === "" || sourceId.length > 256) invalid("invalid trigger source filter");
		clauses.push(`${prefix}trigger_source_id = ?`);
		values.push(sourceId);
	}
}
function decodeEvent(row) {
	return {
		seq: Number(row["seq"]),
		runId: row["run_id"],
		at: Number(row["at"]),
		type: String(row["type"]),
		data: JSON.parse(String(row["data_json"]))
	};
}
function pageLimit(value) {
	const limit = value ?? 50;
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 200) invalid("limit must be an integer between 1 and 200");
	return limit;
}
function invalid(message) {
	throw new AutomationError("INVALID_REQUEST", message);
}
//#endregion
//#region lib/types/store/retention.js
/** Durable event-consumer checkpoints and bounded terminal Run retention. */
function checkpointConsumer(database, id, seq, now) {
	validConsumer(id);
	validInteger(seq, "event sequence");
	validInteger(now, "now");
	return database.transaction(() => {
		const newest = Number(database.sql.prepare(`
      SELECT max(seq) AS seq FROM (
        SELECT coalesce(max(seq), 0) AS seq FROM run_events
        UNION ALL SELECT pruned_through_seq AS seq FROM event_retention WHERE singleton = 1
      )
    `).get()["seq"]);
		if (seq > newest) throw new AutomationError("INVALID_REQUEST", `event sequence ${seq} is beyond newest sequence ${newest}`);
		const current = database.sql.prepare("SELECT last_seq FROM event_consumers WHERE consumer_id = ?").get(id);
		if (current !== void 0 && seq < Number(current["last_seq"])) throw new AutomationError("INVALID_TRANSITION", `event consumer ${id} cannot move backwards`);
		database.sql.prepare(`
      INSERT INTO event_consumers (consumer_id, last_seq, updated_at) VALUES (?, ?, ?)
      ON CONFLICT(consumer_id) DO UPDATE SET last_seq = excluded.last_seq, updated_at = excluded.updated_at
    `).run(id, seq, now);
		return {
			id,
			lastSeq: seq,
			updatedAt: now
		};
	});
}
function listConsumers(database) {
	return database.sql.prepare("SELECT * FROM event_consumers ORDER BY consumer_id").all().map((row) => ({
		id: String(row["consumer_id"]),
		lastSeq: Number(row["last_seq"]),
		updatedAt: Number(row["updated_at"])
	}));
}
function removeConsumer(database, id) {
	validConsumer(id);
	return database.sql.prepare("DELETE FROM event_consumers WHERE consumer_id = ?").run(id).changes === 1;
}
function purgeTerminal(database, before, limit) {
	validInteger(before, "purge cutoff");
	if (!Number.isSafeInteger(limit) || limit < 1 || limit > 1e3) throw new AutomationError("INVALID_REQUEST", "purge limit must be an integer between 1 and 1000");
	return database.transaction(() => {
		const consumer = database.sql.prepare("SELECT min(last_seq) AS floor FROM event_consumers").get();
		const floor = consumer["floor"] === null ? void 0 : Number(consumer["floor"]);
		const ids = database.sql.prepare(`
      SELECT r.id FROM runs r
      WHERE r.state IN ('succeeded', 'failed', 'cancelled', 'indeterminate') AND r.updated_at < ?
        AND NOT EXISTS (SELECT 1 FROM runs child WHERE child.retry_of = r.id)
        AND (? IS NULL OR coalesce((SELECT max(e.seq) FROM run_events e WHERE e.run_id = r.id), 0) <= ?)
      ORDER BY r.updated_at ASC, r.id ASC LIMIT ?
    `).all(before, floor ?? null, floor ?? null, limit).map((row) => row["id"]);
		const removeEvents = database.sql.prepare("DELETE FROM run_events WHERE run_id = ?");
		const removeAttempts = database.sql.prepare("DELETE FROM attempts WHERE run_id = ?");
		const removeRun = database.sql.prepare("DELETE FROM runs WHERE id = ?");
		for (const id of ids) {
			const event = database.sql.prepare("SELECT coalesce(max(seq), 0) AS seq FROM run_events WHERE run_id = ?").get(id);
			database.sql.prepare(`
        UPDATE event_retention SET pruned_through_seq = max(pruned_through_seq, ?) WHERE singleton = 1
      `).run(Number(event["seq"]));
			removeEvents.run(id);
			removeAttempts.run(id);
			removeRun.run(id);
		}
		return {
			purgedRunIds: ids,
			...floor === void 0 ? {} : { protectedByEventSeq: floor }
		};
	});
}
function validConsumer(id) {
	if (!/^[a-z][a-z0-9._:-]{0,127}$/.test(id)) throw new AutomationError("INVALID_REQUEST", "invalid event consumer id");
}
function validInteger(value, name) {
	if (!Number.isSafeInteger(value) || value < 0) throw new AutomationError("INVALID_REQUEST", `${name} must be a non-negative safe integer`);
}
//#endregion
//#region lib/types/store/runs.js
/** Run submission, management reads, health, cancellation, and audit queries. */
function submitRun(database, request, now) {
	const resolved = resolveSubmitRequest(request, now);
	return database.transaction(() => {
		const key = resolved.trigger.idempotencyKey;
		if (key !== void 0) {
			const existing = database.sql.prepare(`
        SELECT * FROM runs WHERE trigger_kind = ? AND trigger_source_id = ? AND idempotency_key = ?
      `).get(resolved.trigger.kind, resolved.trigger.sourceId, key);
			if (existing !== void 0) return {
				run: decodeRun(existing),
				created: false
			};
		}
		const id = `run-${randomUUID()}`;
		database.sql.prepare(`
      INSERT INTO runs (
        id, state, prompt, target_json, trigger_json, trigger_kind, trigger_source_id,
        trigger_occurrence_id, idempotency_key, concurrency_key, concurrency_limit,
        priority, max_attempts, attempt_count, created_at, updated_at, available_at, retry_of
      ) VALUES (?, 'queued', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
    `).run(id, resolved.prompt, JSON.stringify(resolved.target), JSON.stringify(resolved.trigger), resolved.trigger.kind, resolved.trigger.sourceId, resolved.trigger.occurrenceId ?? null, key ?? null, resolved.concurrency?.key ?? null, resolved.concurrency?.limit ?? null, resolved.priority, resolved.maxAttempts, now, now, resolved.availableAt, resolved.retryOf ?? null);
		database.event(id, now, "submitted", { trigger: resolved.trigger });
		return {
			run: database.requireRun(id),
			created: true
		};
	});
}
function listRuns(database, state) {
	return (state === void 0 ? database.sql.prepare("SELECT * FROM runs ORDER BY created_at DESC, id DESC").all() : database.sql.prepare("SELECT * FROM runs WHERE state = ? ORDER BY created_at DESC, id DESC").all(state)).map((row) => decodeRun(row));
}
function automationStatus(database, now) {
	if (!Number.isSafeInteger(now) || now < 0) throw new AutomationError("INVALID_REQUEST", "now must be a non-negative safe integer");
	const runs = Object.fromEntries([
		"queued",
		"claimed",
		"running",
		"cancelling",
		"succeeded",
		"failed",
		"cancelled",
		"indeterminate"
	].map((state) => [state, 0]));
	for (const row of database.sql.prepare("SELECT state, count(*) AS count FROM runs GROUP BY state").all()) runs[String(row["state"])] = Number(row["count"]);
	const queued = database.sql.prepare(`
    SELECT count(*) AS count, min(created_at) AS oldest_created_at FROM runs WHERE state = 'queued'
  `).get();
	const expired = database.sql.prepare(`
    SELECT
      sum(CASE WHEN dispatched_at IS NULL THEN 1 ELSE 0 END) AS undispatched,
      sum(CASE WHEN dispatched_at IS NOT NULL THEN 1 ELSE 0 END) AS dispatched
    FROM attempts WHERE state IN ('claimed', 'running', 'cancelling') AND lease_expires_at <= ?
  `).get(now);
	const workers = database.sql.prepare(`
    SELECT worker_id, count(*) AS active_attempts, min(lease_expires_at) AS oldest_lease_expires_at
    FROM attempts WHERE state IN ('claimed', 'running', 'cancelling') GROUP BY worker_id ORDER BY worker_id
  `).all().map((row) => ({
		workerId: String(row["worker_id"]),
		activeAttempts: Number(row["active_attempts"]),
		oldestLeaseExpiresAt: Number(row["oldest_lease_expires_at"])
	}));
	const eventFeed = database.sql.prepare(`
    SELECT
      max((SELECT coalesce(max(seq), 0) FROM run_events), r.pruned_through_seq) AS newest_seq,
      r.pruned_through_seq,
      (SELECT count(*) FROM event_consumers) AS consumers
    FROM event_retention r WHERE r.singleton = 1
  `).get();
	const expiredCounts = {
		undispatched: Number(expired["undispatched"] ?? 0),
		dispatched: Number(expired["dispatched"] ?? 0)
	};
	const oldestCreatedAt = queued["oldest_created_at"] === null ? void 0 : Number(queued["oldest_created_at"]);
	return {
		health: expiredCounts.undispatched + expiredCounts.dispatched === 0 ? "ok" : "degraded",
		schemaVersion: 2,
		checkedAt: now,
		runs,
		queued: {
			count: Number(queued["count"]),
			...oldestCreatedAt === void 0 ? {} : { oldestCreatedAt }
		},
		active: runs.claimed + runs.running + runs.cancelling,
		expired: expiredCounts,
		workers,
		eventFeed: {
			newestSeq: Number(eventFeed["newest_seq"]),
			prunedThroughSeq: Number(eventFeed["pruned_through_seq"]),
			consumers: Number(eventFeed["consumers"])
		},
		control: readQueueControl(database)
	};
}
function requestRunCancel(database, id, now) {
	return database.transaction(() => {
		const run = database.requireRun(id);
		if (terminal(run.state)) return run;
		if (run.state === "queued") {
			database.sql.prepare(`
        UPDATE runs SET state = 'cancelled', cancel_requested_at = ?, updated_at = ?, outcome = 'cancelled'
        WHERE id = ? AND state = 'queued'
      `).run(now, now, id);
			database.event(id, now, "cancelled", { beforeDispatch: true });
		} else {
			database.sql.prepare(`
        UPDATE runs SET state = 'cancelling', cancel_requested_at = ?, updated_at = ?
        WHERE id = ? AND state IN ('claimed', 'running')
      `).run(now, now, id);
			database.sql.prepare(`
        UPDATE attempts SET state = 'cancelling'
        WHERE run_id = ? AND attempt_no = ? AND state IN ('claimed', 'running')
      `).run(id, run.currentAttempt);
			database.event(id, now, "cancel-requested", { attempt: run.currentAttempt });
		}
		return database.requireRun(id);
	});
}
function retryRun(database, id, options, now) {
	const original = database.requireRun(id);
	if (![
		"failed",
		"cancelled",
		"indeterminate"
	].includes(original.state)) throw new AutomationError("INVALID_TRANSITION", `run ${id} in state ${original.state} cannot be retried`);
	if (original.state === "indeterminate" && options.confirmIndeterminate !== true) throw new AutomationError("INVALID_REQUEST", `run ${id} is indeterminate; retry requires explicit side-effect acknowledgement`);
	return submitRun(database, {
		prompt: original.prompt,
		target: original.target,
		trigger: {
			kind: "retry",
			sourceId: original.id,
			occurrenceId: options.idempotencyKey,
			idempotencyKey: options.idempotencyKey
		},
		priority: options.priority ?? original.priority,
		maxAttempts: options.maxAttempts ?? original.maxAttempts,
		retryOf: original.id,
		...original.concurrency === void 0 ? {} : { concurrency: original.concurrency }
	}, now);
}
function runEvents(database, id) {
	database.requireRun(id);
	return database.sql.prepare("SELECT * FROM run_events WHERE run_id = ? ORDER BY seq ASC").all(id).map((row) => ({
		seq: Number(row["seq"]),
		runId: row["run_id"],
		at: Number(row["at"]),
		type: String(row["type"]),
		data: JSON.parse(String(row["data_json"]))
	}));
}
function terminal(state) {
	return state === "succeeded" || state === "failed" || state === "cancelled" || state === "indeterminate";
}
//#endregion
//#region lib/types/store.js
/** SQLite WAL persistence and transactional Run state transitions. */
/** Durable store shared by management processes and one or more local Workers. */
var AutomationStore = class AutomationStore {
	database;
	constructor(database) {
		this.database = database;
	}
	/** Validate the path, open SQLite, and transactionally reach the current schema. */
	static async open(options) {
		return new AutomationStore(await StoreDatabase.open(options));
	}
	/** Close this process's SQLite connection. */
	close() {
		this.database.close();
	}
	/** Submit one immutable Run, returning the existing Run for a duplicate idempotency key. */
	submit(request, now = Date.now()) {
		return submitRun(this.database, request, now);
	}
	/** Return one Run by id. */
	get(id) {
		return this.requireRun(id);
	}
	/** List Runs newest-first, optionally restricted to one state. */
	list(state) {
		return listRuns(this.database, state);
	}
	/** Query Runs through a bounded stable cursor. */
	query(query = {}) {
		return queryRuns(this.database, query);
	}
	/** Read the durable global Run event stream after one sequence cursor. */
	changes(query = {}) {
		return queryEvents(this.database, query);
	}
	/** Monotonically checkpoint one durable event-feed consumer. */
	checkpointConsumer(id, seq, now = Date.now()) {
		return checkpointConsumer(this.database, id, seq, now);
	}
	/** List durable event-feed consumers that protect retention. */
	consumers() {
		return listConsumers(this.database);
	}
	/** Explicitly unregister one event consumer. */
	removeConsumer(id) {
		return removeConsumer(this.database, id);
	}
	/** Purge a bounded set of terminal bookkeeping protected by consumer cursors. */
	purge(before, limit) {
		return purgeTerminal(this.database, before, limit);
	}
	/** Return a bounded health projection without reading prompts or Session data. */
	status(now = Date.now()) {
		return automationStatus(this.database, now);
	}
	/** Read durable queue admission state. */
	control() {
		return readQueueControl(this.database);
	}
	/** Stop every Worker from claiming new Runs without interrupting active Attempts. */
	pause(reason, now = Date.now()) {
		return pauseQueue(this.database, now, reason);
	}
	/** Stop admission and persist that operators are waiting for active Attempts to finish. */
	drain(reason, now = Date.now()) {
		return drainQueue(this.database, now, reason);
	}
	/** Allow Workers to claim queued Runs again. */
	resume(now = Date.now()) {
		return resumeQueue(this.database, now);
	}
	/** Atomically claim the next eligible Run and mint its fenced Attempt. */
	claimNext(workerId, now, leaseDurationMs) {
		return claimNext(this.database, workerId, now, leaseDurationMs);
	}
	/** Extend a currently owned claim or running Attempt. */
	heartbeat(claim, now, leaseDurationMs) {
		return heartbeat(this.database, claim, now, leaseDurationMs);
	}
	/** Commit the checkpoint that canonical DSH dispatch has become durable. */
	markRunning(claim, now) {
		return markRunning(this.database, claim, now);
	}
	/** Settle a Run from a Worker that still owns the exact Attempt lease. */
	settle(claim, settlement, now) {
		return settle(this.database, claim, settlement, now);
	}
	/** Request cancellation, atomically terminating a queued Run. */
	requestCancel(id, now) {
		return requestRunCancel(this.database, id, now);
	}
	/** Create an explicit replacement Run linked to one terminal original. */
	retry(id, options, now = Date.now()) {
		return retryRun(this.database, id, options, now);
	}
	/** Requeue expired claims that provably never crossed the durable dispatch checkpoint. */
	recoverUndispatchedExpired(now) {
		return recoverUndispatchedExpired(this.database, now);
	}
	/** List expired dispatched Attempts that require canonical Session inspection. */
	expiredDispatched(now) {
		return expiredDispatched(this.database, now);
	}
	/** Fence and take ownership of an expired dispatched Attempt for safe pre-turn resume. */
	reclaimDispatched(ref, workerId, now, leaseDurationMs) {
		return reclaimDispatched(this.database, ref, workerId, now, leaseDurationMs);
	}
	/** Settle an expired dispatched Attempt from canonical Session recovery evidence. */
	settleExpired(ref, settlement, now) {
		return settleExpired(this.database, ref, settlement, now);
	}
	/** Settle an expired dispatched Attempt whose canonical outcome is unknowable. */
	settleExpiredIndeterminate(ref, diagnostic, now) {
		return this.settleExpired(ref, {
			state: "indeterminate",
			outcome: "interrupted",
			error: diagnostic
		}, now);
	}
	/** Read the append-only audit stream for one Run. */
	events(id) {
		return runEvents(this.database, id);
	}
	requireRun(id) {
		return this.database.requireRun(id);
	}
};
//#endregion
export { SCHEMA_VERSION as n, AutomationStore as t };

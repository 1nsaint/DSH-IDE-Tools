/**
 * Durable JSON job store for dsh-cron. One atomic-write file holds every job;
 * the file is the source of truth and in-memory state is its projection.
 * @module dsh-cron/store
 */
import { mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { acquireDirLock } from "./filelock.js";
import { DEFAULT_STANDING_INSTRUCTIONS } from "./standing.js";
import { mergeJobs } from "./store-merge.js";
const STORE_VERSION = 2;
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function isValidJob(value) {
    if (!isRecord(value))
        return false;
    if (typeof value.id !== 'string' || typeof value.prompt !== 'string')
        return false;
    if (typeof value.nextAt !== 'string' || typeof value.createdAt !== 'string')
        return false;
    if (value.createdBy !== null && typeof value.createdBy !== 'string')
        return false;
    if (value.lastFiredAt !== null && typeof value.lastFiredAt !== 'string')
        return false;
    if (typeof value.fireCount !== 'number')
        return false;
    // Fields introduced after the first store version normalize on load.
    if (value.state !== undefined && value.state !== 'active' && value.state !== 'done')
        return false;
    if (value.paused !== undefined && typeof value.paused !== 'boolean')
        return false;
    if (value.lastRun !== undefined && value.lastRun !== null && !isRecord(value.lastRun))
        return false;
    if (value.target !== undefined && value.target !== null && !isRecord(value.target))
        return false;
    if (value.runs !== undefined && !Array.isArray(value.runs))
        return false;
    const schedule = value.schedule;
    if (!isRecord(schedule))
        return false;
    if (schedule.kind === 'at')
        return typeof schedule.at === 'string';
    if (schedule.kind === 'cron')
        return typeof schedule.expression === 'string' && typeof schedule.timeZone === 'string';
    return false;
}
/** Fill fields introduced after the first store version. */
function normalizeJob(job, fallbackTarget) {
    job.state ??= 'active';
    job.paused ??= false;
    job.runs ??= [];
    if (job.target === undefined) {
        job.target = fallbackTarget ?? null;
        if (job.target === null) {
            job.paused = true;
            job.migrationIssue = 'legacy job requires a fresh Session target before it can resume';
        }
    }
    job.concurrencyLimit ??= 1;
    if (job.lastRun !== null && job.lastRun !== undefined && job.runs.length === 0) {
        const legacy = job.lastRun;
        job.runs.push({
            occurrenceId: `legacy:${String(legacy['firedAt'] ?? job.lastFiredAt ?? job.createdAt)}`,
            scheduledAt: String(legacy['firedAt'] ?? job.lastFiredAt ?? job.createdAt),
            idempotencyKey: `legacy:${job.id}`,
            firedAt: String(legacy['firedAt'] ?? job.lastFiredAt ?? job.createdAt),
            state: 'legacy',
            ...(typeof legacy['completedAt'] === 'string' ? { completedAt: legacy['completedAt'] } : {}),
            ...(typeof legacy['outcome'] === 'string' ? { outcome: legacy['outcome'] } : {}),
            ...(typeof legacy['excerpt'] === 'string' ? { excerpt: legacy['excerpt'] } : {}),
        });
    }
    job.lastRun = job.runs.at(-1) ?? null;
    return job;
}
/**
 * JSON-file job store. Writes are atomic (temporary file plus rename). A
 * corrupt store file is quarantined aside and the store starts empty, because
 * a plugin must not take down the whole host boot.
 */
export class CronStore {
    filePath;
    warn;
    fallbackTarget;
    maxRunHistory;
    seq = 0;
    jobList = [];
    standingText = DEFAULT_STANDING_INSTRUCTIONS;
    watcher = null;
    lastWritten = null;
    lastStat = null;
    eventSeq = 0;
    loadedVersion = STORE_VERSION;
    writeLockDir;
    seqFile;
    baseJobs = new Map();
    deletedIds = new Set();
    /**
     * @param filePath - absolute path of the JSON store file.
     * @param warn - sink for recoverable store problems (quarantine, dropped entries).
     */
    constructor(filePath, warn, fallbackTarget, maxRunHistory = 100) {
        this.filePath = filePath;
        this.warn = warn;
        this.fallbackTarget = fallbackTarget;
        this.maxRunHistory = maxRunHistory;
        this.writeLockDir = `${filePath}.lock`;
        this.seqFile = `${filePath}.seq`;
    }
    /** Load the store from disk; a missing file means an empty store. */
    load() {
        let raw;
        try {
            raw = readFileSync(this.filePath, 'utf8');
        }
        catch (error) {
            if (error.code === 'ENOENT')
                return;
            throw error;
        }
        this.lastWritten = raw;
        this.applyRaw(raw, false);
        if (this.loadedVersion < STORE_VERSION)
            this.persist();
    }
    /**
     * Replace the in-memory projection with the given file content. Hot reloads
     * (external writes from another process sharing this store) degrade to a
     * warning on an unsupported format instead of failing the host boot.
     */
    applyRaw(raw, hot) {
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            const quarantine = `${this.filePath}.corrupt-${Date.now()}`;
            renameSync(this.filePath, quarantine);
            this.warn(`dsh-cron: corrupt job store moved to ${quarantine}; starting empty`);
            return;
        }
        if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== STORE_VERSION) || !Array.isArray(parsed.jobs)) {
            if (hot) {
                this.warn(`dsh-cron: unsupported job store format in ${this.filePath}; keeping current state`);
                return;
            }
            throw new Error(`dsh-cron: unsupported job store format in ${this.filePath}`);
        }
        const jobs = [];
        const ids = new Set();
        for (const entry of parsed.jobs) {
            if (!isValidJob(entry) || ids.has(entry.id)) {
                this.warn('dsh-cron: dropped invalid or duplicate job entry from the store');
                continue;
            }
            ids.add(entry.id);
            jobs.push(normalizeJob(entry, this.fallbackTarget));
        }
        this.jobList = jobs;
        this.seq = typeof parsed.seq === 'number' && Number.isSafeInteger(parsed.seq) ? parsed.seq : jobs.length;
        this.eventSeq = typeof parsed.eventCursor === 'number' && Number.isSafeInteger(parsed.eventCursor) ? parsed.eventCursor : 0;
        this.loadedVersion = Number(parsed.version);
        if (typeof parsed.standingInstructions === 'string') {
            this.standingText = parsed.standingInstructions;
        }
        else if (!hot) {
            // Fresh / pre-feature stores get the unattended default once.
            this.standingText = DEFAULT_STANDING_INSTRUCTIONS;
        }
        this.rebase();
        const sidecar = this.readSeqSidecar();
        if (sidecar !== null && sidecar > this.seq)
            this.seq = sidecar;
    }
    /** Cron-only preamble injected into every scheduled Automation run. */
    standingInstructions() {
        return this.standingText;
    }
    /** Replace the shared standing instructions and persist. */
    setStandingInstructions(text) {
        this.standingText = text;
        this.persist();
    }
    rebase() {
        this.baseJobs.clear();
        this.deletedIds.clear();
        for (const job of this.jobList)
            this.baseJobs.set(job.id, JSON.stringify(job));
    }
    /** List jobs in insertion order. */
    list() {
        return this.jobList;
    }
    /** Find one job by id. */
    get(id) {
        return this.jobList.find(job => job.id === id);
    }
    /** Allocate the next never-reused job id. */
    allocateId() {
        mkdirSync(dirname(this.filePath), { recursive: true });
        const lock = acquireStoreWriteLock(this.writeLockDir);
        try {
            const diskSeq = this.readSeqSidecar();
            if (diskSeq !== null && diskSeq > this.seq)
                this.seq = diskSeq;
            this.seq += 1;
            this.writeSeqSidecar();
        }
        finally {
            lock.release();
        }
        return `cron-${this.seq}`;
    }
    /** Insert a job and persist. */
    insert(job) {
        this.jobList.push(job);
        this.persist();
    }
    /** Remove a job by id and persist; returns false when unknown. */
    remove(id) {
        const index = this.jobList.findIndex(job => job.id === id);
        if (index === -1)
            return false;
        this.jobList.splice(index, 1);
        this.deletedIds.add(id);
        this.persist();
        return true;
    }
    /** Persist after an in-place job mutation. */
    flush() {
        this.persist();
    }
    /** Last globally applied Automation event sequence. */
    eventCursor() {
        return this.eventSeq;
    }
    /** Persist a monotonic Automation event cursor after local effects are applied. */
    advanceEventCursor(seq) {
        if (!Number.isSafeInteger(seq) || seq < this.eventSeq)
            throw new Error('dsh-cron: event cursor cannot move backwards');
        this.eventSeq = seq;
        this.persist();
    }
    /** Append one source occurrence before any external submission. */
    appendRun(job, run) {
        job.runs.push(run);
        const removable = job.runs.filter(item => terminalRun(item) && item !== run);
        while (job.runs.length > this.maxRunHistory && removable.length > 0) {
            const candidate = removable.shift();
            job.runs.splice(job.runs.indexOf(candidate), 1);
        }
        job.lastRun = run;
        this.persist();
    }
    /**
     * Watch the store file for external changes (another dsh process sharing
     * this Harness home) and hot-reload the in-memory projection. Polling is
     * used instead of `fs.watch`: libuv's fs-event on Windows aborts the
     * process when the watched directory is deleted, which the tests' teardown
     * (and a removed data dir in production) would trigger. Self-writes are
     * recognized by content equality and skipped. Returns a disposer.
     * @param onReload - called once per applied external reload.
     * @param intervalMs - poll interval; tests use a short one.
     */
    watch(onReload, intervalMs = 500) {
        if (this.watcher !== null)
            return () => { };
        const timer = setInterval(() => this.poll(onReload), intervalMs);
        // Do not keep a one-shot headless process alive just for the watcher.
        timer.unref();
        this.watcher = timer;
        return () => this.stopWatch();
    }
    /** One poll tick: reload when the file changed since our last sighting. */
    poll(onReload) {
        if (this.watcher === null)
            return;
        let stat;
        try {
            stat = statSync(this.filePath);
        }
        catch (error) {
            if (error.code === 'ENOENT') {
                this.lastStat = null;
                return;
            }
            this.warn(`dsh-cron: job store watch stat failed: ${String(error)}`);
            return;
        }
        const sighting = { mtimeMs: stat.mtimeMs, size: stat.size };
        if (this.lastStat !== null && this.lastStat.mtimeMs === sighting.mtimeMs && this.lastStat.size === sighting.size)
            return;
        this.lastStat = sighting;
        if (!this.reloadIfChanged())
            return;
        if (onReload !== undefined)
            onReload(this.jobList.length);
    }
    /** Whether the file changed since our last write; reloads when it did. */
    reloadIfChanged() {
        let raw;
        try {
            raw = readFileSync(this.filePath, 'utf8');
        }
        catch (error) {
            if (error.code !== 'ENOENT') {
                this.warn(`dsh-cron: job store watch read failed: ${String(error)}`);
            }
            return false;
        }
        if (raw === this.lastWritten)
            return false;
        this.lastWritten = raw;
        this.applyRaw(raw, true);
        return true;
    }
    stopWatch() {
        if (this.watcher !== null) {
            clearInterval(this.watcher);
            this.watcher = null;
        }
    }
    persist() {
        mkdirSync(dirname(this.filePath), { recursive: true });
        const lock = acquireStoreWriteLock(this.writeLockDir);
        try {
            const merged = this.mergeFromDisk();
            if (merged !== null)
                this.jobList = merged;
            this.writeSnapshot();
        }
        finally {
            lock.release();
        }
    }
    writeSnapshot() {
        this.seq = maxSeq(this.seq, this.jobList);
        const payload = JSON.stringify({
            version: STORE_VERSION,
            seq: this.seq,
            eventCursor: this.eventSeq,
            standingInstructions: this.standingText,
            jobs: this.jobList,
        }, null, 2);
        const content = `${payload}\n`;
        this.lastWritten = content;
        const temporary = `${this.filePath}.tmp-${process.pid}`;
        writeFileSync(temporary, content);
        renameSync(temporary, this.filePath);
        this.writeSeqSidecar();
        this.rebase();
    }
    mergeFromDisk() {
        let raw;
        try {
            raw = readFileSync(this.filePath, 'utf8');
        }
        catch (error) {
            if (error.code !== 'ENOENT')
                this.warn(`dsh-cron: store merge read failed: ${String(error)}`);
            return null;
        }
        if (raw === this.lastWritten)
            return null;
        let parsed;
        try {
            parsed = JSON.parse(raw);
        }
        catch {
            this.warn('dsh-cron: external store content is corrupt; writing local state over it');
            return null;
        }
        if (!isRecord(parsed) || (parsed.version !== 1 && parsed.version !== STORE_VERSION) || !Array.isArray(parsed.jobs)) {
            this.warn('dsh-cron: unsupported external store format; writing local state over it');
            return null;
        }
        const latest = new Map();
        for (const entry of parsed.jobs) {
            if (isValidJob(entry))
                latest.set(entry.id, normalizeJob(entry, this.fallbackTarget));
        }
        const diskSeq = typeof parsed.seq === 'number' && Number.isSafeInteger(parsed.seq) ? parsed.seq : 0;
        const diskCursor = typeof parsed.eventCursor === 'number' && Number.isSafeInteger(parsed.eventCursor) ? parsed.eventCursor : 0;
        this.seq = Math.max(this.seq, diskSeq);
        this.eventSeq = Math.max(this.eventSeq, diskCursor);
        if (typeof parsed.standingInstructions === 'string') {
            this.standingText = parsed.standingInstructions;
        }
        return mergeJobs(this.jobList, this.baseJobs, latest, this.deletedIds);
    }
    readSeqSidecar() {
        try {
            const value = Number(readFileSync(this.seqFile, 'utf8').trim());
            return Number.isSafeInteger(value) && value > 0 ? value : null;
        }
        catch {
            return null;
        }
    }
    writeSeqSidecar() {
        try {
            writeFileSync(this.seqFile, `${this.seq}\n`);
        }
        catch (error) {
            this.warn(`dsh-cron: seq sidecar write failed: ${String(error)}`);
        }
    }
}
function terminalRun(run) {
    return run.state === 'succeeded' || run.state === 'failed' || run.state === 'cancelled' || run.state === 'indeterminate' || run.state === 'legacy';
}
function maxSeq(floor, jobs) {
    let max = floor;
    for (const job of jobs) {
        const value = Number(job.id.slice(job.id.lastIndexOf('-') + 1));
        if (Number.isSafeInteger(value) && value > max)
            max = value;
    }
    return max;
}
const storeLockWait = new Int32Array(new SharedArrayBuffer(4));
function acquireStoreWriteLock(lockDir) {
    for (let attempt = 0; attempt < 100; attempt++) {
        const lock = acquireDirLock(lockDir);
        if (lock.acquired)
            return lock;
        Atomics.wait(storeLockWait, 0, 0, 5);
    }
    throw new Error(`dsh-cron: timed out acquiring store write lock ${lockDir}`);
}
//# sourceMappingURL=store.js.map
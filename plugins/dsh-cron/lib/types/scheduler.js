/** Durable calendar scheduling that produces idempotent Automation occurrences. */
import { randomUUID } from 'node:crypto';
import { isAbsolute } from 'node:path';
import { isValidTimeZone, nextOccurrence, parseCronExpression } from "./cron.js";
const MAX_TIMER_DELAY_MS = 2_147_483_647;
const SUBMISSION_RETRY_MS = 60_000;
const STRICT_AT = new RegExp('^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(:\\d{2}(\\.\\d{1,3})?)?(Z|[+-]\\d{2}:\\d{2})$');
export class CronScheduler {
    options;
    cancelTimer = null;
    firing = false;
    pendingFire = false;
    running = false;
    specs = new Map();
    constructor(options) {
        this.options = options;
    }
    service() {
        return {
            add: input => this.addJob(input),
            edit: (id, input) => this.editJob(id, input),
            remove: id => this.removeJob(id),
            list: () => this.listJobs(),
            standingInstructions: () => this.options.store.standingInstructions(),
            setStandingInstructions: text => {
                this.options.store.setStandingInstructions(text);
                return this.options.store.standingInstructions();
            },
            fireNow: id => this.fireNow(id),
            setPaused: (id, paused) => this.setPaused(id, paused),
            setTarget: (id, target) => this.setTarget(id, target),
        };
    }
    start() {
        this.running = true;
        this.requestFire();
    }
    stop() {
        this.running = false;
        this.cancelTimer?.();
        this.cancelTimer = null;
    }
    storeChanged() {
        if (this.running)
            this.requestFire();
    }
    listJobs() {
        return this.options.store.list();
    }
    async reconcile() {
        await this.options.adapter.reconcile();
    }
    addJob(input) {
        const prompt = input.prompt.trim();
        if (prompt.length === 0)
            throw new Error('invalid_prompt: prompt must be non-blank');
        const { schedule, nextAtMs, spec } = this.resolveSchedule(input);
        const target = input.target ?? this.options.defaultTarget;
        if (target === undefined)
            throw new Error('missing_target: a fresh Session target cwd is required');
        validateTarget(target);
        const concurrencyLimit = input.concurrencyLimit ?? 1;
        if (!Number.isSafeInteger(concurrencyLimit) || concurrencyLimit < 1 || concurrencyLimit > 1_000) {
            throw new Error('invalid_concurrency: concurrencyLimit must be between 1 and 1000');
        }
        const duplicate = this.options.store.list().find(job => job.state === 'active' && job.prompt === prompt && JSON.stringify(job.schedule) === JSON.stringify(schedule)
            && JSON.stringify(job.target) === JSON.stringify(target));
        if (duplicate !== undefined)
            return { job: duplicate, deduplicated: true, nextOccurrences: this.preview(duplicate, 3) };
        const active = this.options.store.list().filter(job => job.state === 'active').length;
        if (active >= this.options.maxJobs)
            throw new Error(`too_many_jobs: at most ${this.options.maxJobs} active jobs are allowed`);
        const now = this.options.now();
        const job = {
            id: this.options.store.allocateId(), prompt, schedule, target, concurrencyLimit,
            createdBy: input.createdBy ?? null, createdAt: new Date(now).toISOString(), nextAt: new Date(nextAtMs).toISOString(),
            lastFiredAt: null, fireCount: 0, state: 'active', paused: false, lastRun: null, runs: [],
        };
        this.options.store.insert(job);
        if (spec !== null)
            this.specs.set(job.id, spec);
        this.arm();
        return { job, deduplicated: false, nextOccurrences: this.preview(job, 3) };
    }
    /** Update prompt / schedule / target on an active job. Preserves pause state and run history. */
    editJob(id, input) {
        const job = this.options.store.get(id);
        if (job === undefined || job.state === 'done') {
            throw new Error(`not_found: job "${id}" is missing or completed`);
        }
        const prompt = input.prompt.trim();
        if (prompt.length === 0)
            throw new Error('invalid_prompt: prompt must be non-blank');
        const allowExistingAt = job.schedule.kind === 'at' ? job.schedule.at : undefined;
        const { schedule, nextAtMs, spec } = this.resolveSchedule(input, allowExistingAt === undefined ? undefined : { allowExistingAt });
        const target = input.target ?? this.options.defaultTarget;
        if (target === undefined)
            throw new Error('missing_target: a fresh Session target cwd is required');
        validateTarget(target);
        if (input.concurrencyLimit !== undefined) {
            const concurrencyLimit = input.concurrencyLimit;
            if (!Number.isSafeInteger(concurrencyLimit) || concurrencyLimit < 1 || concurrencyLimit > 1_000) {
                throw new Error('invalid_concurrency: concurrencyLimit must be between 1 and 1000');
            }
            job.concurrencyLimit = concurrencyLimit;
        }
        Object.assign(job, {
            prompt,
            schedule,
            target,
            nextAt: new Date(nextAtMs).toISOString(),
        });
        delete job.migrationIssue;
        if (spec !== null)
            this.specs.set(job.id, spec);
        else
            this.specs.delete(job.id);
        this.options.store.flush();
        this.arm();
        return { job, deduplicated: false, nextOccurrences: this.preview(job, 3) };
    }
    removeJob(id) {
        const removed = this.options.store.remove(id);
        if (removed)
            this.specs.delete(id);
        this.arm();
        return removed;
    }
    setPaused(id, paused) {
        const job = this.options.store.get(id);
        if (job === undefined || job.state === 'done' || (job.target === null && !paused))
            return false;
        if (job.paused === paused)
            return true;
        job.paused = paused;
        if (!paused && job.schedule.kind === 'cron')
            this.advanceRecurring(job, this.options.now());
        this.options.store.flush();
        this.arm();
        return true;
    }
    setTarget(id, target) {
        validateTarget(target);
        const job = this.options.store.get(id);
        if (job === undefined)
            return false;
        job.target = target;
        delete job.migrationIssue;
        this.options.store.flush();
        return true;
    }
    async fireNow(id) {
        const job = this.options.store.get(id);
        if (job === undefined || job.state === 'done')
            return 'not_found';
        if (job.target === null)
            return 'target_required';
        const scheduledAt = new Date(this.options.now()).toISOString();
        const record = this.beginOccurrence(job, `manual:${scheduledAt}:${randomUUID()}`, scheduledAt, false);
        await this.options.adapter.submit(job, record);
        this.arm();
        return 'submitted';
    }
    resolveSchedule(input, opts) {
        const hasCron = typeof input.cron === 'string' && input.cron.trim().length > 0;
        const hasAt = typeof input.at === 'string' && input.at.trim().length > 0;
        if (hasCron === hasAt)
            throw new Error('invalid_selector: exactly one of cron or at is required');
        const now = this.options.now();
        if (hasCron) {
            const expression = input.cron.trim();
            const timeZone = input.timeZone?.trim() ?? this.options.defaultTimeZone;
            const spec = parseCronExpression(expression);
            if (!isValidTimeZone(timeZone))
                throw new Error(`invalid_time_zone: unknown IANA time zone "${timeZone}"`);
            const first = nextOccurrence(spec, now, timeZone);
            if (first === null)
                throw new Error('schedule_unreachable: no occurrence within four years');
            const second = nextOccurrence(spec, first, timeZone);
            if (second !== null && second - first < this.options.minIntervalMinutes * 60_000) {
                throw new Error(`too_frequent: occurrences must be at least ${this.options.minIntervalMinutes} minute(s) apart`);
            }
            return { schedule: { kind: 'cron', expression, timeZone }, nextAtMs: first, spec };
        }
        const at = input.at.trim();
        if (!STRICT_AT.test(at))
            throw new Error(`invalid_selector: at must be RFC 3339 with an explicit offset or Z, got "${at}"`);
        const atMs = Date.parse(at);
        if (Number.isNaN(atMs))
            throw new Error(`invalid_selector: unparseable RFC 3339 time "${at}"`);
        if (atMs <= now) {
            const existing = opts?.allowExistingAt;
            if (existing !== undefined) {
                const existingMs = Date.parse(existing);
                if (!Number.isNaN(existingMs) && Math.abs(atMs - existingMs) < 1_000) {
                    return { schedule: { kind: 'at', at: new Date(existingMs).toISOString() }, nextAtMs: existingMs, spec: null };
                }
            }
            throw new Error('not_future: at must be in the future');
        }
        return { schedule: { kind: 'at', at: new Date(atMs).toISOString() }, nextAtMs: atMs, spec: null };
    }
    requestFire() {
        if (this.firing) {
            this.pendingFire = true;
            return;
        }
        this.firing = true;
        void this.runFireDue().catch(error => {
            this.options.warn?.(`dsh-cron: occurrence pass failed: ${error instanceof Error ? error.message : String(error)}`);
        }).finally(() => {
            this.firing = false;
            if (this.pendingFire) {
                this.pendingFire = false;
                this.requestFire();
            }
            else
                this.arm();
        });
    }
    async runFireDue() {
        await this.options.adapter.submitPending();
        const now = this.options.now();
        const due = this.options.store.list()
            .filter(job => job.state === 'active' && !job.paused && job.target !== null && Date.parse(job.nextAt) <= now)
            .sort((left, right) => Date.parse(left.nextAt) - Date.parse(right.nextAt));
        for (const job of due) {
            const scheduledAt = job.nextAt;
            const record = this.beginOccurrence(job, scheduledAt, scheduledAt, true);
            await this.options.adapter.submit(job, record);
        }
        await this.options.adapter.reconcile();
    }
    beginOccurrence(job, occurrenceId, scheduledAt, advance) {
        const now = this.options.now();
        job.lastFiredAt = new Date(now).toISOString();
        job.fireCount += 1;
        if (advance) {
            if (job.schedule.kind === 'at')
                job.state = 'done';
            else
                this.advanceRecurring(job, now);
        }
        const record = {
            occurrenceId, scheduledAt, idempotencyKey: `v1:${job.id}:${occurrenceId}`,
            firedAt: new Date(now).toISOString(), state: 'submitting',
        };
        this.options.store.appendRun(job, record);
        return record;
    }
    advanceRecurring(job, now) {
        if (job.schedule.kind !== 'cron')
            return;
        const spec = this.specFor(job);
        const next = spec === null ? null : nextOccurrence(spec, now, job.schedule.timeZone);
        if (next === null)
            job.state = 'done';
        else
            job.nextAt = new Date(next).toISOString();
    }
    preview(job, count) {
        if (job.schedule.kind === 'at')
            return job.state === 'active' ? [job.nextAt] : [];
        const spec = this.specFor(job);
        if (spec === null)
            return [];
        const times = [];
        let cursor = Date.parse(job.nextAt) - 1;
        for (let index = 0; index < count; index++) {
            const next = nextOccurrence(spec, cursor, job.schedule.timeZone);
            if (next === null)
                break;
            times.push(new Date(next).toISOString());
            cursor = next;
        }
        return times;
    }
    specFor(job) {
        if (job.schedule.kind !== 'cron')
            return null;
        const cached = this.specs.get(job.id);
        if (cached !== undefined)
            return cached;
        const spec = parseCronExpression(job.schedule.expression);
        this.specs.set(job.id, spec);
        return spec;
    }
    arm() {
        this.cancelTimer?.();
        this.cancelTimer = null;
        let earliest;
        for (const job of this.options.store.list()) {
            if (job.runs.some(run => run.state === 'submitting' && run.automationRunId === undefined)) {
                earliest = this.options.now() + SUBMISSION_RETRY_MS;
            }
            if (job.state === 'active' && !job.paused && job.target !== null) {
                const at = Date.parse(job.nextAt);
                earliest = earliest === undefined ? at : Math.min(earliest, at);
            }
        }
        if (earliest === undefined)
            return;
        const delay = Math.min(Math.max(0, earliest - this.options.now()), MAX_TIMER_DELAY_MS);
        this.cancelTimer = this.options.armTimer(() => { this.cancelTimer = null; this.requestFire(); }, delay);
    }
}
function validateTarget(target) {
    if (target.kind !== 'fresh' || !isAbsolute(target.cwd))
        throw new Error('invalid_target: fresh Session cwd must be absolute');
    if ((target.provider === undefined) !== (target.model === undefined))
        throw new Error('invalid_target: provider and model must be supplied together');
}
//# sourceMappingURL=scheduler.js.map
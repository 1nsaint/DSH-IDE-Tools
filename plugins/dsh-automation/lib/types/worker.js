/** Long-lived Worker that leases Runs and executes canonical DSH turns. */
import { hostname } from 'node:os';
import { SessionId } from '@deepseek-ai/dsh-session';
import { applyPermission, createAutomationAgent } from "./worker/agent-runtime.js";
import { automationMessage } from "./worker/messages.js";
import { indeterminate, isRecoveryWakeMessage, recoveryWakeMessage, safeToResumeBeforeTurn, settlementFromEvents, } from "./worker/recovery.js";
export { isRecoveryWakeMessage, recoveryWakeMessage, safeToResumeBeforeTurn, settlementFromEvents } from "./worker/recovery.js";
/** One long-lived queue consumer owned by the automation app fiber. */
export class AutomationWorker {
    ctx;
    automation;
    options;
    log;
    hooks;
    workerId;
    timer;
    pumpTask;
    stopping = false;
    activeAgent;
    constructor(ctx, automation, options, log, hooks = {}) {
        this.ctx = ctx;
        this.automation = automation;
        this.options = options;
        this.log = log;
        this.hooks = hooks;
        this.workerId = options.workerId ?? `${hostname()}:${process.pid}`;
    }
    /** Execute one bounded cycle and propagate operational failures to the caller. */
    async runOnce() {
        if (this.timer !== undefined || this.pumpTask !== undefined)
            throw new Error('automation Worker is already started');
        return await this.pump();
    }
    /** Start polling immediately and keep the process live until disposed. */
    start() {
        if (this.timer !== undefined)
            throw new Error('automation Worker is already started');
        this.timer = setInterval(() => { this.requestPump(); }, this.options.pollMs);
        this.requestPump();
        this.log.info(`dsh-automation: Worker ${this.workerId} started`);
        return async () => {
            this.stopping = true;
            if (this.timer !== undefined)
                clearInterval(this.timer);
            this.timer = undefined;
            const active = this.pumpTask;
            if (active !== undefined) {
                const graceful = await settlesWithin(active, this.options.shutdownGraceMs ?? 30_000);
                if (!graceful) {
                    this.log.warn(`dsh-automation: Worker ${this.workerId} exceeded shutdown grace; cancelling active turn`);
                    this.activeAgent?.cancel({ kind: 'disposed' });
                    await active;
                }
            }
            this.log.info(`dsh-automation: Worker ${this.workerId} stopped`);
        };
    }
    requestPump() {
        if (this.pumpTask !== undefined || this.stopping)
            return;
        const task = this.pump().then(() => { }, (error) => { this.log.warn(`dsh-automation: Worker pump failed: ${errorMessage(error)}`); });
        this.pumpTask = task;
        void task.finally(() => {
            if (this.pumpTask === task)
                this.pumpTask = undefined;
        });
    }
    async pump() {
        if (this.stopping)
            return { recovered: 0 };
        const now = Date.now();
        const undispatched = this.automation.recoverUndispatchedExpired(now);
        const dispatched = await this.recoverExpiredDispatched(now);
        const recovered = undispatched.length + dispatched;
        if (this.stopping)
            return { recovered };
        const claim = this.automation.claimNext(this.workerId, Date.now(), this.options.leaseMs);
        if (claim === undefined)
            return { recovered };
        await this.checkpoint('after-claim', claim);
        await this.execute(claim);
        return { recovered, claimedRunId: claim.run.id };
    }
    async recoverExpiredDispatched(now) {
        let recovered = 0;
        for (const ref of this.automation.expiredDispatched(now)) {
            try {
                const inspection = await this.ctx.sessionPersistence.inspect(SessionId(ref.sessionId));
                const settlement = settlementFromEvents(inspection.events);
                if (settlement !== undefined) {
                    this.automation.settleExpired(ref, settlement, Date.now());
                    recovered += 1;
                }
                else if (safeToResumeBeforeTurn(inspection.events)) {
                    const claim = this.automation.reclaimDispatched(ref, this.workerId, Date.now(), this.options.leaseMs);
                    if (claim !== undefined) {
                        await this.execute(claim, true);
                        recovered += 1;
                    }
                }
                else {
                    this.automation.settleExpired(ref, indeterminate('canonical Session has no terminal turn and is not safely resumable'), Date.now());
                    recovered += 1;
                }
            }
            catch (error) {
                try {
                    this.automation.settleExpired(ref, indeterminate(`canonical Session recovery failed: ${errorMessage(error)}`), Date.now());
                    recovered += 1;
                }
                catch (settleError) {
                    this.log.warn(`dsh-automation: ${ref.runId} recovery settlement lost: ${errorMessage(settleError)}`);
                }
            }
        }
        return recovered;
    }
    async execute(initialClaim, resume = false) {
        let claim = initialClaim;
        let handle;
        let heartbeat;
        let deliveryStarted = resume;
        let leaseFailure;
        try {
            const renewLease = () => {
                try {
                    claim = this.automation.heartbeat(claim, Date.now(), this.options.leaseMs);
                    if (claim.run.state === 'cancelling')
                        handle?.agent.cancel({ kind: 'user' });
                }
                catch (error) {
                    leaseFailure = error;
                    handle?.agent.cancel({ kind: 'disposed' });
                }
            };
            // Agent creation and Session loading can take longer than one lease. Ownership
            // must therefore be renewed from the moment the Run is claimed, not only once
            // the first user message has been persisted.
            renewLease();
            if (leaseFailure !== undefined)
                throw leaseFailure;
            heartbeat = setInterval(renewLease, Math.max(1, Math.floor(this.options.leaseMs / 3)));
            if (isCancelling(claim)) {
                this.automation.settle(claim, { state: 'cancelled', outcome: 'cancelled' }, Date.now());
                return;
            }
            handle = await createAutomationAgent(this.ctx, claim, resume);
            this.activeAgent = handle.agent;
            if (resume) {
                const pending = [...handle.agent.inbox.nextStep, ...handle.agent.inbox.nextTurn]
                    .filter(message => !isRecoveryWakeMessage(message));
                if (pending.length === 0)
                    throw new Error('canonical Session recovery found no pending task message');
                handle.agent.steer(recoveryWakeMessage());
            }
            await handle.agent.whenIdle();
            if (resume) {
                if (heartbeat !== undefined)
                    clearInterval(heartbeat);
                heartbeat = undefined;
                if (leaseFailure !== undefined)
                    throw leaseFailure;
                await this.ctx.sessions.flush(handle.agent.session);
                const settlement = settlementFromEvents(handle.agent.session.events)
                    ?? indeterminate('resumed canonical Session settled without a terminal turn');
                await this.checkpoint('before-settle', claim);
                this.automation.settle(claim, settlement, Date.now());
                this.log.info(`dsh-automation: ${claim.run.id} ${settlement.state} after recovery`);
                return;
            }
            applyPermission(this.ctx, handle.agent, claim.run.target);
            renewLease();
            if (leaseFailure !== undefined)
                throw leaseFailure;
            if (isCancelling(claim)) {
                this.automation.settle(claim, { state: 'cancelled', outcome: 'cancelled' }, Date.now());
                return;
            }
            const firstSeq = handle.agent.session.seq;
            handle.agent.followup(automationMessage(claim));
            deliveryStarted = true;
            await this.ctx.sessions.flush(handle.agent.session);
            claim = { ...claim, run: this.automation.markRunning(claim, Date.now()) };
            await this.checkpoint('after-dispatch', claim);
            if (claim.run.state === 'cancelling')
                handle.agent.cancel({ kind: 'user' });
            await handle.agent.whenIdle();
            if (heartbeat !== undefined)
                clearInterval(heartbeat);
            heartbeat = undefined;
            if (leaseFailure !== undefined)
                throw leaseFailure;
            await this.ctx.sessions.flush(handle.agent.session);
            const settlement = settlementFromEvents(handle.agent.session.events.slice(firstSeq))
                ?? indeterminate('canonical Session settled without a terminal turn');
            await this.checkpoint('before-settle', claim);
            this.automation.settle(claim, settlement, Date.now());
            this.log.info(`dsh-automation: ${claim.run.id} ${settlement.state}`);
        }
        catch (error) {
            if (heartbeat !== undefined)
                clearInterval(heartbeat);
            const settlement = deliveryStarted
                ? indeterminate(`execution failed after delivery began: ${errorMessage(error)}`)
                : { state: 'failed', outcome: 'error', error: `execution failed before delivery: ${errorMessage(error)}` };
            try {
                this.automation.settle(claim, settlement, Date.now());
            }
            catch (settleError) {
                this.log.warn(`dsh-automation: ${claim.run.id} could not settle after failure: ${errorMessage(settleError)}`);
            }
        }
        finally {
            this.activeAgent = undefined;
            await handle?.dispose();
        }
    }
    async checkpoint(point, claim) {
        await this.hooks.checkpoint?.(point, claim);
    }
}
function isCancelling(claim) {
    return claim.run.state === 'cancelling';
}
function errorMessage(error) {
    return error instanceof Error ? error.message : String(error);
}
async function settlesWithin(task, milliseconds) {
    let timer;
    const timeout = new Promise(resolve => { timer = setTimeout(() => { resolve(false); }, milliseconds); });
    const settled = await Promise.race([task.then(() => true), timeout]);
    if (timer !== undefined)
        clearTimeout(timer);
    return settled;
}
//# sourceMappingURL=worker.js.map
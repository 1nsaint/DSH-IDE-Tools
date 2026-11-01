/** Application-owned command line for the automation profile. */
import type { Context } from '@deepseek-ai/cordis';
import type { RunState } from './domain.ts';
/** Service published after one valid automation command is parsed. */
export declare const AUTOMATION_STARTUP_SERVICE = "automationStartup";
/** Parsed automation application invocation. */
export type AutomationStartup = {
    readonly mode: 'worker';
    readonly pollMs: number;
    readonly leaseMs: number;
    readonly workerId?: string;
    readonly slots: number;
    readonly shutdownGraceMs: number;
    readonly once: boolean;
    readonly json: boolean;
} | {
    readonly mode: 'submit';
    readonly prompt: string;
    readonly cwd: string;
    readonly preset?: string;
    readonly provider?: string;
    readonly model?: string;
    readonly permissionPreset?: string;
    readonly idempotencyKey?: string;
    readonly priority: number;
    readonly maxAttempts: number;
    readonly concurrencyKey?: string;
    readonly concurrencyLimit?: number;
    readonly json: boolean;
} | {
    readonly mode: 'list';
    readonly state?: RunState;
    readonly triggerKind?: string;
    readonly triggerSourceId?: string;
    readonly limit: number;
    readonly beforeCreatedAt?: number;
    readonly beforeId?: string;
    readonly json: boolean;
} | {
    readonly mode: 'events';
    readonly afterSeq: number;
    readonly runId?: string;
    readonly triggerKind?: string;
    readonly triggerSourceId?: string;
    readonly limit: number;
    readonly json: boolean;
} | {
    readonly mode: 'consumer-list';
    readonly json: boolean;
} | {
    readonly mode: 'consumer-checkpoint';
    readonly consumerId: string;
    readonly seq: number;
    readonly json: boolean;
} | {
    readonly mode: 'consumer-remove';
    readonly consumerId: string;
    readonly json: boolean;
} | {
    readonly mode: 'purge';
    readonly before: number;
    readonly limit: number;
    readonly json: boolean;
} | {
    readonly mode: 'status';
    readonly json: boolean;
} | {
    readonly mode: 'pause';
    readonly reason?: string;
    readonly json: boolean;
} | {
    readonly mode: 'drain';
    readonly reason?: string;
    readonly timeoutMs: number;
    readonly pollMs: number;
    readonly json: boolean;
} | {
    readonly mode: 'resume';
    readonly json: boolean;
} | {
    readonly mode: 'show';
    readonly runId: string;
    readonly json: boolean;
} | {
    readonly mode: 'cancel';
    readonly runId: string;
    readonly json: boolean;
} | {
    readonly mode: 'retry';
    readonly runId: string;
    readonly idempotencyKey?: string;
    readonly confirmIndeterminate: boolean;
    readonly priority?: number;
    readonly maxAttempts?: number;
    readonly json: boolean;
};
declare module '@deepseek-ai/cordis' {
    interface Context {
        automationStartup: AutomationStartup;
    }
}
/** Stable Cordis plugin name. */
export declare const name = "dsh-automation-startup";
/** The startup parser requires the launcher's immutable inner argv. */
export declare const inject: string[];
/** Parse and publish exactly one automation subcommand. */
export declare function apply(ctx: Context): void;
//# sourceMappingURL=startup.d.ts.map
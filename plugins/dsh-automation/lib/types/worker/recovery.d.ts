/** Canonical Session evidence and inbox-only recovery controls. */
import type { Context } from '@deepseek-ai/cordis';
import { type UserMessage } from '@deepseek-ai/dsh-llm';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { RunSettlement } from '../domain.ts';
/** Create an identified steering item that wakes only through published Agent APIs. */
export declare function recoveryWakeMessage(): UserMessage;
/** Recognize only this plugin's exact non-model-facing recovery control item. */
export declare function isRecoveryWakeMessage(message: UserMessage): boolean;
/** Strip claimed recovery steering after it wakes the loop but before request material is committed. */
export declare function installRecoveryWakeFilter(ctx: Context): void;
/** Derive the terminal Run projection from canonical Session events. */
export declare function settlementFromEvents(events: readonly SessionEvent[]): RunSettlement | undefined;
/** A durable inbox splice without a started turn can be resumed without redelivery. */
export declare function safeToResumeBeforeTurn(events: readonly SessionEvent[]): boolean;
/** Build the conservative terminal state for unknowable side effects. */
export declare function indeterminate(error: string): RunSettlement;
//# sourceMappingURL=recovery.d.ts.map
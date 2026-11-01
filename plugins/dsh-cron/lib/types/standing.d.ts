/**
 * Cron-only standing instructions — injected into every scheduled Automation
 * run, never into interactive chat / AGENTS.md.
 * @module dsh-cron/standing
 */
/** Default unattended-work protocol shown (and used) until the operator edits it. */
export declare const DEFAULT_STANDING_INSTRUCTIONS: string;
/**
 * Build the Automation turn prompt for one cron occurrence.
 * Standing instructions (if any) apply to every job; the job prompt is the per-task ask.
 */
export declare function buildAutomationPrompt(job: {
    readonly id: string;
    readonly prompt: string;
    readonly schedule: unknown;
}, scheduledAt: string, standingInstructions: string): string;
//# sourceMappingURL=standing.d.ts.map
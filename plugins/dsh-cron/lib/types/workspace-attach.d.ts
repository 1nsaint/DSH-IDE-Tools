/**
 * Attach automation-created Sessions to the matching workspace sidebar bucket
 * and give them a readable title (cwd basename fallback looks like "Test env").
 * @module
 */
import type { CronJob } from './store.ts';
/** Minimal workspaceRegistry surface used by attach. */
export interface WorkspaceRegistryLike {
    readonly list?: () => readonly WorkspaceEntityLike[];
    readonly resolveByPath?: (path: string) => Promise<WorkspaceEntityLike | null | undefined>;
    readonly sessionPaths?: {
        set?: (sessionId: string, cwd: string) => void;
    };
    readonly headers?: {
        set?: (sessionId: string, header: Record<string, unknown>) => void;
    };
    readonly rememberSessionPath?: (sessionId: string, cwd: string) => void;
}
export interface WorkspaceEntityLike {
    readonly id?: string;
    readonly workspaceId?: string;
    readonly path: string;
    readonly title?: string;
    readonly sessionIds?: readonly string[];
    attachSession?: (sessionId: string) => Promise<void>;
    mutate?: (fn: (record: Record<string, unknown>) => Record<string, unknown>) => Promise<unknown>;
}
export interface SessionTitleLike {
    rename?: (session: unknown, title: string) => unknown;
}
export interface SessionsLike {
    get?: (id: string) => unknown;
}
/** Short sidebar label from the job prompt. */
export declare function cronSessionTitle(job: CronJob): string;
/** Append a durable session/title event so the sidebar does not fall back to the cwd name. */
export declare function appendSessionTitleEvent(sessionId: string, cwd: string, title: string): boolean;
/** Best-effort durable title write into the projection cache shard. */
export declare function writeProjcacheTitle(sessionId: string, cwd: string, title: string): void;
/**
 * Ensure a cron/automation Session appears under its target workspace in the sidebar.
 */
export declare function attachCronSession(options: {
    readonly registry: WorkspaceRegistryLike;
    readonly sessionId: string;
    readonly cwd: string;
    readonly title: string;
    readonly warn: (message: string) => void;
    readonly sessions?: SessionsLike;
    readonly sessionTitle?: SessionTitleLike;
}): Promise<boolean>;
//# sourceMappingURL=workspace-attach.d.ts.map
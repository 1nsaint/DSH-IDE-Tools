/** Non-blocking cross-process directory lock with stale-pid takeover. */
export interface DirLock {
    readonly acquired: boolean;
    readonly reason: 'acquired' | 'held' | 'exhausted';
    readonly heldBy: number | null;
    release(): void;
}
export declare function acquireDirLock(lockDir: string, attempts?: number): DirLock;
//# sourceMappingURL=filelock.d.ts.map
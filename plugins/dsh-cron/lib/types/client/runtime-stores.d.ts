/**
 * Subscribe to Harness workspace/session lists for hero tools and other mounts
 * that do not receive sidebar.footer.action runtime props.
 * @module
 */
type StoreHook<TState> = <TSelected>(selector: (state: TState) => TSelected) => TSelected;
export interface WorkspaceRow {
    workspaceId?: string;
    path?: string;
    title?: string;
    name?: string;
    sessionIds?: string[];
}
interface WorkspacesSnapshot {
    items?: WorkspaceRow[];
}
interface SessionsSnapshot {
    current?: string | undefined;
}
export declare function isMountRootWorkspace(path: string | undefined): boolean;
export declare function bindHarnessRuntimeStores(scope: unknown): void;
export declare function unbindHarnessRuntimeStores(): void;
export declare const useCronWorkspaces: StoreHook<WorkspacesSnapshot>;
export declare const useCronSessions: StoreHook<SessionsSnapshot>;
export {};
//# sourceMappingURL=runtime-stores.d.ts.map
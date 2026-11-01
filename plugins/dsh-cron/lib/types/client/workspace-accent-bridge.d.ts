/**
 * Read per-workspace folder colors from `dsh-workspace-accent` when present.
 * @module
 */
import type { WorkspaceRow } from './runtime-stores.ts';
declare global {
    interface Window {
        __dshWorkspaceAccent?: {
            keyFromItem: (item: WorkspaceRow) => string;
            colorForKey: (key: string) => string;
        };
    }
}
export declare function workspaceAccentKey(row: WorkspaceRow): string;
export declare function workspaceFolderColor(row: WorkspaceRow | null | undefined): string | undefined;
export declare function subscribeWorkspaceAccent(onChange: () => void): () => void;
//# sourceMappingURL=workspace-accent-bridge.d.ts.map
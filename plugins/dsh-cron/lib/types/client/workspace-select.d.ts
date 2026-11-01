/**
 * Workspace picker with sidebar-matching colored folder icons.
 * @module
 */
import { type JSX } from 'react';
import type { WorkspaceRow } from './runtime-stores.ts';
export interface WorkspaceSelectProps {
    readonly value: string;
    readonly onChange: (path: string) => void;
    readonly workspaces: readonly WorkspaceRow[];
    readonly defaultLabel: string;
    readonly extraOptions?: ReadonlyArray<{
        readonly value: string;
        readonly label: string;
    }>;
}
export declare function WorkspaceSelect({ value, onChange, workspaces, defaultLabel, extraOptions, }: WorkspaceSelectProps): JSX.Element;
//# sourceMappingURL=workspace-select.d.ts.map
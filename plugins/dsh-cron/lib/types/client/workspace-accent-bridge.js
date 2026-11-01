/**
 * Read per-workspace folder colors from `dsh-workspace-accent` when present.
 * @module
 */
const CONFIG_EVENT = 'dsh-workspace-accent-config';
export function workspaceAccentKey(row) {
    const api = typeof window !== 'undefined' ? window.__dshWorkspaceAccent : undefined;
    if (api?.keyFromItem)
        return api.keyFromItem(row);
    return row.workspaceId ?? row.path ?? row.name ?? row.title ?? 'default';
}
export function workspaceFolderColor(row) {
    if (!row)
        return undefined;
    const api = typeof window !== 'undefined' ? window.__dshWorkspaceAccent : undefined;
    if (!api?.colorForKey)
        return undefined;
    return api.colorForKey(workspaceAccentKey(row));
}
export function subscribeWorkspaceAccent(onChange) {
    if (typeof window === 'undefined')
        return () => { };
    const onCfg = () => { onChange(); };
    window.addEventListener(CONFIG_EVENT, onCfg);
    const mq = window.matchMedia?.('(prefers-color-scheme: dark)');
    const onScheme = () => { onChange(); };
    mq?.addEventListener?.('change', onScheme);
    return () => {
        window.removeEventListener(CONFIG_EVENT, onCfg);
        mq?.removeEventListener?.('change', onScheme);
    };
}
//# sourceMappingURL=workspace-accent-bridge.js.map
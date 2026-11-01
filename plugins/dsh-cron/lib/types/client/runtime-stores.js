/**
 * Subscribe to Harness workspace/session lists for hero tools and other mounts
 * that do not receive sidebar.footer.action runtime props.
 * @module
 */
import { useSyncExternalStore } from 'react';
const MOUNT_ROOT = '/workspace';
let workspacesList = null;
let sessionsList = null;
const EMPTY_WORKSPACES = { items: [] };
const EMPTY_SESSIONS = {};
function normPath(value) {
    const p = String(value ?? '').replace(/\/+$/, '');
    return p || '/';
}
export function isMountRootWorkspace(path) {
    return normPath(path) === MOUNT_ROOT;
}
function pickList(scope, key) {
    if (!scope || typeof scope !== 'object')
        return null;
    const record = scope;
    const bag = record[key] ?? (typeof record.get === 'function' ? record.get(key) : undefined);
    if (!bag || typeof bag !== 'object')
        return null;
    const list = bag.list;
    if (!list?.subscribe || !list.getSnapshot)
        return null;
    return list;
}
export function bindHarnessRuntimeStores(scope) {
    workspacesList = pickList(scope, 'workspaces');
    sessionsList = pickList(scope, 'sessions');
}
export function unbindHarnessRuntimeStores() {
    workspacesList = null;
    sessionsList = null;
}
function subscribeWorkspaces(onStoreChange) {
    return workspacesList?.subscribe(onStoreChange) ?? (() => { });
}
function getWorkspacesSnapshot() {
    if (!workspacesList)
        return EMPTY_WORKSPACES;
    return workspacesList.getSnapshot();
}
function subscribeSessions(onStoreChange) {
    return sessionsList?.subscribe(onStoreChange) ?? (() => { });
}
function getSessionsSnapshot() {
    if (!sessionsList)
        return EMPTY_SESSIONS;
    return sessionsList.getSnapshot();
}
export const useCronWorkspaces = selector => selector(useSyncExternalStore(subscribeWorkspaces, getWorkspacesSnapshot, () => EMPTY_WORKSPACES));
export const useCronSessions = selector => selector(useSyncExternalStore(subscribeSessions, getSessionsSnapshot, () => EMPTY_SESSIONS));
//# sourceMappingURL=runtime-stores.js.map
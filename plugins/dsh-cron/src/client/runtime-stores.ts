/**
 * Subscribe to Harness workspace/session lists for hero tools and other mounts
 * that do not receive sidebar.footer.action runtime props.
 * @module
 */

import { useSyncExternalStore } from 'react'

const MOUNT_ROOT = '/workspace'

type StoreHook<TState> = <TSelected>(selector: (state: TState) => TSelected) => TSelected

interface ListStore<T> {
  subscribe: (listener: () => void) => () => void
  getSnapshot: () => T
}

export interface WorkspaceRow {
  workspaceId?: string
  path?: string
  title?: string
  name?: string
  sessionIds?: string[]
}

interface WorkspacesSnapshot {
  items?: WorkspaceRow[]
}

interface SessionsSnapshot {
  current?: string | undefined
}

let workspacesList: ListStore<WorkspacesSnapshot> | null = null
let sessionsList: ListStore<SessionsSnapshot> | null = null

const EMPTY_WORKSPACES: WorkspacesSnapshot = { items: [] }
const EMPTY_SESSIONS: SessionsSnapshot = {}

function normPath(value: string | undefined): string {
  const p = String(value ?? '').replace(/\/+$/, '')
  return p || '/'
}

export function isMountRootWorkspace(path: string | undefined): boolean {
  return normPath(path) === MOUNT_ROOT
}

function pickList(scope: unknown, key: 'workspaces' | 'sessions'): ListStore<unknown> | null {
  if (!scope || typeof scope !== 'object') return null
  const record = scope as Record<string, unknown>
  const bag = record[key] ?? (typeof record.get === 'function' ? (record.get as (k: string) => unknown)(key) : undefined)
  if (!bag || typeof bag !== 'object') return null
  const list = (bag as { list?: ListStore<unknown> }).list
  if (!list?.subscribe || !list.getSnapshot) return null
  return list
}

export function bindHarnessRuntimeStores(scope: unknown): void {
  workspacesList = pickList(scope, 'workspaces') as ListStore<WorkspacesSnapshot> | null
  sessionsList = pickList(scope, 'sessions') as ListStore<SessionsSnapshot> | null
}

export function unbindHarnessRuntimeStores(): void {
  workspacesList = null
  sessionsList = null
}

function subscribeWorkspaces(onStoreChange: () => void): () => void {
  return workspacesList?.subscribe(onStoreChange) ?? (() => {})
}

function getWorkspacesSnapshot(): WorkspacesSnapshot {
  if (!workspacesList) return EMPTY_WORKSPACES
  return workspacesList.getSnapshot()
}

function subscribeSessions(onStoreChange: () => void): () => void {
  return sessionsList?.subscribe(onStoreChange) ?? (() => {})
}

function getSessionsSnapshot(): SessionsSnapshot {
  if (!sessionsList) return EMPTY_SESSIONS
  return sessionsList.getSnapshot()
}

export const useCronWorkspaces: StoreHook<WorkspacesSnapshot> = selector =>
  selector(useSyncExternalStore(subscribeWorkspaces, getWorkspacesSnapshot, () => EMPTY_WORKSPACES))

export const useCronSessions: StoreHook<SessionsSnapshot> = selector =>
  selector(useSyncExternalStore(subscribeSessions, getSessionsSnapshot, () => EMPTY_SESSIONS))

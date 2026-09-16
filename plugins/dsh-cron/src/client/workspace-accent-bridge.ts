/**
 * Read per-workspace folder colors from `dsh-workspace-accent` when present.
 * @module
 */

import type { WorkspaceRow } from './runtime-stores.ts'

declare global {
  interface Window {
    __dshWorkspaceAccent?: {
      keyFromItem: (item: WorkspaceRow) => string
      colorForKey: (key: string) => string
    }
  }
}

const CONFIG_EVENT = 'dsh-workspace-accent-config'

export function workspaceAccentKey(row: WorkspaceRow): string {
  const api = typeof window !== 'undefined' ? window.__dshWorkspaceAccent : undefined
  if (api?.keyFromItem) return api.keyFromItem(row)
  return row.workspaceId ?? row.path ?? row.name ?? row.title ?? 'default'
}

export function workspaceFolderColor(row: WorkspaceRow | null | undefined): string | undefined {
  if (!row) return undefined
  const api = typeof window !== 'undefined' ? window.__dshWorkspaceAccent : undefined
  if (!api?.colorForKey) return undefined
  return api.colorForKey(workspaceAccentKey(row))
}

export function subscribeWorkspaceAccent(onChange: () => void): () => void {
  if (typeof window === 'undefined') return () => {}
  const onCfg = (): void => { onChange() }
  window.addEventListener(CONFIG_EVENT, onCfg)
  const mq = window.matchMedia?.('(prefers-color-scheme: dark)')
  const onScheme = (): void => { onChange() }
  mq?.addEventListener?.('change', onScheme)
  return () => {
    window.removeEventListener(CONFIG_EVENT, onCfg)
    mq?.removeEventListener?.('change', onScheme)
  }
}

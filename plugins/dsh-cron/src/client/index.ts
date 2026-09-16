/**
 * dsh-cron browser half: scheduled tasks in the workbench tab strip.
 * Polls the host `/cron` channel — no model involvement.
 * @module
 */

import { createElement } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-locale/client'
import type {} from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client'
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import { CronTabView, type CronScheduleProps } from './CronPanel.tsx'
import { en, formatCronMessage, zh, type CronKey } from './locales.ts'
import {
  bindHarnessRuntimeStores,
  unbindHarnessRuntimeStores,
  useCronSessions,
  useCronWorkspaces,
} from './runtime-stores.ts'

/** Namespace owning the cron panel copy; merged into LocaleNamespaceMap. */
export const CRON_LOCALE_NS = 'sidebar.cron'

export const CRON_TAB_LABEL = 'Scheduled'
export const CRON_HERO_TOOL_ID = 'scheduled'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Cron workbench tab copy. */
    'sidebar.cron': CronKey
  }
}

declare global {
  interface Window {
    __dshHeroToolRegistry?: {
      _map?: Map<string, () => unknown>
      register: (id: string, factory: () => unknown) => () => void
      get: (id: string) => (() => unknown) | undefined
    }
  }
}

export const inject = ['slots', 'connection', 'locale', 'workspaces', 'sessions']

const heroSessionsHook = useCronSessions as unknown as CronScheduleProps['useSessions']
const heroWorkspacesHook = useCronWorkspaces as unknown as CronScheduleProps['useWorkspaces']

function ensureHeroRegistry(): NonNullable<Window['__dshHeroToolRegistry']> {
  if (typeof window === 'undefined') {
    return {
      register: () => () => {},
      get: () => undefined,
    }
  }
  if (!window.__dshHeroToolRegistry) {
    const map = new Map<string, () => unknown>()
    window.__dshHeroToolRegistry = {
      _map: map,
      register(id: string, factory: () => unknown) {
        map.set(id, factory)
        return () => { map.delete(id) }
      },
      get(id: string) {
        return map.get(id)
      },
    }
  }
  return window.__dshHeroToolRegistry
}

function heroCronView(connection: ConnectionHandle): ReturnType<typeof createElement> {
  const t = (key: CronKey, params?: Record<string, string | number>) => formatCronMessage(en, key, params)
  return createElement(CronTabView, {
    connection,
    t,
    useSessions: heroSessionsHook,
    useWorkspaces: heroWorkspacesHook,
  } as never)
}

function bindFromContext(ctx: ClientContext): void {
  bindHarnessRuntimeStores({
    workspaces: ctx.get('workspaces' as never),
    sessions: ctx.get('sessions' as never),
  })
}

export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle

  bindFromContext(ctx)
  ctx.effect(() => {
    bindFromContext(ctx)
    return () => { unbindHarnessRuntimeStores() }
  }, 'dsh-cron: runtime stores')

  ctx.effect(() => ctx.locale.register(CRON_LOCALE_NS, { zh, en }), 'dsh-cron: panel dictionaries')

  ctx.effect(() => ctx.slots.inject(
    'conversation.view' as 'root',
    () => ctx.slots.register({
      name: 'conversation.view',
      id: CRON_HERO_TOOL_ID,
      order: 46,
      label: () => CRON_TAB_LABEL,
      locale: CRON_LOCALE_NS,
      inject: () => ({
        connection,
        useSessions: heroSessionsHook,
        useWorkspaces: heroWorkspacesHook,
      }),
    } as never, CronTabView),
  ), 'dsh-cron: workbench tab')

  ctx.effect(() => {
    const registry = ensureHeroRegistry()
    return registry.register(CRON_HERO_TOOL_ID, () => heroCronView(connection))
  }, 'dsh-cron: hero tool')
}

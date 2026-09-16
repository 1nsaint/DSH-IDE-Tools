/** Cordis activation for the cron Trigger adapter. */

import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths'
import { CronAutomationAdapter } from './adapter.ts'
import { requireAutomation, type AutomationTarget } from './automation.ts'
import { registerCronCommand } from './command.ts'
import { resolveConfig, type Config } from './config.ts'
import { acquireSchedulerLock } from './lock.ts'
import { registerCronRpc } from './rpc.ts'
import { CronScheduler } from './scheduler.ts'
import { CronStore, type CronJob, type CronRunRecord } from './store.ts'
import { registerCronTools } from './tools.ts'
import {
  attachCronSession,
  cronSessionTitle,
  type SessionTitleLike,
  type SessionsLike,
  type WorkspaceRegistryLike,
} from './workspace-attach.ts'

export interface PluginRuntime {
  now(): number
  warn(message: string): void
  info(message: string): void
}

export function createPluginRuntime(ctx: Context): PluginRuntime {
  return {
    now: () => Date.now(),
    warn: message => { ctx.logger.warn(message) },
    info: message => { ctx.logger.info(message) },
  }
}

interface OutboundCallbacks {
  emit(event: {
    readonly source: 'cron'
    readonly subject: string
    readonly outcome?: string
    readonly excerpt?: string
    readonly jobId?: string
    readonly firedAt?: string
    readonly completedAt?: string
  }): void
}

export interface CronSettledEvent {
  readonly jobId: string
  readonly run: CronRunRecord
}

declare module '@deepseek-ai/cordis' {
  interface Events {
    'cron/settled'(event: CronSettledEvent): void
  }
}

export function apply(ctx: Context, config: Config): void {
  const resolved = resolveConfig(config)
  const runtime = createPluginRuntime(ctx)
  const automation = requireAutomation(ctx.get('automation'))
  const dataDir = resolved.dataDir ?? join(resolveDshHome(), 'cron')
  const defaultTarget: AutomationTarget | undefined = resolved.defaultCwd === undefined
    ? undefined
    : { kind: 'fresh', cwd: resolved.defaultCwd }
  const store = new CronStore(
    join(dataDir, 'jobs.json'), message => runtime.warn(message), defaultTarget, resolved.maxRunHistory,
  )
  store.load()

  const sessionAttach: {
    handler: ((job: CronJob, record: CronRunRecord, sessionId: string) => void) | null
  } = { handler: null }
  const attachedSessions = new Set<string>()

  const adapter = new CronAutomationAdapter(
    store,
    automation,
    () => runtime.now(),
    message => runtime.warn(message),
    (job, run) => { ctx.emit('cron/settled', { jobId: job.id, run }) },
    (job, record, sessionId) => { sessionAttach.handler?.(job, record, sessionId) },
  )
  const scheduler = new CronScheduler({
    store,
    adapter,
    now: () => runtime.now(),
    armTimer: (callback, delayMs) => {
      const timer = setTimeout(callback, delayMs)
      return () => { clearTimeout(timer) }
    },
    warn: message => runtime.warn(message),
    ...(defaultTarget === undefined ? {} : { defaultTarget }),
    defaultTimeZone: resolved.defaultTimeZone,
    maxJobs: resolved.maxJobs,
    minIntervalMinutes: resolved.minIntervalMinutes,
  })

  ctx.provide('cron', scheduler.service())
  registerCronTools(ctx, scheduler)
  ctx.effect(() => store.watch(jobs => {
    runtime.info(`dsh-cron: job store reloaded (${jobs} job(s))`)
    scheduler.storeChanged()
  }), 'dsh-cron: store watch')
  ctx.inject(['commands'], commandCtx => {
    commandCtx.effect(() => registerCronCommand(commandCtx, scheduler), 'dsh-cron: command')
  })
  ctx.inject(['connection', 'webServer'], connectionCtx => {
    connectionCtx.effect(() => registerCronRpc(connectionCtx, scheduler.service()), 'dsh-cron: rpc')
    connectionCtx.inject(['workspaceRegistry'], registryCtx => {
      registryCtx.effect(() => {
        const registry = (registryCtx as { workspaceRegistry?: WorkspaceRegistryLike }).workspaceRegistry
          ?? (registryCtx.get?.('workspaceRegistry') as WorkspaceRegistryLike | undefined)
        if (registry === undefined) {
          runtime.warn('dsh-cron: workspaceRegistry unavailable; scheduled chats stay Ungrouped')
          return () => {}
        }
        sessionAttach.handler = (job, _record, sessionId) => {
          if (attachedSessions.has(sessionId)) return
          const cwd = job.target?.cwd
          if (!cwd) {
            runtime.warn(`dsh-cron: ${job.id} session ${sessionId} has no target cwd`)
            return
          }
          attachedSessions.add(sessionId)
          const title = cronSessionTitle(job)
          const sessions = tryGet(ctx, 'sessions') as SessionsLike | undefined
          const sessionTitle = tryGet(ctx, 'sessionTitle') as SessionTitleLike | undefined
          void attachCronSession({
            registry,
            sessionId,
            cwd,
            title,
            warn: message => runtime.warn(message),
            ...(sessions === undefined ? {} : { sessions }),
            ...(sessionTitle === undefined ? {} : { sessionTitle }),
          }).then(ok => {
            if (ok) runtime.info(`dsh-cron: attached ${sessionId} under ${cwd} as “${title}”`)
            else attachedSessions.delete(sessionId)
          }).catch(error => {
            attachedSessions.delete(sessionId)
            runtime.warn(`dsh-cron: attach failed: ${message(error)}`)
          })
        }
        void adapter.reattachKnownSessions().catch(error => {
          runtime.warn(`dsh-cron: reattach pass failed: ${message(error)}`)
        })
        return () => { sessionAttach.handler = null }
      }, 'dsh-cron: workspace attach')
    })
  })
  mountCallbacks(ctx)
  ctx.effect(() => {
    let lock = acquireSchedulerLock(dataDir, message => runtime.warn(message))
    let takeover: ReturnType<typeof setInterval> | null = null
    let reconcile: ReturnType<typeof setInterval> | null = null
    const start = (): void => {
      store.load()
      scheduler.start()
      void adapter.reattachKnownSessions().catch(error => {
        runtime.warn(`dsh-cron: reattach on start failed: ${message(error)}`)
      })
      reconcile = setInterval(() => {
        void scheduler.reconcile().catch(error => { runtime.warn(`dsh-cron: reconciliation failed: ${message(error)}`) })
      }, resolved.reconcilePollMs)
      runtime.info(`dsh-cron: scheduling ${store.list().length} job(s) through Automation`)
    }
    if (lock.acquired) start()
    else {
      takeover = setInterval(() => {
        lock = acquireSchedulerLock(dataDir, message => runtime.warn(message))
        if (!lock.acquired) return
        if (takeover !== null) clearInterval(takeover)
        takeover = null
        start()
      }, 60_000)
    }
    return () => {
      if (takeover !== null) clearInterval(takeover)
      if (reconcile !== null) clearInterval(reconcile)
      scheduler.stop()
      lock.release()
    }
  }, 'dsh-cron: scheduler')
}

function tryGet(ctx: Context, key: string): unknown {
  try {
    return ctx.get(key as never)
  } catch {
    return undefined
  }
}

function mountCallbacks(ctx: Context): void {
  ctx.inject(['callbacks'], callbacksCtx => {
    callbacksCtx.effect(() => callbacksCtx.on('cron/settled', event => {
      const callbacks = callbacksCtx.get('callbacks') as OutboundCallbacks | undefined
      if (callbacks === undefined) return
      callbacks.emit({
        source: 'cron', subject: `${event.jobId} · ${event.run.state}`,
        ...(event.run.outcome === undefined ? {} : { outcome: event.run.outcome }),
        ...(event.run.excerpt === undefined ? {} : { excerpt: event.run.excerpt }),
        jobId: event.jobId, firedAt: event.run.firedAt,
        ...(event.run.completedAt === undefined ? {} : { completedAt: event.run.completedAt }),
      })
    }), 'dsh-cron: callbacks')
  })
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

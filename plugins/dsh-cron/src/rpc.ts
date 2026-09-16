/**
 * `/cron` RPC channel: browser task center create/list/update/remove/fire-now.
 * @module dsh-cron/rpc
 *
 * On DSH 0.1.5+, `connection.rpc.handle()` never mounts routes (HTTP 405).
 * Use shared `registerRpcChannel` with `webServer` inject — see `_shared/UPGRADE.md`.
 */

import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-client-connection'
import { registerRpcChannel, ok, transportError } from '../../_shared/register-rpc-channel.js'
import type { CronService } from './scheduler.ts'
import { targetFromPayload } from './target.ts'

export const CRON_RPC_CHANNEL = '/cron'

function payloadId(payload: unknown): string {
  const id = (payload as { id?: unknown } | undefined)?.id
  if (typeof id !== 'string' || id.trim().length === 0) throw new Error('dsh-cron RPC: payload.id must be a non-blank string')
  return id.trim()
}

function payloadText(payload: unknown, key: string): string | undefined {
  const value = (payload as Record<string, unknown> | undefined)?.[key]
  if (value === undefined) return undefined
  if (typeof value !== 'string') throw new Error(`dsh-cron RPC: payload.${key} must be a string`)
  return value
}

function payloadOptionalId(payload: unknown, key: string): string | undefined {
  const value = payloadText(payload, key)
  if (value === undefined) return undefined
  if (value.trim().length === 0) throw new Error(`dsh-cron RPC: payload.${key} must be a non-blank string`)
  return value.trim()
}

/**
 * Register the `/cron` channel handlers.
 * @param ctx - context carrying `connection` + `webServer`.
 * @param service - the scheduler's service view.
 * @returns the channel disposer.
 */
export function registerCronRpc(ctx: Context, service: CronService): () => void {
  return registerRpcChannel(ctx, CRON_RPC_CHANNEL, async (endpoint, payload, _signal) => {
    try {
      switch (endpoint) {
        case 'list': return ok({ jobs: service.list(), generatedAt: Date.now() })
        case 'add': {
          const cron = payloadText(payload, 'cron')
          const timeZone = payloadText(payload, 'timeZone')
          const at = payloadText(payload, 'at')
          const createdBy = payloadOptionalId(payload, 'createdBy')
          const target = targetFromPayload(payload)
          return ok(service.add({
            prompt: payloadText(payload, 'prompt') ?? '',
            ...(cron === undefined ? {} : { cron }),
            ...(timeZone === undefined ? {} : { timeZone }),
            ...(at === undefined ? {} : { at }),
            ...(createdBy === undefined ? {} : { createdBy }),
            ...(target === undefined ? {} : { target }),
          }))
        }
        case 'edit': {
          const id = payloadId(payload)
          const cron = payloadText(payload, 'cron')
          const timeZone = payloadText(payload, 'timeZone')
          const at = payloadText(payload, 'at')
          const target = targetFromPayload(payload)
          return ok(service.edit(id, {
            prompt: payloadText(payload, 'prompt') ?? '',
            ...(cron === undefined ? {} : { cron }),
            ...(timeZone === undefined ? {} : { timeZone }),
            ...(at === undefined ? {} : { at }),
            ...(target === undefined ? {} : { target }),
          }))
        }
        case 'remove': return ok({ id: payloadId(payload), removed: service.remove(payloadId(payload)) })
        case 'update': {
          const paused = (payload as { paused?: unknown } | undefined)?.paused
          if (typeof paused !== 'boolean') throw new Error('dsh-cron RPC: payload.paused must be a boolean')
          const id = payloadId(payload)
          return ok({ id, paused, updated: service.setPaused(id, paused) })
        }
        case 'fire': {
          const id = payloadId(payload)
          return ok({ id, result: await service.fireNow(id) })
        }
        default: return transportError(new Error(`dsh-cron RPC unknown endpoint: ${endpoint}`))
      }
    } catch (error) {
      return transportError(error)
    }
  })
}

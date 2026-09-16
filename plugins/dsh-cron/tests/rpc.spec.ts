import { describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { registerCronRpc } from '../src/rpc.ts'
import type { CronService } from '../src/scheduler.ts'

type Handler = (endpoint: string, payload: unknown, signal: AbortSignal) => Promise<unknown>

vi.mock('../../_shared/register-rpc-channel.js', () => {
  return {
    registerRpcChannel: (_ctx: unknown, _channel: string, handler: Handler) => {
      ;(globalThis as { __cronRpcHandler?: Handler }).__cronRpcHandler = handler
      const dispose = vi.fn()
      ;(globalThis as { __cronRpcDispose?: ReturnType<typeof vi.fn> }).__cronRpcDispose = dispose
      return dispose
    },
    ok: <T>(value: T) => ({ ok: true as const, value }),
    transportError: (error: unknown) => ({
      ok: false as const,
      error: {
        code: 'internal',
        message: error instanceof Error ? error.message : String(error),
        details: {},
      },
    }),
  }
})

function makeHarness(service: Partial<CronService>) {
  const ctx = new Context()
  ctx.provide('connection', { rpc: {}, requestRejection: () => undefined })
  ctx.provide('webServer', { register: () => () => {} })
  const disposer = registerCronRpc(ctx, service as CronService)
  const captured = (globalThis as { __cronRpcHandler?: Handler }).__cronRpcHandler
  const disposeChannel = (globalThis as { __cronRpcDispose?: ReturnType<typeof vi.fn> }).__cronRpcDispose
  return { captured: captured as Handler, disposer, disposeChannel: disposeChannel! }
}

describe('registerCronRpc', () => {
  it('lists jobs through the channel', async () => {
    const jobs = [{ id: 'cron-1' }]
    const { captured } = makeHarness({ list: () => jobs as never })
    const result = await captured('list', {}, new AbortController().signal) as { ok: boolean; value: { jobs: unknown[] } }
    expect(result.ok).toBe(true)
    expect(result.value.jobs).toEqual(jobs)
  })

  it('adds recurring and one-shot jobs through scheduler validation', async () => {
    const add = vi.fn().mockReturnValue({ job: { id: 'cron-3' }, deduplicated: false, nextOccurrences: [] })
    const { captured } = makeHarness({ add })
    const recurring = await captured('add', {
      prompt: 'prepare standup',
      cron: '0 9 * * 1-5',
      timeZone: 'Asia/Shanghai',
      createdBy: 'session-1',
    }, new AbortController().signal) as { ok: boolean; value: { job: { id: string } } }
    expect(recurring.value.job.id).toBe('cron-3')
    expect(add).toHaveBeenCalledWith({
      prompt: 'prepare standup',
      cron: '0 9 * * 1-5',
      timeZone: 'Asia/Shanghai',
      createdBy: 'session-1',
    })

    await captured('add', {
      prompt: 'ship release',
      at: '2026-09-01T01:00:00.000Z',
    }, new AbortController().signal)
    expect(add).toHaveBeenLastCalledWith({
      prompt: 'ship release',
      at: '2026-09-01T01:00:00.000Z',
    })
  })

  it('edits an existing job by id', async () => {
    const edit = vi.fn().mockReturnValue({ job: { id: 'cron-1', prompt: 'updated' }, deduplicated: false, nextOccurrences: [] })
    const { captured } = makeHarness({ edit })
    const result = await captured('edit', {
      id: 'cron-1',
      prompt: 'updated',
      cron: '0 10 * * *',
      timeZone: 'UTC',
      cwd: '/workspace/test',
    }, new AbortController().signal) as { ok: boolean; value: { job: { id: string } } }
    expect(result.ok).toBe(true)
    expect(result.value.job.id).toBe('cron-1')
    expect(edit).toHaveBeenCalledWith('cron-1', expect.objectContaining({
      prompt: 'updated',
      cron: '0 10 * * *',
      timeZone: 'UTC',
    }))
  })

  it('removes and fires by payload id', async () => {
    const remove = vi.fn().mockReturnValue(true)
    const fireNow = vi.fn().mockResolvedValue('fired')
    const { captured } = makeHarness({ remove, fireNow })
    const removed = await captured('remove', { id: 'cron-2' }, new AbortController().signal) as { ok: boolean; value: { removed: boolean } }
    expect(removed.value).toEqual({ id: 'cron-2', removed: true })
    const fired = await captured('fire', { id: ' cron-2 ' }, new AbortController().signal) as { ok: boolean; value: { result: string } }
    expect(fired.value.result).toBe('fired')
    expect(fireNow).toHaveBeenCalledWith('cron-2')
  })

  it('rejects unknown endpoints and blank ids with transport errors', async () => {
    const { captured } = makeHarness({})
    const unknown = await captured('bogus', {}, new AbortController().signal) as { ok: boolean; error: { message: string } }
    expect(unknown.ok).toBe(false)
    expect(unknown.error.message).toContain('unknown endpoint')
    const blank = await captured('remove', { id: '  ' }, new AbortController().signal) as { ok: boolean; error: { message: string } }
    expect(blank.ok).toBe(false)
    const malformedAdd = await captured('add', { prompt: 42 }, new AbortController().signal) as { ok: boolean; error: { message: string } }
    expect(malformedAdd.ok).toBe(false)
  })

  it('returns the dispose from registerRpcChannel', () => {
    const { disposer, disposeChannel } = makeHarness({ list: () => [] as never })
    disposer()
    expect(disposeChannel).toHaveBeenCalled()
  })
})

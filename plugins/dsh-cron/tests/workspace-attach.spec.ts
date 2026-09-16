import { describe, expect, it } from 'vitest'
import { cronSessionTitle } from '../src/workspace-attach.ts'
import type { CronJob } from '../src/store.ts'

function job(prompt: string): CronJob {
  return {
    id: 'cron-1',
    prompt,
    schedule: { kind: 'at', at: '2026-09-15T00:45:00.000Z' },
    createdBy: null,
    target: { kind: 'fresh', cwd: '/workspace/Test env' },
    concurrencyLimit: 1,
    createdAt: '2026-09-15T00:41:00.000Z',
    nextAt: '2026-09-15T00:45:00.000Z',
    lastFiredAt: null,
    fireCount: 0,
    state: 'active',
    paused: false,
    lastRun: null,
    runs: [],
  }
}

describe('cronSessionTitle', () => {
  it('uses the prompt when short', () => {
    expect(cronSessionTitle(job('build a reaction test'))).toBe('build a reaction test')
  })

  it('truncates long prompts', () => {
    const title = cronSessionTitle(job('x'.repeat(80)))
    expect(title.endsWith('…')).toBe(true)
    expect(title.length).toBeLessThanOrEqual(52)
  })

  it('falls back to job id when prompt is blank', () => {
    expect(cronSessionTitle(job('   '))).toBe('Scheduled cron-1')
  })
})

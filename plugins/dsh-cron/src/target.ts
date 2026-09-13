/** Fresh Automation target extraction at job-creation boundaries. */

import { isAbsolute } from 'node:path'
import type { AutomationTarget } from './automation.ts'

export function targetFromAgent(agent: unknown): AutomationTarget {
  const cwd = nestedString(agent, ['session', 'meta', 'cwd']) ?? nestedString(agent, ['session', 'context', 'cwd'])
  if (cwd === undefined || !isAbsolute(cwd)) {
    throw new Error('missing_target: creating Agent does not expose an absolute Session cwd')
  }
  return { kind: 'fresh', cwd }
}

export function targetFromPayload(payload: unknown): AutomationTarget | undefined {
  if (typeof payload !== 'object' || payload === null) return undefined
  const record = payload as Record<string, unknown>
  const cwd = record['cwd']
  if (cwd === undefined) return undefined
  if (typeof cwd !== 'string' || !isAbsolute(cwd)) throw new Error('dsh-cron RPC: payload.cwd must be an absolute path')

  const provider = record['provider']
  const model = record['model']
  if (provider === undefined && model === undefined) {
    return { kind: 'fresh', cwd }
  }
  if (typeof provider !== 'string' || provider.trim().length === 0) {
    throw new Error('dsh-cron RPC: payload.provider must be a non-blank string when model is set')
  }
  if (typeof model !== 'string' || model.trim().length === 0) {
    throw new Error('dsh-cron RPC: payload.model must be a non-blank string when provider is set')
  }
  return { kind: 'fresh', cwd, provider: provider.trim(), model: model.trim() }
}

function nestedString(value: unknown, path: readonly string[]): string | undefined {
  let current = value
  for (const key of path) {
    if (typeof current !== 'object' || current === null) return undefined
    current = (current as Record<string, unknown>)[key]
  }
  return typeof current === 'string' && current !== '' ? current : undefined
}

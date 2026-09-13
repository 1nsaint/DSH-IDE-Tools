import { describe, expect, it } from 'vitest'
import { targetFromPayload } from '../src/target.ts'

describe('targetFromPayload', () => {
  it('returns undefined when cwd is omitted', () => {
    expect(targetFromPayload({ prompt: 'x' })).toBeUndefined()
  })

  it('accepts cwd alone', () => {
    expect(targetFromPayload({ cwd: '/workspace/Projects' })).toEqual({
      kind: 'fresh',
      cwd: '/workspace/Projects',
    })
  })

  it('accepts cwd with provider and model', () => {
    expect(targetFromPayload({
      cwd: '/workspace/Test',
      provider: 'openai',
      model: 'qwen36a3b',
    })).toEqual({
      kind: 'fresh',
      cwd: '/workspace/Test',
      provider: 'openai',
      model: 'qwen36a3b',
    })
  })

  it('rejects provider without model', () => {
    expect(() => targetFromPayload({ cwd: '/workspace', provider: 'openai' })).toThrow(/model/)
  })

  it('rejects relative cwd', () => {
    expect(() => targetFromPayload({ cwd: 'relative' })).toThrow(/absolute/)
  })
})

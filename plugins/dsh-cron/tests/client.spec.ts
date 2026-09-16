import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'

const clientMocks = vi.hoisted(() => ({
  effects: [] as Array<() => void | (() => void)>,
  states: [] as Array<unknown>,
  callRpc: vi.fn(),
}))

vi.mock('react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react')>()
  return {
    ...actual,
    useCallback: (callback: unknown) => callback,
    useEffect: (effect: () => void | (() => void)) => { clientMocks.effects.push(effect) },
    useId: () => 'test-id',
    useMemo: (factory: () => unknown) => factory(),
    useState: (initial: unknown) => {
      clientMocks.states.push(initial)
      return [initial, vi.fn()]
    },
    useRef: (initial: unknown) => ({ current: initial }),
  }
})

vi.mock('../src/client/rpc.ts', () => ({ callRpc: clientMocks.callRpc }))

import { CronScheduleView, formatDateTime } from '../src/client/CronPanel.tsx'
import { apply, CRON_HERO_TOOL_ID, CRON_TAB_LABEL } from '../src/client/index.ts'

describe('CronScheduleView', () => {
  beforeEach(() => {
    clientMocks.effects.length = 0
    clientMocks.states.length = 0
    clientMocks.callRpc.mockReset()
  })

  it('leaves an invalid wire timestamp visible instead of throwing', () => {
    expect(formatDateTime('not-a-timestamp')).toBe('not-a-timestamp')
  })

  it('polls the list endpoint while the view is mounted', async () => {
    clientMocks.callRpc.mockResolvedValue({ jobs: [], generatedAt: 1 })
    const connection = {} as ConnectionHandle

    CronScheduleView({
      connection,
      t: (key: string) => key,
      useSessions: selector => selector({ current: undefined } as never),
      useWorkspaces: selector => selector({ items: [] } as never),
    })
    const cleanups = clientMocks.effects.map(effect => effect?.())
    expect(clientMocks.callRpc).toHaveBeenCalledWith(connection, 'list', {}, expect.any(AbortSignal))
    const pollCleanup = cleanups.find(cleanup => typeof cleanup === 'function')
    expect(typeof pollCleanup).toBe('function')
    pollCleanup?.()
  })

  it('registers workbench tab + hero tool on apply', () => {
    const registered: unknown[] = []
    const injected: Array<readonly unknown[]> = []
    const heroRegistered: Array<readonly unknown[]> = []
    const connection = {}
    const priorWindow = globalThis.window
    vi.stubGlobal('window', {
      __dshHeroToolRegistry: {
        _map: new Map(),
        register(id: string, factory: () => unknown) {
          heroRegistered.push([id, factory])
          return () => {}
        },
        get: () => undefined,
      },
    })
    const ctx = {
      get: (name: string) => (name === 'connection' ? connection : undefined),
      effect: (fn: () => unknown) => { fn() },
      locale: {
        register: vi.fn(() => () => {}),
      },
      slots: {
        inject: (name: string, factory: () => unknown) => {
          const disposer = factory()
          injected.push([name, disposer])
        },
        register: (options: unknown, component: unknown) => {
          registered.push([options, component])
          return () => {}
        },
      },
    }
    apply(ctx as never)
    expect(ctx.locale.register).toHaveBeenCalledWith('sidebar.cron', {
      zh: expect.any(Object),
      en: expect.any(Object),
    })
    expect(injected).toHaveLength(1)
    expect(injected[0]?.[0]).toBe('conversation.view')
    const tabRegistration = registered[0] as [{ name: string; id: string; locale: string; label: () => string }, unknown]
    expect(tabRegistration[0].name).toBe('conversation.view')
    expect(tabRegistration[0].id).toBe(CRON_HERO_TOOL_ID)
    expect(tabRegistration[0].locale).toBe('sidebar.cron')
    expect(tabRegistration[0].label()).toBe(CRON_TAB_LABEL)
    expect(heroRegistered).toHaveLength(1)
    expect(heroRegistered[0]?.[0]).toBe(CRON_HERO_TOOL_ID)
    vi.stubGlobal('window', priorWindow)
  })
})

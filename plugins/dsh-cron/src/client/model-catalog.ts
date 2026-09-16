/**
 * Upgrade-safe model catalog for the cron UI.
 *
 * DSH 0.1.5 removed `connection.api.llm.models` (`/api/llm.models` → 404).
 * Stock catalog is `session/modelCatalog` via the typpert gateway:
 *   POST /api/session/modelCatalog  payload: { args: {} }
 *
 * Prefer the HTTP shape over Cordis `remote.session` inject — hard-injecting
 * `remote` fails with "cannot get property remote.session without inject".
 * @module
 */

type ModelGroup = {
  readonly id: string
  readonly name: string
  readonly models?: ReadonlyArray<{ readonly id: string; readonly name?: string }>
}

/** Returns provider/model groups, or null when the API is unavailable. */
export async function fetchCronModelGroups(signal?: AbortSignal): Promise<ReadonlyArray<ModelGroup> | null> {
  try {
    const rpcId = `dsh-cron-models-${Math.random().toString(36).slice(2, 10)}`
    const response = await fetch('/api/session/modelCatalog', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      credentials: 'include',
      ...(signal === undefined ? {} : { signal }),
      body: JSON.stringify({
        type: 'client-request',
        rpcId,
        method: 'session/modelCatalog',
        payload: { args: {} },
      }),
    })
    if (!response.ok) return null
    const data = await response.json() as {
      result?: {
        ok?: boolean
        value?: { groups?: ReadonlyArray<ModelGroup> }
      }
    }
    if (!data?.result?.ok) return null
    return data.result.value?.groups ?? []
  } catch {
    return null
  }
}

/** @deprecated no-op kept for apply() callers during transition */
export function bindCronModelCatalog(_remote: unknown): void {}
/** @deprecated no-op kept for apply() callers during transition */
export function unbindCronModelCatalog(): void {}

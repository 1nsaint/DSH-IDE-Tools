import type { Context } from '@deepseek-ai/cordis'

export type RpcHandler = (
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
) => Promise<unknown>

export function registerRpcChannel(
  ctx: Context,
  channel: string,
  handler: RpcHandler,
): () => void

export function ok<T>(value: T): { readonly ok: true; readonly value: T }

export function transportError(error: unknown): {
  readonly ok: false
  readonly error: {
    readonly code: string
    readonly message: string
    readonly details: Record<string, unknown>
  }
}

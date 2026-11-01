/**
 * Client RPC helpers for the `/cron` channel.
 * @module
 */
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client';
export declare const CRON_RPC_CHANNEL = "/cron";
/** Call one `/cron` endpoint; non-ok results throw with the error message. */
export declare function callRpc<T = unknown>(connection: ConnectionHandle, endpoint: string, payload?: unknown, signal?: AbortSignal): Promise<T>;
//# sourceMappingURL=rpc.d.ts.map
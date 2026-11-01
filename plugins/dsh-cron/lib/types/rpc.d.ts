/**
 * `/cron` RPC channel: browser task center create/list/update/remove/fire-now.
 * @module dsh-cron/rpc
 *
 * On DSH 0.1.5+, `connection.rpc.handle()` never mounts routes (HTTP 405).
 * Use shared `registerRpcChannel` with `webServer` inject — see `_shared/UPGRADE.md`.
 */
import type { Context } from '@deepseek-ai/cordis';
import type { CronService } from './scheduler.ts';
export declare const CRON_RPC_CHANNEL = "/cron";
/**
 * Register the `/cron` channel handlers.
 * @param ctx - context carrying `connection` + `webServer`.
 * @param service - the scheduler's service view.
 * @returns the channel disposer.
 */
export declare function registerCronRpc(ctx: Context, service: CronService): () => void;
//# sourceMappingURL=rpc.d.ts.map
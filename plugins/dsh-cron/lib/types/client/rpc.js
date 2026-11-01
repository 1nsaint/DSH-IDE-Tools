/**
 * Client RPC helpers for the `/cron` channel.
 * @module
 */
export const CRON_RPC_CHANNEL = '/cron';
/** Call one `/cron` endpoint; non-ok results throw with the error message. */
export async function callRpc(connection, endpoint, payload, signal) {
    // The mux transport rejects requests without a message body, so always
    // send at least an empty object.
    const result = await connection.rpc.call(CRON_RPC_CHANNEL, endpoint, payload ?? {}, signal);
    if (!result.ok)
        throw new Error(`dsh-cron RPC ${endpoint} failed: ${result.error.message}`);
    return result.value;
}
//# sourceMappingURL=rpc.js.map
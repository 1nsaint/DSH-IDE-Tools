/**
 * Register a Cordis Connection-style unary RPC channel on 0.1.5+.
 *
 * Stock `connection.rpc.handle()` registers via the connection plugin's own
 * context, which does not inject `webServer` — Cordis then throws
 * `cannot get property "webServer" without inject`. Registering from the
 * calling plugin (which must `inject: ["connection", "webServer"]`) works.
 */
import { randomUUID } from "node:crypto";

/**
 * @param {import("@deepseek-ai/cordis").Context} ctx
 * @param {string} channel e.g. "/hero-tools"
 * @param {(endpoint: string, payload: unknown, signal: AbortSignal) => Promise<{ ok: boolean, value?: unknown, error?: unknown }>} handler
 */
export function registerRpcChannel(ctx, channel, handler) {
	if (typeof channel !== "string" || !channel.startsWith("/") || channel === "/api") {
		throw new Error(`registerRpcChannel: invalid channel ${JSON.stringify(channel)}`);
	}

	return ctx.webServer.register({
		kind: "prefix",
		path: channel,
		handler: async (req, res) => {
			const rejection = ctx.connection.requestRejection(req);
			if (rejection !== undefined) {
				res.writeHead(rejection);
				res.end(rejection === 401 ? "unauthorized" : "forbidden");
				return;
			}

			if (req.method !== "POST") {
				res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
				res.end("not found");
				return;
			}

			const url = new URL(req.url || "/", "http://dsh.invalid");
			const endpoint = endpointFromPath(channel, url.pathname);
			if (endpoint === undefined) {
				res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
				res.end("not found");
				return;
			}

			const ctype = String(req.headers["content-type"] || "")
				.split(";", 1)[0]
				.trim()
				.toLowerCase();
			if (ctype !== "application/json") {
				res.writeHead(415, { "content-type": "text/plain; charset=utf-8" });
				res.end("content type must be application/json");
				return;
			}

			let raw;
			try {
				raw = await readBody(req);
			} catch {
				res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
				res.end("body too large or unreadable");
				return;
			}

			let body;
			try {
				body = JSON.parse(raw || "null");
			} catch {
				res.writeHead(400, { "content-type": "text/plain; charset=utf-8" });
				res.end("body is not JSON");
				return;
			}

			if (!isRecord(body) || body.type !== "client-request" || typeof body.rpcId !== "string" || typeof body.method !== "string") {
				sendJson(res, {
					type: "server-response",
					rpcId: typeof body?.rpcId === "string" ? body.rpcId : "invalid-request",
					result: {
						ok: false,
						error: {
							code: "gateway/bad-request",
							message: "invalid client-request message",
							details: { issues: [] },
						},
					},
				});
				return;
			}

			if (body.method !== endpoint) {
				sendJson(res, {
					type: "server-response",
					rpcId: body.rpcId,
					result: {
						ok: false,
						error: {
							code: "gateway/bad-request",
							message: `method ${JSON.stringify(body.method)} does not match endpoint ${JSON.stringify(endpoint)}`,
							details: { issues: [] },
						},
					},
				});
				return;
			}

			const abort = new AbortController();
			res.on("close", () => {
				if (!res.writableEnded) abort.abort();
			});

			try {
				const result = await handler(endpoint, body.payload, abort.signal);
				sendJson(res, {
					type: "server-response",
					rpcId: body.rpcId,
					result,
				});
			} catch (error) {
				res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
				res.end(`handler failure: ${String(error)}`);
			}
		},
	});
}

function endpointFromPath(channel, pathname) {
	if (!pathname.startsWith(`${channel}/`)) return undefined;
	const endpoint = pathname.slice(channel.length + 1);
	if (!endpoint || endpoint.split("/").some((s) => !s || s === "." || s === "..")) return undefined;
	if (!/^[A-Za-z0-9_$./-]+$/.test(endpoint)) return undefined;
	return endpoint;
}

function isRecord(value) {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readBody(req, limit = 32 * 1024 * 1024) {
	return new Promise((resolve, reject) => {
		const chunks = [];
		let n = 0;
		req.on("data", (c) => {
			n += c.length;
			if (n > limit) {
				reject(new Error("too large"));
				req.destroy();
				return;
			}
			chunks.push(c);
		});
		req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
		req.on("error", reject);
	});
}

function sendJson(res, body) {
	const buf = Buffer.from(JSON.stringify(body), "utf8");
	res.writeHead(200, {
		"content-type": "application/json; charset=utf-8",
		"content-length": buf.length,
	});
	res.end(buf);
}

export function ok(value) {
	return { ok: true, value };
}

export function transportError(error) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error),
			details: {},
		},
	};
}

// silence unused in case tree-shaken consumers
void randomUUID;

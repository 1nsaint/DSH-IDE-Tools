/**
 * dsh-database — host half: Postgres, MySQL/MariaDB, Redis, Chroma.
 * Connection URLs (+ optional engine) come per-request from the client.
 * Reachability = whatever the harness container can open on its networks.
 * Named DB clones = dedicated postgres containers (portable).
 */
import pg from "pg";
import mysql from "mysql2/promise";
import Redis from "ioredis";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";

const name = "dsh-database";
const RPC_CHANNEL = "/database";
const { Client: PgClient } = pg;
const execFileAsync = promisify(execFile);

const ENGINES = new Set(["postgres", "mysql", "redis", "chroma"]);
const CLONE_IMAGE = process.env.DSH_DB_CLONE_IMAGE || "postgis/postgis:16-3.4-alpine";
const CLONE_PORT_BASE = Number(process.env.DSH_DB_CLONE_PORT_BASE || 15432);

function ok(value) {
	return { ok: true, value };
}

function transportError(error) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error),
			details: {},
		},
	};
}

function requireUrl(payload) {
	const url = typeof payload?.url === "string" ? payload.url.trim() : "";
	if (!url) throw new Error("connection url required");
	return url;
}

function detectEngine(payload) {
	const raw = typeof payload?.engine === "string" ? payload.engine.trim().toLowerCase() : "";
	if (raw && ENGINES.has(raw)) return raw;
	const url = requireUrl(payload);
	if (/^postgres(ql)?:\/\//i.test(url)) return "postgres";
	if (/^(mysql|mariadb):\/\//i.test(url)) return "mysql";
	if (/^rediss?:\/\//i.test(url)) return "redis";
	if (/^chroma:\/\//i.test(url)) return "chroma";
	if (/^https?:\/\//i.test(url)) {
		throw new Error("http(s) URLs need engine=chroma (or use chroma://host:port)");
	}
	throw new Error("unsupported url — use postgres://, mysql://, redis://, or chroma:// / http + engine");
}

function chromaBase(url) {
	let u = url.trim();
	if (/^chroma:\/\//i.test(u)) u = "http://" + u.slice("chroma://".length);
	return u.replace(/\/+$/, "");
}

async function withPg(url, fn) {
	const client = new PgClient({
		connectionString: url,
		connectionTimeoutMillis: 8000,
		query_timeout: 30000,
		statement_timeout: 30000,
	});
	await client.connect();
	try {
		return await fn(client);
	} finally {
		await client.end().catch(() => {});
	}
}

async function withMysql(url, fn) {
	const conn = await mysql.createConnection({
		uri: url.replace(/^mariadb:/i, "mysql:"),
		connectTimeout: 8000,
	});
	try {
		return await fn(conn);
	} finally {
		await conn.end().catch(() => {});
	}
}

async function withRedis(url, fn) {
	const client = new Redis(url, {
		connectTimeout: 8000,
		lazyConnect: true,
		maxRetriesPerRequest: 1,
		enableOfflineQueue: false,
	});
	try {
		await client.connect();
		return await fn(client);
	} finally {
		client.disconnect();
	}
}

async function chromaFetch(base, path, opts = {}) {
	const res = await fetch(`${base}${path}`, {
		...opts,
		signal: AbortSignal.timeout(15000),
		headers: {
			"content-type": "application/json",
			...(opts.headers || {}),
		},
	});
	const text = await res.text();
	let body = null;
	try {
		body = text ? JSON.parse(text) : null;
	} catch {
		body = text;
	}
	if (!res.ok) {
		const msg = typeof body === "object" && body?.error ? JSON.stringify(body.error) : text || res.statusText;
		throw new Error(`chroma ${res.status}: ${msg}`);
	}
	return body;
}

async function chromaCollections(base) {
	try {
		const v2 = await chromaFetch(base, "/api/v2/tenants/default_tenant/databases/default_database/collections");
		if (Array.isArray(v2)) {
			return v2.map((c) => c.name || c.id).filter(Boolean);
		}
	} catch {
		/* fall through to v1 */
	}
	const v1 = await chromaFetch(base, "/api/v1/collections");
	if (!Array.isArray(v1)) return [];
	return v1.map((c) => c.name || c.id).filter(Boolean);
}

async function chromaPeek(base, collection, limit) {
	const n = Math.min(Math.max(Number(limit) || 20, 1), 200);
	const paths = [
		`/api/v2/tenants/default_tenant/databases/default_database/collections/${encodeURIComponent(collection)}/get`,
		`/api/v1/collections/${encodeURIComponent(collection)}/get`,
	];
	const body = JSON.stringify({ limit: n, include: ["documents", "metadatas", "embeddings"] });
	let lastErr;
	for (const path of paths) {
		try {
			const data = await chromaFetch(base, path, { method: "POST", body });
			const ids = data?.ids || [];
			const docs = data?.documents || [];
			const metas = data?.metadatas || [];
			const rows = ids.map((id, i) => ({
				id,
				document: docs[i] ?? null,
				metadata: metas[i] != null ? JSON.stringify(metas[i]) : null,
			}));
			return {
				fields: ["id", "document", "metadata"],
				rows,
				rowCount: rows.length,
				command: "PEEK",
			};
		} catch (err) {
			lastErr = err;
		}
	}
	throw lastErr || new Error("chroma peek failed");
}

async function handlePostgres(endpoint, payload) {
	const url = requireUrl(payload);
	switch (endpoint) {
		case "ping": {
			const result = await withPg(url, async (client) => {
				const r = await client.query(
					"select current_database() as db, current_user as user, version() as version"
				);
				return r.rows[0];
			});
			return ok({ ok: true, engine: "postgres", ...result });
		}
		case "schemas": {
			const rows = await withPg(url, async (client) => {
				const r = await client.query(`
          select schema_name
          from information_schema.schemata
          where schema_name not in ('pg_catalog', 'information_schema', 'pg_toast')
          order by schema_name
        `);
				return r.rows.map((row) => row.schema_name);
			});
			return ok({ schemas: rows, engine: "postgres" });
		}
		case "tables": {
			const schema = typeof payload?.schema === "string" && payload.schema ? payload.schema : "public";
			const rows = await withPg(url, async (client) => {
				const r = await client.query(
					`
          select table_name
          from information_schema.tables
          where table_schema = $1 and table_type = 'BASE TABLE'
          order by table_name
        `,
					[schema]
				);
				return r.rows.map((row) => row.table_name);
			});
			return ok({ schema, tables: rows, engine: "postgres" });
		}
		case "query": {
			const sql = typeof payload?.sql === "string" ? payload.sql.trim() : "";
			if (!sql) throw new Error("sql required");
			const limit = Math.min(Math.max(Number(payload?.limit) || 200, 1), 2000);
			const offset = Math.max(Number(payload?.offset) || 0, 0);
			const result = await withPg(url, async (client) => {
				const isRead = /^\s*(select|with|show|explain)\b/i.test(sql);
				const wrapped = isRead
					? `select * from (${sql.replace(/;\s*$/, "")}) as _dsh_q limit ${limit} offset ${offset}`
					: sql;
				const r = await client.query(wrapped);
				const rows = r.rows || [];
				return {
					fields: (r.fields || []).map((f) => f.name),
					rows,
					rowCount: r.rowCount,
					command: r.command,
					limit: isRead ? limit : null,
					offset: isRead ? offset : 0,
					hasMore: isRead && rows.length >= limit,
				};
			});
			return ok({ ...result, engine: "postgres" });
		}
		case "primaryKeys": {
			const schema = typeof payload?.schema === "string" && payload.schema ? payload.schema : "public";
			const table = typeof payload?.table === "string" ? payload.table.trim() : "";
			if (!table) throw new Error("table required");
			const keys = await withPg(url, async (client) => {
				const r = await client.query(
					`
          select kcu.column_name as name
          from information_schema.table_constraints tc
          join information_schema.key_column_usage kcu
            on tc.constraint_name = kcu.constraint_name
           and tc.table_schema = kcu.table_schema
           and tc.table_name = kcu.table_name
          where tc.constraint_type = 'PRIMARY KEY'
            and tc.table_schema = $1
            and tc.table_name = $2
          order by kcu.ordinal_position
        `,
					[schema, table],
				);
				return r.rows.map((row) => row.name);
			});
			return ok({ schema, table, keys, engine: "postgres" });
		}
		case "updateRow": {
			const schema = typeof payload?.schema === "string" && payload.schema ? payload.schema : "public";
			const table = typeof payload?.table === "string" ? payload.table.trim() : "";
			const keys = Array.isArray(payload?.keys) ? payload.keys.map(String) : [];
			const keyValues = payload?.keyValues && typeof payload.keyValues === "object" ? payload.keyValues : null;
			const changes = payload?.changes && typeof payload.changes === "object" ? payload.changes : null;
			if (!table) throw new Error("table required");
			if (!keys.length) throw new Error("primary key required to update a row");
			if (!keyValues || !changes || !Object.keys(changes).length) throw new Error("keyValues and changes required");
			for (const k of keys) {
				if (!(k in keyValues)) throw new Error(`missing primary key value for ${k}`);
			}
			const setCols = Object.keys(changes).filter((c) => !keys.includes(c));
			if (!setCols.length) throw new Error("no editable changes");
			const fq = `"${schema.replace(/"/g, '""')}"."${table.replace(/"/g, '""')}"`;
			const setSql = setCols.map((c, i) => `"${String(c).replace(/"/g, '""')}" = $${i + 1}`).join(", ");
			const whereSql = keys
				.map((c, i) => `"${String(c).replace(/"/g, '""')}" = $${setCols.length + i + 1}`)
				.join(" and ");
			const args = [...setCols.map((c) => changes[c]), ...keys.map((c) => keyValues[c])];
			const result = await withPg(url, async (client) => {
				const r = await client.query(`update ${fq} set ${setSql} where ${whereSql}`, args);
				return { rowCount: r.rowCount };
			});
			if (!result.rowCount) throw new Error("update matched 0 rows — primary key values may have changed");
			return ok({ ...result, engine: "postgres" });
		}
		case "clone": {
			const targetUrl = typeof payload?.targetUrl === "string" ? payload.targetUrl.trim() : "";
			if (!targetUrl) throw new Error("targetUrl required");
			if (!/^postgres(ql)?:\/\//i.test(targetUrl)) {
				throw new Error("targetUrl must be a postgres:// URL");
			}
			// Logical dump/restore via node pg (no pg_dump binary required)
			const dump = await withPg(url, async (src) => {
				const tables = await src.query(`
					select table_schema, table_name
					from information_schema.tables
					where table_type = 'BASE TABLE'
					  and table_schema not in ('pg_catalog', 'information_schema', 'pg_toast')
					order by table_schema, table_name
				`);
				const out = [];
				for (const t of tables.rows) {
					if (t.table_name === "spatial_ref_sys") continue;
					const fq = `"${t.table_schema}"."${t.table_name}"`;
					const rows = await src.query(`select * from ${fq}`);
					out.push({
						schema: t.table_schema,
						table: t.table_name,
						fields: (rows.fields || []).map((f) => f.name),
						rows: rows.rows || [],
					});
				}
				return out;
			});
			const summary = await withPg(targetUrl, async (dst) => {
				let tables = 0;
				let rows = 0;
				await dst.query("begin");
				try {
					for (const t of dump) {
						if (!t.fields.length) continue;
						const fq = `"${t.schema}"."${t.table}"`;
						const spName = `sp_${tables}`;
						await dst.query(`savepoint ${spName}`);
						try {
							await dst.query(`truncate table ${fq} cascade`);
							for (const row of t.rows) {
								const cols = t.fields;
								const vals = cols.map((_, i) => `$${i + 1}`);
								const args = cols.map((c) => row[c]);
								await dst.query(
									`insert into ${fq} (${cols.map((c) => `"${c}"`).join(",")}) values (${vals.join(",")})`,
									args,
								);
								rows += 1;
							}
							await dst.query(`release savepoint ${spName}`);
							tables += 1;
						} catch (tableErr) {
							await dst.query(`rollback to savepoint ${spName}`);
							console.warn(`[dsh-database] skipping table ${fq}: ${tableErr.message}`);
						}
					}
					await dst.query("commit");
				} catch (err) {
					await dst.query("rollback");
					throw err;
				}
				return { tables, rows };
			});
			return ok({
				engine: "postgres",
				cloned: true,
				...summary,
				note: "Row copy into existing tables (truncate+insert). Schema must already exist on target (e.g. after test stack first boot).",
			});
		}
		default:
			throw new Error(`unknown endpoint: ${endpoint}`);
	}
}

async function handleMysql(endpoint, payload) {
	const url = requireUrl(payload);
	switch (endpoint) {
		case "ping": {
			const result = await withMysql(url, async (conn) => {
				const [rows] = await conn.query("select database() as db, user() as user, version() as version");
				return rows[0];
			});
			return ok({ ok: true, engine: "mysql", ...result });
		}
		case "schemas": {
			const rows = await withMysql(url, async (conn) => {
				const [r] = await conn.query(
					`select schema_name as name from information_schema.schemata
           where schema_name not in ('information_schema','mysql','performance_schema','sys')
           order by schema_name`
				);
				return r.map((row) => row.name);
			});
			return ok({ schemas: rows, engine: "mysql" });
		}
		case "tables": {
			const schema = typeof payload?.schema === "string" && payload.schema ? payload.schema : null;
			const rows = await withMysql(url, async (conn) => {
				if (schema) {
					const [r] = await conn.query(
						`select table_name as name from information_schema.tables
             where table_schema = ? and table_type = 'BASE TABLE' order by table_name`,
						[schema]
					);
					return r.map((row) => row.name);
				}
				const [r] = await conn.query("show tables");
				const key = r[0] ? Object.keys(r[0])[0] : "Tables_in_db";
				return r.map((row) => row[key]);
			});
			return ok({ schema: schema || "", tables: rows, engine: "mysql" });
		}
		case "query": {
			const sql = typeof payload?.sql === "string" ? payload.sql.trim() : "";
			if (!sql) throw new Error("sql required");
			const limit = Math.min(Math.max(Number(payload?.limit) || 200, 1), 2000);
			const offset = Math.max(Number(payload?.offset) || 0, 0);
			const result = await withMysql(url, async (conn) => {
				let q = sql.replace(/;\s*$/, "");
				const isRead = /^\s*(select|with|show|describe|explain)\b/i.test(q);
				if (isRead && (/^\s*select\b/i.test(q) || /^\s*with\b/i.test(q))) {
					// Strip a trailing limit/offset so we can page from the client.
					q = q.replace(/\s+limit\s+\d+(\s+offset\s+\d+)?\s*$/i, "");
					q = `${q} limit ${limit} offset ${offset}`;
				}
				const [rows, fields] = await conn.query(q);
				if (Array.isArray(rows)) {
					const cols =
						fields && Array.isArray(fields)
							? fields.map((f) => f.name)
							: rows[0]
								? Object.keys(rows[0])
								: [];
					const mapped = rows.map((row) => {
						const out = {};
						for (const k of cols) {
							const v = row[k];
							out[k] = Buffer.isBuffer(v) ? v.toString("utf8") : v;
						}
						return out;
					});
					return {
						fields: cols,
						rows: mapped,
						rowCount: mapped.length,
						command: "QUERY",
						limit: isRead ? limit : null,
						offset: isRead ? offset : 0,
						hasMore: isRead && mapped.length >= limit,
					};
				}
				return {
					fields: ["affectedRows", "insertId", "warningStatus"],
					rows: [{ affectedRows: rows.affectedRows, insertId: rows.insertId, warningStatus: rows.warningStatus }],
					rowCount: 1,
					command: "OK",
					hasMore: false,
				};
			});
			return ok({ ...result, engine: "mysql" });
		}
		case "primaryKeys": {
			const schema = typeof payload?.schema === "string" && payload.schema ? payload.schema : null;
			const table = typeof payload?.table === "string" ? payload.table.trim() : "";
			if (!table) throw new Error("table required");
			const keys = await withMysql(url, async (conn) => {
				const db = schema || (await conn.query("select database() as db"))[0][0]?.db;
				if (!db) return [];
				const [r] = await conn.query(
					`select column_name as name
           from information_schema.key_column_usage
           where table_schema = ? and table_name = ? and constraint_name = 'PRIMARY'
           order by ordinal_position`,
					[db, table],
				);
				return r.map((row) => row.name);
			});
			return ok({ schema: schema || "", table, keys, engine: "mysql" });
		}
		case "updateRow": {
			const schema = typeof payload?.schema === "string" && payload.schema ? payload.schema : null;
			const table = typeof payload?.table === "string" ? payload.table.trim() : "";
			const keys = Array.isArray(payload?.keys) ? payload.keys.map(String) : [];
			const keyValues = payload?.keyValues && typeof payload.keyValues === "object" ? payload.keyValues : null;
			const changes = payload?.changes && typeof payload.changes === "object" ? payload.changes : null;
			if (!table) throw new Error("table required");
			if (!keys.length) throw new Error("primary key required to update a row");
			if (!keyValues || !changes || !Object.keys(changes).length) throw new Error("keyValues and changes required");
			for (const k of keys) {
				if (!(k in keyValues)) throw new Error(`missing primary key value for ${k}`);
			}
			const setCols = Object.keys(changes).filter((c) => !keys.includes(c));
			if (!setCols.length) throw new Error("no editable changes");
			const fq = schema
				? `\`${String(schema).replace(/`/g, "``")}\`.\`${table.replace(/`/g, "``")}\``
				: `\`${table.replace(/`/g, "``")}\``;
			const setSql = setCols.map((c) => `\`${String(c).replace(/`/g, "``")}\` = ?`).join(", ");
			const whereSql = keys.map((c) => `\`${String(c).replace(/`/g, "``")}\` = ?`).join(" and ");
			const args = [...setCols.map((c) => changes[c]), ...keys.map((c) => keyValues[c])];
			const result = await withMysql(url, async (conn) => {
				const [r] = await conn.query(`update ${fq} set ${setSql} where ${whereSql}`, args);
				return { rowCount: r.affectedRows };
			});
			if (!result.rowCount) throw new Error("update matched 0 rows — primary key values may have changed");
			return ok({ ...result, engine: "mysql" });
		}
		default:
			throw new Error(`unknown endpoint: ${endpoint}`);
	}
}

async function handleRedis(endpoint, payload) {
	const url = requireUrl(payload);
	switch (endpoint) {
		case "ping": {
			const result = await withRedis(url, async (client) => {
				const pong = await client.ping();
				const info = await client.info("server");
				const ver = (info.match(/redis_version:(.+)/) || [])[1] || "";
				return { db: "redis", user: "default", version: ver.trim(), pong };
			});
			return ok({ ok: true, engine: "redis", ...result });
		}
		case "schemas":
			return ok({ schemas: ["keys"], engine: "redis" });
		case "tables": {
			const pattern = typeof payload?.schema === "string" && payload.schema !== "keys" ? payload.schema : "*";
			const keys = await withRedis(url, async (client) => {
				const found = [];
				const stream = client.scanStream({ match: pattern === "keys" ? "*" : pattern, count: 200 });
				await new Promise((resolve, reject) => {
					stream.on("data", (batch) => {
						for (const k of batch) {
							if (found.length >= 500) break;
							found.push(k);
						}
						if (found.length >= 500) stream.destroy();
					});
					stream.on("end", resolve);
					stream.on("close", resolve);
					stream.on("error", reject);
				});
				return found.sort();
			});
			return ok({ schema: "keys", tables: keys, engine: "redis" });
		}
		case "query": {
			const sql = typeof payload?.sql === "string" ? payload.sql.trim() : "";
			if (!sql) throw new Error("redis command required (e.g. GET mykey, KEYS *, TYPE mykey)");
			const result = await withRedis(url, async (client) => {
				const parts = sql.match(/(?:[^\s"]+|"[^"]*")+/g)?.map((p) => p.replace(/^"|"$/g, "")) || [];
				if (!parts.length) throw new Error("empty command");
				const [cmd, ...args] = parts;
				const upper = cmd.toUpperCase();
				if (["FLUSHALL", "FLUSHDB", "SHUTDOWN", "CONFIG", "DEBUG"].includes(upper)) {
					throw new Error(`command blocked: ${upper}`);
				}
				const reply = await client.call(upper, ...args);
				if (Array.isArray(reply)) {
					return {
						fields: ["value"],
						rows: reply.map((v) => ({ value: v == null ? null : String(v) })),
						rowCount: reply.length,
						command: upper,
					};
				}
				if (reply !== null && typeof reply === "object") {
					const fields = Object.keys(reply);
					return { fields, rows: [reply], rowCount: 1, command: upper };
				}
				return {
					fields: ["value"],
					rows: [{ value: reply == null ? null : String(reply) }],
					rowCount: 1,
					command: upper,
				};
			});
			return ok({ ...result, engine: "redis" });
		}
		default:
			throw new Error(`unknown endpoint: ${endpoint}`);
	}
}

async function handleChroma(endpoint, payload) {
	const base = chromaBase(requireUrl(payload));
	switch (endpoint) {
		case "ping": {
			let version = "";
			try {
				const h = await chromaFetch(base, "/api/v2/heartbeat");
				version = JSON.stringify(h);
			} catch {
				const h = await chromaFetch(base, "/api/v1/heartbeat");
				version = JSON.stringify(h);
			}
			return ok({ ok: true, engine: "chroma", db: "chroma", user: "http", version });
		}
		case "schemas":
			return ok({ schemas: ["collections"], engine: "chroma" });
		case "tables": {
			const tables = await chromaCollections(base);
			return ok({ schema: "collections", tables, engine: "chroma" });
		}
		case "query": {
			const sql = typeof payload?.sql === "string" ? payload.sql.trim() : "";
			const limit = Math.min(Math.max(Number(payload?.limit) || 50, 1), 200);
			// "peek <collection>" or bare collection name
			const m = sql.match(/^(?:peek\s+)?(.+)$/i);
			const collection = (m?.[1] || "").replace(/^["']|["']$/g, "").trim();
			if (!collection) throw new Error('chroma query: use "peek my_collection" or click a collection');
			if (/^list$/i.test(collection)) {
				const tables = await chromaCollections(base);
				return ok({
					fields: ["collection"],
					rows: tables.map((name) => ({ collection: name })),
					rowCount: tables.length,
					command: "LIST",
					engine: "chroma",
				});
			}
			const result = await chromaPeek(base, collection, limit);
			return ok({ ...result, engine: "chroma" });
		}
		default:
			throw new Error(`unknown endpoint: ${endpoint}`);
	}
}

function connectionsPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-database-connections.json");
}

function inferEngineSafe(url) {
	const u = String(url || "").trim();
	if (/^postgres(ql)?:\/\//i.test(u)) return "postgres";
	if (/^(mysql|mariadb):\/\//i.test(u)) return "mysql";
	if (/^rediss?:\/\//i.test(u)) return "redis";
	if (/^chroma:\/\//i.test(u)) return "chroma";
	return "postgres";
}

function normalizeConnection(c) {
	if (!c || typeof c !== "object") return null;
	const url = typeof c.url === "string" ? c.url.trim() : "";
	if (!url) return null;
	const id = String(c.id || c.name || "").trim() || `db-${Date.now()}`;
	const name = String(c.name || id).trim();
	const engine = ENGINES.has(c.engine) ? c.engine : inferEngineSafe(url);
	return { id, name, url, engine };
}

async function loadConnectionsStore() {
	try {
		const raw = JSON.parse(await readFile(connectionsPath(), "utf8"));
		const list = Array.isArray(raw?.connections) ? raw.connections : (Array.isArray(raw) ? raw : []);
		const initialized = typeof raw?.initialized === "boolean" ? raw.initialized : list.length > 0;
		return {
			initialized,
			connections: list.map(normalizeConnection).filter(Boolean),
		};
	} catch {
		return { initialized: false, connections: [] };
	}
}

async function saveConnectionsStore(connections) {
	const p = connectionsPath();
	await mkdir(dirname(p), { recursive: true });
	const clean = (Array.isArray(connections) ? connections : []).map(normalizeConnection).filter(Boolean);
	await writeFile(p, `${JSON.stringify({ initialized: true, connections: clean }, null, 2)}\n`, "utf8");
	return clean;
}

function cloneCatalogPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-database-clones.json");
}

async function loadCloneCatalog() {
	try {
		const raw = JSON.parse(await readFile(cloneCatalogPath(), "utf8"));
		return Array.isArray(raw?.clones) ? raw.clones : [];
	} catch {
		return [];
	}
}

async function saveCloneCatalog(clones) {
	const p = cloneCatalogPath();
	await mkdir(dirname(p), { recursive: true });
	await writeFile(p, `${JSON.stringify({ clones }, null, 2)}\n`, "utf8");
}

function slugifyClone(raw) {
	return String(raw || "db")
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, "-")
		.replace(/^-|-$/g, "")
		.slice(0, 40) || "db";
}

async function nextClonePort(catalog) {
	const used = new Set(catalog.map((c) => Number(c.port)).filter(Boolean));
	let port = CLONE_PORT_BASE;
	while (used.has(port)) port += 1;
	return port;
}

async function waitPgReady(url, tries = 35) {
	let consecutive = 0;
	let lastErr = null;
	for (let i = 0; i < tries; i++) {
		try {
			await withPg(url, async (client) => {
				await client.query("select 1");
			});
			consecutive++;
			if (consecutive >= 2) return;
		} catch (err) {
			lastErr = err;
			consecutive = 0;
		}
		await new Promise((r) => setTimeout(r, 1000));
	}
	throw new Error(`clone postgres did not become ready in time: ${lastErr?.message || "unknown error"}`);
}

async function harnessNetworks() {
	try {
		const { stdout } = await execFileAsync(
			"docker",
			["inspect", "-f", "{{json .NetworkSettings.Networks}}", "deepseek-harness"],
			{ maxBuffer: 2 * 1024 * 1024 },
		);
		const nets = JSON.parse(stdout || "{}");
		return Object.keys(nets || {});
	} catch {
		return [];
	}
}

/**
 * Spin a dedicated postgres container, copy schema + data via pg_dump, catalog it.
 * Portable: does not require ~/Containers layout.
 */
async function createPostgresSidecarClone(payload) {
	const sourceUrl = typeof payload?.url === "string" ? payload.url.trim() : "";
	if (!sourceUrl || !/^postgres(ql)?:\/\//i.test(sourceUrl)) {
		throw new Error("source postgres url required");
	}
	const nameHint = slugifyClone(payload?.name || payload?.id || "clone");
	const catalog = await loadCloneCatalog();
	if (catalog.some((c) => c.id === nameHint || c.name === nameHint)) {
		throw new Error(`clone already exists: ${nameHint}`);
	}
	const port = await nextClonePort(catalog);
	const container = `dsh-dbclone-${nameHint}`;
	const user = "dsh";
	const password = "dsh";
	const database = "dsh";
	const nets = await harnessNetworks();
	const primaryNet = nets[0] || "";

	const runArgs = [
		"run",
		"-d",
		"--name",
		container,
		"--label",
		"dsh.dbclone=1",
		"--label",
		`dsh.dbclone.id=${nameHint}`,
		"--label",
		"wud.watch=false",
		"--add-host",
		"host.docker.internal:host-gateway",
		"-e",
		`POSTGRES_USER=${user}`,
		"-e",
		`POSTGRES_PASSWORD=${password}`,
		"-e",
		`POSTGRES_DB=${database}`,
		"-p",
		`${port}:5432`,
	];
	if (primaryNet) {
		runArgs.push("--network", primaryNet);
	}
	runArgs.push(CLONE_IMAGE);

	try {
		await execFileAsync("docker", ["rm", "-f", container], { maxBuffer: 1024 * 1024 }).catch(() => {});
		await execFileAsync("docker", runArgs, { maxBuffer: 4 * 1024 * 1024 });

		// Attach to other harness networks (e.g. pchamp) so source DBs are reachable for dump
		for (const n of nets.slice(1)) {
			await execFileAsync("docker", ["network", "connect", n, container], { maxBuffer: 1024 * 1024 }).catch(() => {});
		}

		const targetUrlInternal = primaryNet
			? `postgresql://${user}:${password}@${container}:5432/${database}`
			: `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;
		const targetUrlHost = `postgresql://${user}:${password}@127.0.0.1:${port}/${database}`;

		await waitPgReady(targetUrlInternal);

		// Resolve source URL for container (map localhost to host.docker.internal if needed)
		let resolvedSourceUrl = sourceUrl;
		try {
			const parsed = new URL(sourceUrl);
			if (parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost") {
				parsed.hostname = "host.docker.internal";
				resolvedSourceUrl = parsed.toString();
			}
		} catch {}

		// Execute dump & restore directly inside the clone container
		try {
			await execFileAsync(
				"docker",
				[
					"exec",
					"-e",
					`PGDUMP_SRC=${resolvedSourceUrl}`,
					container,
					"sh",
					"-c",
					`pg_dump --no-owner --no-privileges "$PGDUMP_SRC" | psql -U ${user} -d ${database}`,
				],
				{ maxBuffer: 64 * 1024 * 1024 },
			);
		} catch (dumpErr) {
			console.warn("[dsh-database] direct container pg_dump failed, trying bridge runner fallback:", dumpErr?.message);
			const dumpRunnerArgs = ["run", "--rm", "--label", "wud.watch=false"];
			if (primaryNet) dumpRunnerArgs.push("--network", primaryNet);
			else dumpRunnerArgs.push("--network", "host");
			dumpRunnerArgs.push(
				"-e",
				`PGDUMP_SRC=${sourceUrl}`,
				"-e",
				`TARGET_URL=${targetUrlInternal}`,
				CLONE_IMAGE,
				"sh",
				"-c",
				'pg_dump --no-owner --no-privileges "$PGDUMP_SRC" | psql "$TARGET_URL"',
			);
			await execFileAsync("docker", dumpRunnerArgs, { maxBuffer: 64 * 1024 * 1024 });
		}

		// Inspect the newly cloned database to record table & row counts
		const stats = await withPg(targetUrlInternal, async (client) => {
			const res = await client.query(`
				select table_schema, table_name
				from information_schema.tables
				where table_type = 'BASE TABLE'
				  and table_schema not in ('pg_catalog', 'information_schema', 'pg_toast')
			`);
			let totalRows = 0;
			for (const row of res.rows) {
				if (row.table_name === "spatial_ref_sys") continue;
				try {
					const cnt = await client.query(`select count(*) from "${row.table_schema}"."${row.table_name}"`);
					totalRows += Number(cnt.rows[0]?.count || 0);
				} catch {}
			}
			return {
				tables: res.rows.length,
				rows: totalRows,
			};
		}).catch(() => ({ tables: 0, rows: 0 }));

		const entry = {
			id: nameHint,
			name: nameHint,
			engine: "postgres",
			url: targetUrlInternal,
			hostUrl: targetUrlHost,
			container,
			port,
			createdAt: new Date().toISOString(),
			sourceHint: sourceUrl.replace(/:[^:@/]+@/, ":***@"),
			tables: stats.tables,
			rows: stats.rows,
			schemaOk: true,
		};
		catalog.push(entry);
		await saveCloneCatalog(catalog);
		try {
			const currentStore = await loadConnectionsStore();
			const cloneConn = {
				id: `clone-${nameHint}`,
				name: `clone:${nameHint}`,
				engine: "postgres",
				url: targetUrlInternal,
			};
			if (!currentStore.connections.some((c) => c.url === targetUrlInternal || c.id === cloneConn.id)) {
				await saveConnectionsStore([...currentStore.connections, cloneConn]);
			}
		} catch (err) {
			console.warn("[dsh-database] failed to add clone to connections store", err);
		}
		return { clone: entry, clones: catalog };
	} catch (err) {
		await execFileAsync("docker", ["rm", "-f", container], { maxBuffer: 1024 * 1024 }).catch(() => {});
		throw err;
	}
}

function registerRpc(ctx) {
	return ctx.connection.rpc.handle(
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				if (endpoint === "engines") {
					return ok({
						engines: [
							{ id: "postgres", label: "Postgres", placeholder: "postgresql://user:pass@host:5432/db" },
							{ id: "mysql", label: "MySQL / MariaDB", placeholder: "mysql://user:pass@host:3306/db" },
							{ id: "redis", label: "Redis", placeholder: "redis://host:6379/0" },
							{ id: "chroma", label: "Chroma", placeholder: "http://host:8000  (or chroma://host:8000)" },
						],
					});
				}
				if (endpoint === "listConnections") {
					const store = await loadConnectionsStore();
					return ok({ connections: store.connections, initialized: store.initialized });
				}
				if (endpoint === "saveConnections") {
					const list = Array.isArray(payload?.connections) ? payload.connections : [];
					const saved = await saveConnectionsStore(list);
					return ok({ connections: saved });
				}
				if (endpoint === "syncConnections") {
					const store = await loadConnectionsStore();
					const clientConns = (Array.isArray(payload?.connections) ? payload.connections : []).map(normalizeConnection).filter(Boolean);
					if (!store.initialized) {
						if (clientConns.length > 0) {
							const saved = await saveConnectionsStore(clientConns);
							return ok({ connections: saved, migrated: true });
						}
						return ok({ connections: store.connections, migrated: false });
					}
					if (payload?.merge && clientConns.length > 0) {
						const existingUrls = new Set(store.connections.map((c) => c.url));
						const toAdd = clientConns.filter((c) => !existingUrls.has(c.url));
						if (toAdd.length > 0) {
							const merged = [...store.connections, ...toAdd];
							const saved = await saveConnectionsStore(merged);
							return ok({ connections: saved, merged: true });
						}
					}
					return ok({ connections: store.connections, migrated: false });
				}
				if (endpoint === "listClones") {
					return ok({ clones: await loadCloneCatalog() });
				}
				if (endpoint === "createClone" || endpoint === "createPostgresSidecarClone") {
					const res = await createPostgresSidecarClone(payload);
					return ok(res);
				}
				if (endpoint === "removeClone") {
					const id = String(payload?.id || "").trim();
					if (!id) throw new Error("id required");
					const catalog = await loadCloneCatalog();
					const hit = catalog.find((c) => c.id === id);
					if (hit?.container) {
						await execFileAsync("docker", ["rm", "-f", hit.container], { maxBuffer: 2 * 1024 * 1024 }).catch(() => {});
					}
					const next = catalog.filter((c) => c.id !== id);
					await saveCloneCatalog(next);
					try {
						const currentStore = await loadConnectionsStore();
						const nextConns = currentStore.connections.filter((c) => c.id !== `clone-${id}` && c.name !== `clone:${id}`);
						if (nextConns.length !== currentStore.connections.length) {
							await saveConnectionsStore(nextConns);
						}
					} catch (err) {
						console.warn("[dsh-database] failed to clean clone from connections", err);
					}
					return ok({ removed: id, clones: next });
				}
				const engine = detectEngine(payload);
				if (engine === "postgres") return await handlePostgres(endpoint, payload);
				if (engine === "mysql") return await handleMysql(endpoint, payload);
				if (engine === "redis") return await handleRedis(endpoint, payload);
				if (engine === "chroma") return await handleChroma(endpoint, payload);
				throw new Error(`unsupported engine: ${engine}`);
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" }
	);
}

function apply(ctx) {
	ctx.inject(["connection"], (scope) => {
		scope.effect(() => registerRpc(scope), "dsh-database: rpc");
	});
}

export { apply, name, createPostgresSidecarClone, loadCloneCatalog };

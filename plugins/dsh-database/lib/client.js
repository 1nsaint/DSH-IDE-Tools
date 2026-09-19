window.__ModuleLoader__.load({
	id: "dsh-database",
	factory: (require) => {
		const React = require("react");
		const PLUGIN = "dsh-database";
		const RPC = "/database";
		const STORE_KEY = "dsh-database.connections.v2";
		const STORE_KEY_LEGACY = "dsh-database.connections.v1";

		const ENGINES = [
			{ id: "postgres", label: "Postgres", placeholder: "postgresql://user:pass@host:5432/db" },
			{ id: "mysql", label: "MySQL / MariaDB", placeholder: "mysql://user:pass@host:3306/db" },
			{ id: "redis", label: "Redis", placeholder: "redis://host:6379/0" },
			{ id: "chroma", label: "Chroma", placeholder: "http://host:8000" },
		];

		const css = `
.dd_root{display:flex;flex-direction:column;height:100%;min-height:0;overflow:hidden;background:var(--dsw-alias-bg-base);container-type:inline-size;container-name:dd}
.dd_bar{display:flex;align-items:center;gap:8px;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);flex-wrap:nowrap;flex:none;min-width:0}
.dd_select,.dd_input{height:30px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px}
.dd_select{flex:1 1 0;min-width:0;max-width:none}
.dd_btn{height:30px;padding:0 10px;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font-size:12px;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;flex:none}
.dd_btnIcon{width:30px;padding:0}
.dd_btn:disabled{opacity:.5;cursor:not-allowed}
.dd_btnPrimary{background:transparent;color:var(--dsw-alias-state-business-primary);border-color:var(--dsw-alias-state-business-primary);border-width:2px}
.dd_btnPrimary:hover:not(:disabled){background:color-mix(in srgb,var(--dsw-alias-state-business-primary) 12%,transparent)}
.dd_bar .dsh_tabSettingsBtn{flex:none;width:30px;height:30px;min-width:30px;padding:0;margin-left:0}
.dd_body{flex:1;min-height:0;overflow:hidden}
.dd_side{min-height:0;overflow:hidden;border-right:1px solid var(--dsw-alias-border-l2);display:flex;flex-direction:column}
.dd_sideSearch{padding:8px;flex:none;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dd_sideSearch .dd_input{width:100%;box-sizing:border-box}
.dd_sideMeta{padding:4px 10px 0;font-size:11px;color:var(--dsw-alias-label-tertiary);flex:none}
.dd_sideList{flex:1;min-height:0;overflow:auto;padding:8px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.dd_item{padding:6px 8px;border-radius:8px;cursor:pointer;font-size:12px;font-family:var(--ds-font-family-code);word-break:break-all}
.dd_item:hover,.dd_itemActive{background:var(--dsw-alias-interactive-bg-hover)}
.dd_main{display:flex;flex-direction:column;min-height:0;overflow:hidden}
.dd_queryShell{flex:none;margin:8px 10px 0;display:flex;align-items:stretch;gap:6px;min-width:0}
.dd_mode{display:inline-flex;flex:none;border-radius:8px;border:1px solid var(--dsw-alias-border-l2);overflow:hidden;background:var(--dsw-alias-bg-layer-2)}
.dd_modeBtn{height:32px;padding:0 10px;border:none;border-radius:0;background:transparent;color:var(--dsw-alias-label-tertiary);font:inherit;font-size:11px;cursor:pointer}
.dd_modeBtn+.dd_modeBtn{border-left:1px solid var(--dsw-alias-border-l2)}
.dd_modeBtnActive{color:var(--dsw-alias-state-business-primary);background:var(--dsw-alias-interactive-bg-hover)}
.dd_query{flex:1 1 auto;min-width:0;height:34px;box-sizing:border-box;border-radius:10px;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);padding:0 10px;font:inherit;font-size:12px}
.dd_queryCode{font-family:var(--ds-font-family-code)}
.dd_queryGo{flex:none;min-height:34px;height:auto;align-self:stretch}
.dd_resultBar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:8px 10px;flex:none}
.dd_resultMeta{flex:1;font-size:12px;color:var(--dsw-alias-label-secondary)}
.dd_tableWrap{flex:1;min-height:0;overflow:auto;padding:0 10px 10px;-webkit-overflow-scrolling:touch;overscroll-behavior:contain}
.dd_table{border-collapse:collapse;width:100%;font-size:12px}
.dd_table th,.dd_table td{border:1px solid var(--dsw-alias-border-l2);padding:4px 8px;text-align:left;vertical-align:top;max-width:280px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.dd_table th{background:var(--dsw-alias-bg-layer-2);position:sticky;top:0;cursor:pointer;user-select:none;white-space:nowrap}
.dd_table th:hover{background:var(--dsw-alias-interactive-bg-hover)}
.dd_table th .dd_sort{margin-left:4px;opacity:.55;font-size:10px}
.dd_table td.dd_editable{cursor:cell}
.dd_table td.dd_editing{padding:0;max-width:none;overflow:visible}
.dd_cellInput{display:block;width:100%;min-width:120px;box-sizing:border-box;border:2px solid var(--dsw-alias-state-business-primary);border-radius:0;background:var(--dsw-alias-bg-layer-1);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:3px 6px}
.dd_loadMore{display:flex;justify-content:center;padding:10px 0 4px}
.dd_err{color:var(--dsw-alias-state-error-primary);padding:8px 14px;font-size:12px;flex:none}
.dd_empty{color:var(--dsw-alias-label-tertiary);padding:24px;font-size:13px;line-height:1.45;max-width:42em}
.dd_hint{color:var(--dsw-alias-label-tertiary);padding:8px 14px;font-size:12px;line-height:1.4;border-bottom:1px solid var(--dsw-alias-border-l2);flex:none}
.dd_form{display:flex;flex-direction:column;gap:10px;max-width:640px}
.dd_label{font-size:12px;color:var(--dsw-alias-label-secondary)}
.dd_badge{display:inline-block;font-size:10px;padding:1px 6px;border-radius:999px;border:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-tertiary);margin-right:6px;text-transform:uppercase;letter-spacing:.03em}
.dd_modalOverlay{position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.5);z-index:9999;display:flex;align-items:center;justify-content:center}
.dd_modal{background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);border-radius:12px;width:90%;max-width:680px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 12px 32px rgba(0,0,0,0.36);overflow:hidden}
.dd_modalHead{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--dsw-alias-border-l2)}
.dd_modalTitle{font-size:14px;font-weight:600;color:var(--dsw-alias-label-primary)}
.dd_modalBody{flex:1;min-height:0;overflow:auto;padding:16px}
.dd_cloneCard{background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:12px;margin-bottom:10px;display:flex;flex-direction:column;gap:6px}
.dd_cloneHead{display:flex;align-items:center;justify-content:space-between;gap:8px}
.dd_cloneMeta{font-size:11px;color:var(--dsw-alias-label-tertiary);font-family:var(--ds-font-family-code);word-break:break-all}
@container dd (max-width:900px){
  .dd_bar{padding:6px 8px;gap:4px}
  .dd_select{flex:1 1 0;min-width:0;padding:0 6px;font-size:11px}
  .dd_body{flex:none;min-height:0}
  .dd_side{border-right:none;border-bottom:1px solid var(--dsw-alias-border-l2);max-height:min(28vh,200px)}
  .dd_queryShell{margin:6px 8px 0}
  .dd_query{padding:0 8px;font-size:11px}
  .dd_resultBar{padding:6px 8px}
  .dd_tableWrap{padding:0 8px 8px}
}
`;
		const PAGE_SIZE = 1000;

		/** Survives DatabaseView unmount when switching conversation.view tabs. */
		const viewCache = {
			activeId: "",
			schema: "",
			schemas: [],
			tables: [],
			filter: "",
			selectedTable: "",
			sql: "select 1",
			result: null,
			sort: { field: null, dir: "asc" },
			hydrated: false,
		};

		function ensureStyles() {
			if (typeof document === "undefined") return;
			let t = document.getElementById("dsh-database-css");
			if (!t) {
				t = document.createElement("style");
				t.id = "dsh-database-css";
				document.head.appendChild(t);
			}
			t.textContent = css;
		}

		function PaneSplit(props) {
			const Split = typeof window !== "undefined" && window.__dshPaneResizer?.SplitPane;
			if (Split) return React.createElement(Split, props);
			return React.createElement("div", { className: props.className }, props.children);
		}

		function defaultCloneName(activeName) {
			const s = String(activeName || "db")
				.trim()
				.toLowerCase()
				.replace(/[^a-z0-9-]+/g, "-")
				.replace(/^-|-$/g, "")
				.slice(0, 30) || "db";
			return `${s}-clone`;
		}

		function inferEngine(url) {
			const u = String(url || "");
			if (/^postgres(ql)?:\/\//i.test(u)) return "postgres";
			if (/^(mysql|mariadb):\/\//i.test(u)) return "mysql";
			if (/^rediss?:\/\//i.test(u)) return "redis";
			if (/^chroma:\/\//i.test(u) || /^https?:\/\//i.test(u)) return "chroma";
			return "postgres";
		}

		function normalizeConn(c) {
			if (!c || !c.id || !c.url) return null;
			return {
				id: c.id,
				name: c.name || c.id,
				url: c.url,
				engine: ENGINES.some((e) => e.id === c.engine) ? c.engine : inferEngine(c.url),
			};
		}

		let cachedConnections = null;
		let activeConnection = null;

		function getRawLocalConnections() {
			try {
				let raw = JSON.parse(localStorage.getItem(STORE_KEY) || "null");
				if (!Array.isArray(raw)) {
					raw = JSON.parse(localStorage.getItem(STORE_KEY_LEGACY) || "[]");
				}
				const list = Array.isArray(raw) ? raw.map(normalizeConn).filter(Boolean) : [];
				if (list.length && !localStorage.getItem(STORE_KEY)) {
					localStorage.setItem(STORE_KEY, JSON.stringify(list));
				}
				return list;
			} catch {
				return [];
			}
		}

		function loadConnections() {
			if (Array.isArray(cachedConnections)) return cachedConnections;
			cachedConnections = getRawLocalConnections();
			return cachedConnections;
		}

		function saveLocalConnections(list) {
			const clean = (Array.isArray(list) ? list : []).map(normalizeConn).filter(Boolean);
			cachedConnections = clean;
			try {
				localStorage.setItem(STORE_KEY, JSON.stringify(clean));
			} catch {}
			if (typeof window !== "undefined") {
				window.dispatchEvent(new CustomEvent("dsh-database:connections-changed", { detail: clean }));
			}
			return clean;
		}

		function saveConnections(list) {
			return saveLocalConnections(list);
		}

		async function syncConnectionsWithServer(conn, { merge = false } = {}) {
			const target = conn || activeConnection;
			if (!target) return loadConnections();
			const local = getRawLocalConnections();
			try {
				const res = await callRpc(target, "syncConnections", { connections: local, merge });
				if (Array.isArray(res?.connections)) {
					return saveLocalConnections(res.connections);
				}
			} catch (err) {
				console.warn(`[${PLUGIN}] server sync failed`, err);
			}
			return loadConnections();
		}

		async function persistConnections(conn, list) {
			const clean = saveLocalConnections(list);
			const target = conn || activeConnection;
			if (target) {
				try {
					const res = await callRpc(target, "saveConnections", { connections: clean });
					if (Array.isArray(res?.connections)) {
						return saveLocalConnections(res.connections);
					}
				} catch (err) {
					console.warn(`[${PLUGIN}] save connections failed`, err);
					throw err;
				}
			}
			return clean;
		}

		function maskUrl(url) {
			return String(url || "").replace(/:([^:@/]+)@/, ":****@");
		}

		function defaultQuery(engine) {
			if (engine === "redis") return "PING";
			if (engine === "chroma") return "list";
			if (engine === "mysql") return "select 1";
			return "select 1";
		}

		function openItemQuery(engine, schema, table) {
			if (engine === "mysql") return `select * from \`${table}\``;
			if (engine === "redis") return `GET ${table}`;
			if (engine === "chroma") return `peek ${table}`;
			const sch = schema || "public";
			return `select * from "${sch}"."${table}"`;
		}

		function escapeSqlLike(s) {
			return String(s || "").replace(/'/g, "''").replace(/([%_\\])/g, "\\$1");
		}

		/** Build a “search any column” query for the selected table (no SQL required from the user). */
		function buildTableSearchSql(engine, schema, table, fields, needle) {
			const q = String(needle || "").trim();
			if (!q || !table || !fields?.length) return openItemQuery(engine, schema, table);
			const lit = escapeSqlLike(q);
			if (engine === "mysql") {
				const ors = fields.map((f) => `CAST(\`${String(f).replace(/`/g, "``")}\` AS CHAR) LIKE '%${lit}%'`).join(" OR ");
				return `select * from \`${table}\` where ${ors}`;
			}
			if (engine === "postgres") {
				const sch = schema || "public";
				const ors = fields.map((f) => `"${String(f).replace(/"/g, '""')}"::text ILIKE '%${lit}%'`).join(" OR ");
				return `select * from "${sch}"."${table}" where ${ors}`;
			}
			return openItemQuery(engine, schema, table);
		}

		function sideLabel(engine) {
			if (engine === "redis") return "Keys";
			if (engine === "chroma") return "Collections";
			return "Tables";
		}

		function sideSearchPlaceholder(engine) {
			if (engine === "redis") return "Filter keys…";
			if (engine === "chroma") return "Filter collections…";
			return "Filter tables…";
		}

		function csvEscape(v) {
			if (v === null || v === undefined) return "";
			const s = String(v);
			if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
			return s;
		}

		function rowsToCsv(fields, rows) {
			const header = fields.map(csvEscape).join(",");
			const lines = rows.map((row) => fields.map((f) => csvEscape(row[f])).join(","));
			return [header, ...lines].join("\n");
		}

		function downloadCsv(filename, text) {
			const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename;
			a.click();
			URL.revokeObjectURL(url);
		}

		function compareValues(a, b) {
			if (a === b) return 0;
			if (a === null || a === undefined) return 1;
			if (b === null || b === undefined) return -1;
			const an = typeof a === "number" ? a : Number(a);
			const bn = typeof b === "number" ? b : Number(b);
			if (!Number.isNaN(an) && !Number.isNaN(bn) && String(a).trim() !== "" && String(b).trim() !== "") {
				return an - bn;
			}
			return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
		}

		async function callRpc(connection, endpoint, payload) {
			const result = await connection.rpc.call(RPC, endpoint, payload ?? {});
			if (!result.ok) throw new Error(result.error?.message || `${endpoint} failed`);
			return result.value;
		}

		function settingsGear(React) {
			if (typeof window !== "undefined" && typeof window.__dshSettingsGear === "function") {
				return window.__dshSettingsGear(React, { section: "database", title: "Database settings" });
			}
			return React.createElement("button", {
				type: "button",
				className: "dsh_tabSettingsBtn dd_btn",
				title: "Database settings",
				onClick: () => {
					if (typeof window.__dshOpenSettings === "function") window.__dshOpenSettings("database");
					else window.dispatchEvent(new CustomEvent("dsh:open-settings", { detail: { section: "database" } }));
				},
			}, "⚙");
		}

		function DatabaseView({ connection }) {
			const conn = connection || activeConnection;
			const [connections, setConnections] = React.useState(() => loadConnections());
			const [activeId, setActiveId] = React.useState(() => {
				const list = loadConnections();
				if (viewCache.activeId && list.some((c) => c.id === viewCache.activeId)) return viewCache.activeId;
				return list[0]?.id || "";
			});
			const [schemas, setSchemas] = React.useState(() => viewCache.schemas);
			const [schema, setSchema] = React.useState(() => viewCache.schema);
			const [tables, setTables] = React.useState(() => viewCache.tables);
			const [filter, setFilter] = React.useState(() => viewCache.filter);
			const [selectedTable, setSelectedTable] = React.useState(() => viewCache.selectedTable);
			const [sql, setSql] = React.useState(() => viewCache.sql || "select 1");
			const [result, setResult] = React.useState(() => viewCache.result);
			const [sort, setSort] = React.useState(() => viewCache.sort || { field: null, dir: "asc" });
			const [error, setError] = React.useState("");
			const [busy, setBusy] = React.useState(false);
			const [rowSearch, setRowSearch] = React.useState("");
			const [cloneTarget, setCloneTarget] = React.useState("");
			const [cloneMsg, setCloneMsg] = React.useState("");
			const [queryMode, setQueryMode] = React.useState(() => {
				const eng = (loadConnections().find((c) => c.id === viewCache.activeId) || loadConnections()[0])?.engine;
				return eng === "redis" || eng === "chroma" ? "sql" : "search";
			});
			const [showClonesModal, setShowClonesModal] = React.useState(false);
			const [clonesList, setClonesList] = React.useState([]);
			const [loadingClones, setLoadingClones] = React.useState(false);
			const [primaryKeys, setPrimaryKeys] = React.useState([]);
			const [hasMore, setHasMore] = React.useState(false);
			const [editing, setEditing] = React.useState(null); // { rowIndex, field, draft }
			const restoreRef = React.useRef(viewCache.hydrated);

			const active = connections.find((c) => c.id === activeId) || connections[0];
			const engine = active?.engine || "postgres";
			const showSchema = engine === "postgres" || engine === "mysql";
			const canTableSearch = showSchema;
			const mode = canTableSearch ? queryMode : "sql";

			const filteredTables = React.useMemo(() => {
				const q = filter.trim().toLowerCase();
				if (!q) return tables;
				return tables.filter((t) => String(t).toLowerCase().includes(q));
			}, [tables, filter]);

			const displayRows = React.useMemo(() => {
				let rows = result?.rows || [];
				if (sort.field) {
					const sorted = [...rows];
					const dir = sort.dir === "desc" ? -1 : 1;
					sorted.sort((a, b) => dir * compareValues(a[sort.field], b[sort.field]));
					rows = sorted;
				}
				if (mode !== "search") return rows;
				const q = rowSearch.trim().toLowerCase();
				if (!q || !result?.fields?.length) return rows;
				return rows.filter((row) =>
					result.fields.some((f) => String(row[f] ?? "").toLowerCase().includes(q)),
				);
			}, [result, sort, rowSearch, mode]);

			const refreshMeta = React.useCallback(async () => {
				if (!connection || !active?.url) {
					setSchemas([]);
					setTables([]);
					return [];
				}
				setBusy(true);
				setError("");
				try {
					const payload = { url: active.url, engine: active.engine };
					const s = await callRpc(connection, "schemas", payload);
					const list = s.schemas || [];
					setSchemas(list);
					const sch = list.includes(schema) ? schema : list[0] || "";
					setSchema(sch);
					const t = await callRpc(connection, "tables", { ...payload, schema: sch });
					const nextTables = t.tables || [];
					setTables(nextTables);
					return nextTables;
				} catch (err) {
					setError(err?.message || String(err));
					setTables([]);
					return [];
				} finally {
					setBusy(false);
				}
			}, [connection, active?.url, active?.engine, schema]);

			const fetchClones = React.useCallback(async () => {
				if (!connection) return;
				setLoadingClones(true);
				try {
					const res = await callRpc(connection, "listClones", {});
					setClonesList(res.clones || []);
				} catch (err) {
					console.warn("[dsh-database] listClones failed", err);
				} finally {
					setLoadingClones(false);
				}
			}, [connection]);

			const removeCloneItem = async (cloneId) => {
				if (!connection) return;
				if (!window.confirm(`Delete clone "${cloneId}" and its container?`)) return;
				setBusy(true);
				try {
					const res = await callRpc(connection, "removeClone", { id: cloneId });
					setClonesList(res.clones || []);
					const conns = await syncConnectionsWithServer(connection);
					setConnections(conns);
					if (activeId === `clone-${cloneId}`) {
						setActiveId(conns[0]?.id || "");
					}
				} catch (err) {
					setError(err.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			React.useEffect(() => {
				ensureStyles();
				const onUpdated = (e) => {
					const next = e.detail || loadConnections();
					setConnections(next);
					setActiveId((prev) => (next.some((c) => c.id === prev) ? prev : (next[0]?.id || "")));
				};
				window.addEventListener("dsh-database:connections-changed", onUpdated);
				if (conn) {
					syncConnectionsWithServer(conn).then((next) => {
						if (Array.isArray(next)) {
							setConnections(next);
							setActiveId((prev) => (next.some((c) => c.id === prev) ? prev : (next[0]?.id || "")));
						}
					}).catch(console.warn);
				}
				return () => {
					window.removeEventListener("dsh-database:connections-changed", onUpdated);
				};
			}, [conn]);

			React.useEffect(() => {
				viewCache.activeId = activeId;
				viewCache.schema = schema;
				viewCache.schemas = schemas;
				viewCache.tables = tables;
				viewCache.filter = filter;
				viewCache.selectedTable = selectedTable;
				viewCache.sql = sql;
				viewCache.result = result;
				viewCache.sort = sort;
				viewCache.hydrated = true;
			}, [activeId, schema, schemas, tables, filter, selectedTable, sql, result, sort]);

			React.useEffect(() => {
				if (restoreRef.current) {
					restoreRef.current = false;
					(async () => {
						await refreshMeta();
						if (viewCache.sql && !viewCache.result && viewCache.selectedTable && active?.url) {
							try {
								const res = await callRpc(connection, "query", {
									url: active.url,
									engine: active.engine,
									sql: viewCache.sql,
									limit: PAGE_SIZE,
								});
								setResult(res);
							} catch { /* keep prior empty result */ }
						} else if (!viewCache.result && active?.url && (active.engine === "chroma" || active.engine === "redis")) {
							try {
								const q = defaultQuery(active.engine);
								setSql(q);
								const res = await callRpc(connection, "query", {
									url: active.url,
									engine: active.engine,
									sql: q,
									limit: PAGE_SIZE,
								});
								setResult(res);
							} catch { /* ignore */ }
						}
					})();
					return;
				}
				if (active) setSql(defaultQuery(active.engine));
				setResult(null);
				setSort({ field: null, dir: "asc" });
				setFilter("");
				setSelectedTable("");
				setRowSearch("");
				setHasMore(false);
				setPrimaryKeys([]);
				setEditing(null);
				setQueryMode(active?.engine === "redis" || active?.engine === "chroma" ? "sql" : "search");
				setError("");
				(async () => {
					await refreshMeta();
					if (!active?.url) return;
					// Chroma/Redis: auto-list so the pane isn't an empty "Run a query" dead end.
					if (active.engine === "chroma" || active.engine === "redis") {
						try {
							const q = defaultQuery(active.engine);
							setSql(q);
							const res = await callRpc(connection, "query", {
								url: active.url,
								engine: active.engine,
								sql: q,
								limit: PAGE_SIZE,
							});
							setResult(res);
						} catch (err) {
							setError(err?.message || String(err));
						}
					}
				})();
			}, [activeId, active?.engine]); // eslint-disable-line react-hooks/exhaustive-deps

			const runQuery = async (overrideSql, { offset = 0, append = false } = {}) => {
				if (!active?.url) return;
				setBusy(true);
				setError("");
				try {
					const res = await callRpc(connection, "query", {
						url: active.url,
						engine: active.engine,
						sql: overrideSql || sql,
						limit: PAGE_SIZE,
						offset,
					});
					if (append && result?.rows) {
						setResult({
							...res,
							fields: res.fields || result.fields,
							rows: [...result.rows, ...(res.rows || [])],
							rowCount: (result.rows.length + (res.rows || []).length),
						});
					} else {
						setResult(res);
						if (!append) setSort({ field: null, dir: "asc" });
					}
					setHasMore(Boolean(res?.hasMore));
					if (!append) setEditing(null);
				} catch (err) {
					setError(err?.message || String(err));
					if (!append) {
						setResult(null);
						setHasMore(false);
					}
				} finally {
					setBusy(false);
				}
			};

			const loadPrimaryKeys = async (table) => {
				if (!active?.url || !table || (engine !== "postgres" && engine !== "mysql")) {
					setPrimaryKeys([]);
					return;
				}
				try {
					const res = await callRpc(connection, "primaryKeys", {
						url: active.url,
						engine: active.engine,
						schema,
						table,
					});
					setPrimaryKeys(Array.isArray(res?.keys) ? res.keys : []);
				} catch {
					setPrimaryKeys([]);
				}
			};

			const openTable = (table) => {
				setSelectedTable(table);
				setRowSearch("");
				setHasMore(false);
				setEditing(null);
				const q = openItemQuery(engine, schema, table);
				setSql(q);
				runQuery(q, { offset: 0, append: false });
				void loadPrimaryKeys(table);
			};

			const loadMore = () => {
				if (!result || busy || !hasMore) return;
				const offset = (result.rows || []).length;
				runQuery(sql, { offset, append: true });
			};

			const runTableSearch = () => {
				if (!canTableSearch || !selectedTable) return;
				const fields = result?.fields;
				if (!fields?.length) {
					openTable(selectedTable);
					return;
				}
				const q = buildTableSearchSql(engine, schema, selectedTable, fields, rowSearch);
				setSql(q);
				runQuery(q, { offset: 0, append: false });
			};

			const saveCell = async (rowIndex, field, draft) => {
				if (!active?.url || !selectedTable || !primaryKeys.length) {
					setEditing(null);
					return;
				}
				const row = result?.rows?.[rowIndex];
				if (!row) {
					setEditing(null);
					return;
				}
				const prev = row[field];
				const nextVal = draft === "" ? null : draft;
				const prevStr = prev === null || prev === undefined ? "" : String(prev);
				if (String(nextVal ?? "") === prevStr || (nextVal === null && (prev === null || prev === undefined))) {
					setEditing(null);
					return;
				}
				// Coerce numbers when the previous value was numeric
				let coerced = nextVal;
				if (nextVal !== null && typeof prev === "number" && nextVal.trim() !== "" && !Number.isNaN(Number(nextVal))) {
					coerced = Number(nextVal);
				}
				setBusy(true);
				setError("");
				try {
					const keyValues = {};
					for (const k of primaryKeys) keyValues[k] = row[k];
					await callRpc(connection, "updateRow", {
						url: active.url,
						engine: active.engine,
						schema,
						table: selectedTable,
						keys: primaryKeys,
						keyValues,
						changes: { [field]: coerced },
					});
					const rows = [...(result.rows || [])];
					rows[rowIndex] = { ...row, [field]: coerced };
					setResult({ ...result, rows });
					setEditing(null);
				} catch (err) {
					setError(err?.message || String(err));
				} finally {
					setBusy(false);
				}
			};

			const toggleSort = (field) => {
				setSort((prev) => {
					if (prev.field !== field) return { field, dir: "asc" };
					if (prev.dir === "asc") return { field, dir: "desc" };
					return { field: null, dir: "asc" };
				});
			};

			const exportCsv = () => {
				if (!result?.fields?.length) return;
				const name = (selectedTable || active?.name || "query").replace(/[^\w.-]+/g, "_");
				downloadCsv(`${name}.csv`, rowsToCsv(result.fields, displayRows));
			};

			if (!connection) {
				return React.createElement("div", { className: "dd_err" }, "Database: connection unavailable");
			}

			if (!connections.length) {
				return React.createElement("div", { className: "dd_root" },
					React.createElement("div", { className: "dd_bar" },
						settingsGear(React),
					),
					React.createElement("div", { className: "dd_empty" },
						"No connections yet. Use the gear to open Settings → Database and add Postgres, MySQL/MariaDB, Redis, or Chroma."),
				);
			}

			const rowCount = displayRows.length;
			const totalLoaded = result?.rows?.length || 0;
			const filteredOut = Math.max(0, totalLoaded - rowCount);
			const canEdit = showSchema && selectedTable && primaryKeys.length > 0;
			const maybeCapped = Boolean(result && hasMore);

			const emptySide = (() => {
				if (tables.length > 0) return null;
				if (engine === "chroma") {
					return "No collections in this Chroma yet — it is a vector store, not SQL tables. Switch connection if you want Postgres/MySQL.";
				}
				if (engine === "redis") return "No keys matched (try Refresh, or KEYS * in the query box).";
				return `No ${sideLabel(engine).toLowerCase()}`;
			})();

			const emptyMain = (() => {
				if (result) return null;
				if (engine === "chroma") return "Collections load on the left; click one to peek documents, or Run a command.";
				if (engine === "redis") return "Keys load on the left; click one to GET, or Run a Redis command.";
				return "Click a table on the left, then search. Switch to SQL for custom queries.";
			})();

			const queryPlaceholder = mode === "search"
				? (selectedTable ? `Search in ${selectedTable}…` : "Select a table first, then search…")
				: engine === "redis"
					? "GET mykey · KEYS prefix:* · TYPE mykey"
					: engine === "chroma"
						? "list · peek my_collection"
						: "SELECT * FROM …";
			const queryValue = mode === "search" ? rowSearch : sql;
			const queryLabel = mode === "search" ? "Search table" : (engine === "redis" || engine === "chroma" ? "Command" : "SQL query");
			const goLabel = mode === "search" ? "Search" : "Run";

			const submitQuery = () => {
				if (mode === "search") runTableSearch();
				else if (!busy && active?.url) runQuery();
			};

			return React.createElement("div", { className: "dd_root" },
				React.createElement("div", { className: "dd_bar" },
					React.createElement("select", {
						className: "dd_select",
						value: active?.id || "",
						onChange: (e) => setActiveId(e.target.value),
					}, connections.map((c) => React.createElement("option", { key: c.id, value: c.id },
						`${c.name} (${c.engine})`))),
					showSchema && React.createElement("select", {
						className: "dd_select",
						value: schema,
						onChange: async (e) => {
							const sch = e.target.value;
							setSchema(sch);
							setFilter("");
							if (!active?.url) return;
							try {
								const t = await callRpc(connection, "tables", {
									url: active.url,
									engine: active.engine,
									schema: sch,
								});
								setTables(t.tables || []);
							} catch (err) {
								setError(err.message);
							}
						},
					}, schemas.map((s) => React.createElement("option", { key: s, value: s }, s))),
					React.createElement("button", {
						type: "button",
						className: "dd_btn dd_btnIcon",
						disabled: busy,
						onClick: refreshMeta,
						title: "Refresh",
						"aria-label": "Refresh",
					}, "↻"),
					React.createElement("button", {
						type: "button",
						className: "dd_btn",
						title: "View all active Postgres clones and containers",
						onClick: () => {
							setShowClonesModal(true);
							fetchClones();
						},
					}, "Clones"),
					settingsGear(React),
				),
				engine === "chroma" && React.createElement("div", { className: "dd_hint" },
					"Chroma stores embeddings/collections — not relational tables. Use Peek on a collection, or switch the dropdown to a Postgres/MySQL connection."),
				engine === "postgres" && (() => {
					const defaultName = defaultCloneName(active?.name);
					const otherPgConns = connections.filter((c) => c.engine === "postgres" && c.url !== active?.url);
					return React.createElement("div", {
						className: "dd_hint",
						style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" },
					},
						React.createElement("span", { style: { fontWeight: 500 } }, `Clone “${active?.name || "db"}”:`),
						React.createElement("input", {
							className: "dd_input",
							style: { width: 150 },
							value: cloneTarget,
							placeholder: defaultName,
							onChange: (e) => setCloneTarget(e.target.value),
						}),
						React.createElement("button", {
							type: "button",
							className: "dd_btn dd_btnPrimary",
							disabled: busy || !active?.url,
							title: `Spin a dedicated Postgres container and copy data from ${active?.name || "active database"}`,
							onClick: async () => {
								const finalName = (cloneTarget.trim() || defaultName).trim();
								setBusy(true);
								setError("");
								setCloneMsg(`Creating clone container “${finalName}”…`);
								try {
									const res = await callRpc(connection, "createClone", {
										url: active.url,
										name: finalName,
									});
									const c = res.clone;
									setCloneMsg(
										`Clone “${c?.name}” ready — ${c?.tables || 0} tables / ${c?.rows || 0} rows. URL saved: ${c?.url}`,
									);
									// Offer as a saved connection in localStorage & server
									if (c?.url) {
										const list = loadConnections();
										const connId = `clone-${c.id}`;
										if (!list.some((x) => x.url === c.url || x.id === connId)) {
											const next = [
												...list,
												{
													id: connId,
													name: `clone:${c.name}`,
													engine: "postgres",
													url: c.url,
												},
											];
											persistConnections(conn, next).catch(console.warn);
											setConnections(next);
										}
										setActiveId(connId);
									}
									setCloneTarget("");
								} catch (err) {
									setError(err?.message || String(err));
									setCloneMsg("");
								} finally {
									setBusy(false);
								}
							},
						}, "Create clone"),
						React.createElement("button", {
							type: "button",
							className: "dd_btn",
							disabled: busy || !active?.url,
							title: "Copy rows into an existing postgres database from your connections list (or custom URL)",
							onClick: async () => {
								let target = "";
								if (otherPgConns.length > 0) {
									const options = otherPgConns.map((c, i) => `${i + 1}: ${c.name}`).join("\n");
									const answer = window.prompt(
										`Copy all rows from "${active?.name}" into which database?\n\n${options}\n\nType the number (1-${otherPgConns.length}) or enter a custom postgres:// URL:`
									);
									if (!answer) return;
									const num = parseInt(answer.trim(), 10);
									if (!isNaN(num) && num >= 1 && num <= otherPgConns.length) {
										target = otherPgConns[num - 1].url;
									} else {
										target = answer.trim();
									}
								} else {
									target = window.prompt("Target postgres URL (existing DB with schema):");
								}
								if (!target) return;
								setBusy(true);
								setError("");
								setCloneMsg("Copying rows…");
								try {
									const res = await callRpc(connection, "clone", {
										url: active.url,
										engine: "postgres",
										targetUrl: target.trim(),
									});
									setCloneMsg(`Copied ${res.tables} tables / ${res.rows} rows.`);
								} catch (err) {
									setError(err?.message || String(err));
									setCloneMsg("");
								} finally {
									setBusy(false);
								}
							},
						}, otherPgConns.length > 0 ? "Copy into other DB…" : "Copy into URL…"),
						cloneMsg && React.createElement("span", { style: { fontSize: 11, opacity: 0.85 } }, cloneMsg),
					);
				})(),
				error && React.createElement("div", { className: "dd_err" }, error),
				React.createElement(PaneSplit, {
					className: "dd_body",
					storageKey: "database.tables-query",
					defaultRatio: 0.22,
					minFirst: 160,
					minSecond: 280,
				},
					React.createElement("div", { className: "dd_side" },
						React.createElement("div", { className: "dd_sideSearch" },
							React.createElement("input", {
								className: "dd_input",
								value: filter,
								placeholder: sideSearchPlaceholder(engine),
								onChange: (e) => setFilter(e.target.value),
							}),
						),
						React.createElement("div", { className: "dd_sideMeta" },
							filter.trim()
								? `${filteredTables.length} / ${tables.length} ${sideLabel(engine).toLowerCase()}`
								: `${tables.length} ${sideLabel(engine).toLowerCase()}`,
						),
						React.createElement("div", { className: "dd_sideList" },
							tables.length === 0 && React.createElement("div", { className: "dd_empty" }, emptySide),
							tables.length > 0 && filteredTables.length === 0 && React.createElement("div", { className: "dd_empty" }, "No matches"),
							filteredTables.map((t) => React.createElement("div", {
								key: t,
								className: "dd_item" + (selectedTable === t ? " dd_itemActive" : ""),
								title: t,
								onClick: () => openTable(t),
							}, t)),
						),
					),
					React.createElement("div", { className: "dd_main" },
						React.createElement("div", { className: "dd_queryShell" },
							canTableSearch && React.createElement("div", {
								className: "dd_mode",
								role: "group",
								"aria-label": "Query mode",
							},
								React.createElement("button", {
									type: "button",
									className: "dd_modeBtn" + (mode === "search" ? " dd_modeBtnActive" : ""),
									onClick: () => setQueryMode("search"),
								}, "Search"),
								React.createElement("button", {
									type: "button",
									className: "dd_modeBtn" + (mode === "sql" ? " dd_modeBtnActive" : ""),
									onClick: () => setQueryMode("sql"),
								}, "SQL"),
							),
							React.createElement("input", {
								className: "dd_query" + (mode === "sql" ? " dd_queryCode" : ""),
								value: queryValue,
								disabled: busy || (mode === "search" && !selectedTable),
								placeholder: queryPlaceholder,
								spellCheck: false,
								"aria-label": queryLabel,
								onChange: (e) => {
									if (mode === "search") setRowSearch(e.target.value);
									else setSql(e.target.value);
								},
								onKeyDown: (e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										submitQuery();
									}
								},
							}),
							React.createElement("button", {
								type: "button",
								className: "dd_btn dd_btnPrimary dd_queryGo",
								disabled: busy || !active?.url || (mode === "search" && !selectedTable),
								onClick: submitQuery,
								title: mode === "search"
									? "Search every column in this table"
									: "Run query",
							}, busy ? "…" : goLabel),
						),
						result && React.createElement("div", { className: "dd_resultBar" },
							React.createElement("span", { className: "dd_resultMeta" },
								`Showing ${rowCount} row${rowCount === 1 ? "" : "s"}`
								+ (filteredOut > 0 ? ` (filtered from ${totalLoaded})` : "")
								+ (maybeCapped ? ` · more available` : "")
								+ (sort.field ? ` · sorted by ${sort.field} ${sort.dir}` : "")
								+ (canEdit ? " · double-click a cell to edit" : ""),
							),
							maybeCapped && React.createElement("button", {
								type: "button",
								className: "dd_btn dd_btnPrimary",
								disabled: busy,
								onClick: loadMore,
							}, busy ? "…" : `Load more (+${PAGE_SIZE})`),
							React.createElement("button", {
								type: "button",
								className: "dd_btn",
								disabled: !rowCount,
								onClick: exportCsv,
							}, "Export CSV"),
						),
						React.createElement("div", { className: "dd_tableWrap" },
							!result && React.createElement("div", { className: "dd_empty" }, emptyMain),
							result && rowCount === 0 && React.createElement("div", { className: "dd_empty" },
								engine === "chroma"
									? "0 collections — this Chroma instance is empty."
									: "Query returned 0 rows."),
							result && rowCount > 0 && React.createElement("table", { className: "dd_table" },
								React.createElement("thead", null,
									React.createElement("tr", null, (result.fields || []).map((f) => React.createElement("th", {
										key: f,
										title: `Sort by ${f}`,
										onClick: () => toggleSort(f),
									},
										f,
										sort.field === f && React.createElement("span", { className: "dd_sort" }, sort.dir === "asc" ? "▲" : "▼"),
									))),
								),
								React.createElement("tbody", null,
									displayRows.map((row, i) => {
										// Map display index back to underlying result.rows index (sort/filter safe enough for edit when unfiltered)
										const srcIndex = result.rows.indexOf(row);
										const rowIndex = srcIndex >= 0 ? srcIndex : i;
										return React.createElement("tr", { key: i },
											(result.fields || []).map((f) => {
												const isPk = primaryKeys.includes(f);
												const isEditing = editing && editing.rowIndex === rowIndex && editing.field === f;
												const editable = canEdit && !isPk;
												if (isEditing) {
													return React.createElement("td", { key: f, className: "dd_editing" },
														React.createElement("input", {
															className: "dd_cellInput",
															autoFocus: true,
															value: editing.draft,
															onChange: (e) => setEditing({ ...editing, draft: e.target.value }),
															onKeyDown: (e) => {
																if (e.key === "Enter") {
																	e.preventDefault();
																	void saveCell(rowIndex, f, editing.draft);
																} else if (e.key === "Escape") {
																	e.preventDefault();
																	setEditing(null);
																}
															},
															onBlur: () => void saveCell(rowIndex, f, editing.draft),
														}),
													);
												}
												const text = row[f] === null || row[f] === undefined ? "NULL" : String(row[f]);
												return React.createElement("td", {
													key: f,
													className: editable ? "dd_editable" : undefined,
													title: editable ? `${text}\n(double-click to edit)` : text,
													onDoubleClick: editable ? () => {
														setEditing({
															rowIndex,
															field: f,
															draft: row[f] === null || row[f] === undefined ? "" : String(row[f]),
														});
													} : undefined,
												}, text);
											}),
										);
									}),
								),
							),
							maybeCapped && React.createElement("div", { className: "dd_loadMore" },
								React.createElement("button", {
									type: "button",
									className: "dd_btn dd_btnPrimary",
									disabled: busy,
									onClick: loadMore,
								}, busy ? "Loading…" : `Load more (+${PAGE_SIZE})`),
							),
						),
					),
				),
				showClonesModal && React.createElement("div", {
					className: "dd_modalOverlay",
					onClick: (e) => {
						if (e.target === e.currentTarget) setShowClonesModal(false);
					},
				},
					React.createElement("div", { className: "dd_modal" },
						React.createElement("div", { className: "dd_modalHead" },
							React.createElement("span", { className: "dd_modalTitle" }, "Active Postgres DB Clones"),
							React.createElement("button", {
								type: "button",
								className: "dd_btn dd_btnIcon",
								onClick: () => setShowClonesModal(false),
								title: "Close",
							}, "✕"),
						),
						React.createElement("div", { className: "dd_modalBody" },
							loadingClones && React.createElement("div", { className: "dd_empty" }, "Loading clones…"),
							!loadingClones && clonesList.length === 0 && React.createElement("div", { className: "dd_empty", style: { padding: "20px 14px", lineHeight: 1.6 } },
								React.createElement("div", { style: { fontWeight: 600, marginBottom: 8, fontSize: 13, color: "var(--dsw-alias-text-primary)" } }, "No active sidecar clones"),
								React.createElement("div", { style: { opacity: 0.85, fontSize: 12, marginBottom: 12 } },
									"Sidecar clones are isolated throwaway Docker containers spun up on-demand with a copy of your database. They allow you to test queries, experiment with destructive schema changes, or run benchmarks safely without affecting your live database."
								),
								React.createElement("div", { style: { opacity: 0.7, fontSize: 11 } },
									"When you create a clone using “Create clone” above, it will appear here with its mapped port, external/internal connection URLs, 1-click workbench switch, and 1-click teardown."
								)
							),
							!loadingClones && clonesList.map((c) => {
								const connId = `clone-${c.id}`;
								const isSelected = activeId === connId;
								return React.createElement("div", { key: c.id, className: "dd_cloneCard" },
									React.createElement("div", { className: "dd_cloneHead" },
										React.createElement("div", { style: { display: "flex", alignItems: "center", gap: 8 } },
											React.createElement("strong", { style: { fontSize: 13 } }, c.name),
											React.createElement("span", { className: "dd_badge" }, `port ${c.port}`),
											c.tables != null && React.createElement("span", { style: { fontSize: 11, opacity: 0.8 } }, `${c.tables} tables / ${c.rows || 0} rows`),
										),
										React.createElement("div", { style: { display: "flex", gap: 6 } },
											React.createElement("button", {
												type: "button",
												className: "dd_btn dd_btnPrimary",
												disabled: isSelected,
												onClick: async () => {
													let hit = connections.find((x) => x.id === connId || x.url === c.url);
													if (!hit) {
														const newConn = {
															id: connId,
															name: `clone:${c.name}`,
															engine: "postgres",
															url: c.url,
														};
														const updated = [...connections, newConn];
														setConnections(updated);
														persistConnections(conn, updated).catch(console.warn);
														hit = newConn;
													}
													setActiveId(hit.id);
													setShowClonesModal(false);
												},
											}, isSelected ? "Active" : "Switch to clone"),
											React.createElement("button", {
												type: "button",
												className: "dd_btn",
												style: { color: "var(--dsw-alias-state-error-primary)" },
												onClick: () => removeCloneItem(c.id),
											}, "Delete"),
										),
									),
									React.createElement("div", { className: "dd_cloneMeta" },
										React.createElement("div", null, `Container: ${c.container || "unknown"}`),
										React.createElement("div", {
											style: { cursor: "pointer" },
											title: "Click to copy internal URL",
											onClick: () => {
												navigator.clipboard.writeText(c.url);
												alert("Copied internal URL to clipboard");
											},
										}, `Internal URL: ${c.url} 📋`),
										c.hostUrl && React.createElement("div", {
											style: { cursor: "pointer" },
											title: "Click to copy host URL",
											onClick: () => {
												navigator.clipboard.writeText(c.hostUrl);
												alert("Copied host URL to clipboard");
											},
										}, `Host URL: ${c.hostUrl} 📋`),
										c.sourceHint && React.createElement("div", null, `Cloned from: ${c.sourceHint}`),
										c.createdAt && React.createElement("div", null, `Created: ${new Date(c.createdAt).toLocaleString()}`),
									),
								);
							}),
						),
					),
				),
			);
		}

		function DatabaseSettings({ connection }) {
			const conn = connection || activeConnection;
			const [list, setList] = React.useState(() => loadConnections());
			const [name, setName] = React.useState("");
			const [url, setUrl] = React.useState("");
			const [engine, setEngine] = React.useState("postgres");
			const [msg, setMsg] = React.useState("");
			const [syncing, setSyncing] = React.useState(false);

			React.useEffect(() => {
				const onUpdated = (e) => {
					setList(e.detail || loadConnections());
				};
				window.addEventListener("dsh-database:connections-changed", onUpdated);
				if (conn) {
					syncConnectionsWithServer(conn).then((next) => {
						if (Array.isArray(next)) setList(next);
					}).catch(console.warn);
				}
				return () => {
					window.removeEventListener("dsh-database:connections-changed", onUpdated);
				};
			}, [conn]);

			const persist = async (next) => {
				setList(next);
				try {
					await persistConnections(conn, next);
				} catch (err) {
					setMsg(`Save failed: ${err.message || err}`);
				}
			};

			const placeholder = ENGINES.find((e) => e.id === engine)?.placeholder || "";

			return React.createElement("div", { className: "dd_form" },
				React.createElement("p", { style: { margin: 0, fontSize: 12, color: "var(--dsw-alias-label-tertiary)" } },
					"Database connections are stored centrally on the server (plugins-data/dsh-database-connections.json) and shared across all origins (agent.rubberrobo.nl, 127.0.0.1, localhost)."),
				list.map((c) => React.createElement("div", {
					key: c.id,
					style: { display: "flex", gap: 8, alignItems: "center" },
				},
					React.createElement("span", { style: { flex: 1, fontSize: 13 } },
						React.createElement("span", { className: "dd_badge" }, c.engine),
						`${c.name} — ${maskUrl(c.url)}`),
					React.createElement("button", {
						type: "button",
						className: "dd_btn",
						onClick: () => persist(list.filter((x) => x.id !== c.id)),
					}, "Remove"),
				)),
				React.createElement("label", { className: "dd_label" }, "Engine"),
				React.createElement("select", {
					className: "dd_select",
					value: engine,
					onChange: (e) => setEngine(e.target.value),
					style: { width: "100%" },
				}, ENGINES.map((e) => React.createElement("option", { key: e.id, value: e.id }, e.label))),
				React.createElement("label", { className: "dd_label" }, "Name"),
				React.createElement("input", { className: "dd_input", value: name, onChange: (e) => setName(e.target.value), placeholder: "my-db" }),
				React.createElement("label", { className: "dd_label" }, "URL"),
				React.createElement("input", {
					className: "dd_input",
					value: url,
					onChange: (e) => setUrl(e.target.value),
					placeholder,
				}),
				React.createElement("div", { style: { display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" } },
					React.createElement("button", {
						type: "button",
						className: "dd_btn dd_btnPrimary",
						onClick: async () => {
							if (!name.trim() || !url.trim()) {
								setMsg("Name and URL required");
								return;
							}
							const next = [...list, {
								id: crypto.randomUUID(),
								name: name.trim(),
								url: url.trim(),
								engine,
							}];
							await persist(next);
							setName("");
							setUrl("");
							setMsg("Saved to server");
						},
					}, "Add connection"),
					React.createElement("button", {
						type: "button",
						className: "dd_btn",
						disabled: syncing,
						title: "Re-sync / merge browser connections with server",
						onClick: async () => {
							if (!conn) {
								setMsg("No connection available");
								return;
							}
							setSyncing(true);
							setMsg("Syncing with server…");
							try {
								const next = await syncConnectionsWithServer(conn, { merge: true });
								setList(next);
								setMsg(`Synced with server (${next.length} connection${next.length === 1 ? "" : "s"}).`);
							} catch (err) {
								setMsg(`Sync failed: ${err.message || err}`);
							} finally {
								setSyncing(false);
							}
						},
					}, syncing ? "Syncing…" : "Sync with server"),
				),
				msg && React.createElement("div", { style: { fontSize: 12 } }, msg),
			);
		}

		const inject = ["slots", "connection"];

		function ensureHeroRegistry() {
			window.__dshHeroToolRegistry = window.__dshHeroToolRegistry || {
				_map: new Map(),
				register(id, factory) {
					this._map.set(id, factory);
					return () => this._map.delete(id);
				},
				get(id) {
					return this._map.get(id);
				},
			};
		}

		function apply(ctx) {
			const connection = ctx.get("connection");
			activeConnection = connection;
			ensureStyles();
			ctx.effect(() => ctx.slots.inject("conversation.view", () => ctx.slots.register({
				name: "conversation.view",
				id: "db",
				order: 10,
				label: () => "Database",
				inject: () => ({ connection }),
			}, DatabaseView)), `${PLUGIN}: tab`);

			ctx.effect(() => {
				ensureHeroRegistry();
				return window.__dshHeroToolRegistry.register("db", () =>
					React.createElement(DatabaseView, { connection }));
			}, `${PLUGIN}: hero`);

			try {
				ctx.slots.inject("settings.section", () => ctx.slots.register({
					name: "settings.section",
					id: "database",
					order: 195,
					label: () => "Database",
					inject: () => ({ connection }),
				}, DatabaseSettings), `${PLUGIN}: settings`);
			} catch (err) {
				console.warn(`[${PLUGIN}] settings inject failed`, err);
			}
		}

		return { apply, inject };
	},
});

/**
 * dsh-containers — host half: Docker CLI via local socket and optional remote
 * DOCKER_HOST / `docker -H` targets (e.g. ssh://user@jetson).
 * Test stacks are managed by dsh-testenv; this plugin only lists/filters them.
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { homedir } from "node:os";

const name = "dsh-containers";
const RPC_CHANNEL = "/containers";
const execFileAsync = promisify(execFile);

const LOCAL_HOST = {
	id: "local",
	label: "This host",
	endpoint: "",
};

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

function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-containers.json");
}

function containersRoot() {
	return resolve(process.env.CONTAINERS_ROOT || "/containers");
}

function normalizeHost(raw, fallbackId) {
	if (!raw || typeof raw !== "object") return null;
	const id = String(raw.id || fallbackId || "").trim();
	if (!id) return null;
	const label = String(raw.label || id).trim() || id;
	const endpoint = String(raw.endpoint || raw.host || "").trim();
	if (endpoint && !/^(ssh:\/\/|unix:\/\/|tcp:\/\/|fd:\/\/)/i.test(endpoint)) {
		throw new Error(`Invalid Docker endpoint for ${label}: use ssh://, unix://, or tcp://`);
	}
	return { id, label, endpoint };
}

function defaultConfig() {
	return {
		allowPrefixes: [],
		activeHostId: LOCAL_HOST.id,
		hosts: [{ ...LOCAL_HOST }],
	};
}

async function loadConfig() {
	const base = defaultConfig();
	try {
		const raw = JSON.parse(await readFile(configPath(), "utf8"));
		const allowPrefixes = Array.isArray(raw.allowPrefixes)
			? raw.allowPrefixes.map(String).filter(Boolean)
			: base.allowPrefixes;
		let hosts = Array.isArray(raw.hosts)
			? raw.hosts.map((h, i) => {
					try {
						return normalizeHost(h, `host-${i}`);
					} catch {
						return null;
					}
				}).filter(Boolean)
			: [];
		if (!hosts.some((h) => h.id === LOCAL_HOST.id)) {
			hosts = [{ ...LOCAL_HOST }, ...hosts];
		}
		if (!hosts.length) hosts = [{ ...LOCAL_HOST }];
		const activeHostId = hosts.some((h) => h.id === raw.activeHostId)
			? raw.activeHostId
			: hosts[0].id;
		return { allowPrefixes, hosts, activeHostId };
	} catch {
		const env = process.env.DSH_CONTAINERS_ALLOW || "";
		return {
			...base,
			allowPrefixes: env
				.split(",")
				.map((s) => s.trim())
				.filter(Boolean),
		};
	}
}

async function saveConfig(cfg) {
	const path = configPath();
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(cfg, null, 2)}\n`, "utf8");
}

function resolveHost(cfg, hostId) {
	const id = String(hostId || cfg.activeHostId || LOCAL_HOST.id);
	return cfg.hosts.find((h) => h.id === id) || cfg.hosts[0] || LOCAL_HOST;
}

async function docker(args, { maxBuffer = 4 * 1024 * 1024, endpoint = "" } = {}) {
	const fullArgs = endpoint ? ["-H", endpoint, ...args] : args;
	try {
		const { stdout, stderr } = await execFileAsync("docker", fullArgs, {
			maxBuffer,
			env: { ...process.env },
		});
		return { code: 0, stdout: stdout || "", stderr: stderr || "" };
	} catch (err) {
		const msg = err?.stderr || err?.message || String(err);
		throw new Error(String(msg).trim() || "docker failed");
	}
}

function allowed(nameStr, prefixes) {
	if (!prefixes.length) return true;
	return prefixes.some((p) => nameStr === p || nameStr.startsWith(p));
}

function isTestContainer(row) {
	const n = String(row.Names || row.names || row.name || "");
	const labels = String(row.Labels || row.labels || "");
	if (/(^|,)dsh\.test=1(,|$)/.test(labels)) return true;
	if (/(^|,)dsh\.sandbox=1(,|$)/.test(labels)) return true;
	if (/(^|,)dsh\.dbclone=1(,|$)/.test(labels)) return true;
	if (/-test-/i.test(n) || /-sandbox/i.test(n) || /dsh-dbclone/i.test(n)) return true;
	const project = labels.match(/(?:^|,)com\.docker\.compose\.project=([^,]+)/)?.[1] || "";
	if (/-test$/i.test(project) || /-sandbox$/i.test(project) || /sandbox/i.test(project)) return true;
	return false;
}

/** Pretty host ports from docker ps Ports string and/or inspect PortBindings. */
function formatPortsList(portsStr, inspectInfo) {
	const seen = new Set();
	const out = [];
	const add = (host, container) => {
		const h = String(host || "").trim();
		const c = String(container || "").replace(/\/.*/, "").trim();
		if (!h && !c) return;
		const label = h && c ? `${h}→${c}` : (h || c);
		if (seen.has(label)) return;
		seen.add(label);
		out.push(label);
	};

	const raw = String(portsStr || "");
	for (const m of raw.matchAll(/(?:[\w.:\[\]]+)?:(\d+)->(\d+)(?:\/\w+)?/g)) {
		add(m[1], m[2]);
	}

	if (!out.length && inspectInfo) {
		const live = inspectInfo?.NetworkSettings?.Ports || {};
		for (const [cPort, binds] of Object.entries(live)) {
			const c = String(cPort).replace(/\/.*/, "");
			if (Array.isArray(binds) && binds.length) {
				for (const b of binds) add(b.HostPort || "*", c);
			}
		}
		const planned = inspectInfo?.HostConfig?.PortBindings || {};
		for (const [cPort, binds] of Object.entries(planned)) {
			const c = String(cPort).replace(/\/.*/, "");
			if (Array.isArray(binds) && binds.length) {
				for (const b of binds) add(b.HostPort || "*", c);
			} else {
				add("", c);
			}
		}
	}

	return out;
}

function registerRpc(ctx) {
	return ctx.connection.rpc.handle(
		RPC_CHANNEL,
		async (endpointName, payload) => {
			try {
				switch (endpointName) {
					case "getConfig": {
						return ok(await loadConfig());
					}
					case "setConfig": {
						const current = await loadConfig();
						const prefixes = Array.isArray(payload?.allowPrefixes)
							? payload.allowPrefixes.map(String).map((s) => s.trim()).filter(Boolean)
							: current.allowPrefixes;

						let hosts = current.hosts;
						if (Array.isArray(payload?.hosts)) {
							hosts = payload.hosts.map((h, i) => normalizeHost(h, `host-${i}`)).filter(Boolean);
							if (!hosts.some((h) => h.id === LOCAL_HOST.id && !h.endpoint)) {
								hosts = [{ ...LOCAL_HOST }, ...hosts.filter((h) => h.id !== LOCAL_HOST.id)];
							}
							if (!hosts.length) hosts = [{ ...LOCAL_HOST }];
						}

						let activeHostId = current.activeHostId;
						if (typeof payload?.activeHostId === "string" && payload.activeHostId.trim()) {
							activeHostId = payload.activeHostId.trim();
						}
						if (!hosts.some((h) => h.id === activeHostId)) {
							activeHostId = hosts[0].id;
						}

						const cfg = { allowPrefixes: prefixes, hosts, activeHostId };
						await saveConfig(cfg);
						return ok(cfg);
					}
					case "list":
					case "start":
					case "stop":
					case "restart":
					case "logs":
					case "pingHost": {
						const cfg = await loadConfig();
						const host = resolveHost(cfg, payload?.hostId);
						const ep = host.endpoint || "";

						if (endpointName === "pingHost") {
							const res = await docker(["info", "--format", "{{.Name}}"], {
								endpoint: ep,
								maxBuffer: 2 * 1024 * 1024,
							});
							return ok({
								hostId: host.id,
								label: host.label,
								endpoint: ep || "(local socket)",
								name: (res.stdout || "").trim(),
								ok: true,
							});
						}

						if (endpointName === "list") {
							const res = await docker(["ps", "-a", "--format", "{{json .}}"], { endpoint: ep });
							/** @type {Map<string, { cpu: string, mem: string, memPerc: string }>} */
							const statsById = new Map();
							try {
								const statsRes = await docker(
									["stats", "--no-stream", "--format", "{{json .}}"],
									{ maxBuffer: 8 * 1024 * 1024, endpoint: ep },
								);
								for (const line of statsRes.stdout.split("\n").map((l) => l.trim()).filter(Boolean)) {
									try {
										const s = JSON.parse(line);
										const sid = String(s.ID || s.Container || "").slice(0, 12);
										if (!sid) continue;
										statsById.set(sid, {
											cpu: String(s.CPUPerc || s.CPUPercentage || "").trim(),
											mem: String(s.MemUsage || "").trim(),
											memPerc: String(s.MemPerc || s.MemPercentage || "").trim(),
										});
									} catch {
										/* skip */
									}
								}
							} catch {
								/* stats optional */
							}
							const envMode = String(payload?.env || "all");
							const lines = res.stdout.split("\n").map((l) => l.trim()).filter(Boolean);
							const containers = [];
							/** @type {Map<string, any>} */
							const inspectById = new Map();
							try {
								const ids = [];
								for (const line of lines) {
									try {
										const row = JSON.parse(line);
										const id = String(row.ID || row.Id || "");
										if (id) ids.push(id);
									} catch { /* skip */ }
								}
								if (ids.length) {
									const insp = await docker(["inspect", ...ids], {
										endpoint: ep,
										maxBuffer: 32 * 1024 * 1024,
									});
									const parsed = JSON.parse(insp.stdout || "[]");
									if (Array.isArray(parsed)) {
										for (const info of parsed) {
											const id = String(info?.Id || "");
											if (id) inspectById.set(id, info);
										}
									}
								}
							} catch {
								/* inspect optional */
							}
							for (const line of lines) {
								try {
									const row = JSON.parse(line);
									const n = String(row.Names || row.names || "").split(",")[0];
									if (!allowed(n, cfg.allowPrefixes)) continue;
									const test = isTestContainer(row);
									if (envMode === "live" && test) continue;
									if ((envMode === "test" || envMode === "sandbox") && !test) continue;
									const id = String(row.ID || row.Id || "");
									const short = id.slice(0, 12);
									const stats = statsById.get(short) || statsById.get(id) || null;
									const insp = inspectById.get(id) || null;
									const portList = formatPortsList(row.Ports || "", insp);
									containers.push({
										id,
										name: n,
										image: row.Image,
										status: row.Status,
										state: row.State,
										ports: row.Ports || "",
										portList,
										cpu: stats?.cpu || null,
										mem: stats?.mem || null,
										memPerc: stats?.memPerc || null,
										hostId: host.id,
										hostLabel: host.label,
										test,
										sandbox: test,
									});
								} catch {
									/* skip */
								}
							}
							containers.sort((a, b) =>
								String(a.name || a.id).localeCompare(String(b.name || b.id), undefined, {
									sensitivity: "base",
									numeric: true,
								}),
							);
							return ok({
								containers,
								allowPrefixes: cfg.allowPrefixes,
								hostId: host.id,
								hosts: cfg.hosts,
								activeHostId: host.id,
								env: envMode,
							});
						}

						if (endpointName === "logs") {
							const id = String(payload?.id || "").trim();
							if (!id) throw new Error("id required");
							const tail = Math.min(Number(payload?.tail) || 200, 2000);
							const res = await docker(["logs", "--tail", String(tail), id], {
								maxBuffer: 8 * 1024 * 1024,
								endpoint: ep,
							});
							return ok({ logs: (res.stdout || "") + (res.stderr || "") });
						}

						const id = String(payload?.id || "").trim();
						if (!id) throw new Error("id required");
						const listed = await docker(["ps", "-a", "--format", "{{.ID}} {{.Names}}"], {
							endpoint: ep,
						});
						const hit = listed.stdout
							.split("\n")
							.map((l) => l.trim())
							.find((l) => l.startsWith(id) || l.includes(` ${id}`));
						const cname = hit ? hit.split(/\s+/).slice(1).join(" ") : id;
						if (!allowed(cname, cfg.allowPrefixes) && !allowed(id, cfg.allowPrefixes)) {
							throw new Error("container not in allowlist");
						}
						await docker([endpointName, id], { endpoint: ep });
						return ok({ id, action: endpointName, hostId: host.id });
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpointName}`));
				}
			} catch (error) {
				return transportError(error);
			}
		},
		{ authority: "loopback" },
	);
}

function apply(ctx) {
	ctx.inject(["connection"], (connectionCtx) => {
		connectionCtx.inject(["sessions"], (scope) => {
			scope.effect(() => registerRpc(scope), "dsh-containers: rpc");
		});
	});
}

export { apply, name };

/**
 * dsh-workspace-accent — host half: stores workspace accent color overrides
 * centrally in plugins-data/dsh-workspace-accents.json so all origins
 * (agent.rubberrobo.nl, 127.0.0.1, localhost) share identical workspace colors.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";

const name = "dsh-workspace-accent";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/workspace-accent";

function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-workspace-accents.json");
}

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

async function loadStore() {
	try {
		const raw = JSON.parse(await readFile(configPath(), "utf8"));
		const overrides = raw && typeof raw.overrides === "object" && raw.overrides ? raw.overrides : {};
		const initialized = typeof raw?.initialized === "boolean" ? raw.initialized : Object.keys(overrides).length > 0;
		return { initialized, overrides };
	} catch {
		return { initialized: false, overrides: {} };
	}
}

async function saveStore(overrides) {
	const p = configPath();
	await mkdir(dirname(p), { recursive: true });
	const clean = overrides && typeof overrides === "object" ? overrides : {};
	await writeFile(p, `${JSON.stringify({ initialized: true, overrides: clean }, null, 2)}\n`, "utf8");
	return clean;
}

function registerRpc(ctx) {
	return registerRpcChannel(ctx, 
		RPC_CHANNEL,
		async (endpoint, payload) => {
			try {
				if (endpoint === "loadOverrides") {
					const store = await loadStore();
					return ok({ overrides: store.overrides, initialized: store.initialized });
				}
				if (endpoint === "saveOverrides") {
					const clean = await saveStore(payload?.overrides);
					return ok({ overrides: clean });
				}
				if (endpoint === "syncOverrides") {
					const store = await loadStore();
					const clientOverrides = payload?.overrides && typeof payload.overrides === "object" ? payload.overrides : {};
					const clientCount = Object.keys(clientOverrides).length;
					if (!store.initialized && clientCount > 0) {
						const saved = await saveStore(clientOverrides);
						return ok({ overrides: saved, migrated: true });
					}
					if (payload?.merge && clientCount > 0) {
						const merged = { ...clientOverrides, ...store.overrides };
						const saved = await saveStore(merged);
						return ok({ overrides: saved, merged: true });
					}
					return ok({ overrides: store.overrides, migrated: false });
				}
				throw new Error(`unknown endpoint: ${endpoint}`);
			} catch (error) {
				return transportError(error);
			}
		});
}

function apply(ctx) {
	ctx.inject(["connection", "webServer"], (scope) => {
		scope.effect(() => registerRpc(scope), `${name}: rpc`);
	});
}

export { apply, name, inject };

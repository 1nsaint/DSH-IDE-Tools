/**
 * dsh-hero-tools — host half: stores workbench tab order centrally in
 * plugins-data/dsh-hero-tools.json so all origins share identical workbench tabs.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import { registerRpcChannel, ok, transportError } from "../../_shared/register-rpc-channel.js";

const name = "dsh-hero-tools";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/hero-tools";

function configPath() {
	const home = process.env.DSH_HOME || join(homedir(), ".dsh");
	return join(home, "plugins-data", "dsh-hero-tools.json");
}

async function loadStore() {
	try {
		const raw = JSON.parse(await readFile(configPath(), "utf8"));
		const order = Array.isArray(raw?.order) ? raw.order.map(String).filter(Boolean) : [];
		const initialized = typeof raw?.initialized === "boolean" ? raw.initialized : order.length > 0;
		return { initialized, order };
	} catch {
		return { initialized: false, order: [] };
	}
}

async function saveStore(order) {
	const p = configPath();
	await mkdir(dirname(p), { recursive: true });
	const clean = (Array.isArray(order) ? order : []).map(String).filter(Boolean);
	await writeFile(p, `${JSON.stringify({ initialized: true, order: clean }, null, 2)}\n`, "utf8");
	return clean;
}

function apply(ctx) {
	ctx.effect(() => {
		return registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
			try {
				if (endpoint === "loadOrder") {
					const store = await loadStore();
					return ok({ order: store.order, initialized: store.initialized });
				}
				if (endpoint === "saveOrder") {
					const clean = await saveStore(payload?.order);
					return ok({ order: clean });
				}
				if (endpoint === "syncOrder") {
					const store = await loadStore();
					const clientOrder = (Array.isArray(payload?.order) ? payload.order : []).map(String).filter(Boolean);
					if (!store.initialized && clientOrder.length > 0) {
						const saved = await saveStore(clientOrder);
						return ok({ order: saved, migrated: true });
					}
					return ok({ order: store.order, migrated: false });
				}
				throw new Error(`unknown endpoint: ${endpoint}`);
			} catch (error) {
				return transportError(error);
			}
		});
	}, `${name}: rpc`);
}

export { apply, name, inject };
export default { name, inject, apply };

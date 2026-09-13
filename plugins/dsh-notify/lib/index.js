// dsh-notify — host (node) half.
//
// The feature lives entirely in the browser half (Web Notifications plus
// synthesized Web-Audio chimes driven by the client sessions snapshot). This
// host half only registers the plugin's user-settings section so the settings
// transport describes, validates, and persists the notify preferences under
// `$DSH_HOME/settings.yaml` (Settings → 通知 / Notifications in the web UI).
import z from "@deepseek-ai/schemastery";
import { installSettingsSection, settingsNamespace } from "@deepseek-ai/dsh-settings";

/** Plugin short name (the loader entry id and the settings namespace). */
const name = "dsh-notify";
/** Settings namespace branded per the dsh-settings contract (lowercase kebab-case). */
const NS = settingsNamespace("dsh-notify");

const DEFAULT_VOLUME = 60;

/** Plugin configuration: composition entry values under the optional user-settings section. */
const Config = z.object({
	enabled: z.boolean().default(true),
	soundEnabled: z.boolean().default(true),
	volume: z.number().min(0).max(100).default(DEFAULT_VOLUME),
	doneSound: z.string().default("chime"),
	questionSound: z.string().default("triple"),
	onlyWhenHidden: z.boolean().default(false)
});

/**
 * Plugin body. All values flow through the settings section registered here;
 * the browser half reads the same namespace from its settings scope.
 * @param ctx - plugin context.
 * @param config - the composition entry config (base layer for the settings section).
 */
function apply(ctx, config) {
	let source = () => config;
	installSettingsSection(ctx, NS, Config, config, {
		setSource: (next) => {
			source = next;
		},
		onChange: () => {}
	});
}

export { apply, name };

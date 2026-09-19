/**
 * Local PTY environment: persisted user npm prefix + credential-backed API keys.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);

function credentialRef(name) {
	try {
		return require("@deepseek-ai/dsh-credentials").credentialRef(name);
	} catch {
		return name;
	}
}

const GEMINI_REF = "GEMINI_API_KEY";
const GOOGLE_REF = "GOOGLE_API_KEY";

function homeDir() {
	return process.env.HOME || "/workspace";
}

function localPrefix() {
	return join(homeDir(), ".local");
}

function ensureLocalNpmLayout() {
	const base = localPrefix();
	try {
		mkdirSync(join(base, "bin"), { recursive: true });
		mkdirSync(join(base, "lib"), { recursive: true });
	} catch {
		/* read-only or race — ignore */
	}
}

const BASHRC_MARKER = "# dsh-terminal: user-local npm (~/.local/bin)";
const PROFILE_MARKER = "# dsh-terminal: user-local npm PATH (login shells)";

const PATH_SNIPPET = `export NPM_CONFIG_PREFIX="\${NPM_CONFIG_PREFIX:-$HOME/.local}"
[ -d "$HOME/.local/bin" ] && PATH="$HOME/.local/bin:\${PATH}"
export PATH
`;

/**
 * Login PTYs (`bash -l`) source /etc/profile, which resets PATH and drops the
 * env we pass to node-pty. Debian/Ubuntu login bash does not read ~/.bashrc
 * unless ~/.profile does — so put the PATH fix in ~/.profile (persisted on
 * /workspace) and keep a matching ~/.bashrc snippet for non-login shells.
 */
function ensureWorkspaceShellProfile() {
	const home = homeDir();
	const bashrc = join(home, ".bashrc");
	const profile = join(home, ".profile");
	const bashrcBlock = `
${BASHRC_MARKER}
${PATH_SNIPPET}`;
	const profileBlock = `
${PROFILE_MARKER}
${PATH_SNIPPET}# Load ~/.bashrc for interactive bash (standard Debian/Ubuntu pattern).
if [ -n "\${BASH_VERSION:-}" ] && [ -f "$HOME/.bashrc" ]; then
  . "$HOME/.bashrc"
fi
`;
	try {
		if (existsSync(bashrc)) {
			const text = readFileSync(bashrc, "utf8");
			if (!text.includes(BASHRC_MARKER)) appendFileSync(bashrc, bashrcBlock);
		} else {
			appendFileSync(bashrc, `# Added by dsh-terminal plugin\n${bashrcBlock.trim()}\n`);
		}
	} catch {
		/* ignore */
	}
	try {
		if (existsSync(profile)) {
			const text = readFileSync(profile, "utf8");
			if (!text.includes(PROFILE_MARKER) && !text.includes(BASHRC_MARKER)) {
				appendFileSync(profile, profileBlock);
			}
		} else {
			appendFileSync(profile, `# Added by dsh-terminal plugin\n${profileBlock.trim()}\n`);
		}
	} catch {
		/* ignore */
	}
}

function pathWithLocalBin(pathVal) {
	const localBin = join(localPrefix(), "bin");
	const path = pathVal || "/usr/local/bin:/usr/bin:/bin";
	if (path.split(":").includes(localBin)) return path;
	return `${localBin}:${path}`;
}

async function resolveCredential(ctx, refName) {
	const creds = ctx?.get?.("credentials");
	if (!creds?.resolve) return undefined;
	try {
		const resolved = await creds.resolve(credentialRef(refName));
		return resolved?.value ? String(resolved.value) : undefined;
	} catch {
		return undefined;
	}
}

function nonEmptyEnv(value) {
	return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

/**
 * Secrets for Gemini CLI — only when explicitly configured (OAuth / Google login needs none).
 * @param {object} ctx
 */
export async function resolveGeminiEnv(ctx) {
	const out = {};
	const fromCred =
		(await resolveCredential(ctx, GEMINI_REF)) ||
		(await resolveCredential(ctx, GOOGLE_REF));
	const cred = nonEmptyEnv(fromCred);
	if (cred) {
		out.GEMINI_API_KEY = cred;
		out.GOOGLE_API_KEY = cred;
	}
	const gemini = nonEmptyEnv(process.env.GEMINI_API_KEY);
	const google = nonEmptyEnv(process.env.GOOGLE_API_KEY);
	if (gemini) out.GEMINI_API_KEY = gemini;
	if (google) {
		out.GOOGLE_API_KEY = google;
		if (!out.GEMINI_API_KEY) out.GEMINI_API_KEY = google;
	}
	return out;
}

/**
 * @param {object} ctx Harness plugin context
 */
export async function buildLocalPtyEnv(ctx) {
	ensureLocalNpmLayout();
	ensureWorkspaceShellProfile();
	const gemini = await resolveGeminiEnv(ctx);
	const prefix = localPrefix();
	const base = { ...process.env };
	for (const k of ["GEMINI_API_KEY", "GOOGLE_API_KEY"]) {
		if (!nonEmptyEnv(base[k])) delete base[k];
	}
	// Web PTY in Docker — not Cursor/VS Code integrated terminal; ignore IDE companion ports.
	delete base.GEMINI_CLI_IDE_SERVER_PORT;
	delete base.GEMINI_CLI_IDE_WORKSPACE_PATH;
	delete base.GEMINI_CLI_IDE_SERVER_STDIO_COMMAND;
	delete base.GEMINI_CLI_IDE_SERVER_STDIO_ARGS;
	return {
		...base,
		...gemini,
		TERM: "xterm-256color",
		COLORTERM: "truecolor",
		FORCE_COLOR: "1",
		CLICOLOR: "1",
		CLICOLOR_FORCE: "1",
		NPM_CONFIG_PREFIX: prefix,
		npm_config_prefix: prefix,
		PATH: pathWithLocalBin(process.env.PATH),
		DSH_TERMINAL: "1",
		/** Container/web PTY: no in-container browser — Gemini uses auth-code flow (URL on your PC, paste code). */
		NO_BROWSER: "true",
		GEMINI_CLI_TRUST_WORKSPACE: "true",
		// Image defaults XDG_* to /tmp (ephemeral). Point at the workspace volume so
		// OAuth tokens / CLI config survive restarts and match ~/.gemini under HOME.
		XDG_CONFIG_HOME: join(homeDir(), ".config"),
		XDG_DATA_HOME: join(homeDir(), ".local", "share"),
		XDG_CACHE_HOME: join(homeDir(), ".cache"),
	};
}

export function geminiCliInstalled() {
	return existsSync(join(localPrefix(), "bin", "gemini"));
}

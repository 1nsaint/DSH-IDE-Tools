# Install

These plugins target [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (Cordis web profile).

## Quick install (turnkey Docker — recommended for friends / agents)

Plugins + Cordis profile are **built into the image** and copied into `./data` on first boot.

```bash
git clone https://github.com/1nsaint/DSH-IDE-Tools.git
cd DSH-IDE-Tools/deploy
cp .env.example .env
# Edit .env — DOCKER_GID, OPENAI_API_BASE_URL, OPENAI_API_KEY, CONTAINERS_HOST_ROOT

# Optional HTTPS sidecar certs (once) — see certs/README.md. HTTP :3080 works without them.
docker compose -f docker-compose.yml up -d --build
```

Open **http://127.0.0.1:3080**. Agent-oriented steps: [`deploy/AGENTS.md`](../deploy/AGENTS.md).

After plugin updates: `git pull` then `docker compose -f docker-compose.yml up -d --build --force-recreate`.

## Legacy install (host-side `install-ide-tools.sh`)

Only needed if you bind-mount plugins from the host (ProDesk-style) instead of using the baked image:

```bash
cd DSH-IDE-Tools/deploy
cp .env.example .env
../scripts/install-ide-tools.sh --dsh-home ./data
docker compose -f docker-compose.yml up -d --build
```

## Quick install (stock Harness — Plugins → Add plugin)

On any stock DeepSeek Harness (native or Docker) that already shows **Plugins**:

1. Open **Plugins** → **Add plugin**
2. Paste one of:

| Goal | Paste into “Package name or address” |
| --- | --- |
| **Full suite** | `https://github.com/1nsaint/DSH-IDE-Tools` |
| Same (shorthand) | `github:1nsaint/DSH-IDE-Tools` |
| **Local path (dev/sandbox)** | `file:/absolute/path/to/DSH-IDE-Tools` — must use the `file:` prefix (bare `/path` becomes `link:` and skips nested plugin deps) |
| **One plugin** (example) | `github:1nsaint/DSH-IDE-Tools#path:plugins/dsh-browser` |

3. Confirm install, wait for pnpm to finish, hard-refresh the browser.
4. Open **Settings** for anything host-specific (CDP URL, metrics upstreams, SSH hosts, search keys). Those live in `$DSH_HOME/plugins-data/` and are **not** shipped by the suite.

**Requirements:**

- Repo visibility **Public** — stock Harness runs `git ls-remote` with no credentials. Private repos fail Add plugin unless that host already has GitHub auth.
- This change must be **pushed to `main`** (root `package.json` + `cordis.patch.yml`). Until then, GitHub installs have no suite bundle.
- Headed Chromium for Remote browser is a separate Docker companion — not part of Add plugin.

**Not yet on npm:** typing bare `dsh-ide-tools` only works after someone publishes that name to the registry. Until then use the GitHub URL above.

Do **not** also run `install-ide-tools.sh` / bake the same plugins into `dsh.profile.bundles` on the same profile — duplicate loader ids.

## Quick install (existing Harness — CLI / bind-mount)

If you prefer the host script instead of Add plugin:

```bash
git clone https://github.com/1nsaint/DSH-IDE-Tools.git
cd DSH-IDE-Tools
./scripts/install-ide-tools.sh --native-links --dsh-home "$HOME/.dsh"
# Restart Harness, hard-refresh the browser
```

Inside an existing container (paths already use `/home/node/.dsh`):

```bash
docker exec -it YOUR_HARNESS_CONTAINER sh -c \
  'cd /path/to/DSH-IDE-Tools && DSH_HOME=/home/node/.dsh ./scripts/install-ide-tools.sh'
docker restart YOUR_HARNESS_CONTAINER
```

## Manual install

### 1. Copy plugins into `$DSH_HOME`

```bash
cp -a DSH-IDE-Tools/plugins/* "$DSH_HOME/plugins/"
```

### 2. Wire the web profile

1. Copy [`examples/cordis.patch.full.yml`](../examples/cordis.patch.full.yml) → `$DSH_HOME/profiles/web/cordis.patch.yml`
2. Copy [`examples/profile.package.json.full`](../examples/profile.package.json.full) → `$DSH_HOME/profiles/web/package.json` (replace `__DSH_LINK_PREFIX__` with `/home/node/.dsh` or your `$DSH_HOME` path)
3. Run `pnpm install` in the profile directory
4. Restart Harness and hard-refresh the browser

## Optional capabilities

| Feature | Requirement |
| --- | --- |
| **Containers** tab | Docker socket in compose + `DOCKER_GID` in `.env` |
| **Database** tab | Same socket + `npm install --omit=dev` in `plugins/dsh-database` |
| **Automation / Cron** | `pnpm install` in `plugins/dsh-automation` and `plugins/dsh-cron` |
| **Web search router** | `npm install --omit=dev` in `plugins/dsh-web-search-router` |
| **SSH remote workspaces** | `~/.ssh` keys mounted in compose + `npm install --omit=dev` in `plugins/dsh-ssh-workspace` |
| **Public HTTPS hostname** | Your reverse proxy (NPM, Caddy, …) — not bundled here |

The install script handles profile wiring and dependency installs automatically.

## Bundles vs suite

Plugins are Cordis **bundles** (`dsh.bundle` + `cordis.patch.yml`). You can:

- Paste the **repo root** (`https://github.com/1nsaint/DSH-IDE-Tools`) — installs meta package `dsh-ide-tools` and every suite dependency via `file:./plugins/…`
- Paste **one plugin** with `#path:plugins/dsh-…` (see table above)
- List individuals in `dsh.profile.bundles` (ProDesk / Docker bake — see `install-ide-tools.sh`) — do not mix with the meta package on the same profile

Soft dependency groups: [`packages/dsh-ide-tools/README.md`](../packages/dsh-ide-tools/README.md).

## Config durability (survives upgrades)

Three layers — do not mix personal secrets into plugin **code**:

| Layer | Where | Survives `git pull` / image recreate? | Examples |
| --- | --- | --- | --- |
| **Plugin code** | `plugins/dsh-*` (this repo or npm) | Updated on upgrade | Defaults are empty / off — never your LAN IPs |
| **User settings** | `$DSH_HOME/plugins-data/*.json` | **Yes** (bind-mount `data/home`) | Browser CDP URL, metrics upstreams, containers SSH hosts, Lite mode |
| **Secrets / compose** | `.env`, Harness credentials, `settings.yaml` | Yes if on the host volume | Search API keys, LLM API keys, `OPENAI_API_BASE_URL` |

- **Never commit** `plugins-data/` or live credentials.
- After upgrading plugins or Harness: restart / `dsh-reload` — your `plugins-data` stays. Re-enter Settings only if you wiped `$DSH_HOME`.
- Fresh install: configure Settings (or seed env like metrics/switcher upstreams, `DSH_LAN_HOST`) before Remote browser / AI Metrics work.
- Optional companion stacks (e.g. headed Chromium for CDP) are **separate Docker projects** — not installed by Add plugin. Point Settings at `http://HOST:9222`.

## Development notes

See [`plugins/PLUGIN_DEV.md`](../plugins/PLUGIN_DEV.md) for inject rules, deploy habit, and debugging.

## Security

- Do not commit API keys, PATs, or `settings.yaml` with live credentials.
- Do not commit `$DSH_HOME/plugins-data/` (personal hosts, CDP URLs, DB connections).
- Mounting the Docker socket grants full engine control — treat as privileged.
- Keep agent preset **workspace-write** so shell/Docker actions prompt for approval.

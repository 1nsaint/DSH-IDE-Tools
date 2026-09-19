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

## Quick install (existing Harness)

If you already run stock Harness (native or your own Docker):

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

## Development notes

See [`plugins/PLUGIN_DEV.md`](../plugins/PLUGIN_DEV.md) for inject rules, deploy habit, and debugging.

## Security

- Do not commit API keys, PATs, or `settings.yaml` with live credentials.
- Mounting the Docker socket grants full engine control — treat as privileged.
- Keep agent preset **workspace-write** so shell/Docker actions prompt for approval.

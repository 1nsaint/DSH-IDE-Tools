# Install

These plugins target [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (Cordis web profile).

## Quick install (Docker — recommended)

```bash
git clone https://github.com/1nsaint/DSH-IDE-Tools.git
cd DSH-IDE-Tools/deploy
cp .env.example .env
# Edit .env — set DOCKER_GID=$(getent group docker | cut -d: -f3)

../scripts/install-ide-tools.sh --dsh-home ./data
# Self-signed TLS for the HTTPS sidecar (once):
( cd certs && openssl req -x509 -nodes -newkey rsa:2048 -days 825 \
    -keyout key.pem -out cert.pem -subj "/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,IP:127.0.0.1" )
docker compose -f docker-compose.example.yml up -d --build
```

Open **http://127.0.0.1:3080** (or **https://127.0.0.1:3443**) → **Settings → Models** → configure your LLM.

Compose starts three services: Web UI, HTTPS sidecar, and Automation worker. From another PC on the LAN use `http://<host-lan-ip>:3080`. After recreating the UI container, always recreate **harness and https** together.

After plugin updates, re-run the install script and recreate the container:

```bash
../scripts/install-ide-tools.sh --dsh-home ./data
docker compose -f docker-compose.example.yml up -d --force-recreate
```

See [`docs/FAQ.md`](FAQ.md) for Cordis, pnpm, Docker socket security, and data volumes.

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

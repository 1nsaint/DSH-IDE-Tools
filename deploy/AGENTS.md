# DSH IDE Tools — agent install brief (Antigravity / Cursor / similar)

## Goal

Install **DeepSeek Harness** with all IDE plugins already wired (Terminal, Git, Containers, Database, Split, MCP, …). The human does not run shell commands; you do.

## Layout (recommended)

Place this repo next to their other compose stacks, e.g.:

```text
~/Containers/                 # or wherever their agent manages stacks
  DSH-IDE-Tools/              # this repo
    deploy/                   # compose lives here
  <their-other-stacks>/
```

## Exact steps

1. Ensure Docker + Compose are available on the host.
2. Clone (if missing):
   `git clone https://github.com/1nsaint/DSH-IDE-Tools.git`
3. `cd DSH-IDE-Tools/deploy`
4. `cp .env.example .env` and set:
   - `DOCKER_GID` = output of `getent group docker | cut -d: -f3`
   - `OPENAI_API_BASE_URL` = their OpenAI-compatible LLM base (e.g. `http://host.docker.internal:11434/v1` or a remote switcher)
   - `OPENAI_API_KEY` = their key (or `sk-local` for local)
   - `CONTAINERS_HOST_ROOT` = absolute path to their Containers parent (so the Containers tab sees their stacks)
5. TLS (once, for https sidecar): see `certs/README.md`. If certs are missing, HTTP on `:3080` still works.
6. Start:
   `docker compose -f docker-compose.yml up -d --build`
7. Wait until `harness` is healthy. Open `http://127.0.0.1:3080` (or LAN IP `:3080`).
8. If models are empty, configure **Settings → Models** with the same base URL/key.

## What is already done in the image

- Stock `@deepseek-ai/dsh` (pinned via `DSH_VERSION`)
- All `plugins/dsh-*` copied and linked in the web profile
- `cordis.patch.yml` inserts every IDE plugin
- Plugin npm/pnpm deps installed at **image build** time
- First container start seeds `./data` from the image (marker: `.dsh-ide-tools-seeded`)

Do **not** run `install-ide-tools.sh` unless rebuilding the seed manually.

## After updates

```bash
cd DSH-IDE-Tools && git pull
cd deploy
docker compose -f docker-compose.yml up -d --build --force-recreate
```

Always recreate **harness + https** together (https shares the harness network namespace).

To force a fresh plugin seed: stop stack, delete `deploy/data/.dsh-ide-tools-seeded` (and optionally `deploy/data/plugins` + `deploy/data/profiles`), then recreate. Keep `settings.yaml` if you want to preserve model config.

## Security

- Docker socket mount = full host Docker control (needed for Containers/Database tabs).
- Prefer agent preset **workspace-write** so shell/Docker actions require approval.
- Do not commit real API keys; keep them in `.env` only.

## Do not

- Copy someone else's live `settings.yaml`, SSH keys, or session data.
- Point at another person's LAN Jetson/NPM hostname unless that is intentional.
- Recreate only `https` without `harness`.

# FAQ — DSH IDE Tools install

## What is Cordis?

**Cordis** is DeepSeek Harness’s plugin framework. Two files wire your plugins:

| File | Purpose |
|------|---------|
| `profiles/web/cordis.patch.yml` | Which plugins are enabled in the app |
| `profiles/web/package.json` | `link:` paths so Node/pnpm can load each plugin folder |

The install script copies canonical versions of both from `examples/`.

## What is pnpm and why do I need it?

**pnpm** is a Node.js package manager (like npm). Harness uses it to link plugins into the web profile (`profiles/web/node_modules/`).

Some plugins also need **`npm install` or `pnpm install` inside their own folder** (e.g. `dsh-database` needs the `pg` library). The install script runs those for you.

## Where do I set the LLM URL?

**Settings → Models** in the Harness UI (saved to `$DSH_HOME/settings.yaml`). That is the normal path.

You do **not** need LLM URL in `docker-compose.yml`. Optional `OPENAI_*` env vars in `.env` are only a convenience.

## Do I need a reverse proxy / NPM?

**No**, for local use — open `http://127.0.0.1:3080`.

**Nginx Proxy Manager** (or Caddy, Traefik, etc.) is **your** infra for a public HTTPS domain. It is not part of this repo. If you expose Harness on the internet, put auth in front of it (NPM Access List, VPN, etc.) — stock Harness has no login.

## What is the Docker socket mount?

This compose line:

```yaml
- /var/run/docker.sock:/var/run/docker.sock
```

lets Harness talk to **Docker on the host**. Required for:

- **Containers** tab (start/stop stacks)
- **Database** tab (Postgres clones)

It is **on by default** in `deploy/docker-compose.example.yml`. Remove it (and `DOCKER_HOST` / `group_add`) if you do not want that capability.

**You cannot enable this from Containers Settings** — it must be in compose before the container starts.

## Is Docker socket the same as “LLM docker access”?

**Same socket, different paths:**

- **Containers tab** — you clicking buttons in the UI
- **LLM agent** — can run `docker …` via shell if allowed by the session preset

Disabling the Containers tab does **not** block the agent if the socket is still mounted.

**Safe default:** keep Harness agent preset **`workspace-write`** (UI prompts before shell/Docker). Avoid `danger-full-access` unless you know what you are doing.

## Where is my data stored?

Mount `./data` → `/home/node/.dsh` and `./workspace` → `/workspace`. Chats, settings, and workspace files live on the **host** and survive container rebuilds.

## What about automation / cron?

The default profile includes `dsh-automation` and `dsh-cron` bundles. A separate worker container is optional for scheduled jobs. Pass `--skip-automation` to the install script if you only want the web UI plugins.

## ProDesk vs this repo

| Use case | Tool |
|----------|------|
| New user / friend | `scripts/install-ide-tools.sh` + `deploy/docker-compose.example.yml` |
| Maintainer (Containers submodule) | `scripts/sync-to-harness.sh` |

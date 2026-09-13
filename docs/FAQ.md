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

The default profile includes `dsh-automation` and `dsh-cron` **plugins** inside the Web UI (same as Git/Terminal — no container per plugin).

Scheduled jobs that should keep running with the browser closed need a **second compose service** (`automation` worker). Enabling a plugin in Settings does **not** start that container — it must be in `docker-compose`. The redistributable `deploy/docker-compose.example.yml` includes it.

Pass `--skip-automation` to the install script only if you do not want those plugin packages installed at all.

## Why an HTTPS sidecar if I already have NPM / Caddy?

Plain `http://<lan-ip>:3080` needs no sidecar. For **HTTPS** (LAN `:3443` or a public hostname), the sidecar sits in Harness’s network namespace, terminates TLS, and rewrites Host/Origin to loopback so privileged Settings APIs work. Your reverse proxy (if any) forwards to `:3443`. Always recreate **harness + https** together.

## SSH remote workspaces (Cursor comparison)

**Cursor / VS Code Remote SSH** runs a small server on the remote machine; file tree, terminal, and tools operate on that host. Your browser never touches the remote disk — the IDE backend does.

**DSH IDE Tools** does the same from the Harness container (Docker on ProDesk):

| Step | Behaviour |
|------|-----------|
| Save hosts | **Settings → SSH** (stored in `$DSH_HOME/plugins-data/dsh-ssh-workspace.json`) |
| Open remote folder | **Add workspace → SSH** → SFTP browse → workspace path `dssh://hostId/remote/path` |
| Sidebar | Chip per workspace: `local` or host label |
| Files / Code | SFTP via `dsh-files` when path is `dssh://…` |
| Terminal | SSH shell on the remote host when active workspace cwd is remote |

### Security

- Mount **only** the SSH keys Harness needs (`~/.ssh:ro` in compose). Do not mount entire home dirs unless you accept that risk.
- Keys must allow login to each saved host (`BatchMode` — no password prompts in the UI).
- Remote workspaces do **not** yet route the **agent** shell/file tools to SSH; keep preset **workspace-write** so local agent actions still prompt.
- Treat saved hostnames like secrets in shared `$DSH_HOME` backups.

### vs `dsh-workspace-add`

The older `dsh-workspace-add` plugin (local picker only) is **disabled** when `dsh-ssh-workspace` is enabled — the new dialog covers **Local | SSH**.

## ProDesk vs this repo

| Use case | Tool |
|----------|------|
| New user / friend | `scripts/install-ide-tools.sh` + `deploy/docker-compose.example.yml` |
| Maintainer (Containers submodule) | `scripts/sync-to-harness.sh` |

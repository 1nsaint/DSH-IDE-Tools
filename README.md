# DSH IDE Tools

Collection of plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — IDE-style tabs and workbench chrome (Code, Git, Terminal, Containers, Database, Browser, files sidebar, workspaces, and more).

## Quick start

```bash
git clone https://github.com/1nsaint/DSH-IDE-Tools.git
cd DSH-IDE-Tools/deploy
cp .env.example .env   # set DOCKER_GID
../scripts/install-ide-tools.sh --dsh-home ./data
docker compose -f docker-compose.example.yml up -d --build
```

Open **http://127.0.0.1:3080** → **Settings → Models** → add your LLM.

Full details: [`docs/INSTALL.md`](docs/INSTALL.md) · [`docs/FAQ.md`](docs/FAQ.md)

## Layout

```text
DSH-IDE-Tools/
  plugins/                         # Cordis plugin packages (dsh-*)
  scripts/install-ide-tools.sh     # Wire plugins into stock Harness
  scripts/sync-to-harness.sh         # ProDesk maintainer sync only
  deploy/docker-compose.example.yml  # Stock dsh + data volumes + Docker socket
  docs/                              # Install & FAQ
  examples/                          # Profile wiring (used by install script)
  CREDITS.md
  LICENSE
```

Plugin authoring: [`plugins/PLUGIN_DEV.md`](plugins/PLUGIN_DEV.md).

## Install paths

| Audience | What to use |
|----------|-------------|
| **New users / friends** | `install-ide-tools.sh` + `deploy/docker-compose.example.yml` |
| **ProDesk maintainer** | Git submodule in [`Containers`](https://github.com/1nsaint/Containers) + `sync-to-harness.sh` |

Stock Harness core is unmodified `@deepseek-ai/dsh` — all IDE behaviour comes from plugins + profile config.

## ProDesk reference install

This repo is a **git submodule** of `Containers` at `DSH-IDE-Tools/`. ProDesk bind-mounts `plugins/` in `deepseek-harness/docker-compose.yml` instead of copying into `./data`.

```bash
cd ~/Containers/DSH-IDE-Tools && git push
cd ~/Containers && git add DSH-IDE-Tools && git commit -m "chore: bump DSH-IDE-Tools"
```

## License

MIT — see [`LICENSE`](LICENSE). Third-party plugins retain their own licenses; see [`CREDITS.md`](CREDITS.md).

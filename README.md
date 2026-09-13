# DSH IDE Tools

Collection of plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — IDE-style tabs and workbench chrome (Code, Git, Terminal, Containers, Database, Browser, files sidebar, workspaces, and more).

## Quick start

1. Clone this repo and copy or symlink `plugins/` into `$DSH_HOME/plugins/`.
2. Wire your web profile (`package.json` + `cordis.patch.yml`) — see [`docs/INSTALL.md`](docs/INSTALL.md) and [`examples/`](examples/).
3. Run `pnpm install` in the profile, recreate Harness, hard-refresh.

## Layout

```text
DSH-IDE-Tools/
  plugins/           # Cordis plugin packages (dsh-*)
  docs/              # Install & ops notes
  examples/          # Profile wiring snippets
  CREDITS.md         # Third-party MIT plugins
  LICENSE            # MIT (first-party)
```

Plugin authoring reference: [`plugins/PLUGIN_DEV.md`](plugins/PLUGIN_DEV.md).

## ProDesk reference install

This repo is a **git submodule** of [`Containers`](https://github.com/1nsaint/Containers) at `DSH-IDE-Tools/`.

Harness bind-mounts plugin sources via:

- Host symlink: `deepseek-harness/data/home/plugins` → `../../../DSH-IDE-Tools/plugins`
- Docker override: `../DSH-IDE-Tools/plugins:/home/node/.dsh/plugins`

Edit plugins here, commit/push to **this repo**, then in the parent repo bump the submodule pointer:

```bash
cd ~/Containers/DSH-IDE-Tools && git push
cd ~/Containers && git add DSH-IDE-Tools && git commit -m "chore: bump DSH-IDE-Tools"
```

On a fresh clone:

```bash
git clone --recurse-submodules https://github.com/1nsaint/Containers.git
# or: git submodule update --init --recursive
```

The legacy `./scripts/sync-to-harness.sh` is only needed when this repo is **not** checked out as the submodule (e.g. standalone clone elsewhere).

## License

MIT — see [`LICENSE`](LICENSE). Third-party plugins retain their own licenses; see [`CREDITS.md`](CREDITS.md).

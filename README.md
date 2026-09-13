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

On the maintainer machine, plugin sources are developed in this repo and synced into the live Harness bind mount:

```bash
./scripts/sync-to-harness.sh
```

Target default: `../deepseek-harness/data/home/plugins` (override with `HARNESS_PLUGINS_DIR`).

After syncing, recreate `deepseek-harness` + `dsh-https` if host plugins changed, then hard-refresh the browser.

## License

MIT — see [`LICENSE`](LICENSE). Third-party plugins retain their own licenses; see [`CREDITS.md`](CREDITS.md).

# DSH IDE Tools

IDE-style plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — Code, Git, Terminal, Containers, Database, Browser, Scheduled tasks, files sidebar, workspaces, and more.

## Install on stock DeepSeek Harness (recommended)

1. Open **Plugins** in the left sidebar.
2. Click **Add plugin**.
3. Paste this repo URL and click **Install**:

```text
https://github.com/1nsaint/DSH-IDE-Tools
```

(Shorthand also works: `github:1nsaint/DSH-IDE-Tools`.)

4. Wait for pnpm to finish, then **hard-refresh** the browser (Ctrl+Shift+R).
5. Open **Settings** for anything host-specific (LLM base URL, Browser CDP, metrics, search keys). Those live in `$DSH_HOME/plugins-data/` and are **not** shipped by the suite.

<p align="center">
  <img src="docs/images/01-plugins-panel.png" alt="Plugins panel with Add plugin and installed dsh-ide-tools" width="900" />
</p>

<p align="center">
  <img src="docs/images/02-add-plugin-dialog.png" alt="Add plugin dialog with the GitHub repo URL pasted" width="900" />
</p>

The suite installs as one package (`dsh-ide-tools`). Uninstall that row to remove the whole suite. À la carte:

```text
github:1nsaint/DSH-IDE-Tools#path:plugins/dsh-browser
```

**Notes**

- Repo must stay **public** (stock Harness clones with no GitHub credentials).
- Not published to npm yet — use the GitHub URL above, not bare `dsh-ide-tools`.
- Do not also bake the same plugins into `dsh.profile.bundles` on the same profile (duplicate loader ids).
- Optional headed Chromium for Remote Browser is a **separate** Docker companion — see Settings → Browser after install.

Full details: [`docs/INSTALL.md`](docs/INSTALL.md) · [`docs/FAQ.md`](docs/FAQ.md)

## Turnkey Docker (friend / agent)

Plugins baked into the image and seeded on first boot:

```bash
git clone https://github.com/1nsaint/DSH-IDE-Tools.git
cd DSH-IDE-Tools/deploy
cp .env.example .env   # DOCKER_GID + OPENAI_API_* + CONTAINERS_HOST_ROOT
docker compose -f docker-compose.yml up -d --build
```

Open **http://127.0.0.1:3080**. Agent brief: [`deploy/AGENTS.md`](deploy/AGENTS.md).

## Layout

```text
DSH-IDE-Tools/
  package.json                     # Suite bundle (Add plugin → this repo)
  cordis.patch.yml                 # Loader inserts for the full suite
  plugins/                         # Cordis plugin packages (dsh-*)
  packages/dsh-ide-tools/          # Same suite via #path:packages/dsh-ide-tools
  scripts/install-ide-tools.sh     # Wire plugins into stock Harness (CLI)
  deploy/                          # Turnkey Docker bake + sandbox
  docs/                            # Install, FAQ, screenshots
  examples/                        # Profile wiring (used by install script)
```

Plugin authoring: [`plugins/PLUGIN_DEV.md`](plugins/PLUGIN_DEV.md).

## Other install paths

| Audience | What to use |
|----------|-------------|
| **Stock Harness** | Plugins → Add plugin → URL above |
| **One plugin only** | `github:1nsaint/DSH-IDE-Tools#path:plugins/<name>` |
| **CLI / bind-mount** | `./scripts/install-ide-tools.sh` — see [`docs/INSTALL.md`](docs/INSTALL.md) |
| **Maintainer DIY** | Bind-mount `plugins/` (e.g. ProDesk) instead of the meta package |

Stock Harness core is unmodified `@deepseek-ai/dsh` — IDE behaviour comes from plugins + profile config.

## License

MIT — see [`LICENSE`](LICENSE). Third-party plugins retain their own licenses; see [`CREDITS.md`](CREDITS.md).

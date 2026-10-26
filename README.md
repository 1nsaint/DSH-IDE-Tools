# DSH IDE Tools

IDE-style plugins for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) — Code, Git, Terminal, Containers, Database, Browser, Downloads, Scheduled tasks, SSH workspaces, file sidebar, split view, Lite mode, and more.

Requires a running DeepSeek Harness with **Plugins**. This repo is the plugin suite, not Harness itself.

## Install

1. Open **Plugins** in the left sidebar.
2. Click **Add plugin**.
3. Paste this URL and click **Install**:

```text
https://github.com/1nsaint/DSH-IDE-Tools
```

(Shorthand: `github:1nsaint/DSH-IDE-Tools`.)

4. Wait for pnpm to finish, then **hard-refresh** the browser (Ctrl+Shift+R).
5. Open **Settings** for host-specific bits (LLM / Ollama URL, Browser CDP, metrics, search keys, SSH). Those live in `$DSH_HOME/plugins-data/` and are **not** shipped by the suite.

<p align="center">
  <img src="docs/images/01-plugins-panel.png" alt="Plugins panel with Add plugin and installed dsh-ide-tools" width="900" />
</p>

<p align="center">
  <img src="docs/images/02-add-plugin-dialog.png" alt="Add plugin dialog with the GitHub repo URL pasted" width="900" />
</p>

The suite installs as one package (`dsh-ide-tools`). Uninstall that row to remove everything.

**One plugin only:**

```text
github:1nsaint/DSH-IDE-Tools#path:plugins/dsh-browser
```

**Notes**

- Not on npm yet — paste the GitHub URL, not bare `dsh-ide-tools`.
- Optional headed Chromium for Remote Browser is a separate Docker companion — see **Settings → Browser** after install.

More detail: [`docs/INSTALL.md`](docs/INSTALL.md) · [`docs/FAQ.md`](docs/FAQ.md)

## Features

### Overview

<p align="center">
  <img src="docs/images/03-overview-chat.png" alt="Chat overview with IDE tool tabs" width="900" />
</p>

### Code

Center editor — find-in-file, edit, download; open from the file sidebar or chat links.

<p align="center">
  <img src="docs/images/05-code-tab.png" alt="Code tab" width="900" />
</p>

### Git

Branches, changes, history, clone/publish, GitHub sign-in.

<p align="center">
  <img src="docs/images/06-git.png" alt="Git tab" width="900" />
</p>

### Terminal

Interactive PTY (local or via SSH workspaces).

<p align="center">
  <img src="docs/images/07-terminal.png" alt="Terminal tab" width="900" />
</p>

### Downloads

Aria2 — magnets, torrents, large HTTP; agent tools included.

<p align="center">
  <img src="docs/images/08-downloads.png" alt="Downloads tab" width="900" />
</p>

### Browser

Live in-app browser + optional Remote Chromium (CDP).

<p align="center">
  <img src="docs/images/09-browser.png" alt="Browser tab" width="900" />
</p>

### Database

Multi-engine explorer — connections, table search, optional SQL.

<p align="center">
  <img src="docs/images/10-database.png" alt="Database tab" width="900" />
</p>

### Scheduled

Durable cron → fresh Automation sessions.

<p align="center">
  <img src="docs/images/11-scheduled.png" alt="Scheduled tab" width="900" />
</p>

### Containers

Docker list — filters, logs, ports, remotes.

<p align="center">
  <img src="docs/images/12-containers.png" alt="Containers tab" width="900" />
</p>

### Split view

Side-by-side panes; Terminal gets its own PTY in the split surface.

<p align="center">
  <img src="docs/images/13-split-view.png" alt="Split view" width="900" />
</p>

### SSH

Settings → **SSH** — saved hosts, keys, remote folders, `dssh://` workspaces, SFTP + SSH terminal.

<p align="center">
  <img src="docs/images/16-ssh.png" alt="SSH settings" width="900" />
</p>

### Also included

| Area | What it does |
| --- | --- |
| **File sidebar** | Workspaces ↔ Files tree, search, drag paths into chat |
| **Lite mode** | Settings profiles that trim agent tool categories for small/local GPUs |
| **Agent review** | Cursor-style review of agent file edits — undo / keep / diff |
| **Live write** | “Writing…” card while write/edit tool args stream |
| **MCP** | Settings UI to add stdio / HTTP MCP servers |
| **AI Metrics** | Sidebar RAM donut + optional metrics / Ollama proxies |
| **Workspace accents** | Per-workspace color accents |
| **Archived** | Restore or permanently delete archived chats |
| **Web search router** | Provider routing for search tools |
| **UI / settings polish** | Wider chat, settings icons, remote Settings unlock helpers |
| **Local agent** | KV / context tweaks aimed at local models |
| **Composer dock** | Steps / tokens / context under the composer |

## License

MIT — see [`LICENSE`](LICENSE). Third-party plugins retain their own licenses; see [`CREDITS.md`](CREDITS.md).

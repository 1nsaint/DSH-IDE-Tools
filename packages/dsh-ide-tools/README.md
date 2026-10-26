# dsh-ide-tools

Meta **bundle** that installs the full IDE Tools suite into a DeepSeek Harness profile.

## Preferred install (stock Harness)

**Plugins → Add plugin**, then paste:

```text
https://github.com/1nsaint/DSH-IDE-Tools
```

That uses the **repo root** package (same name/deps as this folder). Equivalents:

| Spec | Notes |
| --- | --- |
| `github:1nsaint/DSH-IDE-Tools` | Shorthand |
| `github:1nsaint/DSH-IDE-Tools#path:packages/dsh-ide-tools` | This subdirectory (same suite) |
| `github:1nsaint/DSH-IDE-Tools#path:plugins/dsh-browser` | One plugin only |

Bare npm name `dsh-ide-tools` works only after the package is published to the registry (not required for GitHub installs).

Do **not** install both the meta package **and** the same plugins again in `profile.bundles` / `cordis.patch.yml` — duplicate loader ids.

## Soft dependency groups

| Cluster | Packages | Notes |
| --- | --- | --- |
| Browser | `dsh-browser` | Optional host stack: headed Chromium + CDP. Configure CDP URL in Settings. |
| Files | `dsh-files` + `dsh-sidebar-files` | Add `dsh-ssh-workspace` for remote trees |
| Composer UX | `dsh-composer-dock` | Pairs well with `dsh-split-view`, `dsh-hero-tools` |
| Metrics | `dsh-ai-metrics` | Set metrics/switcher upstreams in Settings (plugins-data) |
| Local LLM | `dsh-local-agent` | KV hosts in Settings; Lite toggles |
| Search | `dsh-web-search-router` | API keys via env names |
| Ops tabs | `dsh-containers`, `dsh-database`, `dsh-terminal`, `dsh-torrent`, `dsh-git` | Mostly independent |
| Polish | `dsh-settings-polish`, `dsh-ui-polish`, `dsh-plugin-list-filter`, `dsh-runtime-clock` | Fine alone; suite includes them |

## Config durability

User settings live in `$DSH_HOME/plugins-data/` and survive plugin upgrades. See [docs/INSTALL.md](../../docs/INSTALL.md).

## ProDesk note

The homelab web profile lists each plugin in `dsh.profile.bundles` (not this meta package) so Installed cards stay granular. This package is for friends who want one Add-plugin install.

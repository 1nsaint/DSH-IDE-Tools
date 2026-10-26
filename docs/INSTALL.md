# Install

These plugins target [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (Cordis web profile).

## Plugins → Add plugin (supported)

On any stock DeepSeek Harness that shows **Plugins**:

1. Open **Plugins** → **Add plugin**
2. Paste one of:

| Goal | Paste into “Package name or address” |
| --- | --- |
| **Full suite** | `https://github.com/1nsaint/DSH-IDE-Tools` |
| Same (shorthand) | `github:1nsaint/DSH-IDE-Tools` |
| **One plugin** (example) | `github:1nsaint/DSH-IDE-Tools#path:plugins/dsh-browser` |
| **Local path (dev)** | `file:/absolute/path/to/DSH-IDE-Tools` — must use the `file:` prefix (bare `/path` becomes `link:` and skips nested plugin deps) |

3. Confirm install, wait for pnpm to finish, hard-refresh the browser.
4. Open **Settings** for host-specific values (CDP URL, metrics upstreams, SSH hosts, search keys, LLM). Those live in `$DSH_HOME/plugins-data/` and are **not** shipped by the suite.

Screenshots: [README](../README.md).

**Requirements**

- Repo visibility **Public** — stock Harness runs `git ls-remote` with no credentials.
- Root `package.json` + `cordis.patch.yml` on `main` (suite bundle).
- Headed Chromium for Remote browser is a separate Docker companion — not part of Add plugin. See **Settings → Browser**.

**Not yet on npm:** use the GitHub URL above, not bare `dsh-ide-tools`.

The suite installs as one package (`dsh-ide-tools`). Uninstall that row to remove the whole suite. Do **not** also list the same plugins in `dsh.profile.bundles` on the same profile (duplicate loader ids).

## Optional capabilities

| Feature | After suite install |
| --- | --- |
| **Containers / Database** | Harness needs a Docker socket (and usually `DOCKER_GID`) |
| **Web search** | Add provider keys in Settings → Web Search |
| **SSH remote workspaces** | Mount keys into the Harness container; configure Settings → SSH |
| **Remote Browser (CDP)** | Separate headed Chromium stack; paste `http://HOST:9222` in Settings → Browser |

## Config durability

Do not put personal secrets in plugin **code**:

| Layer | Where | Survives suite update? | Examples |
| --- | --- | --- | --- |
| **Plugin code** | this repo | Updated on reinstall | Empty / off defaults |
| **User settings** | `$DSH_HOME/plugins-data/*.json` | **Yes** | CDP URL, metrics upstreams, Lite mode |
| **Harness secrets** | `settings.yaml`, credentials | Yes if on your data volume | LLM API keys |

Never commit `plugins-data/` or live credentials.

## Development

See [`plugins/PLUGIN_DEV.md`](../plugins/PLUGIN_DEV.md).

## Security

- Install only plugins you trust — they run with your Harness permissions.
- Mounting the Docker socket grants full engine control.
- Keep agent preset **workspace-write** so shell/Docker actions prompt for approval.

# Install

These plugins target [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) (Cordis/dsh web profile).

## 1. Copy plugins into `$DSH_HOME`

```bash
git clone https://github.com/1nsaint/DSH-IDE-Tools.git
cp -a DSH-IDE-Tools/plugins/* "$DSH_HOME/plugins/"
```

Or symlink (recommended for development):

```bash
ln -sfn /path/to/DSH-IDE-Tools/plugins "$DSH_HOME/plugins"
```

Inside Docker, `$DSH_HOME` is usually `/home/node/.dsh` (bind-mounted from your host).

## 2. Wire the web profile

1. Add `link:` dependencies in `$DSH_HOME/profiles/web/package.json` (see `examples/profile.package.json.example`).
2. Add plugin rows to `cordis.patch.yml` (see `examples/cordis.patch.example.yml`).
3. Run `pnpm install` in the profile directory.
4. Recreate Harness (+ HTTPS sidecar if you use one) and hard-refresh the browser.

## 3. Optional capabilities

| Feature | Requirement |
| --- | --- |
| **Containers** tab | Docker CLI + socket reachable from the Harness process |
| **Database** tab | Network reachability from Harness to your DB URLs |
| **Cron / automation** | `dsh-automation` worker container/process |
| **Remote Settings** | Auth in front of the public hostname; see `dsh-settings-polish` notes |

## Development notes

See `plugins/PLUGIN_DEV.md` for inject rules, deploy habit, and debugging.

## Security

- Do not commit API keys, PATs, or `settings.yaml` with live credentials.
- Mounting the Docker socket grants full engine control — treat as privileged.

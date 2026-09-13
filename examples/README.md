# Example profile wiring

Copy the snippets you need into your Harness web profile under `$DSH_HOME/profiles/web/`.

## `cordis.patch.yml` (insert block)

See `examples/cordis.patch.example.yml` for the full list used on the reference install.

## `package.json` dependencies

Each enabled plugin needs a link dependency, e.g.:

```json
"dsh-browser": "link:/home/node/.dsh/plugins/dsh-browser"
```

Run inside the profile directory after editing:

```bash
cd "$DSH_HOME/profiles/web" && pnpm install
```

Then recreate Harness (and HTTPS sidecar if used) and hard-refresh the browser.

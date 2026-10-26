# dsh-browser

Gated Live browser + **Remote Chromium** (CDP) for DeepSeek Harness. Cloudflare-friendly agent tools and a live screencast when Remote is on.

## Settings (durable)

Stored in `$DSH_HOME/plugins-data/dsh-browser.json` (survives plugin / image upgrades):

| Field | Meaning |
|-------|---------|
| `engine` | `builtin` (same-origin gate) or `remote` (CDP) |
| `cdpHttp` | CDP discovery base, e.g. `http://127.0.0.1:9222` |

Remote mode requires a non-empty `cdpHttp`. Fresh installs default to built-in gate with no CDP URL.

## Optional companion: headed Chromium

This plugin does **not** start Chrome. For Cloudflare / Turnstile you need a headed CDP browser on the LAN.

Recommended companion stack (separate Docker project, **not** installed via Add plugin):

1. Get folder `dsh-browser-chrome` (Chromium + Xvfb + idle gate publishing host `:9222`).
2. `cd …/dsh-browser-chrome && docker compose up -d --build`
3. Check `http://HOST:9222/json/version` in a normal browser.
4. **Settings → Browser → Remote Chromium**, CDP HTTP base `http://HOST:9222` → **Test** → **Save**.

The Settings panel repeats these steps. Any other CDP Chromium works the same way — paste its HTTP DevTools URL. Keep `:9222` LAN-only.

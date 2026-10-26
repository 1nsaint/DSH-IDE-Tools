# Suite sandbox (stock DSH)

Second Harness instance to validate **Plugins → Add plugin** for `dsh-ide-tools` without touching ProDesk DIY on `:3080`.

| | ProDesk | Sandbox |
| --- | --- | --- |
| URL | `:3080` / `agent.` | **`:3180`** |
| Profile | DIY `link:` + `profile.bundles` | Stock empty |
| Suite | Not installed as meta | Install via Add plugin |

## Start

```bash
cd DSH-IDE-Tools/deploy/sandbox
cp -n .env.example .env
docker compose up -d
```

In the browser (from your PC on the LAN):

`http://HOST:3180/?token=…` (set `DSH_LAN_HOST` in `.env` for LAN access)

Token file: `deploy/sandbox/data/run/dsh-web/token` (changes on recreate). Port is **3180**, not 3080 (main DIY) and not 3100.

Requires image `deepseek-harness:local` (same as ProDesk). Build once from `~/Containers/deepseek-harness` if missing.

## Test Add plugin

1. Open the token URL above.
2. **Plugins → Add plugin**
3. Paste **`file:/opt/DSH-IDE-Tools`** (must include the `file:` prefix — a bare `/opt/...` path links without installing nested plugins).
4. After install: one **Installed** card `dsh-ide-tools`, hard-refresh, smoke tabs.

When the GitHub repo is **public**, also try:

```text
https://github.com/1nsaint/DSH-IDE-Tools
```

## Update cycle

Detail page of **`dsh-ide-tools` → Uninstall → Add plugin again** with the same path/URL.

## Stop / wipe

```bash
docker compose down
# Fresh stock profile:
rm -rf data/
```

Do **not** point this compose at ProDesk `deepseek-harness/data/home`.

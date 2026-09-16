# Surviving DSH upgrades

Lessons from **0.1.1 → 0.1.5**. Run before declaring a bump healthy:

```bash
./plugins/_shared/check-upgrade-compat.sh
node plugins/_shared/rewrite-client-css-modules.js   # if hashes moved
docker compose -f ../deepseek-harness/docker-compose.yml up -d --force-recreate deepseek-harness dsh-https dsh-login
# hard-refresh the browser (Ctrl+Shift+R)
```

## What broke (and the durable fix)

| Symptom after bump | Unstable upstream surface | Do this instead |
| --- | --- | --- |
| Tab POSTs return **405** | `connection.rpc.handle()` registers without `webServer` inject | `registerRpcChannel` from `register-rpc-channel.js`; `inject: ["connection","webServer"]` — includes **`dsh-cron` `/cron`** |
| Files toggle / chrome “gone” | CSS-module hash (`qDHVXG_` → `bhn1Oq_`) | `[class*="_sectionHeader"]` / `rewriteClientSource`; never hardcode full hashes |
| CSS rules present but don’t apply | Browser still serving old client bundle | Hard refresh; bump `data-dsh-*` version attr |
| Chips / decorations missing | Feature gated on `workspaces.create` though it only needs `list` | Gate on the **minimum** API (`list` / `list.subscribe`) |
| Scheduled models dropdown empty | `connection.api.llm.models` (`/api/llm.models`) removed in 0.1.5 | `POST /api/session/modelCatalog` with `payload: { args: {} }` (see `dsh-cron` `fetchCronModelGroups`) |
| Archived delete resurrects under Ungrouped | Delete unarchived before wiping disk/projcache (or `sessionPersistence` missing) | Wipe dirs + both projcache formats + header index **then** unarchive (`dsh-archive`) |
| Workspace switch “does nothing” / always visible | Switch broken for real reasons (session vs pointer); “fix” left always-on 22px chrome | Hover-reveal: rest `width:0;opacity:0;pointer-events:none`, row `:hover` → expand + `pointer-events:auto` + `forceUntil` for session lag |
| Wrong node matched (`title` vs `titleRow`) | Broad `[class*="_title"]` substring | `qsExactLocal(row, "title")` (`client-dom.snippet.js`) |
| Invented stock chrome unstyled | `className = "wSkVaW_header"` pinned | `createStockClass()` / `discoverPrefix()` at runtime |
| xterm / script inject SyntaxError | Codemod doubled `"\n"` → `"\\n"` | `rewriteClientSource` skips escape-only strings; never raw whole-file replace |
| Tool tabs float mid-page | New layout wrapper (e.g. `.wSkVaW_body`) | Hide/pin against **local** names (`[class*="_body"]`), not one release’s hash |

## Rules of thumb

1. **Host RPC** — only `registerRpcChannel`. Never `connection.rpc.handle`.
2. **Client CSS/JS** — target **local** class names, not hashes.
3. **Exact locals in JS** — use `qsExactLocal` when names share a prefix.
4. **Creating stock-looking DOM** — runtime `stockClass()`, not string literals.
5. **Click targets** — hover-reveal is OK if the **parent row** hover expands the control and sets `pointer-events:auto`. Don’t “fix” breakage by leaving always-visible chrome.
6. **Shared state** — publish snapshots (`__dshWorkspacesSnapshot`, custom events) from the plugin that already has the data; don’t assume another plugin’s inject graph.
7. **After every bump** — recreate harness **and** `dsh-https`, hard-refresh, run `check-upgrade-compat.sh`.

## Files

| Path | Role |
| --- | --- |
| `register-rpc-channel.js` | Host unary RPC that works on 0.1.5+ |
| `css-modules.js` | Attr selectors, exact locals, rewrite helpers |
| `client-dom.snippet.js` | Paste into ModuleLoader factories |
| `rewrite-client-css-modules.js` | Codemod all `lib/client.js` |
| `check-upgrade-compat.sh` | Pre-bump guardrail |

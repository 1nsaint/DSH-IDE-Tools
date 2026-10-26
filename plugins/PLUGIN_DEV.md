# Harness custom plugin development (ProDesk)

Reference for building plugins under `data/home/plugins/`. Survives container recreate; lives on the host at `~/Containers/deepseek-harness/data/home/`.

## Directory layout

```
deepseek-harness/
  data/home/                          → /home/node/.dsh (bind mount)
    plugins/
      my-plugin/
        package.json          # dsh.bundle.patch + optional dsh.client
        cordis.patch.yml      # insert: id/name for this plugin
        lib/
          index.js            # host (Node) — required even if empty
          client.js           # browser — window.__ModuleLoader__.load(...)
    plugins-data/             # USER settings (survives upgrades) — do not commit
    profiles/web/
      package.json            # dsh.profile.bundles + link: deps
      cordis.patch.yml        # user overlays only (LLM, timezone) — not plugin inserts
      pnpm-lock.yaml
  docker-compose.yml
```

List the package in `dsh.profile.bundles` (and as a `link:` dependency). **Do not** also `- insert:` the same id in the profile `cordis.patch.yml` (duplicate loader). Suite meta-package: `packages/dsh-ide-tools`.

After changes:

```bash
cd ~/Containers/deepseek-harness
./scripts/dsh-reload.sh
```

Browser: hard refresh (Ctrl+Shift+R) only after reload exits 0.

---

## The two `inject` concepts (read this first)

Harness client plugins declare dependencies in **two places**. Mixing them up causes:

```text
Failed to load plugins
my-plugin: pending (waiting for services: @deepseek-ai/dsh-client-ui-commands, …)
```

### 1. `package.json` — bundle load order

```json
"dsh": {
  "client": {
    "platform": "web",
    "inject": [
      "@deepseek-ai/dsh-client-locale",
      "@deepseek-ai/dsh-client-runtime",
      "@deepseek-ai/dsh-client-ui-conversation",
      "@deepseek-ai/dsh-client-ui-commands",
      "@deepseek-ai/dsh-api-remotes"
    ]
  }
}
```

- Values are **npm package names** of other client bundles.
- Controls the boot graph: which scripts load before yours.
- Copy from `@deepseek-ai/dsh-client-ui-model-selection` when using `commandUi`.
- Optional: `"immediately": true` for stage-one prefetch (see `dsh-jetson-metrics`).

### 2. `lib/client.js` — Cordis service dependencies

```javascript
const inject = ["commandUi", "conversation", "sessions"];

function apply(ctx) {
  ctx.inject(["commandUi", "conversation", "sessions"], (scope) => {
    // scope.get("commandUi"), scope.get("conversation"), scope.sessions
  });
}

return { apply, inject };
```

- Values are **service names** registered on the Cordis context (`ctx.get("commandUi")`, etc.).
- Plugin fiber stays `pending` until every listed service exists.
- **Do not** use package names here. There is no `@deepseek-ai/dsh-client-ui-sessions` package.

| Service | Provided by (stock bundle) |
|---------|----------------------------|
| `slots` | `dsh-client-ui-slots` / renderer |
| `commandUi` | `dsh-client-ui-commands` |
| `conversation` | `dsh-client-ui-conversation` |
| `sessions` | client runtime / connection layer |
| `locale` | `dsh-client-locale` |
| `remote` | `dsh-api-remotes` |
| `inputTriggers` | `dsh-client-ui-input-trigger` |

---

## `lib/client.js` skeleton

```javascript
window.__ModuleLoader__.load({
  id: "my-plugin",
  factory: (require) => {
    const inject = ["slots"]; // service names only

    function apply(ctx) {
      // ctx.slots, ctx.commandUi, ctx.inject([...], scope => { ... })
    }

    return { apply, inject };
  },
});
```

`id` must match `package.json` `name` and `cordis.patch.yml` id.

## `lib/index.js` skeleton (host)

```javascript
const name = "my-plugin";
function apply() {}
export { apply, name };
```

Host half runs in Node for tools, RPC, persisted config. Browser-only plugins still need this stub.

## `package.json` skeleton

```json
{
  "name": "my-plugin",
  "type": "module",
  "main": "lib/index.js",
  "exports": {
    ".": { "default": "./lib/index.js" },
    "./client": { "default": "./lib/client.js" },
    "./package.json": "./package.json"
  },
  "dsh": {
    "client": {
      "platform": "web",
      "inject": ["@deepseek-ai/dsh-client-ui-renderer", "@deepseek-ai/dsh-client-ui-slots"]
    }
  },
  "peerDependencies": {
    "@deepseek-ai/cordis": "^4.0.1"
  }
}
```

## Profile wiring

**`profiles/web/package.json`**

```json
"dependencies": {
  "my-plugin": "link:/home/node/.dsh/plugins/my-plugin"
}
```

**`profiles/web/cordis.patch.yml`**

```yaml
- insert:
    - id: my-plugin
      name: my-plugin
```

---

## Pattern: sidebar / composer slot

**Reference:** `dsh-jetson-metrics`

```javascript
const inject = ["slots"];

function apply(ctx) {
  ctx.slots.inject("sidebar.footer.action", () => ctx.slots.register({
    name: "sidebar.footer.action",
    id: "my-widget",
    order: 25,
  }, MyWidget), "my widget");
}
```

Useful slot names (from `dsh-client-ui-conversation`):

| Slot | Use |
|------|-----|
| `sidebar.footer.action` | Sidebar footer list |
| `conversation.input.left` | Tool row, after + / access / plan |
| `conversation.input.right` | Tool row, before send |
| `conversation.input.dock` | Line above composer card |
| `conversation.input.overlay` | Floating menu shell (commands use this) |

`conversation.input.left` owner props: `{ session, input }` only — no `addImages` on the slot; get images via `conversation` service.

---

## Pattern: + commands menu (`/something`)

**Reference:** `dsh-image-upload`, stock `@deepseek-ai/dsh-client-ui-model-selection`

The **+** button toggles only the `command` slash source. To add a row beside `/cron`, `/model`, etc.:

```javascript
const inject = ["commandUi", "conversation", "sessions"];

function apply(ctx) {
  ctx.inject(["commandUi", "conversation", "sessions"], (scope) => {
    const commandUi = scope.get("commandUi");
    const conversation = scope.get("conversation");
    const sessions = scope.sessions;
    const inputHub = conversation.input;

    scope.effect(() => commandUi.register({
      name: "image",                    // shows as /image
      description: "Upload image",
      available: (session) => sessions.subagentAddress(session.sessionId) === undefined,
      ui: {
        kind: "popupSelect",            // only UI kind today
        options: async (session, signal) => { /* … */ return []; },
        onSelect: async () => {},
      },
    }), "my-plugin: /image");
  });
}
```

**Dispatch behaviour:** picking a contribution always opens `popupSelect`. For a direct file picker:

1. In `options()`, open `<input type="file">`, add files, then `commandUi.popupFor(actx).dismiss({ focusComposer: true })`.
2. Return `[]` from `options`.

**Attach images to composer:**

```javascript
const shell = conversation.input.shell(sessionId);
const images = conversation.createDraftImages(files);
if (!shell.addImages(images.map((i) => i.id))) {
  conversation.releaseDraftImages(images);
}
```

Stock Harness: images via paste/drag only; no built-in attach button in the tool row.

**Alternative (not + menu):** `inputTriggers.registerSource` adds slash-menu groups when typing `/`, but **+** only opens the `command` source — not suitable for “extra + menu row” alone.

---

## Pattern: full host plugin

**Reference:** `dsh-cron` (TypeScript, tools, `/cron` host command, sidebar UI)

- Host: `src/index.ts`, `ctx.tools.register`, `ctx.commands.register`
- Client: built to `lib/client.js`, sidebar + locales
- Requires `pnpm run build` before deploy unless you hand-write `lib/client.js` like local plugins

---

## Debugging

| Symptom | Likely cause |
|---------|----------------|
| `pending (waiting for services: @deepseek-ai/...)` | Package names in `client.js` `inject` |
| `pending (waiting for services: commandUi)` | Missing package in `package.json` `dsh.client.inject` or boot order |
| Plugin missing from UI | Not in `cordis.patch.yml` or profile `pnpm install` not run |
| `duplicate loader entry id: dsh-automation` | `dsh-automation` / `dsh-cron` listed in both `bundles` and `cordis.patch` insert |
| Web boots but shows automation CLI help | Disable `dsh-automation-startup` + `dsh-automation-app` in web `cordis.patch.yml` |
| Old client code | Hard refresh; check `curl …/plugins/my-plugin/client.js` |
| Whole app 502 | Recreate **both** `deepseek-harness` and `dsh-https` |
| Tab POSTs return **405** after a DSH bump | Host used `connection.rpc.handle` — switch to `_shared/register-rpc-channel.js` and `inject: ["connection","webServer"]` |
| Files toggle / chrome “vanishes” after bump | Hardcoded CSS-module hashes (`bhn1Oq_*`, `qDHVXG_*`, …). Prefer `[class*="_sectionHeader"]` / `qsExactLocal` / `_shared/UPGRADE.md` |
| Chips / decorations missing after bump | Feature gated on `workspaces.create` though it only needs `list` — gate on the minimum API |
| Workspace switch untouchable / always visible | Don’t leave always-on chrome — rest `width:0;opacity:0;pointer-events:none`, reveal on `[class*="_projectRow"]:hover` with `pointer-events:auto` + `forceUntil` |
| Plugin CSS loaded but rules don’t apply | Stale browser module cache still serving old hashes — hard refresh; bump `data-dsh-*` version attr |

---

## Surviving DSH upgrades (read before bumping the image pin)

Full postmortem + durable patterns: **`plugins/_shared/UPGRADE.md`**.

Burned on **0.1.1 → 0.1.5** (and how we survive the next bump):

1. **Host RPC** — never `ctx.connection.rpc.handle()`. Always `registerRpcChannel` + `inject: ["connection","webServer"]`.
2. **Client CSS modules** — never pin `.bhn1Oq_sectionHeader`. Use `[class*="_sectionHeader"]` / `qsExactLocal` / `createStockClass` (`client-dom.snippet.js`).
3. **Minimum API gates** — chips need `workspaces.list`, not `create`.
4. **Hit targets** — hover-only chrome is fine: collapse at rest (`width:0;opacity:0;pointer-events:none`), expand + `pointer-events:auto` on **row** hover. Don’t leave always-visible switch chrome as a “fix”.
5. **Codemod safety** — `rewriteClientSource` only; never raw whole-file hash replace (`"\n"` → `"\\n"`).

```bash
./plugins/_shared/check-upgrade-compat.sh
STRICT_CSS_HASH=1 ./plugins/_shared/check-upgrade-compat.sh   # optional hard fail
node plugins/_shared/rewrite-client-css-modules.js            # if hashes moved
docker compose up -d --force-recreate deepseek-harness dsh-https dsh-login
# hard-refresh the browser (Ctrl+Shift+R)
```

---

## Pattern: workbench (files in chat)

**`dsh-files`** — host filesystem Remote (`/api/files`: list/search/read/write/remove/root/stat). Used by sidebar + Code tab.

**`dsh-code-tab`** — `conversation.view` tab (`id: "code"`), capture-phase click on `[data-produced-files-row] button[title]` and `code button[title]`, dispatches `dsh-open-code-file`, reads/writes via `/api/files`.

**`dsh-sidebar-files`** — Workspaces **Sessions ↔ Files** toggle + per-workspace trees.

---

## Local plugins on this install

| Plugin | Pattern |
|--------|---------|
| `dsh-settings-polish` | Settings nav icons + remote Settings unlock + gear helper |
| `dsh-ui-polish` | Cross-cutting mobile/chrome polish (tooltips, brand, settings sheet, ZH→EN stock chrome) |
| `dsh-image-upload` | Client-only, `commandUi.register`, file picker |
| `dsh-files` | Host Remote `/api/files` for sidebar + Code tab |
| `dsh-code-tab` | Client-only, `conversation.view` Code tab (edit via `/api/files`) |
| `dsh-sidebar-files` | Sessions ↔ Files trees (client) |
| `dsh-workspace-accent` | Client-only, `theme.overrideTokens` per workspace |
| `dsh-git` | Host RPC `/git` + `conversation.view` Git tab |
| `dsh-containers` | Host RPC `/containers` + Containers tab + Settings |
| `dsh-terminal` | Host PTY RPC `/terminal` + Terminal tab |
| `dsh-database` | Host RPC `/database` (pg) + Database tab + Settings |
| `dsh-notify` | External git plugin |
| `dsh-cron` + `dsh-automation` | Full host + worker container |

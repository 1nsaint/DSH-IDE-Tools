# Shared plugin helpers (`plugins/_shared`)

Upgrade-breakage almost always comes from a few unstable upstream surfaces.
**Read [`UPGRADE.md`](./UPGRADE.md) before bumping `DSH_VERSION`.**

## `register-rpc-channel.js` (host / Node)

On DSH **0.1.5+**, `ctx.connection.rpc.handle()` registers without `webServer`
inject → routes never mount → SPA **HTTP 405** on tab RPCs.

```js
import { registerRpcChannel, ok, transportError } from "../../_shared/register-rpc-channel.js";

const inject = ["connection", "webServer"]; // both required

function apply(ctx) {
  ctx.effect(() => registerRpcChannel(ctx, "/my-plugin", async (endpoint, payload) => {
    return ok({ /* ... */ });
  }), "my-plugin: rpc");
}

export { apply, name, inject };
```

## `css-modules.js` + `client-dom.snippet.js` (client / browser)

Stock classes look like `bhn1Oq_sectionHeader`. Target the **local** name:

```css
[class*="_sectionHeader"] [class*="_headerActions"] { max-width: none !important; }
```

In JS, prefer **exact** locals so `title` does not match `titleRow`:

```js
// paste from client-dom.snippet.js
const titleEl = qsExactLocal(row, "title");
const stockClass = createStockClass({ header: "wSkVaW_" });
el.className = `${stockClass("header")} dsh-my-header`;
```

Codemod:

```bash
node plugins/_shared/rewrite-client-css-modules.js
```

Never raw-replace the whole file (nested quotes / `"\n"` → `"\\n"` breaks loaders).

## `check-upgrade-compat.sh`

```bash
./plugins/_shared/check-upgrade-compat.sh
STRICT_CSS_HASH=1 ./plugins/_shared/check-upgrade-compat.sh
```

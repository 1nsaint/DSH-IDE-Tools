// Headless smoke test: execute the client bundle factory with stub globals and
// verify the module structure (no top-level throw, load handoff, apply/inject,
// and the exact inject roster the plugin needs).
const fs = require("fs");
const path = "F:/deepseek-memony/dsh-notify/lib/client.js";
const src = fs.readFileSync(path, "utf8");

let handoff = null;
global.window = {
  __ModuleLoader__: { load: (h) => { handoff = h; } },
  addEventListener() {},
  removeEventListener() {}
};
global.document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} }
};

const dshNodeModules = "D:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/";
const req = (spec) => {
  if (spec === "react") return require(dshNodeModules + "react");
  if (spec === "react/jsx-runtime") return require(dshNodeModules + "react/jsx-runtime");
  if (spec === "@deepseek-ai/dsh-client-ui-primitives") return new Proxy({}, {
    get: (t, k) => (k in t ? t[k] : () => null)
  });
  throw new Error("unexpected require: " + spec);
};

try {
  // The bundle calls window.__ModuleLoader__.load at top level when evaluated.
  (0, eval)(src);
  if (handoff === null) throw new Error("load() was never called by the bundle");
  const result = handoff.factory(req);
  const exportsObj = result && typeof result === "object" ? result : {};
  console.log("handoff id:", handoff.id);
  console.log("exports keys:", Object.keys(exportsObj).join(","));
  console.log("has apply:", typeof exportsObj.apply === "function");
  console.log("has inject:", Array.isArray(exportsObj.inject));
  const expected = ["slots", "connection", "remote", "settingsScope", "locale", "sessions"];
  const missing = expected.filter((k) => !exportsObj.inject.includes(k));
  if (missing.length > 0) throw new Error("inject missing: " + missing.join(","));
  console.log("SMOKE TEST PASSED");
} catch (e) {
  console.error("FACTORY FAIL:", e);
  process.exit(1);
}

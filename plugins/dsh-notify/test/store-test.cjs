// Store persistence test: verify the localStorage-backed preference store
// saves on write, sanitizes bad values, and rehydrates on a fresh module load
// (simulating a page reload) — the fix for the unresponsive settings page.
const fs = require("fs");
const path = "F:/deepseek-memony/dsh-notify/lib/client.js";
const src = fs.readFileSync(path, "utf8");

// ---- localStorage stub --------------------------------------------------------
const backing = new Map();
global.localStorage = {
  getItem: (k) => (backing.has(k) ? backing.get(k) : null),
  setItem: (k, v) => { backing.set(k, String(v)); },
  removeItem: (k) => { backing.delete(k); }
};

let handoff = null;
global.window = {
  __ModuleLoader__: { load: (h) => { handoff = h; } },
  addEventListener() {},
  removeEventListener() {}
};
global.document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} },
  visibilityState: "hidden"
};

const dshNodeModules = "D:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/";
const React = require(dshNodeModules + "react");
const realUseSyncExternalStore = React.useSyncExternalStore;
React.useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) =>
  realUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot ?? getSnapshot);
const primitivesProxy = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => null) });

const load = () => {
  handoff = null;
  (0, eval)(src);
  if (handoff === null) throw new Error("load() was not called");
  return handoff.factory((spec) => {
    if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitivesProxy;
    if (spec === "react") return React;
    if (spec === "react/jsx-runtime") return require(dshNodeModules + "react/jsx-runtime");
    throw new Error("unexpected require: " + spec);
  });
};

const assert = (cond, msg) => {
  if (!cond) {
    console.error("ASSERT FAIL:", msg);
    console.error("backing:", JSON.stringify(Object.fromEntries(backing)));
    process.exit(1);
  }
};

try {
  // 1. Fresh module: defaults.
  const mod1 = load();
  let opts = mod1.test.get();
  assert(opts.enabled === true && opts.volume === 60 && opts.doneSound === "chime", "defaults mismatch: " + JSON.stringify(opts));

  // 2. Write -> store updates AND localStorage persists (sanitized).
  mod1.test.set("volume", 80);
  mod1.test.set("doneSound", "cascade");
  mod1.test.set("enabled", false);
  opts = mod1.test.get();
  assert(opts.volume === 80 && opts.doneSound === "cascade" && opts.enabled === false, "writes not reflected: " + JSON.stringify(opts));
  assert(backing.has("dsh-notify/settings/v1"), "localStorage never written");
  const saved = JSON.parse(backing.get("dsh-notify/settings/v1"));
  assert(saved.volume === 80 && saved.doneSound === "cascade" && saved.enabled === false, "persisted value wrong: " + JSON.stringify(saved));

  // 3. Bad values sanitize to defaults (never crash the page).
  mod1.test.set("doneSound", "bogus");
  mod1.test.set("questionSound", "bogus");
  mod1.test.set("volume", 999);
  opts = mod1.test.get();
  assert(opts.doneSound === "chime" && opts.questionSound === "triple" && opts.volume === 100, "sanitize failed: " + JSON.stringify(opts));

  // 4. Fresh module load (page reload): rehydrates from localStorage.
  const mod2 = load();
  opts = mod2.test.get();
  assert(opts.volume === 100 && opts.doneSound === "chime" && opts.enabled === false, "reload did not rehydrate: " + JSON.stringify(opts));

  // 5. Corrupt localStorage -> defaults, no crash.
  backing.set("dsh-notify/settings/v1", "{not json!!");
  const mod3 = load();
  opts = mod3.test.get();
  assert(opts.enabled === true && opts.volume === 60, "corrupt storage must fall back to defaults: " + JSON.stringify(opts));

  console.log("ALL STORE PERSISTENCE TESTS PASSED");
} catch (e) {
  console.error("STORE TEST FAIL:", e && e.stack ? e.stack : e);
  process.exit(1);
}

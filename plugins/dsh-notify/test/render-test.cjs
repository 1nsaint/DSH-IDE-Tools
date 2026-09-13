// Render smoke test (real primitives): evaluate the client bundle, run apply()
// against a mock ctx (with a fake sessions list), capture the slot
// registrations, and server-render the settings page using the REAL
// @deepseek-ai/dsh-client-ui-primitives components (Button) to catch
// component-level errors that stub-based testing would miss.
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
  head: { appendChild() {} },
  visibilityState: "hidden"
};

const dshNodeModules = "D:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/";
const React = require(dshNodeModules + "react");
const { renderToString } = require(dshNodeModules + "react-dom/server");
const realUseSyncExternalStore = React.useSyncExternalStore;
React.useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) =>
  realUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot ?? getSnapshot);

const primitivesPath = "D:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-client-ui-primitives/lib/index.js";

// Prototype-method scope: mimics the real SettingsScopeController, whose
// subscribe/getSnapshot/set are prototype methods relying on `this`. Passing
// them unbound to useSyncExternalStore must NOT happen.
class FakeScope {
  constructor(value, writable = true, mode = "host") {
    this.current = { status: "ready", value, base: undefined, user: value, revision: 1, writable, mode };
  }
  getSnapshot() {
    return this.current;
  }
  subscribe() {
    return () => {};
  }
  set(f, v) { console.log("[scope.set]", f, v); }
  unset(f) { console.log("[scope.unset]", f); }
}
function fakeScope(value, writable = true, mode = "host") {
  return new FakeScope(value, writable, mode);
}
const t = (k) => k;

// Fake sessions list: an observable snapshot store whose state we can drive.
class FakeSessionsList {
  constructor(initial) {
    this.state = initial;
    this.listeners = new Set();
  }
  getSnapshot() {
    return this.state;
  }
  subscribe(fn) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
  push(next) {
    this.state = next;
    for (const fn of Array.from(this.listeners)) fn();
  }
}
const sessionsList = new FakeSessionsList({
  phase: "ready",
  current: "A",
  byId: { A: { id: "A", displayTitle: "Session A", running: false, origin: void 0 } }
});

const registrations = [];
const slotInject = [];
const mockCtx = {
  effect: (fn) => {
    const result = fn();
    return () => (typeof result === "function" ? result() : undefined);
  },
  locale: { register: () => {}, bind: () => (k) => k },
  settingsScope: { bind: (spec) => fakeScope({ enabled: true, soundEnabled: true, volume: 60, doneSound: "chime", questionSound: "triple", onlyWhenHidden: false }) },
  slots: {
    inject: (key, cb) => { slotInject.push({ key, cb }); return () => {}; },
    register: (opts, comp) => { registrations.push({ opts, comp }); return () => {}; }
  },
  sessions: { list: sessionsList }
};

(async () => {
  try {
    const { pathToFileURL } = require("url");
    require("module").register("./css-loader.cjs", { parentURL: pathToFileURL(__filename).href });
    const primitives = await import(pathToFileURL(primitivesPath).href);
    const realReq = (spec) => {
      if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitives;
      if (spec === "react") return React;
      if (spec === "react/jsx-runtime") return require(dshNodeModules + "react/jsx-runtime");
      throw new Error("unexpected require: " + spec);
    };
    (0, eval)(src);
    if (handoff === null) throw new Error("load() was not called");
    const mod = handoff.factory(realReq);

    mod.apply(mockCtx);
    for (const { cb } of slotInject) cb();

    const sectionReg = registrations.find((r) => r.opts.name === "settings.section");
    if (!sectionReg) throw new Error("settings.section registration missing");
    if (sectionReg.opts.id !== "notify") throw new Error("settings.section id must be 'notify'");

    const sectionHtml = renderToString(React.createElement(sectionReg.comp, { t }));
    console.log("settings section render OK (real primitives), html length:", sectionHtml.length);

    // Watcher must be live: push a running->idle edge and make sure nothing
    // throws (Notification/AudioContext are absent here, so dispatch no-ops).
    sessionsList.push({
      phase: "ready",
      current: "A",
      byId: { A: { id: "A", displayTitle: "Session A", running: true, origin: void 0 } }
    });
    sessionsList.push({
      phase: "ready",
      current: "A",
      byId: { A: { id: "A", displayTitle: "Session A", running: false, origin: void 0 } }
    });
    console.log("watcher edge handling OK (no throw)");

    console.log("ALL RENDER SMOKE TESTS PASSED (real primitives)");
  } catch (e) {
    console.error("RENDER TEST FAIL:", e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();

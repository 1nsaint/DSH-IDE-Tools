// Watcher behavior test: stub the browser surfaces (Notification + Web Audio),
// drive the sessions list snapshot through real transitions, and verify the
// plugin fires exactly the right events with clearly DIFFERENT sounds:
//   - done:     top-level session running true->false  -> notification + sine chime
//   - question: pendingInteraction appears             -> notification + square beeps
// plus option suppression (enabled=false, onlyWhenHidden+visible) and the
// per-session done debounce.
const fs = require("fs");
const path = "F:/deepseek-memony/dsh-notify/lib/client.js";
const src = fs.readFileSync(path, "utf8");

// ---- browser stubs ---------------------------------------------------------
const notifications = [];
global.Notification = class {
  constructor(title, opts) {
    this.title = title;
    this.opts = opts;
    notifications.push({ title, opts });
  }
  static permission = "granted";
  static requestPermission() {
    return Promise.resolve("granted");
  }
};
const oscRecords = [];
global.window = {
  __ModuleLoader__: { load: (h) => { handoff = h; } },
  addEventListener() {},
  removeEventListener() {},
  AudioContext: class {
    constructor() {
      this.state = "running";
      this.currentTime = 0;
      this.destination = {};
    }
    resume() { this.state = "running"; return Promise.resolve(); }
    createGain() {
      return {
        gain: { value: 1, setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {}
      };
    }
    createOscillator() {
      const osc = { type: "sine", frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
      oscRecords.push(osc);
      return osc;
    }
  }
};
global.document = {
  querySelector: () => null,
  createElement: () => ({ dataset: {}, setAttribute() {}, appendChild() {} }),
  head: { appendChild() {} },
  visibilityState: "hidden"
};

// ---- fake sessions list ------------------------------------------------------
class FakeSessionsList {
  constructor(initial) {
    this.state = initial;
    this.listeners = new Set();
  }
  getSnapshot() { return this.state; }
  subscribe(fn) { this.listeners.add(fn); return () => this.listeners.delete(fn); }
  push(next) { this.state = next; for (const fn of Array.from(this.listeners)) fn(); }
}
const sessionsList = new FakeSessionsList({ phase: "ready", current: void 0, byId: {} });
const summary = (id, over) => ({ id, displayTitle: "Session " + id, running: false, origin: void 0, ...over });
const state = (entries) => {
  const byId = {};
  for (const s of entries) byId[s.id] = s;
  return { phase: "ready", current: entries.length > 0 ? entries[0].id : void 0, byId };
};

// ---- load the bundle and apply ----------------------------------------------
let handoff = null;
const dshNodeModules = "D:/nodejs/node_global/node_modules/@deepseek-ai/dsh/node_modules/";
const React = require(dshNodeModules + "react");
const realUseSyncExternalStore = React.useSyncExternalStore;
React.useSyncExternalStore = (subscribe, getSnapshot, getServerSnapshot) =>
  realUseSyncExternalStore(subscribe, getSnapshot, getServerSnapshot ?? getSnapshot);
const primitivesProxy = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => null) });

const mockCtx = {
  effect: (fn) => {
    const r = fn();
    return () => (typeof r === "function" ? r() : undefined);
  },
  locale: { register: () => {}, bind: () => (k) => k },
  // The native settings mirror is optional; a no-op scope proves the store
  // keeps working when the transport is unavailable.
  settingsScope: { bind: () => ({ set: () => {}, unset: () => {} }) },
  slots: {
    inject: () => () => {},
    register: () => () => {}
  },
  sessions: { list: sessionsList }
};

const assert = (cond, msg) => {
  if (!cond) {
    console.error("ASSERT FAIL:", msg);
    console.error("notifications:", JSON.stringify(notifications, null, 2));
    console.error("oscillators:", oscRecords.map((o) => ({ type: o.type, f: o.frequency.value })));
    process.exit(1);
  }
};

try {
  (0, eval)(src);
  if (handoff === null) throw new Error("load() was not called");
  const mod = handoff.factory((spec) => {
    if (spec === "@deepseek-ai/dsh-client-ui-primitives") return primitivesProxy;
    if (spec === "react") return React;
    if (spec === "react/jsx-runtime") return require(dshNodeModules + "react/jsx-runtime");
    throw new Error("unexpected require: " + spec);
  });
  mod.apply(mockCtx);

  const tags = () => notifications.map((n) => n.opts.tag);
  const lastOscs = (n) => oscRecords.slice(-n).map((o) => ({ type: o.type, f: Math.round(o.frequency.value * 100) / 100 }));

  // 1. Initial snapshot: record state only, no events.
  sessionsList.push(state([summary("A", { running: true })]));
  assert(notifications.length === 0, "initial running state must not notify");
  assert(oscRecords.length === 0, "initial state must not play sound");

  // 2. Done edge: A running true -> false => done notification + done chime (sine).
  sessionsList.push(state([summary("A", { running: false })]));
  assert(notifications.length === 1, "done edge must notify once");
  assert(tags()[0] === "dsh-notify-done-A", "done tag must carry session id, got " + tags()[0]);
  assert(oscRecords.length === 3, "done chime must play 3 notes, got " + oscRecords.length);
  const doneOscs = lastOscs(3);
  assert(doneOscs.every((o) => o.type === "sine"), "done chime must be sine (soft), got " + JSON.stringify(doneOscs));
  assert(JSON.stringify(doneOscs.map((o) => o.f)) === JSON.stringify([523.25, 659.25, 783.99]), "done chime must be ascending C5-E5-G5, got " + JSON.stringify(doneOscs));

  // 3. Debounce: A runs and finishes again immediately -> suppressed.
  sessionsList.push(state([summary("A", { running: true })]));
  sessionsList.push(state([summary("A", { running: false })]));
  assert(notifications.length === 1, "done debounce must suppress the second edge");

  // 4. Question edge: A gains pendingInteraction "question" -> question event.
  sessionsList.push(state([summary("A", { running: false, pendingInteraction: "question" })]));
  assert(notifications.length === 2, "question edge must notify once");
  assert(tags()[1] === "dsh-notify-question-A", "question tag must carry session id");
  assert(oscRecords.length === 6, "question chime must play 3 notes after the 3 done notes");
  const qOscs = lastOscs(3);
  assert(qOscs.every((o) => o.type === "square"), "question chime must be square (urgent), got " + JSON.stringify(qOscs));
  assert(JSON.stringify(qOscs.map((o) => o.f)) === JSON.stringify([880, 880, 1174.66]), "question chime must be the triple beep, got " + JSON.stringify(qOscs));
  assert(qOscs[0].f !== doneOscs[0].f || qOscs[0].type !== doneOscs[0].type, "done and question sounds must differ");
  // pending resolves -> no extra event.
  sessionsList.push(state([summary("A", { running: false })]));
  assert(notifications.length === 2, "pending resolution must not notify");

  // 5. enabled=false suppresses everything (fresh session B).
  mod.test.set("enabled", false);
  sessionsList.push(state([summary("A"), summary("B", { running: true })]));
  sessionsList.push(state([summary("A"), summary("B", { running: false })]));
  assert(notifications.length === 2, "disabled plugin must not notify");

  // 6. onlyWhenHidden + visible suppresses; hidden allows (session C).
  mod.test.set("enabled", true);
  mod.test.set("onlyWhenHidden", true);
  global.document.visibilityState = "visible";
  sessionsList.push(state([summary("A"), summary("C", { running: true })]));
  sessionsList.push(state([summary("A"), summary("C", { running: false })]));
  assert(notifications.length === 2, "visible tab with onlyWhenHidden must stay quiet");
  global.document.visibilityState = "hidden";
  sessionsList.push(state([summary("A"), summary("C", { running: true })]));
  sessionsList.push(state([summary("A"), summary("C", { running: false })]));
  assert(notifications.length === 3, "hidden tab with onlyWhenHidden must notify");
  assert(tags()[2] === "dsh-notify-done-C", "third event must be C's done");

  // 7. Subagent sessions never fire done (session D is a subagent).
  global.document.visibilityState = "hidden";
  mod.test.set("onlyWhenHidden", false);
  sessionsList.push(state([summary("A"), summary("D", { running: true, origin: "subagent" })]));
  sessionsList.push(state([summary("A"), summary("D", { running: false, origin: "subagent" })]));
  assert(notifications.length === 3, "subagent completion must not fire done");

  console.log("notifications fired:", notifications.length);
  console.log("done sound:", JSON.stringify(doneOscs));
  console.log("question sound:", JSON.stringify(qOscs));
  console.log("ALL WATCHER TESTS PASSED");
} catch (e) {
  console.error("WATCHER TEST FAIL:", e && e.stack ? e.stack : e);
  process.exit(1);
}

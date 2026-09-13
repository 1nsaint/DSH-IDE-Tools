// Host half test: import lib/index.js (ESM, resolved through the
// node_modules/@deepseek-ai junction) and verify apply() installs the
// user-settings section under the expected namespace.
const { pathToFileURL } = require("url");

(async () => {
  try {
    const mod = await import(pathToFileURL("F:/deepseek-memony/dsh-notify/lib/index.js").href);
    console.log("host exports:", Object.keys(mod).join(","));
    if (typeof mod.apply !== "function") throw new Error("host apply missing");

    const registered = [];
    const settings = {
      register: (ns, schema, opts) => {
        // schemastery z.object returns a function-shaped Schema, so test truthiness.
        registered.push({ ns, hasSchema: !!schema, opts });
        return { get: () => ({}), watch: () => () => {} };
      }
    };
    const mockCtx = {
      inject: (services, cb) => {
        if (Array.isArray(services) && services.includes("settings")) cb(mockCtx);
        return () => {};
      },
      effect: (fn) => {
        const r = fn();
        return () => (typeof r === "function" ? r() : undefined);
      },
      settings
    };
    mod.apply(mockCtx, {});
    if (registered.length !== 1) throw new Error("settings section must register once, got " + registered.length);
    if (registered[0].ns !== "dsh-notify") throw new Error("namespace mismatch: " + registered[0].ns);
    if (!registered[0].hasSchema) throw new Error("schema missing");
    console.log("HOST TEST PASSED (settings section registered)");
  } catch (e) {
    console.error("HOST TEST FAIL:", e && e.stack ? e.stack : e);
    process.exit(1);
  }
})();

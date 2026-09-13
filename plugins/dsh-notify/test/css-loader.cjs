// Node ESM loader hook: treat .css imports as empty modules (the browser shell
// bundles CSS separately; this only lets the smoke test import the real
// primitives implementation in Node).
module.exports = {
  load: async (url, context, nextLoad) => {
    if (url.endsWith(".css")) {
      return { format: "module", source: "export default {}", shortCircuit: true };
    }
    return nextLoad(url, context);
  }
};

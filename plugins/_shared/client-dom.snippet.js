/**
 * Paste this block near the top of a ModuleLoader `factory:` (client.js).
 * ModuleLoader cannot import from `_shared/` — keep this in sync with
 * `css-modules.js` (`hasLocal`, `qsExactLocal`, `createStockClass`).
 *
 * Usage:
 *   const titleEl = qsExactLocal(row, "title"); // not titleRow
 *   const stockClass = createStockClass({ header: "wSkVaW_", tab: "wSkVaW_" });
 *   el.className = stockClass("header");
 */
function hasLocal(el, local) {
	if (!el || !el.classList) return false;
	const name = String(local || "").replace(/^_+/, "");
	for (const c of el.classList) {
		if (c === name || c.endsWith("_" + name)) return true;
	}
	return false;
}
function attrSel(local) {
	return '[class*="_' + String(local || "").replace(/^_+/, "") + '"]';
}
function qsExactLocal(root, local) {
	if (!root || !root.querySelectorAll) return null;
	const name = String(local || "").replace(/^_+/, "");
	for (const el of root.querySelectorAll(attrSel(name))) {
		if (hasLocal(el, name)) return el;
	}
	return null;
}
function createStockClass(fallbackByLocal, defaultPrefix) {
	const cache = new Map();
	const fallbacks = fallbackByLocal || {};
	const fallback = defaultPrefix || "wSkVaW_";
	return function stockClass(local) {
		const name = String(local || "").replace(/^_+/, "");
		if (cache.has(name)) return cache.get(name) + name;
		let prefix = fallbacks[name] || fallback;
		const el = qsExactLocal(document, name);
		if (el) {
			for (const c of el.classList) {
				if (c.endsWith("_" + name) && c.length > name.length + 1) {
					prefix = c.slice(0, c.length - name.length);
					break;
				}
			}
		}
		cache.set(name, prefix);
		return prefix + name;
	};
}

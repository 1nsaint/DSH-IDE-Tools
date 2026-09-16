/**
 * Upgrade-safe CSS-module / DOM helpers for DSH client plugins.
 *
 * Stock UI classes look like `bhn1Oq_sectionHeader`. The local name
 * (`sectionHeader`) is stable across releases; the hash prefix (`bhn1Oq_`)
 * changes whenever upstream rebuilds CSS modules. Hardcoding the full class
 * is the #1 reason our plugins silently break on DSH bumps.
 *
 * ModuleLoader factories cannot `import` ESM from `_shared/` today — either:
 *   1. copy the small helpers from `client-dom.snippet.js` into the factory, or
 *   2. run `rewrite-client-css-modules.js` after editing selectors.
 *
 * This module is the Node/codemod + documentation source of truth.
 */

/**
 * Attribute selector that matches a CSS-module local class regardless of hash.
 * Example: attrSel("sectionHeader") → `[class*="_sectionHeader"]`
 *
 * WARNING: this is a *substring* match. Prefer `qsExactLocal` in JS when
 * `title` must not also match `titleRow` / `titleCluster`.
 *
 * @param {string} local
 */
export function attrSel(local) {
	const name = String(local || "").replace(/^_+/, "");
	if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) {
		throw new Error(`css-modules attrSel: bad local name ${JSON.stringify(local)}`);
	}
	return `[class*="_${name}"]`;
}

/**
 * Chain locals into one compound selector (AND on the same element).
 * Example: attrSelAll("root", "rail") → `[class*="_root"][class*="_rail"]`
 * @param {...string} locals
 */
export function attrSelAll(...locals) {
	return locals.map(attrSel).join("");
}

/**
 * Descendant selector across hashed modules.
 * Example: attrPath("sectionHeader", "headerActions")
 *   → `[class*="_sectionHeader"] [class*="_headerActions"]`
 * @param {...string} locals
 */
export function attrPath(...locals) {
	return locals.map(attrSel).join(" ");
}

/**
 * True if `el` carries a CSS-module class whose **exact** local name is `local`.
 * `hasLocal(el, "title")` is true for `YDXeBa_title`, false for `YDXeBa_titleRow`.
 * @param {Element | null | undefined} el
 * @param {string} local
 */
export function hasLocal(el, local) {
	if (!el || !el.classList) return false;
	const name = String(local || "").replace(/^_+/, "");
	for (const c of el.classList) {
		if (c === name || c.endsWith(`_${name}`)) return true;
	}
	return false;
}

/**
 * querySelector using a local CSS-module name (substring attr selector).
 * Prefer `qsExactLocal` when siblings share a prefix (title / titleRow).
 * @param {string} local
 * @param {ParentNode} [root]
 */
export function qsLocal(local, root = typeof document !== "undefined" ? document : undefined) {
	if (!root?.querySelector) return null;
	return root.querySelector(attrSel(local));
}

/**
 * querySelectorAll using a local CSS-module name (substring).
 * @param {string} local
 * @param {ParentNode} [root]
 */
export function qsaLocal(local, root = typeof document !== "undefined" ? document : undefined) {
	if (!root?.querySelectorAll) return [];
	return [...root.querySelectorAll(attrSel(local))];
}

/**
 * First descendant whose classList has an **exact** CSS-module local name.
 * Safe for `title` vs `titleRow`, `folder` vs `folderActive`, etc.
 * @param {ParentNode | null | undefined} root
 * @param {string} local
 */
export function qsExactLocal(root, local) {
	if (!root?.querySelectorAll) return null;
	const name = String(local || "").replace(/^_+/, "");
	const nodes = root.querySelectorAll(attrSel(name));
	for (const el of nodes) {
		if (hasLocal(el, name)) return el;
	}
	return null;
}

/**
 * All descendants with an exact CSS-module local name.
 * @param {ParentNode | null | undefined} root
 * @param {string} local
 */
export function qsaExactLocal(root, local) {
	if (!root?.querySelectorAll) return [];
	const name = String(local || "").replace(/^_+/, "");
	return [...root.querySelectorAll(attrSel(name))].filter((el) => hasLocal(el, name));
}

/**
 * Discover the current hash prefix for a known local class from live DOM.
 * Returns e.g. `"bhn1Oq_"` or `null` if not found yet.
 * @param {string} local
 * @param {ParentNode} [root]
 */
export function discoverPrefix(local, root = typeof document !== "undefined" ? document : undefined) {
	const el = qsExactLocal(root, local) || qsLocal(local, root);
	if (!el) return null;
	const name = String(local).replace(/^_+/, "");
	const suffix = `_${name}`;
	for (const c of el.classList) {
		if (c.endsWith(suffix) && c.length > suffix.length) {
			return c.slice(0, c.length - name.length); // includes trailing _
		}
	}
	return null;
}

/**
 * Build a `stockClass(local)` helper that invents live hashed class names for
 * DOM we create (stock CSS still needs the real hash). Falls back to
 * `fallbackPrefix` until the DOM has mounted.
 *
 * @param {Record<string, string>} [fallbackByLocal] map local → full prefix e.g. `{ header: "wSkVaW_" }`
 * @param {string} [defaultPrefix="wSkVaW_"]
 */
export function createStockClass(fallbackByLocal = {}, defaultPrefix = "wSkVaW_") {
	const cache = new Map();
	return function stockClass(local) {
		const name = String(local || "").replace(/^_+/, "");
		if (cache.has(name)) return cache.get(name) + name;
		const live = discoverPrefix(name);
		const prefix = live || fallbackByLocal[name] || defaultPrefix;
		cache.set(name, prefix);
		return prefix + name;
	};
}

const DEFAULT_PREFIXES = [
	"bhn1Oq",
	"qDHVXG",
	"YDXeBa",
	"hHd-Xa",
	"wSkVaW",
	"uV2eYG",
	"k-1LKG",
	"pI_x6G",
	"VOzbGW",
];

/**
 * Rewrite a CSS text blob: `.hash_local` → `[class*="_local"]`.
 * Only touches known DSH-style hashes. Keeps our own `.dsh-*`.
 * @param {string} source
 * @param {{ prefixes?: string[] }} [opts]
 */
export function rewriteHashedSelectors(source, opts = {}) {
	const prefixes = opts.prefixes || DEFAULT_PREFIXES;
	const prefixAlt = prefixes.map(escapeRegExp).join("|");
	const re = new RegExp(`\\.(?:${prefixAlt})_([A-Za-z][A-Za-z0-9]*)`, "g");
	return String(source).replace(re, '[class*="_$1"]');
}

/**
 * Safely rewrite a ModuleLoader `client.js` source:
 * - CSS inside template literals
 * - selector string literals → single-quoted `[class*="_local"]` forms
 *
 * Do **not** naively replace across the whole file: that nests `"` inside `"`
 * and produces SyntaxError. Also never rewrite escape-only strings like `"\n"`
 * (that broke xterm `loadScriptText` with `.join("\\n")`).
 *
 * @param {string} source
 * @param {{ prefixes?: string[] }} [opts]
 */
export function rewriteClientSource(source, opts = {}) {
	const prefixes = opts.prefixes || DEFAULT_PREFIXES;
	const prefixAlt = prefixes.map(escapeRegExp).join("|");
	const hashClass = new RegExp(`\\.(?:${prefixAlt})_([A-Za-z][A-Za-z0-9]*)`, "g");

	let out = String(source).replace(/`([\s\S]*?)`/g, (full, body) => {
		hashClass.lastIndex = 0;
		if (!hashClass.test(body)) return full;
		hashClass.lastIndex = 0;
		if (!body.includes("{")) return full;
		return `\`${rewriteHashedSelectors(body, { prefixes })}\``;
	});

	out = out.replace(/(["'`])((?:\\.|[^\\])*?)\1/g, (full, _quote, body) => {
		// Never touch tiny escape-only strings ("\n", "\t", …) — doubling \\ breaks loaders.
		if (/^\\[nrtv0"'\\]$/.test(body)) return full;
		hashClass.lastIndex = 0;
		if (!hashClass.test(body)) return full;
		hashClass.lastIndex = 0;
		if (body.includes("://") || body.startsWith("./") || body.startsWith("../")) return full;
		if (/^dsh-/.test(body.trim())) return full;
		if (!/^[.#\[:a-zA-Z*]/.test(body.trim()) && !body.includes(".")) return full;
		if (!body.includes(".")) return full;
		const rewritten = body.replace(hashClass, '[class*="_$1"]');
		if (rewritten === body) return full;
		return `'${rewritten.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
	});

	// classList.contains("hash_local") → endsWith check (upgrade-safe)
	const containsRe = new RegExp(
		`([A-Za-z_$][\\w$]*)\\.classList\\.contains\\((["'])(?:${prefixAlt})_([A-Za-z][A-Za-z0-9]*)\\2\\)`,
		"g",
	);
	out = out.replace(
		containsRe,
		(_, obj, _q, local) => `[...${obj}.classList].some((c) => c === "${local}" || c.endsWith("_${local}"))`,
	);

	return out;
}

function escapeRegExp(s) {
	return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

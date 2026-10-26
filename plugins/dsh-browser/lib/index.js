/**
 * dsh-browser — host half: fetch pages for the in-app browser (srcdoc + picker),
 * plus Live Server under /api/browser-live/<sessionId>/… (same-origin static serve).
 * Remote Live = same-origin gate (/api/browser-gate/…) so Inspect works on the live DOM.
 * Snapshot kept optional. Live Server under /api/browser-live/….
 */
import fs from "node:fs/promises";
import path from "node:path";
import { createReadStream } from "node:fs";
import { statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { registerRpcChannel } from "../../_shared/register-rpc-channel.js";
import { CHROME_UA, isCloudflareChallenge, cloudflareErrorMessage, cloudflareDone } from "./cf.js";
import { loadConfig, saveConfig } from "./config.js";
import { remoteBrowser, testCdpHttp } from "./cdp.js";
import {
	assertNotLooping,
	recordFailure,
	recordSuccess,
	recordPageText,
	detectDeadEndPage,
	rememberSnapshot,
	formatCompactSnapshot,
	getActivity,
	enrichInteractionError,
} from "./guardrails.js";

// Relative import to dsh-tools package hosted in dsh-cron's node_modules or global dsh
let defineTool;
try {
	const mod = await import("../../dsh-cron/node_modules/@deepseek-ai/dsh-tools/lib/index.js");
	defineTool = mod.defineTool;
} catch {
	try {
		const mod = await import("/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-tools/lib/index.js");
		defineTool = mod.defineTool;
	} catch (err) {
		console.warn("[dsh-browser] could not import defineTool:", err);
	}
}

let AttachmentId;
let AttachmentError;
async function loadAttachment() {
	const candidates = [
		"../../dsh-cron/node_modules/@deepseek-ai/dsh-attachment/lib/index.js",
		"/home/node/.dsh/profiles/node_modules/@deepseek-ai/dsh-attachment/lib/index.js",
		"/usr/local/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-attachment/lib/index.js",
	];
	for (const p of candidates) {
		try {
			const att = await import(p);
			AttachmentId = att.AttachmentId;
			AttachmentError = att.AttachmentError;
			return;
		} catch {
			/* try next */
		}
	}
	console.warn("[dsh-browser] could not import dsh-attachment");
}
await loadAttachment();

const name = "dsh-browser";
const inject = ["connection", "webServer"];
const RPC_CHANNEL = "/browser";
const LIVE_PREFIX = "/api/browser-live";
const GATE_PREFIX = "/api/browser-gate";
const MAX_BYTES = 2_500_000;
const MAX_GATE_BYTES = 8_000_000;

/**
 * Host → Browser-tab command queue.
 *
 * Agent tools run on the host; the live iframe only exists in the open UI.
 * Host `connection.rpc` has no `.call`, so tools cannot reach the client
 * directly. Instead tools enqueue here; the Browser client long-polls
 * `agent.claim` / posts `agent.complete`.
 *
 * @type {Map<string, {
 *   cmd: object,
 *   claimed: boolean,
 *   resolve: (v: unknown) => void,
 *   reject: (e: Error) => void,
 *   timer: NodeJS.Timeout,
 * }>}
 */
const agentCommands = new Map();
/** @type {Array<() => void>} */
const agentClaimWaiters = [];

function wakeClaimWaiters() {
	while (agentClaimWaiters.length) {
		const wake = agentClaimWaiters.shift();
		try { wake?.(); } catch { /* ignore */ }
	}
}

/**
 * @param {object} cmd
 * @param {number} [timeoutMs]
 */
function enqueueAgentCommand(cmd, timeoutMs = 45_000) {
	const id = `cmd_${randomUUID()}`;
	return new Promise((resolve, reject) => {
		const entry = {
			cmd: { id, ...cmd },
			claimed: false,
			resolve,
			reject,
			timer: setTimeout(() => {
				agentCommands.delete(id);
				reject(new Error(
					"Timed out waiting for the Browser tab. Keep Harness open and leave Browser available (or use split view).",
				));
			}, timeoutMs),
		};
		agentCommands.set(id, entry);
		wakeClaimWaiters();
	});
}

function claimNextAgentCommand() {
	for (const entry of agentCommands.values()) {
		if (!entry.claimed) {
			entry.claimed = true;
			return entry.cmd;
		}
	}
	return null;
}

/**
 * @param {number} waitMs
 */
async function claimAgentCommand(waitMs) {
	const immediate = claimNextAgentCommand();
	if (immediate || waitMs <= 0) return immediate;
	await new Promise((resolve) => {
		const timer = setTimeout(() => {
			const i = agentClaimWaiters.indexOf(wake);
			if (i >= 0) agentClaimWaiters.splice(i, 1);
			resolve();
		}, waitMs);
		const wake = () => {
			clearTimeout(timer);
			resolve();
		};
		agentClaimWaiters.push(wake);
	});
	return claimNextAgentCommand();
}

/**
 * @param {string} id
 * @param {unknown} result
 */
function completeAgentCommand(id, result) {
	const entry = agentCommands.get(id);
	if (!entry) return false;
	clearTimeout(entry.timer);
	agentCommands.delete(id);
	entry.resolve(result);
	return true;
}

const MIME = {
	html: "text/html; charset=utf-8",
	htm: "text/html; charset=utf-8",
	css: "text/css; charset=utf-8",
	js: "text/javascript; charset=utf-8",
	mjs: "text/javascript; charset=utf-8",
	json: "application/json; charset=utf-8",
	svg: "image/svg+xml",
	png: "image/png",
	jpg: "image/jpeg",
	jpeg: "image/jpeg",
	gif: "image/gif",
	webp: "image/webp",
	ico: "image/x-icon",
	bmp: "image/bmp",
	woff: "font/woff",
	woff2: "font/woff2",
	ttf: "font/ttf",
	otf: "font/otf",
	wasm: "application/wasm",
	map: "application/json",
	txt: "text/plain; charset=utf-8",
	md: "text/plain; charset=utf-8",
	xml: "application/xml",
	pdf: "application/pdf",
};

function ok(value) {
	return { ok: true, value };
}

function transportError(error) {
	return {
		ok: false,
		error: {
			code: "internal",
			message: error instanceof Error ? error.message : String(error),
			details: {},
		},
	};
}

function assertHttpUrl(raw) {
	let u;
	try {
		u = new URL(String(raw || "").trim());
	} catch {
		throw new Error("invalid url");
	}
	if (u.protocol !== "http:" && u.protocol !== "https:") {
		throw new Error("only http(s) urls are allowed");
	}
	return u;
}

function sessionCwd(ctx, sessionId) {
	if (typeof sessionId !== "string" || !sessionId.trim()) {
		throw new Error("sessionId required");
	}
	const sessions = ctx.get?.("sessions");
	const session = sessions?.get?.(sessionId.trim());
	const cwd = session?.header?.cwd;
	if (typeof cwd !== "string" || !cwd) {
		throw new Error("session has no workspace cwd");
	}
	return cwd;
}

/** Active agent session (for tool-time workspace → Live rewrites). */
function currentInitiatorSession(scope) {
	try {
		const agents = scope?.get?.("agents") || scope?.agents;
		const initiator = agents?.currentInitiator?.();
		const session = initiator?.session;
		if (!session) return null;
		const id = session.id || session.header?.id;
		const cwd = session.header?.cwd;
		if (!id || typeof cwd !== "string" || !cwd) return null;
		return { id: String(id), cwd: String(cwd), session };
	} catch {
		return null;
	}
}

/**
 * Turn file://, /workspace/…, or relative HTML paths into /api/browser-live/….
 * Leaves real http(s) / live / gate URLs alone.
 */
async function resolveNavigateUrl(scope, raw) {
	const original = String(raw || "").trim();
	if (!original) throw new Error("url required");
	if (original.includes("/api/browser-live/") || original.includes("/api/browser-gate/")) {
		return original;
	}
	if (/^https?:\/\//i.test(original) && !/^https?:\/\/file[:/]/i.test(original)) {
		return original;
	}
	if (original.startsWith("data:")) return original;

	let pathish = original;
	// Undo botched client normalize: https://file://… or https://file/…
	if (/^https?:\/\/file:/i.test(pathish)) {
		pathish = pathish.replace(/^https?:\/\//i, "");
	} else if (/^https?:\/\/file\//i.test(pathish)) {
		pathish = pathish.replace(/^https?:\/\/file/i, "file://");
	}

	if (/^file:/i.test(pathish)) {
		try {
			const u = new URL(pathish);
			if (u.hostname && u.hostname !== "localhost" && u.hostname !== "") {
				pathish = `/${u.hostname}${u.pathname || ""}`;
			} else {
				pathish = u.pathname || "/";
			}
		} catch {
			pathish = pathish.replace(/^file:\/\/*/i, "/");
		}
	}

	try {
		pathish = decodeURIComponent(pathish);
	} catch {
		/* keep */
	}
	pathish = pathish.replace(/\\/g, "/").trim();
	if (!pathish) throw new Error("empty path after normalizing file URL");

	const cur = currentInitiatorSession(scope);
	if (!cur) {
		throw new Error(
			"Workspace/file URLs need an active session. Open a http(s) URL, or keep the chat session open.",
		);
	}

	let absCandidate = pathish;
	if (!path.isAbsolute(absCandidate)) {
		absCandidate = path.resolve(cur.cwd, absCandidate);
	} else {
		absCandidate = path.resolve(absCandidate);
	}

	let rel;
	try {
		rel = toRelUnderCwd(cur.cwd, absCandidate);
	} catch {
		// Agent often uses /workspace/<cwd-basename>/… while cwd is already that folder.
		const base = path.basename(cur.cwd);
		const marker = `/workspace/${base}/`;
		const lower = absCandidate.toLowerCase();
		const idx = lower.indexOf(marker.toLowerCase());
		if (idx >= 0) {
			rel = absCandidate.slice(idx + marker.length).replace(/^\/+/, "") || ".";
			rel = toRelUnderCwd(cur.cwd, path.resolve(cur.cwd, rel));
		} else if (lower.includes("/workspace/")) {
			const after = absCandidate.slice(lower.indexOf("/workspace/") + "/workspace/".length);
			rel = toRelUnderCwd(cur.cwd, path.resolve(cur.cwd, after));
		} else {
			throw new Error(`path escapes workspace: ${pathish}`);
		}
	}

	let st;
	const abs = resolveUnderCwd(cur.cwd, rel === "." ? "." : rel);
	try {
		st = await fs.stat(abs);
	} catch {
		throw new Error(`file not found: ${rel}`);
	}
	if (st.isDirectory()) {
		rel = rel === "." ? "index.html" : `${rel.replace(/\/$/, "")}/index.html`;
		try {
			await fs.stat(resolveUnderCwd(cur.cwd, rel));
		} catch {
			throw new Error("directory has no index.html");
		}
	}

	return liveUrlFor(cur.id, rel);
}

/** Resolve rel under workspace cwd; reject path escape. */
function resolveUnderCwd(cwd, rel = ".") {
	const root = path.resolve(cwd);
	const abs = path.resolve(root, typeof rel === "string" && rel.trim() ? rel.trim() : ".");
	if (abs !== root && !abs.startsWith(root + path.sep)) {
		throw new Error("path escapes workspace");
	}
	return abs;
}

/** Absolute or relative workspace path → posix-ish relative under cwd. */
function toRelUnderCwd(cwd, filePath) {
	const root = path.resolve(cwd);
	const abs = path.isAbsolute(filePath)
		? path.resolve(filePath)
		: resolveUnderCwd(cwd, filePath);
	if (abs !== root && !abs.startsWith(root + path.sep)) {
		throw new Error("path escapes workspace");
	}
	if (abs === root) return ".";
	return path.relative(root, abs).split(path.sep).join("/");
}

function liveUrlFor(sessionId, relPosix) {
	const sid = encodeURIComponent(String(sessionId).trim());
	const rel = String(relPosix || ".").replace(/^\/+/, "");
	if (!rel || rel === ".") return `${LIVE_PREFIX}/${sid}/`;
	const encoded = rel.split("/").map(encodeURIComponent).join("/");
	return `${LIVE_PREFIX}/${sid}/${encoded}`;
}

function mimeFor(filePath) {
	const ext = path.extname(filePath).slice(1).toLowerCase();
	return MIME[ext] || "application/octet-stream";
}

async function dirSiblingMtimeMax(fileAbs) {
	let max = (await fs.stat(fileAbs)).mtimeMs;
	const dir = path.dirname(fileAbs);
	try {
		const ents = await fs.readdir(dir, { withFileTypes: true });
		for (const e of ents) {
			if (!e.isFile()) continue;
			try {
				const st = await fs.stat(path.join(dir, e.name));
				if (st.mtimeMs > max) max = st.mtimeMs;
			} catch {
				/* ignore */
			}
		}
	} catch {
		/* ignore */
	}
	return Math.floor(max);
}

const LIVE_RELOAD_JS = `
(() => {
  if (window.__dshLiveReload) return;
  window.__dshLiveReload = true;
  const pollUrl = new URL(location.href);
  pollUrl.searchParams.set("__dsh_live", "1");
  let last = null;
  const tick = async () => {
    try {
      const r = await fetch(pollUrl.href, { cache: "no-store" });
      if (!r.ok) return;
      const j = await r.json();
      if (typeof j.mtime !== "number") return;
      if (last != null && j.mtime !== last) location.reload();
      last = j.mtime;
    } catch {}
  };
  tick();
  setInterval(tick, 900);
})();
`;

function injectLiveReload(html) {
	const script = `<script>${LIVE_RELOAD_JS}</script>`;
	if (/<\/body>/i.test(html)) return html.replace(/<\/body>/i, `${script}</body>`);
	return `${html}${script}`;
}

/** Picker + navigation shim injected into fetched HTML. */
const INJECT_JS = `
(() => {
  if (window.__dshBrowserPicker) return;
  const state = { select: false, hover: null };
  const box = document.createElement("div");
  box.id = "dsh-browser-hover";
  Object.assign(box.style, {
    position: "fixed", pointerEvents: "none", zIndex: "2147483646",
    border: "2px solid #14b8a6", background: "rgba(20,184,166,0.12)",
    display: "none", boxSizing: "border-box"
  });
  const label = document.createElement("div");
  label.id = "dsh-browser-label";
  Object.assign(label.style, {
    position: "fixed", pointerEvents: "none", zIndex: "2147483647",
    background: "#0f172a", color: "#e2e8f0", font: "11px/1.2 ui-monospace,monospace",
    padding: "2px 6px", borderRadius: "4px", display: "none", maxWidth: "60vw",
    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis"
  });
  const mount = () => {
    if (!document.documentElement) return;
    if (!box.isConnected) document.documentElement.appendChild(box);
    if (!label.isConnected) document.documentElement.appendChild(label);
  };

  function cssPath(el) {
    if (!(el instanceof Element)) return "";
    try {
      if (el.id) return "#" + CSS.escape(el.id);
    } catch {
      if (el.id) return "#" + el.id.replace(/([^a-zA-Z0-9_-])/g, "\\$1");
    }
    const parts = [];
    let cur = el;
    while (cur && cur.nodeType === 1 && parts.length < 6) {
      let part = cur.tagName.toLowerCase();
      try {
        if (cur.classList && cur.classList.length) {
          part += "." + [...cur.classList].slice(0, 3).map((c) => {
            try { return CSS.escape(c); } catch { return c.replace(/([^a-zA-Z0-9_-])/g, "\\$1"); }
          }).join(".");
        }
      } catch {}
      const parent = cur.parentElement;
      if (parent) {
        const same = [...parent.children].filter((c) => c.tagName === cur.tagName);
        if (same.length > 1) part += ":nth-of-type(" + (same.indexOf(cur) + 1) + ")";
      }
      parts.unshift(part);
      if (cur.id) break;
      cur = parent;
    }
    return parts.join(" > ");
  }

  function describe(el) {
    const rect = el.getBoundingClientRect();
    let html = "";
    try { html = el.outerHTML || ""; } catch {}
    if (html.length > 4000) html = html.slice(0, 4000) + "\\n<!-- truncated -->";
    const attrs = {};
    for (const a of el.attributes || []) {
      if (["src", "href", "id", "class", "name", "type", "role", "aria-label", "title", "alt", "data-testid"].includes(a.name) || a.name.startsWith("data-")) {
        attrs[a.name] = a.value.length > 200 ? a.value.slice(0, 200) + "…" : a.value;
      }
    }
    return {
      tag: el.tagName.toLowerCase(),
      selector: cssPath(el),
      id: el.id || null,
      classes: el.className && typeof el.className === "string" ? el.className : null,
      text: (el.innerText || "").trim().slice(0, 500),
      attrs,
      html,
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      pageUrl: location.href,
    };
  }

  function placeOverlay(el) {
    mount();
    if (!el || el === document.documentElement || el === document.body) {
      box.style.display = "none";
      label.style.display = "none";
      return;
    }
    const r = el.getBoundingClientRect();
    Object.assign(box.style, {
      display: "block", left: r.left + "px", top: r.top + "px",
      width: Math.max(0, r.width) + "px", height: Math.max(0, r.height) + "px"
    });
    label.textContent = el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + (typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\\s+/).slice(0, 2).join(".") : "");
    Object.assign(label.style, {
      display: "block",
      left: Math.max(0, r.left) + "px",
      top: Math.max(0, r.top - 18) + "px"
    });
  }

  function onMove(e) {
    if (!state.select) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    if (!el || el === box || el === label) return;
    state.hover = el;
    placeOverlay(el);
  }
  function onClick(e) {
    if (!state.select) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    const el = state.hover || e.target;
    if (!(el instanceof Element) || el === box || el === label) return;
    try {
      parent.postMessage({ type: "dsh-browser-select", selection: describe(el) }, "*");
    } catch (err) {
      try {
        parent.postMessage({
          type: "dsh-browser-console",
          level: "error",
          args: ["dsh-browser select failed: " + (err && err.message ? err.message : String(err))],
          ts: Date.now(),
        }, "*");
      } catch {}
    }
  }
  function onClickNav(e) {
    // Bubble phase: SPA soft-nav (preventDefault) wins; we only catch real navigations.
    if (state.select) return;
    if (e.defaultPrevented) return;
    const a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
    if (!a) return;
    const raw = a.getAttribute("href") || "";
    if (!raw || raw.startsWith("#") || raw.startsWith("javascript:") || raw.startsWith("mailto:") || raw.startsWith("tel:")) return;
    let next;
    try {
      const base = (typeof __DSH_PAGE_URL__ !== "undefined" && __DSH_PAGE_URL__) || location.href;
      next = new URL(raw, base);
    } catch { return; }
    if (next.protocol !== "http:" && next.protocol !== "https:") return;
    if (next.pathname.indexOf("${GATE_PREFIX}/") === 0 && next.origin === location.origin) return;
    let pageOrigin = "";
    try {
      pageOrigin = new URL((typeof __DSH_PAGE_URL__ !== "undefined" && __DSH_PAGE_URL__) || location.href).origin;
    } catch {}
    e.preventDefault();
    e.stopPropagation();
    if (pageOrigin && next.origin === pageOrigin) {
      // Stay in this iframe via gate — never ask parent to remount.
      location.assign(location.origin + "${GATE_PREFIX}/" + next.protocol.replace(":", "") + "/" + next.host + next.pathname + next.search + next.hash);
      return;
    }
    parent.postMessage({ type: "dsh-browser-navigate", url: next.href }, "*");
  }

  window.addEventListener("message", (ev) => {
    const data = ev.data || {};
    if (data.type === "dsh-browser-set-select") {
      state.select = !!data.enabled;
      document.documentElement.style.cursor = state.select ? "crosshair" : "";
      if (!state.select) placeOverlay(null);
    }
    if (data.type === "dsh-browser-dom-action" && data.actionId) {
      const { actionId, action, selector, value } = data;
      const respond = (result) => {
        try {
          parent.postMessage({
            type: "dsh-browser-dom-action-result",
            actionId,
            ...result,
          }, "*");
        } catch {}
      };

      try {
        if (action === "snapshot") {
          const items = [];
          const query = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="menuitem"], [data-testid], article a[href], h1 a[href], h2 a[href], h3 a[href], h1, h2, h3';
          const visible = [];
          for (const el of document.querySelectorAll(query)) {
            const rect = el.getBoundingClientRect();
            if (rect.width === 0 && rect.height === 0) continue;
            const style = window.getComputedStyle(el);
            if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
            visible.push(el);
            if (visible.length >= 200) break;
          }
          const vh = window.innerHeight || 800;
          const scored = visible.map((el, i) => {
            const rect = el.getBoundingClientRect();
            const inView = rect.top < vh && rect.bottom > 0 ? 1 : 0;
            const tag = el.tagName.toLowerCase();
            const href = el.getAttribute("href") || "";
            const isContentLink = tag === "a" && href && !href.startsWith("#") && href !== "/" && !/^javascript:/i.test(href);
            const inMain = el.closest("main, article, [role=\\"main\\"], .content, #content, .post, .entry");
            return { el, score: inView * 10 + (isContentLink ? 5 : 0) + (inMain ? 8 : 0) - i * 0.001 };
          });
          scored.sort((a, b) => b.score - a.score);
          let idx = 0;
          const seenHref = new Set();
          for (const { el } of scored.slice(0, 80)) {
            const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.value || "").trim().slice(0, 100);
            const tag = el.tagName.toLowerCase();
            const href = el.getAttribute("href") || undefined;
            if (href && seenHref.has(href) && (tag === "a" || el.getAttribute("role") === "link")) continue;
            if (href) seenHref.add(href);
            const sel = el.id ? "#" + el.id : cssPath(el);
            items.push({
              ref: "e" + (idx++),
              tag,
              id: el.id || null,
              selector: sel,
              type: el.type || undefined,
              name: el.name || undefined,
              text,
              value: el.value !== undefined && tag !== "button" ? String(el.value).slice(0, 100) : undefined,
              href,
            });
            if (items.length >= 80) break;
          }
          respond({ ok: true, snapshot: { url: location.href, title: document.title, items } });
          return;
        }

        if (action === "click") {
          if (!selector) throw new Error("selector required");
          const el = document.querySelector(selector);
          if (!el) throw new Error("element not found: " + selector);
          el.scrollIntoView({ behavior: "instant", block: "center" });
          el.focus?.();
          el.click();
          respond({ ok: true, clicked: selector, tag: el.tagName.toLowerCase(), text: (el.innerText || "").slice(0, 100) });
          return;
        }

        if (action === "fill") {
          if (!selector) throw new Error("selector required");
          const el = document.querySelector(selector);
          if (!el) throw new Error("element not found: " + selector);
          el.scrollIntoView({ behavior: "instant", block: "center" });
          el.focus?.();
          const textVal = String(value ?? "");
          // Support native input value setters for React / Vue controlled inputs
          const prototype = Object.getPrototypeOf(el);
          const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
          if (descriptor && descriptor.set) {
            descriptor.set.call(el, textVal);
          } else {
            el.value = textVal;
          }
          el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
          el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
          respond({ ok: true, filled: selector, value: textVal });
          return;
        }

        if (action === "text") {
          let text = "";
          if (selector) {
            const el = document.querySelector(selector);
            if (!el) throw new Error("element not found: " + selector);
            text = (el.innerText || el.textContent || "").trim();
          } else {
					text = (document.body?.innerText || "").trim().slice(0, 2500);
          }
          respond({ ok: true, text });
          return;
        }

        throw new Error("unknown action: " + action);
      } catch (err) {
        respond({ ok: false, error: err && err.message ? err.message : String(err) });
      }
    }
  });

  document.addEventListener("mousemove", onMove, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("click", onClickNav, false);
  window.addEventListener("mousemove", onMove, true);
  window.addEventListener("click", onClick, true);
  window.__dshBrowserPicker = state;
  parent.postMessage({ type: "dsh-browser-ready" }, "*");
})();
`;

/** Console → parent. Installed in <head> so page scripts are wrapped before they log. */
const CONSOLE_HOOK_JS = `
(() => {
  if (window.__dshConsoleHook) return;
  window.__dshConsoleHook = true;
  function serializeArg(a) {
    try {
      if (a == null) return String(a);
      if (typeof a === "string") return a;
      if (typeof a === "number" || typeof a === "boolean") return String(a);
      if (typeof a === "object" && a && (a.stack || a.message)) return a.stack || a.message;
      if (typeof a === "object") return JSON.stringify(a);
      return String(a);
    } catch { return String(a); }
  }
  ["log", "info", "warn", "error", "debug"].forEach((level) => {
    const orig = console[level] ? console[level].bind(console) : null;
    console[level] = (...args) => {
      try {
        parent.postMessage({
          type: "dsh-browser-console",
          level,
          args: args.map(serializeArg),
          ts: Date.now(),
        }, "*");
      } catch {}
      if (orig) orig(...args);
    };
  });
  window.addEventListener("error", (e) => {
    try {
      parent.postMessage({
        type: "dsh-browser-console",
        level: "error",
        args: [e.message + (e.filename ? " @" + e.filename + ":" + e.lineno : "")],
        ts: Date.now(),
      }, "*");
    } catch {}
  });
  window.addEventListener("unhandledrejection", (e) => {
    try {
      const r = e.reason;
      const msg = (r && (r.stack || r.message)) ? (r.stack || r.message) : String(r);
      parent.postMessage({
        type: "dsh-browser-console",
        level: "error",
        args: ["Unhandled rejection: " + msg],
        ts: Date.now(),
      }, "*");
    } catch {}
  });
})();
`;

/** Eval + storage + network reporting for the in-panel DevTools (always injected with console hook). */
const DEVTOOLS_BRIDGE_JS = `
(() => {
  if (window.__dshDevtoolsBridge) return;
  window.__dshDevtoolsBridge = true;

  function post(msg) {
    try { parent.postMessage(msg, "*"); } catch {}
  }

  function guessType(url, hint) {
    const u = String(url || "").toLowerCase();
    const h = String(hint || "").toLowerCase();
    if (h.includes("javascript") || h === "script" || /\\.m?js(\\?|$)/.test(u)) return "js";
    if (h.includes("css") || h === "link" || h === "css" || /\\.css(\\?|$)/.test(u)) return "css";
    if (h.includes("json") || /\\.json(\\?|$)/.test(u)) return "json";
    if (h.includes("image") || h === "img" || /\\.(png|jpe?g|gif|webp|svg|ico)(\\?|$)/.test(u)) return "img";
    if (h.includes("html") || h === "iframe") return "html";
    if (h.includes("font") || /\\.(woff2?|ttf|otf)(\\?|$)/.test(u)) return "font";
    if (h === "xmlhttprequest" || h === "fetch") return "fetch";
    return "other";
  }

  function reportNet(entry) {
    post({ type: "dsh-browser-network", ...entry });
  }

  const _fetch = window.fetch.bind(window);
  window.fetch = function(input, init) {
    const method = (init && init.method) || (input && input.method) || "GET";
    let url = "";
    try {
      url = typeof input === "string" ? input : (input && input.url) || "";
    } catch {}
    const t0 = performance.now();
    return _fetch(input, init).then((res) => {
      let ct = "";
      try { ct = res.headers && res.headers.get ? (res.headers.get("content-type") || "") : ""; } catch {}
      reportNet({
        method: String(method).toUpperCase(),
        url: String(url).slice(0, 2000),
        status: res.status,
        ok: res.ok,
        type: guessType(url, ct),
        duration: Math.round(performance.now() - t0),
        source: "fetch",
        ts: Date.now(),
      });
      return res;
    }, (err) => {
      reportNet({
        method: String(method).toUpperCase(),
        url: String(url).slice(0, 2000),
        status: 0,
        ok: false,
        type: guessType(url, ""),
        duration: Math.round(performance.now() - t0),
        source: "fetch",
        error: err && err.message ? err.message : String(err),
        ts: Date.now(),
      });
      throw err;
    });
  };

  const xo = XMLHttpRequest.prototype.open;
  const xs = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    this.__dshNet = { method: String(method || "GET").toUpperCase(), url: String(url || "") };
    return xo.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function(...args) {
    const meta = this.__dshNet || { method: "GET", url: "" };
    const t0 = performance.now();
    this.addEventListener("loadend", () => {
      let ct = "";
      try { ct = this.getResponseHeader ? (this.getResponseHeader("content-type") || "") : ""; } catch {}
      reportNet({
        method: meta.method,
        url: String(meta.url).slice(0, 2000),
        status: this.status || 0,
        ok: this.status >= 200 && this.status < 400,
        type: guessType(meta.url, ct),
        duration: Math.round(performance.now() - t0),
        source: "xhr",
        ts: Date.now(),
      });
    });
    return xs.apply(this, args);
  };

  function sampleResources() {
    try {
      const entries = performance.getEntriesByType("resource") || [];
      const seen = window.__dshNetResourceSeen || (window.__dshNetResourceSeen = new Set());
      for (const e of entries) {
        const name = String(e.name || "");
        if (!name || seen.has(name)) continue;
        seen.add(name);
        reportNet({
          method: "GET",
          url: name.slice(0, 2000),
          status: 0,
          ok: true,
          type: guessType(name, e.initiatorType),
          duration: Math.round(e.duration || 0),
          source: "resource",
          initiatorType: e.initiatorType,
          ts: Date.now(),
        });
      }
    } catch {}
  }
  if (document.readyState === "complete") setTimeout(sampleResources, 0);
  else window.addEventListener("load", () => setTimeout(sampleResources, 0));

  function storageDump(store) {
    const out = {};
    try {
      for (let i = 0; i < store.length; i++) {
        const k = store.key(i);
        out[k] = String(store.getItem(k) || "").slice(0, 800);
      }
    } catch {}
    return out;
  }

  window.addEventListener("message", (ev) => {
    const data = ev.data || {};
    if (data.type === "dsh-browser-eval" && data.evalId) {
      let result;
      let error;
      try {
        result = (0, eval)(String(data.code || ""));
        try {
          if (result !== null && typeof result === "object") result = JSON.stringify(result);
          else result = String(result);
        } catch {
          result = String(result);
        }
      } catch (err) {
        error = err && err.stack ? err.stack : (err && err.message ? err.message : String(err));
      }
      post({ type: "dsh-browser-eval-result", evalId: data.evalId, result, error });
      return;
    }
    if (data.type === "dsh-browser-storage-list" && data.requestId) {
      let cookies = "";
      try { cookies = document.cookie || ""; } catch {}
      post({
        type: "dsh-browser-storage-result",
        requestId: data.requestId,
        localStorage: storageDump(localStorage),
        sessionStorage: storageDump(sessionStorage),
        cookies,
      });
      return;
    }
    if (data.type === "dsh-browser-storage-clear" && data.requestId) {
      try {
        if (data.which === "local") localStorage.clear();
        else if (data.which === "session") sessionStorage.clear();
        else if (data.which === "cookies") {
          String(document.cookie || "").split(";").forEach((c) => {
            const name = c.split("=")[0].trim();
            if (!name) return;
            document.cookie = name + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
          });
        }
      } catch {}
      post({ type: "dsh-browser-storage-result", requestId: data.requestId, ok: true });
      return;
    }
    if (data.type === "dsh-browser-storage-remove" && data.requestId) {
      try {
        if (data.which === "local") localStorage.removeItem(data.key);
        else if (data.which === "session") sessionStorage.removeItem(data.key);
      } catch {}
      post({ type: "dsh-browser-storage-result", requestId: data.requestId, ok: true });
      return;
    }
  });
})();
`;

/** Gate bridge: public-path helpers + fetch/history rewrite.
 * Location.pathname is unforgeable in Chrome — we rewrite gated .js to use helpers instead.
 * Bridge script MUST be first in <head>.
 */
const NETWORK_BRIDGE_JS = `
(() => {
  if (window.__dshNetBridge) return;
  window.__dshNetBridge = true;
  const pageUrl = (typeof __DSH_PAGE_URL__ !== "undefined" && __DSH_PAGE_URL__) || location.href;
  let target;
  try { target = new URL(pageUrl); } catch { return; }
  if (target.protocol !== "http:" && target.protocol !== "https:") return;

  const harnessOrigin = location.origin;
  const GATE_RE = /^\\/api\\/browser-gate\\/(https?)\\/([^/]+)(.*)$/;

  function gateMatch() {
    try {
      const m = String(location.pathname).match(GATE_RE);
      if (!m) return null;
      return {
        protocol: m[1] + ":",
        host: m[2],
        pathname: m[3] && m[3].length ? m[3] : "/",
        search: location.search || "",
        hash: location.hash || "",
      };
    } catch { return null; }
  }

  window.__dshPublicPath = function() {
    const g = gateMatch();
    return g ? g.pathname : location.pathname;
  };
  window.__dshPublicSearch = function() {
    return location.search || "";
  };
  window.__dshPublicHash = function() {
    return location.hash || "";
  };
  window.__dshPublicOrigin = function() {
    const g = gateMatch();
    return g ? (g.protocol + "//" + g.host) : location.origin;
  };
  window.__dshPublicHref = function() {
    const g = gateMatch();
    if (!g) return location.href;
    return g.protocol + "//" + g.host + g.pathname + g.search + g.hash;
  };

  function toGate(abs) {
    try {
      const u = new URL(abs, target);
      if (u.origin !== target.origin) return abs;
      return harnessOrigin + "${GATE_PREFIX}/" + u.protocol.replace(":", "") + "/" + u.host + u.pathname + u.search + u.hash;
    } catch { return abs; }
  }
  function publicFromGate(href) {
    try {
      const u = new URL(href, harnessOrigin);
      const m = u.pathname.match(GATE_RE);
      if (!m) return href;
      return m[1] + "://" + m[2] + (m[3] || "/") + u.search + u.hash;
    } catch { return href; }
  }
  function reportUrl(href) {
    try {
      parent.postMessage({ type: "dsh-browser-locate", url: publicFromGate(href) }, "*");
    } catch {}
  }

  const _fetch = window.fetch.bind(window);
  window.fetch = (input, init) => {
    try {
      if (typeof input === "string") return _fetch(toGate(input), init);
      if (input && typeof input.url === "string") {
        return _fetch(new Request(toGate(input.url), input), init);
      }
    } catch {}
    return _fetch(input, init);
  };

  const xo = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function(method, url, ...rest) {
    try {
      if (typeof url === "string") url = toGate(url);
    } catch {}
    return xo.call(this, method, url, ...rest);
  };

  // Dynamically-created <script>/<link>/<img>/<iframe> elements (e.g. \`s.src = "/x.js"\`)
  // resolve against <base href> (the real target origin) and bypass fetch/XHR entirely —
  // gate those property assignments the same way.
  function patchUrlProp(proto, prop) {
    try {
      const desc = Object.getOwnPropertyDescriptor(proto, prop);
      if (!desc || !desc.set || !desc.get) return;
      Object.defineProperty(proto, prop, {
        configurable: true,
        enumerable: desc.enumerable,
        get: desc.get,
        set(value) {
          let v = value;
          try { v = toGate(value); } catch {}
          return desc.set.call(this, v);
        },
      });
    } catch {}
  }
  patchUrlProp(HTMLScriptElement.prototype, "src");
  patchUrlProp(HTMLImageElement.prototype, "src");
  patchUrlProp(HTMLLinkElement.prototype, "href");
  patchUrlProp(HTMLIFrameElement.prototype, "src");
  patchUrlProp(HTMLSourceElement.prototype, "src");

  // Elements inserted via innerHTML/insertAdjacentHTML never go through the property
  // setters above (the HTML parser sets the content attribute directly), so root-relative
  // markup like \`<img src="/x.png">\` resolves against <base href> straight to the real
  // upstream origin and gets mixed-content blocked. Catch those with a MutationObserver.
  const GATED_ATTR = { IMG: "src", SCRIPT: "src", LINK: "href", IFRAME: "src", SOURCE: "src" };
  function gateAttr(el) {
    const attr = GATED_ATTR[el.tagName];
    if (!attr) return;
    const raw = el.getAttribute(attr);
    if (!raw || raw.startsWith(harnessOrigin) || /^(data|blob|javascript):/i.test(raw)) return;
    try {
      const gated = toGate(raw);
      if (gated !== raw) el.setAttribute(attr, gated);
    } catch {}
  }
  function gateSubtree(node) {
    if (node.nodeType !== 1) return;
    if (GATED_ATTR[node.tagName]) gateAttr(node);
    if (node.querySelectorAll) {
      node.querySelectorAll("img,script,link,iframe,source").forEach(gateAttr);
    }
  }
  try {
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach(gateSubtree);
        if (m.type === "attributes" && m.target) gateAttr(m.target);
      }
    }).observe(document.documentElement || document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["src", "href"],
    });
  } catch {}

  const _push = history.pushState.bind(history);
  const _replaceState = history.replaceState.bind(history);
  function gateStateUrl(url) {
    if (url == null || url === "") return url;
    try {
      const abs = new URL(String(url), target);
      if (abs.origin !== target.origin) return url;
      return "${GATE_PREFIX}/" + abs.protocol.replace(":", "") + "/" + abs.host + abs.pathname + abs.search + abs.hash;
    } catch { return url; }
  }
  history.pushState = (state, title, url) => {
    const next = gateStateUrl(url);
    const ret = _push(state, title, next);
    try { reportUrl(new URL(String(url || target.pathname), target).href); } catch {}
    return ret;
  };
  history.replaceState = (state, title, url) => {
    const next = gateStateUrl(url);
    const ret = _replaceState(state, title, next);
    try { reportUrl(new URL(String(url || target.pathname), target).href); } catch {}
    return ret;
  };
  window.addEventListener("popstate", () => {
    try { reportUrl(window.__dshPublicHref()); } catch { reportUrl(pageUrl); }
  });
  reportUrl(pageUrl);
})();
`;

function patchProxiedJs(code) {
	let out = String(code);
	// Reads only — Location.pathname is unforgeable, so rewrite site scripts.
	// All of these are real, settable properties on Location (assigning to any of them
	// triggers navigation), so skip rewriting when used as an assignment target — otherwise
	// `location.pathname = x` becomes `(window.__dshPublicPath()) = x`, a syntax/runtime error.
	out = out.replace(/\b(?:window\.|document\.)?location\.pathname\b(?!\s*[-+*/%&|^]?=(?!=))/g, "(window.__dshPublicPath())");
	out = out.replace(/\b(?:window\.|document\.)?location\.origin\b(?!\s*[-+*/%&|^]?=(?!=))/g, "(window.__dshPublicOrigin())");
	out = out.replace(/\b(?:window\.|document\.)?location\.search\b(?!\s*[-+*/%&|^]?=(?!=))/g, "(window.__dshPublicSearch())");
	out = out.replace(/\b(?:window\.|document\.)?location\.hash\b(?!\s*[-+*/%&|^]?=(?!=))/g, "(window.__dshPublicHash())");
	// href reads (skip assignments: location.href = ...)
	out = out.replace(/(?<![=\s])\b(?:window\.|document\.)?location\.href\b(?!\s*[-+*/%&|^]?=(?!=))/g, "(window.__dshPublicHref())");
	return out;
}

function rewriteScriptSrcsThroughGate(html, pageUrl, harnessOrigin) {
	const page = new URL(pageUrl);
	const origin = String(harnessOrigin || "").replace(/\/$/, "");
	if (!origin) return String(html);
	const gate = (raw) => {
		try {
			const u = new URL(raw, pageUrl);
			if (u.origin !== page.origin) return null;
			// Must be absolute to harness — <base href=public> would otherwise send
			// path-absolute /api/browser-gate/... to rubberrobo.nl and 404.
			return `${origin}${GATE_PREFIX}/${u.protocol.replace(":", "")}/${u.host}${u.pathname}${u.search}`;
		} catch {
			return null;
		}
	};
	let out = String(html);
	// <script src=...> (JS, module or classic).
	out = out.replace(/<script\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (full, pre, q, src, post) => {
		const gated = gate(src);
		return gated ? `<script${pre}src=${q}${gated}${q}${post}>` : full;
	});
	// <link href=...> — stylesheets, icons, manifest, preload, etc. (skip rel="preconnect"/"dns-prefetch",
	// which aren't real resource fetches and may target a different origin on purpose).
	out = out.replace(/<link\b([^>]*?)\bhref\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (full, pre, q, href, post) => {
		if (/\brel\s*=\s*["'][^"']*(preconnect|dns-prefetch)[^"']*["']/i.test(pre + post)) return full;
		const gated = gate(href);
		return gated ? `<link${pre}href=${q}${gated}${q}${post}>` : full;
	});
	// <img src=...> — avoids broken/mixed-content images on the loaded page.
	out = out.replace(/<img\b([^>]*?)\bsrc\s*=\s*(["'])([^"']+)\2([^>]*)>/gi, (full, pre, q, src, post) => {
		const gated = gate(src);
		return gated ? `<img${pre}src=${q}${gated}${q}${post}>` : full;
	});
	return out;
}

function injectPicker(html, pageUrl, { bridge: useBridge = false, harnessOrigin = "" } = {}) {
	let out = String(html);
	out = out.replace(/<meta[^>]+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "");
	const pageConst = `const __DSH_PAGE_URL__=${JSON.stringify(pageUrl)};`;
	const baseTag = `<base href="${String(pageUrl).replace(/"/g, "&quot;")}">`;
	if (useBridge) {
		out = rewriteScriptSrcsThroughGate(out, pageUrl, harnessOrigin);
	}
	const headEarly = useBridge
		? `${baseTag}<script>${pageConst}${NETWORK_BRIDGE_JS}${CONSOLE_HOOK_JS}${DEVTOOLS_BRIDGE_JS}</script>`
		: `${baseTag}<script>${CONSOLE_HOOK_JS}${DEVTOOLS_BRIDGE_JS}</script>`;
	if (/<head[^>]*>/i.test(out)) {
		out = out.replace(/<head[^>]*>/i, (m) => `${m}${headEarly}`);
	} else {
		out = `<head>${headEarly}</head>${out}`;
	}
	const pickerOnly = useBridge
		? `<script>${INJECT_JS}</script>`
		: `<script>${pageConst}${INJECT_JS}</script>`;
	if (/<\/body>/i.test(out)) {
		out = out.replace(/<\/body>/i, `${pickerOnly}</body>`);
	} else {
		out = `${out}${pickerOnly}`;
	}
	return out;
}

function parseGatePathname(pathname) {
	const m = String(pathname || "").match(/^\/api\/browser-gate\/(https?)\/([^/]+)(\/.*)?$/);
	if (!m) return null;
	const pathPart = m[3] && m[3].length ? m[3] : "/";
	return `${m[1]}://${m[2]}${pathPart}`;
}

function cfBlockedHtml(url, status) {
	const safe = String(url || "").replace(/[&<>"']/g, (c) => ({
		"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
	}[c]));
	return `<!doctype html><html><head><meta charset=utf-8><title>Blocked by Cloudflare</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;margin:0;padding:32px;background:#111;color:#eee}
h1{font-size:18px;margin:0 0 8px}p{margin:0 0 10px;color:#bbb;max-width:40rem}
code{color:#9cf}a{color:#8ab4f8}
</style></head><body data-dsh-browser-blocked="cloudflare_challenge">
<h1>Blocked by Cloudflare</h1>
<p>The built-in browser gate cannot pass this site's bot check${status ? ` (HTTP ${status})` : ""}.</p>
<p><code>${safe}</code></p>
<p>Do not keep retrying here. Use <strong>Settings → Browser → Remote Chromium</strong>, or open the URL in a normal browser.</p>
<script>try{parent.postMessage({type:"dsh-browser-blocked",reason:"cloudflare_challenge",url:${JSON.stringify(String(url || ""))}},"*")}catch(e){}</script>
</body></html>`;
}

async function ensureRemote() {
	const cfg = await loadConfig();
	if (cfg.engine !== "remote") {
		throw new Error("Remote Chromium is not enabled (Settings → Browser)");
	}
	await remoteBrowser.ensure(cfg.cdpHttp);
	return cfg;
}

async function isRemoteEngine() {
	const cfg = await loadConfig();
	return cfg.engine === "remote";
}

/**
 * Builtin gate hit Cloudflare → flip to Remote Chromium and retry once.
 * @param {string} url
 * @returns {Promise<object | null>} null when CDP is down / failover impossible
 */
async function failoverNavigateViaRemote(url) {
	const cfg = await loadConfig();
	const probe = await testCdpHttp(cfg.cdpHttp);
	if (!probe?.ok) return null;
	await saveConfig({ engine: "remote" });
	await remoteBrowser.ensure(cfg.cdpHttp);
	const res = await remoteBrowser.navigate(url);
	return {
		...(res && typeof res === "object" ? res : {}),
		ok: true,
		engine: "remote",
		failoverFrom: "builtin",
		note: "Auto-switched to Remote Chromium after Cloudflare on the built-in gate.",
	};
}



async function resolveLiveTarget(ctx, sessionId, relPosix) {
	const cwd = sessionCwd(ctx, sessionId);
	let abs = resolveUnderCwd(cwd, relPosix === "." || !relPosix ? "." : relPosix);
	let st;
	try {
		st = await fs.stat(abs);
	} catch {
		throw new Error("file not found");
	}
	if (st.isDirectory()) {
		const index = path.join(abs, "index.html");
		try {
			const ist = await fs.stat(index);
			if (!ist.isFile()) throw new Error("no index.html");
			abs = index;
			st = ist;
		} catch {
			throw new Error("directory has no index.html");
		}
	} else if (!st.isFile()) {
		throw new Error("not a file");
	}
	return { cwd, abs, st };
}

async function readLiveHtmlForProxy(ctx, sessionId, relPosix, pageUrl) {
	const { abs } = await resolveLiveTarget(ctx, sessionId, relPosix);
	const buf = await fs.readFile(abs);
	if (buf.length > MAX_BYTES) throw new Error(`page too large (${buf.length} bytes)`);
	let html = buf.toString("utf8");
	html = injectLiveReload(html);
	html = injectPicker(html, pageUrl);
	return {
		url: pageUrl,
		status: 200,
		title: (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || pageUrl,
		html,
	};
}

function parseLivePathname(pathname) {
	const parts = String(pathname || "").split("/").filter(Boolean);
	if (parts.length < 2 || parts[0] !== "api" || parts[1] !== "browser-live") {
		return null;
	}
	if (parts.length < 3) return null;
	const sessionId = decodeURIComponent(parts[2]);
	const rel = parts.length === 3
		? "."
		: parts.slice(3).map((p) => decodeURIComponent(p)).join("/");
	return { sessionId, rel };
}

async function fetchPage(ctx, urlString) {
	const url = assertHttpUrl(urlString);
	const live = parseLivePathname(url.pathname);
	if (live) {
		return readLiveHtmlForProxy(ctx, live.sessionId, live.rel, url.href);
	}
	const res = await fetch(url, {
		redirect: "follow",
		signal: AbortSignal.timeout(20000),
		headers: {
			"user-agent": CHROME_UA,
			accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
			"accept-language": "en-US,en;q=0.9",
		},
	});
	const buf = Buffer.from(await res.arrayBuffer());
	if (buf.length > MAX_BYTES) throw new Error(`page too large (${buf.length} bytes)`);
	const ctype = (res.headers.get("content-type") || "").toLowerCase();
	const finalUrl = res.url || url.href;
	const rawHtml = buf.toString("utf8");
	if (isCloudflareChallenge(res.status, rawHtml)) {
		throw new Error(cloudflareErrorMessage(finalUrl));
	}
	if (!ctype.includes("html") && !ctype.includes("xml") && !/^\s*</.test(buf.slice(0, 64).toString("utf8"))) {
		throw new Error(`not an HTML page (${ctype || "unknown type"})`);
	}
	const html = injectPicker(rawHtml, finalUrl);
	return {
		url: finalUrl,
		status: res.status,
		title: (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1]?.trim() || finalUrl,
		html,
	};
}

function sendText(res, status, ctype, body) {
	const buf = Buffer.from(body, "utf8");
	res.writeHead(status, {
		"content-type": ctype,
		"content-length": buf.length,
		"cache-control": "no-store",
	});
	res.end(buf);
}

function registerLiveRoute(ctx) {
	const handler = async (req, res) => {
		try {
			const method = (req.method || "GET").toUpperCase();
			if (method !== "GET" && method !== "HEAD") {
				sendText(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			const url = new URL(req.url || "/", "http://localhost");
			const parsed = parseLivePathname(url.pathname);
			if (!parsed) {
				sendText(res, 404, "text/plain; charset=utf-8", "not found");
				return;
			}

			const { abs } = await resolveLiveTarget(ctx, parsed.sessionId, parsed.rel);

			if (url.searchParams.get("__dsh_live") === "1") {
				const mtime = await dirSiblingMtimeMax(abs);
				sendText(res, 200, "application/json; charset=utf-8", JSON.stringify({ mtime }));
				return;
			}

			const ctype = mimeFor(abs);
			const isHtml = ctype.startsWith("text/html");
			if (isHtml) {
				let html = await fs.readFile(abs, "utf8");
				html = injectLiveReload(html);
				const dir = url.pathname.replace(/[^/]*$/, "") || url.pathname;
				html = injectPicker(html, dir);
				if (method === "HEAD") {
					res.writeHead(200, {
						"content-type": ctype,
						"cache-control": "no-store",
					});
					res.end();
					return;
				}
				sendText(res, 200, ctype, html);
				return;
			}

			const st = statSync(abs);
			res.writeHead(200, {
				"content-type": ctype,
				"content-length": st.size,
				"cache-control": "no-cache",
			});
			if (method === "HEAD") {
				res.end();
				return;
			}
			createReadStream(abs).pipe(res);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			const status = /not found|no index|not a file/i.test(msg) ? 404
				: /escapes|sessionId|cwd/i.test(msg) ? 403
					: 500;
			sendText(res, status, "text/plain; charset=utf-8", msg);
		}
	};

	return ctx.webServer.register({
		kind: "prefix",
		path: LIVE_PREFIX,
		handler,
	});
}





function registerGateRoute(ctx) {
	const handler = async (req, res) => {
		try {
			const method = (req.method || "GET").toUpperCase();
			if (!["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE"].includes(method)) {
				sendText(res, 405, "text/plain; charset=utf-8", "method not allowed");
				return;
			}
			const reqUrl = new URL(req.url || "/", "http://localhost");
			const targetHref = parseGatePathname(reqUrl.pathname);
			if (!targetHref) {
				sendText(res, 404, "text/plain; charset=utf-8", "not found");
				return;
			}
			const target = new URL(targetHref);
			if (reqUrl.search) target.search = reqUrl.search;
			if (target.protocol !== "http:" && target.protocol !== "https:") {
				sendText(res, 400, "text/plain; charset=utf-8", "only http(s)");
				return;
			}

			const headers = {
				"user-agent": CHROME_UA,
				accept: req.headers.accept || "*/*",
				"accept-language": req.headers["accept-language"] || "en-US,en;q=0.9",
			};
			if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];

			let body;
			if (method !== "GET" && method !== "HEAD") {
				const chunks = [];
				for await (const chunk of req) chunks.push(chunk);
				body = Buffer.concat(chunks);
			}

			const upstream = await fetch(target, {
				method,
				headers,
				body,
				redirect: "follow",
				signal: AbortSignal.timeout(30000),
			});
			const buf = Buffer.from(await upstream.arrayBuffer());
			if (buf.length > MAX_GATE_BYTES) {
				sendText(res, 502, "text/plain; charset=utf-8", "upstream too large");
				return;
			}
			const ctype = (upstream.headers.get("content-type") || "application/octet-stream").toLowerCase();
			const finalUrl = upstream.url || target.href;
			const isHtml = ctype.includes("text/html") || ctype.includes("application/xhtml");

			if (isHtml && method === "GET") {
				let html = buf.toString("utf8");
				if (isCloudflareChallenge(upstream.status, html)) {
					const blocked = cfBlockedHtml(finalUrl, upstream.status);
					res.writeHead(403, {
						"content-type": "text/html; charset=utf-8",
						"cache-control": "no-store",
						"x-dsh-browser-blocked": "cloudflare_challenge",
					});
					res.end(blocked);
					return;
				}
				const proto = String(req.headers["x-forwarded-proto"] || "http").split(",")[0].trim() || "http";
				const host = String(req.headers["x-forwarded-host"] || req.headers.host || "localhost").split(",")[0].trim();
				const harnessOrigin = `${proto}://${host}`;
				html = injectPicker(html, finalUrl, { bridge: true, harnessOrigin });
				sendText(res, upstream.status, "text/html; charset=utf-8", html);
				return;
			}

			const isJs = ctype.includes("javascript") || /\.m?js$/i.test(target.pathname);
			if (isJs && method === "GET") {
				const patched = patchProxiedJs(buf.toString("utf8"));
				sendText(res, upstream.status, "application/javascript; charset=utf-8", patched);
				return;
			}

			const outHeaders = {
				"content-type": ctype,
				"content-length": buf.length,
				"cache-control": "no-store",
			};
			res.writeHead(upstream.status, outHeaders);
			if (method === "HEAD") res.end();
			else res.end(buf);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			sendText(res, 502, "text/plain; charset=utf-8", msg);
		}
	};

	return ctx.webServer.register({
		kind: "prefix",
		path: GATE_PREFIX,
		handler,
	});
}

function escapeCssSelectorForRegex(sel) {
	return String(sel).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function stripDshStyleEditsBlock(html) {
	return String(html).replace(/<style\b[^>]*\bdata-dsh-style-edits\b[^>]*>[\s\S]*?<\/style>\s*/gi, "");
}

function parseCssDeclarations(cssBody) {
	const map = {};
	for (const part of String(cssBody || "").split(";")) {
		const t = part.trim();
		if (!t) continue;
		const i = t.indexOf(":");
		if (i < 0) continue;
		const prop = t.slice(0, i).trim().toLowerCase();
		const val = t.slice(i + 1).trim();
		if (prop) map[prop] = val;
	}
	return map;
}

function normalizeCssSelector(sel) {
	return String(sel || "").replace(/\s+/g, " ").trim();
}

/**
 * Patch (or append) a flat CSS rule. Updates existing properties; inserts new ones
 * before the closing brace.
 */
function patchCssRuleInText(cssText, selector, cssBody) {
	const sel = normalizeCssSelector(selector);
	const decls = parseCssDeclarations(cssBody);
	if (!sel || !Object.keys(decls).length) throw new Error("selector and css required");
	if (/[<>]/.test(sel)) throw new Error("invalid selector");
	return patchCssRuleInTextRaw(String(cssText || ""), sel, decls);
}

function patchCssRuleInTextRaw(cssText, selector, decls) {
	const selNorm = normalizeCssSelector(selector).toLowerCase();
	const src = String(cssText || "");
	const n = src.length;
	let i = 0;

	const skipComment = () => {
		if (src[i] === "/" && src[i + 1] === "*") {
			const end = src.indexOf("*/", i + 2);
			i = end < 0 ? n : end + 2;
			return true;
		}
		return false;
	};

	while (i < n) {
		if (skipComment()) continue;
		if (/\s/.test(src[i])) { i++; continue; }

		const chunkStart = i;
		while (i < n) {
			if (skipComment()) continue;
			if (src[i] === "{") break;
			i++;
		}
		if (i >= n) break;
		const selText = normalizeCssSelector(src.slice(chunkStart, i).replace(/\/\*[\s\S]*?\*\//g, ""));
		const braceOpen = i;
		i++; // past {

		if (!selText || selText.startsWith("@") || selText.toLowerCase() !== selNorm) {
			let depth = 1;
			while (i < n && depth > 0) {
				if (skipComment()) continue;
				if (src[i] === "{") depth++;
				else if (src[i] === "}") depth--;
				i++;
			}
			continue;
		}

		const bodyStart = braceOpen + 1;
		let depth = 1;
		let bodyEnd = -1;
		while (i < n && depth > 0) {
			if (skipComment()) continue;
			if (src[i] === "{") depth++;
			else if (src[i] === "}") {
				depth--;
				if (depth === 0) {
					bodyEnd = i;
					break;
				}
			}
			i++;
		}
		if (bodyEnd < 0) break;

		let body = src.slice(bodyStart, bodyEnd);
		const indentMatch = body.match(/\n([ \t]*)\S/);
		const indent = indentMatch ? indentMatch[1] : "    ";
		const endsWithNewline = /\n\s*$/.test(body);

		for (const [prop, val] of Object.entries(decls)) {
			const propRe = new RegExp(
				`(^|[;\\s])(${escapeCssSelectorForRegex(prop)})\\s*:\\s*[^;\\n]+;?`,
				"i",
			);
			if (propRe.test(body)) {
				body = body.replace(propRe, `$1${prop}: ${val};`);
			} else {
				const trimmed = body.replace(/\s+$/, "");
				const needsSemi = /[^;\s{]$/.test(trimmed);
				body = `${trimmed}${needsSemi ? ";" : ""}\n${indent}${prop}: ${val};${endsWithNewline ? "\n" : "\n"}`;
			}
		}

		return src.slice(0, bodyStart) + body + src.slice(bodyEnd);
	}

	// Rule missing — append at end of file
	const block = Object.entries(decls).map(([p, v]) => `    ${p}: ${v};`).join("\n");
	const addition = `\n${normalizeCssSelector(selector)} {\n${block}\n}\n`;
	return src.replace(/\s*$/, "") + addition;
}

function registerRpc(ctx) {
	return registerRpcChannel(ctx, RPC_CHANNEL, async (endpoint, payload) => {
			try {
				switch (endpoint) {
					case "fetch": {
						const url = String(payload?.url || "").trim();
						if (!url) throw new Error("url required");
						return ok(await fetchPage(ctx, url));
					}
					case "live.urlFor": {
						const sessionId = String(payload?.sessionId || "").trim();
						const filePath = String(payload?.path || "").trim();
						if (!sessionId) throw new Error("sessionId required");
						if (!filePath) throw new Error("path required");
						const cwd = sessionCwd(ctx, sessionId);
						let rel;
						try {
							rel = toRelUnderCwd(cwd, filePath);
						} catch {
							const base = path.basename(cwd);
							const marker = `/workspace/${base}/`;
							const norm = filePath.replace(/\\/g, "/");
							const lower = norm.toLowerCase();
							const idx = lower.indexOf(marker.toLowerCase());
							if (idx >= 0) {
								rel = toRelUnderCwd(cwd, path.resolve(cwd, norm.slice(idx + marker.length)));
							} else if (lower.includes("/workspace/")) {
								const after = norm.slice(lower.indexOf("/workspace/") + "/workspace/".length);
								rel = toRelUnderCwd(cwd, path.resolve(cwd, after));
							} else {
								throw new Error("path escapes workspace");
							}
						}
						const abs = resolveUnderCwd(cwd, rel === "." ? "." : rel);
						let st;
						try {
							st = await fs.stat(abs);
						} catch {
							throw new Error("file not found");
						}
						if (st.isDirectory()) {
							rel = rel === "." ? "index.html" : `${rel.replace(/\/$/, "")}/index.html`;
							try {
								await fs.stat(resolveUnderCwd(cwd, rel));
							} catch {
								throw new Error("directory has no index.html");
							}
						}
						return ok({ url: liveUrlFor(sessionId, rel) });
					}
					case "style.saveToLive": {
						const rawUrl = String(payload?.url || "").trim();
						const selector = String(payload?.selector || "").trim();
						const css = String(payload?.css || "").trim();
						const cssUrl = String(payload?.cssUrl || "").trim();
						if (!rawUrl) throw new Error("url required");
						if (!selector) throw new Error("selector required");
						if (!css) throw new Error("css required");

						let pagePathname = "";
						try {
							pagePathname = new URL(rawUrl, "http://localhost").pathname;
						} catch {
							throw new Error("invalid url");
						}
						const pageParsed = parseLivePathname(pagePathname);
						if (!pageParsed) throw new Error("Save to file only works on Live Server pages");

						let targetParsed = null;
						if (cssUrl) {
							let cssPathname = cssUrl;
							try {
								cssPathname = new URL(cssUrl, rawUrl).pathname;
							} catch { /* keep */ }
							targetParsed = parseLivePathname(cssPathname);
						}
						if (!targetParsed) {
							// Resolve relative stylesheet next to the HTML page, default style.css
							const pageRel = pageParsed.rel === "." ? "index.html" : pageParsed.rel;
							const dir = pageRel.includes("/") ? pageRel.replace(/\/[^/]*$/, "") : ".";
							const guess = dir === "." ? "style.css" : `${dir}/style.css`;
							targetParsed = { sessionId: pageParsed.sessionId, rel: guess };
						}

						const { abs: cssAbs } = await resolveLiveTarget(ctx, targetParsed.sessionId, targetParsed.rel);
						const cssType = mimeFor(cssAbs);
						if (!cssType.includes("css") && !/\.css$/i.test(cssAbs)) {
							throw new Error("target is not a CSS file");
						}
						const beforeCss = await fs.readFile(cssAbs, "utf8");
						const afterCss = patchCssRuleInText(beforeCss, selector, css);
						if (afterCss !== beforeCss) {
							await fs.writeFile(cssAbs, afterCss, "utf8");
						}

						// Drop legacy HTML override blocks from earlier builds
						try {
							const { abs: htmlAbs } = await resolveLiveTarget(ctx, pageParsed.sessionId, pageParsed.rel);
							if (mimeFor(htmlAbs).startsWith("text/html")) {
								const htmlBefore = await fs.readFile(htmlAbs, "utf8");
								const htmlAfter = stripDshStyleEditsBlock(htmlBefore);
								if (htmlAfter !== htmlBefore) await fs.writeFile(htmlAbs, htmlAfter, "utf8");
							}
						} catch { /* ignore */ }

						return ok({
							selector,
							rel: targetParsed.rel === "." ? "style.css" : targetParsed.rel,
							file: "css",
						});
					}
					case "navigate": {
						const url = String(payload?.url || "").trim();
						if (!url) throw new Error("url required");
						let resolved = url;
						try {
							resolved = await resolveNavigateUrl(ctx, url);
						} catch (err) {
							if (!(/^https?:\/\//i.test(url) && !/^https?:\/\/file[:/]/i.test(url))) {
								throw err;
							}
						}
						const res = await enqueueAgentCommand({ kind: "navigate", url: resolved });
						return ok(res);
					}
					case "action": {
						const action = String(payload?.action || "").trim();
						if (!action) throw new Error("action required");
						const res = await enqueueAgentCommand({
							kind: "action",
							action,
							selector: payload?.selector,
							value: payload?.value,
							timeoutMs: payload?.timeoutMs,
						});
						return ok(res);
					}
					case "agent.claim": {
						const waitMs = Math.min(Math.max(Number(payload?.waitMs) || 0, 0), 25_000);
						const command = await claimAgentCommand(waitMs);
						return ok({ command });
					}
					case "agent.complete": {
						const id = String(payload?.id || "").trim();
						if (!id) throw new Error("id required");
						const accepted = completeAgentCommand(id, payload?.result ?? { ok: false, error: "empty result" });
						return ok({ accepted });
					}
					case "getConfig": {
						return ok(await loadConfig());
					}
					case "setConfig": {
						const next = await saveConfig({
							engine: payload?.engine,
							cdpHttp: payload?.cdpHttp ?? payload?.baseUrl,
						});
						if (next.engine !== "remote") {
							await remoteBrowser.close().catch(() => {});
						}
						return ok(next);
					}
					case "remote.test": {
						const cfg = await loadConfig();
						const base = String(payload?.cdpHttp || cfg.cdpHttp || "").trim();
						return ok(await testCdpHttp(base));
					}
					case "remote.navigate": {
						await ensureRemote();
						return ok(await remoteBrowser.navigate(String(payload?.url || "")));
					}
					case "remote.status": {
						const cfg = await loadConfig();
						if (cfg.engine === "remote") {
							try { await remoteBrowser.ensure(cfg.cdpHttp); } catch { /* status still useful */ }
						}
						return ok({ ...remoteBrowser.status(), config: cfg });
					}
					case "remote.frame": {
						await ensureRemote();
						return ok(remoteBrowser.frame());
					}
					case "remote.input": {
						await ensureRemote();
						const kind = String(payload?.kind || "click");
						if (kind === "click") {
							return ok(await remoteBrowser.mouseClick(
								payload?.x,
								payload?.y,
								payload?.button,
							));
						}
						throw new Error(`unknown remote.input kind: ${kind}`);
					}
					case "remote.action": {
						await ensureRemote();
						const action = String(payload?.action || "").trim();
						if (action === "snapshot") return ok(await remoteBrowser.snapshot());
						if (action === "click") return ok(await remoteBrowser.click(payload?.selector));
						if (action === "fill") return ok(await remoteBrowser.fill(payload?.selector, payload?.value));
						if (action === "text") return ok(await remoteBrowser.text(payload?.selector));
						if (action === "screenshot") return ok(await remoteBrowser.screenshot());
						if (action === "console") return ok(remoteBrowser.getConsole(payload?.limit));
						if (action === "network") return ok(remoteBrowser.getNetwork(payload?.limit));
						if (action === "evaluate") return ok(await remoteBrowser.evaluate(payload?.script));
						throw new Error(`unknown remote action: ${action}`);
					}
					case "activity.list": {
						return ok({
							entries: getActivity(payload?.limit ?? 24),
							url: remoteBrowser.url || "",
							title: remoteBrowser.title || "",
						});
					}
					default:
						return transportError(new Error(`unknown endpoint: ${endpoint}`));
				}
			} catch (error) {
				return transportError(error);
			}
		});
}

async function runBrowserAction(_scope, action, params = {}) {
	assertNotLooping(action, params);
	try {
		let res;
		if (await isRemoteEngine()) {
			await ensureRemote();
			if (action === "snapshot") res = await remoteBrowser.snapshot();
			else if (action === "click") res = await remoteBrowser.click(params.selector);
			else if (action === "fill") res = await remoteBrowser.fill(params.selector, params.value);
			else if (action === "text") res = await remoteBrowser.text(params.selector);
			else if (action === "screenshot") res = await remoteBrowser.screenshot();
			else if (action === "console") res = remoteBrowser.getConsole(params.limit);
			else if (action === "network") res = remoteBrowser.getNetwork(params.limit);
			else if (action === "evaluate") res = await remoteBrowser.evaluate(params.script);
			else throw new Error(`unsupported remote action: ${action}`);
		} else {
			if (action === "console" || action === "network" || action === "evaluate") {
				throw new Error(`${action} requires Settings → Browser → Remote Chromium`);
			}
			res = await enqueueAgentCommand({
				kind: "action",
				action,
				selector: params.selector,
				value: params.value,
				timeoutMs: params.timeoutMs,
			}, action === "screenshot" ? 60_000 : 45_000);
			if (res && res.ok === false) {
				throw new Error(res.error || `${action} failed`);
			}
		}

		if (action === "snapshot" && res?.snapshot) {
			rememberSnapshot(res.snapshot);
		}

		// Dead-end pages: soft done flag (ok:true) — not a hard error that makes the model thrash.
		if (action === "snapshot" || action === "text") {
			const blob = action === "text"
				? String(res?.text || "")
				: [
					res?.snapshot?.title,
					...(Array.isArray(res?.snapshot?.items) ? res.snapshot.items.map((i) => i.text) : []),
				].filter(Boolean).join("\n");
			if (action === "text") recordPageText(blob.length);
			const dead = detectDeadEndPage(blob, res?.snapshot?.url || remoteBrowser.url || "");
			if (dead) {
				recordSuccess(action, { url: res?.snapshot?.url || "" });
				return { ...(res && typeof res === "object" ? res : {}), ok: true, ...dead };
			}
		}
		if (action === "evaluate" && res?.ok) {
			const body =
				typeof res.result === "string"
					? res.result
					: res.result != null
						? JSON.stringify(res.result)
						: "";
			recordPageText(body.length);
		}

		recordSuccess(action, {
			detail: action === "click" || action === "fill"
				? String(params.selector || "")
				: (res?.snapshot?.url || res?.url || ""),
		});
		return res;
	} catch (err) {
		recordFailure(action, params, err);
		const raw = err instanceof Error ? err.message : String(err);
		const msg = enrichInteractionError(raw, String(params.selector || ""));
		if (msg !== raw) throw new Error(msg);
		throw err;
	}
}

async function runBrowserNavigate(scope, url) {
	assertNotLooping("navigate", { url });
	try {
		const resolved = await resolveNavigateUrl(scope, url);
		let res;
		if (await isRemoteEngine()) {
			// Live Server / workspace files stay on the built-in path (same-origin Live).
			if (String(resolved).includes("/api/browser-live/")) {
				res = await enqueueAgentCommand({ kind: "navigate", url: resolved });
			} else {
				await ensureRemote();
				res = await remoteBrowser.navigate(resolved);
				if (res?.cloudflareChallenge) {
					recordSuccess("navigate");
					return { ok: true, ...res, ...cloudflareDone(res.url || resolved) };
				}
			}
		} else {
			// Built-in: preflight http(s) for CF — auto-failover to Remote instead of hanging the model.
			if (/^https?:\/\//i.test(resolved) && !resolved.includes("/api/browser-")) {
				try {
					const pre = await fetch(resolved, {
						redirect: "follow",
						signal: AbortSignal.timeout(15000),
						headers: {
							"user-agent": CHROME_UA,
							accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
						},
					});
					const text = await pre.text();
					if (isCloudflareChallenge(pre.status, text)) {
						try {
							const failedOver = await failoverNavigateViaRemote(pre.url || resolved);
							if (failedOver) {
								recordSuccess("navigate", { detail: `failover ${pre.url || resolved}` });
								const dead = detectDeadEndPage(failedOver.title || "", failedOver.url || resolved);
								if (dead) return { ...failedOver, ...dead };
								return failedOver;
							}
						} catch (failErr) {
							scope?.logger?.warn?.(
								`[dsh-browser] CF→remote failover failed: ${failErr instanceof Error ? failErr.message : failErr}`,
							);
						}
						// Challenge hint (ok:true, not done:true) — agent should solve CF, not abort.
						recordSuccess("navigate");
						return { ok: true, url: pre.url || resolved, ...cloudflareDone(pre.url || resolved) };
					}
					const dead = detectDeadEndPage(text, pre.url || resolved);
					if (dead) {
						recordSuccess("navigate");
						return { ok: true, url: pre.url || resolved, ...dead };
					}
				} catch (err) {
					if (err instanceof Error && (/Cloudflare|STOP:/i.test(err.message))) {
						recordSuccess("navigate");
						return { ok: true, url: resolved, ...cloudflareDone(resolved) };
					}
					// Network errors: still try the UI path.
				}
			}
			res = await enqueueAgentCommand({ kind: "navigate", url: resolved });
		}
		if (res && res.ok === false) {
			const errMsg = String(res.error || "navigate failed");
			if (/cloudflare|just a moment/i.test(errMsg)) {
				if (!(await isRemoteEngine())) {
					try {
						const failedOver = await failoverNavigateViaRemote(resolved);
						if (failedOver) {
							recordSuccess("navigate", { detail: `failover ${resolved}` });
							return failedOver;
						}
					} catch {
						/* fall through */
					}
				}
				recordSuccess("navigate");
				return { ok: true, url: resolved, ...cloudflareDone(resolved) };
			}
			throw new Error(errMsg);
		}
		// After navigate, soft paywall / CF hint on title (ok:true, not an exception).
		if (res?.title) {
			const dead = detectDeadEndPage(res.title, res.url || resolved);
			if (dead) {
				recordSuccess("navigate");
				return { ...(res && typeof res === "object" ? res : {}), ok: true, ...dead };
			}
		}
		recordSuccess("navigate");
		return res;
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		// Remote navigate can still throw CF — return challenge guidance, keep the turn alive.
		if (/cloudflare|just a moment|verify you are human|security verification/i.test(msg)) {
			recordSuccess("navigate");
			return { ok: true, url: String(url || ""), ...cloudflareDone(url) };
		}
		recordFailure("navigate", { url }, err);
		throw err;
	}
}

function imageRefFromSaved(ref) {
	return {
		attachmentId: AttachmentId(ref.attachmentId),
		mediaType: ref.mediaType,
		bytes: ref.bytes,
		width: ref.width,
		height: ref.height,
		...ref.name === undefined ? {} : { name: ref.name },
		...ref.originalDimensions === undefined
			? {}
			: { originalDimensions: { ...ref.originalDimensions } },
	};
}

const IMAGE_VALUE_SCHEMA = {
	type: "object",
	additionalProperties: false,
	required: true,
	properties: {
		attachmentId: { type: "string", required: true },
		mediaType: {
			type: "string",
			enum: ["image/png", "image/jpeg", "image/webp", "image/gif"],
			required: true,
		},
		bytes: { type: "integer", required: true },
		width: { type: "integer", required: true },
		height: { type: "integer", required: true },
		name: { type: "string" },
		originalDimensions: {
			type: "object",
			additionalProperties: false,
			properties: {
				width: { type: "integer", required: true },
				height: { type: "integer", required: true },
			},
		},
	},
};

function screenshotContent(value) {
	const notes = Array.isArray(value.notes) && value.notes.length
		? `\nnotes: ${value.notes.join("; ")}`
		: "";
	return [
		{
			type: "text",
			text:
				`<browser-screenshot>\n` +
				`<url>${value.url || ""}</url>\n` +
				`<title>${value.title || ""}</title>\n` +
				`<type>image</type>\n` +
				`<content>\n` +
				`${value.image.mediaType} image, ${value.image.width}x${value.image.height} px, ${value.image.bytes} bytes` +
				`${notes}\n` +
				`</content>\n` +
				`</browser-screenshot>`,
		},
		{
			type: "image",
			attachment: imageRefFromSaved(value.image),
		},
	];
}

async function assertImageCapableRoute(scope, exec) {
	const routed = exec.agent?.session?.requestHeader?.()?.config;
	const provider = routed?.provider ?? exec.agent?.options?.provider;
	const model = routed?.model ?? exec.agent?.options?.model;
	const llm = scope.get?.("llm") || scope.llm;
	if (!provider || !model || !llm?.resolveModelInfo) return;
	const active = await llm.resolveModelInfo(provider, model, exec.signal);
	if (active.inputModalities && !active.inputModalities.includes("image")) {
		throw new Error(
			`browser_screenshot requires an image-capable model; "${model}" does not declare image input`,
		);
	}
}

function registerTools(scope) {
	const tools = scope.tools || scope.get?.("tools");
	if (!tools?.register || !defineTool) return;

	const register = (toolDef) => {
		try {
			return tools.register(defineTool(toolDef));
		} catch (e) {
			console.warn("[dsh-browser] register tool failed:", toolDef.name, e);
		}
	};

	register({
		name: "browser_navigate",
		description:
			"Navigate the browser to a URL (prefer Remote Chromium for Cloudflare / bot checks). " +
			"Use this instead of bash curl/wget for any public website. " +
			"If Cloudflare / Verify-you-are-human appears: do not give up — ask the user to click it in the live Remote feed and/or snapshot+click, then continue. " +
			"done:true is only for paywalls/membership — then tell the user and end the turn. For local HTML use a workspace path or file:// (Live Server).",
		parameters: {
			url: {
				type: "string",
				required: true,
				description:
					"http(s) URL, /api/browser-live/… path, workspace-relative file (e.g. liquid-vacuum/index.html), or file:///workspace/… path",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const res = await runBrowserNavigate(scope, args.url);
			return res;
		},
	});

	register({
		name: "browser_snapshot",
		description:
			"List interactive elements currently visible (buttons, links, inputs). Returns a compact ref list (e0, e1, …). Click ONLY listed refs — never invent eN or product URLs that are not in the list. " +
			"If Cloudflare / Verify-you-are-human appears: do not end the turn — click that checkbox if listed (or ask the user via the live feed), wait, snapshot again. " +
			"done:true is only for paywalls — then tell the user and end the turn.",
		parameters: {},
		output: {
			schema: { type: "json" },
			render: (_args, val) => {
				const snap = val?.snapshot;
				if (snap && Array.isArray(snap.items)) {
					const compact = formatCompactSnapshot(snap);
					const extra = val?.done
						? `\n\ndone: true (${val.reason || "blocked"})\n${val.message || ""}`
						: "";
					return [{ type: "text", text: compact + extra }];
				}
				return [{ type: "text", text: JSON.stringify(val, null, 2) }];
			},
		},
		execute: async () => {
			const res = await runBrowserAction(scope, "snapshot");
			return res;
		},
	});

	register({
		name: "browser_click",
		description:
			"Click an element. Prefer a ref from the latest browser_snapshot (e0, e1). Never invent refs. Also accepts CSS, text=Label, or button:has-text(\"Label\"). First miss: snapshot once and retry a listed ref. Only errors starting with STOP: mean end the turn.",
		parameters: {
			selector: {
				type: "string",
				required: true,
				description:
					"Snapshot ref from the last browser_snapshot (e0), CSS selector, text=Reject non-essential, or button:has-text(\"Accept all\")",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const res = await runBrowserAction(scope, "click", { selector: args.selector });
			return res;
		},
	});

	register({
		name: "browser_fill",
		description: "Type or set value into an input, textarea, or select field in the in-app browser page by its selector or ref.",
		parameters: {
			selector: {
				type: "string",
				required: true,
				description: "CSS selector or element ref of the input field",
			},
			value: {
				type: "string",
				required: true,
				description: "Text value to enter into the field",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const res = await runBrowserAction(scope, "fill", { selector: args.selector, value: args.value });
			return res;
		},
	});

	register({
		name: "browser_text",
		description: "Read the visible text content of the page or a specific container in the in-app browser tab.",
		parameters: {
			selector: {
				type: "string",
				description: "Optional CSS selector to read text from (defaults to entire page body)",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => {
			const res = await runBrowserAction(scope, "text", { selector: args.selector });
			return res;
		},
	});

	register({
		name: "browser_console",
		description:
			"Read recent page console logs (log/warn/error) from the remote Chromium session. Use when the page looks broken or a click did nothing. Prefer Remote Chromium engine.",
		parameters: {
			limit: {
				type: "integer",
				description: "Max log lines to return (default 50)",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => runBrowserAction(scope, "console", { limit: args.limit }),
	});

	register({
		name: "browser_network",
		description:
			"Read recent network responses (URL, status, MIME) from the remote Chromium session. Use for failed loads / API errors. Prefer Remote Chromium engine.",
		parameters: {
			limit: {
				type: "integer",
				description: "Max requests to return (default 50)",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => runBrowserAction(scope, "network", { limit: args.limit }),
	});

	register({
		name: "browser_evaluate",
		description:
			"Run a JavaScript expression in the page (like DevTools console eval). Use sparingly for debugging. Requires Remote Chromium engine.",
		parameters: {
			script: {
				type: "string",
				required: true,
				description: "JavaScript expression to evaluate in the page context",
			},
		},
		output: {
			schema: { type: "json" },
			render: (_args, val) => [{ type: "text", text: JSON.stringify(val, null, 2) }],
		},
		execute: async (args) => runBrowserAction(scope, "evaluate", { script: args.script }),
	});
}

function registerScreenshotTool(scope) {
	const tools = scope.tools || scope.get?.("tools");
	if (!tools?.register || !defineTool || !AttachmentId) return;

	try {
		tools.register(defineTool({
			name: "browser_screenshot",
			description:
				"Capture a PNG screenshot of the current in-app Browser tab viewport and return it as an image you can see. Use this to verify visual/render issues (layout, canvas/WebGL fluid sims, CSS). Requires the Browser tab to have a Live/gate page loaded (same-origin). Prefer after browser_navigate to the page under test. Not a DOM dump — use browser_snapshot for element refs.",
			parameters: {},
			output: {
				schema: {
					type: "object",
					additionalProperties: false,
					properties: {
						url: { type: "string", required: true },
						title: { type: "string", required: true },
						notes: {
							type: "array",
							items: { type: "string" },
							required: true,
						},
						image: IMAGE_VALUE_SCHEMA,
					},
				},
				render: (_args, value) => screenshotContent(value),
			},
			execute: async (_args, exec) => {
				const attachments = scope.get?.("attachments") || scope.attachments;
				if (!attachments?.saveImage) {
					throw new Error("browser_screenshot: no attachment service is mounted");
				}
				await assertImageCapableRoute(scope, exec);

				const res = await runBrowserAction(scope, "screenshot", { timeoutMs: 25000 });
				if (!res || res.ok === false) {
					throw new Error(res?.error || "screenshot failed");
				}
				const b64 = String(res.pngBase64 || "").replace(/\s+/g, "");
				if (!b64) throw new Error("screenshot returned empty image data");
				const data = Buffer.from(b64, "base64");
				if (data.length < 32) throw new Error("screenshot PNG too small / invalid");

				let ref;
				try {
					ref = await attachments.saveImage({
						data: new Uint8Array(data),
						mediaType: "image/png",
						name: `browser-screenshot-${Date.now()}.png`,
					});
				} catch (error) {
					if (AttachmentError && error instanceof AttachmentError) {
						throw new Error(`browser_screenshot could not store image: ${error.message}`, { cause: error });
					}
					throw error;
				}

				return {
					url: res.url || "",
					title: res.title || "",
					notes: Array.isArray(res.notes) ? res.notes : [],
					image: {
						attachmentId: ref.attachmentId,
						mediaType: ref.mediaType,
						bytes: ref.bytes,
						width: ref.width,
						height: ref.height,
						...ref.name === undefined ? {} : { name: ref.name },
						...ref.originalDimensions === undefined
							? {}
							: { originalDimensions: { ...ref.originalDimensions } },
					},
				};
			},
			presentCall() {
				return {
					card: "generic",
					title: "Browser screenshot",
					kind: "read",
				};
			},
		}));
	} catch (e) {
		console.warn("[dsh-browser] register tool failed: browser_screenshot", e);
	}
}

function apply(ctx) {
	ctx.inject(["tools"], (toolsScope) => {
		toolsScope.effect(() => registerTools(toolsScope), "dsh-browser: tools");
	});
	ctx.inject(["tools", "attachments"], (scope) => {
		scope.effect(() => registerScreenshotTool(scope), "dsh-browser: screenshot");
	});
	ctx.inject(["connection", "webServer"], (connScope) => {
		connScope.effect(() => registerRpc(connScope), "dsh-browser: rpc");
		connScope.inject(["sessions", "webServer"], (scope) => {
			scope.effect(() => registerLiveRoute(scope), "dsh-browser: live-server");
			scope.effect(() => registerGateRoute(scope), "dsh-browser: gate");
		});
	});
}

export { apply, name, inject };

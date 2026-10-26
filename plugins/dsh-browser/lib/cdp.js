/**
 * Minimal Chrome DevTools Protocol client for remote Chromium.
 * Talks to chrome --remote-debugging-port (e.g. dsh-browser-chrome :9222).
 */
import { isCloudflareChallenge, cloudflareErrorMessage, CHROME_UA } from "./cf.js";

const MAX_CONSOLE = 200;
const MAX_NETWORK = 200;

/**
 * @typedef {{ id: number, resolve: (v: unknown) => void, reject: (e: Error) => void }} Pending
 */

export class CdpSession {
	constructor() {
		/** @type {WebSocket | null} */
		this.ws = null;
		/** @type {string} */
		this.httpBase = "";
		/** @type {string} */
		this.targetId = "";
		/** @type {string} */
		this.url = "about:blank";
		/** @type {string} */
		this.title = "";
		this.nextId = 1;
		/** @type {Map<number, Pending>} */
		this.pending = new Map();
		/** @type {Array<{ level: string, text: string, ts: number }>} */
		this.consoleLogs = [];
		/** @type {Array<{ url: string, status: number, mimeType: string, method: string, ts: number }>} */
		this.networkLogs = [];
		/** @type {string | null} latest jpeg/png base64 */
		this.lastFrame = null;
		this.lastFrameTs = 0;
		/** @type {{ deviceWidth?: number, deviceHeight?: number, pageScaleFactor?: number } | null} */
		this.lastFrameMeta = null;
		this.screencastOn = false;
		this.connecting = null;
		/** @type {{ url?: string, title?: string, items?: Array<Record<string, unknown>> } | null} */
		this.lastSnapshot = null;
	}

	connected() {
		return this.ws != null && this.ws.readyState === WebSocket.OPEN;
	}

	async ensure(httpBase) {
		const base = String(httpBase || "").replace(/\/+$/, "");
		if (!base) throw new Error("CDP HTTP base URL required");
		if (this.connected() && this.httpBase === base) return;
		if (this.connecting) return this.connecting;
		this.connecting = this._connect(base).finally(() => {
			this.connecting = null;
		});
		return this.connecting;
	}

	async _connect(httpBase) {
		await this.close();
		this.httpBase = httpBase;

		const versionRes = await fetch(`${httpBase}/json/version`, {
			signal: AbortSignal.timeout(8000),
		});
		if (!versionRes.ok) {
			throw new Error(`CDP unreachable at ${httpBase} (HTTP ${versionRes.status})`);
		}

		// Reuse an existing page — json/new every connect burned CF cookies and
		// opened cold tabs that always hit a hard Turnstile.
		const listRes = await fetch(`${httpBase}/json/list`, {
			signal: AbortSignal.timeout(8000),
		});
		const list = await listRes.json();
		const pages = (Array.isArray(list) ? list : []).filter((t) => t?.type === "page");
		const rank = (t) => {
			const u = String(t?.url || "");
			if (/^https?:\/\//i.test(u)) return 0;
			if (u === "about:blank" || u === "about:blank/") return 1;
			if (/^chrome:\/\//i.test(u)) return 3;
			return 2;
		};
		pages.sort((a, b) => rank(a) - rank(b));
		let target = pages[0];
		if (!target?.webSocketDebuggerUrl) {
			try {
				const created = await fetch(`${httpBase}/json/new?about:blank`, {
					method: "PUT",
					signal: AbortSignal.timeout(8000),
				});
				if (created.ok) target = await created.json();
			} catch {
				/* fall through */
			}
		}
		if (!target?.webSocketDebuggerUrl) {
			throw new Error(`No CDP page target at ${httpBase}`);
		}

		let wsUrl = String(target.webSocketDebuggerUrl);
		// Chrome inside Docker often advertises ws://127.0.0.1 — rewrite to our HTTP host.
		try {
			const http = new URL(httpBase);
			const ws = new URL(wsUrl);
			ws.protocol = http.protocol === "https:" ? "wss:" : "ws:";
			ws.hostname = http.hostname;
			ws.port = http.port || (http.protocol === "https:" ? "443" : "80");
			wsUrl = ws.href;
		} catch {
			/* keep */
		}

		this.targetId = String(target.id || "");
		if (target.url) this.url = String(target.url);
		if (target.title) this.title = String(target.title);
		await this._openWs(wsUrl);
		await this.send("Page.enable");
		await this.send("Runtime.enable");
		await this.send("Network.enable");
		await this.send("DOM.enable");
		// Do NOT Network.setUserAgentOverride — mismatched UA vs real Chrome/124
		// is exactly what makes MakerWorld Turnstile spin forever after agent navigate.
		try {
			await this.send("Page.addScriptToEvaluateOnNewDocument", {
				source: `
					Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
					if (!window.chrome) window.chrome = { runtime: {} };
				`,
			});
		} catch {
			/* optional */
		}
		await this._startScreencast();
		await this._refreshMeta().catch(() => {});
	}

	_openWs(wsUrl) {
		return new Promise((resolve, reject) => {
			const ws = new WebSocket(wsUrl);
			const timer = setTimeout(() => {
				try { ws.close(); } catch { /* */ }
				reject(new Error("CDP WebSocket connect timeout"));
			}, 10000);
			ws.addEventListener("open", () => {
				clearTimeout(timer);
				this.ws = ws;
				resolve();
			});
			ws.addEventListener("error", () => {
				clearTimeout(timer);
				reject(new Error(`CDP WebSocket failed: ${wsUrl}`));
			});
			ws.addEventListener("close", () => {
				this.ws = null;
				for (const [, p] of this.pending) {
					p.reject(new Error("CDP connection closed"));
				}
				this.pending.clear();
			});
			ws.addEventListener("message", (ev) => {
				this._onMessage(String(ev.data || ""));
			});
		});
	}

	_onMessage(raw) {
		let msg;
		try {
			msg = JSON.parse(raw);
		} catch {
			return;
		}
		if (msg.id != null && this.pending.has(msg.id)) {
			const p = this.pending.get(msg.id);
			this.pending.delete(msg.id);
			if (msg.error) {
				p.reject(new Error(msg.error.message || JSON.stringify(msg.error)));
			} else {
				p.resolve(msg.result);
			}
			return;
		}
		const method = msg.method;
		const params = msg.params || {};
		if (method === "Runtime.consoleAPICalled") {
			const level = String(params.type || "log");
			const args = Array.isArray(params.args) ? params.args : [];
			const text = args.map((a) => a.value ?? a.description ?? a.type ?? "").join(" ");
			this.consoleLogs.push({ level, text: String(text).slice(0, 2000), ts: Date.now() });
			if (this.consoleLogs.length > MAX_CONSOLE) this.consoleLogs.shift();
		} else if (method === "Runtime.exceptionThrown") {
			const desc = params.exceptionDetails?.exception?.description
				|| params.exceptionDetails?.text
				|| "exception";
			this.consoleLogs.push({ level: "error", text: String(desc).slice(0, 2000), ts: Date.now() });
			if (this.consoleLogs.length > MAX_CONSOLE) this.consoleLogs.shift();
		} else if (method === "Network.responseReceived") {
			const res = params.response || {};
			this.networkLogs.push({
				url: String(res.url || "").slice(0, 500),
				status: Number(res.status) || 0,
				mimeType: String(res.mimeType || ""),
				method: String(params.type || ""),
				ts: Date.now(),
			});
			if (this.networkLogs.length > MAX_NETWORK) this.networkLogs.shift();
		} else if (method === "Page.screencastFrame") {
			const data = params.data;
			const sessionId = params.sessionId;
			if (typeof data === "string") {
				this.lastFrame = data;
				this.lastFrameTs = Date.now();
			}
			if (params.metadata && typeof params.metadata === "object") {
				this.lastFrameMeta = {
					deviceWidth: Number(params.metadata.deviceWidth) || undefined,
					deviceHeight: Number(params.metadata.deviceHeight) || undefined,
					pageScaleFactor: Number(params.metadata.pageScaleFactor) || undefined,
				};
			}
			if (sessionId != null && this.ws?.readyState === WebSocket.OPEN) {
				this.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
			}
		} else if (method === "Page.frameNavigated" && params.frame?.parentId == null) {
			if (params.frame?.url) this.url = params.frame.url;
		}
	}

	/**
	 * @param {string} method
	 * @param {Record<string, unknown>} [params]
	 */
	send(method, params = {}) {
		if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
			return Promise.reject(new Error("CDP not connected"));
		}
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { id, resolve, reject });
			this.ws.send(JSON.stringify({ id, method, params }));
			setTimeout(() => {
				if (this.pending.has(id)) {
					this.pending.delete(id);
					reject(new Error(`CDP timeout: ${method}`));
				}
			}, 60000);
		});
	}

	async _startScreencast() {
		try {
			await this.send("Page.startScreencast", {
				format: "jpeg",
				quality: 60,
				maxWidth: 1280,
				maxHeight: 800,
				everyNthFrame: 2,
			});
			this.screencastOn = true;
		} catch {
			this.screencastOn = false;
		}
		// If GPU/screencast stalls, keep Live view alive via periodic screenshots.
		this._ensureFramePump();
	}

	_ensureFramePump() {
		if (this._framePump) return;
		this._framePump = setInterval(() => {
			this._pumpFrame().catch(() => {});
		}, 1500);
		if (typeof this._framePump.unref === "function") this._framePump.unref();
	}

	async _pumpFrame() {
		if (!this.connected()) return;
		const stale = !this.lastFrame || (Date.now() - this.lastFrameTs) > 2500;
		if (!stale) return;
		try {
			const res = await this.send("Page.captureScreenshot", {
				format: "jpeg",
				quality: 55,
				fromSurface: true,
			});
			const data = res?.data;
			if (typeof data === "string" && data.length > 100) {
				this.lastFrame = data;
				this.lastFrameTs = Date.now();
				// Keep click mapping accurate — screenshot frames have no screencast metadata.
				try {
					const { result } = await this.send("Runtime.evaluate", {
						expression: "({ w: window.innerWidth, h: window.innerHeight, dpr: window.devicePixelRatio || 1 })",
						returnByValue: true,
					});
					const v = result?.value || {};
					const w = Number(v.w) || 0;
					const h = Number(v.h) || 0;
					if (w > 0 && h > 0) {
						this.lastFrameMeta = {
							deviceWidth: w,
							deviceHeight: h,
							pageScaleFactor: Number(v.dpr) || 1,
						};
					}
				} catch { /* ignore */ }
			}
		} catch {
			/* compositor may be warming up */
		}
	}

	_samePageUrl(a, b) {
		try {
			const ua = new URL(String(a || ""));
			const ub = new URL(String(b || ""));
			const norm = (u) => `${u.protocol}//${u.host}${u.pathname.replace(/\/$/, "")}${u.search}`;
			return norm(ua) === norm(ub);
		} catch {
			return String(a || "").replace(/\/$/, "") === String(b || "").replace(/\/$/, "");
		}
	}

	async navigate(url) {
		const href = String(url || "").trim();
		if (!href) throw new Error("url required");
		this.consoleLogs = [];
		this.networkLogs = [];
		this.lastSnapshot = null;
		await this._refreshMeta().catch(() => {});

		const alreadyThere = this._samePageUrl(this.url, href);
		const onCf = /just a moment|verify you are human|performing security verification/i.test(this.title || "");
		// Re-navigating a CF / same URL resets Turnstile and is what "agent loads = fucks up".
		if (!alreadyThere) {
			await this.send("Page.navigate", { url: href });
			await this._waitLoad(45000);
			await this._refreshMeta();
		} else if (onCf) {
			// Stay put — let the existing challenge finish or the user click it.
			await sleep(2500);
			await this._refreshMeta();
		}

		// Restart screencast after navigation — headed Chrome sometimes stops frames.
		try {
			await this.send("Page.stopScreencast");
		} catch { /* */ }
		await this._startScreencast();
		await this._pumpFrame();
		const html = await this._pageHtml(8000);
		let cloudflareChallenge = false;
		if (isCloudflareChallenge(0, html) || /just a moment/i.test(this.title)) {
			cloudflareChallenge = true;
			// Short wait only — do not re-navigate; polling HTML is enough.
			for (let i = 0; i < 3; i++) {
				await sleep(4000);
				await this._refreshMeta();
				await this._pumpFrame();
				const htmlN = await this._pageHtml(8000);
				if (!isCloudflareChallenge(0, htmlN) && !/just a moment/i.test(this.title)) {
					cloudflareChallenge = false;
					break;
				}
			}
		}
		return {
			ok: true,
			url: this.url,
			title: this.title,
			engine: "remote",
			...(alreadyThere ? { reusedTab: true } : {}),
			...(cloudflareChallenge
				? {
					cloudflareChallenge: true,
					message: cloudflareChallengeMessage(this.url || href),
				}
				: {}),
		};
	}

	async _waitLoad(timeoutMs) {
		const started = Date.now();
		while (Date.now() - started < timeoutMs) {
			try {
				const { result } = await this.send("Runtime.evaluate", {
					expression: "document.readyState",
					returnByValue: true,
				});
				if (result?.value === "complete" || result?.value === "interactive") {
					await sleep(300);
					return;
				}
			} catch {
				/* retry */
			}
			await sleep(200);
		}
	}

	async _refreshMeta() {
		try {
			const { result } = await this.send("Runtime.evaluate", {
				expression: "({ url: location.href, title: document.title || '' })",
				returnByValue: true,
			});
			if (result?.value) {
				this.url = String(result.value.url || this.url);
				this.title = String(result.value.title || "");
			}
		} catch {
			/* ignore */
		}
	}

	async _pageHtml(timeoutMs = 8000) {
		try {
			const { result } = await this.send("Runtime.evaluate", {
				expression: "document.documentElement ? document.documentElement.outerHTML : ''",
				returnByValue: true,
				awaitPromise: false,
			});
			return String(result?.value || "").slice(0, 200_000);
		} catch {
			return "";
		}
	}

	async snapshot() {
		const script = `(() => {
			const items = [];
			const query = 'button, a[href], input, select, textarea, [role="button"], [role="tab"], [role="link"], [role="checkbox"], [role="menuitem"], [data-testid], article a[href], h1 a[href], h2 a[href], h3 a[href], h1, h2, h3';
			// Filter visibility BEFORE capping — hidden header/nav nodes used to eat the
			// 75-slot budget so real content links (search results, articles) never appeared.
			const visible = [];
			for (const el of document.querySelectorAll(query)) {
				const rect = el.getBoundingClientRect();
				if (rect.width === 0 && rect.height === 0) continue;
				const style = window.getComputedStyle(el);
				if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") continue;
				visible.push(el);
				if (visible.length >= 200) break;
			}
			// Prefer in-viewport / main content over duplicate chrome: score then take top 80.
			const vh = window.innerHeight || 800;
			const scored = visible.map((el, i) => {
				const rect = el.getBoundingClientRect();
				const inView = rect.top < vh && rect.bottom > 0 ? 1 : 0;
				const tag = el.tagName.toLowerCase();
				const href = el.getAttribute("href") || "";
				const isContentLink = tag === "a" && href && !href.startsWith("#") && href !== "/" && !/^javascript:/i.test(href);
				const inMain = el.closest("main, article, [role=\\"main\\"], .content, #content, .post, .entry");
				const score = inView * 10 + (isContentLink ? 5 : 0) + (inMain ? 8 : 0) - i * 0.001;
				return { el, score };
			});
			scored.sort((a, b) => b.score - a.score);
			const nodes = scored.slice(0, 80).map((s) => s.el);
			let idx = 0;
			const seenHref = new Set();
			for (const el of nodes) {
				const text = (el.innerText || el.getAttribute("aria-label") || el.getAttribute("title") || el.getAttribute("placeholder") || el.value || "").trim().slice(0, 100);
				const tag = el.tagName.toLowerCase();
				const href = el.getAttribute("href") || undefined;
				// Drop duplicate nav links (same href) to leave room for unique results.
				if (href && seenHref.has(href) && (tag === "a" || el.getAttribute("role") === "link")) continue;
				if (href) seenHref.add(href);
				const id = el.id ? "#" + el.id : "";
				let sel = id;
				if (!sel) {
					const parts = [];
					let cur = el;
					for (let i = 0; i < 4 && cur && cur.nodeType === 1; i++) {
						let part = cur.tagName.toLowerCase();
						if (cur.id) { parts.unshift("#" + cur.id); break; }
						const parent = cur.parentElement;
						if (parent) {
							const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
							if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(cur) + 1) + ")";
						}
						parts.unshift(part);
						cur = parent;
					}
					sel = parts.join(" > ");
				}
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
			return { url: location.href, title: document.title, items };
		})()`;
		const { result } = await this.send("Runtime.evaluate", {
			expression: script,
			returnByValue: true,
		});
		await this._refreshMeta();
		const snap = result?.value || { url: this.url, title: this.title, items: [] };
		// Drop undefined fields so tool JSON stays lossless.
		if (Array.isArray(snap.items)) {
			snap.items = snap.items.map((it) => {
				const out = {};
				for (const [k, v] of Object.entries(it || {})) {
					if (v !== undefined) out[k] = v;
				}
				return out;
			});
		}
		this.lastSnapshot = snap;
		return { ok: true, snapshot: snap, engine: "remote" };
	}

	async click(selector) {
		const sel = String(selector || "").trim();
		if (!sel) throw new Error("selector required");
		const resolved = await this._resolveSelector(sel);
		const { result } = await this.send("Runtime.evaluate", {
			expression: `(() => {
				${FIND_EL_JS}
				const el = __dshFindEl(${JSON.stringify(resolved)});
				if (!el) return { ok: false, error: "element not found: " + ${JSON.stringify(resolved)} + " (use CSS, text=Label, tag:has-text(\\"Label\\"), or snapshot ref e0)" };
				el.scrollIntoView({ behavior: "instant", block: "center" });
				el.focus?.();
				el.click();
				return { ok: true, clicked: ${JSON.stringify(resolved)}, tag: el.tagName.toLowerCase(), text: (el.innerText || el.textContent || "").trim().slice(0, 100) };
			})()`,
			returnByValue: true,
		});
		const val = result?.value || { ok: false, error: "click failed" };
		if (!val.ok) throw new Error(val.error || "click failed");
		await sleep(200);
		await this._refreshMeta();
		return { ...val, url: this.url, title: this.title, engine: "remote" };
	}

	async fill(selector, value) {
		const sel = String(selector || "").trim();
		if (!sel) throw new Error("selector required");
		const resolved = await this._resolveSelector(sel);
		const textVal = String(value ?? "");
		const { result } = await this.send("Runtime.evaluate", {
			expression: `(() => {
				${FIND_EL_JS}
				const el = __dshFindEl(${JSON.stringify(resolved)});
				if (!el) return { ok: false, error: "element not found: " + ${JSON.stringify(resolved)} };
				el.scrollIntoView({ behavior: "instant", block: "center" });
				el.focus?.();
				const textVal = ${JSON.stringify(textVal)};
				const prototype = Object.getPrototypeOf(el);
				const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
				if (descriptor && descriptor.set) descriptor.set.call(el, textVal);
				else el.value = textVal;
				el.dispatchEvent(new Event("input", { bubbles: true, cancelable: true }));
				el.dispatchEvent(new Event("change", { bubbles: true, cancelable: true }));
				return { ok: true, filled: ${JSON.stringify(resolved)}, value: textVal };
			})()`,
			returnByValue: true,
		});
		const val = result?.value || { ok: false, error: "fill failed" };
		if (!val.ok) throw new Error(val.error || "fill failed");
		return { ...val, engine: "remote" };
	}

	async text(selector) {
		const sel = String(selector || "").trim();
		const { result } = await this.send("Runtime.evaluate", {
			expression: sel
				? `(() => {
					const el = document.querySelector(${JSON.stringify(await this._resolveSelector(sel))});
					if (!el) throw new Error("element not found");
					return (el.innerText || el.textContent || "").trim();
				})()`
				: `(document.body?.innerText || "").trim().slice(0, 5000)`,
			returnByValue: true,
		});
		let text = String(result?.value || "");
		if (text.length > 2500) text = `${text.slice(0, 2500)}…`;
		return { ok: true, text, engine: "remote" };
	}

	async screenshot() {
		const result = await this.send("Page.captureScreenshot", {
			format: "png",
			fromSurface: true,
		});
		await this._refreshMeta();
		const data = String(result?.data || "");
		if (!data) throw new Error("screenshot empty");
		return {
			ok: true,
			pngBase64: data,
			url: this.url,
			title: this.title,
			engine: "remote",
		};
	}

	async evaluate(script) {
		let expression = String(script || "").trim();
		if (!expression) throw new Error("script required");
		// Models often emit `return …;` which is illegal at top level — wrap as a function body.
		if (/^\s*return\b/m.test(expression) || /;\s*$/.test(expression) || /\bconst\b|\blet\b|\bvar\b|\bfor\b|\bif\b/.test(expression)) {
			expression = `(() => {\n${expression}\n})()`;
		}
		const { result, exceptionDetails } = await this.send("Runtime.evaluate", {
			expression,
			returnByValue: true,
			awaitPromise: true,
		});
		if (exceptionDetails) {
			throw new Error(exceptionDetails.exception?.description || exceptionDetails.text || "evaluate failed");
		}
		// Tool output must be lossless JSON — coerce undefined/NaN/etc.
		const safe = toLosslessJson(result?.value);
		let value = safe.value;
		// Cap huge evaluate dumps (innerHTML / body text) so sessions stay usable on small GPUs.
		if (typeof value === "string" && value.length > 3000) {
			value = `${value.slice(0, 3000)}…`;
		} else if (value && typeof value === "object") {
			try {
				const raw = JSON.stringify(value);
				if (raw.length > 4000) {
					value = { truncated: true, preview: `${raw.slice(0, 3000)}…` };
				}
			} catch { /* keep */ }
		}
		return {
			ok: true,
			kind: safe.kind,
			result: value,
			engine: "remote",
		};
	}

	getConsole(limit = 30) {
		const n = Math.min(Math.max(Number(limit) || 30, 1), 80);
		return { ok: true, logs: this.consoleLogs.slice(-n), engine: "remote" };
	}

	getNetwork(limit = 30) {
		const n = Math.min(Math.max(Number(limit) || 30, 1), 80);
		return { ok: true, requests: this.networkLogs.slice(-n), engine: "remote" };
	}

	status() {
		return {
			ok: true,
			connected: this.connected(),
			url: this.url,
			title: this.title,
			engine: "remote",
			hasFrame: !!this.lastFrame,
			frameTs: this.lastFrameTs,
			consoleCount: this.consoleLogs.length,
			networkCount: this.networkLogs.length,
		};
	}

	frame() {
		return {
			ok: true,
			mime: "image/jpeg",
			base64: this.lastFrame,
			ts: this.lastFrameTs,
			url: this.url,
			title: this.title,
			meta: this.lastFrameMeta,
		};
	}

	/**
	 * Forward a user click from the live screencast into remote Chrome.
	 * Coordinates are CSS viewport pixels (CDP Input.dispatchMouseEvent).
	 * @param {number} x
	 * @param {number} y
	 * @param {"left"|"right"|"middle"} [button]
	 */
	async mouseClick(x, y, button = "left") {
		const px = Math.max(0, Number(x) || 0);
		const py = Math.max(0, Number(y) || 0);
		const btn = button === "right" || button === "middle" ? button : "left";
		const buttons = btn === "left" ? 1 : btn === "right" ? 2 : 4;
		try {
			await this.send("Page.bringToFront");
		} catch { /* optional */ }
		// Turnstile needs a move → down → up sequence; bare press/release often no-ops.
		await this.send("Input.dispatchMouseEvent", {
			type: "mouseMoved",
			x: px,
			y: py,
			button: "none",
			buttons: 0,
		});
		await sleep(40);
		await this.send("Input.dispatchMouseEvent", {
			type: "mousePressed",
			x: px,
			y: py,
			button: btn,
			buttons,
			clickCount: 1,
			pointerType: "mouse",
		});
		await sleep(60);
		await this.send("Input.dispatchMouseEvent", {
			type: "mouseReleased",
			x: px,
			y: py,
			button: btn,
			buttons: 0,
			clickCount: 1,
			pointerType: "mouse",
		});
		await sleep(200);
		await this._refreshMeta();
		await this._pumpFrame();
		return {
			ok: true,
			x: px,
			y: py,
			button: btn,
			url: this.url,
			title: this.title,
			engine: "remote",
		};
	}

	async _resolveSelector(selector) {
		const s = String(selector || "").trim();
		if (/^e\d+$/i.test(s)) {
			// Prefer the last browser_snapshot inventory — re-snapshotting renumbers
			// and trains the model to invent refs that never matched.
			let items = Array.isArray(this.lastSnapshot?.items) ? this.lastSnapshot.items : null;
			if (!items?.length) {
				const snap = await this.snapshot();
				items = snap.snapshot?.items || [];
			}
			const item = items.find((it) => it.ref === s);
			if (!item?.selector) {
				const valid = items.map((it) => it.ref).filter(Boolean).slice(0, 20).join(", ");
				throw new Error(
					`unknown ref: ${s}` +
					(valid ? ` (valid: ${valid}${items.length > 20 ? ", …" : ""})` : " (no snapshot yet)"),
				);
			}
			return item.selector;
		}
		return s;
	}

	async close() {
		this.screencastOn = false;
		if (this._framePump) {
			clearInterval(this._framePump);
			this._framePump = null;
		}
		if (this.ws && this.ws.readyState === WebSocket.OPEN) {
			try {
				await Promise.race([
					this.send("Page.stopScreencast"),
					new Promise((r) => setTimeout(r, 500)),
				]);
			} catch { /* ignore */ }
			try { this.ws.close(); } catch { /* */ }
		}
		this.ws = null;
		this.pending.clear();
	}
}

/** Injected into page for click/fill — CSS + Playwright-ish text selectors. */
const FIND_EL_JS = `
	function __dshFindEl(sel) {
		const s = String(sel || "").trim();
		if (!s) return null;
		let m = s.match(/^text\\s*=\\s*(.+)$/i);
		if (m) return __dshByText("*", m[1].trim());
		m = s.match(/^(.+?):has-text\\((["'])([\\s\\S]*)\\2\\)\\s*$/i);
		if (m) return __dshByText((m[1] || "*").trim() || "*", m[3]);
		m = s.match(/^:has-text\\((["'])([\\s\\S]*)\\1\\)\\s*$/i);
		if (m) return __dshByText("*", m[2]);
		try { return document.querySelector(s); } catch { return null; }
	}
	function __dshByText(tag, text) {
		const needle = String(text || "").trim().toLowerCase();
		if (!needle) return null;
		const rootSel = (!tag || tag === "*")
			? 'button, a, [role="button"], [role="link"], [role="menuitem"], [role="tab"], input, label, div, span, p'
			: tag;
		let nodes;
		try { nodes = Array.from(document.querySelectorAll(rootSel)); }
		catch { nodes = Array.from(document.querySelectorAll("*")); }
		const visible = (el) => {
			const r = el.getBoundingClientRect();
			if (r.width === 0 && r.height === 0) return false;
			const st = window.getComputedStyle(el);
			return st.display !== "none" && st.visibility !== "hidden" && st.opacity !== "0";
		};
		const labelOf = (el) => (el.innerText || el.textContent || el.getAttribute("aria-label") || el.value || el.getAttribute("title") || "").replace(/\\s+/g, " ").trim().toLowerCase();
		let hit = nodes.find((el) => visible(el) && labelOf(el) === needle);
		if (hit) return hit;
		hit = nodes.find((el) => visible(el) && labelOf(el).includes(needle));
		return hit || null;
	}
`;

function sleep(ms) {
	return new Promise((r) => setTimeout(r, ms));
}

/** Make CDP evaluate results safe for dsh tool JSON schema. */
function toLosslessJson(value) {
	if (value === undefined) return { kind: "undefined", value: null };
	if (typeof value === "bigint") return { kind: "bigint", value: value.toString() };
	if (typeof value === "number" && !Number.isFinite(value)) {
		return { kind: "number", value: String(value) };
	}
	if (typeof value === "function") {
		return { kind: "function", value: value.name || "anonymous" };
	}
	try {
		return { kind: "json", value: JSON.parse(JSON.stringify(value)) };
	} catch {
		return { kind: "string", value: String(value) };
	}
}

/** Singleton used by host tools + RPC. */
export const remoteBrowser = new CdpSession();

export async function testCdpHttp(httpBase) {
	const base = String(httpBase || "").replace(/\/+$/, "");
	const res = await fetch(`${base}/json/version`, { signal: AbortSignal.timeout(8000) });
	if (!res.ok) throw new Error(`HTTP ${res.status}`);
	const data = await res.json();
	return {
		ok: true,
		browser: data.Browser || data.browser || "chromium",
		protocolVersion: data["Protocol-Version"] || data.protocolVersion,
		webSocketDebuggerUrl: data.webSocketDebuggerUrl,
	};
}

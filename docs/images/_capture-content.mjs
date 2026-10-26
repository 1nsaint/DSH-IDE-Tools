#!/usr/bin/env node
/**
 * Content-rich README screenshots (sandbox, dark, collapsed sidebar).
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import puppeteer from "/tmp/ss-shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const TOKEN = execSync(
  "docker exec dsh-suite-sandbox cat /home/node/.dsh/run/dsh-web/token",
  { encoding: "utf8" },
).trim();
const BASE = "http://127.0.0.1:3180";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await collapseSidebar(page);
  await page.screenshot({ path: path.join(OUT, name), type: "png" });
  console.log("wrote", name);
}

async function dark(page) {
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
    document.body?.classList?.add("dark");
  });
}

async function collapseSidebar(page) {
  await page.evaluate(() => {
    document.querySelector('[aria-label="Collapse sidebar"]')?.click();
  });
  await sleep(250);
}

async function clickTab(page, name) {
  await page.evaluate((label) => {
    const t = [...document.querySelectorAll('[role="tab"]')].find(
      (el) => (el.textContent || "").trim() === label,
    );
    if (!t) throw new Error(`tab not found: ${label}`);
    t.click();
  }, name);
  await sleep(1000);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);

// Seed DB connection before first paint of Database plugin
await page.goto(`${BASE}/?token=${encodeURIComponent(TOKEN)}`, {
  waitUntil: "networkidle2",
  timeout: 60000,
});
await sleep(2000);
await dark(page);
await page.evaluate(() => {
  const conn = [
    {
      id: "demo-pg",
      name: "demo",
      engine: "postgres",
      url: "postgresql://demo:demo@dsh-readme-pg:5432/demo",
    },
  ];
  localStorage.setItem("dsh-database.connections.v2", JSON.stringify(conn));
});
await page.reload({ waitUntil: "networkidle2" });
await sleep(2500);
await dark(page);

// --- Code with file open ---
await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent("dsh-open-code-file", {
      detail: { path: "/workspace/test/src/hello.js" },
    }),
  );
});
await sleep(1500);
await clickTab(page, "Code");
await sleep(800);
// Fallback path variants
const codeOk = await page.evaluate(() => /hello\(|export function/i.test(document.body.innerText));
if (!codeOk) {
  for (const p of [
    "test/src/hello.js",
    "/test/src/hello.js",
    "src/hello.js",
    "/workspace/test/src/hello.js",
  ]) {
    await page.evaluate((path) => {
      window.dispatchEvent(new CustomEvent("dsh-open-code-file", { detail: { path } }));
    }, p);
    await sleep(900);
    if (await page.evaluate(() => /hello\(|export function/i.test(document.body.innerText))) break;
  }
}
await shot(page, "05-code-tab.png");

// --- Downloads (completed aria2 jobs) ---
await clickTab(page, "Downloads");
await sleep(2000);
await shot(page, "08-downloads.png");

// --- Browser example page ---
await clickTab(page, "Browser");
await sleep(800);
await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent("dsh-open-browser-url", {
      detail: { url: "https://example.com" },
    }),
  );
});
await sleep(500);
// Also try typing into URL bar if present
await page.evaluate(() => {
  const input = document.querySelector(
    'input.db_url, input[placeholder*="http"], input[aria-label*="URL"], input[aria-label*="url"]',
  );
  if (!input) return;
  const native = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value");
  native.set.call(input, "https://example.com");
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  input.form?.requestSubmit?.();
});
await page.keyboard.press("Enter").catch(() => {});
await sleep(3500);
await shot(page, "09-browser.png");

// --- Database: connect + list tables / run query ---
await clickTab(page, "Database");
await sleep(1500);
// Click Connect / Refresh / Run if present
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((b) => /^Connect$/i.test((b.textContent || "").trim()))?.click();
});
await sleep(1200);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((b) => /^(Refresh|Reload|Tables)$/i.test((b.textContent || "").trim()))?.click();
});
await sleep(1000);
// Click widgets table if listed
await page.evaluate(() => {
  const el = [...document.querySelectorAll("*")].find(
    (n) => (n.textContent || "").trim() === "widgets" && n.children.length === 0,
  );
  el?.click();
});
await sleep(800);
await page.evaluate(() => {
  const btns = [...document.querySelectorAll("button")];
  btns.find((b) => /^(Run|Execute|Query)$/i.test((b.textContent || "").trim()))?.click();
});
await sleep(1500);
await shot(page, "10-database.png");

// --- Containers: wait for list ---
await clickTab(page, "Containers");
for (let i = 0; i < 15; i++) {
  const ready = await page.evaluate(() => {
    const t = document.body.innerText;
    return /dsh-suite-sandbox|deepseek-harness|Up |running/i.test(t) && !/Loading|empty|No containers/i.test(t.slice(0, 800));
  });
  if (ready) break;
  await sleep(1000);
}
await sleep(500);
await shot(page, "12-containers.png");

// --- Split: Code (with file) + Terminal ---
await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent("dsh-open-code-file", {
      detail: { path: "/workspace/test/src/hello.js" },
    }),
  );
});
await sleep(600);
await clickTab(page, "Code");
await sleep(600);
await page.evaluate(() => {
  const split = [...document.querySelectorAll("button")].find(
    (b) =>
      /split/i.test(b.getAttribute("aria-label") || "") ||
      /split/i.test(b.getAttribute("title") || ""),
  );
  split?.click();
});
await sleep(1000);
// In right or left pane, switch one side to Terminal
await page.evaluate(() => {
  // Prefer icon/toolbar buttons for Terminal inside split surfaces
  const terminals = [...document.querySelectorAll("button, [role='tab'], [role='button']")].filter(
    (el) => {
      const a = (el.getAttribute("aria-label") || "").toLowerCase();
      const t = (el.textContent || "").trim();
      return a === "terminal" || t === "Terminal" || a.includes("terminal");
    },
  );
  // Click the last Terminal control (often the second pane)
  const target = terminals[terminals.length - 1] || terminals[0];
  target?.click();
});
await sleep(1500);
// Ensure left still has code — reopen file on first pane if needed
await page.evaluate(() => {
  window.dispatchEvent(
    new CustomEvent("dsh-open-code-file", {
      detail: { path: "/workspace/test/src/hello.js" },
    }),
  );
});
await sleep(1000);
await shot(page, "13-split-view.png");

// Keep overview with collapsed sidebar (no chat names)
await clickTab(page, "Chat");
await sleep(500);
await shot(page, "03-overview-chat.png");

await browser.close();
console.log("done");

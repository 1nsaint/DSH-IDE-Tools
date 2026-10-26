#!/usr/bin/env node
/**
 * Public README screenshots — sandbox only, dark mode, sidebar collapsed,
 * workspace/chat trees folded (no session names).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";
import puppeteer from "/tmp/ss-shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = __dirname;
const TOKEN = execSync(
  "docker exec dsh-suite-sandbox cat /home/node/.dsh/run/dsh-web/token",
  { encoding: "utf8" },
).trim();
const BASE = "http://127.0.0.1:3180";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await privacyPrep(page);
  await page.screenshot({ path: path.join(OUT, name), type: "png" });
  console.log("wrote", name);
}

/** Dark theme + fold trees + collapse left rail. */
async function privacyPrep(page) {
  await page.evaluate(() => {
    localStorage.setItem("theme", "dark");
    document.documentElement.setAttribute("data-theme", "dark");
    document.documentElement.classList.add("dark");
    document.body?.classList?.add("dark");

    // Collapse any expanded treeitems / disclosure widgets in the rail
    for (const el of document.querySelectorAll('[aria-expanded="true"]')) {
      try {
        el.click();
      } catch {
        /* ignore */
      }
    }
  });
  await sleep(200);

  // Prefer fully collapsed sidebar for public shots
  await page.evaluate(() => {
    const collapse = document.querySelector(
      '[aria-label="Collapse sidebar"], button[aria-label*="Collapse sidebar"]',
    );
    if (collapse) collapse.click();
  });
  await sleep(350);
}

async function ensureSidebarOpen(page) {
  await page.evaluate(() => {
    const expand = document.querySelector(
      '[aria-label="Expand sidebar"], button[aria-label*="Expand sidebar"]',
    );
    if (expand) expand.click();
  });
  await sleep(400);
  // Fold workspace trees so chat names aren't listed
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-expanded="true"]')) {
      const label = (el.getAttribute("aria-label") || el.textContent || "").toLowerCase();
      // keep Plugins etc.; fold workspace / chats / files groups
      if (/workspace|chat|file|local|session|folder/i.test(label) || el.closest?.("[class*='workspace']")) {
        try {
          el.click();
        } catch {
          /* ignore */
        }
      }
    }
    // Also click chevrons next to LOCAL / CHATS / FILES headings
    for (const el of document.querySelectorAll("button, [role='button'], [role='treeitem']")) {
      const t = (el.textContent || "").trim();
      if (/^(LOCAL|CHATS|FILES|Workspaces)$/i.test(t) || /^LOCAL$/i.test(t)) {
        if (el.getAttribute("aria-expanded") === "true") el.click();
      }
    }
  });
  await sleep(300);
}

async function clickTab(page, name) {
  await page.evaluate((label) => {
    const t = [...document.querySelectorAll('[role="tab"]')].find(
      (el) => (el.textContent || "").trim() === label,
    );
    if (!t) throw new Error(`tab not found: ${label}`);
    t.click();
  }, name);
  await sleep(900);
}

async function openPlugins(page) {
  await ensureSidebarOpen(page);
  await page.evaluate(() => {
    const btn = [...document.querySelectorAll("button, a")].find(
      (n) => (n.textContent || "").trim() === "Plugins",
    );
    btn?.click();
  });
  await sleep(1000);
  // Fold trees again after navigation
  await page.evaluate(() => {
    for (const el of document.querySelectorAll('[aria-expanded="true"]')) {
      try {
        el.click();
      } catch {
        /* ignore */
      }
    }
  });
  await sleep(300);
}

async function openSettingsSection(page, section) {
  await page.evaluate(() => {
    document.querySelector('[aria-label="Account menu"]')?.click();
  });
  await sleep(350);
  await page.evaluate(() => {
    [...document.querySelectorAll("button, [role='menuitem']")]
      .find((n) => /^Settings$/i.test((n.textContent || "").trim()))
      ?.click();
  });
  await sleep(900);
  await page.evaluate((lab) => {
    [...document.querySelectorAll("button, a, nav *, [role='tab']")]
      .find((n) => (n.textContent || "").trim() === lab)
      ?.click();
  }, section);
  await sleep(700);
}

const browser = await puppeteer.launch({
  executablePath: "/usr/bin/google-chrome-stable",
  headless: "new",
  args: ["--no-sandbox", "--disable-dev-shm-usage", "--window-size=1440,900"],
  defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
});

const page = await browser.newPage();
await page.emulateMediaFeatures([{ name: "prefers-color-scheme", value: "dark" }]);
await page.goto(`${BASE}/?token=${encodeURIComponent(TOKEN)}`, {
  waitUntil: "networkidle2",
  timeout: 60000,
});
await sleep(2500);
await privacyPrep(page);

// --- Install docs (sidebar open but trees folded; dark) ---
await openPlugins(page);
await shot(page, "01-plugins-panel.png");

await page.evaluate(() => {
  [...document.querySelectorAll("button")]
    .find((b) => /Add plugin/i.test(b.textContent || ""))
    ?.click();
});
await sleep(700);
await page.evaluate(() => {
  const input = document.querySelector(
    'input[placeholder*="ackage"], input[placeholder*="address"], input[type="text"]',
  );
  if (input) {
    input.focus();
    input.value = "";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
});
// Type the install URL
const inputSel = await page.evaluate(() => {
  const input = [...document.querySelectorAll("input")].find((i) => {
    const ph = (i.placeholder || "").toLowerCase();
    return ph.includes("package") || ph.includes("address") || ph.includes("npm") || i.type === "text";
  });
  if (!input) return null;
  input.setAttribute("data-capture-target", "1");
  return true;
});
if (inputSel) {
  await page.click('[data-capture-target="1"]', { clickCount: 3 });
  await page.type(
    '[data-capture-target="1"]',
    "https://github.com/1nsaint/DSH-IDE-Tools",
    { delay: 5 },
  );
}
await sleep(400);
await shot(page, "02-add-plugin-dialog.png");

// Close dialog
await page.keyboard.press("Escape");
await sleep(400);

// Back to chat / workbench with collapsed sidebar
await page.goto(`${BASE}/`, { waitUntil: "networkidle2", timeout: 60000 });
await sleep(2000);
await privacyPrep(page);

await shot(page, "03-overview-chat.png");

await clickTab(page, "Code");
await shot(page, "05-code-tab.png");

await clickTab(page, "Git");
await shot(page, "06-git.png");

await clickTab(page, "Terminal");
await shot(page, "07-terminal.png");

await clickTab(page, "Downloads");
await shot(page, "08-downloads.png");

await clickTab(page, "Browser");
await shot(page, "09-browser.png");

await clickTab(page, "Database");
await shot(page, "10-database.png");

await clickTab(page, "Scheduled");
await shot(page, "11-scheduled.png");

await clickTab(page, "Containers");
await shot(page, "12-containers.png");

// Split view
await clickTab(page, "Code");
await page.evaluate(() => {
  const split = [...document.querySelectorAll("button")].find(
    (b) => /split/i.test(b.getAttribute("aria-label") || "") || /split/i.test(b.getAttribute("title") || ""),
  );
  split?.click();
});
await sleep(900);
await privacyPrep(page);
await shot(page, "13-split-view.png");

// Close split if possible
await page.evaluate(() => {
  const close = [...document.querySelectorAll("button")].find((b) =>
    /close split|exit split|unsplit/i.test(b.getAttribute("aria-label") || ""),
  );
  close?.click();
});
await sleep(400);

// Lite mode + SSH (settings) — no sidebar chat list in modal, but collapse anyway
await openSettingsSection(page, "Lite mode");
await privacyPrep(page);
// Settings modal: expand sidebar was collapsed — fine
await shot(page, "15-lite-mode.png");

await page.evaluate(() => {
  [...document.querySelectorAll("button, a, nav *")]
    .find((n) => (n.textContent || "").trim() === "SSH")
    ?.click();
});
await sleep(700);
await privacyPrep(page);
await shot(page, "16-ssh.png");

await browser.close();
console.log("done");

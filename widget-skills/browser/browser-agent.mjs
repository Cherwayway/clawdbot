// browser-agent.mjs — Headless Chromium browser control via Playwright
// Persists browser state across invocations using a state file.

import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'node:fs';

const STATE_FILE = '/tmp/browser-state.json';
const CDP_PORT = 9222;
const CDP_URL = `http://127.0.0.1:${CDP_PORT}`;
const MAX_SNAPSHOT_CHARS = 50000;
const CHROMIUM_STARTUP_TIMEOUT_MS = 15000;
const CHROMIUM_POLL_INTERVAL_MS = 200;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadState() {
  try {
    return JSON.parse(readFileSync(STATE_FILE, 'utf-8'));
  } catch {
    return null;
  }
}

function saveState(state) {
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2));
}

function clearState() {
  try { unlinkSync(STATE_FILE); } catch { /* ignore */ }
}

/** Poll http://127.0.0.1:CDP_PORT/json/version until Chrome is ready. */
async function waitForChrome(timeoutMs = CHROMIUM_STARTUP_TIMEOUT_MS) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${CDP_URL}/json/version`);
      if (res.ok) {
        const data = await res.json();
        return data.webSocketDebuggerUrl || null;
      }
    } catch { /* not ready yet */ }
    await new Promise(r => setTimeout(r, CHROMIUM_POLL_INTERVAL_MS));
  }
  throw new Error(`Chromium did not start within ${timeoutMs}ms`);
}

/** Launch Chromium as a detached background process. */
async function launchChromium() {
  // Find chromium binary (playwright installs it here)
  const possiblePaths = [
    '/root/.cache/ms-playwright/chromium-*/chrome-linux/chrome',
  ];

  // Use Playwright's own executable path resolver (most reliable)
  const pw = await getPlaywright();
  let chromePath = null;
  try {
    chromePath = pw.chromium.executablePath();
  } catch { /* ignore */ }

  if (!chromePath || !existsSync(chromePath)) {
    // Fallback: search common Playwright cache locations
    const { execSync } = await import('node:child_process');
    for (const searchDir of ['/root/.cache/ms-playwright', '/ms-playwright']) {
      if (!chromePath && existsSync(searchDir)) {
        try {
          chromePath = execSync(`find ${searchDir} -name chrome -type f 2>/dev/null | head -1`, { encoding: 'utf-8' }).trim();
        } catch { /* ignore */ }
      }
    }
  }

  if (!chromePath || !existsSync(chromePath)) {
    // Fallback: try system chromium
    const { execSync } = await import('node:child_process');
    for (const bin of ['chromium', 'chromium-browser', 'google-chrome']) {
      try {
        const p = execSync(`which ${bin} 2>/dev/null`, { encoding: 'utf-8' }).trim();
        if (p) { chromePath = p; break; }
      } catch { /* ignore */ }
    }
  }

  if (!chromePath || !existsSync(chromePath)) {
    throw new Error('Chromium not found. Ensure Playwright is installed with chromium.');
  }

  const args = [
    `--remote-debugging-port=${CDP_PORT}`,
    '--headless=new',
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-sync',
    '--disable-background-networking',
    '--disable-component-update',
    '--disable-features=Translate,MediaRouter',
    '--no-first-run',
    '--disable-gpu',
    'about:blank',
  ];

  const proc = spawn(chromePath, args, {
    stdio: 'ignore',
    detached: true,
  });
  proc.unref();

  const wsEndpoint = await waitForChrome();

  const state = {
    pid: proc.pid,
    cdpPort: CDP_PORT,
    wsEndpoint,
  };
  saveState(state);
  return state;
}

/** Ensure Chromium is running, return state. */
async function ensureBrowser() {
  const state = loadState();
  if (state && state.pid) {
    // Check if process is still alive
    try {
      process.kill(state.pid, 0);
      // Verify CDP is responsive
      const res = await fetch(`${CDP_URL}/json/version`).catch(() => null);
      if (res && res.ok) return state;
    } catch { /* process dead */ }
    clearState();
  }
  return await launchChromium();
}

/** Kill the running Chromium process. */
function killBrowser() {
  const state = loadState();
  if (state && state.pid) {
    try { process.kill(state.pid, 'SIGTERM'); } catch { /* ignore */ }
    // Give it a moment then force kill
    setTimeout(() => {
      try { process.kill(state.pid, 'SIGKILL'); } catch { /* ignore */ }
    }, 1000);
  }
  clearState();
}

// ---------------------------------------------------------------------------
// Playwright connection
// ---------------------------------------------------------------------------

let _pw = null;
async function getPlaywright() {
  if (!_pw) {
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    _pw = require('playwright');
  }
  return _pw;
}

async function connectBrowser() {
  const state = await ensureBrowser();
  const pw = await getPlaywright();

  // Get fresh wsEndpoint from /json/version
  let wsEndpoint = state.wsEndpoint;
  try {
    const res = await fetch(`${CDP_URL}/json/version`);
    const data = await res.json();
    if (data.webSocketDebuggerUrl) {
      wsEndpoint = data.webSocketDebuggerUrl;
    }
  } catch { /* use saved endpoint */ }

  const browser = await pw.chromium.connectOverCDP(wsEndpoint);
  return browser;
}

async function getActivePage(browser) {
  const contexts = browser.contexts();
  const pages = contexts.flatMap(c => c.pages());
  if (pages.length === 0) {
    // Create a new page
    const context = contexts[0] || await browser.newContext();
    return await context.newPage();
  }
  return pages[pages.length - 1]; // Most recent page
}

// ---------------------------------------------------------------------------
// Snapshot
// ---------------------------------------------------------------------------

async function takeSnapshot(page) {
  // Use Playwright's internal _snapshotForAI API
  const maybe = page;
  if (typeof maybe._snapshotForAI === 'function') {
    try {
      const result = await maybe._snapshotForAI({ timeout: 5000 });
      let snapshot = String(result?.full ?? '');
      if (snapshot.length > MAX_SNAPSHOT_CHARS) {
        snapshot = snapshot.slice(0, MAX_SNAPSHOT_CHARS) + '\n\n[...TRUNCATED - page too large]';
      }
      return snapshot;
    } catch (err) {
      // Fall through to ariaSnapshot
    }
  }

  // Fallback: use ariaSnapshot
  try {
    const snapshot = await page.locator(':root').ariaSnapshot();
    let text = String(snapshot ?? '');
    if (text.length > MAX_SNAPSHOT_CHARS) {
      text = text.slice(0, MAX_SNAPSHOT_CHARS) + '\n\n[...TRUNCATED - page too large]';
    }
    return text;
  } catch (err) {
    return `[Error getting snapshot: ${err.message}]`;
  }
}

// ---------------------------------------------------------------------------
// Element locator from ref
// ---------------------------------------------------------------------------

function resolveRef(page, ref) {
  // Normalize ref: strip leading @, ref= prefix
  let normalized = ref;
  if (normalized.startsWith('@')) normalized = normalized.slice(1);
  if (normalized.startsWith('ref=')) normalized = normalized.slice(4);

  // Playwright aria-ref locator
  return page.locator(`aria-ref=${normalized}`);
}

// ---------------------------------------------------------------------------
// Commands
// ---------------------------------------------------------------------------

async function cmdOpen(url) {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    await page.goto(url, { timeout: 30000, waitUntil: 'domcontentloaded' });
    const snapshot = await takeSnapshot(page);
    console.log(`Navigated to: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdSnapshot() {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    const snapshot = await takeSnapshot(page);
    console.log(`Page: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdScreenshot(outputPath) {
  const path = outputPath || '/tmp/browser-screenshot.png';
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    await page.screenshot({ path, fullPage: false });
    console.log(`Screenshot saved to: ${path}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdClick(ref) {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    const locator = resolveRef(page, ref);
    await locator.click({ timeout: 5000 });
    // Wait for potential navigation/rendering
    await page.waitForTimeout(500);
    const snapshot = await takeSnapshot(page);
    console.log(`Clicked [ref=${ref}]\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdType(ref, text) {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    const locator = resolveRef(page, ref);
    await locator.fill(text, { timeout: 5000 });
    const snapshot = await takeSnapshot(page);
    console.log(`Typed "${text}" into [ref=${ref}]\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdSelect(ref, value) {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    const locator = resolveRef(page, ref);
    await locator.selectOption(value, { timeout: 5000 });
    const snapshot = await takeSnapshot(page);
    console.log(`Selected "${value}" in [ref=${ref}]\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdHover(ref) {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    const locator = resolveRef(page, ref);
    await locator.hover({ timeout: 5000 });
    const snapshot = await takeSnapshot(page);
    console.log(`Hovered [ref=${ref}]\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdEvaluate(code) {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    const result = await page.evaluate(code);
    console.log(typeof result === 'string' ? result : JSON.stringify(result, null, 2));
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdBack() {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    await page.goBack({ timeout: 10000 });
    await page.waitForTimeout(500);
    const snapshot = await takeSnapshot(page);
    console.log(`Navigated back\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdForward() {
  const browser = await connectBrowser();
  try {
    const page = await getActivePage(browser);
    await page.goForward({ timeout: 10000 });
    await page.waitForTimeout(500);
    const snapshot = await takeSnapshot(page);
    console.log(`Navigated forward\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdTabs() {
  const browser = await connectBrowser();
  try {
    const contexts = browser.contexts();
    const pages = contexts.flatMap(c => c.pages());
    if (pages.length === 0) {
      console.log('No open tabs.');
      return;
    }
    const lines = pages.map((p, i) =>
      `  [${i}] ${p.url()} — ${p.url()}`
    );
    console.log(`Open tabs (${pages.length}):\n${lines.join('\n')}`);
  } finally {
    browser.close().catch(() => {});
  }
}

async function cmdTab(index) {
  const browser = await connectBrowser();
  try {
    const contexts = browser.contexts();
    const pages = contexts.flatMap(c => c.pages());
    const idx = parseInt(index, 10);
    if (isNaN(idx) || idx < 0 || idx >= pages.length) {
      console.error(`Invalid tab index: ${index}. Available: 0-${pages.length - 1}`);
      process.exit(1);
    }
    const page = pages[idx];
    await page.bringToFront();
    const snapshot = await takeSnapshot(page);
    console.log(`Switched to tab [${idx}]\n\nPage: ${page.url()}\n\n${snapshot}`);
  } finally {
    browser.close().catch(() => {});
  }
}

function cmdClose() {
  killBrowser();
  console.log('Browser closed.');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  console.error('Usage: browser <command> [args...]');
  console.error('Commands: open, snapshot, screenshot, click, type, select, hover, evaluate, back, forward, tabs, tab, close');
  process.exit(1);
}

try {
  switch (command) {
    case 'open':
      if (!args[1]) { console.error('Usage: browser open <url>'); process.exit(1); }
      await cmdOpen(args[1]);
      break;
    case 'snapshot':
      await cmdSnapshot();
      break;
    case 'screenshot':
      await cmdScreenshot(args[1]);
      break;
    case 'click':
      if (!args[1]) { console.error('Usage: browser click <ref>'); process.exit(1); }
      await cmdClick(args[1]);
      break;
    case 'type':
      if (!args[1] || !args[2]) { console.error('Usage: browser type <ref> "text"'); process.exit(1); }
      await cmdType(args[1], args[2]);
      break;
    case 'select':
      if (!args[1] || !args[2]) { console.error('Usage: browser select <ref> "value"'); process.exit(1); }
      await cmdSelect(args[1], args[2]);
      break;
    case 'hover':
      if (!args[1]) { console.error('Usage: browser hover <ref>'); process.exit(1); }
      await cmdHover(args[1]);
      break;
    case 'evaluate':
      if (!args[1]) { console.error('Usage: browser evaluate "js code"'); process.exit(1); }
      await cmdEvaluate(args[1]);
      break;
    case 'back':
      await cmdBack();
      break;
    case 'forward':
      await cmdForward();
      break;
    case 'tabs':
      await cmdTabs();
      break;
    case 'tab':
      if (!args[1]) { console.error('Usage: browser tab <index>'); process.exit(1); }
      await cmdTab(args[1]);
      break;
    case 'close':
      cmdClose();
      break;
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Commands: open, snapshot, screenshot, click, type, select, hover, evaluate, back, forward, tabs, tab, close');
      process.exit(1);
  }
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}

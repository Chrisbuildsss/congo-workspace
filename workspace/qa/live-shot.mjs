#!/usr/bin/env node
// My app: load the running app in the workspace frame and report what it shows.
// Usage: node workspace/qa/live-shot.mjs --base URL [--wait 8000] [--shot file.png]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = new URL(arg('base'));
const hash = base.hash;
base.hash = '';
base.pathname = '/live';
const wait = Number(arg('wait', '8000'));
const shot = arg('shot', '');
const report = { frame: null, text: null, errors: [], console: [] };
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  await page.goto(base.href + hash, { waitUntil: 'domcontentloaded' });
  const frameEl = await page.waitForSelector('.live-frame iframe', { timeout: 20000 });
  report.frame = await frameEl.getAttribute('src');
  const frame = await frameEl.contentFrame();
  frame.page().on('console', (m) => { if (m.type() === 'error') report.console.push(m.text().slice(0, 200)); });
  await page.waitForTimeout(wait);
  report.text = (await frame.evaluate(() => document.body.innerText.trim().slice(0, 160)).catch((e) => `unreadable: ${e.message}`)) || '(empty)';
  if (shot) await page.screenshot({ path: shot });
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

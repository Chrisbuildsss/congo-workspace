#!/usr/bin/env node
// Open a prototype from Prototypes at full size and click through it: checks
// that a whole-app prototype navigates between its own routes.
// Usage: node workspace/qa/prototype-open.mjs --base URL --title "Card title" [--click "People,Inbox"] [--shot file.png]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const base = arg('base');
const title = arg('title');
const clicks = arg('click', '').split(',').map((s) => s.trim()).filter(Boolean);
const shot = arg('shot', '');
if (!base || !title) {
  console.error('Usage: node workspace/qa/prototype-open.mjs --base URL --title TITLE [--click "A,B"] [--shot FILE]');
  process.exit(2);
}

const url = new URL(base);
const hash = url.hash;
url.hash = '';
url.pathname = '/prototypes';
const report = { card: false, opened: false, frame: null, steps: [], errors: [] };
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  await page.goto(url.href + hash, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.design-card', { hasText: title }).first();
  await card.waitFor({ timeout: 20000 });
  report.card = true;
  await card.click({ position: { x: 40, y: 120 } });
  await page.waitForSelector('.design-detail iframe', { timeout: 10000 });
  report.opened = true;
  const frameEl = await page.$('.design-detail iframe');
  report.frame = await frameEl.getAttribute('src');
  const frame = await frameEl.contentFrame();
  await frame.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1500);
  for (const label of clicks) {
    const before = frame.url();
    await frame.getByRole('link', { name: label }).or(frame.getByRole('button', { name: label })).first().click({ timeout: 5000 }).catch((e) => report.errors.push(`${label}: ${e.message.split('\n')[0]}`));
    await page.waitForTimeout(1200);
    const heading = await frame.evaluate(() => (document.querySelector('h1, h2')?.textContent || '').trim().slice(0, 60)).catch(() => null);
    report.steps.push({ click: label, from: new URL(before).pathname, to: new URL(frame.url()).pathname, heading });
  }
  if (shot) await page.screenshot({ path: shot });
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

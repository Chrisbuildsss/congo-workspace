#!/usr/bin/env node
// Library request tray: select apps and a screen, add notes, then capture the
// tray at 390 and 1440 CSS px in light and dark. The tray is kept by the
// workspace, so later visits show the same selection.
// Usage: node workspace/qa/tray-flow.mjs --base URL --out DIR [--apps 2] [--app SLUG] [--note "..."] [--no-select]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const base = arg('base');
const out = path.resolve(arg('out', 'workspace/qa/out'));
const appCount = Number(arg('apps', '2'));
const appSlug = arg('app', '');
const note = arg('note', '');
const select = !args.includes('--no-select');
if (!base) {
  console.error('Usage: node workspace/qa/tray-flow.mjs --base URL --out DIR [--apps 2] [--app SLUG] [--note TEXT]');
  process.exit(2);
}

const at = (route) => {
  const url = new URL(base);
  const hash = url.hash;
  url.hash = '';
  url.pathname = route;
  return url.href + hash;
};

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
const report = { selected: [], tray: null, shots: [], errors: [] };
try {
  if (select) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on('pageerror', (e) => report.errors.push(String(e)));
    await page.goto(at('/library'), { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.community-grid .design-card', { timeout: 20000 });
    for (let i = 0; i < appCount; i++) {
      const card = page.locator('.community-grid .design-card').nth(i);
      await card.hover();
      await card.locator('.selection-bubble').click();
      report.selected.push(await card.getAttribute('aria-label'));
    }
    await page.waitForTimeout(600);
    if (appSlug) {
      await page.goto(at(`/library/apps/${appSlug}`), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.community-grid .design-card', { timeout: 20000 });
      const card = page.locator('.community-grid .design-card').first();
      await card.hover();
      await card.locator('.selection-bubble').click();
      report.selected.push(await card.getAttribute('aria-label'));
    }
    const notes = page.locator('.request-tray-note');
    const count = await notes.count();
    for (let i = 0; i < count; i++) await notes.nth(i).fill(i === 0 ? 'Start from this one' : 'Use this for the calling screen');
    if (note) await page.locator('.global-composer .composer-input').fill(note);
    await page.waitForTimeout(800);
    report.tray = await page.evaluate(() => [...document.querySelectorAll('.request-tray-item b')].map((b) => b.textContent));
    await page.close();
  }
  for (const scheme of ['light', 'dark']) {
    for (const size of [{ name: '390', width: 390, height: 844 }, { name: '1440', width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });
      const page = await context.newPage();
      await page.goto(at('/library'), { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.community-grid .design-card', { timeout: 20000 }).catch(() => {});
      await page.waitForFunction(() => [...document.querySelectorAll('.community-grid img, .request-tray img')].slice(0, 6).every((img) => img.complete && img.naturalWidth > 0), null, { timeout: 20000 }).catch(() => {});
      await page.waitForTimeout(800);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
      const file = path.join(out, `library-tray-${size.name}-${scheme}.png`);
      await page.screenshot({ path: file });
      report.shots.push({ file: path.relative(process.cwd(), file), horizontalOverflow: overflow });
      await context.close();
    }
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

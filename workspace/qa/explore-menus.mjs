#!/usr/bin/env node
// Explore's bar and card actions in use: a card hovered, and the category,
// sort and view lists open, at 1440 CSS px (light and dark) and the category
// list at 390.
// Usage: node workspace/qa/explore-menus.mjs --base URL --out DIR [--cache DIR] [--name after]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = arg('base');
const out = path.resolve(arg('out', 'workspace/qa/out'));
const cache = arg('cache', '');
const name = arg('name', 'after');
if (!base) {
  console.error('Usage: node workspace/qa/explore-menus.mjs --base URL --out DIR');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const shots = [];
const errors = [];
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  if (cache) {
    await context.route(/\/api\/catalog\/media\//, async (route) => {
      const file = path.join(cache, route.request().url().replace(/[^a-z0-9]+/gi, '-').slice(-150));
      if (!fs.existsSync(file)) return route.continue().catch(() => {});
      return route.fulfill({ status: 200, contentType: fs.readFileSync(`${file}.type`, 'utf8'), body: fs.readFileSync(file) });
    });
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(String(e)));
  const open = async (route, width, height, scheme) => {
    await page.setViewportSize({ width, height });
    await page.emulateMedia({ colorScheme: scheme });
    const url = new URL(base);
    const hash = url.hash;
    url.hash = '';
    url.pathname = route;
    await page.goto(url.href + hash, { waitUntil: 'domcontentloaded' }).catch(() => {});
    await page.waitForFunction(() => {
      const inView = [...document.querySelectorAll('.design-card img')].filter((img) => img.getBoundingClientRect().top < window.innerHeight);
      return inView.length > 0 && inView.every((img) => img.complete && img.naturalWidth > 0);
    }, null, { timeout: 120000 }).catch(() => errors.push(`${route}: pictures still loading`));
    await page.waitForTimeout(800);
  };
  const shot = async (label) => {
    const file = path.join(out, `${name}-${label}.png`);
    await page.screenshot({ path: file });
    shots.push(path.relative(process.cwd(), file));
  };
  // The bar the page shows at this width: the top bar when wide, the row under it on a phone.
  const tool = (label) => page.locator(`.library-tool-button[aria-label^="${label}"]:visible`).first();

  for (const scheme of ['light', 'dark']) {
    await open('/explore', 1440, 900, scheme);
    await page.locator('.design-card').nth(1).hover();
    await page.waitForTimeout(500);
    await shot(`card-hover-1440-${scheme}`);
    const card = page.locator('.design-card').nth(1);
    await card.locator('.quick-more-toggle').click();
    await page.waitForTimeout(400);
    await shot(`card-more-1440-${scheme}`);
    await card.locator('.quick-more-toggle').click();
    // A note typed on the card puts it into the request, with the note.
    await card.locator('.quick-vary-form input').fill('Use this layout for the home screen');
    await card.locator('.quick-vary-form input').press('Enter');
    await page.waitForTimeout(700);
    await shot(`card-note-in-request-1440-${scheme}`);
    await page.locator('.request-tray button', { hasText: 'Clear' }).first().click().catch(() => {});
    await page.mouse.move(5, 500);
    for (const label of ['Category', 'Sort', 'View']) {
      await tool(label).click();
      await page.waitForTimeout(350);
      await shot(`${label.toLowerCase()}-list-1440-${scheme}`);
      await tool(label).click();
      await page.waitForTimeout(200);
    }
    await open('/explore/screens', 1440, 900, scheme);
    await tool('Category').click();
    await page.waitForTimeout(350);
    await shot(`screens-category-list-1440-${scheme}`);
    await tool('Category').click();

    await open('/explore', 390, 844, scheme);
    await tool('Category').click();
    await page.waitForTimeout(350);
    await shot(`category-list-390-${scheme}`);
    await tool('Category').click();
  }
  await context.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify({ shots: shots.length, errors }, null, 1));

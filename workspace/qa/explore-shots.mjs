#!/usr/bin/env node
// Explore screenshots: Apps, one app's screens, Screens and Saved, at 390 and
// 1440 CSS px (and one wide 1920 px pass), light and dark. Also reports how
// each picture is shown: its real size, the size it is drawn at, and whether
// any of it is cut off or scaled up.
// Usage: node workspace/qa/explore-shots.mjs --base URL --out DIR [--app SLUG] [--name before] [--routes /explore,...]
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
const app = arg('app', '');
const name = arg('name', '');
const columns = arg('columns', '');
// A folder that keeps downloaded pictures between runs (slow connections).
const cache = arg('cache', '');
const wait = Number(arg('wait', '150')) * 1000;
const only = arg('sizes', '');
const routes = arg('routes', ['/explore', app ? `/explore/apps/${app}` : '', '/explore/screens', '/explore/saved'].filter(Boolean).join(',')).split(',');
if (!base) {
  console.error('Usage: node workspace/qa/explore-shots.mjs --base URL --out DIR [--app SLUG]');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const sizes = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
  { name: '1920', width: 1920, height: 1080, schemes: ['light'] },
];
const report = { shots: [], pictures: {}, errors: [] };
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  // One session for every size and theme, so each picture downloads once.
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  if (columns) await context.addInitScript((value) => { try { localStorage.setItem('congo-explore-columns', value); } catch {} }, columns);
  if (cache) {
    fs.mkdirSync(cache, { recursive: true });
    await context.route(/\/api\/catalog\/media\//, async (route) => {
      const key = route.request().url().replace(/[^a-z0-9]+/gi, '-').slice(-150);
      const file = path.join(cache, key);
      try {
        if (fs.existsSync(file)) {
          const type = fs.readFileSync(`${file}.type`, 'utf8');
          return await route.fulfill({ status: 200, contentType: type, body: fs.readFileSync(file) });
        }
        const response = await route.fetch({ timeout: 600000 });
        const body = await response.body();
        if (response.ok()) {
          fs.writeFileSync(`${file}.type`, response.headers()['content-type'] ?? 'image/png');
          fs.writeFileSync(file, body);
        }
        return await route.fulfill({ response, body });
      } catch {
        return route.continue().catch(() => {});
      }
    });
  }
  const page = await context.newPage();
  page.on('pageerror', (e) => report.errors.push(String(e)));
  for (const size of sizes.filter((item) => !only || only.split(',').includes(item.name))) {
    for (const scheme of size.schemes ?? ['light', 'dark']) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: scheme });
      for (const route of routes) {
        const url = new URL(base);
        const hash = url.hash;
        url.hash = '';
        url.pathname = route;
        await page.goto(url.href + hash, { waitUntil: 'domcontentloaded' }).catch(() => {});
        await page.waitForSelector('.design-card img, .explore-gate, .library-error', { timeout: 30000 }).catch(() => {});
        // Covers are large: wait until the ones in view have fully arrived.
        const loaded = await page.waitForFunction(() => {
          if (document.querySelector('.explore-gate')) return true;
          const inView = [...document.querySelectorAll('.design-card img')].filter((img) => img.getBoundingClientRect().top < window.innerHeight);
          return inView.length > 0 && inView.every((img) => img.complete && img.naturalWidth > 0);
        }, null, { timeout: wait }).then(() => true).catch(() => false);
        if (!loaded) report.errors.push(`${route} ${size.name}/${scheme}: pictures still loading after ${wait / 1000} s`);
        await page.waitForTimeout(1200);
        const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        const file = path.join(out, `${name ? `${name}-` : ''}${slug}-${size.name}-${scheme}.png`);
        await page.screenshot({ path: file });
        report.shots.push(path.relative(process.cwd(), file));
        if (scheme === 'light') {
          report.pictures[`${slug}-${size.name}`] = await page.evaluate(() => {
            const cards = [...document.querySelectorAll('.design-card')].filter((card) => card.querySelector('img'));
            const rows = cards
              .filter((card) => card.querySelector('img').naturalWidth > 0)
              .slice(0, 12)
              .map((card) => {
                const img = card.querySelector('img');
                const box = img.getBoundingClientRect();
                const frame = card.getBoundingClientRect();
                const fit = getComputedStyle(img).objectFit;
                const natural = img.naturalWidth / img.naturalHeight;
                const drawn = box.width / box.height;
                const cut = fit === 'cover' && Math.abs(natural - drawn) > 0.02;
                const shownWidth = fit === 'cover' ? Math.max(box.width, box.height * natural) : Math.min(box.width, box.height * natural);
                return {
                  real: `${img.naturalWidth}x${img.naturalHeight}`,
                  card: `${Math.round(frame.width)}x${Math.round(frame.height)}`,
                  cut,
                  scaledUp: shownWidth > img.naturalWidth + 1,
                };
              });
            const columns = new Set(cards.slice(0, 24).map((card) => Math.round(card.getBoundingClientRect().left))).size;
            return { columns, cards: cards.length, checked: rows.length, cut: rows.filter((row) => row.cut).length, scaledUp: rows.filter((row) => row.scaledUp).length, sample: rows.slice(0, 6) };
          });
        }
      }
    }
  }
  await context.close();
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, `${name ? `${name}-` : ''}explore-report.json`), JSON.stringify(report, null, 2));
console.log(JSON.stringify({ shots: report.shots.length, errors: report.errors, pictures: report.pictures }, null, 1));

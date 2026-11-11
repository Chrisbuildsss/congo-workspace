#!/usr/bin/env node
// Milestone screenshots: every route at 390 and 1440 CSS px, light and dark.
// Usage: node workspace/qa/screens.mjs --base URL --out DIR [--routes /a,/b] [--wait-for SELECTOR]
// The token, when the base URL carries one in its hash, is kept for every route.
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
const routes = arg('routes', '/').split(',').filter(Boolean);
const waitFor = arg('wait-for', '');
const settle = Number(arg('settle', '900'));
if (!base) {
  console.error('Usage: node workspace/qa/screens.mjs --base URL --out DIR [--routes /a,/b]');
  process.exit(2);
}

const sizes = [
  { name: '390', width: 390, height: 844 },
  { name: '1440', width: 1440, height: 900 },
];
const schemes = ['light', 'dark'];

fs.mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const results = [];
try {
  for (const scheme of schemes) {
    for (const size of sizes) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        colorScheme: scheme,
        deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      for (const route of routes) {
        const url = new URL(base);
        const hash = url.hash;
        url.hash = '';
        const [pathname, search = ''] = route.split('?');
        url.pathname = pathname;
        url.search = search ? `?${search}` : '';
        await page.goto(url.href + hash, { waitUntil: 'networkidle' }).catch(() => {});
        if (waitFor) await page.waitForSelector(waitFor, { timeout: 15000 }).catch(() => {});
        await page.waitForTimeout(settle);
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
        const slug = route.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '') || 'home';
        const file = path.join(out, `${slug}-${size.name}-${scheme}.png`);
        await page.screenshot({ path: file });
        results.push({ route, size: size.name, scheme, file: path.relative(process.cwd(), file), horizontalOverflow: overflow, errors: [...errors] });
        errors.length = 0;
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
}
fs.writeFileSync(path.join(out, 'screens.json'), JSON.stringify(results, null, 2));
const bad = results.filter((r) => r.horizontalOverflow || r.errors.length);
console.log(JSON.stringify({ shots: results.length, out: path.relative(process.cwd(), out), problems: bad }, null, 2));

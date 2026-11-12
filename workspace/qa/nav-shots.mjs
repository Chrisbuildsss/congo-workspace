#!/usr/bin/env node
// The left navigation, closed and open, on one route at 390 and 1440 CSS px,
// light and dark.
// Usage: node workspace/qa/nav-shots.mjs --base URL --out DIR [--route /prototypes] [--name after]
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
const route = arg('route', '/prototypes');
const name = arg('name', 'nav');
if (!base) {
  console.error('Usage: node workspace/qa/nav-shots.mjs --base URL --out DIR');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const shots = [];
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  for (const size of [{ name: '390', width: 390, height: 844 }, { name: '1440', width: 1440, height: 900 }]) {
    for (const scheme of ['light', 'dark']) {
      await page.setViewportSize({ width: size.width, height: size.height });
      await page.emulateMedia({ colorScheme: scheme });
      const url = new URL(base);
      const hash = url.hash;
      url.hash = '';
      url.pathname = route;
      await page.goto(url.href + hash, { waitUntil: 'domcontentloaded' }).catch(() => {});
      await page.waitForTimeout(2500);
      const shot = async (state) => {
        const file = path.join(out, `${name}-${state}-${size.name}-${scheme}.png`);
        await page.screenshot({ path: file });
        shots.push(path.relative(process.cwd(), file));
      };
      if (size.width > 900) await shot('closed');
      const toggle = page.locator(size.width > 900 ? '.sidebar-menu-button' : '.mobile-menu-trigger').first();
      await toggle.click().catch(() => {});
      await page.waitForTimeout(600);
      await shot('open');
      // Leave the sidebar closed for the next pass.
      await page.locator('.sidebar-menu-button').first().click().catch(() => {});
      await page.waitForTimeout(300);
    }
  }
  await context.close();
} finally {
  await browser.close();
}
console.log(JSON.stringify({ shots }, null, 1));

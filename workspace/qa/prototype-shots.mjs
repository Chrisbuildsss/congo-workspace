#!/usr/bin/env node
// Screenshots of Prototypes and the opened views at 390 and 1440 CSS px, light
// and dark: the grid (with a skeleton card), a prototype opened as a desktop
// preview, its brief opened from the "i" icon, the Pull into a project dialog,
// and an Explore item's Preview.
// Usage: node workspace/qa/prototype-shots.mjs --base URL --out DIR --title "Card title" [--app SLUG]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const base = new URL(arg('base'));
const hash = base.hash;
const origin = `${base.protocol}//${base.host}`;
const out = path.resolve(arg('out', 'workspace/qa/out'));
const title = arg('title');
const appSlug = arg('app', '');
fs.mkdirSync(out, { recursive: true });

const report = { shots: [], measures: [], errors: [] };
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  for (const scheme of ['light', 'dark']) {
    for (const size of [{ name: '390', width: 390, height: 844 }, { name: '1440', width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });
      const page = await context.newPage();
      page.on('pageerror', (e) => report.errors.push(`${size.name}/${scheme}: ${e}`));
      const shot = async (name) => {
        const file = path.join(out, `${name}-${size.name}-${scheme}.png`);
        await page.screenshot({ path: file });
        report.shots.push(path.relative(process.cwd(), file));
      };
      await page.goto(`${origin}/prototypes${hash}`, { waitUntil: 'domcontentloaded' });
      const card = page.locator('.design-card', { has: page.locator('.card-title-pill b', { hasText: title }) }).first();
      await card.waitFor({ timeout: 20000 });
      await page.waitForTimeout(2500);
      await shot('prototypes');

      await card.click({ position: { x: 40, y: 120 } });
      await page.waitForSelector('.design-detail iframe', { timeout: 10000 });
      await page.waitForTimeout(2000);
      const frame = await page.locator('.design-detail iframe').boundingBox();
      const panel = await page.locator('.chat-panel').count();
      report.measures.push({ size: size.name, scheme, frameWidth: Math.round(frame.width), frameLeft: Math.round(frame.x), viewport: size.width, sidePanelOpen: panel > 0 });
      await shot('prototype-open');

      await page.locator('.design-detail [aria-label="Show the brief"]').click();
      await page.waitForSelector('.detail-brief', { timeout: 5000 });
      await page.waitForTimeout(500);
      await shot('prototype-brief');
      await page.locator('.design-detail [aria-label="Hide the brief"]').click();

      await page.locator('.design-detail .detail-export', { hasText: 'Pull into a project' }).click();
      await page.waitForSelector('.pull-card', { timeout: 5000 });
      await page.waitForTimeout(400);
      await shot('pull-into-a-project');
      await page.locator('.pull-card button', { hasText: 'Cancel' }).click();

      await context.close();
    }
  }
} catch (error) {
  report.errors.push(error.message.split('\n')[0]);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

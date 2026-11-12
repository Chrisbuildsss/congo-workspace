#!/usr/bin/env node
// QA helper: open Live App and click a button by its visible name.
// Usage: node workspace/qa/live-click.mjs --base URL --button "Ask my AI to start it" [--shot file.png]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const arg = (n) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : undefined; };
const base = new URL(arg('base')); const hash = base.hash; base.hash = ''; base.pathname = '/live';
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base.href + hash, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.getByRole('button', { name: arg('button') }).click();
  await page.waitForTimeout(1200);
  if (arg('shot')) await page.screenshot({ path: arg('shot') });
  console.log(JSON.stringify({ clicked: arg('button'), toast: await page.locator('.toast').textContent().catch(() => null) }));
} finally {
  await browser.close();
}

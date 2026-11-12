#!/usr/bin/env node
// QA helper: open a compose, open a card's detail view, press Edit, and
// report whether Impeccable's live editor loaded inside the design.
// Usage: node workspace/qa/edit-design.mjs --base URL --compose <id> --card N [--shot file.png]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = new URL(arg('base')); const hash = base.hash; base.hash = ''; base.pathname = `/compose/${arg('compose')}`;
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base.href + hash, { waitUntil: 'networkidle' });
  const card = page.locator('.design-card').nth(Number(arg('card', '1')) - 1);
  await card.waitFor();
  await card.click({ position: { x: 40, y: 120 } });
  await page.locator('.design-detail').waitFor();
  await page.getByRole('button', { name: /^Edit$/ }).click();
  await page.waitForTimeout(6000);
  const contentOrigin = await page.evaluate(() => fetch('/api/status', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('congo-workspace-token') } }).then((r) => r.json()).then((s) => s.contentOrigin));
  const frames = page.frames().filter((f) => f !== page.mainFrame() && f.url().startsWith(contentOrigin));
  const loaded = [];
  for (const f of frames) loaded.push(await f.evaluate(() => Boolean(document.getElementById('impeccable-live-highlight'))).catch(() => false));
  const frame = frames[loaded.indexOf(true)] ?? null;
  const editor = loaded.includes(true);
  if (arg('shot')) await page.screenshot({ path: arg('shot') });
  console.log(JSON.stringify({ editFrame: frame?.url() ?? null, impeccableEditorLoaded: editor, toast: await page.locator('.toast').textContent().catch(() => null) }));
} finally {
  await browser.close();
}

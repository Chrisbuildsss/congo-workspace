#!/usr/bin/env node
// QA helper: open a card's detail view, press Edit on a script-bundle design,
// confirm the workspace offers Make editable, and press it.
// Usage: node workspace/qa/make-editable.mjs --base URL --compose <id> --card N [--shot file.png] [--no-click]
import { chromium } from 'playwright';
const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = new URL(arg('base')); const hash = base.hash; base.hash = ''; base.pathname = `/compose/${arg('compose')}`;
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base.href + hash, { waitUntil: 'networkidle' });
  const card = page.locator('.design-card').nth(Number(arg('card', '1')) - 1);
  await card.waitFor();
  await card.click({ position: { x: 40, y: 120 } });
  await page.locator('.design-detail').waitFor();
  await page.getByRole('button', { name: /^Edit$/ }).click();
  const offer = page.getByRole('button', { name: /^Make editable$/ });
  await offer.waitFor({ timeout: 8000 });
  const toast = await page.locator('.toast').textContent().catch(() => null);
  if (arg('shot')) await page.screenshot({ path: arg('shot') });
  let sent = null;
  if (!args.includes('--no-click')) {
    await offer.click();
    await page.waitForTimeout(1500);
    sent = await page.evaluate(() => fetch('/api/state', { headers: { Authorization: 'Bearer ' + sessionStorage.getItem('congo-workspace-token') } })
      .then((r) => r.json())
      .then((s) => Object.values(s.requests ?? {}).filter((r) => r.action?.key === 'editable').map((r) => ({ id: r.id, status: r.status }))));
  }
  console.log(JSON.stringify({ offered: true, toast, detailClosed: !(await page.locator('.design-detail').isVisible()), requests: sent }));
} finally {
  await browser.close();
}

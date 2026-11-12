#!/usr/bin/env node
// Act on one prototype the way a person would, and time the AI's answer:
// open its card from Prototypes, then Expand it, run a quick action on it, or
// Pull it into a project (a new one, or an existing folder).
// Usage: node workspace/qa/prototype-act.mjs --base URL --title "Card title"
//          --do expand | quick:<label> | pull-new | pull-folder:<path> [--wait-min 45] [--shot file.png]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = new URL(arg('base'));
const hash = base.hash;
const token = /t=([^&]+)/.exec(hash)?.[1];
const origin = `${base.protocol}//${base.host}`;
const title = arg('title');
const action = arg('do', 'expand');
const waitMs = Number(arg('wait-min', '45')) * 60_000;
const shot = arg('shot', '');
const state = () => fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const report = { title, action, seconds: null, request: null, errors: [] };

const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => report.errors.push(String(e)));
  await page.goto(`${origin}/prototypes${hash}`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.design-card', { has: page.locator('.card-title-pill b', { hasText: title }) }).first();
  await card.waitFor({ timeout: 30000 });
  await card.scrollIntoViewIfNeeded();
  const before = new Set((await state()).requests.map((r) => r.id));
  const started = Date.now();
  if (action.startsWith('quick:')) {
    await card.hover();
    await card.locator('.card-quick-actions button', { hasText: action.slice(6) }).first().click();
  } else {
    await card.click({ position: { x: 40, y: 120 } });
    await page.waitForSelector('.design-detail iframe', { timeout: 15000 });
    if (action === 'expand') {
      await page.locator('.design-detail .detail-export', { hasText: 'Expand' }).click();
    } else {
      await page.locator('.design-detail .detail-export', { hasText: 'Pull into a project' }).click();
      await page.waitForSelector('.pull-card', { timeout: 5000 });
      if (action === 'pull-new') await page.locator('.pull-card .pull-list button', { hasText: 'A new project' }).click();
      else {
        await page.locator('.pull-card .confirm-input input').fill(action.slice('pull-folder:'.length));
        await page.locator('.pull-card .confirm-input input').press('Enter');
      }
    }
  }
  const request = await (async () => {
    for (const end = Date.now() + 30000; Date.now() < end;) {
      const r = (await state()).requests.find((x) => !before.has(x.id));
      if (r) return r;
      await page.waitForTimeout(250);
    }
    throw new Error('no request was created');
  })();
  report.request = { id: request.id, type: request.type };
  for (const end = Date.now() + waitMs; Date.now() < end;) {
    const r = (await state()).requests.find((x) => x.id === request.id);
    if (r.status !== 'sent') {
      report.seconds = Math.round((Date.now() - started) / 100) / 10;
      report.request = { id: r.id, type: r.type, status: r.status, message: r.message, outputs: r.outputs };
      break;
    }
    await page.waitForTimeout(2000);
  }
  if (shot) {
    await page.waitForTimeout(4000);
    await page.screenshot({ path: shot });
  }
} catch (error) {
  report.errors.push(error.message.split('\n')[0]);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

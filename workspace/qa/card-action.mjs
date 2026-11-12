#!/usr/bin/env node
// QA helper: open a workspace route, hover a design card and click one of its
// hover actions (or a More command), the way a person would.
// Usage: node workspace/qa/card-action.mjs --base URL --route /compose/<id> --card 1 --action "Bolder" [--more] [--shot file.png]
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const base = new URL(arg('base'));
const hash = base.hash;
base.hash = '';
base.pathname = arg('route', '/');
const cardIndex = Number(arg('card', '1')) - 1;
const action = arg('action');
const more = args.includes('--more');
const shot = arg('shot');

const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(base.href + hash, { waitUntil: 'networkidle' });
  const card = page.locator('.design-card').nth(cardIndex);
  await card.waitFor({ timeout: 15000 });
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(400);
  await card.hover();
  await page.waitForTimeout(450);
  const actions = card.locator('.card-quick-actions');
  await actions.waitFor({ state: 'visible', timeout: 5000 });
  if (more) await actions.getByRole('button', { name: 'More', exact: false }).click();
  await actions.getByRole('button', { name: action, exact: false }).first().click();
  const toast = await page.locator('.toast').textContent({ timeout: 5000 }).catch(() => null);
  if (shot) await page.screenshot({ path: shot });
  console.log(JSON.stringify({ clicked: action, more, toast }));
} finally {
  await browser.close();
}

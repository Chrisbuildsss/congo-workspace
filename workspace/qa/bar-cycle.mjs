#!/usr/bin/env node
// QA helper: the full Impeccable live-editor cycle on a design, inside the
// workspace's own Edit frame. Opens the card's detail view, presses Edit, then
// drives Impeccable's bar with the repo's live-e2e helpers: pick, prompt, Go,
// wait for the AI's variants, step to one, Accept. The AI (a real one) must be
// polling the working area's helper and answer the generate event.
// Usage: node workspace/qa/bar-cycle.mjs --base URL --compose <id> --title "<card title>"
//          --pick ".selector" --prompt "..." [--variant 2] [--shots dir] [--wait-ms 600000]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  waitForHandshake, pickElement, typeConfigurePrompt, clickGo, waitForCycling, cycleToVariant, clickAccept, waitForBarHidden,
} from '../../tests/live-e2e/ui.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = new URL(arg('base')); const hash = base.hash; base.hash = ''; base.pathname = `/compose/${arg('compose')}`;
const shots = arg('shots');
const waitMs = Number(arg('wait-ms', 600000));
const variant = Number(arg('variant', 2));
const log = (step, extra = {}) => console.log(JSON.stringify({ step, at: new Date().toISOString(), ...extra }));

const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  await page.goto(base.href + hash, { waitUntil: 'networkidle' });
  const card = page.locator('.design-card', { hasText: arg('title') }).first();
  await card.scrollIntoViewIfNeeded();
  await card.click({ position: { x: 40, y: 120 } });
  await page.locator('.design-detail').waitFor();
  await page.getByRole('button', { name: /^Edit$/ }).click();
  await page.getByRole('button', { name: /^Editing$/ }).waitFor({ timeout: 15000 });

  // The Edit frame is the design on the content origin with ?edit=1.
  let frame = null;
  for (let i = 0; i < 100 && !frame; i++) {
    frame = page.frames().find((f) => /\/designs\/[^?]+\?edit=1/.test(f.url())) ?? null;
    if (!frame) await page.waitForTimeout(100);
  }
  if (!frame) throw new Error('no Edit frame');
  // The live-e2e helpers take a page; inside a frame, keyboard and mouse are the
  // page's (Playwright reports element boxes in main-frame coordinates).
  const target = new Proxy(frame, {
    get(f, key) {
      if (['mouse', 'keyboard'].includes(key)) return page[key];
      if (['addInitScript', 'waitForEvent', 'screenshot'].includes(key)) return page[key].bind(page);
      const value = f[key];
      return typeof value === 'function' ? value.bind(f) : value;
    },
  });
  await waitForHandshake(target);
  log('editor-ready', { frame: frame.url() });
  await shot('1-editor');

  await pickElement(target, arg('pick'));
  await typeConfigurePrompt(target, arg('prompt'));
  await shot('2-configured');
  await clickGo(target);
  log('go-sent');
  await waitForCycling(target, 3, { timeout: waitMs });
  log('cycling');
  await shot('3-cycling');
  await cycleToVariant(target, variant, 3);
  await shot(`4-variant-${variant}`);
  await clickAccept(target, { expectedVariant: variant });
  await waitForBarHidden(target, { timeout: 30000 }).catch(() => {});
  log('accepted', { variant });
  await page.waitForTimeout(2500);
  await shot('5-accepted');
  if (shots) fs.writeFileSync(path.join(shots, 'done.txt'), 'ok\n');
} catch (error) {
  log('failed', { error: error.message.slice(0, 600) });
  process.exitCode = 1;
} finally {
  await browser.close();
}

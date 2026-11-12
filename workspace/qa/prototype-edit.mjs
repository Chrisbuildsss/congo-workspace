#!/usr/bin/env node
// QA helper: Edit on a whole-app prototype, with a real AI polling. Opens the
// prototype from Prototypes, presses Edit, waits for the AI to start the
// prototype's source on its dev server with Impeccable's editor, then runs the
// editor cycle in the workspace frame: pick, prompt, Go, variants, Accept.
// Finally presses Editing to stop, which asks the AI to rebuild the prototype.
// Usage: node workspace/qa/prototype-edit.mjs --base URL --title "<card title>" --pick SEL --prompt "..."
//          [--variant 2] [--shots dir] [--wait-ms 900000]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import {
  waitForHandshake, pickElement, typeConfigurePrompt, clickGo, waitForCycling, cycleToVariant, clickAccept, waitForBarHidden,
} from '../../tests/live-e2e/ui.mjs';

const args = process.argv.slice(2);
const arg = (n, d) => { const i = args.indexOf(`--${n}`); return i >= 0 ? args[i + 1] : d; };
const base = new URL(arg('base'));
const hash = base.hash;
const token = /t=([^&]+)/.exec(hash)?.[1];
const origin = `${base.protocol}//${base.host}`;
const title = arg('title');
const shots = arg('shots');
const waitMs = Number(arg('wait-ms', 900000));
const variant = Number(arg('variant', 2));
const started = Date.now();
const log = (step, extra = {}) => console.log(JSON.stringify({ step, seconds: Math.round((Date.now() - started) / 1000), ...extra }));
const state = () => fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
if (shots) fs.mkdirSync(shots, { recursive: true });

const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, `${name}.png`) }); };
  await page.goto(`${origin}/prototypes${hash}`, { waitUntil: 'domcontentloaded' });
  const card = page.locator('.design-card', { has: page.locator('.card-title-pill b', { hasText: new RegExp(`^${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`) }) }).first();
  await card.waitFor({ timeout: 30000 });
  await card.click({ position: { x: 40, y: 120 } });
  await page.locator('.design-detail').waitFor();
  const id = Object.values((await state()).designs).find((d) => d.title === title)?.id;
  await page.getByRole('button', { name: /^Edit$/ }).click();
  await page.getByRole('button', { name: /^Editing$/ }).waitFor({ timeout: 15000 });
  log('edit-pressed', { id });
  await shot('1-starting');

  // The AI starts the source's dev server with the editor and replies its address.
  let editUrl = null;
  for (const end = Date.now() + waitMs; !editUrl && Date.now() < end;) {
    editUrl = (await state()).designs[id]?.editUrl ?? null;
    if (!editUrl) await page.waitForTimeout(2000);
  }
  if (!editUrl) throw new Error('the AI did not report an edit address');
  log('editor-address', { editUrl });
  let frame = null;
  for (let i = 0; i < 200 && !frame; i++) {
    frame = page.frames().find((f) => f.url().startsWith(editUrl.replace(/\/$/, ''))) ?? null;
    if (!frame) await page.waitForTimeout(150);
  }
  if (!frame) throw new Error('no edit frame');
  const target = new Proxy(frame, {
    get(f, key) {
      if (['mouse', 'keyboard'].includes(key)) return page[key];
      if (['addInitScript', 'waitForEvent', 'screenshot'].includes(key)) return page[key].bind(page);
      const value = f[key];
      return typeof value === 'function' ? value.bind(f) : value;
    },
  });
  await waitForHandshake(target, { timeout: 60000 });
  log('editor-ready', { frame: frame.url() });
  await shot('2-editor');

  // --stop-only: skip the edit itself and check that stopping rebuilds.
  if (!args.includes('--stop-only')) {
  await pickElement(target, arg('pick'));
  await typeConfigurePrompt(target, arg('prompt'));
  await clickGo(target);
  log('go-sent');
  await waitForCycling(target, 3, { timeout: waitMs });
  log('cycling');
  await shot('3-cycling');
  await cycleToVariant(target, variant, 3);
  await clickAccept(target, { expectedVariant: variant });
  await waitForBarHidden(target, { timeout: 30000 }).catch(() => {});
  log('accepted', { variant });
  await page.waitForTimeout(2500);
  await shot('4-accepted');
  }

  // Done editing: the workspace asks the AI to rebuild the prototype.
  const earlier = new Set((await state()).requests.map((x) => x.id));
  await page.getByRole('button', { name: /^Editing$/ }).click();
  const rebuild = await (async () => {
    for (const end = Date.now() + 30000; Date.now() < end;) {
      const r = (await state()).requests.find((x) => x.type === 'rebuild' && x.designId === id && !earlier.has(x.id));
      if (r) return r;
      await page.waitForTimeout(1000);
    }
    return null;
  })();
  log('stopped', { rebuild: rebuild?.id ?? null });
  if (rebuild) {
    for (const end = Date.now() + waitMs; Date.now() < end;) {
      const r = (await state()).requests.find((x) => x.id === rebuild.id);
      if (r?.status !== 'sent') { log('rebuilt', { status: r?.status, message: r?.message }); break; }
      await page.waitForTimeout(3000);
    }
  }
} catch (error) {
  log('failed', { error: error.message.slice(0, 600) });
  process.exitCode = 1;
} finally {
  await browser.close();
}

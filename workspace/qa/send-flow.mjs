#!/usr/bin/env node
// Timed end-to-end flow through the real workspace UI, for a connected AI:
// select Library items, add notes, Send, wait for the prototype in Prototypes,
// then (with --use) press Use this, wait for the AI, and Start the app in My app.
// Usage:
//   node workspace/qa/send-flow.mjs --base URL --app "App name" [--screen "app-slug:Screen title"]...
//     [--note "..."] [--item-note "..."]... [--use] [--wait-min 60] [--out DIR]
// Prints a JSON report with the timings. Never touches the user's project by
// itself: only the AI's work after Use this does.
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const argv = process.argv.slice(2);
const one = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : fallback;
};
const many = (name) => argv.flatMap((a, i) => (a === `--${name}` && argv[i + 1] ? [argv[i + 1]] : []));
const base = one('base');
const apps = many('app');
const screens = many('screen');
const note = one('note', '');
const itemNotes = many('item-note');
const use = argv.includes('--use');
const dest = one('dest', 'A new app');
const waitMs = Number(one('wait-min', '60')) * 60_000;
const out = path.resolve(one('out', 'workspace/qa/out'));
if (!base) {
  console.error('Usage: node workspace/qa/send-flow.mjs --base URL --app NAME [--screen slug:Title] [--note TEXT] [--use]');
  process.exit(2);
}
fs.mkdirSync(out, { recursive: true });

const url = new URL(base);
const token = /t=([^&]+)/.exec(url.hash)?.[1];
const origin = `${url.protocol}//${url.host}`;
const at = (route) => `${origin}${route}${url.hash}`;
const state = () => fetch(`${origin}/api/state`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const status = () => fetch(`${origin}/api/status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
const seconds = (from) => Math.round((Date.now() - from) / 100) / 10;
const log = (line) => console.error(`[${new Date().toISOString().slice(11, 19)}] ${line}`);

async function until(check, label, ms = waitMs, every = 2000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check().catch(() => null);
    if (value) return value;
    await new Promise((r) => setTimeout(r, every));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const report = { selected: [], timings: {}, send: null, prototype: null, use: null, app: null, errors: [] };
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => report.errors.push(String(e)));
try {
  const ai = await until(async () => (await status()).ai.connected && (await status()).ai, 'a connected AI', 10 * 60_000);
  report.ai = { connected: ai.connected, listening: ai.listening };

  // Select whole apps from the Library, then screens inside their apps.
  await page.goto(at('/library'), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.community-grid .design-card', { timeout: 30000 });
  if ((await page.locator('.request-tray-head button').count()) > 0) await page.locator('.request-tray-head button').click();
  for (const name of apps) {
    const card = page.locator('.community-grid .design-card', { has: page.locator('.card-title-pill b', { hasText: new RegExp(`^${name}$`) }) }).first();
    await card.hover();
    await card.locator('.selection-bubble').click();
    report.selected.push(`app:${name}`);
  }
  for (const entry of screens) {
    const [slug, title] = entry.split(/:(.*)/s);
    await page.goto(at(`/library/apps/${slug}`), { waitUntil: 'domcontentloaded' });
    await page.fill('.library-search input', title).catch(() => {});
    const card = page.locator('.community-grid .design-card', { has: page.locator('.card-title-pill b', { hasText: title }) }).first();
    await card.waitFor({ timeout: 30000 });
    await card.hover();
    await card.locator('.selection-bubble').click();
    report.selected.push(`screen:${slug}:${title}`);
  }
  await page.goto(at('/library'), { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('.request-tray-item', { timeout: 15000 });
  const notes = page.locator('.request-tray-note');
  for (let i = 0; i < Math.min(await notes.count(), itemNotes.length); i++) await notes.nth(i).fill(itemNotes[i]);
  await page.locator('.global-composer .composer-select').first().click();
  await page.locator('.global-composer .composer-option', { hasText: dest }).first().click();
  if (note) await page.locator('.global-composer .composer-input').fill(note);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'send-1-tray.png') });

  // Send, then wait for the prototype.
  const before = new Set((await state()).requests.map((r) => r.id));
  const sentAt = Date.now();
  await page.locator('.global-composer .composer-submit').click();
  const send = await until(async () => (await state()).requests.find((r) => r.type === 'send' && !before.has(r.id)), 'the send request', 30000, 500);
  report.send = { id: send.id };
  log(`sent ${send.id}`);
  const done = await until(async () => {
    const s = await state();
    const r = s.requests.find((x) => x.id === send.id);
    return r && r.status !== 'sent' && { r, s };
  }, 'the AI to finish the prototype');
  report.timings.sendToReplySeconds = seconds(sentAt);
  report.send = { id: send.id, status: done.r.status, message: done.r.message };
  const card = await until(async () => {
    const s = await state();
    return Object.values(s.designs).find((d) => d.local && d.id.startsWith(`${send.id}-`));
  }, 'the prototype card', 60000);
  report.timings.sendToPrototypeSeconds = seconds(sentAt);
  report.prototype = { id: card.id, title: card.title, root: Boolean(card.root), sourceDir: card.sourceDir ?? null, src: card.src };
  log(`prototype ${card.id}: ${card.title}`);

  // Open it full size and check it runs.
  await page.goto(at('/prototypes'), { waitUntil: 'domcontentloaded' });
  const protoCard = page.locator('.design-card', { has: page.locator('.card-title-pill b', { hasText: card.title }) }).first();
  await protoCard.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, 'send-2-prototypes.png') });
  await protoCard.click({ position: { x: 40, y: 120 } });
  await page.waitForSelector('.design-detail iframe', { timeout: 15000 });
  await page.waitForTimeout(3000);
  const frame = await (await page.$('.design-detail iframe')).contentFrame();
  report.prototype.renders = await frame.evaluate(() => document.body.innerText.trim().length > 40).catch(() => false);
  report.prototype.links = await frame.evaluate(() => document.querySelectorAll('a[href], button').length).catch(() => 0);
  await page.screenshot({ path: path.join(out, 'send-3-prototype-open.png') });

  if (use) {
    const beforeUse = new Set((await state()).requests.map((r) => r.id));
    const appsBefore = new Set((await state()).apps.map((a) => a.id));
    const usedAt = Date.now();
    await page.locator('.design-detail .detail-export', { hasText: 'Use this' }).click();
    const build = await until(async () => (await state()).requests.find((r) => r.type === 'build' && !beforeUse.has(r.id)), 'the Use this request', 30000, 500);
    log(`use this ${build.id}`);
    const built = await until(async () => {
      const r = (await state()).requests.find((x) => x.id === build.id);
      return r && r.status !== 'sent' && r;
    }, 'the AI to apply the prototype');
    report.timings.useToReplySeconds = seconds(usedAt);
    report.use = { id: build.id, status: built.status, message: built.message };
    const s = await state();
    const app = s.apps.find((a) => !appsBefore.has(a.id)) ?? s.apps.find((a) => a.id === s.activeAppId);
    report.app = app ? { name: app.name, path: app.path } : null;
    if (app) {
      await page.goto(at('/live'), { waitUntil: 'domcontentloaded' });
      await page.waitForTimeout(2500);
      if (await page.locator('.live-state.is-running').count()) {
        // Already running (an existing app): its dev server picks the change up.
        report.timings.useToRunningSeconds = seconds(usedAt);
        await page.waitForTimeout(4000);
        await page.screenshot({ path: path.join(out, 'send-4-my-app.png') });
        throw Object.assign(new Error('already running'), { done: true });
      }
      const start = page.locator('.dialog-primary', { hasText: 'Start' });
      await start.waitFor({ timeout: 30000 });
      const startAt = Date.now();
      await start.click();
      await page.waitForSelector('.live-state.is-running', { timeout: 5 * 60_000 });
      report.timings.startToRunningSeconds = seconds(startAt);
      report.timings.useToRunningSeconds = seconds(usedAt);
      await page.waitForTimeout(4000);
      await page.screenshot({ path: path.join(out, 'send-4-my-app.png') });
    }
  }
} catch (error) {
  if (!error.done) report.errors.push(error.message);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

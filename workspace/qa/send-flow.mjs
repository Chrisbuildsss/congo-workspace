#!/usr/bin/env node
// Timed end-to-end flow through the real workspace UI, for a connected AI:
// select Explore items, add notes, Send, time the placeholder card and the
// main screen, then (with --expand) Expand and (with --use) Pull into a project.
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

const report = { selected: [], timings: {}, send: null, prototype: null, expand: null, use: null, errors: [] };
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on('pageerror', (e) => report.errors.push(String(e)));
try {
  const ai = await until(async () => (await status()).ai.connected && (await status()).ai, 'a connected AI', 10 * 60_000);
  report.ai = { connected: ai.connected, listening: ai.listening };

  // Select whole apps from the Library, then screens inside their apps.
  await page.goto(at('/explore'), { waitUntil: 'domcontentloaded' });
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
    await page.goto(at(`/explore/apps/${slug}`), { waitUntil: 'domcontentloaded' });
    await page.fill('.library-search input', title).catch(() => {});
    const card = page.locator('.community-grid .design-card', { has: page.locator('.card-title-pill b', { hasText: title }) }).first();
    await card.waitFor({ timeout: 30000 });
    await card.hover();
    await card.locator('.selection-bubble').click();
    report.selected.push(`screen:${slug}:${title}`);
  }
  await page.goto(at('/explore'), { waitUntil: 'domcontentloaded' });
  if (apps.length + screens.length) await page.waitForSelector('.request-tray-item', { timeout: 15000 });
  const notes = page.locator('.request-tray-note');
  for (let i = 0; i < Math.min(await notes.count(), itemNotes.length); i++) await notes.nth(i).fill(itemNotes[i]);
  await page.locator('.global-composer .composer-select').first().click();
  await page.locator('.global-composer .composer-option', { hasText: dest }).first().click();
  if (note) await page.locator('.global-composer .composer-input').fill(note);
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(out, 'send-1-tray.png') });

  // Send. The card should exist at once (a skeleton), then gain its preview
  // when the main screen is adapted.
  const before = new Set((await state()).requests.map((r) => r.id));
  const sentAt = Date.now();
  await page.locator('.global-composer .composer-submit').click();
  const send = await until(async () => (await state()).requests.find((r) => r.type === 'send' && !before.has(r.id)), 'the send request', 30000, 250);
  await until(async () => (await state()).designs[`${send.id}-1`], 'the placeholder card', 30000, 250);
  report.timings.sendToCardSeconds = seconds(sentAt);
  await page.waitForSelector('.generating-card', { timeout: 15000 }).catch(() => report.errors.push('no skeleton card shown'));
  await page.screenshot({ path: path.join(out, 'send-2-skeleton.png') });
  report.send = { id: send.id };
  log(`sent ${send.id}`);
  const card = await until(async () => {
    const d = (await state()).designs[`${send.id}-1`];
    return d?.src && d;
  }, 'the main screen');
  report.timings.sendToMainScreenSeconds = seconds(sentAt);
  const done = await until(async () => {
    const r = (await state()).requests.find((x) => x.id === send.id);
    return r && r.status !== 'sent' && r;
  }, 'the reply', 10 * 60_000);
  report.timings.sendToReplySeconds = seconds(sentAt);
  report.send = { id: send.id, status: done.status, message: done.message };
  const fresh = (await state()).designs[card.id];
  report.prototype = { id: fresh.id, title: fresh.title, status: fresh.status, file: fresh.file, dir: fresh.dir, brief: Boolean(fresh.brief), src: fresh.src };
  log(`main screen ${fresh.id}: ${fresh.title} [${fresh.status}]`);

  // Open it: a desktop preview filling the workspace, clickable.
  await page.goto(at('/prototypes'), { waitUntil: 'domcontentloaded' });
  const protoCard = page.locator('.design-card', { has: page.locator('.card-title-pill b', { hasText: fresh.title }) }).first();
  await protoCard.waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(out, 'send-3-prototypes.png') });
  await protoCard.click({ position: { x: 40, y: 120 } });
  await page.waitForSelector('.design-detail iframe', { timeout: 15000 });
  await page.waitForTimeout(3000);
  const box = await page.locator('.design-detail iframe').boundingBox();
  const frame = await (await page.$('.design-detail iframe')).contentFrame();
  report.prototype.frameWidth = Math.round(box.width);
  report.prototype.renders = await frame.evaluate(() => document.body.innerText.trim().length > 40).catch(() => false);
  report.prototype.controls = await frame.evaluate(() => document.querySelectorAll('a[href], button').length).catch(() => 0);
  await page.screenshot({ path: path.join(out, 'send-4-main-screen-open.png') });

  if (argv.includes('--expand') && fresh.status === 'main') {
    const expandAt = Date.now();
    await page.locator('.design-detail .detail-export', { hasText: 'Expand' }).click();
    const expand = await until(async () => (await state()).requests.find((r) => r.type === 'expand' && r.designId === fresh.id), 'the expand request', 30000, 250);
    log(`expand ${expand.id}`);
    const expanded = await until(async () => {
      const r = (await state()).requests.find((x) => x.id === expand.id);
      return r && r.status !== 'sent' && r;
    }, 'Expand to finish');
    report.timings.expandSeconds = seconds(expandAt);
    report.expand = { id: expand.id, status: expanded.status, message: expanded.message, prototypeStatus: (await state()).designs[fresh.id]?.status };
    await page.waitForTimeout(4000);
    await page.screenshot({ path: path.join(out, 'send-5-expanded.png') });
  }

  if (use) {
    const beforePull = new Set((await state()).requests.map((r) => r.id));
    const pullAt = Date.now();
    await page.locator('.design-detail .detail-export', { hasText: 'Pull into a project' }).click();
    await page.waitForSelector('.pull-card', { timeout: 5000 });
    await page.screenshot({ path: path.join(out, 'send-6-pull-dialog.png') });
    await page.locator('.pull-card .pull-list button', { hasText: dest === 'A new app' ? 'A new project' : dest }).first().click();
    const build = await until(async () => (await state()).requests.find((r) => r.type === 'build' && !beforePull.has(r.id)), 'the pull request', 30000, 250);
    log(`pull ${build.id}`);
    const built = await until(async () => {
      const r = (await state()).requests.find((x) => x.id === build.id);
      return r && r.status !== 'sent' && r;
    }, 'the AI to pull it into a project');
    report.timings.pullToReplySeconds = seconds(pullAt);
    report.use = { id: build.id, status: built.status, message: built.message };
  }} catch (error) {
  if (!error.done) report.errors.push(error.message);
} finally {
  await browser.close();
}
console.log(JSON.stringify(report, null, 2));

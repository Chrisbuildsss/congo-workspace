#!/usr/bin/env node
// QA: the Projects flow through the real UI.
// Usage: node workspace/qa/projects-flow.mjs --base URL --compose <id> --library-route /library/apps/<slug> --library-card N [--out DIR]
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const base = new URL(arg('base'));
const hash = base.hash;
base.hash = '';
const out = arg('out');
if (out) fs.mkdirSync(out, { recursive: true });
const go = async (page, route) => {
  const url = new URL(base);
  url.pathname = route;
  await page.goto(url.href + hash, { waitUntil: 'networkidle' });
};
const log = [];
const step = (name, value) => log.push({ step: name, ...value });

async function saveCard(page, n, target) {
  const card = page.locator('.design-card').nth(n - 1);
  await card.waitFor({ timeout: 15000 });
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await card.hover();
  await page.waitForTimeout(400);
  await card.locator('.card-top-actions button[aria-label^="Save"]').click();
  const dialog = page.locator('.save-popover');
  await dialog.waitFor();
  if (target.newName) {
    await dialog.getByLabel('New project name').fill(target.newName);
    await dialog.getByLabel('New project name').press('Enter');
  } else {
    await dialog.locator('.save-row', { hasText: target.existing }).click();
  }
  return page.locator('.toast').textContent({ timeout: 5000 });
}

const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await go(page, `/compose/${arg('compose')}`);
  step('save card 1 to a new project', { toast: await saveCard(page, 1, { newName: 'Ghosted contacts' }) });
  await page.waitForTimeout(600);
  step('save card 2 to the same project', { toast: await saveCard(page, 2, { existing: 'Ghosted contacts' }) });

  await go(page, arg('library-route'));
  step('save a library screen to a project for the second app', {
    toast: await saveCard(page, Number(arg('library-card', '1')), { newName: 'Harbor ideas' }),
  });

  await go(page, '/projects');
  await page.locator('.project-card').first().waitFor();
  await page.waitForTimeout(2500);
  step('projects list', { cards: await page.locator('.project-card:not(.project-card-empty) > span').allTextContents() });
  if (out) await page.screenshot({ path: path.join(out, 'projects-list.png') });

  await page.locator('.project-card', { hasText: 'Ghosted contacts' }).click();
  await page.locator('.project-name').click();
  await page.getByLabel('Project name').fill('Ghosted · People');
  await page.getByLabel('Project name').press('Enter');
  await page.waitForTimeout(800);
  step('renamed', { name: await page.locator('.project-name').textContent(), designs: await page.locator('.design-card').count() });
  if (out) await page.screenshot({ path: path.join(out, 'project-detail.png') });

  await go(page, '/projects');
  await page.locator('.project-card', { hasText: 'Harbor ideas' }).click();
  await page.getByLabel('Project menu').click();
  await page.locator('.chat-options-menu button', { hasText: 'Delete project' }).click();
  await page.locator('.confirm-card button.danger').click();
  await page.waitForTimeout(800);
  step('deleted', { url: new URL(page.url()).pathname, toast: await page.locator('.toast').textContent().catch(() => null) });
} finally {
  await browser.close();
}
console.log(JSON.stringify(log, null, 2));

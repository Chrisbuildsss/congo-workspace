#!/usr/bin/env node
// Screenshots of Impeccable's live editor chrome on a page: the bar at rest,
// an element picked (outline, tag and the configure bar with Go), at 390 and
// 1440 CSS px, on a light and a dark page. No AI is needed for these states.
// The folder must already have `impeccable live` running in it (its page
// carries the injected script).
// Usage: node workspace/qa/editor-bar-shots.mjs --dir FOLDER --out DIR [--pick "#call"] [--name before]
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { chromium } from 'playwright';
import { pickElement, typeConfigurePrompt, waitForHandshake } from '../../tests/live-e2e/ui.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const dir = path.resolve(arg('dir'));
const out = path.resolve(arg('out', 'workspace/qa/out'));
const pick = arg('pick', '#call');
const name = arg('name', 'editor');
fs.mkdirSync(out, { recursive: true });

// The page, served over http so the editor's script can reach its helper.
const server = http.createServer((req, res) => {
  const file = path.join(dir, 'index.html');
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const url = `http://127.0.0.1:${server.address().port}/`;

const report = { shots: [], errors: [] };
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  for (const scheme of ['light', 'dark']) {
    for (const size of [{ name: '390', width: 390, height: 844 }, { name: '1440', width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport: { width: size.width, height: size.height }, colorScheme: scheme });
      const page = await context.newPage();
      page.on('pageerror', (e) => report.errors.push(`${size.name}/${scheme}: ${e}`));
      const shot = async (state) => {
        const file = path.join(out, `${name}-${state}-${size.name}-${scheme}.png`);
        await page.screenshot({ path: file });
        report.shots.push(path.relative(process.cwd(), file));
      };
      try {
        await page.goto(url, { waitUntil: 'domcontentloaded' });
        await waitForHandshake(page, { timeout: 20000 });
        await page.waitForTimeout(800);
        await shot('bar');
        await pickElement(page, pick);
        await typeConfigurePrompt(page, 'Make this a little calmer');
        await page.waitForTimeout(500);
        await shot('picked');
      } catch (error) {
        report.errors.push(`${size.name}/${scheme}: ${error.message.split('\n')[0]}`);
      }
      await context.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}
console.log(JSON.stringify(report, null, 2));

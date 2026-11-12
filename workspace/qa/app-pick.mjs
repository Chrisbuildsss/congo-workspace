#!/usr/bin/env node
// Probe Impeccable's live editor on a running app (a prototype's dev server or
// My app): wait for its handshake, pick an element, type a prompt and press Go,
// then report whether the helper queued the `generate` event for the AI.
// Usage: node workspace/qa/app-pick.mjs --url http://127.0.0.1:4911/ --helper <port> --token <helper token>
//          [--pick "main h1"] [--prompt "make this bolder"] [--shot file.png]
import { chromium } from 'playwright';
import { clickGo, pickElement, typeConfigurePrompt, waitForHandshake } from '../../tests/live-e2e/ui.mjs';

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const url = arg('url');
const helper = arg('helper');
const token = arg('token');
const pick = arg('pick', 'h1, h2, [role="heading"]');
const prompt = arg('prompt', 'Make this heading bolder');
const shot = arg('shot', '');
if (!url || !helper || !token) {
  console.error('Usage: node workspace/qa/app-pick.mjs --url URL --helper PORT --token TOKEN [--pick SEL] [--prompt TEXT] [--shot FILE]');
  process.exit(2);
}

const result = { url, handshake: false, picked: null, queued: false, events: [], errors: [] };
const browser = await chromium.launch(process.env.CONGO_QA_CHANNEL ? { channel: process.env.CONGO_QA_CHANNEL } : {});
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('pageerror', (e) => result.errors.push(String(e)));
  await page.goto(url, { waitUntil: 'networkidle' });
  try {
    await waitForHandshake(page, { timeout: 20000 });
    result.handshake = true;
  } catch (error) {
    result.errors.push(`handshake: ${error.message}`);
  }
  if (result.handshake) {
    const selector = await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (!el) return null;
      el.setAttribute('data-qa-pick', '1');
      return { tag: el.tagName.toLowerCase(), text: (el.textContent || '').trim().slice(0, 80) };
    }, pick);
    result.picked = selector;
    if (selector) {
      await pickElement(page, '[data-qa-pick="1"]');
      await typeConfigurePrompt(page, prompt);
      await clickGo(page);
      const until = Date.now() + 8000;
      while (Date.now() < until) {
        const status = await fetch(`http://127.0.0.1:${helper}/status?token=${encodeURIComponent(token)}`).then((r) => r.json()).catch(() => null);
        const pending = status?.pendingEvents ?? [];
        if (pending.length) {
          result.queued = true;
          result.events = pending.map((e) => ({ type: e.type, id: e.id, element: e.element?.tagName ?? e.element?.tag ?? null }));
          break;
        }
        await new Promise((r) => setTimeout(r, 250));
      }
    }
    if (shot) await page.screenshot({ path: shot });
  }
} finally {
  await browser.close();
}
console.log(JSON.stringify(result, null, 2));

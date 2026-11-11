// The workspace's read-only view of Congo's public catalog, against a fake
// registry: no network, no source, no credentials.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createCatalog, registryOrigin } from '../skills/congo/scripts/workspace/server/catalog.mjs';

const ORIGIN = 'https://buildwithcongo.com';
const calls = [];
const fixtures = {
  '/api/catalog': {
    categories: [{ id: 'x', slug: 'crm', title: 'CRM' }],
    listings: [
      {
        kind: 'app', id: 'ghosted-real-estate-crm', slug: 'ghosted-real-estate-crm', name: 'Ghosted', summary: 'A CRM.',
        category: 'crm', access: 'subscription', pageCount: 40,
        logo: { src: '/content/brands/ghosted.svg' },
        screenshot: { src: '/api/catalog/media/r1/0' },
        screenshots: [{ src: '/api/catalog/media/r1/0' }, { src: 'javascript:alert(1)' }],
        preview: { url: 'https://congo-previews.fly.dev/releases/r1/a/', status: 'available' },
        inspiredBy: { name: 'Follow Up Boss' },
        release: { id: 'r1' },
        sourcePackage: { archiveSha256: 'secret-shape-not-needed' },
      },
      { kind: 'landing_page', id: 'nope', slug: 'nope', name: 'Not an app' },
    ],
  },
  '/api/screen-categories': { categories: [{ id: 'settings-preferences', title: 'Settings', group: 'Settings' }] },
};

async function fakeFetch(url) {
  calls.push(url);
  const u = new URL(url);
  if (u.origin !== ORIGIN) throw new Error('unexpected origin ' + u.origin);
  if (u.pathname === '/api/screens') {
    return Response.json({
      items: [{
        id: 's1', title: 'Settings', route: '/settings', version: 'v1',
        app: { id: 'ghosted-real-estate-crm', slug: 'ghosted-real-estate-crm', name: 'Ghosted' },
        screenCategories: ['settings-preferences'],
        screenshot: { src: '/api/catalog/screenshots/a.png', width: 390, height: 844 },
        preview: 'https://congo-previews.fly.dev/resources/x/index.html#resource=s1',
        url: '/websites/ghosted-real-estate-crm?gallery=screens&item=s1',
        source: { kind: 'screen', id: 's1-page', version: 'v1' },
      }],
      total: 1, offset: Number(u.searchParams.get('offset')), limit: Number(u.searchParams.get('limit')),
    });
  }
  const body = fixtures[u.pathname];
  return body ? Response.json(body) : new Response('{}', { status: 404 });
}

test('apps come back with absolute https media and only safe links', async () => {
  const catalog = createCatalog({ fetchImpl: fakeFetch, env: {} });
  const { apps, categories } = await catalog.apps();
  assert.equal(apps.length, 1, 'only app listings');
  const [app] = apps;
  assert.equal(app.logo, `${ORIGIN}/content/brands/ghosted.svg`);
  assert.equal(app.screenshot, `${ORIGIN}/api/catalog/media/r1/0`);
  assert.deepEqual(app.screenshots, [`${ORIGIN}/api/catalog/media/r1/0`], 'non-https links are dropped');
  assert.equal(app.preview, 'https://congo-previews.fly.dev/releases/r1/a/');
  assert.equal(app.inspiredBy, 'Follow Up Boss');
  assert.equal('sourcePackage' in app, false, 'no package details reach the page');
  assert.deepEqual(categories, [{ id: 'crm', title: 'CRM' }]);
});

test('screen queries are bounded and mapped; tall screenshots are phone screens', async () => {
  const catalog = createCatalog({ fetchImpl: fakeFetch, env: {} });
  const page = await catalog.screens({ q: 'settings', app: 'ghosted-real-estate-crm', offset: '-5', limit: '500' });
  const sent = new URL(calls.at(-1));
  assert.equal(sent.searchParams.get('offset'), '0');
  assert.equal(sent.searchParams.get('limit'), '60');
  assert.equal(sent.searchParams.get('app'), 'ghosted-real-estate-crm');
  const [screen] = page.items;
  assert.equal(screen.format, 'mobile');
  assert.equal(screen.screenshot, `${ORIGIN}/api/catalog/screenshots/a.png`);
  assert.deepEqual(screen.source, { kind: 'screen', id: 's1-page', version: 'v1' });
});

test('repeat requests are served from cache, and the last good copy survives going offline', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'congo-catalog-'));
  let online = true;
  const flaky = (url) => (online ? fakeFetch(url) : Promise.reject(new Error('offline')));
  const first = createCatalog({ fetchImpl: flaky, env: {}, cacheDir: dir });
  const before = calls.length;
  await first.apps();
  await first.apps();
  assert.equal(calls.length, before + 1, 'second call is cached');
  online = false;
  const second = createCatalog({ fetchImpl: flaky, env: {}, cacheDir: dir });
  assert.equal((await second.apps()).apps[0].name, 'Ghosted');
  await assert.rejects(second.screens({}), /Could not reach the Congo library/);
  fs.rmSync(dir, { recursive: true, force: true });
});

test('the registry must be https (or loopback for local testing)', () => {
  assert.equal(registryOrigin({}), ORIGIN);
  assert.equal(registryOrigin({ CONGO_REGISTRY: 'http://127.0.0.1:4100' }), 'http://127.0.0.1:4100');
  assert.throws(() => registryOrigin({ CONGO_REGISTRY: 'http://evil.example' }), /https/);
});

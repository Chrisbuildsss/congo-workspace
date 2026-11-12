// Workspace actions -> Impeccable steer events -> designs and replies, against a
// fake live helper that speaks the same HTTP contract (/status, POST /events,
// SSE GET /events). The real engine round trip is verified by hand; see
// docs/CONGO-WORKSPACE-V1-PLAN.md.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { startWorkspaceServer } from '../skills/congo/scripts/workspace/server/server.mjs';
import { describeAction, isBundleOnly, steerMessage, buildRequest, normalizeTray } from '../skills/congo/scripts/workspace/server/requests.mjs';
import { savedItems } from '../skills/congo/scripts/workspace/server/congo-cli.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'congo-workspace-requests-'));
const root = path.join(tmp, 'home');
const area = path.join(root, 'area');
const uiDir = path.join(tmp, 'ui');
fs.mkdirSync(uiDir, { recursive: true });
fs.writeFileSync(path.join(uiDir, 'index.html'), '<!doctype html><div id="root"></div>');

// --- fake Impeccable live helper -------------------------------------------
const helperToken = 'helper-token';
const steers = [];
const streams = new Set();
const helper = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  if (url.searchParams.get('token') !== helperToken && req.method === 'GET') {
    res.writeHead(401).end();
    return;
  }
  if (req.method === 'GET' && url.pathname === '/status') {
    res.writeHead(200, { 'Content-Type': 'application/json' }).end(JSON.stringify({ status: 'ok', agentPolling: true }));
  } else if (req.method === 'GET' && url.pathname === '/events') {
    res.writeHead(200, { 'Content-Type': 'text/event-stream' });
    res.write(`data: ${JSON.stringify({ type: 'connected', agentPolling: true })}\n\n`);
    streams.add(res);
    req.on('close', () => streams.delete(res));
  } else if (req.method === 'POST' && url.pathname === '/events') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const event = JSON.parse(body);
      if (event.token !== helperToken) {
        res.writeHead(401).end();
        return;
      }
      steers.push(event);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}');
    });
  } else {
    res.writeHead(404).end();
  }
});
await new Promise((resolve) => helper.listen(0, '127.0.0.1', resolve));
const broadcast = (event) => {
  for (const res of streams) res.write(`data: ${JSON.stringify(event)}\n\n`);
};
fs.mkdirSync(path.join(area, '.impeccable', 'live'), { recursive: true });
fs.writeFileSync(path.join(area, '.impeccable', 'live', 'server.json'), JSON.stringify({ pid: process.pid, port: helper.address().port, token: helperToken }));

// The person's Congo CLI, faked: `congo saved --json --all` lists one Saved app.
const congoCalls = [];
const fakeCongo = async (args) => {
  congoCalls.push(args);
  return { code: 0, stdout: JSON.stringify({ items: [{ id: 'crm-app', slug: 'crm', name: 'CRM', kind: 'app', url: 'https://example.test/websites/crm', savedAt: null }], total: 1, offset: 0, limit: 100 }), stderr: '' };
};
const server = await startWorkspaceServer({ root, uiDir, port: 4975, token: 't', bootHelper: false, filesDir: path.join(tmp, 'congo-files'), runCongo: fakeCongo });
const base = `http://127.0.0.1:${server.record.port}`;
const content = `http://127.0.0.1:${server.record.contentPort}`;
after(async () => {
  await server.stop();
  for (const res of streams) res.end();
  helper.closeAllConnections?.();
  await new Promise((resolve) => helper.close(resolve));
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

async function api(route, body) {
  const response = await fetch(base + route, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: 'Bearer t', ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, value: await response.json() };
}

async function until(check, label, ms = 8000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const value = await check();
    if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`timed out waiting for ${label}`);
}

const congoFiles = path.join(tmp, 'congo-files');

/** The prototype's folder in its Congo file, once a request created it. */
function prototypeDir(id) {
  if (!fs.existsSync(congoFiles)) return null;
  for (const file of fs.readdirSync(congoFiles)) {
    const dir = path.join(congoFiles, file, id);
    if (fs.existsSync(dir)) return dir;
  }
  return null;
}

// What the AI does: write the preview, then the metadata. Prototypes a request
// made live in a Congo file; anything else lands in the older working area.
function writeDesign(id, meta, html = '<!doctype html><title>d</title><main>design</main>') {
  const proto = prototypeDir(id);
  if (proto) {
    fs.mkdirSync(path.join(proto, 'preview'), { recursive: true });
    fs.writeFileSync(path.join(proto, 'preview', 'index.html'), html);
    const current = JSON.parse(fs.readFileSync(path.join(proto, 'prototype.json'), 'utf8'));
    fs.writeFileSync(path.join(proto, 'prototype.json'), JSON.stringify({ ...current, status: 'ready', ...meta }));
    return proto;
  }
  const dir = path.join(area, 'designs', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'design.json'), JSON.stringify(meta));
  return dir;
}

let composeId;
let firstRequest;

test('the AI shows as connected while its poll is parked on the helper', async () => {
  const { value } = await api('/api/status');
  assert.equal(value.ai.connected, true);
  assert.equal(value.ai.listening, true);
});

test('a request typed in Prototypes becomes one steer pointing at a request file with one output', async () => {
  composeId = (await api('/api/composes', {})).value.compose.id;
  const { status, value } = await api('/api/requests', { type: 'compose', composeId, text: 'Redesign my contacts page' });
  assert.equal(status, 200, JSON.stringify(value));
  firstRequest = value.request.id;
  const steer = await until(() => steers.find((s) => s.id === firstRequest), 'steer');
  assert.equal(steer.type, 'steer');
  assert.match(steer.id, /^[0-9a-f]{8}$/);
  assert.match(steer.message, /^Congo workspace request [0-9a-f]{8} \(compose\)\. Make one running prototype for this request: "Redesign my contacts page"/);
  assert.match(steer.message, /outside the user's project/);
  assert.match(steer.message, /live-poll --reply [0-9a-f]{8} steer_done/);
  const file = path.join(area, 'requests', `${firstRequest}.json`);
  assert.ok(steer.message.includes(file));
  const request = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(request.outputs.map((o) => o.id), [`${firstRequest}-1`], 'one prototype by default');
  const compose = value.state.composes.find((c) => c.id === composeId);
  assert.equal(compose.status, 'waiting');
  assert.equal(compose.title, 'Redesign my contacts page');
});

test('designs the AI writes become cards; steer_done closes the request with its message', async () => {
  writeDesign(`${firstRequest}-1`, { title: 'Airy rows', summary: 'More room.' });
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.designs[`${firstRequest}-1`]?.src && s;
  }, 'design card');
  assert.ok(state.composes.find((c) => c.id === composeId).designIds.includes(`${firstRequest}-1`));
  assert.equal(state.designs[`${firstRequest}-1`].status, 'ready');
  assert.ok(state.designs[`${firstRequest}-1`].dir.startsWith(congoFiles), 'kept in a Congo file, not the working area');
  assert.match(path.basename(path.dirname(state.designs[`${firstRequest}-1`].dir)), /\.congo$/);
  const design = state.designs[`${firstRequest}-1`];
  assert.equal(design.src, `/designs/${firstRequest}-1/`);
  assert.equal(design.local, true);
  broadcast({ type: 'steer_done', id: firstRequest, message: 'Three calmer takes.' });
  const done = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.requests.find((r) => r.id === firstRequest).status === 'done' && s;
  }, 'steer_done');
  const compose = done.composes.find((c) => c.id === composeId);
  assert.equal(compose.status, 'complete');
  assert.equal(compose.messages.at(-1).text, 'Three calmer takes.');
});

test('a tweak names the Impeccable command and keeps the original as the parent', async () => {
  const { value } = await api('/api/requests', { type: 'tweak', designId: `${firstRequest}-1`, action: 'bolder', composeId });
  const id = value.request.id;
  const steer = await until(() => steers.find((s) => s.id === id), 'tweak steer');
  assert.match(steer.message, /\(tweak\)\. Make a new prototype from "Airy rows": Impeccable bolder/);
  const request = JSON.parse(fs.readFileSync(path.join(area, 'requests', `${id}.json`), 'utf8'));
  assert.equal(request.action.command, 'bolder');
  assert.equal(request.design.id, `${firstRequest}-1`);
  writeDesign(`${id}-1`, { title: 'Airy rows · Bolder' });
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.designs[`${id}-1`]?.src && s;
  }, 'tweak card');
  assert.equal(path.dirname(state.designs[`${id}-1`].dir), path.dirname(state.designs[`${firstRequest}-1`].dir), 'a quick action lands in the same Congo file');
  assert.equal(state.designs[`${id}-1`].parentId, `${firstRequest}-1`);
  assert.equal(state.designs[`${id}-1`].action, 'bolder');
  assert.ok(fs.existsSync(path.join(prototypeDir(`${firstRequest}-1`), 'preview', 'index.html')), 'original kept');
  assert.equal((await api('/api/requests', { type: 'tweak', designId: `${firstRequest}-1`, action: 'more:rm -rf' })).status, 400);
});

test('a library action opens its own compose and never targets the user project', async () => {
  const { value } = await api('/api/requests', {
    type: 'library',
    action: 'use',
    item: { kind: 'screen', id: 's1', version: 'v1', app: 'hornett', title: 'Contact requests', preview: 'javascript:alert(1)' },
  });
  assert.notEqual(value.composeId, composeId);
  const request = JSON.parse(fs.readFileSync(path.join(area, 'requests', `${value.request.id}.json`), 'utf8'));
  assert.equal(request.item.preview, null, 'only https previews pass');
  assert.ok(request.workspace.sources.startsWith(path.join(area, 'sources')));
  const steer = await until(() => steers.find((s) => s.id === value.request.id), 'library steer');
  assert.match(steer.message, /Get its source through the Congo CLI or MCP/);
  assert.match(steer.message, /outside the user's project/);
});

test('more prototypes the AI adds for the same request join its group', async () => {
  writeDesign(`${firstRequest}-2`, { title: 'Dense rows' });
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.designs[`${firstRequest}-2`]?.src && s.composes.find((c) => c.id === composeId).designIds.includes(`${firstRequest}-2`) && s;
  }, 'second prototype');
  assert.equal(state.designs[`${firstRequest}-2`].requestId, firstRequest);
});

test('the request tray keeps Library items with their notes, and refuses anything else', async () => {
  const item = { kind: 'template', id: 'crm-app', version: 'r1', app: { id: 'crm-app', slug: 'crm', name: 'CRM' }, title: 'CRM', note: 'Start here', image: 'https://example.test/a.png', preview: 'javascript:alert(1)' };
  const saved = await api('/api/tray', { items: [item, item], note: 'For realtors' });
  assert.equal(saved.status, 200);
  assert.equal(saved.value.tray.items.length, 1, 'duplicates collapse');
  assert.equal(saved.value.tray.items[0].preview, null, 'only https previews pass');
  assert.equal((await api('/api/state')).value.tray.note, 'For realtors');
  assert.equal((await api('/api/tray', { items: [{ kind: 'component', id: 'x' }] })).status, 400);
  assert.equal((await api('/api/tray', { items: [{ kind: 'screen', id: '../../etc' }] })).status, 400);
  assert.throws(() => normalizeTray({ items: Array.from({ length: 25 }, (_, i) => ({ kind: 'screen', id: `s${i}` })) }), /at most 24/);
});

test('Send hands the items, versions and notes to the AI as one prototype request, outside the project', async () => {
  const items = [
    { kind: 'template', id: 'crm-app', version: 'r1', app: { id: 'crm-app', slug: 'crm', name: 'CRM' }, title: 'CRM', note: 'Start from this one' },
    { kind: 'screen', id: 'dialer-screen', version: 's7', app: { id: 'calls', slug: 'calls', name: 'Calls' }, title: 'Dialer', route: '/calls', note: 'For the calling screen' },
  ];
  const { status, value } = await api('/api/requests', { type: 'send', items, note: 'An outbound calling platform for realtors', appId: null, fromTray: true });
  assert.equal(status, 200, JSON.stringify(value));
  const id = value.request.id;
  assert.equal(value.state.tray.items.length, 0, 'Send empties the tray');
  const request = JSON.parse(fs.readFileSync(path.join(area, 'requests', `${id}.json`), 'utf8'));
  assert.equal(request.type, 'send');
  assert.equal(request.destination, 'new');
  assert.equal(request.app, null);
  assert.equal(request.request, 'An outbound calling platform for realtors');
  assert.deepEqual(request.items.map((i) => [i.kind, i.id, i.version, i.note]), [
    ['template', 'crm-app', 'r1', 'Start from this one'],
    ['screen', 'dialer-screen', 's7', 'For the calling screen'],
  ]);
  assert.deepEqual(request.outputs.map((o) => o.id), [`${id}-1`]);
  const steer = await until(() => steers.find((s) => s.id === id), 'send steer');
  assert.match(steer.message, /\(send\)\. Make one running prototype for a new app from 2 Congo Library items: app "CRM", screen "Dialer" \(Calls\)/);
  assert.match(steer.message, /Build as much as they asked for; when that is open, prefer one main screen first/);
  assert.equal(request.scope, undefined, 'how much to build is judgment, not a label from the workspace');
  assert.match(steer.message, /outside the user's project/);
  const compose = value.state.composes.find((c) => c.id === value.composeId);
  assert.equal(compose.status, 'waiting', 'it shows in Prototypes as in progress');
  assert.equal((await api('/api/requests', { type: 'send', items: [], note: '' })).status, 400);
  assert.equal((await api('/api/requests', { type: 'send', items: [{ kind: 'screen', id: 'x' }], appId: 'nope' })).status, 404);
});

test('a whole-app prototype gets its own local address, where its routes and assets work', async () => {
  const source = path.join(area, 'sources', 'proto', 'app');
  fs.mkdirSync(source, { recursive: true });
  const dir = path.join(area, 'designs', 'wholeapp-1');
  fs.mkdirSync(path.join(dir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'assets', 'app.js'), 'console.log(1)');
  fs.writeFileSync(path.join(dir, 'index.html'), '<!doctype html><script type="module" src="/assets/app.js"></script><div id="root"></div>');
  // Windows tools often write a byte-order mark; the workspace still reads it.
  fs.writeFileSync(path.join(dir, 'design.json'), String.fromCharCode(0xfeff) + JSON.stringify({ title: 'Whole app', root: true, sourceDir: source }));
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.designs['wholeapp-1']?.sourceDir && s;
  }, 'whole-app prototype');
  const design = state.designs['wholeapp-1'];
  assert.equal(design.root, true);
  assert.match(design.src, /^http:\/\/127\.0\.0\.1:\d+\/$/);
  assert.notEqual(new URL(design.src).port, String(server.record.contentPort));
  assert.match(await (await fetch(design.src)).text(), /id="root"/);
  assert.match(await (await fetch(`${design.src}people/42`)).text(), /id="root"/, 'an app route gets the app page');
  assert.equal(await (await fetch(`${design.src}assets/app.js`)).text(), 'console.log(1)');
  assert.equal((await fetch(`${design.src}assets/missing.js`)).status, 404);
  assert.equal((await fetch(`${design.src}..%2f..%2fstate.json`)).status, 404, 'nothing outside the prototype folder');

  // Edit runs the prototype's source on its dev server: the AI starts it.
  const edit = await api('/api/edit', { designId: 'wholeapp-1' });
  assert.equal(edit.value.mode, 'app');
  const steer = await until(() => steers.find((s) => s.id === edit.value.requestId), 'live-edit steer');
  assert.match(steer.message, /\(live-edit\)\. Turn on Impeccable's live editor for the prototype "Whole app"/);
  assert.ok(steer.message.includes(source));
  broadcast({ type: 'steer_done', id: edit.value.requestId, message: 'Editor on at http://127.0.0.1:5199/' });
  const editing = await until(async () => (await api('/api/state')).value.designs['wholeapp-1'].editUrl, 'edit address');
  assert.equal(editing, 'http://127.0.0.1:5199/');
  const stop = await api('/api/edit/stop', { designId: 'wholeapp-1' });
  assert.ok(stop.value.rebuild, 'stopping asks the AI to rebuild the prototype');
  const rebuild = await until(() => steers.find((s) => s.id === stop.value.rebuild), 'rebuild steer');
  assert.match(rebuild.message, /\(rebuild\)/);
  assert.equal(stop.value.state.designs['wholeapp-1'].editUrl, undefined);
});

test('rename keeps the new name through rescans; delete removes the prototype and its own source', async () => {
  assert.equal((await api('/api/designs/rename', { id: 'wholeapp-1', title: '' })).status, 400);
  const renamed = await api('/api/designs/rename', { id: 'wholeapp-1', title: 'Realtor dialer' });
  assert.equal(renamed.value.designs['wholeapp-1'].title, 'Realtor dialer');
  await new Promise((r) => setTimeout(r, 1800));
  const state = (await api('/api/state')).value;
  assert.equal(state.designs['wholeapp-1'].title, 'Realtor dialer');
  const source = state.designs['wholeapp-1'].sourceDir;
  const port = new URL(state.designs['wholeapp-1'].src).port;
  await api('/api/designs/delete', { id: 'wholeapp-1' });
  assert.equal(fs.existsSync(path.join(area, 'designs', 'wholeapp-1')), false);
  assert.equal(fs.existsSync(source), false, 'its source copy in the working area goes too');
  await assert.rejects(fetch(`http://127.0.0.1:${port}/`), 'its address closes');
});

test("the Saved filter asks the person's own Congo CLI and reads only catalog ids", async () => {
  const { value } = await api('/api/library/saved');
  assert.deepEqual([value.available, value.signedIn, value.ids, value.slugs], [true, true, ['crm-app'], ['crm']]);
  assert.deepEqual(congoCalls.at(-1), ['saved', '--json', '--all']);
  const usage = 'Congo 0.2.6\nUsage: congo COMMAND [options]\n\n  workspace  Open\n  login      Sign in\n\nExamples:\n  congo login\n';
  const old = await savedItems({ run: async () => ({ code: 1, stdout: usage, stderr: '' }) });
  assert.equal(old.available, false);
  assert.match(old.reason, /Update the Congo CLI/);
  const out = await savedItems({ run: async () => ({ code: 1, stdout: '', stderr: 'Sign in required. Run `congo login`.' }) });
  assert.deepEqual([out.available, out.signedIn], [true, false]);
  const missing = await savedItems({ run: async () => ({ code: null, stdout: '', stderr: '', error: Object.assign(new Error('spawn congo ENOENT'), { code: 'ENOENT' }) }) });
  assert.match(missing.reason, /Install the Congo CLI/);
});

test('a prototype card exists the moment it is requested, then gains its preview, brief and status', async () => {
  const thread = (await api('/api/composes', {})).value.compose.id;
  const { value } = await api('/api/requests', { type: 'compose', composeId: thread, text: 'Software ideas for dentists' });
  const id = value.request.id;
  // Right away: a placeholder in a Congo file, with no preview yet.
  const placeholder = value.state.designs[`${id}-1`];
  assert.ok(placeholder, 'the card is in the state returned by the request itself');
  assert.equal(placeholder.status, 'adapting');
  assert.equal(placeholder.src, undefined);
  const request = JSON.parse(fs.readFileSync(path.join(area, 'requests', `${id}.json`), 'utf8'));
  assert.equal(request.outputs[0].dir, placeholder.dir);
  assert.equal(request.outputs[0].preview, path.join(placeholder.dir, 'preview'));
  assert.equal(request.outputs[0].source, path.join(placeholder.dir, 'source'));
  assert.match(request.workspace.congoFile, /Software ideas for dentists\.congo$/);
  assert.equal(request.workspace.congoFiles, congoFiles);
  // The AI writes the main screen's preview and a brief.
  writeDesign(`${id}-1`, { title: 'Recall reminders', status: 'main', brief: { who: 'Small dental offices', why: 'You build for clinics', supports: 'Front desks call by hand', next: 'Ask three offices' } });
  const main = await until(async () => {
    const d = (await api('/api/state')).value.designs[`${id}-1`];
    return d?.src && d;
  }, 'main screen');
  assert.equal(main.status, 'main');
  assert.equal(main.brief.who, 'Small dental offices');
  assert.equal(main.file, 'Software ideas for dentists');
  const history = fs.readFileSync(path.join(main.dir, 'history.jsonl'), 'utf8');
  assert.match(history, /"type":"requested"/);
});

test('Expand builds out the same prototype; Pull into a project names where it goes', async () => {
  const state = (await api('/api/state')).value;
  const design = Object.values(state.designs).find((d) => d.title === 'Recall reminders');
  assert.equal((await api('/api/requests', { type: 'expand', designId: design.id })).status, 409, 'a single page has nothing to expand');
  fs.mkdirSync(path.join(design.dir, 'source'), { recursive: true });
  fs.writeFileSync(path.join(design.dir, 'source', 'package.json'), '{"name":"proto"}');
  await until(async () => (await api('/api/state')).value.designs[design.id].sourceDir, 'the prototype source');
  const expand = await api('/api/requests', { type: 'expand', designId: design.id });
  assert.equal(expand.status, 200, JSON.stringify(expand.value));
  assert.equal(expand.value.state.designs[design.id].status, 'expanding');
  assert.deepEqual(expand.value.request.outputs, [], 'the same prototype, not a new one');
  const steer = await until(() => steers.find((s) => s.id === expand.value.request.id), 'expand steer');
  assert.match(steer.message, /\(expand\)\. Expand the prototype "Recall reminders": build out the rest of the app/);
  broadcast({ type: 'steer_done', id: expand.value.request.id, message: 'Built out.' });
  await until(async () => (await api('/api/state')).value.designs[design.id].status === 'ready', 'expanded');

  const project = path.join(tmp, 'my-project');
  fs.mkdirSync(project);
  const app = (await api('/api/apps', { path: project })).value.app;
  const pull = await api('/api/requests', { type: 'build', designId: design.id, appId: app.id });
  const pullSteer = await until(() => steers.find((s) => s.id === pull.value.request.id), 'pull steer');
  assert.match(pullSteer.message, /\(build\)\. Pull into a project: apply the prototype "Recall reminders" to the user's project at /);
  assert.ok(pullSteer.message.includes(project));
  const fresh = await api('/api/requests', { type: 'build', designId: design.id, appId: null });
  const freshSteer = await until(() => steers.find((s) => s.id === fresh.value.request.id), 'new project steer');
  assert.match(freshSteer.message, /create the user's new project from the prototype "Recall reminders" with congo create/);
  assert.equal(JSON.parse(fs.readFileSync(path.join(area, 'requests', `${fresh.value.request.id}.json`), 'utf8')).app, null);
  assert.deepEqual(fs.readdirSync(project), [], 'asking changes nothing in the project');
  assert.equal((await api('/api/requests', { type: 'build', designId: design.id, appId: 'nope' })).status, 404);
});

test('a Congo file can be moved or renamed: its prototypes follow, and still run', async () => {
  const state = (await api('/api/state')).value;
  const design = Object.values(state.designs).find((d) => d.title === 'Recall reminders');
  const from = path.dirname(design.dir);
  const to = path.join(congoFiles, 'Dental ideas.congo');
  fs.renameSync(from, to);
  const moved = await until(async () => {
    const d = (await api('/api/state')).value.designs[design.id];
    return d?.file === 'Dental ideas' && d;
  }, 'the moved Congo file');
  assert.equal(moved.dir, path.join(to, design.id));
  assert.equal(moved.sourceDir, path.join(to, design.id, 'source'));
  assert.match(await (await fetch(moved.src)).text(), /design/);
  assert.doesNotMatch(fs.readFileSync(path.join(to, design.id, 'prototype.json'), 'utf8'), /congo-workspace-requests/, 'nothing in it points at where it was');
});

test('a request the AI fails leaves a plain failed card, not an endless placeholder', async () => {
  const thread = (await api('/api/composes', {})).value.compose.id;
  const { value } = await api('/api/requests', { type: 'compose', composeId: thread, text: 'Something impossible' });
  broadcast({ type: 'error', id: value.request.id, message: 'Needs Congo sign-in and a subscription' });
  const failed = await until(async () => {
    const d = (await api('/api/state')).value.designs[`${value.request.id}-1`];
    return d?.status === 'error' && d;
  }, 'failed card');
  assert.equal(failed.error, 'Needs Congo sign-in and a subscription');
});

test('an error reply is shown in the conversation', async () => {
  const { value } = await api('/api/requests', { type: 'build', designId: `${firstRequest}-1`, composeId });
  broadcast({ type: 'error', id: value.request.id, message: 'No package.json' });
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.requests.find((r) => r.id === value.request.id).status === 'error' && s;
  }, 'error');
  assert.match(state.composes.find((c) => c.id === composeId).messages.at(-1).text, /could not finish this: No package.json/);
});

test('cards get pages without Impeccable\'s injected live script; Edit gets them as injected', async () => {
  const injected = '<!doctype html><body><main>x</main><!-- impeccable-live-start -->\n<script src="http://localhost:8400/live.js?token=abc"></script>\n<!-- impeccable-live-end -->\n</body>';
  writeDesign('injected', { title: 'Injected' }, injected);
  const card = await (await fetch(`${content}/designs/injected/`)).text();
  assert.doesNotMatch(card, /live\.js/);
  const edit = await (await fetch(`${content}/designs/injected/?edit=1`)).text();
  assert.match(edit, /live\.js/);
});

test('steer messages stay under Impeccable\'s 4,000-character limit; unknown actions are refused', () => {
  const files = { area, designs: path.join(area, 'designs'), sources: path.join(area, 'sources'), requests: path.join(area, 'requests') };
  const request = buildRequest({ type: 'compose', files, reference: 'workspace.md', text: 'x'.repeat(9000) });
  assert.ok(steerMessage(request, path.join(area, 'requests', 'r.json')).length <= 4000);
  assert.equal(describeAction('more:format-disk'), null);
  assert.equal(describeAction('bolder').command, 'bolder');
  assert.equal(describeAction('subtle').command, null);
});

test('Edit tells a bundled app from a page Impeccable can pick in, and offers Make editable', async () => {
  const bundle = '<!doctype html><html><head><script type="module" src="/designs/b/assets/index.js"></script></head><body>\n  <div id="root"></div>\n<!-- impeccable-live-start --><script src="http://localhost:8400/live.js"></script><!-- impeccable-live-end -->\n</body></html>';
  assert.equal(isBundleOnly(bundle), true);
  assert.equal(isBundleOnly('<!doctype html><body><main><h1>People</h1><table><tr><td>Ana</td></tr></table></main><script src="menu.js"></script></body>'), false);
  assert.equal(isBundleOnly('<!doctype html><body><div id="root"></div></body>'), false, 'no script, nothing to wait for');
  writeDesign('bundled', { title: 'Bundled' }, bundle);
  await until(async () => (await api('/api/state')).value.designs?.bundled, 'the bundled design card');
  const { status, value } = await api('/api/edit', { designId: 'bundled' });
  assert.equal(status, 200);
  assert.equal(value.editable, false);
  assert.match(value.reason, /Make editable/);
  assert.equal(describeAction('editable').label, 'Make editable');
});

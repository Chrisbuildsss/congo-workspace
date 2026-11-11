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
import { startWorkspaceServer } from '../skills/redesign/scripts/workspace/server/server.mjs';
import { describeAction, isBundleOnly, steerMessage, buildRequest } from '../skills/redesign/scripts/workspace/server/requests.mjs';

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

const server = await startWorkspaceServer({ root, uiDir, port: 4975, token: 't', bootHelper: false });
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

function writeDesign(id, meta, html = '<!doctype html><title>d</title><main>design</main>') {
  const dir = path.join(area, 'designs', id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), html);
  fs.writeFileSync(path.join(dir, 'design.json'), JSON.stringify(meta));
}

let composeId;
let firstRequest;

test('the AI shows as connected while its poll is parked on the helper', async () => {
  const { value } = await api('/api/status');
  assert.equal(value.ai.connected, true);
  assert.equal(value.ai.listening, true);
});

test('a composer request becomes one steer pointing at a request file with three outputs', async () => {
  composeId = (await api('/api/composes', {})).value.compose.id;
  const { status, value } = await api('/api/requests', { type: 'compose', composeId, text: 'Redesign my contacts page' });
  assert.equal(status, 200, JSON.stringify(value));
  firstRequest = value.request.id;
  const steer = await until(() => steers.find((s) => s.id === firstRequest), 'steer');
  assert.equal(steer.type, 'steer');
  assert.match(steer.id, /^[0-9a-f]{8}$/);
  assert.match(steer.message, /^Congo workspace request [0-9a-f]{8} \(compose\)\. Use the live choices workflow for this request: "Redesign my contacts page"/);
  assert.match(steer.message, /live-poll --reply [0-9a-f]{8} steer_done/);
  const file = path.join(area, 'requests', `${firstRequest}.json`);
  assert.ok(steer.message.includes(file));
  const request = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.deepEqual(request.outputs.map((o) => o.id), [1, 2, 3].map((n) => `${firstRequest}-${n}`));
  const compose = value.state.composes.find((c) => c.id === composeId);
  assert.equal(compose.status, 'waiting');
  assert.equal(compose.title, 'Redesign my contacts page');
});

test('designs the AI writes become cards; steer_done closes the request with its message', async () => {
  writeDesign(`${firstRequest}-1`, { title: 'Airy rows', summary: 'More room.' });
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.composes.find((c) => c.id === composeId).designIds.includes(`${firstRequest}-1`) && s;
  }, 'design card');
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
  assert.match(steer.message, /\(tweak\)\. Make a new design from "Airy rows": Impeccable bolder/);
  const request = JSON.parse(fs.readFileSync(path.join(area, 'requests', `${id}.json`), 'utf8'));
  assert.equal(request.action.command, 'bolder');
  assert.equal(request.design.id, `${firstRequest}-1`);
  writeDesign(`${id}-1`, { title: 'Airy rows · Bolder' });
  const state = await until(async () => {
    const s = (await api('/api/state')).value;
    return s.designs[`${id}-1`] && s;
  }, 'tweak card');
  assert.equal(state.designs[`${id}-1`].parentId, `${firstRequest}-1`);
  assert.equal(state.designs[`${id}-1`].action, 'bolder');
  assert.ok(fs.existsSync(path.join(area, 'designs', `${firstRequest}-1`, 'index.html')), 'original kept');
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
  assert.match(steer.message, /Retrieve its source with the Congo CLI or MCP/);
  assert.match(steer.message, /outside the user's project/);
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

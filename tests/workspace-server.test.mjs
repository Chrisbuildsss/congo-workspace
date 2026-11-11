// Congo workspace local server and launcher (skills/redesign/scripts).
// No engine binary, network or browser needed.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { startWorkspaceServer } from '../skills/redesign/scripts/workspace/server/server.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const launcher = path.join(root, 'skills', 'redesign', 'scripts', 'workspace.mjs');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'congo-workspace-test-'));
const uiDir = path.join(tmp, 'ui');
fs.mkdirSync(uiDir, { recursive: true });
fs.writeFileSync(path.join(uiDir, 'index.html'), '<!doctype html><title>ui</title><div id="root"></div>');

const server = await startWorkspaceServer({ root: path.join(tmp, 'home'), uiDir, port: 4970, token: 'test-token', bootHelper: false, env: { ...process.env, IMPECCABLE_LAUNCHER: path.join(tmp, 'no-impeccable') } });
const base = `http://127.0.0.1:${server.record.port}`;
const content = `http://127.0.0.1:${server.record.contentPort}`;
after(async () => {
  await server.stop();
  try { execFileSync(process.execPath, [launcher, 'stop'], { env: launcherEnv(), encoding: 'utf8' }); } catch {}
  fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});

function launcherEnv() {
  return { ...process.env, CONGO_WORKSPACE_HOME: path.join(tmp, 'launcher-home'), CONGO_WORKSPACE_NO_HELPER: '1' };
}

async function api(route, body, token = 'test-token') {
  const response = await fetch(base + route, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: response.status, value: await response.json().catch(() => null) };
}

function rawGet(url, host) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request({ host: u.hostname, port: u.port, path: u.pathname, headers: { Host: host } }, (res) => {
      res.resume();
      res.on('end', () => resolve(res.statusCode));
    });
    req.on('error', reject);
    req.end();
  });
}

test('the API needs the launch token; ping and the page do not', async () => {
  assert.equal((await api('/api/status', undefined, 'wrong')).status, 401);
  const ping = await (await fetch(`${base}/api/ping`)).json();
  assert.deepEqual([ping.service, ping.protocol], ['congo-workspace', 1]);
  const page = await fetch(`${base}/compose/abc`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /<div id="root">/);
  assert.match(page.headers.get('content-security-policy'), /frame-ancestors 'none'/);
});

test('status reports no connected AI and no app until there is one', async () => {
  const { status, value } = await api('/api/status');
  assert.equal(status, 200);
  assert.equal(value.ai.connected, false);
  assert.equal(value.app, null);
  assert.equal(value.contentOrigin, content);
});

test('requests for another host name are refused (DNS rebinding)', async () => {
  assert.equal(await rawGet(`${base}/api/ping`, 'evil.example'), 403);
  assert.equal(await rawGet(`${content}/health`, 'evil.example'), 403);
  assert.equal(await rawGet(`${content}/health`, `127.0.0.1:${server.record.contentPort}`), 200);
});

test('designs are served from their own origin and never outside the designs folder', async () => {
  const dir = path.join(tmp, 'home', 'area', 'designs', 'd1');
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), '<h1>Design one</h1>');
  assert.match(await (await fetch(`${content}/designs/d1/`)).text(), /Design one/);
  assert.equal((await fetch(`${content}/designs/..%2f..%2fstate.json`)).status, 404);
  assert.equal((await fetch(`${content}/designs/%2e%2e/requests/x.json`)).status, 404);
  assert.equal((await fetch(`${base}/designs/d1/`)).status, 200, 'the UI origin serves only its own page shell');
  assert.doesNotMatch(await (await fetch(`${base}/designs/d1/`)).text(), /Design one/);
});

test('theme, view and compose changes persist to state.json', async () => {
  assert.equal((await api('/api/settings', { theme: 'neon' })).status, 400);
  assert.equal((await api('/api/settings', { theme: 'light' })).value.settings.theme, 'light');
  assert.equal((await api('/api/view', { view: 'projects' })).status, 200);
  const created = await api('/api/composes', { title: 'Contacts page' });
  const id = created.value.compose.id;
  assert.equal((await api('/api/composes/update', { id, title: 'Contacts, calmer' })).value.compose.title, 'Contacts, calmer');
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, 'home', 'state.json'), 'utf8'));
  assert.equal(saved.settings.theme, 'light');
  assert.equal(saved.view, 'projects');
  assert.equal(saved.composes[0].title, 'Contacts, calmer');
  const after = await api('/api/composes/delete', { id });
  assert.equal(after.value.composes.length, 0);
});

test('attaching an app needs a real folder', async () => {
  assert.equal((await api('/api/apps', { path: path.join(tmp, 'missing') })).status, 404);
  const appDir = path.join(tmp, 'my-app');
  fs.mkdirSync(appDir);
  fs.writeFileSync(path.join(appDir, 'package.json'), JSON.stringify({ name: 'my-app', scripts: { dev: 'vite' } }));
  const { value } = await api('/api/apps', { path: appDir });
  assert.equal(value.app.name, 'my-app');
  assert.equal((await api('/api/status')).value.app.name, 'my-app');
});

test('the launcher opens one workspace, reuses it, reports status and stops it', () => {
  const env = launcherEnv();
  const first = JSON.parse(execFileSync(process.execPath, [launcher, 'open', '--no-browser', '--json', '--port', '4990'], { env, encoding: 'utf8' }));
  assert.match(first.url, /^http:\/\/127\.0\.0\.1:\d+\/#t=/);
  assert.equal(first.status.ai.connected, false);
  const second = JSON.parse(execFileSync(process.execPath, [launcher, 'open', '--no-browser', '--json', '--view', 'compose'], { env, encoding: 'utf8' }));
  assert.equal(second.pid, first.pid, 'a second open reuses the running workspace');
  assert.match(second.url, /\/compose#t=/);
  const runtime = JSON.parse(fs.readFileSync(path.join(env.CONGO_WORKSPACE_HOME, 'runtime.json'), 'utf8'));
  assert.equal(runtime.entry, launcher);
  assert.equal(JSON.parse(execFileSync(process.execPath, [launcher, 'status', '--json'], { env, encoding: 'utf8' })).running, true);
  assert.equal(JSON.parse(execFileSync(process.execPath, [launcher, 'stop', '--json'], { env, encoding: 'utf8' })).stopped, true);
  assert.equal(JSON.parse(execFileSync(process.execPath, [launcher, 'status', '--json'], { env, encoding: 'utf8' })).running, false);
});

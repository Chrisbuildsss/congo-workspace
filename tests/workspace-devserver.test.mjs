// Live App: the project's own dev command, started and stopped by the workspace.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DevServers, detectDevCommand, normalizeUrl } from '../skills/congo/scripts/workspace/server/devserver.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'congo-devserver-'));
after(() => fs.rmSync(tmp, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }));

function app(name, pkg, files = {}) {
  const dir = path.join(tmp, name);
  fs.mkdirSync(dir, { recursive: true });
  if (pkg) fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg));
  for (const [file, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, file), body);
  return { id: name, name, path: dir };
}

test('detects the project\'s own dev command and package manager', () => {
  assert.equal(detectDevCommand(app('none', null).path).ok, false);
  assert.match(detectDevCommand(app('noscript', { scripts: { build: 'x' } }).path).reason, /no dev, start or serve/);
  const pnpm = app('pnpm', { scripts: { dev: 'vite' }, devDependencies: { vite: '1' } }, { 'pnpm-lock.yaml': '' });
  const found = detectDevCommand(pnpm.path);
  assert.equal(found.label, 'pnpm run dev');
  assert.equal(found.needsInstall, true, 'declared dependencies but no node_modules');
  const plain = detectDevCommand(app('plain', { scripts: { start: 'node s.mjs' } }).path);
  assert.equal(plain.label, 'npm run start');
  assert.equal(plain.needsInstall, false, 'nothing to install');
});

test('normalizes wildcard hosts to a loopback address', () => {
  assert.equal(normalizeUrl('http://0.0.0.0:5173/'), 'http://127.0.0.1:5173/');
  assert.equal(normalizeUrl('http://localhost:3000/app'), 'http://localhost:3000/app');
});

test('Start runs it, finds its URL in the output, and Stop ends it', async () => {
  const server = "import http from 'node:http';const s=http.createServer((q,r)=>r.end('live ok'));s.listen(0,'127.0.0.1',()=>console.log('\\u001b[32mready\\u001b[0m at http://localhost:'+s.address().port+'/'));";
  const target = app('runs', { scripts: { dev: 'node server.mjs' } }, { 'server.mjs': server });
  const dev = new DevServers();
  assert.equal(dev.start(target).status, 'starting');
  let status;
  for (let i = 0; i < 100; i++) {
    status = dev.status(target);
    if (status.url) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  assert.equal(status.status, 'running');
  assert.match(status.url, /^http:\/\/localhost:\d+\/$/);
  assert.ok(status.output.some((line) => line.includes('ready at')), 'ANSI codes stripped, output kept');
  assert.equal(await (await fetch(status.url)).text(), 'live ok');
  dev.stop(target);
  await new Promise((r) => setTimeout(r, 800));
  await assert.rejects(fetch(status.url, { signal: AbortSignal.timeout(1500) }));
  assert.equal(dev.status(target).status, 'stopped');
});

test('a URL from the user\'s AI attaches without a process', () => {
  const target = app('ai', { scripts: { dev: 'vite' } });
  const dev = new DevServers();
  dev.attachUrl(target, 'http://0.0.0.0:4620/', 'ai');
  const status = dev.status(target);
  assert.equal(status.status, 'running');
  assert.equal(status.url, 'http://127.0.0.1:4620/');
  assert.equal(status.startedBy, 'ai');
});

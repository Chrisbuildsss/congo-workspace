#!/usr/bin/env node
// Congo workspace launcher. Opens (or reuses) the local workspace server.
//   node workspace.mjs open [--project PATH] [--view compose|library|projects|live] [--no-browser] [--json]
//   node workspace.mjs connect [--project PATH] [--browser] [--json]   (for the user's AI)
//   node workspace.mjs status [--json]
//   node workspace.mjs stop
//   node workspace.mjs serve [--port N]      (foreground; `open` starts this detached)
// No model calls, credentials or downloads. Impeccable's engine is used as-is.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir, layout } from './workspace/server/paths.mjs';
import { readJson, writeJsonAtomic } from './workspace/server/store.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const entry = fileURLToPath(import.meta.url);
const uiDir = path.join(here, 'workspace', 'ui');

function parse(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { out._.push(a); continue; }
    const [key, inline] = a.slice(2).split(/=(.*)/s, 2);
    if (inline !== undefined) out[key] = inline;
    else if (argv[i + 1] !== undefined && !argv[i + 1].startsWith('--')) out[key] = argv[++i];
    else out[key] = true;
  }
  return out;
}

async function request(record, route, body) {
  const response = await fetch(`http://127.0.0.1:${record.port}${route}`, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${record.token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(4000),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(value.error || `Workspace request failed (${response.status})`);
  return value;
}

async function alive(files) {
  const record = readJson(files.server, null);
  if (!record?.port || !record?.token) return null;
  try {
    const status = await request(record, '/api/status');
    return status.protocol === 1 ? record : null;
  } catch {
    return null;
  }
}

function register(files) {
  // Lets `congo workspace` find this installed copy.
  const current = readJson(files.runtime, null);
  if (current?.entry === entry) return;
  writeJsonAtomic(files.runtime, { protocol: 1, entry, registeredAt: new Date().toISOString() });
}

async function ensure(files, port) {
  const running = await alive(files);
  if (running) return running;
  fs.mkdirSync(files.root, { recursive: true });
  const out = fs.openSync(files.log, 'a');
  const child = spawn(process.execPath, [entry, 'serve', ...(port ? ['--port', String(port)] : [])], {
    detached: true,
    stdio: ['ignore', out, out],
    windowsHide: true,
    env: { ...process.env, CONGO_WORKSPACE_HOME: files.root },
  });
  child.unref();
  fs.closeSync(out);
  const until = Date.now() + 12000;
  while (Date.now() < until) {
    await new Promise((r) => setTimeout(r, 100));
    const record = await alive(files);
    if (record && record.pid === child.pid) return record;
  }
  throw new Error(`The workspace did not start. See ${files.log}`);
}

function openBrowser(url) {
  const opts = { detached: true, stdio: 'ignore', windowsHide: true };
  const child = process.platform === 'win32'
    ? spawn('rundll32', ['url.dll,FileProtocolHandler', url], opts)
    : process.platform === 'darwin'
      ? spawn('open', [url], opts)
      : spawn('xdg-open', [url], opts);
  child.on('error', () => {});
  child.unref();
}

function print(args, value, human) {
  console.log(args.json ? JSON.stringify(value, null, 2) : human);
}

async function main() {
  const args = parse(process.argv.slice(2));
  const command = args._[0] || 'open';
  const files = layout(dataDir());

  if (command === 'serve') {
    const { startWorkspaceServer } = await import('./workspace/server/server.mjs');
    const log = (line) => fs.appendFileSync(files.log, `${new Date().toISOString()} ${line}\n`);
    const server = await startWorkspaceServer({ root: files.root, uiDir, port: Number(args.port) || 4870, log });
    log(`serving on ${server.record.port} (content ${server.record.contentPort})`);
    register(files);
    const shutdown = () => server.stop();
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    await server.stopped;
    return;
  }

  if (command === 'status') {
    const record = await alive(files);
    const value = record ? { running: true, url: `http://127.0.0.1:${record.port}/#t=${record.token}`, ...(await request(record, '/api/status')) } : { running: false };
    return print(args, value, record ? `Congo workspace is running: ${value.url}` : 'Congo workspace is not running.');
  }

  if (command === 'stop') {
    const record = await alive(files);
    if (record) await request(record, '/api/stop', {});
    return print(args, { stopped: Boolean(record) }, record ? 'Congo workspace stopped.' : 'Congo workspace was not running.');
  }

  if (command === 'connect') {
    // For the user's AI: open or reuse the workspace, start Impeccable's live
    // helper on its working area, and say where to run `live-poll`.
    register(files);
    const record = await ensure(files, Number(args.port) || 0);
    const connected = await request(record, '/api/connect', typeof args.project === 'string' ? { project: args.project } : {});
    const url = `http://127.0.0.1:${record.port}/compose#t=${record.token}`;
    if (args.browser === true || args['open-browser']) openBrowser(url);
    return print(args, { url, ...connected, next: `Run Impeccable's live-poll with ${connected.area} as the working directory, and keep polling.` },
      `Congo workspace: ${url}\nWorking area: ${connected.area}\nNext: run Impeccable's live-poll from the working area and keep polling.`);
  }

  if (command !== 'open') {
    console.error(`Unknown command: ${command}. Use open, connect, status, stop or serve.`);
    process.exitCode = 2;
    return;
  }

  if (!fs.existsSync(path.join(uiDir, 'index.html'))) {
    throw new Error(`The workspace interface is missing at ${uiDir}. Reinstall the Redesign skill.`);
  }
  register(files);
  const record = await ensure(files, Number(args.port) || 0);
  if (typeof args.project === 'string') await request(record, '/api/apps', { path: args.project });
  if (typeof args.view === 'string') await request(record, '/api/view', { view: args.view });
  const url = `http://127.0.0.1:${record.port}/${typeof args.view === 'string' ? args.view : ''}#t=${record.token}`;
  const status = await request(record, '/api/status');
  if (!args['no-browser']) openBrowser(url);
  print(args, { url, pid: record.pid, port: record.port, contentPort: record.contentPort, dataDir: files.root, status },
    `Congo workspace: ${url}`);
}

main().catch((error) => {
  console.error(`workspace: ${error.message}`);
  process.exitCode = 1;
});

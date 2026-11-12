#!/usr/bin/env node
// Congo workspace launcher. Opens (or reuses) the local workspace server.
//   node workspace.mjs open [--project PATH] [--view explore|prototypes] [--no-browser] [--json]
//   node workspace.mjs connect [--project PATH] [--view explore|prototypes] [--browser] [--json]   (for the user's AI)
//   node workspace.mjs request --text "..." [--project PATH] [--browser] [--json]  (a request from the AI's chat; its prototype lands in Prototypes)
//   node workspace.mjs new --title "..." [--file <path.congo>] [--json]   (a prototype folder in a Congo file)
//   node workspace.mjs prepare <template-id> --into <prototype folder> [--refresh] [--json]
//   node workspace.mjs preview <prototype folder> [--status main|ready] [--json]
//   node workspace.mjs files [--json]                                     (Congo files and their prototypes)
//   node workspace.mjs status [--json]
//   node workspace.mjs stop
//   node workspace.mjs serve [--port N]      (foreground; `open` starts this detached)
// No model calls, credentials or downloads. Impeccable's engine is used as-is.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { dataDir, layout } from './workspace/server/paths.mjs';
import { readJson, writeJsonAtomic } from './workspace/server/store.mjs';
import { createCongoFile, createStub, filesRoot, listCongoFiles, previewDir } from './workspace/server/files.mjs';
import { buildPreview, ensureModules, prepareSource } from './workspace/server/prepare.mjs';

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

// Prototypes is the old Compose view: `compose` still names it in the API.
// Explore is the former Library: `library` still names it in the API.
function viewPath(view) {
  if (view === 'compose' || view === 'prototypes') return 'prototypes';
  return view === 'library' || view === 'explore' ? 'explore' : view;
}
function viewName(view) {
  if (view === 'prototypes') return 'compose';
  return view === 'explore' ? 'library' : view;
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
    // The Library to browse and send from; with --project, My app shows that app.
    const view = typeof args.view === 'string' ? viewPath(args.view) : 'explore';
    const url = `http://127.0.0.1:${record.port}/${view}#t=${record.token}`;
    if (args.browser === true || args['open-browser']) openBrowser(url);
    return print(args, { url, ...connected, next: `From ${connected.area}, run ${connected.poll?.launcher ?? "Impeccable's launcher"} live-poll and keep polling.` },
      `Congo workspace: ${url}\nWorking area: ${connected.area}\nNext: from the working area, run ${connected.poll?.launcher ?? "Impeccable's launcher"} live-poll and keep polling.`);
  }

  if (command === 'request') {
    // A request from the AI's own chat: it lands in Prototypes like one typed
    // in the request box, and comes back to the AI as a steer.
    const text = typeof args.text === 'string' ? args.text.trim() : '';
    if (!text) throw new Error('Pass the request with --text "..."');
    register(files);
    const record = await ensure(files, Number(args.port) || 0);
    let appId = null;
    if (typeof args.project === 'string') appId = (await request(record, '/api/apps', { path: args.project })).app.id;
    const { compose } = await request(record, '/api/composes', { title: text.split(/[.!?\n]/)[0].slice(0, 60), appId });
    const sent = await request(record, '/api/requests', { type: 'compose', composeId: compose.id, text, appId: appId ?? compose.appId });
    const url = `http://127.0.0.1:${record.port}/prototypes#t=${record.token}`;
    if (args.browser === true) openBrowser(url);
    return print(args, { url, composeId: compose.id, requestId: sent.request.id },
      `Sent to Prototypes: ${url}\nRequest ${sent.request.id} will reach your live-poll as a steer.`);
  }

  // Congo files work without the workspace running: they are just folders.
  if (command === 'files') {
    const root = filesRoot();
    const list = listCongoFiles(root).map((file) => ({
      file: file.dir,
      title: file.title,
      prototypes: file.prototypes.map((p) => ({ id: p.id, title: p.meta.title, status: p.meta.status ?? 'ready', dir: p.dir, preview: previewDir(p.dir), brief: Boolean(p.brief) })),
    }));
    return print(args, { root, files: list }, list.length
      ? list.map((f) => `${f.title}  (${f.file})\n${f.prototypes.map((p) => `  ${p.id}  ${p.title}  [${p.status}]`).join('\n')}`).join('\n')
      : `No Congo files yet in ${root}`);
  }

  if (command === 'new') {
    // A new prototype folder (with an "adapting" placeholder) in a Congo file.
    const title = typeof args.title === 'string' ? args.title.trim() : '';
    if (!title) throw new Error('Name it with --title "..."');
    const file = typeof args.file === 'string' ? path.resolve(args.file) : createCongoFile(filesRoot(), title);
    if (!fs.existsSync(file)) throw new Error(`No Congo file at ${file}`);
    const id = `${crypto.randomBytes(4).toString('hex')}-1`;
    const dir = path.join(file, id);
    createStub(dir, { title, request: null });
    return print(args, { file, id, prototype: dir, preview: path.join(dir, 'preview'), source: path.join(dir, 'source') },
      `Congo file: ${file}\nPrototype: ${dir}`);
  }

  if (command === 'prepare') {
    const templateId = args._[1];
    const into = typeof args.into === 'string' ? path.resolve(args.into) : '';
    if (!templateId || !into) throw new Error('Use: prepare <template-id> --into <prototype folder>');
    const result = await prepareSource({ root: files.root, templateId, prototypeDir: into, refresh: args.refresh === true });
    return print(args, result, `${result.reused ? 'Reused' : 'Prepared'} ${templateId} in ${result.seconds}s. Source: ${result.source}`);
  }

  if (command === 'preview') {
    const dir = args._[1] ? path.resolve(args._[1]) : '';
    if (!dir) throw new Error('Use: preview <prototype folder> [--status main|ready]');
    const status = typeof args.status === 'string' && ['main', 'ready'].includes(args.status) ? args.status : undefined;
    // A Congo file that was moved here from another computer gets its dependencies linked again first.
    await ensureModules({ root: files.root, prototypeDir: dir });
    const result = buildPreview({ prototypeDir: dir, status });
    return print(args, result, `Preview built in ${result.seconds}s: ${result.preview}`);
  }

  if (command !== 'open') {
    console.error(`Unknown command: ${command}. Use open, connect, request, new, prepare, preview, files, status, stop or serve.`);
    process.exitCode = 2;
    return;
  }

  if (!fs.existsSync(path.join(uiDir, 'index.html'))) {
    throw new Error(`The workspace interface is missing at ${uiDir}. Reinstall the Congo skill.`);
  }
  register(files);
  const record = await ensure(files, Number(args.port) || 0);
  if (typeof args.project === 'string') await request(record, '/api/apps', { path: args.project });
  if (typeof args.view === 'string') await request(record, '/api/view', { view: viewName(args.view) });
  const url = `http://127.0.0.1:${record.port}/${typeof args.view === 'string' ? viewPath(args.view) : ''}#t=${record.token}`;
  const status = await request(record, '/api/status');
  if (!args['no-browser']) openBrowser(url);
  print(args, { url, pid: record.pid, port: record.port, contentPort: record.contentPort, dataDir: files.root, status },
    `Congo workspace: ${url}`);
}

main().catch((error) => {
  console.error(`workspace: ${error.message}`);
  process.exitCode = 1;
});

// Prepared app copies and preview builds: the slow, mechanical steps of a
// prototype, done once and reused, so the AI spends its time adapting.
//
//   <workspace home>/apps/<template id>/   one `congo create --install` per app,
//                                          reused by every prototype built on it
//   <prototype>/source/                    a copy of it (no node_modules), whose
//                                          node_modules links to the prepared copy
//   <prototype>/preview/                   the built, running preview
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { runCongo } from './congo-cli.mjs';
import { appendHistory, removeTree, updatePrototype } from './files.mjs';
import { readJson } from './store.mjs';

const TEMPLATE_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;
const SKIP = new Set(['node_modules', '.git', 'dist', '.impeccable', '.vite']);

export function appsDir(root) {
  return path.join(root, 'apps');
}

function receiptVersion(dir) {
  try {
    const receipts = fs.readdirSync(path.join(dir, '.congo')).filter((n) => n.endsWith('.json'));
    for (const name of receipts) {
      const receipt = readJson(path.join(dir, '.congo', name), null);
      if (receipt?.kind === 'template' || receipts.length === 1) return { id: receipt?.id ?? null, version: receipt?.version ?? null };
    }
  } catch {}
  return { id: null, version: null };
}

function isReady(dir) {
  return fs.existsSync(path.join(dir, 'package.json')) && fs.existsSync(path.join(dir, 'node_modules'));
}

function npm(args, cwd) {
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, encoding: 'utf8', windowsHide: true, shell: process.platform === 'win32', timeout: 15 * 60_000 });
  return { code: result.status, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

/**
 * A ready copy of a Congo app: created and installed once with the person's
 * own Congo CLI (their sign-in and subscription apply), then reused.
 */
export async function prepareApp({ root, templateId, refresh = false, env = process.env, run = runCongo }) {
  if (!TEMPLATE_ID.test(String(templateId))) throw new Error('Use a Congo template id, like the `id` from `congo templates --json`');
  const dir = path.join(appsDir(root), templateId);
  if (!refresh && isReady(dir)) return { dir, fresh: false, ...receiptVersion(dir) };
  if (fs.existsSync(dir)) removeTree(dir);
  fs.mkdirSync(appsDir(root), { recursive: true });
  // The download is one request; installing follows. A dropped connection is
  // retried once, and whatever was half-written is cleared first.
  let created;
  for (let attempt = 1; attempt <= 2; attempt++) {
    created = await run(['create', templateId, '--project', dir], { env, timeoutMs: 5 * 60_000 });
    if (created.code === 0) break;
    if (fs.existsSync(dir)) removeTree(dir);
    if (!/Couldn't reach|ENOTFOUND|ETIMEDOUT|ECONNRESET|network/i.test(`${created.stderr}${created.stdout}`)) break;
    await new Promise((resolve) => setTimeout(resolve, 3000));
  }
  if (created.code !== 0) {
    const reason = `${created.stderr ?? ''}\n${created.stdout ?? ''}`.split(/\r?\n/).map((l) => l.trim()).find((l) => l && !/^npm (warn|notice)/i.test(l));
    throw new Error(reason || created.error?.message || 'congo create failed');
  }
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    const install = npm(fs.existsSync(path.join(dir, 'package-lock.json')) ? ['ci', '--ignore-scripts', '--no-audit', '--no-fund'] : ['install', '--ignore-scripts', '--no-audit', '--no-fund'], dir);
    if (install.code !== 0) throw new Error(`Installing ${templateId}'s dependencies failed: ${install.output.trim().split(/\r?\n/).pop()}`);
  }
  return { dir, fresh: true, ...receiptVersion(dir) };
}

function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const a = path.join(from, entry.name);
    const b = path.join(to, entry.name);
    if (entry.isDirectory()) copyTree(a, b);
    else if (entry.isFile()) fs.copyFileSync(a, b);
  }
}

function git(args, cwd) {
  return spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, env: { ...process.env, GIT_DIR: path.join(cwd, '.git'), GIT_WORK_TREE: cwd } });
}

/** Links a source's node_modules to the prepared copy's (a junction on Windows). */
export function linkModules(source, prepared) {
  const link = path.join(source, 'node_modules');
  try {
    const stat = fs.lstatSync(link);
    if (stat.isSymbolicLink()) fs.unlinkSync(link);
    else return false;
  } catch {}
  fs.symlinkSync(path.join(prepared, 'node_modules'), link, process.platform === 'win32' ? 'junction' : 'dir');
  return true;
}

/**
 * Puts a prepared app's source into a prototype: copied without its
 * dependencies, node_modules linked to the prepared copy, and committed once
 * ("congo source") so Pull into a project can carry over just the changes.
 */
export async function prepareSource({ root, templateId, prototypeDir, refresh = false, env = process.env, run = runCongo }) {
  const started = Date.now();
  const app = await prepareApp({ root, templateId, refresh, env, run });
  const source = path.join(prototypeDir, 'source');
  if (fs.existsSync(source)) removeTree(source);
  copyTree(app.dir, source);
  linkModules(source, app.dir);
  fs.appendFileSync(path.join(source, '.gitignore'), '\nnode_modules\n');
  // The baseline Pull into a project diffs against. Long paths are allowed
  // (a Congo file can sit deep in Documents), and a failure is never silent.
  for (const args of [
    ['init', '-q'],
    ['config', 'core.longpaths', 'true'],
    ['config', 'core.autocrlf', 'false'],
    ['add', '-A'],
    ['-c', 'user.name=Congo', '-c', 'user.email=workspace@congo.local', 'commit', '-q', '-m', 'congo source'],
  ]) {
    const step = git(args, source);
    if (step.status !== 0) throw new Error(`Could not record the app's starting point (git ${args[0]}): ${`${step.stderr ?? ''}`.trim().split(/\r?\n/)[0] || 'git failed'}`);
  }
  const meta = updatePrototype(prototypeDir, { sourceDir: 'source', root: true, base: { kind: 'template', id: app.id ?? templateId, version: app.version ?? null } });
  appendHistory(prototypeDir, { type: 'source', template: templateId, version: app.version ?? null, reused: !app.fresh });
  return { source, prepared: app.dir, reused: !app.fresh, version: app.version ?? null, seconds: Math.round((Date.now() - started) / 100) / 10, title: meta.title, map: sourceMap(source) };
}

/**
 * A short map of an app's source, so the AI can open the right files first
 * instead of exploring: its guide, where routes are declared, and the folders
 * that hold screens and sample data. Found by looking, never assumed.
 */
export function sourceMap(source) {
  const rel = (file) => path.relative(source, file).split(path.sep).join('/');
  const exists = (...parts) => fs.existsSync(path.join(source, ...parts));
  const map = { guides: [], entry: [], routes: [], folders: [] };
  for (const name of ['README.md', 'CONGO.md', 'BRAND.md']) if (exists(name)) map.guides.push(name);
  const src = path.join(source, 'src');
  if (!fs.existsSync(src)) return map;
  const files = [];
  const walk = (dir, depth) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) { if (depth < 4) walk(full, depth + 1); } else if (/\.(tsx?|jsx?)$/.test(entry.name)) files.push(full);
    }
  };
  walk(src, 0);
  for (const file of files) {
    const name = path.basename(file).toLowerCase();
    if (/^(main|index|app)\.(tsx?|jsx?)$/.test(name) && path.dirname(file) === src) map.entry.push(rel(file));
    if (/rout(er|es)/.test(name)) map.routes.push(rel(file));
  }
  // The file that maps addresses to screens, when no router file names itself.
  if (!map.routes.length) {
    for (const file of files) {
      if (fs.statSync(file).size > 200_000) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/<Route\b|createBrowserRouter|path:\s*['"]\//.test(text)) { map.routes.push(rel(file)); if (map.routes.length >= 3) break; }
    }
  }
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const inside = files.filter((file) => file.startsWith(path.join(src, entry.name) + path.sep));
    map.folders.push({ folder: `src/${entry.name}`, files: inside.length, examples: inside.slice(0, 4).map((file) => path.basename(file)) });
  }
  return map;
}

/**
 * A Congo file copied to another computer (or restored from a backup) arrives
 * without its dependencies: they are a link to this computer's prepared copy.
 * This puts the link back, preparing the app first if it is not here yet.
 */
export async function ensureModules({ root, prototypeDir, env = process.env, run = runCongo }) {
  const meta = readJson(path.join(prototypeDir, 'prototype.json'), {}) ?? {};
  const source = meta.sourceDir ? path.resolve(prototypeDir, meta.sourceDir) : path.join(prototypeDir, 'source');
  if (!fs.existsSync(path.join(source, 'package.json'))) return { linked: false };
  if (fs.existsSync(path.join(source, 'node_modules', '.bin')) || fs.existsSync(path.join(source, 'node_modules', 'vite'))) return { linked: false };
  const templateId = meta.base?.id;
  if (!templateId) return { linked: false };
  const app = await prepareApp({ root, templateId, env, run });
  try { fs.rmSync(path.join(source, 'node_modules'), { force: true }); } catch {}
  linkModules(source, app.dir);
  appendHistory(prototypeDir, { type: 'relinked', template: templateId });
  return { linked: true };
}

/**
 * Builds a prototype's running preview from its source into preview/, and
 * records its status (`main` after the main screen, `ready` after Expand).
 */
export function buildPreview({ prototypeDir, status }) {
  const started = Date.now();
  const meta = readJson(path.join(prototypeDir, 'prototype.json'), {}) ?? {};
  const source = meta.sourceDir ? path.resolve(prototypeDir, meta.sourceDir) : path.join(prototypeDir, 'source');
  if (!fs.existsSync(path.join(source, 'package.json'))) throw new Error(`No source to build at ${source}`);
  const out = path.join(prototypeDir, '.preview-build');
  if (fs.existsSync(out)) removeTree(out);
  // Vite's own entry script, run with this Node: no shell, so folder names
  // with spaces (a Congo file's name) are safe.
  const bin = path.join(source, 'node_modules', 'vite', 'bin', 'vite.js');
  let result;
  if (fs.existsSync(bin)) {
    result = spawnSync(process.execPath, [bin, 'build', '--outDir', out, '--emptyOutDir', '--base', '/', '--logLevel', 'warn'], { cwd: source, encoding: 'utf8', windowsHide: true, timeout: 10 * 60_000 });
  } else {
    result = npm(['run', 'build'], source);
    if (result.code === 0 && fs.existsSync(path.join(source, 'dist'))) fs.cpSync(path.join(source, 'dist'), out, { recursive: true });
    result = { status: result.code, stdout: result.output, stderr: '' };
  }
  if (result.status !== 0 || !fs.existsSync(path.join(out, 'index.html'))) {
    const detail = `${result.stdout ?? ''}${result.stderr ?? ''}`.trim().split(/\r?\n/).slice(-6).join('\n');
    throw new Error(`The preview build failed:\n${detail}`);
  }
  // The source may carry Impeccable's injected editor script after an edit;
  // the kept preview never does.
  const page = path.join(out, 'index.html');
  fs.writeFileSync(page, fs.readFileSync(page, 'utf8').replace(/<!-- impeccable-live-start -->[\s\S]*?<!-- impeccable-live-end -->\s*/g, ''));
  const preview = path.join(prototypeDir, 'preview');
  if (fs.existsSync(preview)) removeTree(preview);
  fs.renameSync(out, preview);
  const fields = { root: true, sourceDir: meta.sourceDir ?? 'source', builtAt: new Date().toISOString() };
  if (status) fields.status = status;
  updatePrototype(prototypeDir, fields);
  appendHistory(prototypeDir, { type: 'preview', status: status ?? meta.status ?? null });
  return { preview, seconds: Math.round((Date.now() - started) / 100) / 10 };
}

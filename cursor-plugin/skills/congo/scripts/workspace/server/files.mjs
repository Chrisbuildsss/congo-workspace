// Congo files: where prototypes are kept, outside any code project.
//
//   Documents\Congo\                      (CONGO_FILES_DIR overrides it)
//     Realtor ideas.congo\                one Congo file, shown as one item
//       congo-file.json                   { schemaVersion, title, createdAt }
//       <prototype id>\
//         prototype.json                  title, status, brief, sources, ...
//         preview\index.html (+ assets)   the running preview build
//         source\                         the working source (whole apps)
//         history.jsonl                   what happened to it, one event a line
//
// Everything inside is relative, so a Congo file can be backed up or moved.
// Dependencies are never stored in it: a whole-app source links its
// node_modules to a prepared app copy kept by the workspace.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './store.mjs';

export const FILE_EXT = '.congo';
export const PROTOTYPE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/i;
export const STATUSES = ['adapting', 'main', 'expanding', 'ready', 'error'];

/** The person's Documents folder (Windows may move it, for example to OneDrive). */
function documentsDir(env) {
  if (process.platform === 'win32') {
    try {
      const out = spawnSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Explorer\\User Shell Folders', '/v', 'Personal'], { encoding: 'utf8', windowsHide: true, timeout: 3000 });
      const value = /Personal\s+REG_\w+\s+(.+)/.exec(out.stdout ?? '')?.[1]?.trim();
      if (value) {
        const expanded = value.replace(/%([^%]+)%/g, (_, name) => env[name] ?? process.env[name] ?? `%${name}%`);
        if (!expanded.includes('%') && path.isAbsolute(expanded)) return expanded;
      }
    } catch {}
    return path.join(env.USERPROFILE || os.homedir(), 'Documents');
  }
  if (env.XDG_DOCUMENTS_DIR) return env.XDG_DOCUMENTS_DIR;
  return path.join(os.homedir(), 'Documents');
}

export function filesRoot(env = process.env) {
  if (env.CONGO_FILES_DIR) return path.resolve(env.CONGO_FILES_DIR);
  return path.join(documentsDir(env), 'Congo');
}

/** A name that works as a folder name on every system. */
export function fileTitle(text) {
  const clean = String(text ?? '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 80);
  return clean || 'Prototypes';
}

/** Creates a Congo file (a new name if the title is taken) and returns its path. */
export function createCongoFile(root, title, { reuse = false } = {}) {
  fs.mkdirSync(root, { recursive: true });
  const base = fileTitle(title);
  let name = base;
  for (let n = 2; ; n++) {
    const dir = path.join(root, `${name}${FILE_EXT}`);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      writeJsonAtomic(path.join(dir, 'congo-file.json'), { schemaVersion: 1, title: name, createdAt: new Date().toISOString() });
      return dir;
    }
    if (reuse) return dir;
    name = `${base} ${n}`;
  }
}

export function congoFileTitle(dir) {
  return path.basename(dir).replace(/\.congo$/i, '');
}

export function prototypeMetaFile(dir) {
  const meta = path.join(dir, 'prototype.json');
  if (fs.existsSync(meta)) return meta;
  return path.join(dir, 'design.json');
}

/** Merges fields into a prototype's prototype.json (creating it if needed). */
export function updatePrototype(dir, fields) {
  const file = path.join(dir, 'prototype.json');
  const current = readJson(file, null) ?? readJson(path.join(dir, 'design.json'), null) ?? {};
  const next = { ...current, ...fields };
  fs.mkdirSync(dir, { recursive: true });
  writeJsonAtomic(file, next);
  return next;
}

export function appendHistory(dir, event) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.appendFileSync(path.join(dir, 'history.jsonl'), `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`);
  } catch {}
}

/** A placeholder the workspace shows right away, while the AI adapts. */
export function createStub(dir, { title, request, kind = 'prototype', parent = null }) {
  if (fs.existsSync(path.join(dir, 'prototype.json'))) return;
  updatePrototype(dir, { title: title.slice(0, 120), status: 'adapting', request, kind, ...(parent ? { parent } : {}), createdAt: new Date().toISOString() });
  appendHistory(dir, { type: 'requested', request });
}

/** Where a prototype's running preview lives: preview/, or the folder itself (older flat layout). */
export function previewDir(dir) {
  const nested = path.join(dir, 'preview');
  if (fs.existsSync(path.join(nested, 'index.html'))) return nested;
  if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
  return nested;
}

/** The prototype's source: `sourceDir` from its metadata (relative to the prototype), or source/. */
export function sourceDirOf(dir, meta) {
  const candidates = [];
  if (typeof meta?.sourceDir === 'string' && meta.sourceDir) {
    candidates.push(path.isAbsolute(meta.sourceDir) ? meta.sourceDir : path.join(dir, meta.sourceDir));
  }
  candidates.push(path.join(dir, 'source'));
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(path.join(candidate, 'package.json'))) return path.resolve(candidate);
    } catch {}
  }
  return undefined;
}

function briefOf(dir, meta) {
  if (meta?.brief && typeof meta.brief === 'object') {
    const pick = (key) => (typeof meta.brief[key] === 'string' ? meta.brief[key].slice(0, 1200) : undefined);
    const brief = { who: pick('who'), why: pick('why'), supports: pick('supports'), next: pick('next') };
    return Object.values(brief).some(Boolean) ? brief : undefined;
  }
  if (typeof meta?.brief === 'string' && meta.brief.trim()) return { text: meta.brief.slice(0, 3000) };
  try {
    const text = fs.readFileSync(path.join(dir, 'brief.md'), 'utf8').trim();
    if (text) return { text: text.slice(0, 3000) };
  } catch {}
  return undefined;
}

/** Every Congo file under the root, with its prototypes. */
export function listCongoFiles(root) {
  let entries = [];
  try {
    entries = fs.readdirSync(root, { withFileTypes: true });
  } catch {
    return [];
  }
  const files = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.toLowerCase().endsWith(FILE_EXT)) continue;
    const dir = path.join(root, entry.name);
    const prototypes = [];
    let children = [];
    try {
      children = fs.readdirSync(dir, { withFileTypes: true });
    } catch {}
    for (const child of children) {
      if (!child.isDirectory() || !PROTOTYPE_ID.test(child.name)) continue;
      const protoDir = path.join(dir, child.name);
      const meta = readJson(prototypeMetaFile(protoDir), null);
      if (!meta || typeof meta.title !== 'string') continue;
      prototypes.push({ id: child.name, dir: protoDir, meta, brief: briefOf(protoDir, meta) });
    }
    files.push({ dir, title: congoFileTitle(dir), prototypes });
  }
  return files;
}

/** Removes a folder without following links (a linked node_modules stays intact). */
export function removeTree(dir) {
  const unlinkLinks = (current, depth) => {
    let items = [];
    try {
      items = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      return;
    }
    for (const item of items) {
      const full = path.join(current, item.name);
      let stat;
      try {
        stat = fs.lstatSync(full);
      } catch {
        continue;
      }
      if (stat.isSymbolicLink()) {
        try { fs.unlinkSync(full); } catch { try { fs.rmdirSync(full); } catch {} }
      } else if (stat.isDirectory() && depth < 6 && item.name !== '.git') {
        unlinkLinks(full, depth + 1);
      }
    }
  };
  unlinkLinks(dir, 0);
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 3 });
}

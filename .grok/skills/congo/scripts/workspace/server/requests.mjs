// Workspace actions as requests for the user's own AI. Each request is a JSON
// file in the working area plus one Impeccable `steer` event that points at
// it. The AI writes prototypes into the folders the request names and replies
// `steer_done`; the workspace turns both into Prototypes cards and messages.
// Only `build` (Use this) changes the person's project.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { readJson, writeJsonAtomic } from './store.mjs';

export const TWEAKS = {
  subtle: { label: 'Subtle variant', command: null, brief: 'a subtle variation that keeps this design\'s identity (Impeccable live default mode: same brand, one different primary axis)' },
  layout: { label: 'Change layout', command: 'layout', brief: 'Impeccable layout: a different structural arrangement, not spacing tweaks' },
  colorize: { label: 'Recolor', command: 'colorize', brief: 'Impeccable colorize: a different color strategy' },
  bolder: { label: 'Bolder', command: 'bolder', brief: 'Impeccable bolder: amplify it' },
  quieter: { label: 'Quieter', command: 'quieter', brief: 'Impeccable quieter: pull it back' },
};

// Offered by Edit when a design is a script bundle Impeccable cannot pick in.
export const EDITABLE = { label: 'Make editable', command: null, brief: 'the same design, looking the same, as a static page Impeccable\'s editor can change: its rendered markup in index.html, its stylesheets and assets beside it, and no script bundle' };

export const MORE = ['distill', 'typeset', 'animate', 'delight', 'overdrive', 'polish', 'clarify', 'adapt', 'harden', 'critique', 'audit'];

// One prototype per request. The AI may add more beside it (<id>-2, <id>-3)
// when the person asked for several, such as a redesign or "a few directions".
const PROTOTYPES = 1;

// Requests whose results are new prototypes.
export const PROTOTYPE_TYPES = ['send', 'compose', 'tweak', 'library'];

// A request tray holds at most this many Library items.
export const MAX_ITEMS = 24;
export const ITEM_KINDS = ['template', 'app', 'screen'];
const ITEM_ID = /^[a-z0-9][a-z0-9-]{0,99}$/;

export function newId() {
  return crypto.randomBytes(4).toString('hex');
}

function clip(text, max) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function trimmed(value, max) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : null;
}

function httpsUrl(value) {
  return typeof value === 'string' && /^https:\/\//.test(value) ? value.slice(0, 1000) : null;
}

/**
 * A Library item the person selected: its catalog identity and version, what
 * the card showed, and their note for it. Never source. Null when invalid.
 */
export function normalizeItem(raw) {
  if (!raw || typeof raw !== 'object') return null;
  if (!ITEM_KINDS.includes(raw.kind) || typeof raw.id !== 'string' || !ITEM_ID.test(raw.id)) return null;
  let app = null;
  if (raw.app && typeof raw.app === 'object') {
    app = { id: trimmed(raw.app.id, 100), slug: trimmed(raw.app.slug, 100), name: trimmed(raw.app.name, 120) };
  } else if (typeof raw.app === 'string') {
    app = { id: null, slug: trimmed(raw.app, 100), name: null };
  }
  return {
    kind: raw.kind,
    id: raw.id,
    version: trimmed(raw.version, 200),
    app,
    title: trimmed(raw.title, 200) ?? raw.id,
    route: trimmed(raw.route, 300),
    image: httpsUrl(raw.image),
    preview: httpsUrl(raw.preview),
    url: httpsUrl(raw.url),
    note: trimmed(raw.note, 1000) ?? '',
  };
}

/** The whole tray, validated: items in order, no duplicates, one note. */
export function normalizeTray(raw) {
  const list = Array.isArray(raw?.items) ? raw.items : [];
  if (list.length > MAX_ITEMS) throw Object.assign(new Error(`Select at most ${MAX_ITEMS} items at a time`), { status: 400 });
  const items = [];
  for (const entry of list) {
    const item = normalizeItem(entry);
    if (!item) throw Object.assign(new Error('Unknown library item'), { status: 400 });
    if (!items.some((existing) => existing.kind === item.kind && existing.id === item.id)) items.push(item);
  }
  return { items, note: trimmed(raw?.note, 4000) ?? '' };
}

/** What a tweak or More action asks for. */
export function describeAction(key) {
  if (TWEAKS[key]) return { key, ...TWEAKS[key] };
  if (key === 'editable') return { key, ...EDITABLE };
  if (key.startsWith('more:') && MORE.includes(key.slice(5))) {
    const command = key.slice(5);
    return { key, label: command[0].toUpperCase() + command.slice(1), command, brief: `Impeccable ${command}` };
  }
  if (key.startsWith('custom:')) {
    const text = clip(key.slice(7), 300);
    return { key: 'custom', label: text, command: null, brief: `this variation: ${text}` };
  }
  return null;
}

export function buildRequest({ type, id = newId(), files, reference, impeccableReference, app, compose, text, design, action, item, items, attachment, outDir = null, filesRoot = null, helper = null }) {
  const count = PROTOTYPE_TYPES.includes(type) ? PROTOTYPES : 0;
  // Each prototype is a folder in a Congo file: its preview build in
  // preview/, its working source (whole apps) in source/.
  const outputs = Array.from({ length: count }, (_, i) => {
    const designId = `${id}-${i + 1}`;
    const dir = path.join(outDir ?? files.designs, designId);
    return outDir
      ? { id: designId, dir, preview: path.join(dir, 'preview'), source: path.join(dir, 'source'), meta: path.join(dir, 'prototype.json') }
      : { id: designId, dir };
  });
  const commandRef = action?.command && impeccableReference ? path.join(impeccableReference, `${action.command}.md`) : null;

  const request = {
    id,
    type,
    createdAt: new Date().toISOString(),
    workspace: {
      area: files.area,
      designs: files.designs,
      sources: path.join(files.sources, id),
      protocol: reference,
      impeccableReference: impeccableReference ?? null,
      congoFiles: filesRoot,
      congoFile: outDir,
      helper,
    },
    app: app ? { name: app.name, path: app.path } : null,
    ...(type === 'send' ? { destination: app ? 'existing' : 'new', items: items ?? [] } : {}),
    compose: compose ? { id: compose.id, title: compose.title } : null,
    request: text ?? null,
    attachment: attachment ?? null,
    design: design
      ? {
          id: design.id,
          title: design.title,
          dir: design.dir ?? null,
          entry: design.entry ?? null,
          url: design.url ?? null,
          source: design.source ?? null,
          wholeApp: Boolean(design.root),
          sourceDir: design.sourceDir ?? null,
        }
      : null,
    action: action ? { key: action.key, label: action.label, command: action.command, brief: action.brief, reference: commandRef } : null,
    item: item ?? null,
    outputs,
    prototypeJson: {
      required: ['title', 'status (main: the main screen is adapted; ready: the whole prototype is)'],
      optional: [
        'summary',
        'format (desktop|mobile)',
        'brief {who, why, supports, next} (product ideas only)',
        'source',
        'sources',
        'notices',
      ],
    },
  };
  return request;
}

/** The steer message: short, self-contained, under Impeccable's 4,000-character limit. */
export function steerMessage(request, requestFile) {
  const where = `Read ${requestFile} and follow ${request.workspace.protocol}.`;
  const reply = `Then reply: impeccable live-poll --reply ${request.id} steer_done "<one short line for the user>".`;
  let lead;
  switch (request.type) {
    case 'send': {
      const items = request.items ?? [];
      const names = items
        .slice(0, 8)
        .map((i) => `${i.kind === 'screen' ? 'screen' : 'app'} "${clip(i.title, 60)}"${i.app?.name && i.kind === 'screen' ? ` (${clip(i.app.name, 40)})` : ''}`)
        .join(', ');
      const what = items.length
        ? `${items.length} Congo Library item${items.length === 1 ? '' : 's'}: ${names}${items.length > 8 ? ', and more' : ''}`
        : "Congo's Library (nothing selected: find the closest app or screens)";
      const forApp = request.app ? ` for the user's app at ${request.app.path}` : ' for a new app';
      const note = request.request ? ` The user's note: "${clip(request.request, 1500)}".` : '';
      lead = `Make one running prototype${forApp} from ${what}.${note} Each item's note is in the request file. Main screen first: adapt the main screen or workflow, build the preview and reply; the rest waits for Expand. It goes in the Congo file the request names, outside the user's project.`;
      break;
    }
    case 'compose':
      lead = `Make one running prototype for this request: "${clip(request.request, 1500)}"${request.app ? ` (app: ${request.app.name})` : ''}. Main screen first; several side by side only if the user asked for that (a redesign or "a few directions"). It goes in the Congo file the request names, outside the user's project.`;
      break;
    case 'expand':
      lead = `Expand the prototype "${clip(request.design?.title, 120)}": build out the rest of the app around its main screen, in the same prototype (${request.design?.dir ?? 'its folder'}), then rebuild its preview with status ready.`;
      break;
    case 'tweak':
      lead = `Make a new prototype from "${clip(request.design?.title, 120)}": ${request.action.brief}. Keep the original; write the result into the folder the request names.`;
      break;
    case 'library':
      lead = `${request.action ? `${request.action.label} on` : 'Prototype'} the Congo ${request.item.kind} "${clip(request.item.title, 120)}"${request.item.app ? ` from ${request.item.app}` : ''}. Get its source through the Congo CLI or MCP, adapt it outside the user's project, main screen first, and write one running prototype into the Congo file folder the request names.`;
      break;
    case 'build':
      lead = `Pull into a project: ${request.app ? `apply the prototype "${clip(request.design?.title, 120)}" to the user's project at ${request.app.path}` : `create the user's new project from the prototype "${clip(request.design?.title, 120)}" with congo create`}. This is the only request that changes the user's code. Ask in your chat if the project or page is unclear.`;
      break;
    case 'rebuild':
      lead = `The user finished live-editing the prototype "${clip(request.design?.title, 120)}". Rebuild its preview (${request.design?.dir ?? 'its folder'}) from its source so the card shows the edits, then poll the workspace area (${request.workspace.area}) again.`;
      break;
    case 'start-app':
      lead = `Start the user's app at ${request.app?.path ?? '(ask which app)'} with its own dev command and keep it running. Reply steer_done with its local URL (http://127.0.0.1:PORT/ or http://localhost:PORT/) so the workspace can show it.`;
      break;
    case 'live-edit':
      lead = request.design?.sourceDir
        ? `Turn on Impeccable's live editor for the prototype "${clip(request.design.title, 120)}" whose source is ${request.design.sourceDir}: install its dependencies if needed, start its dev server and keep it running, run Impeccable's live boot in that folder with --allow-missing-context (its live.md, and live-setup.md on first use), reply steer_done with the dev server's local URL, then poll that folder's helper instead of the workspace area. The workspace follows both.`
        : `Turn on Impeccable's live editor for the user's running app at ${request.app?.path ?? '(ask which app)'}: run Impeccable's live boot in that project (its live.md, and live-setup.md on first use), keep the app's dev server running, reply steer_done with the app's local URL, then poll that project's helper instead of the workspace area. The workspace follows both.`;
      break;
    case 'switch-to-area':
      lead = `The user is editing a design in the workspace. Reply steer_done, then run your Impeccable live-poll from the workspace area (${request.workspace.area}) again so its live editor reaches you.`;
      break;
    default:
      lead = 'Handle this workspace request.';
  }
  const message = `Congo workspace request ${request.id} (${request.type}). ${lead} ${where} ${reply}`;
  return message.length > 3900 ? `${message.slice(0, 3899)}…` : message;
}

export function writeRequest(files, request) {
  const file = path.join(files.requests, `${request.id}.json`);
  writeJsonAtomic(file, request);
  return file;
}

/** Folders in designs/ that hold a finished design (design.json plus an entry). */
/**
 * True when a page is only a mount point for a script bundle: its elements
 * exist only after the script runs, so Impeccable's editor has no markup in
 * the file to pick or change.
 */
export function isBundleOnly(html) {
  if (!/<script\b[^>]*\bsrc\s*=/i.test(html)) return false;
  const body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
  const content = body
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|noscript|template|style)\b[\s\S]*?<\/\1>/gi, '');
  const elements = (content.match(/<[a-z][^>]*>/gi) || []).length;
  const text = content.replace(/<[^>]+>/g, '').trim();
  return elements <= 2 && text.length < 40;
}

export function scanDesigns(files) {
  let entries = [];
  try {
    entries = fs.readdirSync(files.designs, { withFileTypes: true });
  } catch {
    return [];
  }
  const found = [];
  for (const entry of entries) {
    if (!entry.isDirectory() || entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
    if (!/^[a-z0-9][a-z0-9-]{0,63}$/i.test(entry.name)) continue;
    const dir = path.join(files.designs, entry.name);
    const meta = readJson(path.join(dir, 'design.json'), null);
    if (!meta || typeof meta.title !== 'string') continue;
    const loopback = typeof meta.url === 'string' && /^http:\/\/(127\.0\.0\.1|localhost):\d+(\/|$)/.test(meta.url);
    const hasIndex = fs.existsSync(path.join(dir, 'index.html'));
    if (!hasIndex && !loopback) continue;
    found.push({ id: entry.name, dir, meta, src: hasIndex ? `/designs/${entry.name}/` : meta.url });
  }
  return found;
}

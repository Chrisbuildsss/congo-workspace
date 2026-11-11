// Workspace actions as requests for the user's own AI. Each request is a JSON
// file in the working area plus one Impeccable `steer` event that points at
// it. The AI writes designs into the folders the request names and replies
// `steer_done`; the workspace turns both into cards and conversation.
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

export const MORE = ['distill', 'typeset', 'animate', 'delight', 'overdrive', 'polish', 'clarify', 'adapt', 'harden', 'critique', 'audit'];

const ALTERNATIVES = 3;

export function newId() {
  return crypto.randomBytes(4).toString('hex');
}

function clip(text, max) {
  const value = String(text ?? '').replace(/\s+/g, ' ').trim();
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

/** What a tweak or More action asks for. */
export function describeAction(key) {
  if (TWEAKS[key]) return { key, ...TWEAKS[key] };
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

export function buildRequest({ type, id = newId(), files, reference, impeccableReference, app, compose, text, design, action, item, attachment }) {
  const count = type === 'compose' ? ALTERNATIVES : ['tweak', 'library'].includes(type) ? 1 : 0;
  const outputs = Array.from({ length: count }, (_, i) => {
    const designId = `${id}-${i + 1}`;
    return { id: designId, dir: path.join(files.designs, designId) };
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
    },
    app: app ? { name: app.name, path: app.path } : null,
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
        }
      : null,
    action: action ? { key: action.key, label: action.label, command: action.command, brief: action.brief, reference: commandRef } : null,
    item: item ?? null,
    outputs,
    designJson: {
      required: ['title'],
      optional: ['summary', 'format (desktop|mobile)', 'url (loopback dev server instead of index.html)', 'source', 'notices'],
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
    case 'compose':
      lead = `Use the live choices workflow for this request: "${clip(request.request, 1500)}"${request.app ? ` (app: ${request.app.name})` : ''}. Write ${request.outputs.length} alternatives as running code into the folders the request names.`;
      break;
    case 'tweak':
      lead = `Make a new design from "${clip(request.design?.title, 120)}": ${request.action.brief}. Keep the original; write the result into the folder the request names.`;
      break;
    case 'library':
      lead = `${request.action ? `${request.action.label} on` : 'Use'} the Congo ${request.item.kind} "${clip(request.item.title, 120)}"${request.item.app ? ` from ${request.item.app}` : ''}. Retrieve its source with the Congo CLI or MCP into the request's sources folder, adapt it outside the user's project, and write the result into the folder the request names.`;
      break;
    case 'build':
      lead = `Build this: apply the design "${clip(request.design?.title, 120)}" to the user's real project${request.app ? ` at ${request.app.path}` : ''}. Ask in your chat if the project or page is unclear.`;
      break;
    case 'start-app':
      lead = `Start the user's app at ${request.app?.path ?? '(ask which app)'} with its own dev command and keep it running. Reply steer_done with its local URL (http://127.0.0.1:PORT/ or http://localhost:PORT/) so the workspace can show it.`;
      break;
    case 'live-edit':
      lead = `Turn on Impeccable's live editor for the user's running app at ${request.app?.path ?? '(ask which app)'}: run Impeccable's live boot in that project (its live.md, and live-setup.md on first use), keep the app's dev server running, reply steer_done with the app's local URL, then poll that project's helper instead of the workspace area. The workspace follows both.`;
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

// The Congo workspace's local server. Two loopback listeners:
//   ui      - the prebuilt workspace app and its token-protected /api
//   content - designs and previews, on a separate origin from the API
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { layout } from './paths.mjs';
import { Store, THEMES, VIEWS, readJson, writeJsonAtomic } from './store.mjs';
import { helperStatus } from './live.mjs';
import { createCatalog } from './catalog.mjs';
import { ensureHelper, findLauncher, followEvents, postSteer, prepareArea, referenceDir } from './impeccable.mjs';
import { helperInfo } from './live.mjs';
import { buildRequest, describeAction, isBundleOnly, newId, normalizeTray, scanDesigns, steerMessage, writeRequest } from './requests.mjs';
import { DevServers, normalizeUrl } from './devserver.mjs';
import { runImpeccable } from './impeccable.mjs';
import { savedItems } from './congo-cli.mjs';
import { appendHistory, createCongoFile, createStub, filesRoot, listCongoFiles, previewDir, removeTree, sourceDirOf as prototypeSource, updatePrototype } from './files.mjs';

export const PROTOCOL = 1;
export const VERSION = '0.1.0';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.txt': 'text/plain; charset=utf-8',
};

const UI_CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https: http://127.0.0.1:* http://localhost:*",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src http://127.0.0.1:* http://localhost:* https:",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

function listen(server, ports) {
  return new Promise((resolve, reject) => {
    const [first, ...rest] = ports;
    if (first === undefined) return reject(new Error('No free local port for the workspace'));
    const onError = (error) => {
      server.off('listening', onListening);
      if (error.code === 'EADDRINUSE' || error.code === 'EACCES') resolve(listen(server, rest));
      else reject(error);
    };
    const onListening = () => {
      server.off('error', onError);
      resolve(server.address().port);
    };
    server.once('error', onError);
    server.once('listening', onListening);
    server.listen(first, '127.0.0.1');
  });
}

function range(start, count) {
  return Array.from({ length: count }, (_, i) => start + i);
}

// Designs send their address only to their own origin (the content port), so
// root-relative assets can be found inside the design that asked for them.
const DESIGN_HEADERS = { 'Referrer-Policy': 'same-origin' };

function send(res, status, body, headers = {}) {
  const payload = typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body);
  res.writeHead(status, {
    'Cache-Control': 'no-store',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    ...(typeof body === 'string' || Buffer.isBuffer(body) ? {} : { 'Content-Type': 'application/json; charset=utf-8' }),
    ...headers,
  });
  res.end(payload);
}

function safeEqual(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

function readBody(req, limit = 256 * 1024) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > limit) {
        reject(Object.assign(new Error('Request too large'), { status: 413 }));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('Invalid JSON'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

// Serve a file inside `base` only; refuse anything that escapes it.
function fileInside(base, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  if (decoded.includes('\0')) return null;
  const resolved = path.resolve(base, '.' + path.posix.normalize('/' + decoded));
  const relative = path.relative(base, resolved);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return resolved;
}

function serveFile(res, file, headers = {}) {
  let stat;
  try {
    stat = fs.statSync(file);
  } catch {
    return false;
  }
  if (!stat.isFile()) return false;
  const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
  send(res, 200, fs.readFileSync(file), { 'Content-Type': type, ...headers });
  return true;
}

// The design folder named by a same-origin Referer (/designs/<id>/...).
function designFromReferer(referer, contentPort) {
  if (!referer) return null;
  let url;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || Number(url.port) !== contentPort) return null;
  const match = /^\/designs\/([^/]+)\//.exec(url.pathname);
  if (!match) return null;
  let id;
  try {
    id = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return /^[A-Za-z0-9._-]+$/.test(id) && !/^\.+$/.test(id) ? id : null;
}

function appName(appPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'));
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name;
  } catch {}
  return path.basename(appPath);
}

export async function startWorkspaceServer({ root, uiDir, port = 4870, contentPort, token, log = () => {}, env = process.env, fetchImpl, runCongo, filesDir, bootHelper = !env.CONGO_WORKSPACE_NO_HELPER }) {
  const files = layout(root);
  for (const dir of [files.area, files.designs, files.requests, files.sources]) fs.mkdirSync(dir, { recursive: true });
  const store = new Store(files.state);
  const catalog = createCatalog({ cacheDir: path.join(root, 'cache'), env, ...(fetchImpl ? { fetchImpl } : {}) });
  const dev = new DevServers({ log });
  const secret = token || crypto.randomBytes(24).toString('base64url');
  let uiPort = 0;
  let servedContentPort = 0;
  let stopping = false;

  const hostAllowed = (req, p) => {
    const host = req.headers.host;
    return host === `127.0.0.1:${p}` || host === `localhost:${p}`;
  };
  const originAllowed = (req, p) => {
    const origin = req.headers.origin;
    return !origin || origin === `http://127.0.0.1:${p}` || origin === `http://localhost:${p}`;
  };

  // Congo files: where prototypes are kept (Documents\Congo unless overridden).
  const congoRoot = filesDir ? path.resolve(filesDir) : filesRoot(env);
  const designDir = (design) => design?.dir ?? path.join(files.designs, design.id);
  const inCongoFiles = (dir) => {
    const relative = path.relative(congoRoot, dir);
    return Boolean(relative) && !relative.startsWith('..') && !path.isAbsolute(relative);
  };
  const activeApp = () => store.get().apps.find((app) => app.id === store.get().activeAppId) || null;
  // The project the AI may be live-editing besides the working area: a
  // prototype's source while the person edits that prototype, else My app.
  const editingDesign = () => {
    const s = store.get();
    const design = s.editTarget ? s.designs[s.editTarget] : null;
    return design?.sourceDir ? design : null;
  };
  const liveTarget = () => {
    const design = editingDesign();
    return design ? { id: `prototype:${design.id}`, path: design.sourceDir, name: design.title } : activeApp();
  };
  const launcher = findLauncher(env);
  const protocolFile = path.resolve(uiDir, '..', '..', '..', 'reference', 'workspace.md');
  const launcherScript = path.resolve(uiDir, '..', '..', 'workspace.mjs');
  const impeccableReference = referenceDir(launcher);
  prepareArea(files.area);

  // Connection: the AI is "listening" while its live-poll is parked on a
  // helper, and stays "connected" for a while between events while it works.
  const CONNECTED_GRACE_MS = 15 * 60 * 1000;
  const live = { area: { running: false, agentPolling: false }, app: { running: false, agentPolling: false }, lastPollAt: 0, lastVia: null, helperError: null };

  async function refreshLive() {
    const app = liveTarget();
    const [area, appHelper] = await Promise.all([
      helperStatus(files.area),
      app ? helperStatus(app.path) : Promise.resolve({ running: false, agentPolling: false }),
    ]);
    live.area = area;
    live.app = appHelper;
    if (area.agentPolling || appHelper.agentPolling) {
      live.lastPollAt = Date.now();
      live.lastVia = area.agentPolling ? 'workspace' : 'app';
    }
  }

  async function status() {
    await refreshLive();
    const app = activeApp();
    const listening = live.area.agentPolling || live.app.agentPolling;
    const anyHelper = live.area.running || live.app.running;
    const connected = listening || (anyHelper && Date.now() - live.lastPollAt < CONNECTED_GRACE_MS);
    const pending = Object.values(store.get().requests).filter((r) => r.status === 'sent').length;
    return {
      protocol: PROTOCOL,
      version: VERSION,
      view: store.get().view,
      contentOrigin: `http://127.0.0.1:${servedContentPort}`,
      ai: {
        connected,
        listening,
        via: listening ? (live.area.agentPolling ? 'workspace' : 'app') : connected ? live.lastVia : null,
        workspaceHelper: live.area.running,
        impeccable: Boolean(launcher),
        pending,
        error: live.helperError,
      },
      app: app ? { ...app, helper: live.app.running } : null,
    };
  }

  function publicState() {
    const s = store.get();
    const requests = Object.values(s.requests)
      .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
      .slice(0, 100)
      .map(({ id, type, status: st, composeId, appId, designId, action, createdAt, outputs, message, summary, doneAt }) => ({
        id, type, status: st, composeId, appId, designId, action, createdAt, outputs, message, summary: summary ?? null, doneAt: doneAt ?? null,
      }));
    return {
      settings: s.settings,
      view: s.view,
      apps: s.apps,
      activeAppId: s.activeAppId,
      composes: s.composes,
      designs: s.designs,
      projects: s.projects,
      requests,
      tray: s.tray,
      filesRoot: congoRoot,
    };
  }

  // The account's Saved items, through the person's own Congo CLI. Cached
  // briefly: the Library asks each time the Saved filter opens.
  let savedCache = null;
  async function saved(refresh = false) {
    if (!refresh && savedCache && Date.now() - savedCache.at < 60_000) return savedCache.value;
    const value = await savedItems({ env, ...(runCongo ? { run: runCongo } : {}) });
    savedCache = { at: Date.now(), value };
    return value;
  }

  // --- requests to the user's AI ------------------------------------------

  async function helperForRequests() {
    try {
      const info = await ensureHelper(files.area, launcher, root);
      live.helperError = null;
      return info;
    } catch (error) {
      live.helperError = error.message;
      throw error;
    }
  }

  function composeOf(s, designId) {
    return s.composes.find((c) => c.designIds.includes(designId)) ?? null;
  }

  function newCompose(s, title, appId) {
    const compose = {
      id: newId(),
      title: title.slice(0, 80) || 'New design',
      prompt: '',
      status: 'draft',
      designIds: [],
      messages: [],
      appId: appId ?? s.activeAppId ?? null,
      createdAt: new Date().toISOString(),
    };
    s.composes.unshift(compose);
    return compose;
  }

  function saveAttachment(id, attachment) {
    if (!attachment) return null;
    const match = /^data:(image\/(png|jpeg|webp|gif));base64,([A-Za-z0-9+/=]+)$/.exec(attachment.dataUrl ?? '');
    if (!match) throw Object.assign(new Error('Attach a PNG, JPEG, WebP or GIF image'), { status: 400 });
    const ext = match[2] === 'jpeg' ? 'jpg' : match[2];
    const file = path.join(files.requests, `${id}-reference.${ext}`);
    fs.writeFileSync(file, Buffer.from(match[3], 'base64'));
    return { file, name: String(attachment.name ?? `reference.${ext}`).slice(0, 120) };
  }

  async function createRequest(body) {
    const type = body.type;
    if (!['send', 'compose', 'tweak', 'expand', 'build', 'library', 'start-app', 'live-edit', 'rebuild', 'switch-to-area'].includes(type)) throw Object.assign(new Error('Unknown request'), { status: 400 });
    const standalone = ['start-app', 'live-edit', 'rebuild', 'switch-to-area'].includes(type);
    const id = newId();
    const s = store.get();
    let compose = null;
    let design = null;
    let action = null;
    let item = null;
    let items = null;
    let text = null;
    let userText = '';

    if (type === 'send') {
      // Library items and notes for the person's own AI to build from: into
      // the chosen app (appId) or, with none, as a new app.
      ({ items } = normalizeTray({ items: body.items }));
      text = String(body.note ?? body.text ?? '').trim().slice(0, 4000) || null;
      if (!items.length && !text && !body.attachment) {
        throw Object.assign(new Error('Select something in Explore or describe what you want'), { status: 400 });
      }
      if (body.appId != null && !s.apps.some((a) => a.id === body.appId)) {
        throw Object.assign(new Error('That app is no longer attached'), { status: 404 });
      }
      const titles = items.slice(0, 3).map((i) => i.title).join(', ');
      userText = items.length ? `${titles}${items.length > 3 ? ` and ${items.length - 3} more` : ''}${text ? `: ${text}` : ''}` : text ?? 'Use the attached image';
    } else if ((type === 'live-edit' || type === 'rebuild') && body.designId) {
      // Live editing a prototype's source, and rebuilding it afterwards.
      design = s.designs[body.designId];
      if (!design?.local || !design.sourceDir) throw Object.assign(new Error('This prototype has no source to edit'), { status: 404 });
    } else if (type === 'rebuild') {
      throw Object.assign(new Error('Name the prototype to rebuild'), { status: 400 });
    } else if (type === 'compose') {
      compose = s.composes.find((c) => c.id === body.composeId);
      if (!compose) throw Object.assign(new Error('Compose not found'), { status: 404 });
      text = String(body.text ?? '').trim().slice(0, 4000);
      if (!text && !body.attachment) throw Object.assign(new Error('Describe what you want first'), { status: 400 });
      userText = text || 'Use the attached image';
    } else if (type === 'tweak' || type === 'build' || type === 'expand') {
      design = s.designs[body.designId];
      if (!design || !design.local) throw Object.assign(new Error('Prototype not found in this workspace'), { status: 404 });
      if (type === 'tweak') {
        action = describeAction(String(body.action ?? ''));
        if (!action) throw Object.assign(new Error('Unknown action'), { status: 400 });
        userText = `${action.label}: ${design.title}`;
      } else if (type === 'expand') {
        if (!design.sourceDir) throw Object.assign(new Error('This prototype is a single page; there is nothing more to build out'), { status: 409 });
        userText = `Expand: ${design.title}`;
      } else {
        // Pull into a project: the app named here, or a new one when null.
        if (body.appId != null && !s.apps.some((a) => a.id === body.appId)) {
          throw Object.assign(new Error('That project is no longer attached'), { status: 404 });
        }
        const into = s.apps.find((a) => a.id === body.appId);
        userText = `Pull into ${into ? into.name : 'a new project'}: ${design.title}`;
      }
      compose = s.composes.find((c) => c.id === body.composeId) ?? composeOf(s, design.id);
    } else if (type === 'library') {
      const raw = body.item ?? {};
      if (!['screen', 'template', 'app'].includes(raw.kind) || typeof raw.id !== 'string') {
        throw Object.assign(new Error('Unknown library item'), { status: 400 });
      }
      item = {
        kind: raw.kind,
        id: raw.id.slice(0, 200),
        version: typeof raw.version === 'string' ? raw.version.slice(0, 200) : null,
        app: typeof raw.app === 'string' ? raw.app.slice(0, 120) : null,
        title: String(raw.title ?? raw.id).slice(0, 200),
        preview: typeof raw.preview === 'string' && /^https:\/\//.test(raw.preview) ? raw.preview : null,
      };
      if (body.action && body.action !== 'use') {
        action = describeAction(String(body.action));
        if (!action) throw Object.assign(new Error('Unknown action'), { status: 400 });
      }
      userText = `${action ? action.label : 'Use this'}: ${item.title}${item.app ? ` (${item.app})` : ''}`;
    } else if (type !== 'switch-to-area') {
      const app = s.apps.find((a) => a.id === body.appId) ?? activeApp();
      if (!app) throw Object.assign(new Error('Attach your app first'), { status: 409 });
      body.appId = app.id;
    }

    // Steers go to the helper the AI is polling: the workspace area's, or
    // the app's while it live-edits the running app.
    await refreshLive();
    const appForHelper = liveTarget();
    // While a prototype is being edited the AI polls its source's helper, so
    // requests (the rebuild among them) go there as long as that helper runs.
    const info = (editingDesign() && live.app.running) || (live.app.agentPolling && !live.area.agentPolling && appForHelper)
      ? helperInfo(appForHelper.path)
      : await helperForRequests();
    const attachment = saveAttachment(id, body.attachment);

    const result = store.update((state) => {
      if (standalone) {
        const app = design ? null : state.apps.find((a) => a.id === body.appId) ?? null;
        const request = buildRequest({
          type, id, files, reference: protocolFile, impeccableReference, app,
          design: design ? { ...design, dir: designDir(design), entry: path.join(previewDir(designDir(design)), 'index.html') } : null,
        });
        state.requests[id] = {
          id, type, status: 'sent', composeId: null, designId: design?.id ?? null, action: null, item: null,
          appId: app?.id ?? null, outputs: [], createdAt: request.createdAt, message: null, summary: null,
        };
        if (type === 'live-edit' && design) state.editTarget = design.id;
        return { request, compose: null };
      }
      let target = compose ? state.composes.find((c) => c.id === compose.id) : null;
      if (!target) target = newCompose(state, type === 'library' ? item.title : userText, body.appId);
      // Send takes what the tray held; the tray starts empty again.
      if (type === 'send' && body.fromTray) state.tray = { items: [], note: '' };
      if (type === 'compose' && (target.title === 'New design' || !target.title)) target.title = text.split(/[.!?\n]/)[0].slice(0, 60) || 'New design';
      if (type !== 'build' && type !== 'expand' && (body.appId === null || state.apps.some((a) => a.id === body.appId))) target.appId = body.appId;
      target.messages.push({ id: `m-${id}`, role: 'user', text: userText, at: new Date().toISOString(), requestId: id });
      if (type === 'compose') target.prompt = text;
      target.status = 'waiting';
      // Pull into a project names its own destination; everything else is for the thread's app.
      const app = type === 'build'
        ? state.apps.find((a) => a.id === body.appId) ?? null
        : state.apps.find((a) => a.id === target.appId) ?? null;
      // New prototypes go into a Congo file: the original's for a quick action,
      // else this request thread's (created on its first request).
      let outDir = null;
      if (['send', 'compose', 'library', 'tweak'].includes(type)) {
        if (type === 'tweak' && design?.dir && inCongoFiles(design.dir)) outDir = path.dirname(design.dir);
        else {
          // Named from the person's words (their note), else what they picked; short,
          // so it reads well as a folder and stays clear of path-length limits.
          const name = (text || item?.title || items?.map((i) => i.title).join(', ') || target.title).split(/[.!?\n]/)[0];
          if (!target.fileDir || !fs.existsSync(target.fileDir)) target.fileDir = createCongoFile(congoRoot, name);
          outDir = target.fileDir;
        }
      }
      const request = buildRequest({
        type,
        id,
        files,
        outDir,
        filesRoot: congoRoot,
        helper: launcherScript,
        reference: protocolFile,
        impeccableReference,
        app,
        compose: target,
        text,
        attachment,
        design: design ? { ...design, dir: design.local ? designDir(design) : null, entry: design.local ? path.join(previewDir(designDir(design)), 'index.html') : null } : null,
        action,
        item,
        items,
      });
      state.requests[id] = {
        id,
        type,
        status: 'sent',
        composeId: target.id,
        designId: design?.id ?? null,
        action: action?.key ?? (type === 'library' ? 'use' : null),
        item,
        outputs: request.outputs.map((o) => o.id),
        createdAt: request.createdAt,
        message: null,
        summary: userText.slice(0, 300),
      };
      return { request, compose: target };
    });
    // The card appears right away: a placeholder in the Congo file, "adapting".
    for (const output of result.request.outputs) {
      createStub(output.dir, {
        title: type === 'tweak' ? `${design.title} · ${action.label}` : (item?.title ?? text ?? userText).split(/[.!?\n]/)[0].slice(0, 80) || 'New prototype',
        request: id,
        kind: type === 'tweak' && action?.key && ['critique', 'audit'].includes(action.command ?? '') ? 'review' : 'prototype',
        parent: design?.id ?? null,
      });
    }
    if (type === 'expand' && design?.dir) {
      updatePrototype(design.dir, { status: 'expanding' });
      appendHistory(design.dir, { type: 'expand-requested', request: id });
    }
    if (type === 'build' && design?.dir) appendHistory(design.dir, { type: 'pull-requested', request: id, into: result.request.app?.path ?? 'a new project' });
    await registerDesigns().catch(() => {});
    const file = writeRequest(files, result.request);
    try {
      await postSteer(info, { id, message: steerMessage(result.request, file) });
    } catch (error) {
      store.update((state) => {
        state.requests[id].status = 'error';
        state.requests[id].message = error.message;
        const target = result.compose ? state.composes.find((c) => c.id === result.compose.id) : null;
        if (target) target.status = 'complete';
      });
      throw error;
    }
    return { request: store.get().requests[id], composeId: result.compose?.id ?? null };
  }

  function settleCompose(state, composeId) {
    const target = state.composes.find((c) => c.id === composeId);
    if (!target) return;
    const open = Object.values(state.requests).some((r) => r.composeId === composeId && r.status === 'sent');
    target.status = open ? 'waiting' : 'complete';
  }

  function onHelperEvent(event) {
    if (event.type === 'agent_polling') {
      if (event.connected) live.lastPollAt = Date.now();
      return;
    }
    if (!['steer_done', 'error'].includes(event.type) || !event.id) return;
    const request = store.get().requests[event.id];
    if (!request || request.status !== 'sent') return;
    store.update((state) => {
      const r = state.requests[event.id];
      r.status = event.type === 'error' ? 'error' : 'done';
      r.message = typeof event.message === 'string' ? event.message.slice(0, 2000) : null;
      r.doneAt = new Date().toISOString();
      const target = state.composes.find((c) => c.id === r.composeId);
      if (target) {
        const text = event.type === 'error'
          ? `Your AI could not finish this: ${r.message ?? 'no reason given'}`
          : r.message || 'Done.';
        target.messages.push({ id: `a-${r.id}`, role: 'assistant', text, at: r.doneAt, requestId: r.id });
      }
      if (r.composeId) settleCompose(state, r.composeId);
    });
    live.lastPollAt = Date.now();
    // "Ask my AI to start it" / live editing: the reply carries the app's URL.
    const done = store.get().requests[event.id];
    // Settle prototype placeholders: a failed request must not adapt forever,
    // and an Expand that failed goes back to its main-screen state.
    for (const outputId of done.outputs ?? []) {
      const output = store.get().designs[outputId];
      if (output?.dir && ['adapting'].includes(output.status)) {
        if (done.status === 'error') updatePrototype(output.dir, { status: 'error', error: done.message ?? 'Your AI could not finish this' });
        else if (fs.existsSync(path.join(previewDir(output.dir), 'index.html'))) updatePrototype(output.dir, { status: 'ready' });
        else updatePrototype(output.dir, { status: 'error', error: 'Your AI replied without a preview' });
      }
    }
    if (done.type === 'expand' && done.designId) {
      const target = store.get().designs[done.designId];
      if (target?.dir && target.status === 'expanding') updatePrototype(target.dir, { status: done.status === 'error' ? 'main' : 'ready' });
    }
    if (done.designId && store.get().designs[done.designId]?.dir) {
      appendHistory(store.get().designs[done.designId].dir, { type: `${done.type}-${done.status}`, request: done.id, message: done.message ?? null });
    }
    registerDesigns().catch(() => {});
    if (done.type === 'rebuild' && done.designId) {
      // Rebuilt: the AI is back on the working area; stop following the source.
      store.update((state) => { if (state.editTarget === done.designId) state.editTarget = null; });
      return;
    }
    if (done.type === 'live-edit' && done.designId) {
      // A prototype's live edit: show its dev server while the person edits.
      const match = done.status === 'done' && done.message ? /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}[^\s"')]*/i.exec(done.message) : null;
      store.update((state) => {
        const design = state.designs[done.designId];
        if (design && match) design.editUrl = normalizeUrl(match[0]);
        if (!match && state.editTarget === done.designId) state.editTarget = null;
      });
      return;
    }
    if (done.status === 'done' && ['start-app', 'live-edit'].includes(done.type) && done.message) {
      const match = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}[^\s"')]*/i.exec(done.message);
      const app = store.get().apps.find((a) => a.id === done.appId);
      if (match && app) dev.attachUrl(app, match[0], 'ai');
    }
  }

  // Whole-app prototypes (design.json "root": true) are served at the root of
  // their own local address, so the app's routes and root-relative assets work
  // as they do in the real app. One small listener per prototype.
  const rootServers = new Map();

  function rootHandler(designId) {
    return (req, res) => {
      try {
        const entry = rootServers.get(designId);
        if (!entry || !hostAllowed(req, entry.port)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
        if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
        const design = store.get().designs[designId];
        const base = design ? previewDir(designDir(design)) : path.join(files.designs, designId);
        const url = new URL(req.url, `http://127.0.0.1:${entry.port}`);
        let file = fileInside(base, url.pathname);
        if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        // An app route (no file extension) gets the app's page, as its own server would.
        if ((!file || !fs.existsSync(file)) && !path.extname(url.pathname)) file = path.join(base, 'index.html');
        if (file && path.extname(file).toLowerCase() === '.html' && fs.existsSync(file)) {
          let html = fs.readFileSync(file, 'utf8');
          if (url.searchParams.get('edit') !== '1') html = html.replace(/<!-- impeccable-live-start -->[\s\S]*?<!-- impeccable-live-end -->\s*/g, '');
          return send(res, 200, html, { 'Content-Type': MIME['.html'], ...DESIGN_HEADERS });
        }
        if (file && serveFile(res, file, DESIGN_HEADERS)) return undefined;
        return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
      } catch (error) {
        log(`prototype ${designId}: ${error.stack || error}`);
        return send(res, 500, 'Workspace error', { 'Content-Type': 'text/plain' });
      }
    };
  }

  async function ensureRootServer(designId) {
    const known = rootServers.get(designId);
    if (known) return known.ready;
    const server = http.createServer(rootHandler(designId));
    const used = new Set([uiPort, servedContentPort, ...[...rootServers.values()].map((e) => e.port)]);
    const entry = { server, port: 0, ready: null };
    rootServers.set(designId, entry);
    entry.ready = listen(server, range(servedContentPort + 1, 400).filter((p) => !used.has(p)))
      .then((p) => { entry.port = p; return p; })
      .catch((error) => { rootServers.delete(designId); throw error; });
    return entry.ready;
  }

  function closeRootServer(designId) {
    const entry = rootServers.get(designId);
    if (!entry) return;
    rootServers.delete(designId);
    entry.server.close();
    entry.server.closeAllConnections?.();
  }

  function sourceDirOf(meta, dir) {
    if (dir) return prototypeSource(dir, meta);
    if (typeof meta.sourceDir !== 'string' || !path.isAbsolute(meta.sourceDir)) return undefined;
    try {
      return fs.statSync(meta.sourceDir).isDirectory() ? path.resolve(meta.sourceDir) : undefined;
    } catch {
      return undefined;
    }
  }

  /** Prototypes in Congo files, in the shape the older working-area scan returns. */
  function scanCongoFiles() {
    const found = [];
    for (const file of listCongoFiles(congoRoot)) {
      for (const p of file.prototypes) {
        const preview = previewDir(p.dir);
        const hasPreview = fs.existsSync(path.join(preview, 'index.html'));
        const loopback = typeof p.meta.url === 'string' && /^http:\/\/(127\.0\.0\.1|localhost):\d+(\/|$)/.test(p.meta.url);
        const status = ['adapting', 'main', 'expanding', 'ready', 'error'].includes(p.meta.status) ? p.meta.status : hasPreview || loopback ? 'ready' : 'adapting';
        found.push({
          id: p.id, dir: p.dir, meta: p.meta, congo: true, file: file.dir, fileTitle: file.title, brief: p.brief,
          hasPreview, status: hasPreview || loopback || status === 'error' ? status : 'adapting',
          src: hasPreview ? `/designs/${p.id}/` : loopback ? p.meta.url : undefined,
        });
      }
    }
    return found;
  }

  let scanning = false;
  async function registerDesigns() {
    if (scanning) return;
    scanning = true;
    try {
      await scanOnce();
    } finally {
      scanning = false;
    }
  }

  async function scanOnce() {
    const congo = scanCongoFiles();
    const congoIds = new Set(congo.map((d) => d.id));
    const found = [...congo, ...scanDesigns(files).filter((d) => !congoIds.has(d.id))];
    for (const d of found) {
      const whole = d.meta.root === true || (d.congo && Boolean(sourceDirOf(d.meta, d.dir)));
      const hasIndex = d.congo ? d.hasPreview : fs.existsSync(path.join(d.dir, 'index.html'));
      d.root = whole && hasIndex;
      if (d.root) d.src = `http://127.0.0.1:${await ensureRootServer(d.id)}/`;
      d.source = sourceDirOf(d.meta, d.congo ? d.dir : null);
      d.built = typeof d.meta.builtAt === 'string' ? d.meta.builtAt : undefined;
    }
    const s = store.get();
    const foundIds = new Set(found.map((d) => d.id));
    // A Congo file that was moved, renamed or deleted takes its cards with it.
    const gone = Object.values(s.designs).filter((d) => d.local && d.dir && !foundIds.has(d.id));
    const fresh = found.filter((d) => {
      const known = s.designs[d.id];
      return !known || known.title !== d.meta.title || known.summary !== (d.meta.summary ?? undefined) || known.src !== d.src
        || known.sourceDir !== d.source || Boolean(known.root) !== d.root || known.status !== (d.status ?? undefined)
        || known.dir !== (d.congo ? d.dir : undefined) || known.builtAt !== d.built
        || JSON.stringify(known.brief ?? null) !== JSON.stringify(d.brief ?? null) || known.error !== (d.meta.error ?? undefined);
    });
    if (!fresh.length && !gone.length) return;
    for (const d of gone) closeRootServer(d.id);
    store.update((state) => {
      for (const d of gone) {
        delete state.designs[d.id];
        for (const c of state.composes) c.designIds = c.designIds.filter((id) => id !== d.id);
      }
      for (const d of fresh) {
        const requestId = typeof d.meta.request === 'string' ? d.meta.request : d.id.split('-')[0];
        const request = state.requests[requestId] ?? null;
        const parent = request?.designId ? state.designs[request.designId] : null;
        const existing = state.designs[d.id];
        state.designs[d.id] = {
          ...(existing ?? {}),
          id: d.id,
          local: true,
          title: d.meta.title.slice(0, 120),
          summary: typeof d.meta.summary === 'string' ? d.meta.summary.slice(0, 400) : undefined,
          format: d.meta.format === 'mobile' ? 'mobile' : 'desktop',
          src: d.src,
          root: d.root || undefined,
          sourceDir: d.source,
          dir: d.congo ? d.dir : undefined,
          file: d.congo ? d.fileTitle : undefined,
          status: d.status ?? undefined,
          error: typeof d.meta.error === 'string' ? d.meta.error.slice(0, 300) : undefined,
          brief: d.brief ?? undefined,
          builtAt: d.built,
          requestId: request ? requestId : null,
          parentId: parent?.id ?? existing?.parentId,
          action: request?.action ?? existing?.action,
          source: d.meta.source ?? (request?.item ? { kind: request.item.kind, id: request.item.id, version: request.item.version ?? undefined, app: request.item.app ?? undefined } : existing?.source),
          appId: existing?.appId ?? (request ? state.composes.find((c) => c.id === request.composeId)?.appId ?? null : null),
          createdAt: existing?.createdAt ?? new Date().toISOString(),
        };
        if (!existing && request) {
          const target = state.composes.find((c) => c.id === request.composeId);
          if (target && !target.designIds.includes(d.id)) target.designIds.push(d.id);
        }
      }
    });
  }

  function attachApp(appPath) {
    if (typeof appPath !== 'string' || !appPath.trim()) throw Object.assign(new Error('Missing project folder'), { status: 400 });
    const resolved = path.resolve(appPath);
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isDirectory()) {
      throw Object.assign(new Error('Project folder not found'), { status: 404 });
    }
    return store.update((s) => {
      let app = s.apps.find((a) => path.resolve(a.path) === resolved);
      if (!app) {
        app = { id: crypto.randomBytes(4).toString('hex'), path: resolved, name: appName(resolved), addedAt: new Date().toISOString() };
        s.apps.push(app);
      }
      s.activeAppId = app.id;
      return app;
    });
  }

  async function api(req, res, url) {
    if (url.pathname === '/api/ping' && req.method === 'GET') {
      return send(res, 200, { service: 'congo-workspace', protocol: PROTOCOL, version: VERSION });
    }
    const auth = req.headers.authorization || '';
    if (!auth.startsWith('Bearer ') || !safeEqual(auth.slice(7), secret)) {
      return send(res, 401, { error: 'Unauthorized' });
    }
    if (req.method === 'GET' && url.pathname === '/api/status') return send(res, 200, await status());
    if (req.method === 'GET' && url.pathname === '/api/state') return send(res, 200, publicState());
    if (req.method === 'GET' && url.pathname === '/api/library/apps') return send(res, 200, await catalog.apps());
    if (req.method === 'GET' && url.pathname === '/api/library/categories') return send(res, 200, await catalog.categories());
    if (req.method === 'GET' && url.pathname === '/api/library/screens') {
      return send(res, 200, await catalog.screens(Object.fromEntries(url.searchParams)));
    }
    if (req.method === 'GET' && url.pathname === '/api/library/saved') {
      return send(res, 200, await saved(url.searchParams.get('refresh') === '1'));
    }
    if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });
    const body = await readBody(req, url.pathname === '/api/requests' ? 12 * 1024 * 1024 : 256 * 1024);
    switch (url.pathname) {
      case '/api/settings': {
        if (!THEMES.includes(body.theme)) return send(res, 400, { error: 'Choose system, light or dark' });
        store.update((s) => { s.settings = { ...s.settings, theme: body.theme }; });
        return send(res, 200, publicState());
      }
      case '/api/view': {
        if (!VIEWS.includes(body.view)) return send(res, 400, { error: 'Unknown view' });
        store.update((s) => { s.view = body.view; });
        return send(res, 200, { ok: true });
      }
      case '/api/requests': {
        const created = await createRequest(body);
        return send(res, 200, { ...created, state: publicState() });
      }
      case '/api/tray': {
        const tray = normalizeTray(body);
        store.update((s) => { s.tray = tray; });
        return send(res, 200, { tray });
      }
      case '/api/projects': {
        const name = String(body.name ?? '').trim().slice(0, 80);
        if (!name) return send(res, 400, { error: 'Name the project' });
        const project = store.update((s) => {
          const appId = s.apps.some((a) => a.id === body.appId) ? body.appId : null;
          const created = { id: newId(), name, designIds: [], appId, createdAt: new Date().toISOString() };
          s.projects.unshift(created);
          return created;
        });
        return send(res, 200, { project, state: publicState() });
      }
      case '/api/projects/update': {
        const name = String(body.name ?? '').trim().slice(0, 80);
        const found = store.update((s) => {
          const project = s.projects.find((p) => p.id === body.id);
          if (!project) return null;
          if (name) project.name = name;
          if (body.appId === null || s.apps.some((a) => a.id === body.appId)) project.appId = body.appId;
          return project;
        });
        if (!found) return send(res, 404, { error: 'Project not found' });
        return send(res, 200, { project: found, state: publicState() });
      }
      case '/api/projects/delete': {
        // Removes the project and its grouping. Designs stay where else they
        // live (their compose); library copies only this project held are dropped.
        store.update((s) => {
          const project = s.projects.find((p) => p.id === body.id);
          if (!project) return;
          s.projects = s.projects.filter((p) => p.id !== body.id);
          const elsewhere = new Set([...s.projects.flatMap((p) => p.designIds), ...s.composes.flatMap((c) => c.designIds)]);
          for (const id of project.designIds) {
            if (!elsewhere.has(id) && s.designs[id] && !s.designs[id].local) delete s.designs[id];
          }
        });
        return send(res, 200, publicState());
      }
      case '/api/projects/save': {
        // Save a design (Compose card or Library item) into a project,
        // creating the project when a new name is given.
        const incoming = body.design ?? {};
        const known = store.get().designs[incoming.id];
        if (!known && !(typeof incoming.id === 'string' && /^(screen|app):/.test(incoming.id))) {
          return send(res, 404, { error: 'Design not found' });
        }
        const result = store.update((s) => {
          let project = s.projects.find((p) => p.id === body.projectId);
          if (!project) {
            const name = String(body.newProjectName ?? '').trim().slice(0, 80);
            if (!name) return null;
            const appId = s.apps.some((a) => a.id === body.appId) ? body.appId : null;
            project = { id: newId(), name, designIds: [], appId, createdAt: new Date().toISOString() };
            s.projects.unshift(project);
          }
          if (!s.designs[incoming.id]) {
            // A library item: keep what the card shows, never source.
            s.designs[incoming.id] = {
              id: incoming.id,
              local: false,
              title: String(incoming.title ?? incoming.id).slice(0, 120),
              author: typeof incoming.author === 'string' ? incoming.author.slice(0, 120) : undefined,
              format: incoming.format === 'mobile' ? 'mobile' : 'desktop',
              image: typeof incoming.image === 'string' && /^https:\/\//.test(incoming.image) ? incoming.image : undefined,
              previewUrl: typeof incoming.previewUrl === 'string' && /^https:\/\//.test(incoming.previewUrl) ? incoming.previewUrl : null,
              source: incoming.source && typeof incoming.source.id === 'string'
                ? { kind: incoming.source.kind, id: incoming.source.id.slice(0, 200), version: incoming.source.version, app: incoming.source.app }
                : undefined,
              createdAt: new Date().toISOString(),
            };
          }
          if (!project.designIds.includes(incoming.id)) project.designIds.push(incoming.id);
          return project;
        });
        if (!result) return send(res, 400, { error: 'Choose a project or name a new one' });
        return send(res, 200, { project: result, state: publicState() });
      }
      case '/api/projects/remove': {
        store.update((s) => {
          const project = s.projects.find((p) => p.id === body.projectId);
          if (!project) return;
          project.designIds = project.designIds.filter((id) => id !== body.designId);
          const elsewhere = new Set([...s.projects.flatMap((p) => p.designIds), ...s.composes.flatMap((c) => c.designIds)]);
          const design = s.designs[body.designId];
          if (design && !design.local && !elsewhere.has(design.id)) delete s.designs[design.id];
        });
        return send(res, 200, publicState());
      }
      case '/api/designs/rename': {
        // Rename a prototype: its card and its metadata, so a rescan keeps it.
        const design = store.get().designs[body.id];
        const title = String(body.title ?? '').replace(/\s+/g, ' ').trim().slice(0, 120);
        if (!design?.local) return send(res, 404, { error: 'Prototype not found' });
        if (!title) return send(res, 400, { error: 'Name the prototype' });
        if (design.dir) {
          updatePrototype(design.dir, { title });
          appendHistory(design.dir, { type: 'renamed', title });
        }
        const metaFile = path.join(files.designs, design.id, 'design.json');
        const meta = design.dir ? null : readJson(metaFile, null);
        if (meta) writeJsonAtomic(metaFile, { ...meta, title });
        store.update((s) => { if (s.designs[design.id]) s.designs[design.id].title = title; });
        return send(res, 200, publicState());
      }
      case '/api/designs/delete': {
        const design = store.get().designs[body.id];
        if (!design) return send(res, 404, { error: 'Design not found' });
        if (design.local && design.dir && inCongoFiles(design.dir)) {
          // In a Congo file: the prototype's own folder goes, source included.
          closeRootServer(design.id);
          removeTree(design.dir);
        } else if (design.local && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(design.id)) {
          closeRootServer(design.id);
          const dir = path.join(files.designs, design.id);
          if (path.dirname(dir) === files.designs) fs.rmSync(dir, { recursive: true, force: true });
          // A prototype's own source copy in the working area goes with it.
          if (design.sourceDir) {
            const relative = path.relative(files.sources, design.sourceDir);
            const shared = Object.values(store.get().designs).some((d) => d.id !== design.id && d.sourceDir === design.sourceDir);
            if (!shared && relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
              fs.rmSync(design.sourceDir, { recursive: true, force: true });
            }
          }
        }
        store.update((s) => {
          if (s.editTarget === design.id) s.editTarget = null;
          delete s.designs[design.id];
          for (const c of s.composes) c.designIds = c.designIds.filter((id) => id !== design.id);
          for (const p of s.projects) p.designIds = p.designIds.filter((id) => id !== design.id);
        });
        return send(res, 200, publicState());
      }
      case '/api/live': {
        const app = store.get().apps.find((a) => a.id === body.appId) ?? activeApp();
        if (!app) return send(res, 200, { app: null });
        return send(res, 200, { app, ...dev.status(app) });
      }
      case '/api/live/start': {
        const app = store.get().apps.find((a) => a.id === body.appId) ?? activeApp();
        if (!app) return send(res, 409, { error: 'Attach your app first' });
        return send(res, 200, { app, ...dev.start(app) });
      }
      case '/api/live/stop': {
        const app = store.get().apps.find((a) => a.id === body.appId) ?? activeApp();
        if (!app) return send(res, 409, { error: 'Attach your app first' });
        return send(res, 200, { app, ...dev.stop(app) });
      }
      case '/api/live/url': {
        const app = store.get().apps.find((a) => a.id === body.appId) ?? activeApp();
        if (!app) return send(res, 409, { error: 'Attach your app first' });
        if (!/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\]):\d{2,5}(\/|$)/i.test(String(body.url ?? ''))) {
          return send(res, 400, { error: "Use your app's local address, like http://localhost:5173" });
        }
        dev.attachUrl(app, normalizeUrl(body.url), 'user');
        return send(res, 200, { app, ...dev.status(app) });
      }
      case '/api/edit/stop': {
        // The person finished editing. A prototype edited through its source
        // is rebuilt so its card and full-size view show the accepted changes.
        const design = store.get().designs[body.designId];
        const wasEditing = store.get().editTarget === body.designId;
        let rebuild = null;
        if (design?.sourceDir && wasEditing && body.rebuild !== false) {
          // Sent while the edit target is still set, so it reaches the helper
          // the AI is polling; the target clears when the rebuild is answered.
          rebuild = (await createRequest({ type: 'rebuild', designId: design.id })).request.id;
        }
        store.update((s) => {
          if (s.editTarget === body.designId && !rebuild) s.editTarget = null;
          if (s.designs[body.designId]) delete s.designs[body.designId].editUrl;
        });
        return send(res, 200, { rebuild, state: publicState() });
      }
      case '/api/edit': {
        // Edit a design with Impeccable's live editor: Impeccable injects its
        // own script into the working area's pages; the frame loads ?edit=1.
        const design = store.get().designs[body.designId];
        if (!design?.local) return send(res, 404, { error: 'Only designs in this workspace can be edited' });
        if (design.sourceDir) {
          // A whole-app prototype: its built page is a script bundle, so the AI
          // runs the prototype's source on its dev server with Impeccable's
          // editor, the way My app is edited.
          if (design.editUrl && store.get().editTarget === design.id) return send(res, 200, { mode: 'app', url: design.editUrl, requestId: null });
          const created = await createRequest({ type: 'live-edit', designId: design.id });
          return send(res, 200, { mode: 'app', url: null, requestId: created.request.id, state: publicState() });
        }
        let page = '';
        try {
          page = fs.readFileSync(path.join(previewDir(designDir(design)), 'index.html'), 'utf8');
        } catch {}
        if (page && isBundleOnly(page)) {
          return send(res, 200, { editable: false, reason: 'This design is a built app, so Impeccable has nothing in its page to select. Make editable asks your AI for a static copy that looks the same.' });
        }
        const info = await helperForRequests();
        const { output } = await runImpeccable(launcher, ['live-inject', '--port', String(info.port)], {
          cwd: files.area,
          outFile: path.join(root, 'impeccable-inject.json'),
        });
        const injected = /"ok"\s*:\s*true/.test(output);
        if (!injected) return send(res, 502, { error: 'Impeccable could not add its editor to this design' });
        await refreshLive();
        let switched = null;
        if (live.app.agentPolling && !live.area.agentPolling) {
          switched = (await createRequest({ type: 'switch-to-area' })).request.id;
        }
        return send(res, 200, { url: `${design.src}?edit=1`, switched, listening: live.area.agentPolling });
      }
      case '/api/connect': {
        // Used by the Congo skill: make sure the helper runs, attach the
        // app if given, and tell the AI where to poll.
        if (typeof body.project === 'string' && body.project) attachApp(body.project);
        const info = await helperForRequests();
        return send(res, 200, {
          area: files.area,
          protocol: protocolFile,
          helper: { port: info.port },
          poll: {
            cwd: files.area,
            args: ['live-poll'],
            // The Impeccable launcher this workspace runs (sh, and the Windows twin).
            launcher: launcher ? path.join(path.dirname(launcher), 'impeccable') : null,
            windowsLauncher: launcher ? path.join(path.dirname(launcher), 'impeccable.cmd') : null,
          },
          app: activeApp(),
        });
      }
      case '/api/apps': {
        const app = attachApp(body.path);
        return send(res, 200, { app, state: publicState() });
      }
      case '/api/composes': {
        const compose = store.update((s) => {
          const appId = s.apps.some((a) => a.id === body.appId) ? body.appId : s.activeAppId;
          const created = {
            id: crypto.randomBytes(4).toString('hex'),
            title: typeof body.title === 'string' && body.title.trim() ? body.title.trim().slice(0, 80) : 'New design',
            prompt: '',
            status: 'draft',
            designIds: [],
            messages: [],
            appId: appId ?? null,
            createdAt: new Date().toISOString(),
          };
          s.composes.unshift(created);
          return created;
        });
        return send(res, 200, { compose, state: publicState() });
      }
      case '/api/composes/update': {
        const found = store.update((s) => {
          const compose = s.composes.find((c) => c.id === body.id);
          if (!compose) return null;
          if (typeof body.title === 'string' && body.title.trim()) compose.title = body.title.trim().slice(0, 80);
          if (body.appId === null || s.apps.some((a) => a.id === body.appId)) compose.appId = body.appId;
          return compose;
        });
        if (!found) return send(res, 404, { error: 'Compose not found' });
        return send(res, 200, { compose: found, state: publicState() });
      }
      case '/api/composes/delete': {
        store.update((s) => {
          const compose = s.composes.find((c) => c.id === body.id);
          if (!compose) return;
          const saved = new Set(s.projects.flatMap((p) => p.designIds));
          for (const id of compose.designIds) if (!saved.has(id)) delete s.designs[id];
          s.composes = s.composes.filter((c) => c.id !== body.id);
        });
        return send(res, 200, publicState());
      }
      case '/api/stop': {
        send(res, 200, { ok: true });
        setTimeout(() => stop(), 50);
        return undefined;
      }
      default:
        return send(res, 404, { error: 'Not found' });
    }
  }

  const ui = http.createServer(async (req, res) => {
    try {
      if (!hostAllowed(req, uiPort) || !originAllowed(req, uiPort)) {
        return send(res, 403, { error: "Use this workspace's own address" });
      }
      const url = new URL(req.url, `http://127.0.0.1:${uiPort}`);
      if (url.pathname.startsWith('/api/')) return await api(req, res, url);
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, { error: 'Method not allowed' });
      const headers = { 'Content-Security-Policy': UI_CSP };
      const file = fileInside(uiDir, url.pathname === '/' ? '/index.html' : url.pathname);
      if (file && path.extname(file) && serveFile(res, file, headers)) return undefined;
      // App routes (/compose, /library, ...) all load the single page.
      if (!path.extname(url.pathname) && serveFile(res, path.join(uiDir, 'index.html'), headers)) return undefined;
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (error) {
      log(`ui error: ${error.stack || error}`);
      return send(res, error.status || 500, { error: error.status ? error.message : 'Workspace error' });
    }
  });

  const content = http.createServer((req, res) => {
    try {
      if (!hostAllowed(req, servedContentPort)) return send(res, 403, 'Forbidden', { 'Content-Type': 'text/plain' });
      const url = new URL(req.url, `http://127.0.0.1:${servedContentPort}`);
      if (url.pathname === '/health') return send(res, 200, { ok: true });
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed', { 'Content-Type': 'text/plain' });
      if (url.pathname.startsWith('/designs/')) {
        // /designs/<id>/...: a prototype's preview in its Congo file, or the
        // older working-area folder.
        const [, , rawId, ...rest] = url.pathname.split('/');
        const known = store.get().designs[decodeURIComponent(rawId ?? '')];
        let file = known?.dir
          ? fileInside(previewDir(known.dir), `/${rest.join('/')}`)
          : fileInside(files.designs, url.pathname.slice('/designs'.length));
        if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        // Cards show the design without Impeccable's live editor; Edit (?edit=1)
        // serves the page exactly as Impeccable injected it.
        if (file && path.extname(file).toLowerCase() === '.html' && url.searchParams.get('edit') !== '1' && fs.existsSync(file)) {
          const html = fs.readFileSync(file, 'utf8').replace(/<!-- impeccable-live-start -->[\s\S]*?<!-- impeccable-live-end -->\s*/g, '');
          return send(res, 200, html, { 'Content-Type': MIME['.html'], ...DESIGN_HEADERS });
        }
        if (file && serveFile(res, file, DESIGN_HEADERS)) return undefined;
      } else {
        // A design built from an app often asks for its assets from the site
        // root (/assets/logo.svg). Resolve those inside the design that asked,
        // named by the page or stylesheet that made the request.
        const design = designFromReferer(req.headers.referer, servedContentPort);
        const owner = design ? store.get().designs[design] : null;
        const file = design && fileInside(owner?.dir ? previewDir(owner.dir) : path.join(files.designs, design), url.pathname);
        if (file && path.extname(file) && serveFile(res, file, DESIGN_HEADERS)) return undefined;
      }
      return send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    } catch (error) {
      log(`content error: ${error.stack || error}`);
      return send(res, 500, 'Workspace error', { 'Content-Type': 'text/plain' });
    }
  });

  uiPort = await listen(ui, range(port, 20));
  servedContentPort = await listen(content, contentPort ? [contentPort] : range(uiPort + 1, 40).filter((p) => p !== uiPort));

  const record = {
    service: 'congo-workspace',
    protocol: PROTOCOL,
    version: VERSION,
    pid: process.pid,
    port: uiPort,
    contentPort: servedContentPort,
    token: secret,
    startedAt: new Date().toISOString(),
  };
  writeJsonAtomic(files.server, record);

  // Background: designs the AI writes become cards; helper replies become
  // conversation; the helper boots so the AI can connect right away.
  const timers = [
    setInterval(() => { registerDesigns().catch((error) => log(`scan: ${error.message}`)); }, 1500),
    setInterval(() => { refreshLive().catch(() => {}); }, 3000),
  ];
  const unfollow = followEvents(() => helperInfo(files.area), onHelperEvent, log);
  const unfollowApp = followEvents(() => (liveTarget() ? helperInfo(liveTarget().path) : null), onHelperEvent, log);
  if (bootHelper && launcher) {
    helperForRequests().catch((error) => log(`helper: ${error.message}`));
  }

  let resolveStopped;
  const stopped = new Promise((resolve) => { resolveStopped = resolve; });
  function stop() {
    if (stopping) return stopped;
    stopping = true;
    const current = (() => { try { return JSON.parse(fs.readFileSync(files.server, 'utf8')); } catch { return null; } })();
    if (current?.pid === process.pid) {
      try { fs.rmSync(files.server); } catch {}
    }
    for (const timer of timers) clearInterval(timer);
    unfollow();
    unfollowApp();
    dev.stopAll();
    for (const id of [...rootServers.keys()]) closeRootServer(id);
    let pending = 2;
    const done = () => { if (--pending === 0) resolveStopped(); };
    ui.close(done);
    content.close(done);
    ui.closeAllConnections?.();
    content.closeAllConnections?.();
    return stopped;
  }

  return { record, store, stop, stopped, url: `http://127.0.0.1:${uiPort}/#t=${secret}` };
}

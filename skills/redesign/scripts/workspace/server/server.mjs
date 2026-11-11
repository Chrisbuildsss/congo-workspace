// The Congo workspace's local server. Two loopback listeners:
//   ui      - the prebuilt workspace app and its token-protected /api
//   content - designs and previews, on a separate origin from the API
import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { layout } from './paths.mjs';
import { Store, THEMES, VIEWS, writeJsonAtomic } from './store.mjs';
import { helperStatus } from './live.mjs';
import { createCatalog } from './catalog.mjs';
import { ensureHelper, findLauncher, followEvents, postSteer, prepareArea, referenceDir } from './impeccable.mjs';
import { helperInfo } from './live.mjs';
import { buildRequest, describeAction, newId, scanDesigns, steerMessage, writeRequest } from './requests.mjs';
import { DevServers, normalizeUrl } from './devserver.mjs';
import { runImpeccable } from './impeccable.mjs';

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

function appName(appPath) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(appPath, 'package.json'), 'utf8'));
    if (typeof pkg.name === 'string' && pkg.name) return pkg.name;
  } catch {}
  return path.basename(appPath);
}

export async function startWorkspaceServer({ root, uiDir, port = 4870, contentPort, token, log = () => {}, env = process.env, fetchImpl, bootHelper = !env.CONGO_WORKSPACE_NO_HELPER }) {
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

  const activeApp = () => store.get().apps.find((app) => app.id === store.get().activeAppId) || null;
  const launcher = findLauncher(env);
  const protocolFile = path.resolve(uiDir, '..', '..', '..', 'reference', 'workspace.md');
  const impeccableReference = referenceDir(launcher);
  prepareArea(files.area);

  // Connection: the AI is "listening" while its live-poll is parked on a
  // helper, and stays "connected" for a while between events while it works.
  const CONNECTED_GRACE_MS = 15 * 60 * 1000;
  const live = { area: { running: false, agentPolling: false }, app: { running: false, agentPolling: false }, lastPollAt: 0, lastVia: null, helperError: null };

  async function refreshLive() {
    const app = activeApp();
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
      .map(({ id, type, status: st, composeId, appId, designId, action, createdAt, outputs, message }) => ({
        id, type, status: st, composeId, appId, designId, action, createdAt, outputs, message,
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
    };
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
    if (!['compose', 'tweak', 'build', 'library', 'start-app', 'live-edit', 'switch-to-area'].includes(type)) throw Object.assign(new Error('Unknown request'), { status: 400 });
    const standalone = ['start-app', 'live-edit', 'switch-to-area'].includes(type);
    const id = newId();
    const s = store.get();
    let compose = null;
    let design = null;
    let action = null;
    let item = null;
    let text = null;
    let userText = '';

    if (type === 'compose') {
      compose = s.composes.find((c) => c.id === body.composeId);
      if (!compose) throw Object.assign(new Error('Compose not found'), { status: 404 });
      text = String(body.text ?? '').trim().slice(0, 4000);
      if (!text && !body.attachment) throw Object.assign(new Error('Describe what you want first'), { status: 400 });
      userText = text || 'Use the attached image';
    } else if (type === 'tweak' || type === 'build') {
      design = s.designs[body.designId];
      if (!design || !design.local) throw Object.assign(new Error('Design not found in this workspace'), { status: 404 });
      if (type === 'tweak') {
        action = describeAction(String(body.action ?? ''));
        if (!action) throw Object.assign(new Error('Unknown action'), { status: 400 });
        userText = `${action.label}: ${design.title}`;
      } else {
        userText = `Build this: ${design.title}`;
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
    const appForHelper = activeApp();
    const info = live.app.agentPolling && !live.area.agentPolling && appForHelper
      ? helperInfo(appForHelper.path)
      : await helperForRequests();
    const attachment = saveAttachment(id, body.attachment);

    const result = store.update((state) => {
      if (standalone) {
        const app = state.apps.find((a) => a.id === body.appId) ?? null;
        const request = buildRequest({ type, id, files, reference: protocolFile, impeccableReference, app });
        state.requests[id] = {
          id, type, status: 'sent', composeId: null, designId: null, action: null, item: null,
          appId: app?.id ?? null, outputs: [], createdAt: request.createdAt, message: null,
        };
        return { request, compose: null };
      }
      let target = compose ? state.composes.find((c) => c.id === compose.id) : null;
      if (!target) target = newCompose(state, type === 'library' ? item.title : userText, body.appId);
      if (type === 'compose' && (target.title === 'New design' || !target.title)) target.title = text.split(/[.!?\n]/)[0].slice(0, 60) || 'New design';
      if (body.appId === null || state.apps.some((a) => a.id === body.appId)) target.appId = body.appId;
      target.messages.push({ id: `m-${id}`, role: 'user', text: userText, at: new Date().toISOString(), requestId: id });
      if (type === 'compose') target.prompt = text;
      target.status = 'waiting';
      const app = state.apps.find((a) => a.id === target.appId) ?? null;
      const request = buildRequest({
        type,
        id,
        files,
        reference: protocolFile,
        impeccableReference,
        app,
        compose: target,
        text,
        attachment,
        design: design ? { ...design, dir: design.local ? path.join(files.designs, design.id) : null, entry: design.local ? path.join(files.designs, design.id, 'index.html') : null } : null,
        action,
        item,
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
      };
      return { request, compose: target };
    });
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
    if (done.status === 'done' && ['start-app', 'live-edit'].includes(done.type) && done.message) {
      const match = /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):\d{2,5}[^\s"')]*/i.exec(done.message);
      const app = store.get().apps.find((a) => a.id === done.appId);
      if (match && app) dev.attachUrl(app, match[0], 'ai');
    }
  }

  function registerDesigns() {
    const found = scanDesigns(files);
    const s = store.get();
    const fresh = found.filter((d) => {
      const known = s.designs[d.id];
      return !known || known.title !== d.meta.title || known.summary !== (d.meta.summary ?? undefined) || known.src !== d.src;
    });
    if (!fresh.length) return;
    store.update((state) => {
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
      case '/api/designs/delete': {
        const design = store.get().designs[body.id];
        if (!design) return send(res, 404, { error: 'Design not found' });
        if (design.local && /^[a-z0-9][a-z0-9-]{0,63}$/i.test(design.id)) {
          const dir = path.join(files.designs, design.id);
          if (path.dirname(dir) === files.designs) fs.rmSync(dir, { recursive: true, force: true });
        }
        store.update((s) => {
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
      case '/api/edit': {
        // Edit a design with Impeccable's live editor: Impeccable injects its
        // own script into the working area's pages; the frame loads ?edit=1.
        const design = store.get().designs[body.designId];
        if (!design?.local) return send(res, 404, { error: 'Only designs in this workspace can be edited' });
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
        // Used by the Redesign skill: make sure the helper runs, attach the
        // app if given, and tell the AI where to poll.
        if (typeof body.project === 'string' && body.project) attachApp(body.project);
        const info = await helperForRequests();
        return send(res, 200, {
          area: files.area,
          protocol: protocolFile,
          helper: { port: info.port },
          poll: { cwd: files.area, args: ['live-poll'] },
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
        let file = fileInside(files.designs, url.pathname.slice('/designs'.length));
        if (file && fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
        // Cards show the design without Impeccable's live editor; Edit (?edit=1)
        // serves the page exactly as Impeccable injected it.
        if (file && path.extname(file).toLowerCase() === '.html' && url.searchParams.get('edit') !== '1' && fs.existsSync(file)) {
          const html = fs.readFileSync(file, 'utf8').replace(/<!-- impeccable-live-start -->[\s\S]*?<!-- impeccable-live-end -->\s*/g, '');
          return send(res, 200, html, { 'Content-Type': MIME['.html'] });
        }
        if (file && serveFile(res, file)) return undefined;
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
    setInterval(() => { try { registerDesigns(); } catch (error) { log(`scan: ${error.message}`); } }, 1500),
    setInterval(() => { refreshLive().catch(() => {}); }, 3000),
  ];
  const unfollow = followEvents(() => helperInfo(files.area), onHelperEvent, log);
  const unfollowApp = followEvents(() => (activeApp() ? helperInfo(activeApp().path) : null), onHelperEvent, log);
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

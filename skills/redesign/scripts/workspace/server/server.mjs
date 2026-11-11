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

export async function startWorkspaceServer({ root, uiDir, port = 4870, contentPort, token, log = () => {} }) {
  const files = layout(root);
  for (const dir of [files.area, files.designs, files.requests, files.sources]) fs.mkdirSync(dir, { recursive: true });
  const store = new Store(files.state);
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

  async function status() {
    const app = activeApp();
    const [areaHelper, appHelper] = await Promise.all([
      helperStatus(files.area),
      app ? helperStatus(app.path) : Promise.resolve({ running: false, agentPolling: false }),
    ]);
    const connected = areaHelper.agentPolling || appHelper.agentPolling;
    return {
      protocol: PROTOCOL,
      version: VERSION,
      view: store.get().view,
      contentOrigin: `http://127.0.0.1:${servedContentPort}`,
      ai: {
        connected,
        via: areaHelper.agentPolling ? 'workspace' : appHelper.agentPolling ? 'app' : null,
        workspaceHelper: areaHelper.running,
      },
      app: app ? { ...app, helper: appHelper.running } : null,
    };
  }

  function publicState() {
    const s = store.get();
    return {
      settings: s.settings,
      view: s.view,
      apps: s.apps,
      activeAppId: s.activeAppId,
      composes: s.composes,
      designs: s.designs,
      projects: s.projects,
    };
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
    if (req.method !== 'POST') return send(res, 404, { error: 'Not found' });
    const body = await readBody(req);
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

  let resolveStopped;
  const stopped = new Promise((resolve) => { resolveStopped = resolve; });
  function stop() {
    if (stopping) return stopped;
    stopping = true;
    const current = (() => { try { return JSON.parse(fs.readFileSync(files.server, 'utf8')); } catch { return null; } })();
    if (current?.pid === process.pid) {
      try { fs.rmSync(files.server); } catch {}
    }
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

// Congo's public catalog, read through the workspace. Browsing, screenshots
// and previews are free; this never touches source, sign-in or entitlements.
// Source goes through the Congo CLI/MCP, run by the user's own AI.
import path from 'node:path';
import { readJson, writeJsonAtomic } from './store.mjs';

const TTL_MS = 10 * 60 * 1000;

export function registryOrigin(env = process.env) {
  const value = env.CONGO_REGISTRY || 'https://buildwithcongo.com';
  const url = new URL(value);
  if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('CONGO_REGISTRY must be https');
  }
  return url.origin;
}

function absolute(origin, src) {
  if (typeof src !== 'string' || !src) return null;
  try {
    const url = new URL(src, origin);
    return url.protocol === 'https:' || url.origin === origin ? url.href : null;
  } catch {
    return null;
  }
}

function clampInt(value, min, max, fallback) {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
}

export function createCatalog({ cacheDir, env = process.env, fetchImpl = fetch } = {}) {
  const origin = registryOrigin(env);
  const memory = new Map();

  async function get(route, { persist = false } = {}) {
    const key = route;
    const hit = memory.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
    const file = persist && cacheDir ? path.join(cacheDir, `${route.replace(/[^a-z0-9]+/gi, '-')}.json`) : null;
    try {
      const response = await fetchImpl(origin + route, {
        headers: { Accept: 'application/json', 'User-Agent': 'congo-workspace/0.1' },
        signal: AbortSignal.timeout(12000),
      });
      if (!response.ok) throw Object.assign(new Error(`Congo library unavailable (${response.status})`), { status: 502 });
      const value = await response.json();
      memory.set(key, { at: Date.now(), value });
      if (file) writeJsonAtomic(file, value);
      return value;
    } catch (error) {
      // Offline: fall back to the last good copy when we have one.
      const stale = hit?.value ?? (file ? readJson(file, null) : null);
      if (stale) return stale;
      throw Object.assign(new Error('Could not reach the Congo library. Check your connection.'), { status: 502, cause: error });
    }
  }

  function app(listing) {
    return {
      id: listing.id,
      slug: listing.slug,
      name: listing.name,
      summary: listing.summary ?? '',
      category: listing.category ?? null,
      pageCount: listing.pageCount ?? null,
      access: listing.access ?? 'subscription',
      logo: absolute(origin, listing.logo?.src),
      screenshot: absolute(origin, listing.screenshot?.src),
      screenshots: (listing.screenshots ?? []).map((s) => absolute(origin, s?.src)).filter(Boolean),
      preview: listing.preview?.status === 'available' ? absolute(origin, listing.preview.url) : null,
      inspiredBy: listing.inspiredBy?.name ?? null,
      url: `${origin}/websites/${encodeURIComponent(listing.slug)}`,
      release: listing.release?.id ?? null,
    };
  }

  function screen(item) {
    const shot = item.screenshot ?? {};
    return {
      id: item.id,
      title: item.title,
      route: item.route ?? null,
      app: item.app ? { id: item.app.id, slug: item.app.slug, name: item.app.name } : null,
      categories: item.screenCategories ?? [],
      screenshot: absolute(origin, shot.src),
      format: shot.width && shot.height && shot.height > shot.width * 1.2 ? 'mobile' : 'desktop',
      preview: absolute(origin, item.preview),
      url: absolute(origin, item.url),
      version: item.version ?? null,
      source: item.source ? { kind: item.source.kind, id: item.source.id, version: item.source.version } : null,
    };
  }

  return {
    origin,
    async apps() {
      const catalog = await get('/api/catalog', { persist: true });
      const apps = (catalog.listings ?? []).filter((l) => l.kind === 'app').map(app);
      const categories = (catalog.categories ?? []).map((c) => ({ id: c.slug ?? c.id, title: c.title }));
      return { apps, categories };
    },
    async screens(query) {
      const params = new URLSearchParams();
      if (query.q) params.set('q', String(query.q).slice(0, 120));
      if (query.app) params.set('app', String(query.app).slice(0, 120));
      if (query.category) params.set('category', String(query.category).slice(0, 80));
      params.set('offset', String(clampInt(query.offset, 0, 100000, 0)));
      params.set('limit', String(clampInt(query.limit, 1, 60, 24)));
      const result = await get(`/api/screens?${params}`);
      return { items: (result.items ?? []).map(screen), total: result.total ?? 0, offset: result.offset ?? 0 };
    },
    async categories() {
      const result = await get('/api/screen-categories', { persist: true });
      return { categories: (result.categories ?? []).map((c) => ({ id: c.id, title: c.title, group: c.group ?? null })) };
    },
  };
}

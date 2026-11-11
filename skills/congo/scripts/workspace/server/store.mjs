// Workspace state: one JSON file, written atomically, read once at start.
import fs from 'node:fs';
import path from 'node:path';

export const VIEWS = ['compose', 'library', 'projects', 'live'];
export const THEMES = ['system', 'light', 'dark'];

export function emptyState() {
  return {
    version: 1,
    settings: { theme: 'system' },
    view: 'library',
    apps: [],
    activeAppId: null,
    composes: [],
    designs: {},
    projects: [],
    requests: {},
  };
}

export function readJson(file, fallback = null) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

export function writeJsonAtomic(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(value, null, 2));
  fs.renameSync(tmp, file);
}

export class Store {
  constructor(file) {
    this.file = file;
    const loaded = readJson(file, null);
    this.state = { ...emptyState(), ...(loaded && typeof loaded === 'object' ? loaded : {}) };
    if (!VIEWS.includes(this.state.view)) this.state.view = 'library';
    if (!THEMES.includes(this.state.settings?.theme)) this.state.settings = { ...this.state.settings, theme: 'system' };
  }

  get() {
    return this.state;
  }

  update(mutate) {
    const result = mutate(this.state);
    writeJsonAtomic(this.file, this.state);
    return result;
  }
}

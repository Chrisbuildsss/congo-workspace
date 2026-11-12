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
    // The Library request tray: selected items with their notes, and one
    // note for the whole request. Kept until Send so a reload loses nothing.
    tray: { items: [], note: '' },
  };
}

export function readJson(file, fallback = null) {
  try {
    // Tolerate a byte-order mark: Windows tools often write one.
    return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
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
    if (!Array.isArray(this.state.tray?.items)) this.state.tray = { items: [], note: '' };
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

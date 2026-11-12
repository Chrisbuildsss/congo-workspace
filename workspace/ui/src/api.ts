import type { LibraryApp, LibraryScreen, SavedState, ScreenCategory, Tray, WorkspaceState, WorkspaceStatus } from "./types";

const TOKEN_KEY = "congo-workspace-token";

/** Reads the launch token from the URL hash once, then keeps it for this tab. */
export function initToken(): string {
  const match = window.location.hash.match(/(?:^#|&)t=([^&]+)/);
  if (match) {
    try {
      sessionStorage.setItem(TOKEN_KEY, decodeURIComponent(match[1]));
    } catch {
      // Storage can be unavailable; the in-memory copy below still works.
    }
    memoryToken = decodeURIComponent(match[1]);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  return token();
}

let memoryToken = "";

export function token(): string {
  if (memoryToken) return memoryToken;
  try {
    memoryToken = sessionStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    memoryToken = "";
  }
  return memoryToken;
}

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function api<T>(path: string, body?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token()}`,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const value = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError((value as { error?: string }).error ?? "Workspace request failed", response.status);
  }
  return value as T;
}

export const getStatus = () => api<WorkspaceStatus>("/api/status");
export const getState = () => api<WorkspaceState>("/api/state");

export const getLibraryApps = () => api<{ apps: LibraryApp[] }>("/api/library/apps");
export const getScreenCategories = () => api<{ categories: ScreenCategory[] }>("/api/library/categories");
export const getLibraryScreens = (query: { q?: string; app?: string; category?: string; offset?: number; limit?: number }) => {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  return api<{ items: LibraryScreen[]; total: number; offset: number }>(`/api/library/screens?${params}`);
};

/** The account's Saved items, through the person's own Congo CLI. */
export const getSaved = (refresh = false) => api<SavedState>(`/api/library/saved${refresh ? "?refresh=1" : ""}`);

/** Keeps the request tray in the workspace, so a reload loses nothing. */
export const saveTray = (tray: Tray) => api<{ tray: Tray }>("/api/tray", tray);
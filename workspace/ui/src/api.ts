import type { WorkspaceState, WorkspaceStatus } from "./types";

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

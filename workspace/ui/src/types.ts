export type ViewName = "compose" | "library" | "projects" | "live";

export type ThemeSetting = "system" | "light" | "dark";

export interface DesignSource {
  kind: "screen" | "template" | "app";
  id: string;
  version?: string;
  app?: string;
}

/** A design card: real running code from the working area, or a library screenshot. */
export interface Design {
  id: string;
  title: string;
  summary?: string;
  author?: string;
  format: "desktop" | "mobile";
  /** Path on the content origin (`/designs/<id>/`) or a loopback dev URL. */
  src?: string;
  /** Screenshot URL, for library items and previews. */
  image?: string;
  /** Hosted original (library items); opens in a new tab. */
  previewUrl?: string | null;
  parentId?: string;
  action?: string;
  source?: DesignSource;
  createdAt?: string;
  /** True for designs your AI wrote into the workspace's working area. */
  local?: boolean;
  requestId?: string | null;
  appId?: string | null;
}

export interface LibraryApp {
  id: string;
  slug: string;
  name: string;
  summary: string;
  category: string | null;
  pageCount: number | null;
  access: string;
  logo: string | null;
  screenshot: string | null;
  screenshots: string[];
  preview: string | null;
  inspiredBy: string | null;
  url: string;
  release: string | null;
}

export interface LibraryScreen {
  id: string;
  title: string;
  route: string | null;
  app: { id: string; slug: string; name: string } | null;
  categories: string[];
  screenshot: string | null;
  format: "desktop" | "mobile";
  preview: string | null;
  url: string | null;
  version: string | null;
  source: { kind: "screen" | "template" | "app"; id: string; version?: string } | null;
}

export interface ScreenCategory {
  id: string;
  title: string;
  group: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  at?: string;
}

export interface Compose {
  id: string;
  title: string;
  prompt: string;
  status: "draft" | "waiting" | "complete";
  designIds: string[];
  messages: ChatMessage[];
  appId?: string | null;
}

export interface Project {
  id: string;
  name: string;
  designIds: string[];
  appId?: string | null;
}

export interface AppRef {
  id: string;
  path: string;
  name: string;
}

export interface WorkspaceState {
  settings: { theme: ThemeSetting };
  view: ViewName;
  apps: AppRef[];
  activeAppId: string | null;
  composes: Compose[];
  designs: Record<string, Design>;
  projects: Project[];
  requests: WorkspaceRequest[];
}

export interface WorkspaceRequest {
  id: string;
  type: "compose" | "tweak" | "build" | "library";
  status: "sent" | "done" | "error";
  composeId: string;
  designId: string | null;
  action: string | null;
  createdAt: string;
  outputs: string[];
  message: string | null;
}

export interface WorkspaceStatus {
  protocol: number;
  version: string;
  view: ViewName;
  contentOrigin: string;
  ai: {
    connected: boolean;
    listening: boolean;
    via: "workspace" | "app" | null;
    workspaceHelper: boolean;
    impeccable: boolean;
    pending: number;
    error: string | null;
  };
  app: (AppRef & { helper: boolean }) | null;
}

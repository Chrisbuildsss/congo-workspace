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
  parentId?: string;
  action?: string;
  source?: DesignSource;
  createdAt?: string;
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
}

export interface WorkspaceStatus {
  protocol: number;
  version: string;
  view: ViewName;
  contentOrigin: string;
  ai: { connected: boolean; via: "workspace" | "app" | null; workspaceHelper: boolean };
  app: (AppRef & { helper: boolean }) | null;
}

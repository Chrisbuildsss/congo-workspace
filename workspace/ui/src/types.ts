export type ViewName = "community" | "projects" | "boards" | "board" | "chat";

export type DesignKind =
  | "mint"
  | "aura"
  | "post"
  | "portfolio"
  | "archive"
  | "signal"
  | "folio"
  | "grid";

export type ArtifactKind = "design" | "image" | "site";

export interface Design {
  id: string;
  title: string;
  author: string;
  likes: number;
  bookmarks: number;
  kind: DesignKind;
  format: "desktop" | "mobile";
  artifactKind?: ArtifactKind;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
}

export interface ChatProject {
  id: string;
  title: string;
  prompt: string;
  status: "draft" | "generating" | "complete";
  designs: Design[];
  messages: ChatMessage[];
}

export interface Board {
  id: string;
  name: string;
  designIds: string[];
}

export interface AppUser {
  displayName: string;
  username: string;
  email: string;
  avatarUrl?: string;
  isPrivate: boolean;
}

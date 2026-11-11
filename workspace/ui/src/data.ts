import type { Board, ChatProject, Design } from "./types";

export const designs: Design[] = [
  {
    id: "design-mint",
    title: "Mint Workstation",
    author: "riverbend",
    likes: 3130,
    bookmarks: 402,
    kind: "mint",
    format: "desktop",
  },
  {
    id: "design-aura",
    title: "Night Access",
    author: "studiokite",
    likes: 2745,
    bookmarks: 361,
    kind: "aura",
    format: "desktop",
  },
  {
    id: "design-post",
    title: "Postcard Hotel Key",
    author: "fieldoffice",
    likes: 2422,
    bookmarks: 307,
    kind: "post",
    format: "mobile",
  },
  {
    id: "design-portfolio",
    title: "Field Notes Portfolio",
    author: "northstar",
    likes: 2282,
    bookmarks: 288,
    kind: "portfolio",
    format: "desktop",
  },
  {
    id: "design-archive",
    title: "Loose Leaf Journal",
    author: "paperroom",
    likes: 1684,
    bookmarks: 241,
    kind: "archive",
    format: "desktop",
  },
  {
    id: "design-signal",
    title: "Signal Notepad",
    author: "orbitpress",
    likes: 1421,
    bookmarks: 190,
    kind: "signal",
    format: "desktop",
  },
  {
    id: "design-folio",
    title: "Quiet Portrait Study",
    author: "housecopy",
    likes: 1160,
    bookmarks: 151,
    kind: "folio",
    format: "desktop",
  },
  {
    id: "design-grid",
    title: "Kinetic Contact Sheet",
    author: "gridworks",
    likes: 943,
    bookmarks: 128,
    kind: "grid",
    format: "mobile",
  },
];

export const designMap = new Map(designs.map((design) => [design.id, design]));

export const initialProjects: ChatProject[] = [
  {
    id: "chat-editorial",
    title: "Editorial Journal Study",
    prompt: "Create an editorial journal design",
    status: "complete",
    designs: [
      designMap.get("design-archive")!,
      designMap.get("design-signal")!,
      designMap.get("design-folio")!,
      designMap.get("design-grid")!,
      designMap.get("design-aura")!,
      designMap.get("design-portfolio")!,
    ],
    messages: [
      {
        id: "msg-1",
        role: "user",
        text: "Create an editorial journal design",
      },
      {
        id: "msg-2",
        role: "assistant",
        text:
          "I explored six editorial directions: a stark archive, a tactile journal, a portrait-led folio, a modular grid, a cinematic night mode, and a saturated portfolio. Pick a direction and I can bend the typography, palette, or layout further.",
      },
    ],
  },
  {
    id: "chat-travel",
    title: "Travel Companion Study",
    prompt: "A tactile mobile travel companion",
    status: "complete",
    designs: [designMap.get("design-post")!, designMap.get("design-aura")!],
    messages: [
      {
        id: "travel-1",
        role: "user",
        text: "A tactile mobile travel companion",
      },
      {
        id: "travel-2",
        role: "assistant",
        text:
          "I created two distinct travel concepts: a hotel key experience and a calm, atmospheric access flow.",
      },
    ],
  },
  {
    id: "chat-product",
    title: "Product Landing Study",
    prompt: "Bold product launch page",
    status: "complete",
    designs: [designMap.get("design-portfolio")!, designMap.get("design-grid")!],
    messages: [
      {
        id: "product-1",
        role: "user",
        text: "Bold product launch page",
      },
    ],
  },
  {
    id: "chat-studio",
    title: "Portfolio Direction",
    prompt: "A warm editorial studio website",
    status: "complete",
    designs: [designMap.get("design-folio")!, designMap.get("design-signal")!],
    messages: [],
  },
  {
    id: "chat-housing",
    title: "Property Search Flow",
    prompt: "A clear housing search experience",
    status: "complete",
    designs: [designMap.get("design-mint")!, designMap.get("design-aura")!],
    messages: [],
  },
];

export const initialBoards: Board[] = [
  {
    id: "board-default",
    name: "All saved",
    designIds: ["design-post", "design-mint", "design-aura", "design-folio"],
  },
];

export const communityDesigns = designs.slice(0, 6);

export const styleOptions = [
  { name: "Editorial", swatch: "linear-gradient(135deg,#f4efe6,#d5c5ae)" },
  { name: "Neo brutalist", swatch: "linear-gradient(135deg,#d8ff39,#111 52%,#ff5d8f)" },
  { name: "Soft futurism", swatch: "linear-gradient(135deg,#d7e7ff,#3448ff)" },
  { name: "Swiss grid", swatch: "linear-gradient(135deg,#fff 46%,#111 47%,#111 53%,#fff 54%)" },
  { name: "Organic calm", swatch: "linear-gradient(135deg,#b7d3b2,#e9d7bd)" },
  { name: "Editorial dark", swatch: "linear-gradient(135deg,#111,#5e5e5e)" },
];

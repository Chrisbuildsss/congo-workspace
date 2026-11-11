import {
  startTransition,
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from "react";
import Composer, {
  type ComposerValues,
} from "./components/Composer";
import {
  BillingModal,
  FeedbackModal,
  SettingsModal,
  TermsModal,
} from "./components/AppModals";
import { Sidebar } from "./components/AppShell";
import { copyText, Toast } from "./components/Ui";
import type { CardAction } from "./components/DesignCard";
import { LogoMark } from "./Icons";
import {
  communityDesigns,
  designMap,
  designs,
  initialBoards,
  initialProjects,
} from "./data";
import type {
  AppUser,
  Board,
  ChatProject,
  Design,
  ViewName,
} from "./types";
import CommunityView from "./views/Community";
import ProjectsView from "./views/Projects";
import BoardsView from "./views/Boards";
import BoardDetail from "./views/BoardDetail";
import ChatView from "./views/Chat";
import DesignDetail from "./views/DesignDetail";

type Route =
  | { name: "community" }
  | { name: "projects" }
  | { name: "boards" }
  | { name: "board"; id: string }
  | { name: "chat"; id: string };

type DetailState = {
  design: Design;
  source: "community" | "chat" | "boards";
  editing: boolean;
};

type ModalName = "settings" | "billing" | "feedback" | "terms" | null;

const initialUser: AppUser = {
  displayName: "Mara Chen",
  username: "mara.chen",
  email: "hello@marachen.design",
  isPrivate: false,
};

function parseRoute(path: string): Route {
  if (path.startsWith("/saved/")) {
    return { name: "board", id: path.split("/")[2] || "board-default" };
  }
  if (path.startsWith("/saved")) return { name: "boards" };
  if (path.startsWith("/projects")) return { name: "projects" };
  if (path.startsWith("/chat/")) {
    return { name: "chat", id: path.split("/")[2] || "chat-editorial" };
  }
  return { name: "community" };
}

function routePath(route: Route) {
  if (route.name === "board") return `/saved/${route.id}`;
  if (route.name === "chat") return `/chat/${route.id}`;
  if (route.name === "boards") return "/saved";
  if (route.name === "projects") return "/projects";
  return "/community";
}

function currentPath() {
  if (window.location.protocol === "file:") {
    return window.location.hash.replace(/^#/, "") || "/community";
  }
  return window.location.pathname;
}

function scrollTop() {
  document.querySelector(".main-scroll")?.scrollTo({ top: 0 });
}

function designVariation(design: Design, index: number, suffix: string): Design {
  return {
    ...design,
    id: `${design.id}-${suffix}-${index}`,
    title: `${design.title} ${index + 1}`,
    likes: Math.max(52, Math.round(design.likes * (0.16 + index * 0.08))),
    bookmarks: Math.max(8, Math.round(design.bookmarks * 0.18)),
  };
}

function generatedDesignSet(prompt: string): Design[] {
  const normalized = prompt.toLowerCase();
  let base = communityDesigns;
  if (/travel|hotel|trip|journey|tour/.test(normalized)) {
    base = [
      designMap.get("design-post")!,
      designMap.get("design-aura")!,
      designMap.get("design-portfolio")!,
      designMap.get("design-signal")!,
      designMap.get("design-mint")!,
      designMap.get("design-archive")!,
    ];
  } else if (/portfolio|studio|architect|designer/.test(normalized)) {
    base = [
      designMap.get("design-folio")!,
      designMap.get("design-portfolio")!,
      designMap.get("design-mint")!,
      designMap.get("design-grid")!,
      designMap.get("design-archive")!,
      designMap.get("design-signal")!,
    ];
  } else if (/blog|journal|editorial|writing/.test(normalized)) {
    base = [
      designMap.get("design-archive")!,
      designMap.get("design-signal")!,
      designMap.get("design-folio")!,
      designMap.get("design-grid")!,
      designMap.get("design-aura")!,
      designMap.get("design-portfolio")!,
    ];
  }
  return base.map((design, index) =>
    designVariation(design, index, `generated-${Date.now()}`),
  );
}

function titleForPrompt(prompt: string) {
  const normalized = prompt.toLowerCase();
  if (/travel|hotel|trip|journey|tour/.test(normalized)) {
    return "Travel App Exploration";
  }
  if (/blog|journal|editorial|writing/.test(normalized)) {
    return "Editorial Journal";
  }
  if (/portfolio|studio|architect|designer/.test(normalized)) {
    return "Portfolio Design";
  }
  if (/app|product|platform|tool/.test(normalized)) {
    return "Product Design";
  }
  return prompt.split(/[.!?]/)[0].slice(0, 32) || "New design";
}

function AuthView({
  onSignedIn,
  onTerms,
}: {
  onSignedIn: () => void;
  onTerms: () => void;
}) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim()) return;
    setBusy(true);
    window.setTimeout(() => {
      setBusy(false);
      onSignedIn();
    }, 650);
  };
  return (
    <div className="auth-screen">
      <div className="auth-logo"><LogoMark size={20} /></div>
      <div className="auth-panel">
        <h1>Sign in or sign up</h1>
        <button
          type="button"
          className="google-button"
          disabled={busy}
          onClick={() => {
            setBusy(true);
            window.setTimeout(() => {
              setBusy(false);
              onSignedIn();
            }, 650);
          }}
        >
          <span className="google-g">G</span>
          {busy ? "Signing in…" : "Continue with Google"}
        </button>
        <div className="or-divider"><span>or</span></div>
        <form onSubmit={submit}>
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="Email address"
            aria-label="Email address"
          />
          <button type="submit" disabled={!email.trim() || busy}>
            {busy ? "Please wait…" : "Continue with Email"}
          </button>
        </form>
      </div>
      <p className="auth-legal">
        By continuing, you agree to our{" "}
        <button type="button" onClick={onTerms}>Terms of Service</button>
        {" "}and have read our{" "}
        <button type="button" onClick={onTerms}>Privacy Policy</button>.
      </p>
    </div>
  );
}

export default function App() {
  const initialRoute = parseRoute(currentPath());
  const [route, setRoute] = useState<Route>(initialRoute);
  const [signedIn, setSignedIn] = useState(true);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [user, setUser] = useState(initialUser);
  const [projects, setProjects] = useState<ChatProject[]>(initialProjects);
  const [boards, setBoards] = useState<Board[]>(initialBoards);
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [chatPrompt, setChatPrompt] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [generatingChatId, setGeneratingChatId] = useState<string | null>(null);
  const [detail, setDetail] = useState<DetailState | null>(null);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [liked, setLiked] = useState<Set<string>>(new Set());
  const [bookmarked, setBookmarked] = useState<Set<string>>(
    new Set(["design-mint", "design-post", "design-folio"]),
  );
  const [modal, setModal] = useState<ModalName>(null);
  const [saveDesignId, setSaveDesignId] = useState<string | null>(null);
  const [newBoardName, setNewBoardName] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const generationTimer = useRef<number | null>(null);

  const activeChat =
    route.name === "chat"
      ? projects.find((project) => project.id === route.id) ?? projects[0]
      : null;
  const activeBoard =
    route.name === "board"
      ? boards.find((board) => board.id === route.id) ?? boards[0]
      : null;

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  const navigate = useCallback((next: Route, replace = false) => {
    setRoute(next);
    const path = routePath(next);
    const nextLocation =
      window.location.protocol === "file:" ? `#${path}` : path;
    if (currentPath() !== path) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", nextLocation);
    }
    window.setTimeout(scrollTop, 0);
  }, []);

  const go = (name: ViewName) => {
    setDetail(null);
    navigate({ name } as Route);
  };

  useEffect(() => {
    if (window.location.protocol === "file:" && !window.location.hash) {
      window.history.replaceState({}, "", "#/community");
    } else if (window.location.pathname === "/") {
      window.history.replaceState({}, "", "/community");
    }
    const onPopState = () => {
      setDetail(null);
      setRoute(parseRoute(currentPath()));
    };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("hashchange", onPopState);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("hashchange", onPopState);
    };
  }, []);

  useEffect(() => {
    if (route.name !== "chat") return;
    const chat = projects.find((project) => project.id === route.id);
    if (chat) {
      setChatPrompt("");
    }
    // Route changes should reset the composer, not every chat update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route]);

  useEffect(
    () => () => {
      if (generationTimer.current) window.clearTimeout(generationTimer.current);
    },
    [],
  );

  const createChat = (values: ComposerValues, titleHint = "New design") => {
    const id = `chat-${Date.now().toString(36)}`;
    const title =
      titleHint === "New design" && values.text
        ? titleForPrompt(values.text)
        : titleHint;
    const chat: ChatProject = {
      id,
      title: title || "New design",
      prompt: values.text,
      status: "generating",
      designs: [],
      messages: [{ id: `msg-${id}`, role: "user", text: values.text }],
    };
    setProjects((current) => [chat, ...current]);
    setGeneratingChatId(id);
    setChatPrompt("");
    navigate({ name: "chat", id });
    setChatOpen(true);
    startGeneration(id, values.text);
  };

  const startGeneration = (chatId: string, prompt: string) => {
    if (generationTimer.current) window.clearTimeout(generationTimer.current);
    setGeneratingChatId(chatId);
    setProjects((current) =>
      current.map((project) =>
        project.id === chatId
          ? { ...project, status: "generating", designs: [] }
          : project,
      ),
    );
    generationTimer.current = window.setTimeout(() => {
      const nextDesigns = generatedDesignSet(prompt);
      setProjects((current) =>
        current.map((project) =>
          project.id === chatId
            ? {
                ...project,
                status: "complete",
                designs: nextDesigns,
                messages: [
                  ...project.messages.filter(
                    (message) => message.role === "user",
                  ),
                  {
                    id: `assistant-${Date.now()}`,
                    role: "assistant",
                    text:
                      "I explored four distinct directions for the idea. Pick one to open and refine, or use the hover controls to vary it directly.",
                  },
                ],
              }
            : project,
        ),
      );
      setGeneratingChatId(null);
      generationTimer.current = null;
    }, 1750);
  };

  const submitGlobalComposer = (values: ComposerValues) => {
    createChat(values);
    setGlobalPrompt("");
  };

  const submitChatComposer = (values: ComposerValues) => {
    if (!activeChat) return;
    const text = values.text || activeChat.prompt;
    setProjects((current) =>
      current.map((project) =>
        project.id === activeChat.id
          ? {
              ...project,
              prompt: text,
              status: "generating",
              messages: [
                ...project.messages,
                {
                  id: `message-${Date.now()}`,
                  role: "user",
                  text,
                },
              ],
            }
          : project,
      ),
    );
    startGeneration(activeChat.id, text);
    setChatPrompt("");
  };

  const openExistingChat = (chat: ChatProject) => {
    setDetail(null);
    navigate({ name: "chat", id: chat.id });
    setChatOpen(false);
  };

  const openNewChat = () => {
    createChat(
      {
        text: "",
        quality: "Auto",
        visibility: "Public",
        style: null,
        attachment: null,
      },
      "New design",
    );
    const newId = projects[0]?.id;
    if (newId) setChatOpen(true);
  };

  const createEmptyChat = () => {
    const id = `chat-${Date.now().toString(36)}`;
    const chat: ChatProject = {
      id,
      title: "New design",
      prompt: "",
      status: "draft",
      designs: [],
      messages: [],
    };
    setProjects((current) => [chat, ...current]);
    setChatPrompt("");
    navigate({ name: "chat", id });
    setChatOpen(true);
  };

  const addBoard = () => {
    const id = `board-${Date.now().toString(36)}`;
    const board: Board = { id, name: "New board", designIds: [] };
    setBoards((current) => [...current, board]);
    navigate({ name: "board", id });
  };

  const toggleInSet = (
    setter: React.Dispatch<React.SetStateAction<Set<string>>>,
    id: string,
  ) => {
    setter((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openDesign = (
    design: Design,
    source: "community" | "chat" | "boards",
    editing = false,
  ) => {
    setDetail({ design, source, editing });
    setSelectedElement(null);
    if (editing && source === "chat") setChatOpen(true);
  };

  const makeNewChatFromDesign = (design: Design) => {
    const id = `chat-from-${Date.now().toString(36)}`;
    const chat: ChatProject = {
      id,
      title: `New chat from ${design.title}`,
      prompt: design.title,
      status: "complete",
      designs: [design],
      messages: [],
    };
    setProjects((current) => [chat, ...current]);
    setDetail(null);
    navigate({ name: "chat", id });
    setChatOpen(true);
    showToast("New chat created");
  };

  const downloadDesign = (design: Design) => {
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>${design.title}</title></head><body style="margin:0;background:#101010;color:#fff;font:16px Inter,system-ui,sans-serif"><main style="min-height:100vh;display:grid;place-items:center"><section style="width:min(960px,92vw);aspect-ratio:4/3;border-radius:18px;background:#f4f0e7;color:#111;display:grid;place-items:center"><h1 style="font:500 clamp(50px,10vw,128px)/.88 Georgia,serif">${design.title}</h1></section></main></body></html>`;
    const url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${design.id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    showToast("HTML downloaded");
  };

  const handleCardAction = (action: CardAction, design: Design) => {
    if (action === "edit") {
      const inChat = activeChat?.designs.some((item) => item.id === design.id);
      openDesign(design, inChat ? "chat" : "community", true);
      return;
    }
    if (action === "new-chat") {
      makeNewChatFromDesign(design);
      return;
    }
    if (action === "new-tab") {
      window.open(`/community?design=${encodeURIComponent(design.id)}`, "_blank");
      return;
    }
    if (action === "delete") {
      if (activeChat) {
        setProjects((current) =>
          current.map((project) =>
            project.id === activeChat.id
              ? {
                  ...project,
                  designs: project.designs.filter((item) => item.id !== design.id),
                }
              : project,
          ),
        );
      }
      if (detail?.design.id === design.id) setDetail(null);
      showToast("Design removed from this workspace");
      return;
    }
    if (action === "export" || action === "download") {
      downloadDesign(design);
      return;
    }
    if (action === "export-react") {
      showToast("React export queued — demo");
      return;
    }
    if (action === "copy-code") {
      void copyText(`<!-- ${design.title} source export -->`);
      showToast("Code copied");
      return;
    }
    if (action === "other-views") {
      openDesign(design, activeChat ? "chat" : "community");
      return;
    }
    if (action.startsWith("custom:")) {
      showToast(`Variation queued: ${action.slice(7)}`);
      return;
    }
    if (action.startsWith("open-in:")) {
      const tool = action.slice("open-in:".length);
      void copyText(`Build this design direction: ${design.title}`);
      showToast(`Prompt copied for ${tool}`);
      return;
    }
    showToast(`${action.replaceAll("-", " ")} queued — demo`);
  };

  const openSave = (design: Design) => {
    setSaveDesignId(design.id);
  };

  const saveToBoard = (boardId: string) => {
    if (!saveDesignId) return;
    setBoards((current) =>
      current.map((board) =>
        board.id === boardId && !board.designIds.includes(saveDesignId)
          ? { ...board, designIds: [...board.designIds, saveDesignId] }
          : board,
      ),
    );
    setBookmarked((current) => new Set(current).add(saveDesignId));
    const board = boards.find((item) => item.id === boardId);
    setSaveDesignId(null);
    showToast(`Saved to ${board?.name ?? "board"}`);
  };

  if (!signedIn) {
    return (
      <>
        <AuthView
          onTerms={() => setModal("terms")}
          onSignedIn={() => {
            setSignedIn(true);
            navigate({ name: "community" });
          }}
        />
        <TermsModal open={modal === "terms"} onClose={() => setModal(null)} />
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </>
    );
  }

  const savedDesigns = boards
    .find((board) => board.id === "board-default")
    ?.designIds.map((id) => designMap.get(id))
    .filter((design): design is Design => Boolean(design)) ?? [];

  const chatChips: string[] = [];
  if (detail?.editing) {
    chatChips.push(detail.design.title);
    if (selectedElement) chatChips.push(selectedElement);
  }

  return (
    <div
      className={`app-shell ${
        sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"
      }`}
    >
      <Sidebar
        current={route.name}
        user={user}
        expanded={sidebarExpanded}
        showMobileTrigger={!detail}
        onToggle={() => setSidebarExpanded((expanded) => !expanded)}
        onNavigate={go}
        onCompose={createEmptyChat}
        onOpenSettings={() => setModal("settings")}
        onOpenBilling={() => setModal("billing")}
        onOpenFeedback={() => setModal("feedback")}
        onOpenTerms={() => setModal("terms")}
        onLogout={() => {
          setSignedIn(false);
          setDetail(null);
        }}
      />

      <div className="app-content">
        {route.name === "community" ? (
          <CommunityView
            items={communityDesigns}
            onOpenDesign={(design) => openDesign(design, "community")}
            onCardAction={handleCardAction}
            onCompose={submitGlobalComposer}
            onLike={(design) => toggleInSet(setLiked, design.id)}
            onBookmark={openSave}
            liked={liked}
            bookmarked={bookmarked}
            selected={selected}
            onToggleSelected={(design) => toggleInSet(setSelected, design.id)}
          />
        ) : null}

        {route.name === "projects" ? (
          <ProjectsView projects={projects} onOpenChat={openExistingChat} />
        ) : null}

        {route.name === "boards" ? (
          <BoardsView
            boards={boards}
            savedDesigns={savedDesigns}
            onOpenBoard={(board) => navigate({ name: "board", id: board.id })}
            onCreateBoard={addBoard}
            onOpenDesign={(design) => openDesign(design, "boards")}
            onCardAction={handleCardAction}
            onLike={(design) => toggleInSet(setLiked, design.id)}
            onBookmark={openSave}
            liked={liked}
            bookmarked={bookmarked}
            selected={selected}
            onToggleSelected={(design) => toggleInSet(setSelected, design.id)}
          />
        ) : null}

        {route.name === "board" && activeBoard ? (
          <BoardDetail
            board={activeBoard}
            onRename={(name) =>
              setBoards((current) =>
                current.map((board) =>
                  board.id === activeBoard.id ? { ...board, name } : board,
                ),
              )
            }
            onDelete={() => {
              setBoards((current) =>
                current.filter((board) => board.id !== activeBoard.id),
              );
              navigate({ name: "boards" });
              showToast("Board deleted");
            }}
            onBack={() => navigate({ name: "boards" })}
            showToast={showToast}
          />
        ) : null}

        {route.name === "chat" && activeChat ? (
          <ChatView
            chat={activeChat}
            chatOpen={chatOpen}
            setChatOpen={setChatOpen}
            isGenerating={generatingChatId === activeChat.id}
            prompt={chatPrompt}
            setPrompt={setChatPrompt}
            onGenerate={submitChatComposer}
            onOpenDesign={(design, editing) =>
              openDesign(design, "chat", editing)
            }
            onCardAction={handleCardAction}
            onRename={(title) =>
              setProjects((current) =>
                current.map((project) =>
                  project.id === activeChat.id ? { ...project, title } : project,
                ),
              )
            }
            onDelete={() => {
              setProjects((current) =>
                current.filter((project) => project.id !== activeChat.id),
              );
              setDetail(null);
              navigate({ name: "projects" });
              showToast("Project deleted");
            }}
            onLike={(design) => toggleInSet(setLiked, design.id)}
            onBookmark={openSave}
            liked={liked}
            bookmarked={bookmarked}
            selected={selected}
            onToggleSelected={(design) => toggleInSet(setSelected, design.id)}
            onBackToProjects={() => navigate({ name: "projects" })}
            showToast={showToast}
            contextChips={chatChips}
          />
        ) : null}
      </div>

      {route.name !== "chat" ? (
        <div className="global-composer">
          <Composer
            value={globalPrompt}
            onChange={setGlobalPrompt}
            onSubmit={submitGlobalComposer}
            placeholder="Get endless designs for..."
            onShareCode={(code) => {
              setGlobalPrompt("");
              showToast(`Opening shared design ${code}`);
            }}
          />
        </div>
      ) : null}

      {detail ? (
        <DesignDetail
          design={detail.design}
          source={detail.source}
          editing={detail.editing}
          leftOffset={
            detail.source === "chat"
              ? chatOpen || window.innerWidth <= 764
                ? (sidebarExpanded ? 208 : 52) + 380
                : sidebarExpanded
                  ? 208
                  : 52
              : sidebarExpanded
                ? 208
                : 52
          }
          liked={liked.has(detail.design.id)}
          bookmarked={bookmarked.has(detail.design.id)}
          selectedElement={selectedElement}
          onSelectElement={setSelectedElement}
          onClose={() => {
            setDetail(null);
            setSelectedElement(null);
          }}
          onLike={() => toggleInSet(setLiked, detail.design.id)}
          onBookmark={() => openSave(detail.design)}
          onDelete={() => {
            handleCardAction("delete", detail.design);
            setDetail(null);
          }}
          onNewChat={() => makeNewChatFromDesign(detail.design)}
          showToast={showToast}
        />
      ) : null}

      <SettingsModal
        open={modal === "settings"}
        onClose={() => setModal(null)}
        user={user}
        onChangeUser={(patch) => setUser((current) => ({ ...current, ...patch }))}
        onOpenBilling={() => setModal("billing")}
        showToast={showToast}
      />
      <BillingModal
        open={modal === "billing"}
        onClose={() => setModal(null)}
        showToast={showToast}
      />
      <FeedbackModal
        open={modal === "feedback"}
        onClose={() => setModal(null)}
        showToast={showToast}
      />
      <TermsModal open={modal === "terms"} onClose={() => setModal(null)} />

      {saveDesignId ? (
        <div className="save-overlay" onMouseDown={() => setSaveDesignId(null)}>
          <div className="save-popover" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <span>Save design</span>
              <button type="button" onClick={() => setSaveDesignId(null)}>×</button>
            </header>
            <button type="button" className="save-row" onClick={() => saveToBoard("board-default")}>
              <span className="save-thumb" />
              <span><b>Saved</b> to All saved</span>
              {bookmarked.has(saveDesignId) ? <span>✓</span> : null}
            </button>
            {boards
              .filter((board) => board.id !== "board-default")
              .map((board) => (
                <button
                  type="button"
                  className="save-row"
                  key={board.id}
                  onClick={() => saveToBoard(board.id)}
                >
                  <span className="save-board-icon">▣</span>
                  <span>{board.name}</span>
                  {board.designIds.includes(saveDesignId) ? <span>✓</span> : null}
                </button>
              ))}
            <form
              className="save-new-board"
              onSubmit={(event) => {
                event.preventDefault();
                if (!newBoardName.trim()) return;
                const board = {
                  id: `board-${Date.now().toString(36)}`,
                  name: newBoardName.trim(),
                  designIds: [saveDesignId],
                };
                setBoards((current) => [...current, board]);
                setBookmarked((current) => new Set(current).add(saveDesignId));
                setNewBoardName("");
                setSaveDesignId(null);
                showToast(`Saved to ${board.name}`);
              }}
            >
              <span>+</span>
              <input
                value={newBoardName}
                onChange={(event) => setNewBoardName(event.target.value)}
                placeholder="New board..."
              />
            </form>
          </div>
        </div>
      ) : null}

      <Toast message={toast} onDismiss={() => setToast(null)} />
    </div>
  );
}

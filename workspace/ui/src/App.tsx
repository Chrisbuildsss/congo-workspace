import { useCallback, useEffect, useRef, useState } from "react";
import Composer, { type ComposerValues } from "./components/Composer";
import { AboutModal } from "./components/AppModals";
import { Sidebar } from "./components/AppShell";
import type { CardAction } from "./components/DesignCard";
import { Toast } from "./components/Ui";
import { ContentOrigin, designUrl } from "./DesignFrame";
import { LogoMark } from "./Icons";
import { api, getState, getStatus, saveTray, token } from "./api";
import type { Compose, Design, ThemeSetting, Tray, TrayItem, ViewName, WorkspaceState, WorkspaceStatus } from "./types";
import PrototypesView from "./views/Prototypes";
import DesignDetail from "./views/DesignDetail";
import LibraryView, { trayKey, type LibraryMode } from "./views/Library";
import RequestTray from "./components/RequestTray";
import LiveAppView from "./views/LiveApp";
import ProjectsView from "./views/Projects";
import ProjectDetail from "./views/ProjectDetail";
import SavePopover from "./components/SavePopover";

type Route =
  | { name: "compose"; id?: string }
  | { name: "library"; mode: LibraryMode; app?: string }
  | { name: "projects"; id?: string }
  | { name: "live" };

function parseRoute(path: string): Route {
  const [, first, second, third] = path.split("/");
  // Prototypes is the former Compose; old /compose links still land there.
  if (first === "prototypes" || first === "compose") return { name: "compose" };
  if (first === "projects") return { name: "projects", id: second || undefined };
  if (first === "live") return { name: "live" };
  // Explore is the former Library; old /library links still work.
  const explore = first === "explore" || first === "library";
  if (explore && second === "screens") return { name: "library", mode: "screens" };
  if (explore && second === "saved") return { name: "library", mode: "saved" };
  if (explore && second === "apps" && third) {
    return { name: "library", mode: "apps", app: decodeURIComponent(third) };
  }
  return { name: "library", mode: "apps" };
}

function routePath(route: Route) {
  if (route.name === "compose") return "/prototypes";
  if (route.name === "projects") return route.id ? `/projects/${route.id}` : "/projects";
  if (route.name === "live") return "/live";
  if (route.app) return `/explore/apps/${encodeURIComponent(route.app)}`;
  return route.mode === "screens" ? "/explore/screens" : route.mode === "saved" ? "/explore/saved" : "/explore";
}

function scrollTop() {
  document.querySelector(".main-scroll")?.scrollTo({ top: 0 });
}

function applyTheme(theme: ThemeSetting) {
  const root = document.documentElement;
  if (theme === "system") root.removeAttribute("data-theme");
  else root.setAttribute("data-theme", theme);
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function NoToken() {
  return (
    <div className="auth-screen workspace-locked">
      <div className="auth-panel">
        <LogoMark size={28} />
        <h1>Open the workspace from your computer</h1>
        <p>
          Run <code>congo workspace</code>, or ask your AI to open the Congo workspace. The
          link it opens carries this session's key.
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute(window.location.pathname));
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [state, setState] = useState<WorkspaceState | null>(null);
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [offline, setOffline] = useState(false);
  const [globalPrompt, setGlobalPrompt] = useState("");
  const [chatPrompt, setChatPrompt] = useState("");
  // On a phone the prototypes come first; the conversation opens from the header.
  const [chatOpen, setChatOpen] = useState(() => window.innerWidth > 764);
  const [detail, setDetail] = useState<{
    design: Design;
    context?: string;
    editing?: boolean;
    /** Edit found a script bundle; the center button becomes Make editable. */
    bundled?: boolean;
    /** A whole-app prototype edited on its source's dev server. */
    appEdit?: boolean;
    /** An Explore item shown running (its hosted preview) instead of its screenshot. */
    preview?: boolean;
  } | null>(null);
  const [briefOpen, setBriefOpen] = useState(false);
  const [pullFor, setPullFor] = useState<Design | null>(null);
  const [pullFolder, setPullFolder] = useState("");
  // The request tray (kept in the workspace) and where Send's result is for.
  const [tray, setTrayState] = useState<Tray>({ items: [], note: "" });
  const trayLoaded = useRef(false);
  const trayTimer = useRef<number | undefined>(undefined);
  const [trayAppId, setTrayAppId] = useState<string | null | undefined>(undefined);
  const [protoAppId, setProtoAppId] = useState<string | null | undefined>(undefined);
  const [renameFor, setRenameFor] = useState<Design | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [deleteFor, setDeleteFor] = useState<Design | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aboutOpen, setAboutOpen] = useState(false);
  const [saveFor, setSaveFor] = useState<Design | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const stopped = useRef(false);
  const hasToken = Boolean(token());

  const showToast = useCallback((message: string) => setToast(message), []);
  // Stable, so the toast's timer is not restarted by every poll re-render.
  const dismissToast = useCallback(() => setToast(null), []);

  const navigate = useCallback((next: Route, replace = false) => {
    setRoute(next);
    setDetail(null);
    const path = routePath(next);
    if (window.location.pathname !== path) {
      window.history[replace ? "replaceState" : "pushState"]({}, "", path);
    }
    window.setTimeout(scrollTop, 0);
  }, []);

  const refresh = useCallback(async () => {
    if (stopped.current) return;
    try {
      const [nextState, nextStatus] = await Promise.all([getState(), getStatus()]);
      setState(nextState);
      setStatus(nextStatus);
      setOffline(false);
    } catch {
      setOffline(true);
    }
  }, []);

  useEffect(() => {
    if (!hasToken) return;
    void refresh();
    const timer = window.setInterval(() => void refresh(), 2500);
    return () => window.clearInterval(timer);
  }, [hasToken, refresh]);

  useEffect(() => {
    if (window.location.pathname === "/") window.history.replaceState({}, "", "/explore");
    const onPopState = () => {
      setDetail(null);
      setRoute(parseRoute(window.location.pathname));
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  useEffect(() => {
    applyTheme(state?.settings.theme ?? "system");
  }, [state?.settings.theme]);

  useEffect(() => {
    if (!hasToken) return;
    void api("/api/view", { view: route.name }).catch(() => {});
  }, [hasToken, route.name]);

  // The tray comes from the workspace once; after that this tab keeps it and
  // saves each change, so a reload or a reopened workspace loses nothing.
  useEffect(() => {
    if (!state || trayLoaded.current) return;
    trayLoaded.current = true;
    if (state.tray) {
      setTrayState(state.tray);
      setGlobalPrompt(state.tray.note ?? "");
    }
  }, [state]);

  const pendingTray = useRef<Tray | null>(null);
  const setTray = useCallback((next: Tray) => {
    setTrayState(next);
    pendingTray.current = next;
    window.clearTimeout(trayTimer.current);
    trayTimer.current = window.setTimeout(() => {
      pendingTray.current = null;
      void saveTray(next).catch(() => {});
    }, 300);
  }, []);

  // A reload or a closed tab still saves the last change.
  useEffect(() => {
    const flush = () => {
      if (!pendingTray.current) return;
      void fetch("/api/tray", {
        method: "POST",
        keepalive: true,
        headers: { Authorization: `Bearer ${token()}`, "Content-Type": "application/json" },
        body: JSON.stringify(pendingTray.current),
      }).catch(() => {});
      pendingTray.current = null;
    };
    window.addEventListener("pagehide", flush);
    return () => window.removeEventListener("pagehide", flush);
  }, []);

  if (!hasToken) return <NoToken />;

  const aiConnected = Boolean(status?.ai.connected);
  const activeCompose = null as Compose | null;
  const appIds = new Set(state?.apps.map((app) => app.id) ?? []);
  const pickApp = (choice: string | null | undefined) =>
    choice === undefined || (choice !== null && !appIds.has(choice)) ? state?.activeAppId ?? null : choice;
  const trayDestination = pickApp(trayAppId);
  const prototypesAppId = pickApp(protoAppId);
  const traySelected = new Set(tray.items.map(trayKey));
  const toggleTray = (item: TrayItem) => {
    const key = trayKey(item);
    setTray(
      traySelected.has(key)
        ? { ...tray, items: tray.items.filter((entry) => trayKey(entry) !== key) }
        : { ...tray, items: [...tray.items, item] },
    );
  };
  const designsFor = (ids: string[]) =>
    ids.map((id) => state?.designs[id]).filter((d): d is Design => Boolean(d));
  const bookmarked = new Set(state?.projects.flatMap((p) => p.designIds) ?? []);
  const activeProject =
    route.name === "projects" && route.id && state ? state.projects.find((p) => p.id === route.id) ?? null : null;

  /** Project changes return the new state; `withState` handles both response shapes. */
  const projectCall = async (path: string, body: Record<string, unknown>, nested = true) => {
    try {
      const result = await api<{ state?: WorkspaceState } & WorkspaceState>(path, body);
      setState(nested && result.state ? result.state : (result as WorkspaceState));
      return true;
    } catch (error) {
      showToast((error as Error).message);
      return false;
    }
  };

  const attachApp = async (path: string) => {
    try {
      const result = await api<{ state: WorkspaceState }>("/api/apps", { path });
      setState(result.state);
      return true;
    } catch (error) {
      showToast((error as Error).message);
      return false;
    }
  };

  /**
   * Edit: Impeccable adds its live editor to the page; the frame reloads with
   * it. A whole-app prototype is edited on its source's dev server instead,
   * which the AI starts; the card's build is refreshed when editing ends.
   */
  const editDesign = async (design: Design) => {
    if (detail?.editing) {
      setDetail({ ...detail, editing: false, appEdit: false });
      if (detail.appEdit) {
        try {
          const result = await api<{ rebuild: string | null; state: WorkspaceState }>("/api/edit/stop", { designId: design.id });
          setState(result.state);
          if (result.rebuild) showToast("Your AI is rebuilding the prototype with your edits");
        } catch (error) {
          showToast((error as Error).message);
        }
      }
      return;
    }
    try {
      const result = await api<{
        editable?: false;
        reason?: string;
        mode?: "app";
        url?: string | null;
        switched?: string | null;
        listening?: boolean;
        state?: WorkspaceState;
      }>("/api/edit", { designId: design.id });
      if (result.state) setState(result.state);
      if (result.mode === "app") {
        setDetail((current) => (current ? { ...current, editing: true, appEdit: true } : current));
        showToast(result.url ? "Impeccable's editor is on. Select something in the page." : "Asked your AI to start this prototype with Impeccable's editor");
        return;
      }
      if (result.editable === false) {
        setDetail((current) => (current ? { ...current, bundled: true } : current));
        showToast(result.reason ?? "Impeccable can't select parts of this design");
        return;
      }
      setDetail((current) => (current ? { ...current, editing: true } : current));
      showToast(
        result.switched
          ? "Asked your AI to come back to the workspace for editing"
          : "Impeccable's editor is on. Select something in the page.",
      );
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const saveDesign = async (target: { projectId?: string; newProjectName?: string; appId?: string | null }) => {
    if (!saveFor) return;
    try {
      const result = await api<{ project: { name: string }; state: WorkspaceState }>("/api/projects/save", {
        ...target,
        design: saveFor,
      });
      setState(result.state);
      setSaveFor(null);
      showToast(`Saved to ${result.project.name}`);
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const setTheme = async (theme: ThemeSetting) => {
    applyTheme(theme);
    try {
      setState(await api<WorkspaceState>("/api/settings", { theme }));
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const updateCompose = async (patch: { title?: string; appId?: string | null }) => {
    if (!activeCompose) return;
    try {
      const result = await api<{ state: WorkspaceState }>("/api/composes/update", { id: activeCompose.id, ...patch });
      setState(result.state);
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const sendRequest = async (body: Record<string, unknown>, openPrototypes = false, toast = "Sent to your AI") => {
    try {
      const result = await api<{ composeId: string; state: WorkspaceState }>("/api/requests", body);
      setState(result.state);
      if (openPrototypes) {
        navigate({ name: "compose" });
        setChatOpen(window.innerWidth > 764);
      }
      showToast(toast);
      return result;
    } catch (error) {
      showToast((error as Error).message);
      return null;
    }
  };

  const attachmentOf = async (values: ComposerValues) =>
    values.attachment ? { name: values.attachment.name, dataUrl: await fileToDataUrl(values.attachment.file) } : undefined;

  /** A request typed in Prototypes: a new group, one prototype by default. */
  const send = async (values: ComposerValues) => {
    if (!aiConnected) {
      showToast("Connect your AI first");
      return;
    }
    try {
      const title = values.text.split(/[.!?\n]/)[0].slice(0, 60) || undefined;
      const created = await api<{ compose: Compose; state: WorkspaceState }>("/api/composes", { title, appId: values.appId });
      const result = await sendRequest({
        type: "compose",
        composeId: created.compose.id,
        text: values.text,
        appId: values.appId,
        attachment: await attachmentOf(values),
      });
      if (result) setChatPrompt("");
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  /** Send from the Explore tray: the selected items, their notes and the request note. */
  const sendTray = async (values: ComposerValues) => {
    if (!aiConnected) {
      showToast("Connect your AI first");
      return;
    }
    const result = await sendRequest(
      { type: "send", items: tray.items, note: values.text, appId: values.appId, attachment: await attachmentOf(values), fromTray: true },
      true,
      "Sent to your AI. The prototype appears here.",
    );
    if (result) {
      setTray({ items: [], note: "" });
      setGlobalPrompt("");
    }
  };

  const designApp = (design: Design) => {
    const compose = state?.composes.find((c) => c.designIds.includes(design.id));
    return compose?.appId ? state?.apps.find((app) => app.id === compose.appId) ?? null : null;
  };

  /**
   * Pull into a project: the only action that changes a code project. The
   * person chooses an attached project, a folder to attach, or a new project.
   */
  const pullDesign = async (design: Design, target: { appId: string | null; folder?: string }) => {
    let appId = target.appId;
    try {
      if (target.folder) {
        const attached = await api<{ app: { id: string }; state: WorkspaceState }>("/api/apps", { path: target.folder });
        setState(attached.state);
        appId = attached.app.id;
      }
    } catch (error) {
      showToast((error as Error).message);
      return;
    }
    const app = state?.apps.find((item) => item.id === appId);
    const compose = state?.composes.find((c) => c.designIds.includes(design.id));
    const result = await sendRequest(
      { type: "build", designId: design.id, composeId: compose?.id, appId },
      false,
      appId ? `Your AI is pulling it into ${app?.name ?? "your project"}` : "Your AI is creating a new project from it",
    );
    if (result) {
      setPullFor(null);
      setPullFolder("");
    }
  };

  /** Opening a prototype or a preview fills the workspace: the side panel closes. */
  const openDetail = (next: NonNullable<typeof detail>) => {
    setChatOpen(false);
    setBriefOpen(false);
    setDetail(next);
  };

  const handleCardAction = (action: CardAction, design: Design) => {
    if (action === "preview") {
      // Explore: the running item, full size, in its own tab. Congo's preview
      // host only lets Congo's own sites embed previews, so a local workspace
      // cannot show them in a frame.
      const url = design.local ? designUrl(design, status?.contentOrigin ?? "") : design.previewUrl;
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else showToast("No preview for this item");
      return;
    }
    if (action === "open" || action === "edit") {
      openDetail({ design, context: design.local ? "Prototypes" : design.author });
      return;
    }
    if (action === "delete") {
      setDeleteFor(design);
      return;
    }
    if (action === "rename") {
      setRenameValue(design.title);
      setRenameFor(design);
      return;
    }
    if (!aiConnected) {
      showToast("Actions need a connected AI");
      return;
    }
    if (!design.local) {
      // Library item: your AI fetches the source and adapts it outside your project.
      const item = {
        kind: design.source?.kind ?? "screen",
        id: design.source?.id ?? design.id,
        version: design.source?.version,
        app: design.source?.app,
        title: design.title,
        preview: design.previewUrl ?? undefined,
      };
      void sendRequest({ type: "library", item, action, appId: trayDestination }, true, "Sent to your AI. The prototype appears here.");
      return;
    }
    if (action === "build") {
      setPullFolder("");
      setPullFor(design);
      return;
    }
    if (action === "expand") {
      void sendRequest({ type: "expand", designId: design.id }, false, "Your AI is building out the rest of the app");
      return;
    }
    // Quick actions make a new prototype beside the original.
    void sendRequest({ type: "tweak", designId: design.id, action });
  };

  const renameDesign = async () => {
    if (!renameFor) return;
    const title = renameValue.trim();
    if (!title) return;
    try {
      setState(await api<WorkspaceState>("/api/designs/rename", { id: renameFor.id, title }));
      setRenameFor(null);
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const deleteDesign = async () => {
    if (!deleteFor) return;
    try {
      setState(await api<WorkspaceState>("/api/designs/delete", { id: deleteFor.id }));
      if (detail?.design.id === deleteFor.id) setDetail(null);
      setDeleteFor(null);
      showToast("Prototype deleted");
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const toggleSelected = (design: Design) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(design.id)) next.delete(design.id);
      else next.add(design.id);
      return next;
    });

  const stopWorkspace = async () => {
    try {
      await api("/api/stop", {});
      stopped.current = true;
      setOffline(true);
    } catch (error) {
      showToast((error as Error).message);
    }
  };

  const sidebarWidth = sidebarExpanded ? 208 : 52;

  return (
    <ContentOrigin.Provider value={status?.contentOrigin ?? ""}>
      <div className={`app-shell ${sidebarExpanded ? "sidebar-expanded" : "sidebar-collapsed"}`}>
        <Sidebar
          current={route.name}
          status={status}
          theme={state?.settings.theme ?? "system"}
          expanded={sidebarExpanded}
          showMobileTrigger={!detail}
          onToggle={() => setSidebarExpanded((expanded) => !expanded)}
          onNavigate={(name: ViewName) =>
            navigate(name === "library" ? { name: "library", mode: "apps" } : ({ name } as Route))
          }
          onCompose={() => navigate({ name: "compose" })}
          onTheme={(theme) => void setTheme(theme)}
          onOpenAbout={() => setAboutOpen(true)}
          onStop={() => void stopWorkspace()}
        />

        <div className="app-content">
          {offline ? (
            <div className="workspace-banner" role="status">
              {stopped.current
                ? "The workspace stopped. Run congo workspace to open it again."
                : "Reconnecting to the workspace…"}
            </div>
          ) : null}

          {route.name === "library" ? (
            <LibraryView
              mode={route.mode}
              appSlug={route.app}
              aiConnected={aiConnected}
              onMode={(mode) => navigate({ name: "library", mode })}
              onOpenApp={(slug) => navigate({ name: "library", mode: "apps", app: slug })}
              onBack={() => navigate({ name: "library", mode: "apps" })}
              onOpenItem={(design, context) => openDetail({ design, context })}
              onAction={handleCardAction}
              selected={traySelected}
              onToggleSelect={toggleTray}
            />
          ) : null}

          {route.name === "projects" && !route.id && state ? (
            <ProjectsView
              projects={state.projects}
              designs={state.designs}
              apps={state.apps}
              onOpenProject={(project) => navigate({ name: "projects", id: project.id })}
            />
          ) : null}

          {route.name === "projects" && route.id && state ? (
            activeProject ? (
              <ProjectDetail
                key={activeProject.id}
                project={activeProject}
                designs={designsFor(activeProject.designIds)}
                apps={state.apps}
                aiConnected={aiConnected}
                onBack={() => navigate({ name: "projects" })}
                onRename={(name) => void projectCall("/api/projects/update", { id: activeProject.id, name })}
                onDelete={async () => {
                  if (await projectCall("/api/projects/delete", { id: activeProject.id }, false)) {
                    navigate({ name: "projects" });
                    showToast("Project deleted");
                  }
                }}
                onOpenDesign={(design) => setDetail({ design, context: activeProject.name })}
                onAction={handleCardAction}
                onRemove={(design) => {
                  void projectCall("/api/projects/remove", { projectId: activeProject.id, designId: design.id }, false).then(
                    (ok) => ok && showToast(`Removed from ${activeProject.name}`),
                  );
                }}
              />
            ) : (
              <div className="library-error">That project no longer exists.</div>
            )
          ) : null}

          {route.name === "live" && state ? (
            <LiveAppView
              status={status}
              apps={state.apps}
              activeAppId={state.activeAppId}
              requests={state.requests.filter((r) => (r.type === "start-app" || r.type === "live-edit") && !r.designId && r.appId === state.activeAppId)}
              onPickApp={(id) => {
                const app = state.apps.find((item) => item.id === id);
                if (app) void attachApp(app.path);
              }}
              onAttach={attachApp}
              onAskAI={() => void sendRequest({ type: "start-app", appId: state.activeAppId })}
              onEdit={() => void sendRequest({ type: "live-edit", appId: state.activeAppId })}
              showToast={showToast}
              applying={(() => {
                const pending = state.requests.find((r) => r.type === "build" && r.status === "sent");
                return pending ? state.designs[pending.designId ?? ""]?.title ?? "a prototype" : null;
              })()}
            />
          ) : null}

          {route.name === "compose" && state ? (
            <PrototypesView
              composes={state.composes}
              designs={state.designs}
              apps={state.apps}
              appId={prototypesAppId}
              aiConnected={aiConnected}
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
              prompt={chatPrompt}
              setPrompt={setChatPrompt}
              onSend={(values) => void send(values)}
              requests={state.requests}
              onAppChange={setProtoAppId}
              onOpenDesign={(design) => openDetail({ design, context: "Prototypes" })}
              onCardAction={handleCardAction}
            />
          ) : null}
        </div>

        {route.name === "library" ? (
          <div className="global-composer">
            <Composer
              value={globalPrompt}
              onChange={(value) => {
                setGlobalPrompt(value);
                setTray({ ...tray, note: value });
              }}
              onSubmit={(values) => void sendTray(values)}
              placeholder={tray.items.length ? "A note for the whole request (optional)..." : "Select apps or screens, or describe what to build..."}
              apps={state?.apps ?? []}
              appId={trayDestination}
              onAppChange={setTrayAppId}
              noAppLabel="A new app"
              noAppHint="A prototype for something new"
              hasItems={tray.items.length > 0}
              header={
                <RequestTray
                  items={tray.items}
                  onNote={(item, note) =>
                    setTray({ ...tray, items: tray.items.map((entry) => (trayKey(entry) === trayKey(item) ? { ...entry, note } : entry)) })
                  }
                  onRemove={(item) => setTray({ ...tray, items: tray.items.filter((entry) => trayKey(entry) !== trayKey(item)) })}
                  onClear={() => setTray({ ...tray, items: [] })}
                />
              }
              disabled={!aiConnected}
              note={aiConnected ? undefined : "Sending needs a connected AI"}
            />
          </div>
        ) : null}

        {detail
          ? (() => {
              // Live state for this prototype (its edit address arrives while editing).
              const design = (detail.design.local && state?.designs[detail.design.id]) || detail.design;
              const lastEdit = detail.appEdit
                ? state?.requests.find((r) => r.type === "live-edit" && r.designId === design.id) ?? null
                : null;
              const editFailed = Boolean(detail.appEdit && lastEdit?.status === "error");
              const describe = design.local && (detail.bundled || editFailed)
                ? (text: string) => {
                    void sendRequest(
                      { type: "tweak", designId: design.id, action: `custom:${text}` },
                      false,
                      "Your AI makes the change as a new prototype; this one stays",
                    );
                  }
                : undefined;
              return (
                <DesignDetail
                  design={design}
                  contextLabel={detail.context}
                  leftOffset={
                    route.name === "compose" ? (chatOpen && window.innerWidth > 764 ? sidebarWidth + 380 : sidebarWidth) : sidebarWidth
                  }
                  editDisabledReason={aiConnected ? undefined : "Edit needs a connected AI"}
                  openUrl={design.previewUrl ?? (design.local ? designUrl(design, status?.contentOrigin ?? "") : null)}
                  onClose={() => {
                    if (detail.appEdit && detail.editing) void editDesign(design);
                    setDetail(null);
                  }}
                  editing={Boolean(detail.editing)}
                  onEdit={design.local ? () => void editDesign(design) : undefined}
                  onMakeEditable={
                    detail.bundled && !design.sourceDir
                      ? () => {
                          setDetail(null);
                          handleCardAction("editable", design);
                        }
                      : undefined
                  }
                  onPull={design.local ? () => { setPullFolder(""); setPullFor(design); } : undefined}
                  onExpand={design.local && design.status === "main" && aiConnected ? () => handleCardAction("expand", design) : undefined}
                  expanding={design.status === "expanding"}
                  briefOpen={briefOpen}
                  onBrief={design.brief ? () => setBriefOpen((value) => !value) : undefined}
                  panelOpen={route.name === "compose" ? chatOpen : undefined}
                  onPanel={route.name === "compose" ? () => setChatOpen(!chatOpen) : undefined}
                  onPrototype={!design.local && aiConnected ? () => handleCardAction("use", design) : undefined}
                  frameDesign={
                    detail.appEdit && design.editUrl
                      ? { ...design, src: design.editUrl }
                      : detail.preview && design.previewUrl
                        ? { ...design, src: design.previewUrl, image: undefined }
                        : undefined
                  }
                  waitingNote={
                    detail.appEdit && detail.editing && !design.editUrl && !editFailed
                      ? "Your AI is starting this prototype's source with Impeccable's editor. It appears here when it's ready."
                      : undefined
                  }
                  onDescribe={describe}
                  describeNote={
                    editFailed
                      ? `Impeccable's editor couldn't run on this prototype${lastEdit?.message ? ` (${lastEdit.message})` : ""}. Describe the change and your AI makes it.`
                      : detail.bundled
                        ? "Impeccable's editor can't select parts of this built page. Describe the change and your AI makes it, or use Make editable."
                        : undefined
                  }
                />
              );
            })()
          : null}

        {renameFor ? (
          <div className="confirm-overlay" onMouseDown={() => setRenameFor(null)}>
            <form
              className="confirm-card"
              onMouseDown={(event) => event.stopPropagation()}
              onSubmit={(event) => {
                event.preventDefault();
                void renameDesign();
              }}
            >
              <h2>Rename prototype</h2>
              <div className="library-search confirm-input">
                <input
                  autoFocus
                  value={renameValue}
                  maxLength={120}
                  onChange={(event) => setRenameValue(event.target.value)}
                  aria-label="Prototype name"
                />
              </div>
              <div>
                <button type="button" onClick={() => setRenameFor(null)}>Cancel</button>
                <button type="submit">Rename</button>
              </div>
            </form>
          </div>
        ) : null}

        {deleteFor ? (
          <div className="confirm-overlay" onMouseDown={() => setDeleteFor(null)}>
            <div className="confirm-card" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Delete this prototype?</h2>
              <p>“{deleteFor.title}” is removed from its Congo file{deleteFor.file ? ` (${deleteFor.file})` : ""}, with its source and preview. No code project is touched.</p>
              <div>
                <button type="button" onClick={() => setDeleteFor(null)}>Cancel</button>
                <button type="button" className="danger" onClick={() => void deleteDesign()}>Delete</button>
              </div>
            </div>
          </div>
        ) : null}

        {pullFor && state ? (
          <div className="confirm-overlay" onMouseDown={() => setPullFor(null)}>
            <div className="confirm-card pull-card" onMouseDown={(event) => event.stopPropagation()}>
              <h2>Pull into a project</h2>
              <p>
                Your AI puts “{pullFor.title}” into a code project. The prototype stays in its Congo file. Nothing else in the
                project changes.
              </p>
              <ul className="pull-list">
                {state.apps.map((app) => (
                  <li key={app.id}>
                    <button type="button" disabled={!aiConnected} onClick={() => void pullDesign(pullFor, { appId: app.id })}>
                      <b>{app.name}</b>
                      <small>{app.path}</small>
                    </button>
                  </li>
                ))}
                <li>
                  <button type="button" disabled={!aiConnected} onClick={() => void pullDesign(pullFor, { appId: null })}>
                    <b>A new project</b>
                    <small>Your AI creates it with congo create and tells you where it is</small>
                  </button>
                </li>
              </ul>
              <form
                className="library-search confirm-input"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (pullFolder.trim()) void pullDesign(pullFor, { appId: null, folder: pullFolder.trim() });
                }}
              >
                <input
                  value={pullFolder}
                  onChange={(event) => setPullFolder(event.target.value)}
                  placeholder="Or paste an existing project folder and press Enter"
                  aria-label="Existing project folder"
                />
              </form>
              <div>
                {aiConnected ? null : <span className="composer-note">Needs a connected AI</span>}
                <button type="button" onClick={() => setPullFor(null)}>Cancel</button>
              </div>
            </div>
          </div>
        ) : null}

        {saveFor && state ? (
          <SavePopover
            design={saveFor}
            projects={state.projects}
            apps={state.apps}
            defaultAppId={saveFor.appId ?? activeCompose?.appId ?? state.activeAppId}
            onSave={(target) => void saveDesign(target)}
            onClose={() => setSaveFor(null)}
          />
        ) : null}

        <AboutModal open={aboutOpen} onClose={() => setAboutOpen(false)} status={status} />
        <Toast message={toast} onDismiss={dismissToast} />
      </div>
    </ContentOrigin.Provider>
  );
}

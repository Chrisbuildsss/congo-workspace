import { useCallback, useEffect, useRef, useState } from "react";
import Composer, { type ComposerValues } from "./components/Composer";
import { AboutModal } from "./components/AppModals";
import { Sidebar } from "./components/AppShell";
import type { CardAction } from "./components/DesignCard";
import { Toast } from "./components/Ui";
import { ContentOrigin, designUrl } from "./DesignFrame";
import { LogoMark } from "./Icons";
import { api, getState, getStatus, token } from "./api";
import type { Compose, Design, ThemeSetting, ViewName, WorkspaceState, WorkspaceStatus } from "./types";
import ComposeView from "./views/Compose";
import DesignDetail from "./views/DesignDetail";
import LibraryView, { type LibraryMode } from "./views/Library";
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
  if (first === "compose") return { name: "compose", id: second || undefined };
  if (first === "projects") return { name: "projects", id: second || undefined };
  if (first === "live") return { name: "live" };
  if (first === "library" && second === "screens") return { name: "library", mode: "screens" };
  if (first === "library" && second === "apps" && third) {
    return { name: "library", mode: "apps", app: decodeURIComponent(third) };
  }
  return { name: "library", mode: "apps" };
}

function routePath(route: Route) {
  if (route.name === "compose") return route.id ? `/compose/${route.id}` : "/compose";
  if (route.name === "projects") return route.id ? `/projects/${route.id}` : "/projects";
  if (route.name === "live") return "/live";
  if (route.app) return `/library/apps/${encodeURIComponent(route.app)}`;
  return route.mode === "screens" ? "/library/screens" : "/library";
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
  const [chatOpen, setChatOpen] = useState(true);
  const [detail, setDetail] = useState<{ design: Design; context?: string } | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aboutOpen, setAboutOpen] = useState(false);
  const [saveFor, setSaveFor] = useState<Design | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const stopped = useRef(false);
  const hasToken = Boolean(token());

  const showToast = useCallback((message: string) => setToast(message), []);

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
    if (window.location.pathname === "/") window.history.replaceState({}, "", "/library");
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

  const createCompose = useCallback(
    async (title?: string) => {
      const result = await api<{ compose: Compose; state: WorkspaceState }>("/api/composes", { title });
      setState(result.state);
      navigate({ name: "compose", id: result.compose.id });
      setChatOpen(true);
      return result.compose;
    },
    [navigate],
  );

  // /compose with no id opens the latest compose, or starts one.
  useEffect(() => {
    if (!state || route.name !== "compose" || route.id) return;
    const latest = state.composes[0];
    if (latest) navigate({ name: "compose", id: latest.id }, true);
    else void createCompose();
  }, [state, route, navigate, createCompose]);

  if (!hasToken) return <NoToken />;

  const aiConnected = Boolean(status?.ai.connected);
  const activeCompose =
    route.name === "compose" && state ? state.composes.find((c) => c.id === route.id) ?? null : null;
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

  const sendRequest = async (body: Record<string, unknown>, openCompose = false) => {
    try {
      const result = await api<{ composeId: string; state: WorkspaceState }>("/api/requests", body);
      setState(result.state);
      if (openCompose) {
        navigate({ name: "compose", id: result.composeId });
        setChatOpen(true);
      }
      showToast("Sent to your AI");
      return result;
    } catch (error) {
      showToast((error as Error).message);
      return null;
    }
  };

  const send = async (values: ComposerValues, composeId = activeCompose?.id) => {
    if (!composeId) return;
    if (!aiConnected) {
      showToast("Connect your AI first");
      return;
    }
    const attachment = values.attachment
      ? { name: values.attachment.name, dataUrl: await fileToDataUrl(values.attachment.file) }
      : undefined;
    const result = await sendRequest({ type: "compose", composeId, text: values.text, appId: values.appId, attachment });
    if (result) setChatPrompt("");
  };

  const handleCardAction = (action: CardAction, design: Design) => {
    if (action === "preview") {
      const url = design.previewUrl ?? (design.local ? designUrl(design, status?.contentOrigin ?? "") : null);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else showToast("No preview for this item");
      return;
    }
    if (action === "open" || action === "edit") {
      setDetail({ design, context: activeCompose?.title ?? design.author });
      return;
    }
    if (action === "delete") {
      void api<WorkspaceState>("/api/designs/delete", { id: design.id })
        .then((next) => {
          setState(next);
          if (detail?.design.id === design.id) setDetail(null);
          showToast("Design removed");
        })
        .catch((error: Error) => showToast(error.message));
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
      void sendRequest({ type: "library", item, action, appId: state?.activeAppId ?? null }, true);
      return;
    }
    if (action === "build") {
      void sendRequest({ type: "build", designId: design.id, composeId: activeCompose?.id });
      return;
    }
    void sendRequest({ type: "tweak", designId: design.id, action, composeId: activeCompose?.id });
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
          onCompose={() => void createCompose()}
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
              onOpenItem={(design, context) => setDetail({ design, context })}
              onSave={setSaveFor}
              saved={bookmarked}
              onAction={handleCardAction}
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

          {route.name === "live" ? <LiveAppView status={status} /> : null}

          {route.name === "compose" && activeCompose && state ? (
            <ComposeView
              compose={activeCompose}
              designs={designsFor(activeCompose.designIds)}
              apps={state.apps}
              aiConnected={aiConnected}
              chatOpen={chatOpen}
              setChatOpen={setChatOpen}
              prompt={chatPrompt}
              setPrompt={setChatPrompt}
              onSend={(values) => void send(values)}
              requests={state.requests.filter((r) => r.composeId === activeCompose.id)}
              onAppChange={(appId) => void updateCompose({ appId })}
              onOpenDesign={(design) => setDetail({ design, context: activeCompose.title })}
              onCardAction={handleCardAction}
              onRename={(title) => void updateCompose({ title })}
              onDelete={async () => {
                const next = await api<WorkspaceState>("/api/composes/delete", { id: activeCompose.id });
                setState(next);
                navigate({ name: "projects" });
                showToast("Compose deleted");
              }}
              onBookmark={setSaveFor}
              bookmarked={bookmarked}
              selected={selected}
              onToggleSelected={toggleSelected}
            />
          ) : null}
        </div>

        {route.name === "library" || route.name === "projects" ? (
          <div className="global-composer">
            <Composer
              value={globalPrompt}
              onChange={setGlobalPrompt}
              onSubmit={async (values) => {
                const compose = await createCompose(values.text.split(/[.!?\n]/)[0].slice(0, 40) || undefined);
                setGlobalPrompt("");
                await send(values, compose.id);
              }}
              placeholder="Ask your AI for designs..."
              apps={state?.apps ?? []}
              appId={state?.activeAppId ?? null}
              disabled={!aiConnected}
              note={aiConnected ? undefined : "Needs a connected AI"}
            />
          </div>
        ) : null}

        {detail ? (
          <DesignDetail
            design={detail.design}
            contextLabel={detail.context}
            leftOffset={
              route.name === "compose"
                ? chatOpen && window.innerWidth > 764
                  ? sidebarWidth + 380
                  : sidebarWidth
                : sidebarWidth
            }
            bookmarked={bookmarked.has(detail.design.id)}
            editDisabledReason={aiConnected ? undefined : "Edit needs a connected AI"}
            openUrl={
              detail.design.previewUrl ??
              (detail.design.local ? designUrl(detail.design, status?.contentOrigin ?? "") : null)
            }
            onClose={() => setDetail(null)}
            onBookmark={() => setSaveFor(detail?.design ?? null)}
            onEdit={detail.design.src ? () => showToast("Editing arrives with the Edit step") : undefined}
          />
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
        <Toast message={toast} onDismiss={() => setToast(null)} />
      </div>
    </ContentOrigin.Provider>
  );
}

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Topbar } from "../components/AppShell";
import { useClickOutside } from "../components/Ui";
import { CheckIcon, ChevronDownIcon, LinkIcon, PencilIcon } from "../Icons";
import { api } from "../api";
import type { AppRef, WorkspaceRequest, WorkspaceStatus } from "../types";

interface LiveState {
  app: AppRef | null;
  status?: "stopped" | "starting" | "running" | "exited";
  detected?: { ok: boolean; reason?: string; label?: string; needsInstall?: boolean };
  url?: string | null;
  output?: string[];
  exitCode?: number | null;
  startedBy?: "workspace" | "ai" | "user";
}

function AppPicker({
  apps,
  activeId,
  onPick,
  onAttach,
}: {
  apps: AppRef[];
  activeId: string | null;
  onPick: (id: string) => void;
  onAttach: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const active = apps.find((app) => app.id === activeId);
  return (
    <div className="library-switch" ref={ref}>
      <button type="button" className="library-switch-button" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        {active ? active.name : "Choose an app"}
        <ChevronDownIcon size={10} />
      </button>
      {open ? (
        <div className="composer-popover quality-popover" role="menu">
          {apps.map((app) => (
            <button
              type="button"
              key={app.id}
              role="menuitemradio"
              aria-checked={app.id === activeId}
              className="composer-option"
              data-selected={app.id === activeId || undefined}
              onClick={() => {
                onPick(app.id);
                setOpen(false);
              }}
            >
              <span className="option-radio">{app.id === activeId ? <CheckIcon size={11} /> : null}</span>
              <span>
                <b>{app.name}</b>
                <small>{app.path}</small>
              </span>
            </button>
          ))}
          <button
            type="button"
            className="composer-option"
            onClick={() => {
              setOpen(false);
              onAttach();
            }}
          >
            <span className="option-radio">+</span>
            <span>
              <b>Attach a folder</b>
              <small>Another app on this computer</small>
            </span>
          </button>
        </div>
      ) : null}
    </div>
  );
}

export default function LiveAppView({
  status,
  apps,
  activeAppId,
  requests,
  onPickApp,
  onAttach,
  onAskAI,
  onEdit,
  showToast,
  applying = null,
}: {
  status: WorkspaceStatus | null;
  apps: AppRef[];
  activeAppId: string | null;
  requests: WorkspaceRequest[];
  onPickApp: (id: string) => void;
  onAttach: (path: string) => Promise<boolean>;
  onAskAI: () => void;
  onEdit: () => void;
  showToast: (message: string) => void;
  /** A Use this the AI is still carrying out, if any. */
  applying?: string | null;
}) {
  const [live, setLive] = useState<LiveState>({ app: null });
  const [attaching, setAttaching] = useState(false);
  const [folder, setFolder] = useState("");
  const [address, setAddress] = useState("");
  const [frameKey, setFrameKey] = useState(0);
  const logRef = useRef<HTMLPreElement | null>(null);
  const aiConnected = Boolean(status?.ai.connected);

  const refresh = useCallback(async () => {
    try {
      setLive(await api<LiveState>("/api/live", { appId: activeAppId }));
    } catch {
      // The banner in the shell reports a lost workspace.
    }
  }, [activeAppId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 1500);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
  }, [live.output?.length]);

  // When the AI finishes turning on live editing, reload the app so
  // Impeccable's editor appears in it.
  const lastLiveEdit = requests.find((r) => r.type === "live-edit");
  useEffect(() => {
    if (lastLiveEdit?.status === "done") setFrameKey((key) => key + 1);
  }, [lastLiveEdit?.id, lastLiveEdit?.status]);

  const call = async (path: string, body: Record<string, unknown> = {}) => {
    try {
      setLive(await api<LiveState>(path, { appId: activeAppId, ...body }));
      return true;
    } catch (error) {
      showToast((error as Error).message);
      return false;
    }
  };

  const attach = async (event: FormEvent) => {
    event.preventDefault();
    if (!folder.trim()) return;
    if (await onAttach(folder.trim())) {
      setFolder("");
      setAttaching(false);
    }
  };

  const running = live.status === "running" && live.url;
  const starting = live.status === "starting";
  const pendingStart = requests.some((r) => r.type === "start-app" && r.status === "sent");
  const pendingEdit = requests.some((r) => r.type === "live-edit" && r.status === "sent");
  const editing = live.url && lastLiveEdit?.status === "done";
  const showAttach = attaching || apps.length === 0;

  const right = live.app ? (
    <div className="live-actions">
      <span className={`live-state is-${running ? "running" : starting ? "starting" : live.status ?? "stopped"}`}>
        {running ? "Running" : starting ? "Starting" : live.status === "exited" ? "Stopped" : "Not running"}
      </span>
      {running ? (
        <>
          <button
            type="button"
            className="detail-edit"
            data-active={editing || undefined}
            disabled={!aiConnected || pendingEdit}
            title={aiConnected ? undefined : "Edit needs a connected AI"}
            onClick={onEdit}
          >
            <PencilIcon size={13} />
            {pendingEdit ? "Turning on…" : editing ? "Editing" : "Edit"}
          </button>
          <a className="detail-tool" href={live.url!} target="_blank" rel="noopener noreferrer" aria-label="Open in a new tab">
            <LinkIcon />
          </a>
          {live.startedBy === "workspace" ? (
            <button type="button" className="detail-export" onClick={() => void call("/api/live/stop")}>
              Stop
            </button>
          ) : null}
        </>
      ) : starting ? (
        <button type="button" className="detail-export" onClick={() => void call("/api/live/stop")}>
          Stop
        </button>
      ) : null}
    </div>
  ) : null;

  return (
    <div className="main-scroll live-scroll">
      <Topbar
        left={
          apps.length ? (
            <AppPicker apps={apps} activeId={activeAppId} onPick={onPickApp} onAttach={() => setAttaching(true)} />
          ) : (
            <h1 className="app-topbar-title">My app</h1>
          )
        }
        right={right}
      />

      {applying ? (
        <div className="workspace-banner" role="status">
          Your AI is putting “{applying}” into your app. Follow along in its chat; start the app here when it says it's done.
        </div>
      ) : null}

      {running ? (
        <div className="live-frame">
          <iframe
            key={frameKey}
            src={live.url!}
            title={`${live.app?.name ?? "Your app"}, running`}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals allow-downloads"
          />
        </div>
      ) : (
        <div className="live-stage">
          <div className="chat-empty-state live-empty">
            <div className="empty-grid-glyph">
              <span /><span /><span /><span />
            </div>
            {showAttach ? (
              <form className="live-attach" onSubmit={attach}>
                <p>Attach your app: paste its folder on this computer.</p>
                <div className="library-search">
                  <input
                    value={folder}
                    onChange={(event) => setFolder(event.target.value)}
                    placeholder="C:\\path\\to\\your-app"
                    aria-label="App folder"
                  />
                </div>
                <div className="live-buttons">
                  <button type="submit" className="dialog-primary">Attach</button>
                  {apps.length ? (
                    <button type="button" className="detail-export" onClick={() => setAttaching(false)}>Cancel</button>
                  ) : null}
                </div>
              </form>
            ) : live.app ? (
              <>
                <p>
                  <b>{live.app.name}</b>{" "}
                  {live.detected?.ok ? (
                    <>
                      starts with <code>{live.detected.label}</code>.
                    </>
                  ) : (
                    <>has no dev command the workspace can run: {live.detected?.reason}.</>
                  )}
                </p>
                {live.detected?.ok && live.detected.needsInstall ? (
                  <p className="live-note">Its dependencies are not installed yet.</p>
                ) : null}
                <div className="live-buttons">
                  <button
                    type="button"
                    className="dialog-primary"
                    disabled={!live.detected?.ok || live.detected.needsInstall || starting}
                    onClick={() => void call("/api/live/start")}
                  >
                    {starting ? "Starting…" : "Start"}
                  </button>
                  <button
                    type="button"
                    className="detail-export"
                    disabled={!aiConnected || pendingStart}
                    title={aiConnected ? undefined : "Needs a connected AI"}
                    onClick={onAskAI}
                  >
                    {pendingStart ? "Asked your AI…" : "Ask my AI to start it"}
                  </button>
                </div>
                <form
                  className="live-address"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (address.trim()) void call("/api/live/url", { url: address.trim() }).then((ok) => ok && setAddress(""));
                  }}
                >
                  <input
                    value={address}
                    onChange={(event) => setAddress(event.target.value)}
                    placeholder="Already running? http://localhost:5173"
                    aria-label="Running app address"
                  />
                </form>
              </>
            ) : (
              <p>Choose an app above.</p>
            )}
          </div>
        </div>
      )}

      {live.output && live.output.length > 1 && !running ? (
        <pre className="live-log" ref={logRef} aria-label="Dev server output">
          {live.output.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}

import { Topbar } from "../components/AppShell";
import type { WorkspaceStatus } from "../types";

/** The user's running app. Starting it and live editing arrive with the Live App milestone. */
export default function LiveAppView({ status }: { status: WorkspaceStatus | null }) {
  const app = status?.app ?? null;
  return (
    <div className="main-scroll live-scroll">
      <Topbar title="Live App" right={app ? <span className="live-app-name">{app.name}</span> : null} />
      <div className="live-stage">
        <div className="chat-empty-state live-empty">
          <div className="empty-grid-glyph">
            <span /><span /><span /><span />
          </div>
          {app ? (
            <>
              <p>
                <b>{app.name}</b> is attached. Your app runs here once it is started.
              </p>
              <code className="live-path">{app.path}</code>
            </>
          ) : (
            <p>
              No app attached. Open the workspace from your project with <code>congo workspace --project .</code>,
              or ask your AI to attach it.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

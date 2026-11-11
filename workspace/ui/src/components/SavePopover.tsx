import { useState } from "react";
import type { AppRef, Design, Project } from "../types";

/** Variant's save popover, listing the user's Projects. */
export default function SavePopover({
  design,
  projects,
  apps,
  defaultAppId,
  onSave,
  onClose,
}: {
  design: Design;
  projects: Project[];
  apps: AppRef[];
  defaultAppId: string | null;
  onSave: (target: { projectId?: string; newProjectName?: string; appId?: string | null }) => void;
  onClose: () => void;
}) {
  const app = apps.find((item) => item.id === defaultAppId) ?? null;
  const [name, setName] = useState("");
  const appName = (id?: string | null) => apps.find((item) => item.id === id)?.name;

  return (
    <div className="save-overlay" onMouseDown={onClose}>
      <div
        className="save-popover"
        role="dialog"
        aria-label={`Save ${design.title}`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header>
          <span>Save to a project</span>
          <button type="button" aria-label="Close" onClick={onClose}>×</button>
        </header>
        {projects.map((project) => (
          <button
            type="button"
            className="save-row"
            key={project.id}
            onClick={() => onSave({ projectId: project.id })}
          >
            <span className="save-board-icon">▣</span>
            <span>
              <b>{project.name}</b>
              {appName(project.appId) ? <small className="save-row-app"> · {appName(project.appId)}</small> : null}
            </span>
            {project.designIds.includes(design.id) ? <span>✓</span> : null}
          </button>
        ))}
        {projects.length === 0 && app ? (
          <button
            type="button"
            className="save-row"
            onClick={() => onSave({ newProjectName: app.name, appId: app.id })}
          >
            <span className="save-board-icon">+</span>
            <span>
              <b>{app.name}</b> new project for this app
            </span>
          </button>
        ) : null}
        <form
          className="save-new-board"
          onSubmit={(event) => {
            event.preventDefault();
            if (!name.trim()) return;
            onSave({ newProjectName: name.trim(), appId: defaultAppId });
          }}
        >
          <span>+</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="New project..."
            aria-label="New project name"
          />
        </form>
      </div>
    </div>
  );
}

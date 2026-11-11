import { useState, type FormEvent } from "react";
import { Topbar } from "../components/AppShell";
import DesignCard, { type CardAction, type MenuItem, type QuickAction } from "../components/DesignCard";
import { useClickOutside } from "../components/Ui";
import { BackIcon, EllipsisIcon } from "../Icons";
import type { AppRef, Design, Project } from "../types";

const BUILD_THIS: QuickAction = { key: "build", label: "Build this", icon: "↗" };
const USE_THIS: QuickAction = { key: "use", label: "Use this", icon: "↘" };

const LOCAL_MENU: MenuItem[] = [
  { key: "open", label: "Open design" },
  { key: "preview", label: "Open in new tab" },
  { key: "delete", label: "Remove from project", danger: true },
];

const LIBRARY_MENU: MenuItem[] = [
  { key: "open", label: "Open" },
  { key: "preview", label: "Preview original" },
  { key: "delete", label: "Remove from project", danger: true },
];

export default function ProjectDetail({
  project,
  designs,
  apps,
  aiConnected,
  onBack,
  onRename,
  onDelete,
  onOpenDesign,
  onAction,
  onRemove,
}: {
  project: Project;
  designs: Design[];
  apps: AppRef[];
  aiConnected: boolean;
  onBack: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onOpenDesign: (design: Design) => void;
  onAction: (action: CardAction, design: Design) => void;
  onRemove: (design: Design) => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(project.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const app = apps.find((item) => item.id === project.appId) ?? null;
  const actionsNote = aiConnected ? undefined : "Needs a connected AI";

  const submitRename = (event?: FormEvent) => {
    event?.preventDefault();
    if (name.trim() && name.trim() !== project.name) onRename(name.trim());
    setRenaming(false);
  };

  return (
    <div className="main-scroll projects-scroll">
      <Topbar
        left={
          <div className="project-title">
            <button type="button" className="library-back" aria-label="Back to projects" onClick={onBack}>
              <BackIcon size={16} />
            </button>
            {renaming ? (
              <form className="chat-title-form" onSubmit={submitRename}>
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  onBlur={() => submitRename()}
                  aria-label="Project name"
                />
              </form>
            ) : (
              <button
                type="button"
                className="project-name"
                onClick={() => {
                  setName(project.name);
                  setRenaming(true);
                }}
              >
                {project.name}
              </button>
            )}
            {app ? <span className="project-app">{app.name}</span> : null}
          </div>
        }
        right={
          <div className="chat-options-wrap" ref={menuRef}>
            <button
              type="button"
              className="chat-header-icon"
              aria-label="Project menu"
              data-open={menuOpen || undefined}
              onClick={() => setMenuOpen((value) => !value)}
            >
              <EllipsisIcon />
            </button>
            {menuOpen ? (
              <div className="chat-options-menu">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setName(project.name);
                    setRenaming(true);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setMenuOpen(false);
                    setConfirmDelete(true);
                  }}
                >
                  Delete project
                </button>
              </div>
            ) : null}
          </div>
        }
      />

      <div className="community-grid">
        {designs.map((design) => (
          <DesignCard
            key={design.id}
            design={design}
            onOpen={() => onOpenDesign(design)}
            onAction={(action, item) => (action === "delete" ? onRemove(item) : onAction(action, item))}
            primary={design.local ? BUILD_THIS : USE_THIS}
            showMore={Boolean(design.local)}
            actionsDisabledNote={actionsNote}
            menuItems={design.local ? LOCAL_MENU : LIBRARY_MENU}
            showSelect={false}
          />
        ))}
      </div>
      <div className="feed-sentinel">
        <span>
          {designs.length === 0
            ? "Nothing saved here yet. Use the save button on any design or library screen."
            : `${designs.length} saved design${designs.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {confirmDelete ? (
        <div className="confirm-overlay" onMouseDown={() => setConfirmDelete(false)}>
          <div className="confirm-card" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Delete this project?</h2>
            <p>The project and its list go away. Designs your AI made stay in their compose; nothing in your app changes.</p>
            <div>
              <button type="button" onClick={() => setConfirmDelete(false)}>Cancel</button>
              <button type="button" className="danger" onClick={onDelete}>Delete project</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

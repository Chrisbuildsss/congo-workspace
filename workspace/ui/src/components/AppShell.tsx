import { useEffect, useState, type ReactNode } from "react";
import {
  CheckIcon,
  ComposeIcon,
  EllipsisIcon,
  LibraryIcon,
  LiveAppIcon,
  LogoMark,
  MenuIcon,
  ProjectsIcon,
} from "../Icons";
import type { ThemeSetting, ViewName, WorkspaceStatus } from "../types";
import { Separator, useClickOutside } from "./Ui";

type Navigate = (name: ViewName) => void;

const THEME_LABELS: [ThemeSetting, string][] = [
  ["system", "Match system"],
  ["light", "Light"],
  ["dark", "Dark"],
];

export function Sidebar({
  current,
  status,
  theme,
  expanded,
  showMobileTrigger,
  onToggle,
  onNavigate,
  onCompose,
  onTheme,
  onOpenAbout,
  onStop,
}: {
  current: ViewName;
  status: WorkspaceStatus | null;
  theme: ThemeSetting;
  expanded: boolean;
  showMobileTrigger: boolean;
  onToggle: () => void;
  onNavigate: Navigate;
  onCompose: () => void;
  onTheme: (theme: ThemeSetting) => void;
  onOpenAbout: () => void;
  onStop: () => void;
}) {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useClickOutside<HTMLDivElement>(profileOpen, () =>
    setProfileOpen(false),
  );

  useEffect(() => {
    if (!expanded) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onToggle();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [expanded, onToggle]);

  const runProfileAction = (action: () => void) => {
    setProfileOpen(false);
    if (expanded && window.innerWidth <= 900) onToggle();
    action();
  };

  const connected = Boolean(status?.ai.connected);
  const aiLabel = status ? (connected ? "Connected" : "Not connected") : "Checking";

  // Three places: Library, Prototypes (the former Compose) and My app.
  // Projects stays in the code, hidden, for cloud saving later.
  const nav = [
    {
      key: "library" as const,
      label: "Library",
      icon: <LibraryIcon size={20} />,
      action: () => onNavigate("library"),
      hidden: false,
    },
    {
      key: "compose" as const,
      label: "Prototypes",
      icon: <ComposeIcon size={20} />,
      action: onCompose,
      hidden: false,
    },
    {
      key: "projects" as const,
      label: "Projects",
      icon: <ProjectsIcon size={20} />,
      action: () => onNavigate("projects"),
      hidden: true,
    },
    {
      key: "live" as const,
      label: "My app",
      icon: <LiveAppIcon size={20} />,
      action: () => onNavigate("live"),
      hidden: false,
    },
  ].filter((item) => !item.hidden);

  return (
    <>
      {!expanded && showMobileTrigger ? (
        <button
          type="button"
          className="mobile-menu-trigger"
          aria-label="Expand sidebar"
          aria-controls="primary-sidebar"
          onClick={onToggle}
        >
          <MenuIcon size={18} />
        </button>
      ) : null}
      {expanded ? (
        <button
          type="button"
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={onToggle}
        />
      ) : null}
      <aside
        id="primary-sidebar"
        className={`sidebar ${expanded ? "is-expanded" : ""}`}
        aria-label="Primary"
      >
        <header className="sidebar-header">
          <button
            type="button"
            className="sidebar-menu-button"
            aria-label={expanded ? "Collapse sidebar" : "Expand sidebar"}
            aria-controls="primary-sidebar"
            aria-expanded={expanded}
            onClick={onToggle}
          >
            <MenuIcon size={18} />
          </button>
          {expanded ? (
            <button
              type="button"
              className="sidebar-brand"
              aria-label="Library"
              onClick={() => {
                onNavigate("library");
                if (window.innerWidth <= 900) onToggle();
              }}
            >
              <LogoMark size={16} />
              <span>Congo</span>
            </button>
          ) : null}
        </header>

        <nav className="sidebar-links">
          {nav.map((item) => {
            const active = current === item.key;
            return (
              <button
                type="button"
                key={item.key}
                className={`sidebar-link ${active ? "is-active" : ""}`}
                aria-label={item.label}
                aria-current={active ? "page" : undefined}
                data-tooltip={item.label}
                onClick={() => {
                  item.action();
                  if (expanded && window.innerWidth <= 900) onToggle();
                }}
              >
                {item.icon}
                <span className="sidebar-label">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-profile" ref={profileRef}>
          <button
            type="button"
            className="avatar-button"
            aria-label={`Workspace menu. Your AI: ${aiLabel}`}
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((value) => !value)}
          >
            <span className="workspace-avatar" data-connected={connected || undefined}>
              <LogoMark size={14} />
              <i />
            </span>
            <span className="sidebar-profile-label">
              <b>Your AI</b>
              <small>{aiLabel}</small>
            </span>
          </button>
          {profileOpen ? (
            <div className="profile-menu" role="menu">
              <div className="profile-summary" role="presentation">
                <span className="workspace-avatar" data-connected={connected || undefined}>
                  <LogoMark size={13} />
                  <i />
                </span>
                <span className="profile-summary-copy">
                  <span className="profile-summary-top">
                    <b>Congo workspace</b>
                    <em>Local</em>
                  </span>
                  <span>
                    {connected
                      ? "Ready for requests"
                      : "Actions need a connected AI"}
                  </span>
                  <span>{status?.app ? `App: ${status.app.name}` : "No app attached"}</span>
                </span>
              </div>
              <Separator />
              <span className="profile-menu-label">Appearance</span>
              {THEME_LABELS.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  role="menuitemradio"
                  aria-checked={theme === value}
                  className="profile-item"
                  onClick={() => onTheme(value)}
                >
                  <span className="profile-item-icon">
                    {theme === value ? <CheckIcon size={12} /> : null}
                  </span>
                  {label}
                </button>
              ))}
              <Separator />
              <a
                className="profile-item"
                role="menuitem"
                href="https://buildwithcongo.com/settings"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setProfileOpen(false)}
              >
                <span className="profile-item-icon">↗</span>
                Congo account
              </a>
              <button
                type="button"
                role="menuitem"
                className="profile-item"
                onClick={() => runProfileAction(onOpenAbout)}
              >
                <span className="profile-item-icon">◌</span>
                About this workspace
              </button>
              <button
                type="button"
                role="menuitem"
                className="profile-item profile-logout"
                onClick={() => runProfileAction(onStop)}
              >
                <span className="profile-item-icon">→</span>
                Stop workspace
              </button>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

export function Topbar({
  title,
  left,
  right,
  className = "",
  children,
}: {
  title?: ReactNode;
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <header className={`app-topbar ${className}`.trim()}>
      <div className="app-topbar-left">
        {left}
        {title ? <h1 className="app-topbar-title">{title}</h1> : null}
      </div>
      <div className="app-topbar-center">{children}</div>
      {right ? <div className="app-topbar-right">{right}</div> : null}
    </header>
  );
}

export function EllipsisButton({
  label = "Menu",
  onClick,
  active = false,
}: {
  label?: string;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className="round-icon-button"
      aria-label={label}
      data-active={active ? "true" : undefined}
      onClick={onClick}
    >
      <EllipsisIcon />
    </button>
  );
}

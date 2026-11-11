import { useEffect, useState, type ReactNode } from "react";
import {
  BookmarkIcon,
  CommunityIcon,
  ComposeIcon,
  EllipsisIcon,
  LogoMark,
  MenuIcon,
  ProjectsIcon,
} from "../Icons";
import type { AppUser, ViewName } from "../types";
import { Meter, PixelAvatar, Separator, useClickOutside } from "./Ui";

type Navigate = (name: ViewName) => void;

export function Sidebar({
  current,
  user,
  expanded,
  showMobileTrigger,
  onToggle,
  onNavigate,
  onCompose,
  onOpenSettings,
  onOpenBilling,
  onOpenFeedback,
  onOpenTerms,
  onLogout,
}: {
  current: ViewName;
  user: AppUser;
  expanded: boolean;
  showMobileTrigger: boolean;
  onToggle: () => void;
  onNavigate: Navigate;
  onCompose: () => void;
  onOpenSettings: () => void;
  onOpenBilling: () => void;
  onOpenFeedback: () => void;
  onOpenTerms: () => void;
  onLogout: () => void;
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

  const nav = [
    {
      key: "compose" as const,
      label: "Compose",
      icon: <ComposeIcon size={20} />,
      action: onCompose,
    },
    {
      key: "community" as const,
      label: "Community",
      icon: <CommunityIcon size={20} />,
      action: () => onNavigate("community"),
    },
    {
      key: "projects" as const,
      label: "Projects",
      icon: <ProjectsIcon size={20} />,
      action: () => onNavigate("projects"),
    },
    {
      key: "boards" as const,
      label: "Boards",
      icon: <BookmarkIcon size={20} />,
      action: () => onNavigate("boards"),
    },
  ];

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
              aria-label="Community"
              onClick={() => {
                onNavigate("community");
                if (window.innerWidth <= 900) onToggle();
              }}
            >
              <LogoMark size={16} />
              <span>Variant</span>
            </button>
          ) : null}
        </header>

        <nav className="sidebar-links">
          {nav.map((item) => {
            const active =
              current === item.key ||
              (item.key === "boards" && current === "board") ||
              (item.key === "compose" && current === "chat");
            return (
              <button
                type="button"
                key={item.key}
                className={`sidebar-link ${active ? "is-active" : ""}`}
                aria-label={item.label}
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
            aria-label="Profile menu"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((value) => !value)}
          >
            <PixelAvatar src={user.avatarUrl} size={24} />
            <span className="sidebar-profile-label">
              <b>{user.displayName}</b>
              <small>Free plan</small>
            </span>
          </button>
          {profileOpen ? (
            <div className="profile-menu" role="menu">
              <button
                type="button"
                className="profile-summary"
                onClick={() => {
                  runProfileAction(onOpenBilling);
                }}
              >
                <PixelAvatar src={user.avatarUrl} size={22} />
                <span className="profile-summary-copy">
                  <span className="profile-summary-top">
                    <b>{user.displayName}</b>
                    <em>Free</em>
                  </span>
                  <span>{user.email}</span>
                  <span className="profile-progress-row">
                    <Meter value={38} max={60} />
                    <span><b>38 Fast</b> left</span>
                  </span>
                </span>
              </button>
              <Separator />
              <button
                type="button"
                className="profile-item"
                onClick={() => {
                  runProfileAction(onOpenSettings);
                }}
              >
                <span className="profile-item-icon">◉</span>
                Account Settings
              </button>
              <button
                type="button"
                className="profile-item"
                onClick={() => {
                  runProfileAction(onOpenFeedback);
                }}
              >
                <span className="profile-item-icon">◌</span>
                Give feedback
              </button>
              <button
                type="button"
                className="profile-item"
                onClick={() => {
                  runProfileAction(onOpenTerms);
                }}
              >
                <span className="profile-item-icon">↗</span>
                Terms and Privacy
              </button>
              <button
                type="button"
                className="profile-item profile-logout"
                onClick={() => {
                  runProfileAction(onLogout);
                }}
              >
                <span className="profile-item-icon">→</span>
                Log out
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
  title?: string;
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

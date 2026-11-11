import { useState, type KeyboardEvent } from "react";
import {
  BookmarkIcon,
  DownloadIcon,
  EditIcon,
  EllipsisIcon,
  HeartIcon,
  LinkIcon,
  PencilIcon,
  TrashIcon,
} from "../Icons";
import type { Design } from "../types";
import DesignSurface from "../DesignSurface";
import { useClickOutside } from "./Ui";

export type CardAction =
  | "vary-strong"
  | "vary-subtle"
  | "change-style"
  | "remix-colors"
  | "shuffle-layout"
  | "other-views"
  | "edit"
  | "new-chat"
  | "open-in"
  | "export"
  | "export-react"
  | "new-tab"
  | "delete"
  | "copy-code"
  | "download"
  | `open-in:${string}`
  | `custom:${string}`;

const openInTools = [
  "Cursor",
  "Claude Code",
  "Codex",
  "Antigravity",
  "OpenCode",
  "V0",
  "Lovable",
  "Replit",
];

export default function DesignCard({
  design,
  onOpen,
  onAction,
  onLike,
  onBookmark,
  selected,
  onToggleSelected,
  liked = false,
  bookmarked = false,
  showSelect = true,
  showAuthor = true,
  showTitle = true,
  showHoverActions = true,
  showEllipsis = true,
  showLike = true,
  compact = false,
  saved = false,
}: {
  design: Design;
  onOpen: () => void;
  onAction: (action: CardAction, design: Design) => void;
  onLike?: () => void;
  onBookmark?: () => void;
  selected?: boolean;
  onToggleSelected?: () => void;
  liked?: boolean;
  bookmarked?: boolean;
  showSelect?: boolean;
  showAuthor?: boolean;
  showTitle?: boolean;
  showHoverActions?: boolean;
  showEllipsis?: boolean;
  showLike?: boolean;
  compact?: boolean;
  saved?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPanel, setMenuPanel] = useState<"open-in" | "export" | null>(null);
  const [quickOpen, setQuickOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => {
    setMenuOpen(false);
    setMenuPanel(null);
  });
  const quickRef = useClickOutside<HTMLDivElement>(quickOpen, () =>
    setQuickOpen(false),
  );

  const activate = (action: CardAction) => {
    onAction(action, design);
    setMenuOpen(false);
    setMenuPanel(null);
    setQuickOpen(false);
  };

  const open = () => {
    if (selected) onToggleSelected?.();
    else onOpen();
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  return (
    <div
      className={`design-card ${selected ? "is-selected" : ""} ${
        compact ? "is-compact" : ""
      } ${saved ? "is-saved" : ""}`}
      data-format={design.format}
      role="button"
      tabIndex={0}
      aria-label={`Open ${design.title}`}
      onClick={open}
      onKeyDown={handleKey}
      onMouseEnter={() => showHoverActions && setQuickOpen(true)}
      onMouseLeave={() => {
        if (!menuOpen) setQuickOpen(false);
      }}
    >
      <DesignSurface kind={design.kind} />

      <div className="card-shade" aria-hidden="true" />
      <div className="card-heading" data-priority="always">
        {showSelect ? (
          <button
            type="button"
            className="selection-bubble"
            aria-label="Toggle selection"
            onClick={(event) => {
              event.stopPropagation();
              onToggleSelected?.();
            }}
          >
            <span className={selected ? "is-selected" : ""}>
              {selected ? <i /> : null}
            </span>
          </button>
        ) : null}
        <span className="card-title-pill">
          {showAuthor ? <small>{design.author}</small> : null}
          {showTitle ? <b>{design.title}</b> : null}
        </span>
      </div>

      <div className="card-top-actions">
        {showEllipsis ? (
          <div className="card-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="card-icon-button"
              aria-label="Menu"
              data-open={menuOpen || undefined}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((open) => {
                  if (open) setMenuPanel(null);
                  return !open;
                });
              }}
            >
              <EllipsisIcon />
            </button>
            {menuOpen ? (
              <div
                className="card-action-menu"
                onClick={(event) => event.stopPropagation()}
              >
                <ul>
                  <li>
                    <button type="button" onClick={() => activate("edit")}>
                      <PencilIcon size={13} />
                      Edit design
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => activate("new-chat")}>
                      <span className="menu-glyph">↗</span>
                      New chat from design
                    </button>
                  </li>
                </ul>
                <span className="menu-rule" />
                <ul>
                  <li>
                    <button
                      type="button"
                      onClick={() => setMenuPanel("open-in")}
                      aria-haspopup="menu"
                      aria-expanded={menuPanel === "open-in"}
                    >
                      <span className="menu-glyph">⌘</span>
                      Open in...
                      <em>Pro</em>
                      <span className="menu-chevron">›</span>
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      onClick={() => setMenuPanel("export")}
                      aria-haspopup="menu"
                      aria-expanded={menuPanel === "export"}
                    >
                      <DownloadIcon size={13} />
                      Export...
                      <em>Pro</em>
                      <span className="menu-chevron">›</span>
                    </button>
                  </li>
                  <li>
                    <button type="button" onClick={() => activate("new-tab")}>
                      <LinkIcon size={13} />
                      Open in new tab
                    </button>
                  </li>
                </ul>
                <span className="menu-rule" />
                <ul>
                  <li>
                    <button
                      type="button"
                      className="menu-danger"
                      onClick={() => activate("delete")}
                    >
                      <TrashIcon size={13} />
                      Delete design
                    </button>
                  </li>
                </ul>
                {menuPanel === "open-in" ? (
                  <div className="card-submenu open-in-submenu" role="menu" aria-label="Open in">
                    {openInTools.map((tool) => (
                      <button
                        type="button"
                        role="menuitem"
                        key={tool}
                        onClick={() => activate(`open-in:${tool}`)}
                      >
                        {tool}
                      </button>
                    ))}
                    <span>Paste copied prompt into the selected app</span>
                  </div>
                ) : null}
                {menuPanel === "export" ? (
                  <div className="card-submenu export-submenu" role="menu" aria-label="Export">
                    <button type="button" role="menuitem" onClick={() => activate("copy-code")}>
                      Copy code
                    </button>
                    <button type="button" role="menuitem" onClick={() => activate("download")}>
                      Download HTML
                    </button>
                    <button type="button" role="menuitem" onClick={() => activate("export-react")}>
                      Export as React
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
        <button
          type="button"
          className="card-icon-button"
          aria-label="Save"
          data-active={bookmarked || undefined}
          onClick={(event) => {
            event.stopPropagation();
            onBookmark?.();
          }}
        >
          <BookmarkIcon />
        </button>
        {!compact && showLike ? (
          <button
            type="button"
            className="card-like-button"
            aria-label="Like"
            data-active={liked || undefined}
            onClick={(event) => {
              event.stopPropagation();
              onLike?.();
            }}
          >
            <HeartIcon filled={liked} />
            <span>{design.likes + (liked ? 1 : 0)}</span>
          </button>
        ) : null}
      </div>

      {showHoverActions ? (
        <div
          ref={quickRef}
          className="card-quick-actions"
          data-open={quickOpen || undefined}
          onClick={(event) => event.stopPropagation()}
        >
          {[
            ["vary-strong", "Vary strong", "✣"],
            ["vary-subtle", "Vary subtle", "⁘"],
            ["change-style", "Change style", "╱"],
            ["remix-colors", "Remix colors", "◉"],
            ["shuffle-layout", "Shuffle layout", "▦"],
            ["other-views", "See other views", "⌘"],
          ].map(([key, label, icon]) => (
            <button
              type="button"
              key={key}
              onClick={() => activate(key as CardAction)}
            >
              <span>{label}</span>
              <i>{icon}</i>
            </button>
          ))}
          <form
            className="quick-vary-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (custom.trim()) {
                activate(`custom:${custom.trim()}`);
                setCustom("");
              }
            }}
          >
            <input
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              placeholder="Vary…"
            />
          </form>
        </div>
      ) : null}
    </div>
  );
}

export function CardActionsBubble({
  onAction,
}: {
  onAction: (action: CardAction) => void;
}) {
  return (
    <div className="card-actions-bubble">
      <button type="button" onClick={() => onAction("edit")}>
        <EditIcon />
      </button>
    </div>
  );
}

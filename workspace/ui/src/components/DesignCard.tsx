import { useState, type KeyboardEvent, type ReactNode } from "react";
import { BookmarkIcon, EllipsisIcon } from "../Icons";
import type { Design } from "../types";
import DesignFrame from "../DesignFrame";
import { useClickOutside } from "./Ui";

/**
 * Card actions. Tweaks map onto Impeccable's commands:
 * subtle -> an identity-preserving variation, layout -> `layout`,
 * colorize -> `colorize`, bolder -> `bolder`, quieter -> `quieter`,
 * more:<command> -> any of Impeccable's other visual and finishing commands.
 */
export type CardAction =
  | "use"
  | "build"
  | "subtle"
  | "layout"
  | "colorize"
  | "bolder"
  | "quieter"
  | "edit"
  | "editable"
  | "open"
  | "preview"
  | "save"
  | "delete"
  | `more:${string}`
  | `custom:${string}`;

export interface QuickAction {
  key: CardAction;
  label: string;
  icon: string;
}

export interface MenuItem {
  key: CardAction;
  label: string;
  icon?: ReactNode;
  danger?: boolean;
}

export const TWEAKS: QuickAction[] = [
  { key: "subtle", label: "Subtle variant", icon: "⁘" },
  { key: "layout", label: "Change layout", icon: "▦" },
  { key: "colorize", label: "Recolor", icon: "◉" },
  { key: "bolder", label: "Bolder", icon: "✣" },
  { key: "quieter", label: "Quieter", icon: "╱" },
];

export const MORE_COMMANDS = [
  "distill",
  "typeset",
  "animate",
  "delight",
  "overdrive",
  "polish",
  "clarify",
  "adapt",
  "harden",
  "critique",
  "audit",
];

export default function DesignCard({
  design,
  onOpen,
  onAction,
  onBookmark,
  selected,
  onToggleSelected,
  bookmarked = false,
  primary,
  tweaks = TWEAKS,
  showMore = false,
  actionsDisabledNote,
  menuItems = [],
  showSelect = true,
  showAuthor = true,
  showTitle = true,
  showHoverActions = true,
  compact = false,
  saved = false,
}: {
  design: Design;
  onOpen: () => void;
  onAction: (action: CardAction, design: Design) => void;
  onBookmark?: () => void;
  selected?: boolean;
  onToggleSelected?: () => void;
  bookmarked?: boolean;
  /** Build this (Compose) or Use this (Library). */
  primary?: QuickAction;
  tweaks?: QuickAction[];
  showMore?: boolean;
  /** When set, actions show but are unavailable, with this short reason. */
  actionsDisabledNote?: string;
  menuItems?: MenuItem[];
  showSelect?: boolean;
  showAuthor?: boolean;
  showTitle?: boolean;
  showHoverActions?: boolean;
  compact?: boolean;
  saved?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const quickRef = useClickOutside<HTMLDivElement>(quickOpen, () => {
    setQuickOpen(false);
    setMoreOpen(false);
  });
  const disabled = Boolean(actionsDisabledNote);

  const activate = (action: CardAction) => {
    onAction(action, design);
    setMenuOpen(false);
    setQuickOpen(false);
    setMoreOpen(false);
  };

  const open = () => {
    if (selected) onToggleSelected?.();
    else onOpen();
  };

  const handleKey = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      open();
    }
  };

  const quick = [...(primary ? [primary] : []), ...tweaks];

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
        if (!menuOpen) {
          setQuickOpen(false);
          setMoreOpen(false);
        }
      }}
      onFocus={() => showHoverActions && setQuickOpen(true)}
    >
      <DesignFrame design={design} />

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
          {showAuthor && design.author ? <small>{design.author}</small> : null}
          {showTitle ? <b>{design.title}</b> : null}
        </span>
      </div>

      <div className="card-top-actions">
        {menuItems.length > 0 ? (
          <div className="card-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className="card-icon-button"
              aria-label="Menu"
              data-open={menuOpen || undefined}
              onClick={(event) => {
                event.stopPropagation();
                setMenuOpen((value) => !value);
              }}
            >
              <EllipsisIcon />
            </button>
            {menuOpen ? (
              <div className="card-action-menu" onClick={(event) => event.stopPropagation()}>
                <ul>
                  {menuItems.map((item) => (
                    <li key={item.key}>
                      <button
                        type="button"
                        className={item.danger ? "menu-danger" : undefined}
                        onClick={() => activate(item.key)}
                      >
                        {item.icon ?? <span className="menu-glyph">↗</span>}
                        {item.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        {onBookmark ? (
          <button
            type="button"
            className="card-icon-button"
            aria-label={bookmarked ? "Saved" : "Save"}
            data-active={bookmarked || undefined}
            onClick={(event) => {
              event.stopPropagation();
              onBookmark();
            }}
          >
            <BookmarkIcon />
          </button>
        ) : null}
      </div>

      {showHoverActions && quick.length > 0 ? (
        <div
          ref={quickRef}
          className="card-quick-actions"
          data-open={quickOpen || undefined}
          onClick={(event) => event.stopPropagation()}
        >
          {disabled ? <span className="card-quick-note">{actionsDisabledNote}</span> : null}
          {moreOpen
            ? MORE_COMMANDS.map((command) => (
                <button
                  type="button"
                  key={command}
                  disabled={disabled}
                  onClick={() => activate(`more:${command}`)}
                >
                  <span>{command[0].toUpperCase() + command.slice(1)}</span>
                  <i>›</i>
                </button>
              ))
            : quick.map((item) => (
                <button
                  type="button"
                  key={item.key}
                  className={item === primary ? "is-primary" : undefined}
                  disabled={disabled}
                  onClick={() => activate(item.key)}
                >
                  <span>{item.label}</span>
                  <i>{item.icon}</i>
                </button>
              ))}
          {showMore ? (
            <button type="button" disabled={disabled} onClick={() => setMoreOpen((value) => !value)}>
              <span>{moreOpen ? "Back" : "More"}</span>
              <i>{moreOpen ? "‹" : "…"}</i>
            </button>
          ) : null}
          {!moreOpen ? (
            <form
              className="quick-vary-form"
              onSubmit={(event) => {
                event.preventDefault();
                if (custom.trim() && !disabled) {
                  activate(`custom:${custom.trim()}`);
                  setCustom("");
                }
              }}
            >
              <input
                value={custom}
                disabled={disabled}
                onChange={(event) => setCustom(event.target.value)}
                placeholder="Vary…"
                aria-label="Describe a variation"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

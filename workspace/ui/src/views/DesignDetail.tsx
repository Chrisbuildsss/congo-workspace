import { useEffect, useState } from "react";
import { BackIcon, BookmarkIcon, InfoIcon, LinkIcon, PanelIcon, PencilIcon } from "../Icons";
import BriefPanel from "../components/BriefPanel";
import DesignFrame from "../DesignFrame";
import type { Design } from "../types";

export default function DesignDetail({
  design,
  contextLabel,
  leftOffset,
  bookmarked,
  editing = false,
  editDisabledReason,
  openUrl,
  onClose,
  onBookmark,
  onEdit,
  onMakeEditable,
  onPull,
  onExpand,
  expanding = false,
  briefOpen = false,
  onBrief,
  panelOpen,
  onPanel,
  onPrototype,
  frameDesign,
  waitingNote,
  onDescribe,
  describeNote,
}: {
  design: Design;
  contextLabel?: string;
  leftOffset: number;
  bookmarked?: boolean;
  editing?: boolean;
  /** When set, Edit is shown but unavailable, with this explanation. */
  editDisabledReason?: string;
  openUrl?: string | null;
  onClose: () => void;
  /** Projects is hidden: no Save button unless a handler is given. */
  onBookmark?: () => void;
  onEdit?: () => void;
  /** Set when Edit found a script bundle: ask the AI for a static copy instead. */
  onMakeEditable?: () => void;
  /** Pull into a project: the only step that changes a code project. */
  onPull?: () => void;
  /** Expand: build out the rest of the app around the main screen. */
  onExpand?: () => void;
  expanding?: boolean;
  /** The brief behind the "i" icon (product ideas only), closed by default. */
  briefOpen?: boolean;
  onBrief?: () => void;
  /** The side panel, collapsed while a prototype is open; this reopens it. */
  panelOpen?: boolean;
  onPanel?: () => void;
  /** Explore items: send this one to the AI. */
  onPrototype?: () => void;
  /** What the frame shows when it differs from the card (a prototype's dev server while editing). */
  frameDesign?: Design;
  /** Shown instead of the frame while the AI prepares it. */
  waitingNote?: string;
  /** When the editor can't pick in this prototype: describe the change instead. */
  onDescribe?: (text: string) => void;
  describeNote?: string;
}) {
  const [change, setChange] = useState("");
  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <section
      className={`design-detail ${editing ? "is-editing" : ""}`}
      style={{ left: `${leftOffset}px` }}
      aria-label={`${design.title} detail`}
    >
      <header className="design-detail-header">
        <div className="design-detail-breadcrumbs">
          {onPanel ? (
            <button
              type="button"
              aria-label={panelOpen ? "Close the side panel" : "Open the side panel"}
              aria-pressed={Boolean(panelOpen)}
              onClick={onPanel}
            >
              <PanelIcon />
            </button>
          ) : null}
          <button type="button" aria-label="Back" onClick={onClose}>
            <BackIcon />
          </button>
          {contextLabel ? <span>{contextLabel}</span> : null}
          {contextLabel ? <i>/</i> : null}
          <b>{design.title}</b>
        </div>
        {onEdit ? (
          <div className="design-detail-center">
            <button
              type="button"
              className="detail-edit"
              data-active={editing || undefined}
              aria-pressed={editing}
              disabled={Boolean(editDisabledReason)}
              title={editDisabledReason}
              onClick={onMakeEditable ?? onEdit}
            >
              <PencilIcon size={13} />
              {onMakeEditable ? "Make editable" : editing ? "Editing" : "Edit"}
            </button>
          </div>
        ) : null}
        <div className="design-detail-actions">
          {openUrl ? (
            <a
              className="detail-tool"
              aria-label="Open in a new tab"
              href={openUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkIcon />
            </a>
          ) : null}
          {onBrief ? (
            <button
              type="button"
              className="detail-tool"
              aria-label={briefOpen ? "Hide the brief" : "Show the brief"}
              aria-expanded={briefOpen}
              data-active={briefOpen || undefined}
              onClick={onBrief}
            >
              <InfoIcon />
            </button>
          ) : null}
          {onExpand || expanding ? (
            <button type="button" className="detail-export" disabled={expanding} onClick={onExpand}>
              {expanding ? "Expanding…" : "Expand"}
            </button>
          ) : null}
          {onPrototype ? (
            <button type="button" className="detail-export" onClick={onPrototype}>
              Prototype this
            </button>
          ) : null}
          {onPull ? (
            <button type="button" className="detail-export" onClick={onPull}>
              Pull into a project
            </button>
          ) : null}
          {onBookmark ? (
            <button
              type="button"
              className="detail-tool"
              aria-label="Save"
              data-active={bookmarked || undefined}
              onClick={onBookmark}
            >
              <BookmarkIcon />
            </button>
          ) : null}
        </div>
      </header>

      {onDescribe ? (
        <form
          className="live-address detail-describe"
          onSubmit={(event) => {
            event.preventDefault();
            if (change.trim()) {
              onDescribe(change.trim());
              setChange("");
            }
          }}
        >
          {describeNote ? <p className="live-note">{describeNote}</p> : null}
          <input
            value={change}
            maxLength={600}
            onChange={(event) => setChange(event.target.value)}
            placeholder="Describe the change for your AI, then press Enter"
            aria-label="Describe the change for your AI"
          />
        </form>
      ) : null}

      {design.brief && briefOpen ? <BriefPanel brief={design.brief} className="detail-brief" /> : null}

      <div
        className={`design-detail-stage ${design.format === "mobile" ? "is-mobile-design" : ""} ${
          (frameDesign ?? design).src ? "is-running" : ""
        }`}
      >
        <div className="design-detail-frame">
          {waitingNote ? (
            <div className="chat-empty-state live-empty">
              <div className="empty-grid-glyph">
                <span /><span /><span /><span />
              </div>
              <p>{waitingNote}</p>
            </div>
          ) : (
            <DesignFrame
              design={frameDesign ?? design}
              interactive
              edit={editing && !frameDesign}
              key={`${editing ? "edit" : "view"}:${frameDesign?.src ?? design.src ?? ""}`}
            />
          )}
        </div>
      </div>
    </section>
  );
}

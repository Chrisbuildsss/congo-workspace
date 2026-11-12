import { useEffect, useState } from "react";
import { BackIcon, BookmarkIcon, LinkIcon, PencilIcon } from "../Icons";
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
  onUse,
  useNote,
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
  /** Use this: put the prototype into the person's app (or create the new app). */
  onUse?: () => void;
  /** Where Use this goes, as a tooltip. */
  useNote?: string;
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
          {onUse ? (
            <button type="button" className="detail-export" title={useNote} onClick={onUse}>
              Use this
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

      <div className={`design-detail-stage ${design.format === "mobile" ? "is-mobile-design" : ""}`}>
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

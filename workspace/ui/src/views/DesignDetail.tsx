import { useEffect } from "react";
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
}: {
  design: Design;
  contextLabel?: string;
  leftOffset: number;
  bookmarked: boolean;
  editing?: boolean;
  /** When set, Edit is shown but unavailable, with this explanation. */
  editDisabledReason?: string;
  openUrl?: string | null;
  onClose: () => void;
  onBookmark: () => void;
  onEdit?: () => void;
}) {
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
              onClick={onEdit}
            >
              <PencilIcon size={13} />
              {editing ? "Editing" : "Edit"}
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
          <button
            type="button"
            className="detail-tool"
            aria-label="Save"
            data-active={bookmarked || undefined}
            onClick={onBookmark}
          >
            <BookmarkIcon />
          </button>
        </div>
      </header>

      <div className={`design-detail-stage ${design.format === "mobile" ? "is-mobile-design" : ""}`}>
        <div className="design-detail-frame">
          <DesignFrame design={design} interactive />
        </div>
      </div>
    </section>
  );
}

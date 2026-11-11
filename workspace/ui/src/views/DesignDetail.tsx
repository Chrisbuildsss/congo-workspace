import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import {
  BackIcon,
  BookmarkIcon,
  DownloadIcon,
  EllipsisIcon,
  HeartIcon,
  LinkIcon,
  PaletteIcon,
  PencilIcon,
  TrashIcon,
} from "../Icons";
import DesignSurface from "../DesignSurface";
import type { Design } from "../types";
import { copyText, useClickOutside } from "../components/Ui";

type Source = "community" | "chat" | "boards";

export default function DesignDetail({
  design,
  source,
  editing,
  leftOffset,
  liked,
  bookmarked,
  selectedElement,
  onSelectElement,
  onClose,
  onLike,
  onBookmark,
  onDelete,
  onNewChat,
  showToast,
}: {
  design: Design;
  source: Source;
  editing: boolean;
  leftOffset: number;
  liked: boolean;
  bookmarked: boolean;
  selectedElement: string | null;
  onSelectElement: (element: string | null) => void;
  onClose: () => void;
  onLike: () => void;
  onBookmark: () => void;
  onDelete: () => void;
  onNewChat: () => void;
  showToast: (message: string) => void;
}) {
  const [selectMode, setSelectMode] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const menuRef = useClickOutside<HTMLDivElement>(menuOpen, () => setMenuOpen(false));
  const exportRef = useClickOutside<HTMLDivElement>(exportOpen, () => setExportOpen(false));
  const surfaceRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSelectMode(false);
  }, [editing, design.id]);

  useEffect(() => {
    const handleKey = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  const html = useMemo(
    () => `<!doctype html>
<html><head><meta charset="utf-8"><title>${design.title}</title>
<style>body{margin:0;background:#101010;color:white;font:16px Inter,system-ui,sans-serif}main{min-height:100vh;display:grid;place-items:center}.card{width:min(960px,92vw);aspect-ratio:4/3;border-radius:18px;background:#f4f0e7;color:#111;display:grid;place-items:center;padding:8vw;box-sizing:border-box}h1{font:500 clamp(50px,10vw,128px)/.88 Georgia,serif}</style>
</head><body><main><section class="card"><h1>${design.title}</h1></section></main></body></html>`,
    [design.title],
  );

  const selectFromCanvas = (event: MouseEvent<HTMLDivElement>) => {
    if (!selectMode) return;
    const target = (event.target as HTMLElement).closest<HTMLElement>("[data-edit-label]");
    if (!target || !surfaceRef.current?.contains(target)) return;
    surfaceRef.current
      .querySelectorAll(".edit-selected")
      .forEach((node) => node.classList.remove("edit-selected"));
    target.classList.add("edit-selected");
    onSelectElement(target.dataset.editLabel ?? target.tagName.toLowerCase());
  };

  const handleClose = () => {
    surfaceRef.current
      ?.querySelectorAll(".edit-selected")
      .forEach((node) => node.classList.remove("edit-selected"));
    onSelectElement(null);
    onClose();
  };

  const download = () => {
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `variant-${design.id}.html`;
    anchor.click();
    URL.revokeObjectURL(url);
    setExportOpen(false);
    showToast("HTML downloaded");
  };

  const copyCode = async () => {
    await copyText(html);
    setExportOpen(false);
    showToast("Code copied");
  };

  return (
    <section
      className={`design-detail ${editing ? "is-editing" : ""}`}
      style={{ left: `${leftOffset}px` }}
      aria-label={`${design.title} detail`}
    >
      <header className="design-detail-header">
        <div className="design-detail-breadcrumbs">
          <button type="button" aria-label="Back" onClick={handleClose}>
            <BackIcon />
          </button>
          {source !== "boards" ? <span>{design.author}</span> : null}
          {source !== "boards" && source !== "chat" ? <i>/</i> : null}
          <b>{design.title}</b>
        </div>
        <div className="design-detail-actions">
          {editing ? (
            <button
              type="button"
              className="detail-tool"
              aria-label="Select to edit"
              data-active={selectMode || undefined}
              onClick={() => setSelectMode((active) => !active)}
            >
              <PaletteIcon />
            </button>
          ) : null}
          {editing ? (
            <div className="detail-menu-wrap" ref={menuRef}>
              <button
                type="button"
                className="detail-tool"
                aria-label="Menu"
                data-active={menuOpen || undefined}
                onClick={() => setMenuOpen((open) => !open)}
              >
                <EllipsisIcon />
              </button>
              {menuOpen ? (
                <div className="detail-menu">
                  <button type="button" onClick={onNewChat}>
                    <PencilIcon size={13} />
                    New chat from design
                  </button>
                  <button type="button" className="danger" onClick={onDelete}>
                    <TrashIcon size={13} />
                    Delete design
                  </button>
                </div>
              ) : null}
            </div>
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
          {!editing ? (
            <button
              type="button"
              className="detail-tool detail-like"
              aria-label="Like"
              data-active={liked || undefined}
              onClick={onLike}
            >
              <HeartIcon filled={liked} />
              <span>{design.likes + (liked ? 1 : 0)}</span>
            </button>
          ) : null}
          {editing ? (
            <div className="detail-menu-wrap" ref={exportRef}>
              <button
                type="button"
                className="detail-export"
                aria-label="Export Menu"
                data-active={exportOpen || undefined}
                onClick={() => setExportOpen((open) => !open)}
              >
                Export
              </button>
              {exportOpen ? (
                <div className="detail-menu export-detail-menu">
                  <button type="button" onClick={copyCode}>
                    <span className="menu-glyph">⌘</span>
                    Copy code
                  </button>
                  <button type="button" onClick={download}>
                    <DownloadIcon size={13} />
                    Download HTML
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setExportOpen(false);
                      showToast("React export queued — demo");
                    }}
                  >
                    <span className="menu-glyph">⌘</span>
                    Export as React
                    <em>Pro</em>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      window.open(URL.createObjectURL(new Blob([html], { type: "text/html" })), "_blank");
                      setExportOpen(false);
                    }}
                  >
                    <LinkIcon size={13} />
                    Open in new tab
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      <div
        className={`design-detail-stage ${
          design.format === "mobile" ? "is-mobile-design" : ""
        }`}
        ref={surfaceRef}
        onClick={selectFromCanvas}
      >
        <div className="design-detail-frame">
          <DesignSurface kind={design.kind} detail />
        </div>
      </div>

      {selectMode && selectedElement ? (
        <div className="selected-element-hint">
          <span>Selected</span>
          <b>{selectedElement}</b>
          <button type="button" onClick={() => onSelectElement(null)}>
            Clear
          </button>
        </div>
      ) : null}
    </section>
  );
}

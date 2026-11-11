import {
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent,
} from "react";
import {
  BackIcon,
  CheckIcon,
  ChevronDownIcon,
  GridIcon,
  LinkIcon,
  NoteIcon,
  PaletteIcon,
  PlusIcon,
  TrashIcon,
  UploadIcon,
} from "../Icons";
import type { Board } from "../types";
import { copyText, Modal, useClickOutside } from "../components/Ui";

type Reference = {
  id: string;
  type: "image" | "url" | "note" | "sketch";
  title: string;
  value: string;
};

function SketchCanvas({
  onSave,
}: {
  onSave: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const drawingRef = useRef(false);

  const point = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const bounds = canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - bounds.left) / bounds.width) * canvas.width,
      y: ((event.clientY - bounds.top) / bounds.height) * canvas.height,
    };
  };

  const start = (event: PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    const { x, y } = point(event);
    drawingRef.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    context.beginPath();
    context.moveTo(x, y);
  };

  const draw = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current!.getContext("2d")!;
    const { x, y } = point(event);
    context.lineTo(x, y);
    context.lineWidth = 4;
    context.lineCap = "round";
    context.strokeStyle = "#f5f1e8";
    context.stroke();
  };

  const stop = () => {
    drawingRef.current = false;
  };

  return (
    <div className="sketch-wrap">
      <canvas
        ref={canvasRef}
        width={680}
        height={400}
        onPointerDown={start}
        onPointerMove={draw}
        onPointerUp={stop}
        onPointerCancel={stop}
      />
      <button
        type="button"
        onClick={() => onSave(canvasRef.current!.toDataURL("image/png"))}
      >
        Add sketch
      </button>
    </div>
  );
}

export default function BoardDetail({
  board,
  onRename,
  onDelete,
  onBack,
  showToast,
}: {
  board: Board;
  onRename: (name: string) => void;
  onDelete: () => void;
  onBack: () => void;
  showToast: (message: string) => void;
}) {
  const [title, setTitle] = useState(board.name);
  const [addOpen, setAddOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [sketchOpen, setSketchOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [url, setUrl] = useState("");
  const [references, setReferences] = useState<Reference[]>([]);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const addRef = useClickOutside<HTMLDivElement>(addOpen, () => setAddOpen(false));

  const saveTitle = () => {
    const next = title.trim() || "Untitled board";
    setTitle(next);
    onRename(next);
  };

  const addImages = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    setReferences((current) => [
      ...current,
      ...files.map((file) => ({
        id: `image-${Date.now()}-${file.name}`,
        type: "image" as const,
        title: file.name,
        value: URL.createObjectURL(file),
      })),
    ]);
    event.currentTarget.value = "";
    setAddOpen(false);
  };

  const addNote = () => {
    setReferences((current) => [
      ...current,
      {
        id: `note-${Date.now()}`,
        type: "note",
        title: "New note",
        value: "Add a thought, quote, or direction here.",
      },
    ]);
    setAddOpen(false);
    showToast("Note added");
  };

  const shareCode = "sref 7a2c9e";

  const addUrlReference = () => {
    const candidate = url.trim();
    if (!candidate) return;
    const normalizedUrl = /^https?:\/\//i.test(candidate)
      ? candidate
      : `https://${candidate}`;
    let hostname = candidate;
    try {
      hostname = new URL(normalizedUrl).hostname;
    } catch {
      showToast("Enter a valid URL");
      return;
    }
    setReferences((current) => [
      ...current,
      {
        id: `url-${Date.now()}`,
        type: "url",
        title: hostname,
        value: normalizedUrl,
      },
    ]);
    setUrl("");
    setImportOpen(false);
    showToast("Reference imported");
  };

  return (
    <div className="board-detail view-fade">
      <header className="board-detail-header">
        <button type="button" className="board-back" aria-label="Back" onClick={onBack}>
          <BackIcon />
        </button>
        <div className="board-detail-author">mara.chen</div>
      </header>

      <div className="board-detail-body">
        <div className="board-detail-title-block">
          <input
            className="board-detail-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            onBlur={saveTitle}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.currentTarget.blur();
            }}
            aria-label="Board name"
          />
          <div className="board-meta-line">
            <button
              type="button"
              className="board-visibility"
              onClick={() =>
                showToast("Private boards are available on the Pro plan")
              }
            >
              Public
              <ChevronDownIcon size={10} />
            </button>
            <button
              type="button"
              className="sref-pill"
              onClick={async () => {
                await copyText(shareCode);
                setCopied(true);
                window.setTimeout(() => setCopied(false), 1200);
              }}
            >
              {copied ? "Copied" : shareCode}
            </button>
            <span>· {references.length} references</span>
          </div>
        </div>

        <div className="board-actions">
          {importOpen ? (
            <form
              className="board-url-import"
              onSubmit={(event) => {
                event.preventDefault();
                addUrlReference();
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") setImportOpen(false);
              }}
            >
              <LinkIcon size={14} />
              <input
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setImportOpen(false);
                }}
                placeholder="Enter URL"
                aria-label="Website or reference URL"
                autoFocus
              />
              <button type="submit" aria-label="Add imported URL" disabled={!url.trim()}>
                <CheckIcon size={14} />
              </button>
            </form>
          ) : null}
          <div ref={addRef} className="board-action-root">
            <button
              type="button"
              className="board-action"
              aria-expanded={addOpen}
              onClick={() => setAddOpen((open) => !open)}
            >
              <PlusIcon size={14} />
              Add reference
            </button>
            {addOpen ? (
              <div className="board-add-menu">
                <button type="button" onClick={() => fileRef.current?.click()}>
                  <UploadIcon />
                  Add photos or files
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAddOpen(false);
                    setImportOpen(true);
                  }}
                >
                  <LinkIcon />
                  Import a URL
                </button>
                <button type="button" onClick={() => setSketchOpen(true)}>
                  <GridIcon />
                  Draw a sketch
                </button>
                <button type="button" onClick={addNote}>
                  <NoteIcon />
                  Add a note
                </button>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            className="board-action"
            onClick={async () => {
              await copyText(`Style ${shareCode}`);
              setCopied(true);
              showToast("Style share link copied");
              window.setTimeout(() => setCopied(false), 1200);
            }}
          >
            <PaletteIcon size={14} />
            {copied ? "Copied" : "Share style"}
          </button>
          <button
            type="button"
            className="board-more"
            aria-label="Board menu"
            onClick={() => setDeleteOpen(true)}
          >
            ···
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={addImages}
          />
        </div>
      </div>

      <div className="board-reference-grid">
        {references.map((reference) => (
          <article className={`board-reference ${reference.type}`} key={reference.id}>
            {reference.type === "image" || reference.type === "sketch" ? (
              <img src={reference.value} alt={reference.title} />
            ) : (
              <div>
                {reference.type === "url" ? <LinkIcon /> : <NoteIcon />}
              </div>
            )}
            {reference.type === "note" ? (
              <textarea
                value={reference.value}
                onChange={(event) =>
                  setReferences((current) =>
                    current.map((item) =>
                      item.id === reference.id
                        ? { ...item, value: event.target.value }
                        : item,
                    ),
                  )
                }
                aria-label="Board note"
              />
            ) : (
              <span>{reference.title}</span>
            )}
          </article>
        ))}
        <button
          type="button"
          className="board-reference-empty"
          aria-label="Open reference chooser"
          onClick={() => setAddOpen(true)}
        />
        <div className="board-reference-empty decorative" />
      </div>

      <Modal
        open={sketchOpen}
        onClose={() => setSketchOpen(false)}
        title="Draw a sketch"
        width={720}
      >
        <SketchCanvas
          onSave={(dataUrl) => {
            setReferences((current) => [
              ...current,
              {
                id: `sketch-${Date.now()}`,
                type: "sketch",
                title: "Sketch",
                value: dataUrl,
              },
            ]);
            setSketchOpen(false);
            showToast("Sketch added");
          }}
        />
      </Modal>

      <Modal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Delete collection"
        width={400}
      >
        <div className="confirm-dialog">
          <TrashIcon />
          <h2>Delete “{title}”?</h2>
          <p>This removes the board from your workspace. Saved source designs stay in All saved.</p>
          <div>
            <button type="button" onClick={() => setDeleteOpen(false)}>Cancel</button>
            <button type="button" className="dialog-danger" onClick={onDelete}>
              Delete collection
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

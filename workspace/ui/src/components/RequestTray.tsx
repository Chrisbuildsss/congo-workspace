import { CloseIcon } from "../Icons";
import type { TrayItem } from "../types";
import { trayKey } from "../views/Library";

/**
 * The request tray: Library apps and screens the person selected, each with
 * its own note. It sits inside the composer, whose field is the note for the
 * whole request; Send hands both to the connected AI.
 */
export default function RequestTray({
  items,
  onNote,
  onRemove,
  onClear,
}: {
  items: TrayItem[];
  onNote: (item: TrayItem, note: string) => void;
  onRemove: (item: TrayItem) => void;
  onClear: () => void;
}) {
  if (items.length === 0) return null;
  return (
    <div className="request-tray" aria-label="Your request">
      <div className="request-tray-head">
        <span>
          {items.length} selected · add a note to any of them
        </span>
        <button type="button" onClick={onClear}>
          Clear
        </button>
      </div>
      <ul className="request-tray-items">
        {items.map((item) => (
          <li className="request-tray-item" key={trayKey(item)}>
            <span className="request-tray-thumb">{item.image ? <img src={item.image} alt="" /> : null}</span>
            <span className="request-tray-body">
              <span className="request-tray-title">
                <b>{item.title}</b>
                <small>{item.kind === "screen" ? `Screen${item.app?.name ? ` · ${item.app.name}` : ""}` : "Whole app"}</small>
              </span>
              <input
                className="request-tray-note"
                value={item.note}
                maxLength={1000}
                onChange={(event) => onNote(item, event.target.value)}
                placeholder="Note for this one (optional)"
                aria-label={`Note for ${item.title}`}
              />
            </span>
            <button
              type="button"
              className="request-tray-remove"
              aria-label={`Remove ${item.title}`}
              onClick={() => onRemove(item)}
            >
              <CloseIcon size={12} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

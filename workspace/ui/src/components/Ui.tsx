import {
  useEffect,
  useRef,
  type ButtonHTMLAttributes,
  type PropsWithChildren,
  type ReactNode,
} from "react";
import { CheckIcon, CloseIcon } from "../Icons";

export function useClickOutside<T extends HTMLElement>(
  active: boolean,
  onOutside: () => void,
) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    if (!active) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [active, onOutside]);

  return ref;
}

export function IconButton({
  label,
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`icon-button ${className}`.trim()}
      aria-label={label}
      title={label}
      {...props}
    >
      {children}
    </button>
  );
}

export function PixelAvatar({
  src,
  size = 18,
}: {
  src?: string;
  size?: number;
}) {
  if (src) {
    return (
      <img
        className="pixel-avatar pixel-avatar-image"
        src={src}
        alt="Avatar"
        width={size}
        height={size}
      />
    );
  }

  const filled = new Set([
    "2,1", "3,1", "4,1", "5,1",
    "1,2", "2,2", "3,2", "4,2", "5,2", "6,2",
    "1,3", "2,3", "3,3", "4,3", "5,3", "6,3",
    "2,4", "3,4", "4,4", "5,4",
    "2,5", "3,5", "4,5", "5,5",
    "1,6", "2,6", "5,6", "6,6",
  ]);

  return (
    <span
      className="pixel-avatar"
      style={{ width: size, height: size }}
      aria-label="Avatar"
      role="img"
    >
      {Array.from({ length: 49 }).map((_, index) => {
        const x = index % 7;
        const y = Math.floor(index / 7);
        return (
          <i
            key={index}
            className={filled.has(`${x},${y}`) ? "is-on" : ""}
          />
        );
      })}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  width = 740,
  className = "",
  children,
  footer,
}: PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  title: string;
  width?: number;
  className?: string;
  footer?: ReactNode;
}>) {
  useEffect(() => {
    if (!open) return;
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`modal-window ${className}`.trim()}
        style={{ "--modal-width": `${width}px` } as React.CSSProperties}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className="modal-header">
          <span>{title}</span>
          <IconButton label="Close" onClick={onClose} className="modal-close">
            <CloseIcon />
          </IconButton>
        </header>
        <div className="modal-body">{children}</div>
        {footer ? <footer className="modal-footer">{footer}</footer> : null}
      </section>
    </div>
  );
}

export function Toast({
  message,
  onDismiss,
}: {
  message: string | null;
  onDismiss: () => void;
}) {
  useEffect(() => {
    if (!message) return;
    const timer = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) return null;

  return (
    <div className="toast" role="status">
      <span className="toast-check"><CheckIcon size={14} /></span>
      <span>{message}</span>
    </div>
  );
}

export function Meter({ value, max = 100 }: { value: number; max?: number }) {
  const percent = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <span className="meter">
      <i style={{ width: `${percent}%` }} />
    </span>
  );
}

export function Separator() {
  return <span className="separator" aria-hidden="true" />;
}

export async function copyText(value: string) {
  try {
    await navigator.clipboard?.writeText(value);
    return true;
  } catch {
    // Embedded and headless browsers can deny clipboard access.
    return false;
  }
}

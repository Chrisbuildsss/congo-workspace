import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { ArrowUpIcon, CheckIcon, ChevronDownIcon, CloseIcon, PlusIcon } from "../Icons";
import type { AppRef } from "../types";
import { useClickOutside } from "./Ui";

export interface ComposerAttachment {
  name: string;
  url: string;
  file: File;
}

export interface ComposerValues {
  text: string;
  attachment: ComposerAttachment | null;
  appId: string | null;
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  apps = [],
  appId = null,
  onAppChange,
  contextChips = [],
  className = "",
  autoFocus = false,
  compact = false,
  disabled = false,
  note,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (values: ComposerValues) => void;
  placeholder: string;
  apps?: AppRef[];
  appId?: string | null;
  onAppChange?: (appId: string | null) => void;
  contextChips?: string[];
  className?: string;
  autoFocus?: boolean;
  compact?: boolean;
  disabled?: boolean;
  /** Short status under the field, e.g. why sending is unavailable. */
  note?: string;
}) {
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const [appOpen, setAppOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const appRef = useClickOutside<HTMLDivElement>(appOpen, () => setAppOpen(false));
  const app = apps.find((item) => item.id === appId) ?? null;

  useEffect(() => {
    if (autoFocus) textareaRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "0px";
    node.style.height = `${Math.min(node.scrollHeight, 160)}px`;
  }, [value]);

  useEffect(
    () => () => {
      if (attachment) URL.revokeObjectURL(attachment.url);
    },
    [attachment],
  );

  const submit = () => {
    if (disabled) return;
    const text = value.trim();
    if (!text && !attachment && contextChips.length === 0) return;
    onSubmit({ text, attachment, appId });
    setAttachment(null);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const hasInput = value.trim().length > 0 || !!attachment || contextChips.length > 0;

  return (
    <div
      className={`composer ${compact ? "composer-compact" : ""} ${
        focused ? "is-focused" : ""
      } ${className}`.trim()}
    >
      <div className="composer-body">
        {attachment || contextChips.length > 0 ? (
          <div className="composer-tokens">
            {contextChips.map((chip) => (
              <span className="composer-token" key={chip}>
                <span className="token-gem">◇</span>
                {chip}
              </span>
            ))}
            {attachment ? (
              <span className="composer-token composer-attachment">
                <img src={attachment.url} alt="" />
                {attachment.name}
                <button
                  type="button"
                  aria-label="Remove image"
                  onClick={() => {
                    URL.revokeObjectURL(attachment.url);
                    setAttachment(null);
                  }}
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            ) : null}
          </div>
        ) : null}

        <textarea
          ref={textareaRef}
          className="composer-input"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          rows={1}
          aria-label={placeholder}
        />

        <div className="composer-tools">
          <div className="composer-tool-group">
            <button
              type="button"
              className="composer-icon-button"
              aria-label="Add image"
              title="Add a reference image"
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (attachment) URL.revokeObjectURL(attachment.url);
                setAttachment({ name: file.name, url: URL.createObjectURL(file), file });
                event.currentTarget.value = "";
              }}
            />
          </div>

          <button
            type="button"
            className="composer-submit"
            aria-label="Send to your AI"
            disabled={!hasInput || disabled}
            onClick={submit}
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>

      <div className="composer-subbar">
        <div className="composer-menu-root" ref={appRef}>
          <button
            type="button"
            className="composer-select"
            aria-expanded={appOpen}
            onClick={() => setAppOpen((open) => !open)}
          >
            {app ? app.name : "No app"}
            <ChevronDownIcon size={10} />
          </button>
          {appOpen ? (
            <div className="composer-popover quality-popover">
              {[null, ...apps].map((item) => (
                <button
                  type="button"
                  key={item?.id ?? "none"}
                  className="composer-option"
                  data-selected={(item?.id ?? null) === appId || undefined}
                  onClick={() => {
                    onAppChange?.(item?.id ?? null);
                    setAppOpen(false);
                  }}
                >
                  <span className="option-radio">
                    {(item?.id ?? null) === appId ? <CheckIcon size={11} /> : null}
                  </span>
                  <span>
                    <b>{item ? item.name : "No app"}</b>
                    <small>{item ? item.path : "Explore without touching a project"}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {note ? <span className="composer-note">{note}</span> : null}
      </div>
    </div>
  );
}

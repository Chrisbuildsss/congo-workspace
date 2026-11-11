import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";
import {
  ArrowUpIcon,
  CheckIcon,
  ChevronDownIcon,
  CloseIcon,
  LinkIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
} from "../Icons";
import { styleOptions } from "../data";
import { useClickOutside } from "./Ui";

export type QualityOption = "Auto" | "Variant-Fast" | "Variant-Quality";
export type VisibilityOption = "Public" | "Private";

export interface ComposerAttachment {
  name: string;
  url: string;
}

export interface ComposerValues {
  text: string;
  quality: QualityOption;
  visibility: VisibilityOption;
  style: string | null;
  attachment: ComposerAttachment | null;
}

export default function Composer({
  value,
  onChange,
  onSubmit,
  placeholder,
  contextChips = [],
  className = "",
  autoFocus = false,
  compact = false,
  disabled = false,
  onShareCode,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (values: ComposerValues) => void;
  placeholder: string;
  contextChips?: string[];
  className?: string;
  autoFocus?: boolean;
  compact?: boolean;
  disabled?: boolean;
  onShareCode?: (code: string) => void;
}) {
  const [quality, setQuality] = useState<QualityOption>("Auto");
  const [visibility, setVisibility] = useState<VisibilityOption>("Public");
  const [style, setStyle] = useState<string | null>(null);
  const [attachment, setAttachment] = useState<ComposerAttachment | null>(null);
  const [qualityOpen, setQualityOpen] = useState(false);
  const [visibilityOpen, setVisibilityOpen] = useState(false);
  const [styleOpen, setStyleOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [focused, setFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const qualityRef = useClickOutside<HTMLDivElement>(qualityOpen, () =>
    setQualityOpen(false),
  );
  const visibilityRef = useClickOutside<HTMLDivElement>(visibilityOpen, () =>
    setVisibilityOpen(false),
  );
  const styleRef = useClickOutside<HTMLDivElement>(styleOpen, () =>
    setStyleOpen(false),
  );

  const filteredStyles = useMemo(
    () =>
      styleOptions.filter((item) =>
        item.name.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [search],
  );

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
    if (/^sref[-\s]/i.test(text) && onShareCode) {
      onShareCode(text.replace(/^sref[-\s]+/i, "").trim());
      return;
    }
    onSubmit({
      text,
      quality,
      visibility,
      style,
      attachment,
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  };

  const hasInput =
    value.trim().length > 0 || !!attachment || contextChips.length > 0;

  return (
    <div
      ref={containerRef}
      className={`composer ${compact ? "composer-compact" : ""} ${
        focused ? "is-focused" : ""
      } ${className}`.trim()}
    >
      <div className="composer-body">
        {attachment || style || contextChips.length > 0 ? (
          <div className="composer-tokens">
            {contextChips.map((chip) => (
              <span className="composer-token" key={chip}>
                <span className="token-gem">◇</span>
                {chip}
              </span>
            ))}
            {style ? (
              <span className="composer-token">
                <span className="token-gem">◈</span>
                {style}
                <button
                  type="button"
                  aria-label="Remove style"
                  onClick={() => setStyle(null)}
                >
                  <CloseIcon size={12} />
                </button>
              </span>
            ) : null}
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
          disabled={disabled}
          aria-label={placeholder}
        />

        <div className="composer-tools">
          <div className="composer-tool-group">
            <button
              type="button"
              className="composer-icon-button"
              aria-label="Add image"
              title="Add image"
              onClick={() => fileRef.current?.click()}
            >
              <PlusIcon />
            </button>
            <button
              type="button"
              className="composer-icon-button"
              aria-label="Select style"
              title="Select style"
              data-active={styleOpen || undefined}
              onClick={() => setStyleOpen((open) => !open)}
            >
              <span className="at-glyph">@</span>
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (attachment) URL.revokeObjectURL(attachment.url);
                setAttachment({
                  name: file.name,
                  url: URL.createObjectURL(file),
                });
                event.currentTarget.value = "";
              }}
            />
          </div>

          <button
            type="button"
            className="composer-submit"
            aria-label="Submit"
            disabled={!hasInput || disabled}
            onClick={submit}
          >
            <ArrowUpIcon />
          </button>
        </div>
      </div>

      <div className="composer-subbar">
        <div className="composer-menu-root" ref={qualityRef}>
          <button
            type="button"
            className="composer-select"
            aria-expanded={qualityOpen}
            onClick={() => setQualityOpen((open) => !open)}
          >
            <SparkIcon size={12} />
            {quality}
            <ChevronDownIcon size={10} />
          </button>
          {qualityOpen ? (
            <div className="composer-popover quality-popover">
              {[
                ["Auto", "Uses the best model for the job"],
                ["Variant-Fast", "Great for quickly exploring ideas"],
                ["Variant-Quality", "When you need the highest quality designs"],
              ].map(([label, description]) => (
                <button
                  type="button"
                  key={label}
                  className="composer-option"
                  data-selected={quality === label || undefined}
                  onClick={() => {
                    setQuality(label as QualityOption);
                    setQualityOpen(false);
                  }}
                >
                  <span className="option-radio">
                    {quality === label ? <CheckIcon size={11} /> : null}
                  </span>
                  <span>
                    <b>{label}</b>
                    <small>{description}</small>
                  </span>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="composer-menu-root" ref={visibilityRef}>
          <button
            type="button"
            className="composer-select"
            aria-expanded={visibilityOpen}
            onClick={() => setVisibilityOpen((open) => !open)}
          >
            {visibility}
            <ChevronDownIcon size={10} />
          </button>
          {visibilityOpen ? (
            <div className="composer-popover visibility-popover">
              <button
                type="button"
                className="composer-option"
                data-selected={visibility === "Public" || undefined}
                onClick={() => {
                  setVisibility("Public");
                  setVisibilityOpen(false);
                }}
              >
                <span className="option-radio">
                  {visibility === "Public" ? <CheckIcon size={11} /> : null}
                </span>
                <span>
                  <b>Public</b>
                  <small>Designs appear in search and community</small>
                </span>
              </button>
              <button
                type="button"
                className="composer-option"
                data-selected={visibility === "Private" || undefined}
                onClick={() => {
                  setVisibility("Private");
                  setVisibilityOpen(false);
                }}
              >
                <span className="option-radio">
                  {visibility === "Private" ? <CheckIcon size={11} /> : null}
                </span>
                <span>
                  <span className="option-title-row">
                    <b>Private</b>
                    <em>Pro</em>
                  </span>
                  <small>Designs are only visible to you</small>
                </span>
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {styleOpen ? (
        <div className="style-picker" ref={styleRef}>
          <div className="style-search-row">
            <SearchIcon size={18} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search or paste a share code"
              autoFocus
            />
          </div>
          <div className="style-picker-heading">
            <span>Styles</span>
            <span>{filteredStyles.length}</span>
          </div>
          <div className="style-picker-list">
            {filteredStyles.map((item) => (
              <button
                type="button"
                key={item.name}
                onClick={() => {
                  setStyle(item.name);
                  setStyleOpen(false);
                }}
              >
                <span
                  className="style-swatch"
                  style={{ background: item.swatch }}
                />
                <span>{item.name}</span>
                {style === item.name ? <CheckIcon size={13} /> : null}
              </button>
            ))}
            {filteredStyles.length === 0 ? (
              <div className="style-empty">
                <LinkIcon />
                <span>Paste a share code or try another search</span>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

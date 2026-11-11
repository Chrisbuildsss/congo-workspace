import { useState, type FormEvent } from "react";
import Composer, {
  type ComposerValues,
} from "../components/Composer";
import DesignCard, { type CardAction } from "../components/DesignCard";
import {
  BackIcon,
  ChevronDownIcon,
  EllipsisIcon,
  PaletteIcon,
  PanelIcon,
  PlusIcon,
  SearchIcon,
  SparkIcon,
} from "../Icons";
import type { ChatProject, Design } from "../types";
import { useClickOutside } from "../components/Ui";

const suggestions = [
  "Surprise me",
  "Personal blog",
  "Note taking app",
  "A brutalist landing page",
];

function GeneratingCard({ index }: { index: number }) {
  return (
    <div className="generating-card" style={{ animationDelay: `${index * 90}ms` }}>
      <div className="generating-bar" />
      <div className="generating-line width-72" />
      <div className="generating-line width-48" />
      <div className="generating-block" />
    </div>
  );
}

export default function ChatView({
  chat,
  chatOpen,
  setChatOpen,
  isGenerating,
  prompt,
  setPrompt,
  onGenerate,
  onOpenDesign,
  onCardAction,
  onRename,
  onDelete,
  onLike,
  onBookmark,
  liked,
  bookmarked,
  selected,
  onToggleSelected,
  onBackToProjects,
  showToast,
  contextChips = [],
}: {
  chat: ChatProject;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  isGenerating: boolean;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onGenerate: (values: ComposerValues) => void;
  onOpenDesign: (design: Design, editing?: boolean) => void;
  onCardAction: (action: CardAction, design: Design) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onLike: (design: Design) => void;
  onBookmark: (design: Design) => void;
  liked: Set<string>;
  bookmarked: Set<string>;
  selected: Set<string>;
  onToggleSelected: (design: Design) => void;
  onBackToProjects: () => void;
  showToast: (message: string) => void;
  contextChips?: string[];
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(chat.title);
  const [styleDropper, setStyleDropper] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const optionsRef = useClickOutside<HTMLDivElement>(optionsOpen, () =>
    setOptionsOpen(false),
  );

  const applySuggestion = (suggestion: string) => {
    if (suggestion === "Surprise me") {
      const choices = [
        "An expressive event microsite for a late-night listening party",
        "A warm editorial portfolio for an independent architect",
        "A playful product launch page for a tiny smart speaker",
      ];
      setPrompt(choices[Math.floor(Math.random() * choices.length)]);
      return;
    }
    setPrompt(suggestion);
  };

  const handleRename = (event: FormEvent) => {
    event.preventDefault();
    const next = renameValue.trim();
    if (next) onRename(next);
    setRenaming(false);
  };

  return (
    <div
      className={`chat-layout ${chatOpen ? "chat-panel-open" : "chat-panel-closed"} ${
        styleDropper ? "style-dropper-active" : ""
      }`}
    >
      <header className="chat-header">
        <div className="chat-header-left">
          {renaming ? (
            <form className="chat-title-form" onSubmit={handleRename}>
              <input
                autoFocus
                value={renameValue}
                onChange={(event) => setRenameValue(event.target.value)}
                onBlur={() => {
                  if (renameValue.trim()) onRename(renameValue.trim());
                  setRenaming(false);
                }}
                aria-label="Project name"
              />
            </form>
          ) : (
            <button
              type="button"
              className="chat-project-title"
              aria-label={chatOpen ? chat.title : "Open chat"}
              onClick={() => {
                if (!chatOpen) setChatOpen(true);
              }}
            >
              {chat.title}
            </button>
          )}
          {chatOpen ? (
            <button
              type="button"
              className="chat-header-icon chat-collapse"
              aria-label="Close chat"
              onClick={() => setChatOpen(false)}
            >
              <PanelIcon />
            </button>
          ) : null}
        </div>
        <div className="chat-header-actions">
          {chatOpen ? (
            <button
              type="button"
              className="chat-cursor-mode"
              aria-label="Toggle style dropper"
              aria-pressed={styleDropper}
              data-active={styleDropper || undefined}
              onClick={() => {
                setStyleDropper((active) => !active);
                showToast(styleDropper ? "Style dropper off" : "Pick any design to borrow its style");
              }}
            >
              <PaletteIcon />
            </button>
          ) : null}
          <div className="chat-options-wrap" ref={optionsRef}>
            <button
              type="button"
              className="chat-header-icon"
              aria-label="Menu"
              data-open={optionsOpen || undefined}
              onClick={() => setOptionsOpen((open) => !open)}
            >
              <EllipsisIcon />
            </button>
            {optionsOpen ? (
              <div className="chat-options-menu">
                <button
                  type="button"
                  onClick={() => {
                    setOptionsOpen(false);
                    setRenameValue(chat.title);
                    setRenaming(true);
                  }}
                >
                  Rename
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => {
                    setOptionsOpen(false);
                    setDeleteConfirm(true);
                  }}
                >
                  Delete project
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {chatOpen ? (
        <aside className="chat-panel">
          <div className="chat-messages">
            {chat.messages.length === 0 && !isGenerating ? (
              <div className="chat-empty-state">
                <div className="empty-grid-glyph">
                  <span /><span /><span /><span />
                </div>
                <p>Enter an idea below to start seeing endless designs. Just scroll to see more.</p>
                <div className="suggestion-list">
                  {suggestions.map((suggestion) => (
                    <button
                      type="button"
                      key={suggestion}
                      onClick={() => applySuggestion(suggestion)}
                    >
                      {suggestion === "Surprise me" ? <SparkIcon size={14} /> : <span className="tiny-square" />}
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {chat.messages.map((message) =>
              message.role === "user" ? (
                <div className="chat-message chat-message-user" key={message.id}>
                  <div className="message-author-avatar">M</div>
                  <div>
                    <span className="chat-message-label">You</span>
                    <p>{message.text}</p>
                  </div>
                </div>
              ) : (
                <div className="assistant-response" key={message.id}>
                  <div className="assistant-status">
                    <span><SearchIcon size={16} /></span>
                    Searching for inspiration: all styles
                  </div>
                  {chat.designs.length > 0 ? (
                    <div className="assistant-status">
                      <span><GridIconForChat /></span>
                      Explored {chat.designs.length} designs
                    </div>
                  ) : null}
                  <p>{message.text}</p>
                  {chat.designs.length > 0 ? (
                    <ol className="assistant-result-list">
                      {chat.designs.map((design, index) => (
                        <li key={design.id}>
                          <button type="button" onClick={() => onOpenDesign(design)}>
                            {design.title}
                          </button>
                          <span>
                            — {design.kind === "archive" && "A stark archival direction with oversized editorial type and a metadata-led grid."}
                            {design.kind === "signal" && "A warm, tactile journal with confident type and a focused reading rhythm."}
                            {design.kind === "folio" && "A quiet portrait-led composition balancing image, type, and generous negative space."}
                            {design.kind === "grid" && "A modular, kinetic system built around a flexible color-block grid."}
                            {design.kind === "aura" && "A cinematic product mood with atmospheric depth and a restrained access flow."}
                            {design.kind === "post" && "A tactile travel experience grounded in the feeling of a hotel key card."}
                            {design.kind === "mint" && "A playful product story pairing editorial copy with a characterful machine illustration."}
                            {design.kind === "portfolio" && "A direct portfolio system with a saturated field and oversized name treatment."}
                          </span>
                        </li>
                      ))}
                    </ol>
                  ) : null}
                </div>
              ),
            )}

            {isGenerating ? (
              <div className="assistant-response generating-response">
                <div className="assistant-status is-loading">
                  <span><SearchIcon size={16} /></span>
                  Searching for inspiration: all styles
                  <i />
                </div>
                <div className="assistant-status is-loading">
                  <span><GridIconForChat /></span>
                  Exploring directions
                  <i />
                </div>
                <p>Mapping the visual language, then exploring distinct ways into the idea.</p>
              </div>
            ) : null}
          </div>

          <div className="chat-composer-wrap">
            <Composer
              value={prompt}
              onChange={setPrompt}
              onSubmit={onGenerate}
              placeholder="Design anything..."
              contextChips={contextChips}
              compact
              disabled={isGenerating}
            />
          </div>
        </aside>
      ) : null}

      <main className={`chat-canvas ${chatOpen ? "" : "is-full"}`}>
        <div className="chat-canvas-scroll">
          {isGenerating ? (
            <div className="chat-design-grid">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <GeneratingCard key={index} index={index} />
              ))}
            </div>
          ) : chat.designs.length > 0 ? (
            <div className="chat-design-grid">
              {chat.designs.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  onOpen={() => onOpenDesign(design)}
                  onAction={onCardAction}
                  onLike={() => onLike(design)}
                  onBookmark={() => onBookmark(design)}
                  liked={liked.has(design.id)}
                  bookmarked={bookmarked.has(design.id)}
                  selected={selected.has(design.id)}
                  onToggleSelected={() => onToggleSelected(design)}
                  showLike={false}
                  showAuthor={false}
                />
              ))}
            </div>
          ) : (
            <div className="empty-grid">
              <span />
              <span />
              <span />
              <span />
            </div>
          )}
          {chat.designs.length > 0 && !isGenerating ? (
            <div className="scroll-more-designs">
              <span className="scroll-progress-ring">
                <i />
              </span>
              <span>Scroll to see more designs</span>
            </div>
          ) : null}
        </div>
      </main>

      {deleteConfirm ? (
        <div className="confirm-overlay" onMouseDown={() => setDeleteConfirm(false)}>
          <div className="confirm-card" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Delete this project?</h2>
            <p>This removes the design conversation from Projects. This action cannot be undone.</p>
            <div>
              <button type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
              <button type="button" className="danger" onClick={onDelete}>Delete project</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function GridIconForChat() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" />
      <rect x="9.5" y="1.5" width="5" height="5" rx="1" stroke="currentColor" />
      <rect x="1.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" />
      <rect x="9.5" y="9.5" width="5" height="5" rx="1" stroke="currentColor" />
    </svg>
  );
}

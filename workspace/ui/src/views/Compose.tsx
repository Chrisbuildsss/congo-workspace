import { useState, type FormEvent } from "react";
import Composer, { type ComposerValues } from "../components/Composer";
import DesignCard, { type CardAction, type MenuItem, type QuickAction } from "../components/DesignCard";
import { EllipsisIcon, PanelIcon, SearchIcon } from "../Icons";
import type { AppRef, Compose, Design, WorkspaceRequest } from "../types";

const BUILD_THIS: QuickAction = { key: "build", label: "Build this", icon: "↗" };

const CARD_MENU: MenuItem[] = [
  { key: "open", label: "Open design" },
  { key: "preview", label: "Open in new tab" },
  { key: "delete", label: "Delete design", danger: true },
];
import { useClickOutside } from "../components/Ui";

const suggestions = [
  "Redesign my settings page",
  "Three takes on my pricing page",
  "A calmer dashboard home",
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

export default function ComposeView({
  compose,
  designs,
  apps,
  aiConnected,
  chatOpen,
  setChatOpen,
  prompt,
  setPrompt,
  onSend,
  requests = [],
  onAppChange,
  onOpenDesign,
  onCardAction,
  onRename,
  onDelete,
  onBookmark,
  bookmarked,
  selected,
  onToggleSelected,
  contextChips = [],
}: {
  compose: Compose;
  designs: Design[];
  apps: AppRef[];
  aiConnected: boolean;
  chatOpen: boolean;
  setChatOpen: (open: boolean) => void;
  prompt: string;
  setPrompt: (prompt: string) => void;
  onSend: (values: ComposerValues) => void;
  requests?: WorkspaceRequest[];
  onAppChange: (appId: string | null) => void;
  onOpenDesign: (design: Design) => void;
  onCardAction: (action: CardAction, design: Design) => void;
  onRename: (title: string) => void;
  onDelete: () => void;
  onBookmark: (design: Design) => void;
  bookmarked: Set<string>;
  selected: Set<string>;
  onToggleSelected: (design: Design) => void;
  contextChips?: string[];
}) {
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(compose.title);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const optionsRef = useClickOutside<HTMLDivElement>(optionsOpen, () => setOptionsOpen(false));
  const waiting = compose.status === "waiting";
  const open = requests.filter((r) => r.status === "sent");
  // One placeholder per design your AI is still writing.
  const expected = open.reduce((sum, r) => sum + r.outputs.filter((id) => !compose.designIds.includes(id)).length, 0);
  const actionsNote = aiConnected ? undefined : "Needs a connected AI";

  const handleRename = (event: FormEvent) => {
    event.preventDefault();
    const next = renameValue.trim();
    if (next) onRename(next);
    setRenaming(false);
  };

  return (
    <div className={`chat-layout ${chatOpen ? "chat-panel-open" : "chat-panel-closed"}`}>
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
                aria-label="Compose name"
              />
            </form>
          ) : (
            <button
              type="button"
              className="chat-project-title"
              aria-label={chatOpen ? compose.title : "Open conversation"}
              onClick={() => {
                if (!chatOpen) setChatOpen(true);
              }}
            >
              {compose.title}
            </button>
          )}
          {chatOpen ? (
            <button
              type="button"
              className="chat-header-icon chat-collapse"
              aria-label="Close conversation"
              onClick={() => setChatOpen(false)}
            >
              <PanelIcon />
            </button>
          ) : null}
        </div>
        <div className="chat-header-actions">
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
                    setRenameValue(compose.title);
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
                  Delete compose
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      {chatOpen ? (
        <aside className="chat-panel">
          <div className="chat-messages">
            {compose.messages.length === 0 && !waiting ? (
              <div className="chat-empty-state">
                <div className="empty-grid-glyph">
                  <span /><span /><span /><span />
                </div>
                <p>
                  {aiConnected
                    ? "Describe a screen or a redesign. Your AI builds working alternatives and they appear here."
                    : "Connect your AI to start: ask it to open the Congo workspace, or run /redesign in its chat."}
                </p>
                <div className="suggestion-list">
                  {suggestions.map((suggestion) => (
                    <button type="button" key={suggestion} onClick={() => setPrompt(suggestion)}>
                      <span className="tiny-square" />
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {compose.messages.map((message) =>
              message.role === "user" ? (
                <div className="chat-message chat-message-user" key={message.id}>
                  <div className="message-author-avatar">Y</div>
                  <div>
                    <span className="chat-message-label">You</span>
                    <p>{message.text}</p>
                  </div>
                </div>
              ) : (
                <div className="assistant-response" key={message.id}>
                  <div className="assistant-status">
                    <span><GridIconForChat /></span>
                    Your AI
                  </div>
                  <p>{message.text}</p>
                </div>
              ),
            )}

            {designs.length > 0 ? (
              <div className="assistant-response">
                <ol className="assistant-result-list">
                  {designs.map((design) => (
                    <li key={design.id}>
                      <button type="button" onClick={() => onOpenDesign(design)}>
                        {design.title}
                      </button>
                      {design.summary ? <span> {design.summary}</span> : null}
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}

            {waiting ? (
              <div className="assistant-response generating-response">
                <div className="assistant-status is-loading">
                  <span><SearchIcon size={16} /></span>
                  {open.length > 1 ? `${open.length} requests with your AI` : "Sent to your AI"}
                  <i />
                </div>
                <p>
                  {open.some((r) => r.type === "build")
                    ? "Your AI is applying a design to your project. Follow along in its chat."
                    : "Your AI picks this up in its own chat. Designs appear here as they are ready."}
                </p>
              </div>
            ) : null}
          </div>

          <div className="chat-composer-wrap">
            <Composer
              value={prompt}
              onChange={setPrompt}
              onSubmit={onSend}
              placeholder="Describe a screen or redesign..."
              apps={apps}
              appId={compose.appId ?? null}
              onAppChange={onAppChange}
              contextChips={contextChips}
              compact
              disabled={!aiConnected}
              note={aiConnected ? undefined : "Needs a connected AI"}
            />
          </div>
        </aside>
      ) : null}

      <main className={`chat-canvas ${chatOpen ? "" : "is-full"}`}>
        <div className="chat-canvas-scroll">
          {designs.length > 0 ? (
            <div className="chat-design-grid">
              {designs.map((design) => (
                <DesignCard
                  key={design.id}
                  design={design}
                  onOpen={() => onOpenDesign(design)}
                  onAction={onCardAction}
                  onBookmark={() => onBookmark(design)}
                  bookmarked={bookmarked.has(design.id)}
                  selected={selected.has(design.id)}
                  onToggleSelected={() => onToggleSelected(design)}
                  showAuthor={false}
                  primary={BUILD_THIS}
                  showMore
                  menuItems={CARD_MENU}
                  actionsDisabledNote={actionsNote}
                />
              ))}
              {Array.from({ length: expected }, (_, index) => <GeneratingCard key={index} index={index} />)}
            </div>
          ) : waiting ? (
            <div className="chat-design-grid">
              {Array.from({ length: Math.max(expected, 1) }, (_, index) => (
                <GeneratingCard key={index} index={index} />
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
        </div>
      </main>

      {deleteConfirm ? (
        <div className="confirm-overlay" onMouseDown={() => setDeleteConfirm(false)}>
          <div className="confirm-card" onMouseDown={(event) => event.stopPropagation()}>
            <h2>Delete this compose?</h2>
            <p>This removes the conversation and its unsaved designs from the workspace. Saved designs stay in Projects.</p>
            <div>
              <button type="button" onClick={() => setDeleteConfirm(false)}>Cancel</button>
              <button type="button" className="danger" onClick={onDelete}>Delete compose</button>
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

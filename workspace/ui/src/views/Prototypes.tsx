import Composer, { type ComposerValues } from "../components/Composer";
import DesignCard, { TWEAKS, type CardAction, type MenuItem, type QuickAction } from "../components/DesignCard";
import { PanelIcon, SearchIcon } from "../Icons";
import type { AppRef, ChatMessage, Compose, Design, WorkspaceRequest } from "../types";

// Prototypes is the former Compose: everything the AI makes lands here as a
// card, one request per group, newest first. Prototypes live in Congo files;
// nothing changes a code project until Pull into a project.
const PULL: QuickAction = { key: "build", label: "Pull into a project", icon: "↗" };
const EXPAND: QuickAction = { key: "expand", label: "Expand", icon: "⤢" };

/** Requests whose results are new prototypes (Pull into a project changes a project instead). */
const PROTOTYPE_REQUESTS: WorkspaceRequest["type"][] = ["send", "compose", "tweak", "library"];

const CARD_MENU: MenuItem[] = [
  { key: "open", label: "Open" },
  { key: "preview", label: "Open in new tab" },
  { key: "build", label: "Pull into a project" },
  { key: "rename", label: "Rename" },
  { key: "delete", label: "Delete", danger: true },
];

const suggestions = [
  "A CRM for realtors calling expired listings",
  "Redesign my settings page",
  "A few directions for my pricing page",
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

function when(iso?: string) {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = Math.round((Date.now() - date.getTime()) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  return date.toLocaleDateString();
}

export default function PrototypesView({
  composes,
  designs,
  apps,
  appId,
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
}: {
  composes: Compose[];
  designs: Record<string, Design>;
  apps: AppRef[];
  /** The app new requests are for (null: a new app). */
  appId: string | null;
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
}) {
  // Requests this view reports on: new prototypes, Use this and rebuilds.
  const open = requests.filter((r) => r.status === "sent" && [...PROTOTYPE_REQUESTS, "build", "rebuild", "expand"].includes(r.type));
  const actionsNote = aiConnected ? undefined : "Needs a connected AI";

  // One group per request thread, newest first, each with its prototypes and
  // a placeholder for every one the AI is still writing.
  const groups = composes
    .map((compose) => {
      const cards = compose.designIds.map((id) => designs[id]).filter((d): d is Design => Boolean(d?.local));
      // A prototype shows as a skeleton from the moment it is asked for until
      // its first preview lands.
      const pending = open
        .filter((r) => r.composeId === compose.id && PROTOTYPE_REQUESTS.includes(r.type))
        .reduce((sum, r) => sum + r.outputs.filter((id) => !designs[id]).length, 0);
      return { compose, cards, pending };
    })
    .filter((group) => group.cards.length > 0 || group.pending > 0);
  // Prototypes the AI wrote without a workspace request (from its own chat).
  const grouped = new Set(composes.flatMap((compose) => compose.designIds));
  const loose = Object.values(designs)
    .filter((design) => design.local && !grouped.has(design.id))
    .sort((a, b) => ((a.createdAt ?? "") < (b.createdAt ?? "") ? 1 : -1));
  if (loose.length) {
    groups.unshift({
      compose: { id: "loose", title: "From your AI's chat", prompt: "", status: "complete", designIds: loose.map((d) => d.id), messages: [] },
      cards: loose,
      pending: 0,
    });
  }
  const total = groups.reduce((sum, group) => sum + group.cards.filter((card) => card.src).length, 0);
  const applying = open.filter((r) => r.type === "build" || r.type === "rebuild" || r.type === "expand");

  // The conversation across every request, oldest first.
  const messages: (ChatMessage & { composeId: string })[] = composes
    .flatMap((compose) => compose.messages.map((message) => ({ ...message, composeId: compose.id })))
    .sort((a, b) => ((a.at ?? "") < (b.at ?? "") ? -1 : 1));

  return (
    <div className={`chat-layout ${chatOpen ? "chat-panel-open" : "chat-panel-closed"}`}>
      <header className="chat-header">
        <div className="chat-header-left">
          <button
            type="button"
            className="chat-project-title"
            aria-label={chatOpen ? "Prototypes" : "Open the conversation"}
            onClick={() => {
              if (!chatOpen) setChatOpen(true);
            }}
          >
            Prototypes{total ? ` · ${total}` : ""}
          </button>
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
      </header>

      {chatOpen ? (
        <aside className="chat-panel">
          <div className="chat-messages">
            {messages.length === 0 && open.length === 0 ? (
              <div className="chat-empty-state">
                <div className="empty-grid-glyph">
                  <span /><span /><span /><span />
                </div>
                <p>
                  {aiConnected
                    ? "Send apps or screens from Explore, or describe what you want. Your AI makes a running prototype and it appears here. Pull into a project when you want it in your code."
                    : "Connect your AI to start: run /congo in its chat, or ask it to open the Congo workspace."}
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

            {messages.map((message) =>
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

            {open.length > 0 ? (
              <div className="assistant-response generating-response">
                <div className="assistant-status is-loading">
                  <span><SearchIcon size={16} /></span>
                  {open.length > 1 ? `${open.length} requests with your AI` : "Sent to your AI"}
                  <i />
                </div>
                <p>
                  {applying.some((r) => r.type === "build")
                    ? "Your AI is pulling a prototype into a project. Follow along in its chat; it says here where it went."
                    : applying.some((r) => r.type === "expand")
                      ? "Your AI is building out the rest of the app in the same prototype."
                    : applying.some((r) => r.type === "rebuild")
                      ? "Your AI is rebuilding the prototype with your edits."
                      : "Your AI picks this up in its own chat. Prototypes appear here as they are ready."}
                </p>
              </div>
            ) : null}
          </div>

          <div className="chat-composer-wrap">
            <Composer
              value={prompt}
              onChange={setPrompt}
              onSubmit={onSend}
              placeholder="Describe an app, a screen or a redesign..."
              apps={apps}
              appId={appId}
              onAppChange={onAppChange}
              noAppLabel="A new app"
              noAppHint="A prototype for something new"
              compact
              disabled={!aiConnected}
              note={aiConnected ? undefined : "Needs a connected AI"}
            />
          </div>
        </aside>
      ) : null}

      <main className={`chat-canvas ${chatOpen ? "" : "is-full"}`}>
        <div className="chat-canvas-scroll">
          {groups.length > 0 ? (
            <div className="prototype-groups">
              {groups.map(({ compose, cards, pending }) => (
                <section className="prototype-group" key={compose.id} aria-label={compose.title}>
                  <header className="prototype-group-head">
                    <b>{compose.title}</b>
                    <span>
                      {pending > 0 ? "Your AI is making it" : when(compose.messages[compose.messages.length - 1]?.at ?? cards[0]?.createdAt)}
                      {compose.id === "loose" ? "" : compose.appId ? ` · ${apps.find((app) => app.id === compose.appId)?.name ?? "your app"}` : " · new app"}
                    </span>
                  </header>
                  <div className="chat-design-grid">
                    {cards.map((design, index) =>
                      !design.src && design.status !== "error" ? (
                        <GeneratingCard key={design.id} index={index} />
                      ) : design.status === "error" && !design.src ? (
                        <div className="generating-card prototype-failed" key={design.id} role="status">
                          <p>
                            <b>{design.title}</b>
                            {design.error ?? "Your AI could not finish this one."}
                          </p>
                          <button type="button" onClick={() => onCardAction("delete", design)}>Remove</button>
                        </div>
                      ) : (
                        <DesignCard
                          key={design.id}
                          design={design}
                          onOpen={() => onOpenDesign(design)}
                          onAction={onCardAction}
                          showAuthor={false}
                          showSelect={false}
                          primary={PULL}
                          tweaks={design.status === "main" ? [EXPAND, ...TWEAKS] : TWEAKS}
                          showMore
                          menuItems={design.status === "main" ? [{ key: "expand", label: "Expand" }, ...CARD_MENU] : CARD_MENU}
                          actionsDisabledNote={design.status === "expanding" ? "Your AI is building out the rest" : actionsNote}
                        />
                      ),
                    )}
                    {Array.from({ length: pending }, (_, index) => <GeneratingCard key={index} index={index} />)}
                  </div>
                </section>
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

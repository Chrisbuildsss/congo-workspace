import type { ComposerValues } from "../components/Composer";
import DesignCard, { type CardAction } from "../components/DesignCard";
import { Topbar } from "../components/AppShell";
import type { Design } from "../types";

export default function CommunityView({
  items,
  onOpenDesign,
  onCardAction,
  onCompose,
  onLike,
  onBookmark,
  liked,
  bookmarked,
  selected,
  onToggleSelected,
}: {
  items: Design[];
  onOpenDesign: (design: Design) => void;
  onCardAction: (action: CardAction, design: Design) => void;
  onCompose: (values: ComposerValues) => void;
  onLike: (design: Design) => void;
  onBookmark: (design: Design) => void;
  liked: Set<string>;
  bookmarked: Set<string>;
  selected: Set<string>;
  onToggleSelected: (design: Design) => void;
}) {
  return (
    <div className="main-scroll community-scroll">
      <Topbar title="Community" />
      <div className="community-grid">
        {items.map((design) => (
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
            showEllipsis={false}
            showTitle={false}
          />
        ))}
      </div>
      <div className="feed-sentinel">
        <span>Keep scrolling for more directions</span>
      </div>
      <button
        type="button"
        className="feed-suggestion-chip"
        onClick={() =>
          onCompose({
            text: "A lush editorial portfolio with a warm tactile grid",
            quality: "Auto",
            visibility: "Public",
            style: "Editorial",
            attachment: null,
          })
        }
      >
        <span>Try</span>
        A lush editorial portfolio
        <i>↗</i>
      </button>
    </div>
  );
}

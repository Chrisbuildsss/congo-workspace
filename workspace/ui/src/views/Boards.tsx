import { BookmarkIcon, PlusIcon } from "../Icons";
import DesignCard, { type CardAction } from "../components/DesignCard";
import { Topbar } from "../components/AppShell";
import type { Board, Design } from "../types";

export default function BoardsView({
  boards,
  savedDesigns,
  onOpenBoard,
  onCreateBoard,
  onOpenDesign,
  onCardAction,
  onLike,
  onBookmark,
  liked,
  bookmarked,
  selected,
  onToggleSelected,
}: {
  boards: Board[];
  savedDesigns: Design[];
  onOpenBoard: (board: Board) => void;
  onCreateBoard: () => void;
  onOpenDesign: (design: Design) => void;
  onCardAction: (action: CardAction, design: Design) => void;
  onLike: (design: Design) => void;
  onBookmark: (design: Design) => void;
  liked: Set<string>;
  bookmarked: Set<string>;
  selected: Set<string>;
  onToggleSelected: (design: Design) => void;
}) {
  return (
    <div className="main-scroll boards-scroll">
      <Topbar title="Boards" />
      <div className="board-strip">
        <button
          type="button"
          className="board-create-card"
          onClick={onCreateBoard}
        >
          <span>
            <PlusIcon size={22} />
          </span>
        </button>
        {boards
          .filter((board) => board.id !== "board-default")
          .map((board) => (
            <button
              type="button"
              className="board-collection-card"
              key={board.id}
              onClick={() => onOpenBoard(board)}
            >
              <div>
                <BookmarkIcon />
                <span>{board.designIds.length || 0} items</span>
              </div>
              <strong>{board.name}</strong>
            </button>
          ))}
      </div>
      <section className="saved-section">
        <h2>All saved</h2>
        <div className="boards-grid">
          {savedDesigns.map((design) => (
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
              compact
              saved
              showEllipsis={false}
              showAuthor={false}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

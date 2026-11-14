import { Fragment, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Topbar } from "../components/AppShell";
import DesignCard, { type CardAction, type MenuItem, type QuickAction } from "../components/DesignCard";
import { useClickOutside } from "../components/Ui";
import { BackIcon, CheckIcon, ChevronDownIcon, FilterIcon, GridIcon, SearchIcon, SortIcon } from "../Icons";
import { getLibraryApps, getLibraryScreens, getSaved, getScreenCategories } from "../api";
import type { Design, LibraryApp, LibraryScreen, SavedState, ScreenCategory, TrayItem } from "../types";

/** Apps, Screens, or the apps saved on the account (the website's Saved). */
export type LibraryMode = "apps" | "screens" | "saved";

const PAGE = 24;

const PROTOTYPE_THIS: QuickAction = { key: "use", label: "Prototype this", icon: "↘" };

function menuFor(selected: boolean): MenuItem[] {
  return [
    { key: "select", label: selected ? "Remove from request" : "Select" },
    { key: "use", label: "Prototype this" },
    { key: "preview", label: "Preview" },
  ];
}

/** Tray key: one entry per catalog item. */
export function trayKey(item: { kind: string; id: string }) {
  return `${item.kind === "screen" ? "screen" : "app"}:${item.id}`;
}

export function appTrayItem(app: LibraryApp): TrayItem {
  return {
    kind: "template",
    id: app.id,
    version: app.release,
    app: { id: app.id, slug: app.slug, name: app.name },
    title: app.name,
    route: null,
    image: app.screenshot,
    preview: app.preview,
    url: app.url,
    note: "",
  };
}

export function screenTrayItem(screen: LibraryScreen): TrayItem {
  return {
    kind: "screen",
    id: screen.source?.id ?? screen.id,
    version: screen.source?.version ?? screen.version,
    app: screen.app ? { id: screen.app.id, slug: screen.app.slug, name: screen.app.name } : null,
    title: screen.title,
    route: screen.route,
    image: screen.screenshot,
    preview: screen.preview,
    url: screen.url,
    note: "",
  };
}

export function appDesign(app: LibraryApp): Design {
  return {
    id: `app:${app.slug}`,
    title: app.name,
    author: app.inspiredBy ? `Inspired by ${app.inspiredBy}` : undefined,
    format: "desktop",
    image: app.screenshot ?? undefined,
    previewUrl: app.preview,
    source: { kind: "template", id: app.id, app: app.slug, version: app.release ?? undefined },
  };
}

export function screenDesign(screen: LibraryScreen): Design {
  return {
    id: `screen:${screen.id}`,
    title: screen.title,
    author: screen.app?.name,
    format: screen.format,
    image: screen.screenshot ?? undefined,
    previewUrl: screen.preview,
    source: {
      kind: "screen",
      id: screen.source?.id ?? screen.id,
      version: screen.source?.version ?? screen.version ?? undefined,
      app: screen.app?.slug,
    },
  };
}

function GeneratingCards({ count = 4 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }, (_, index) => (
        <div className="generating-card" key={index} style={{ animationDelay: `${index * 90}ms` }}>
          <div className="generating-bar" />
          <div className="generating-line width-72" />
          <div className="generating-line width-48" />
          <div className="generating-block" />
        </div>
      ))}
    </>
  );
}

const LABELS: Record<LibraryMode, string> = { apps: "Apps", screens: "Screens", saved: "Saved" };
const HINTS: Record<LibraryMode, string> = {
  apps: "Browse Congo apps and open one",
  screens: "Browse every screen directly",
  saved: "Apps you saved on gocongo.ai",
};

function Switcher({ mode, onMode }: { mode: LibraryMode; onMode: (mode: LibraryMode) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  return (
    <div className="library-switch" ref={ref}>
      <button
        type="button"
        className="library-switch-button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {LABELS[mode]}
        <ChevronDownIcon size={10} />
      </button>
      {open ? (
        <div className="composer-popover visibility-popover" role="menu">
          {(["apps", "screens", "saved"] as const).map((value) => (
            <button
              type="button"
              key={value}
              role="menuitemradio"
              aria-checked={mode === value}
              className="composer-option"
              data-selected={mode === value || undefined}
              onClick={() => {
                onMode(value);
                setOpen(false);
              }}
            >
              <span className="option-radio">{mode === value ? <CheckIcon size={11} /> : null}</span>
              <span>
                <b>{LABELS[value]}</b>
                <small>{HINTS[value]}</small>
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

interface ToolOption {
  value: string;
  label: string;
  group?: string | null;
}

/** How many cards sit across on a wide window: the person's choice, kept in this browser. */
const COLUMNS_KEY = "congo-explore-columns";
const COLUMN_OPTIONS: ToolOption[] = [
  { value: "auto", label: "Fit the window" },
  { value: "2", label: "2 across" },
  { value: "3", label: "3 across" },
  { value: "4", label: "4 across" },
];
const SORT_OPTIONS: ToolOption[] = [
  { value: "featured", label: "Featured" },
  { value: "name", label: "Name, A to Z" },
  { value: "screens", label: "Most screens" },
];

function storedColumns(): string {
  try {
    const value = window.localStorage.getItem(COLUMNS_KEY) ?? "";
    return COLUMN_OPTIONS.some((option) => option.value === value) ? value : "auto";
  } catch {
    return "auto";
  }
}

/** An icon in the Explore bar that opens a short list to choose from. */
function ToolMenu({
  label,
  icon,
  value,
  fallback,
  options,
  onChange,
  className = "",
}: {
  label: string;
  icon: ReactNode;
  value: string;
  /** The value that means nothing is chosen; any other marks the icon. */
  fallback: string;
  options: ToolOption[];
  onChange: (value: string) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside<HTMLDivElement>(open, () => setOpen(false));
  const current = options.find((option) => option.value === value);
  const chosen = value !== fallback && current ? current.label : null;
  let group: string | null = null;
  return (
    <div className={`library-tool ${className}`} ref={ref}>
      <button
        type="button"
        className="library-tool-button"
        aria-label={chosen ? `${label}: ${chosen}` : label}
        title={chosen ? `${label}: ${chosen}` : label}
        aria-haspopup="menu"
        aria-expanded={open}
        data-active={chosen ? true : undefined}
        onClick={() => setOpen((state) => !state)}
      >
        {icon}
      </button>
      {open ? (
        <div className="composer-popover library-tool-menu" role="menu" aria-label={label}>
          <p className="library-tool-title">{label}</p>
          {options.map((option) => {
            const heading = option.group && option.group !== group ? option.group : null;
            if (option.group) group = option.group;
            return (
              <Fragment key={option.value}>
                {heading ? <p className="library-tool-group">{heading}</p> : null}
                <button
                  type="button"
                  role="menuitemradio"
                  aria-checked={option.value === value}
                  className="library-tool-option"
                  data-selected={option.value === value || undefined}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                >
                  <span className="option-radio">{option.value === value ? <CheckIcon size={11} /> : null}</span>
                  {option.label}
                </button>
              </Fragment>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function Filters({
  query,
  onQuery,
  placeholder,
  tools,
}: {
  query: string;
  onQuery: (value: string) => void;
  placeholder: string;
  /** The view, category and sort icons. */
  tools?: ReactNode;
}) {
  return (
    <div className="library-filters">
      <label className="library-search">
        <SearchIcon size={14} />
        <input
          type="search"
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
      </label>
      {tools}
    </div>
  );
}

export default function LibraryView({
  mode,
  appSlug,
  aiConnected,
  onMode,
  onOpenApp,
  onBack,
  onOpenItem,
  onAction,
  selected,
  onToggleSelect,
  onNoteItem,
}: {
  mode: LibraryMode;
  appSlug?: string;
  aiConnected: boolean;
  onMode: (mode: LibraryMode) => void;
  onOpenApp: (slug: string) => void;
  onBack: () => void;
  onOpenItem: (design: Design, context?: string) => void;
  onAction: (action: CardAction, design: Design) => void;
  /** Tray keys of the items in the request tray. */
  selected: Set<string>;
  onToggleSelect: (item: TrayItem) => void;
  /** A note typed on a card: the item joins the request with that note. */
  onNoteItem: (item: TrayItem, note: string) => void;
}) {
  const [saved, setSaved] = useState<SavedState | null>(null);
  const [apps, setApps] = useState<LibraryApp[] | null>(null);
  const [categories, setCategories] = useState<ScreenCategory[]>([]);
  const [screens, setScreens] = useState<LibraryScreen[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [category, setCategory] = useState("");
  const [appCategories, setAppCategories] = useState<{ id: string; title: string }[]>([]);
  const [appCategory, setAppCategory] = useState("");
  const [sort, setSort] = useState("featured");
  const [columns, setColumns] = useState(storedColumns);
  const sentinel = useRef<HTMLDivElement | null>(null);
  const serial = useRef(0);

  const showScreens = mode === "screens" || Boolean(appSlug);
  const savedMode = mode === "saved" && !appSlug;

  useEffect(() => {
    if (!savedMode) return;
    let live = true;
    getSaved()
      .then((value) => live && setSaved(value))
      .catch((reason: Error) => live && setSaved({ available: false, signedIn: null, ids: [], slugs: [], reason: reason.message }));
    return () => {
      live = false;
    };
  }, [savedMode]);
  const app = useMemo(() => apps?.find((item) => item.slug === appSlug) ?? null, [apps, appSlug]);
  const actionsNote = aiConnected ? undefined : "Needs a connected AI";

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadApps = useCallback(() => {
    setError(null);
    getLibraryApps()
      .then((value) => {
        setApps(value.apps);
        setAppCategories(value.categories ?? []);
      })
      .catch((reason: Error) => setError(reason.message));
  }, []);

  useEffect(() => {
    loadApps();
    getScreenCategories()
      .then((value) => setCategories(value.categories))
      .catch(() => {});
  }, [loadApps]);

  const loadScreens = useCallback(
    async (reset: boolean) => {
      const id = reset ? ++serial.current : serial.current;
      setLoading(true);
      setError(null);
      try {
        const offset = reset ? 0 : screens.length;
        const page = await getLibraryScreens({
          q: debounced || undefined,
          app: appSlug,
          category: appSlug ? undefined : category || undefined,
          offset,
          limit: PAGE,
        });
        if (id !== serial.current) return;
        setScreens((current) => (reset ? page.items : [...current, ...page.items]));
        setTotal(page.total);
      } catch (reason) {
        if (id === serial.current) setError((reason as Error).message);
      } finally {
        if (id === serial.current) setLoading(false);
      }
    },
    [appSlug, category, debounced, screens.length],
  );

  // New filters start a fresh list.
  useEffect(() => {
    if (!showScreens) return;
    setScreens([]);
    setTotal(null);
    void loadScreens(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showScreens, appSlug, category, debounced]);

  // Infinite scroll.
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !showScreens) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting) && !loading && total !== null && screens.length < total) {
        void loadScreens(false);
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadScreens, loading, screens.length, showScreens, total]);

  const filteredApps = useMemo(() => {
    if (!apps) return null;
    const needle = debounced.toLowerCase();
    let list = apps;
    if (savedMode) {
      if (!saved) return null;
      const ids = new Set(saved.ids);
      const slugs = new Set(saved.slugs);
      list = apps.filter((item) => ids.has(item.id) || slugs.has(item.slug));
    }
    if (appCategory) list = list.filter((item) => item.category === appCategory);
    if (needle) {
      list = list.filter((item) =>
        [item.name, item.summary, item.category ?? "", item.inspiredBy ?? ""].some((text) => text.toLowerCase().includes(needle)),
      );
    }
    // Featured is the order Congo lists them in.
    if (sort === "name") list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (sort === "screens") list = [...list].sort((a, b) => (b.pageCount ?? 0) - (a.pageCount ?? 0));
    return list;
  }, [apps, debounced, savedMode, saved, appCategory, sort]);

  const tools = (
    <>
      {showScreens && !appSlug ? (
        <ToolMenu
          label="Category"
          icon={<FilterIcon size={16} />}
          value={category}
          fallback=""
          options={[{ value: "", label: "All categories" }, ...categories.map((item) => ({ value: item.id, label: item.title, group: item.group }))]}
          onChange={setCategory}
        />
      ) : null}
      {!showScreens ? (
        <>
          <ToolMenu
            label="Category"
            icon={<FilterIcon size={16} />}
            value={appCategory}
            fallback=""
            options={[{ value: "", label: "All categories" }, ...appCategories.map((item) => ({ value: item.id, label: item.title }))]}
            onChange={setAppCategory}
          />
          <ToolMenu label="Sort" icon={<SortIcon size={16} />} value={sort} fallback="featured" options={SORT_OPTIONS} onChange={setSort} />
        </>
      ) : null}
      <ToolMenu
        className="library-tool-view"
        label="View"
        icon={<GridIcon size={16} />}
        value={columns}
        fallback="auto"
        options={COLUMN_OPTIONS}
        onChange={(value) => {
          setColumns(value);
          try {
            window.localStorage.setItem(COLUMNS_KEY, value);
          } catch {
            // Private windows may refuse storage; the choice still holds for this visit.
          }
        }}
      />
    </>
  );

  const title = appSlug ? (
    <button type="button" className="library-back" onClick={onBack} aria-label="Back to apps">
      <BackIcon size={16} />
      {app?.logo ? <img src={app.logo} alt="" /> : null}
      {app?.name ?? "App"}
    </button>
  ) : (
    <Switcher mode={mode} onMode={onMode} />
  );

  const filters = (
    <Filters
      query={query}
      onQuery={setQuery}
      placeholder={appSlug ? `Search ${app?.name ?? "this app"}'s screens` : showScreens ? "Search screens" : "Search apps"}
      tools={tools}
    />
  );


  return (
    <div className="main-scroll community-scroll">
      <Topbar left={title} className="library-topbar">
        {filters}
      </Topbar>
      <div className="library-mobile-filters">{filters}</div>

      {appSlug && app ? (
        <div className="library-app-meta">
          <span>{app.summary}</span>
          {app.pageCount ? <span>{app.pageCount} pages</span> : null}
          {app.preview ? (
            <a href={app.preview} target="_blank" rel="noopener noreferrer">
              Preview app ↗
            </a>
          ) : null}
        </div>
      ) : null}

      {savedMode && saved?.reason ? (
        <div className="library-error" role="status">
          {saved.reason}
          <button
            type="button"
            onClick={() => {
              setSaved(null);
              getSaved(true)
                .then(setSaved)
                .catch((reason: Error) => setSaved({ available: false, signedIn: null, ids: [], slugs: [], reason: reason.message }));
            }}
          >
            Check again
          </button>
        </div>
      ) : null}

      {error ? (
        <div className="library-error" role="alert">
          {error}
          <button type="button" onClick={() => (showScreens ? void loadScreens(true) : loadApps())}>
            Try again
          </button>
        </div>
      ) : null}

      <div className="community-grid explore-grid" data-columns={columns === "auto" ? undefined : columns}>
        {showScreens
          ? screens.map((screen) => {
              const design = screenDesign(screen);
              const item = screenTrayItem(screen);
              const isSelected = selected.has(trayKey(item));
              return (
                <DesignCard
                  key={screen.id}
                  design={design}
                  onOpen={() => onOpenItem(design, screen.app?.name)}
                  onAction={(action, card) => (action === "select" ? onToggleSelect(item) : onAction(action, card))}
                  primary={PROTOTYPE_THIS}
                  showMore
                  actionsDisabledNote={actionsNote}
                  menuItems={menuFor(isSelected)}
                  selected={isSelected}
                  onToggleSelected={() => onToggleSelect(item)}
                  clickDeselects={false}
                  natural
                  onNote={(note) => onNoteItem(item, note)}
                />
              );
            })
          : (filteredApps ?? []).map((app) => {
              const design = appDesign(app);
              const item = appTrayItem(app);
              const isSelected = selected.has(trayKey(item));
              return (
                <DesignCard
                  key={app.slug}
                  design={design}
                  onOpen={() => onOpenApp(app.slug)}
                  onAction={(action, card) => (action === "select" ? onToggleSelect(item) : onAction(action, card))}
                  primary={PROTOTYPE_THIS}
                  showMore
                  actionsDisabledNote={actionsNote}
                  menuItems={menuFor(isSelected)}
                  selected={isSelected}
                  onToggleSelected={() => onToggleSelect(item)}
                  clickDeselects={false}
                  natural
                  onNote={(note) => onNoteItem(item, note)}
                />
              );
            })}
        {(showScreens ? loading && screens.length === 0 : (!apps || (savedMode && !saved)) && !error) ? <GeneratingCards /> : null}
        {showScreens && loading && screens.length > 0 ? <GeneratingCards count={2} /> : null}
      </div>

      <div className="feed-sentinel" ref={sentinel}>
        <span>
          {showScreens
            ? total === null
              ? ""
              : total === 0
                ? "No screens match. Try another search."
                : screens.length < total
                  ? "Keep scrolling for more screens"
                  : `${total} screens`
            : filteredApps
              ? filteredApps.length === 0
                ? savedMode
                  ? saved?.reason
                    ? ""
                    : "Nothing saved yet. Save apps on gocongo.ai and they show here."
                  : "No apps match. Try another search."
                : `${filteredApps.length} ${savedMode ? "saved " : ""}apps · open one to see its screens`
              : ""}
        </span>
      </div>
    </div>
  );
}

import { createContext, useContext, useEffect, useRef, useState } from "react";
import type { Design } from "./types";

/** Origin that serves designs; never the API origin. */
export const ContentOrigin = createContext("");

const VIRTUAL_WIDTH = { desktop: 1440, mobile: 390 } as const;

export function designUrl(design: Design, origin: string): string | null {
  if (!design.src) return null;
  if (/^https?:\/\//.test(design.src)) return design.src;
  return origin ? `${origin}${design.src}` : null;
}

/**
 * Renders a design as running code (a scaled iframe) or, for library items,
 * its screenshot. Cards are not interactive; the detail view is.
 */
export default function DesignFrame({
  design,
  interactive = false,
}: {
  design: Design;
  interactive?: boolean;
}) {
  const origin = useContext(ContentOrigin);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(0);
  const url = designUrl(design, origin);
  const width = VIRTUAL_WIDTH[design.format] ?? VIRTUAL_WIDTH.desktop;

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || interactive) return;
    const update = () => setScale(node.clientWidth / width);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [interactive, width]);

  if (url) {
    return (
      <div className={`surface design-frame ${interactive ? "is-interactive" : ""}`} ref={wrapRef}>
        <iframe
          src={url}
          title={design.title}
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
          referrerPolicy="no-referrer"
          tabIndex={interactive ? 0 : -1}
          style={
            interactive
              ? undefined
              : {
                  width: `${width}px`,
                  height: scale ? `${100 / scale}%` : "100%",
                  transform: `scale(${scale})`,
                  visibility: scale ? "visible" : "hidden",
                }
          }
        />
      </div>
    );
  }
  if (design.image) {
    return (
      <div className="surface design-frame">
        <img src={design.image} alt="" loading="lazy" decoding="async" />
      </div>
    );
  }
  return <div className="surface design-frame is-empty" />;
}

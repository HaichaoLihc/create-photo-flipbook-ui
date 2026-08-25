"use client";

import HTMLFlipBook from "react-pageflip";
import {
  type CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { PhotoBookPage } from "./book-pages";
import "./photo-flipbook.css";

type FlipBookHandle = {
  pageFlip: () => {
    flipNext: (corner?: "top" | "bottom") => void;
    flipPrev: (corner?: "top" | "bottom") => void;
    flip: (page: number, corner?: "top" | "bottom") => void;
  };
};

const DEFAULT_PAGE = { width: 500, height: 680 };
const DEFAULT_PADDING = 14;

function resolveBookLayout(pages: PhotoBookPage[]) {
  const imagePages = pages.filter((page) => page.image);
  const first = imagePages[0];
  const uniformDimensions = Boolean(
    first?.width &&
      first?.height &&
      imagePages.every(
        (page) => page.width === first.width && page.height === first.height,
      ),
  );
  const source = uniformDimensions
    ? { width: first.width!, height: first.height! }
    : DEFAULT_PAGE;
  const scale = Math.min(
    DEFAULT_PAGE.width / source.width,
    DEFAULT_PAGE.height / source.height,
  );
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));

  return {
    width,
    height,
    minWidth: Math.max(1, Math.round(width * 0.56)),
    minHeight: Math.max(1, Math.round(height * 0.56)),
    maxWidth: Math.round(width * 1.04),
    maxHeight: Math.round(height * 1.04),
    defaultFit: uniformDimensions ? ("fill" as const) : ("contain" as const),
    defaultPadding: uniformDimensions ? 0 : DEFAULT_PADDING,
  };
}

const Leaf = forwardRef<
  HTMLDivElement,
  {
    page: PhotoBookPage;
    index: number;
    isHard: boolean;
    defaultFit: "fill" | "contain";
    defaultPadding: number;
  }
>(
  function Leaf({ page, index, isHard, defaultFit, defaultPadding }, ref) {
    const blank = !page.image && !page.text && !page.caption;
    const fit = page.fit ?? defaultFit;
    const padding = page.padding ?? defaultPadding;

    return (
      <article
        ref={ref}
        className={`photo-leaf photo-leaf--fit-${fit}${index === 0 ? " photo-leaf--cover" : ""}${isHard && index > 0 ? " photo-leaf--back-cover" : ""}${blank ? " photo-leaf--blank" : ""}`}
        aria-label={page.alt || "Blank back cover"}
        data-density={isHard ? "hard" : "soft"}
        data-page-id={page.id}
        data-source-filename={page.sourceFilename}
        style={
          {
            "--photo-padding": `${padding}px`,
            "--photo-inset": `${padding * 2}px`,
          } as CSSProperties
        }
      >
        {page.image ? <img src={page.image} alt={page.alt} draggable={false} /> : null}
        {page.caption || page.text ? (
          <div className="photo-leaf__copy">
            {page.caption ? <p className="photo-leaf__caption">{page.caption}</p> : null}
            {page.text ? <p>{page.text}</p> : null}
          </div>
        ) : null}
      </article>
    );
  },
);

export function makeLeaves(pages: PhotoBookPage[]) {
  const leaves = [...pages];
  if (leaves.length % 2) {
    leaves.push({ id: "back-cover", alt: "Blank back cover" });
  }
  return leaves;
}

export function PhotoFlipbook({
  pages,
  title = "Photo Book",
  kicker = "Folio",
  meta = "Open spread",
}: {
  pages: PhotoBookPage[];
  title?: string;
  kicker?: string;
  meta?: string;
}) {
  const book = useRef<FlipBookHandle | null>(null);
  const [current, setCurrent] = useState(0);
  const [isTurning, setIsTurning] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const leaves = useMemo(() => makeLeaves(pages), [pages]);
  const layout = useMemo(() => resolveBookLayout(pages), [pages]);
  const roomStyle = {
    "--flipbook-page-ratio": layout.width / layout.height,
    "--flipbook-spread-ratio": (layout.width * 2) / layout.height,
    "--flipbook-max-spread": `${layout.maxWidth * 2}px`,
  } as CSSProperties;

  const previous = useCallback(() => {
    if (!isTurning) book.current?.pageFlip().flipPrev("bottom");
  }, [isTurning]);
  const next = useCallback(() => {
    if (!isTurning) book.current?.pageFlip().flipNext("bottom");
  }, [isTurning]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || isTurning) return;
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previous();
      }
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        next();
      }
      if (event.key === "Home") book.current?.pageFlip().flip(0, "bottom");
      if (event.key === "End") book.current?.pageFlip().flip(leaves.length - 1, "bottom");
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isTurning, leaves.length, next, previous]);

  const onBackCover = current >= pages.length;
  const visiblePage = Math.min(current + 1, pages.length);

  return (
    <main
      className={`flipbook-room${isTurning ? " is-turning" : ""}`}
      style={roomStyle}
    >
      <header className="flipbook-header">
        <span>{kicker}</span>
        <h1>{title}</h1>
        <span>{orientation === "portrait" ? "Single leaf" : meta}</span>
      </header>

      <section className="flipbook-stage" aria-label={`${title} interactive photo book`}>
        <div className="flipbook-ground-shadow" aria-hidden="true" />
        <div className="photo-book-rig">
          <HTMLFlipBook
            ref={book}
            className="photo-book"
            style={{}}
            width={layout.width}
            height={layout.height}
            size="stretch"
            minWidth={layout.minWidth}
            maxWidth={layout.maxWidth}
            minHeight={layout.minHeight}
            maxHeight={layout.maxHeight}
            startPage={0}
            drawShadow
            flippingTime={780}
            usePortrait
            startZIndex={10}
            autoSize
            maxShadowOpacity={0.42}
            showCover
            mobileScrollSupport={false}
            clickEventForward
            useMouseEvents
            swipeDistance={26}
            showPageCorners
            disableFlipByClick={false}
            onFlip={(event) => setCurrent(Number(event.data))}
            onChangeOrientation={(event) =>
              setOrientation(event.data as "portrait" | "landscape")
            }
            onChangeState={(event) => setIsTurning(event.data !== "read")}
          >
            {leaves.map((page, index) => (
              <Leaf
                key={page.id}
                page={page}
                index={index}
                isHard={index === 0 || index === leaves.length - 1}
                defaultFit={layout.defaultFit}
                defaultPadding={layout.defaultPadding}
              />
            ))}
          </HTMLFlipBook>
        </div>
      </section>

      <footer className="flipbook-controls" aria-label="Book controls">
        <button
          type="button"
          onClick={previous}
          disabled={current === 0 || isTurning}
          aria-label="Previous page"
        >
          <span aria-hidden="true">‹</span>
        </button>
        <div className="flipbook-status" aria-live="polite" aria-atomic="true">
          <span>
            {onBackCover
              ? "Back cover"
              : `${String(visiblePage).padStart(2, "0")} / ${String(pages.length).padStart(2, "0")}`}
          </span>
          <small>Drag, swipe, or use arrow keys</small>
        </div>
        <button
          type="button"
          onClick={next}
          disabled={current >= leaves.length - 1 || isTurning}
          aria-label="Next page"
        >
          <span aria-hidden="true">›</span>
        </button>
      </footer>
    </main>
  );
}

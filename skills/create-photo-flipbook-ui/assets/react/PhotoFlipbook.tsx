"use client";

import HTMLFlipBook from "react-pageflip";
import {
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

type RenderablePhotoBookPage = PhotoBookPage & {
  sourceFilename?: string;
  caption?: string;
  text?: string;
  fit?: "fill" | "cover" | "contain";
};

const Leaf = forwardRef<HTMLDivElement, { page: RenderablePhotoBookPage; index: number }>(
  function Leaf({ page, index }, ref) {
    const blank = !page.image && !page.text && !page.caption;
    const fit = page.fit ?? "fill";

    return (
      <article
        ref={ref}
        className={`photo-leaf photo-leaf--fit-${fit}${index === 0 ? " photo-leaf--cover" : ""}${blank ? " photo-leaf--blank" : ""}`}
        aria-label={page.alt || "Blank back cover"}
        data-density="hard"
        data-page-id={page.id}
        data-source-filename={page.sourceFilename}
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

export function makeLeaves(pages: RenderablePhotoBookPage[]) {
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
  pages: RenderablePhotoBookPage[];
  title?: string;
  kicker?: string;
  meta?: string;
}) {
  const book = useRef<FlipBookHandle | null>(null);
  const [current, setCurrent] = useState(0);
  const [isTurning, setIsTurning] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("landscape");
  const leaves = useMemo(() => makeLeaves(pages), [pages]);

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
    <main className={`flipbook-room${isTurning ? " is-turning" : ""}`}>
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
            width={500}
            height={680}
            size="stretch"
            minWidth={280}
            maxWidth={520}
            minHeight={380}
            maxHeight={707}
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
              <Leaf key={page.id} page={page} index={index} />
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

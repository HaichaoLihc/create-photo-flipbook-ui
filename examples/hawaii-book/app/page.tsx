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
import { bookPages, type BookPage } from "./book-pages";

type FlipBookHandle = {
  pageFlip: () => {
    flipNext: (corner?: "top" | "bottom") => void;
    flipPrev: (corner?: "top" | "bottom") => void;
    flip: (page: number, corner?: "top" | "bottom") => void;
  };
};

const Page = forwardRef<HTMLDivElement, { page: BookPage; number: number }>(
  function Page({ page, number }, ref) {
    const hasContent = Boolean(page.title || page.body || page.image);
    const imageOnly = Boolean(page.image && !page.title && !page.body);

    return (
      <article
        ref={ref}
        className={`book-page book-page--${page.tone ?? "paper"}${page.image ? " book-page--image" : ""}`}
        aria-label={`Page ${number}${hasContent ? "" : ", blank"}`}
        data-density="hard"
      >
        {!page.image && <div className="paper-grain" aria-hidden="true" />}
        {hasContent && (
          <div className={`page-content${imageOnly ? " page-content--image-only" : ""}`}>
            {page.eyebrow && <p className="page-eyebrow">{page.eyebrow}</p>}
            {page.image && (
              <figure className={imageOnly ? "page-figure--full" : undefined}>
                {/* The native element keeps page images portable and easy to swap. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={page.image} alt={page.imageAlt ?? ""} />
                {page.caption && <figcaption>{page.caption}</figcaption>}
              </figure>
            )}
            {page.title && <h2>{page.title}</h2>}
            {page.body && <p className="page-body">{page.body}</p>}
          </div>
        )}
        <span className="page-number" aria-hidden="true">
          {String(number).padStart(2, "0")}
        </span>
      </article>
    );
  },
);

export default function Home() {
  const bookRef = useRef<FlipBookHandle | null>(null);
  const [page, setPage] = useState(0);
  const [isTurning, setIsTurning] = useState(false);
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(
    "landscape",
  );

  const total = bookPages.length;
  const progress = useMemo(
    () => (total > 1 ? Math.round((page / (total - 1)) * 100) : 0),
    [page, total],
  );

  const previous = useCallback(() => {
    bookRef.current?.pageFlip().flipPrev("bottom");
  }, []);

  const next = useCallback(() => {
    bookRef.current?.pageFlip().flipNext("bottom");
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight" || event.key === " ") {
        event.preventDefault();
        next();
      }
      if (event.key === "Home") bookRef.current?.pageFlip().flip(0, "bottom");
      if (event.key === "End")
        bookRef.current?.pageFlip().flip(total - 1, "bottom");
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [next, previous, total]);

  return (
    <main className={`atelier ${isTurning ? "is-turning" : ""}`}>
      <header className="topbar">
        <div className="brand-lockup">
          <div className="mark" aria-label="Folio home">F</div>
          <span>Folio</span>
        </div>
        <p>Hawaii · Twenty twenty-six</p>
        <div className="top-meta">
          <i aria-hidden="true" />
          <span>{orientation === "portrait" ? "Single leaf" : "Open spread"}</span>
        </div>
      </header>

      <section className="book-stage" aria-label="Interactive Hawaii photo book">
        <div className="ambient ambient-one" aria-hidden="true" />
        <div className="ambient ambient-two" aria-hidden="true" />
        <div className="book-shadow" aria-hidden="true" />
        <div className="book-rig">
          <HTMLFlipBook
            ref={bookRef}
            className="flip-book"
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
            flippingTime={860}
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
            onFlip={(event) => setPage(Number(event.data))}
            onChangeOrientation={(event) =>
              setOrientation(event.data as "portrait" | "landscape")
            }
            onChangeState={(event) =>
              setIsTurning(event.data !== "read")
            }
          >
            {bookPages.map((bookPage, index) => (
              <Page key={bookPage.id} page={bookPage} number={index + 1} />
            ))}
          </HTMLFlipBook>
        </div>
      </section>

      <footer className="controls" aria-label="Book controls">
        <p className="hint">
          <span className="cursor-glyph" aria-hidden="true">↗</span>
          Drag the edge to turn
        </p>
        <div className="control-cluster">
          <button
            type="button"
            onClick={previous}
            disabled={page === 0 || isTurning}
            aria-label="Previous page"
          >
            ‹
          </button>
          <div className="page-status" aria-live="polite">
            <span>{String(page + 1).padStart(2, "0")}</span>
            <div className="progress-track" aria-hidden="true">
              <i style={{ width: `${progress}%` }} />
            </div>
            <span>{String(total).padStart(2, "0")}</span>
          </div>
          <button
            type="button"
            onClick={next}
            disabled={page >= total - 1 || isTurning}
            aria-label="Next page"
          >
            ›
          </button>
        </div>
        <p className="key-hint"><kbd>←</kbd><kbd>→</kbd> to browse</p>
      </footer>
    </main>
  );
}

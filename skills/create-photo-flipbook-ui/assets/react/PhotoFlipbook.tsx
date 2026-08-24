"use client";

import HTMLFlipBook from "react-pageflip";
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PhotoBookPage } from "./book-pages";
import "./photo-flipbook.css";

type Handle = {
  pageFlip: () => {
    flipNext: (corner?: "top" | "bottom") => void;
    flipPrev: (corner?: "top" | "bottom") => void;
  };
};

const Leaf = forwardRef<HTMLDivElement, { page: PhotoBookPage }>(function Leaf(
  { page },
  ref,
) {
  return (
    <article ref={ref} className="photo-leaf" aria-label={page.alt || "Blank page"}>
      {page.image ? <img src={page.image} alt={page.alt} draggable={false} /> : null}
    </article>
  );
});

export function PhotoFlipbook({
  pages,
  title = "Photo Book",
}: {
  pages: PhotoBookPage[];
  title?: string;
}) {
  const book = useRef<Handle | null>(null);
  const [current, setCurrent] = useState(0);
  const leaves = useMemo(() => {
    const result = [...pages];
    if (result.length % 2) result.push({ id: "back-cover", alt: "Blank back cover" });
    return result;
  }, [pages]);

  const previous = useCallback(() => book.current?.pageFlip().flipPrev("bottom"), []);
  const next = useCallback(() => book.current?.pageFlip().flipNext("bottom"), []);

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "ArrowLeft") previous();
      if (event.key === "ArrowRight" || event.key === " ") next();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [next, previous]);

  return (
    <main className="flipbook-room">
      <header>
        <span>Folio</span><h1>{title}</h1>
        <span>{String(current + 1).padStart(2, "0")} / {String(leaves.length).padStart(2, "0")}</span>
      </header>
      <section className="flipbook-stage" aria-label={title}>
        <div className="ground-shadow" aria-hidden="true" />
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
          flippingTime={820}
          usePortrait
          startZIndex={10}
          autoSize
          maxShadowOpacity={0.42}
          showCover
          mobileScrollSupport={false}
          clickEventForward
          useMouseEvents
          swipeDistance={28}
          showPageCorners
          disableFlipByClick={false}
          onFlip={(event) => setCurrent(Number(event.data))}
        >
          {leaves.map((page) => <Leaf key={page.id} page={page} />)}
        </HTMLFlipBook>
      </section>
      <footer>
        <button onClick={previous} disabled={current === 0} aria-label="Previous page">‹</button>
        <span>Drag the page edge</span>
        <button onClick={next} disabled={current >= leaves.length - 1} aria-label="Next page">›</button>
      </footer>
    </main>
  );
}

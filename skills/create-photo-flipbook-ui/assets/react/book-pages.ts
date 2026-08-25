export type PhotoBookPage = {
  id: string;
  image?: string;
  alt: string;
  sourceFilename?: string;
  width?: number;
  height?: number;
  caption?: string;
  text?: string;
  fit?: "fill" | "cover" | "contain";
  padding?: number;
};

// Record every image's natural pixel size. The book selects the source aspect
// ratio that minimizes aggregate extra letterboxing across the complete set.
export const pages: PhotoBookPage[] = [
  {
    id: "cover",
    image: "/book-pages/page-01.jpg",
    alt: "Photo book cover",
    sourceFilename: "page-01.jpg",
    width: 3000,
    height: 4000,
  },
  {
    id: "page-02",
    image: "/book-pages/page-02.jpg",
    alt: "Left page of the first spread",
    sourceFilename: "page-02.jpg",
    width: 3000,
    height: 4000,
  },
  {
    id: "page-03",
    image: "/book-pages/page-03.jpg",
    alt: "Right page of the first spread",
    sourceFilename: "page-03.jpg",
    width: 3000,
    height: 4000,
  },
];

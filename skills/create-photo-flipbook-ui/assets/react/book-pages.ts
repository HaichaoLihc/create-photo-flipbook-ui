export type PhotoBookPage = {
  id: string;
  image?: string;
  alt: string;
  sourceFilename?: string;
  caption?: string;
  text?: string;
  fit?: "fill" | "cover" | "contain";
};

export const pages: PhotoBookPage[] = [
  {
    id: "cover",
    image: "/book-pages/page-01.jpg",
    alt: "Photo book cover",
    sourceFilename: "page-01.jpg",
    fit: "fill",
  },
  {
    id: "page-02",
    image: "/book-pages/page-02.jpg",
    alt: "Left page of the first spread",
    sourceFilename: "page-02.jpg",
    fit: "fill",
  },
  {
    id: "page-03",
    image: "/book-pages/page-03.jpg",
    alt: "Right page of the first spread",
    sourceFilename: "page-03.jpg",
    fit: "fill",
  },
];

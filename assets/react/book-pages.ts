export type PhotoBookPage = {
  id: string;
  image?: string;
  alt: string;
};

export const pages: PhotoBookPage[] = [
  { id: "cover", image: "/book-pages/page-01.jpg", alt: "Photo book cover" },
  { id: "page-2", image: "/book-pages/page-02.jpg", alt: "Left page of the first spread" },
  { id: "page-3", image: "/book-pages/page-03.jpg", alt: "Right page of the first spread" },
];

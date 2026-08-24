/**
 * The book's content layer.
 *
 * Add objects to this array to extend the book. Blank pages need only an id.
 * Text and image fields are already part of the model and rendered by Page.
 */
export type BookPage = {
  id: string;
  eyebrow?: string;
  title?: string;
  body?: string;
  image?: string;
  imageAlt?: string;
  caption?: string;
  tone?: "paper" | "warm" | "dark";
};

export const bookPages: BookPage[] = [
  {
    id: "hawaii-cover",
    image: "/book-pages-hd/page-01-cover-hd.jpg",
    imageAlt: "Hawaii 2026 cover with a beach and mountain collage",
  },
  {
    id: "palm-stickers",
    image: "/book-pages-hd/page-02-hd.jpg",
    imageAlt: "Palm trees and ocean with a playful Hawaii sticker collage",
  },
  {
    id: "vintage-hawaii",
    image: "/book-pages-hd/page-03-hd.jpg",
    imageAlt: "Vintage illustrated Hawaii postcard collage",
  },
  {
    id: "route-and-surfboards",
    image: "/book-pages-hd/page-04-hd.jpg",
    imageAlt: "Travel route map layered over a row of surfboards",
  },
  {
    id: "surfboard-type",
    image: "/book-pages-hd/page-05-hd.jpg",
    imageAlt: "Surfboards beneath outlined Hawaii typography",
  },
  {
    id: "mountain-left",
    image: "/book-pages-hd/page-06-hd.jpg",
    imageAlt: "Lush Hawaii mountain view with blue graphic blocks",
  },
  {
    id: "mountain-right",
    image: "/book-pages-hd/page-07-hd.jpg",
    imageAlt: "Continuation of the lush mountain panorama",
  },
  {
    id: "aloha-pattern",
    image: "/book-pages-hd/page-08-hd.jpg",
    imageAlt: "Coral Aloha pattern page",
  },
  {
    id: "two-beaches",
    image: "/book-pages-hd/page-09-hd.jpg",
    imageAlt: "Two framed Hawaii beach photographs",
  },
  {
    id: "lifeguard",
    image: "/book-pages-hd/page-10-hd.jpg",
    imageAlt: "Layered monochrome palm and lifeguard tower photograph",
  },
  {
    id: "aloha-state",
    image: "/book-pages-hd/page-11-hd.jpg",
    imageAlt: "Expressive Aloha State typographic collage",
  },
  {
    id: "back-cover",
    tone: "warm",
  },
];

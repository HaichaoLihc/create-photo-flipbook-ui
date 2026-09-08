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

export type LibraryBook = {
  id: string;
  title: string;
  spineMark: string;
  color: string;
  ink: string;
  cover: string;
  ratio: number;
  spineHeight: number;
  pages: PhotoBookPage[];
};

export const books: LibraryBook[] = [
  {
    id: "death-valley",
    title: "DEATH / VALLEY",
    spineMark: "A",
    color: "#c8bda8",
    ink: "#315b8f",
    cover: "/books/death-valley/page-00-front-cover.png",
    ratio: 0.75,
    spineHeight: 68,
    pages: [
      ["front-cover", "page-00-front-cover.png", "Death Valley front cover with golden badlands on cream paper"],
      ["first-light-left", "page-01-first-light-left.png", "Golden badlands opening across torn paper"],
      ["first-light-right", "page-02-first-light-right.png", "Sunlit ridge and the words First light"],
      ["at-the-edge-left", "page-03-at-the-edge-left.png", "Sparse illustrated valley and the words At the edge"],
      ["at-the-edge-right", "page-04-at-the-edge-right.png", "A solitary traveler overlooking Death Valley"],
      ["salt-distance-left", "page-05-salt-distance-left.png", "A salt path leading toward distant mountains"],
      ["salt-distance-right", "page-06-salt-distance-right.png", "Small walkers crossing the wide salt flat"],
      ["afterglow-left", "page-07-afterglow-left.png", "Sunset reflected in salt water channels"],
      ["afterglow-right", "page-08-afterglow-right.png", "Blue-hour basin and torn-paper reflection marks"],
      ["small-figures-left", "page-09-small-figures-left.png", "Two visitors framed against pale badlands"],
      ["small-figures-right", "page-10-small-figures-right.png", "Tiny figures beneath an ochre rock wall"],
      ["looking-back-left", "page-11-looking-back-left.png", "A woman looking across the badlands at dusk"],
      ["looking-back-right", "page-12-looking-back-right.png", "Quiet cream page with a cobalt ridge and the words Looking back"],
      ["back-cover", "page-13-back-cover.png", "Quiet cream back cover with a cobalt badlands contour"],
    ].map(([id, filename, alt]) => ({
      id: String(id),
      image: `/books/death-valley/${filename}`,
      alt: String(alt),
      sourceFilename: String(filename),
      width: 768,
      height: 1024,
    })),
  },
];

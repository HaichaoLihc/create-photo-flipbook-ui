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
    id: "still-reaching",
    title: "STILL REACHING",
    spineMark: "A",
    color: "#ecebe3",
    ink: "#247b68",
    cover: "/books/still-reaching/cover.jpg",
    ratio: 0.6,
    spineHeight: 73,
    pages: [
      ["cover", "cover.jpg", 900, 1500], ["work-04", "work-04.jpg", 900, 1500],
      ["work-05", "work-05.jpg", 900, 1500], ["work-06", "work-06.jpg", 900, 1500],
      ["work-07", "work-07.jpg", 900, 1500], ["work-08", "work-08.jpg", 900, 1500],
      ["work-14", "work-14.jpg", 900, 1500], ["work-21", "work-21.jpg", 900, 1499],
      ["work-22", "work-22.jpg", 900, 1500],
    ].map(([id, filename, width, height]) => ({
      id: String(id), image: `/books/still-reaching/${filename}`,
      alt: id === "cover" ? "Cover of Still Reaching" : "Still Reaching artwork",
      sourceFilename: String(filename), width: Number(width), height: Number(height),
    })),
  },
  {
    id: "hawaii",
    title: "HAWAI'I",
    spineMark: "B",
    color: "#e0443f",
    ink: "#22221e",
    cover: "/books/hawaii/page-01-cover-hd.jpg",
    ratio: 0.72,
    spineHeight: 61,
    pages: [
      ["cover", "page-01-cover-hd.jpg", 1108, 1420], ["page-02", "page-02-hd.jpg", 753, 1045],
      ["page-03", "page-03-hd.jpg", 753, 1045], ["page-04", "page-04-hd.jpg", 752, 1045],
      ["page-05", "page-05-hd.jpg", 753, 1045], ["page-06", "page-06-hd.jpg", 753, 1045],
      ["page-07", "page-07-hd.jpg", 753, 1045], ["page-08", "page-08-hd.jpg", 752, 1045],
      ["page-09", "page-09-hd.jpg", 753, 1045], ["page-10", "page-10-hd.jpg", 752, 1045],
      ["page-11", "page-11-hd.jpg", 753, 1045],
    ].map(([id, filename, width, height]) => ({
      id: String(id), image: `/books/hawaii/${filename}`,
      alt: id === "cover" ? "Cover of Hawai'i" : "Hawai'i photo book page",
      sourceFilename: String(filename), width: Number(width), height: Number(height),
    })),
  },
  {
    id: "falling-light",
    title: "FALLING LIGHT",
    spineMark: "C",
    color: "#176cbe",
    ink: "#ff6f3e",
    cover: "/books/falling-light/01-falling-light.png",
    ratio: 1.5,
    spineHeight: 30,
    pages: [
      ["cover", "01-falling-light.png", "exec-9b8c7f59-aaf2-45d2-80d7-6e3111557f81.png", 1254, 1254],
      ["page-02", "02-desert.png", "exec-dc1ed105-ef1c-4586-a399-493ee7874a31.png", 1491, 1055],
      ["page-03", "03-horizon.png", "exec-ed7bcce1-9a89-4b20-bc95-80d2528b3d97.png", 1536, 1024],
      ["page-04", "04-desert.png", "exec-ed8bb253-220a-4697-be77-943aaba87c1e.png", 1536, 1024],
    ].map(([id, filename, sourceFilename, width, height]) => ({
      id: String(id), image: `/books/falling-light/${filename}`,
      alt: id === "cover" ? "Cover of Falling Light" : "Falling Light landscape page",
      sourceFilename: String(sourceFilename), width: Number(width), height: Number(height),
    })),
  },
  {
    id: "death-valley",
    title: "DEATH / VALLEY",
    spineMark: "D",
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

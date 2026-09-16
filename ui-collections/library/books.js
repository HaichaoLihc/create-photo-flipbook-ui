// Mock metadata only. The reader intentionally contains no photos or pages.
export const books = [
  {
    id: "book-01",
    title: "Book 01",
    paper: "#d9dcc7",
    ink: "#294438",
    height: 0.78,
    pages: [],
  },
  {
    id: "book-02",
    title: "Book 02",
    paper: "#232b2c",
    ink: "#ece9dd",
    height: 0.91,
    pages: [],
  },
  {
    id: "book-03",
    title: "Book 03",
    paper: "#d34530",
    ink: "#171916",
    height: 0.6,
    pages: [],
  },
];

export function bookUrl(id) {
  return `book.html?book=${encodeURIComponent(id)}`;
}

export function selectedBook(search) {
  const id = new URLSearchParams(search).get("book");
  return books.find((book) => book.id === id) ?? null;
}

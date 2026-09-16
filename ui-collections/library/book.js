import { selectedBook } from "./books.js";

const book = selectedBook(window.location.search);
const title = book?.title ?? "Book not found";

document.title = `${title} — Photo Books Library`;
document.querySelector("#reader-title").textContent = title;
document.querySelector("#empty-title").textContent = book ? "Empty book" : title;
document.querySelector("#empty-description").textContent = book
  ? "No pages yet."
  : "Return to the library to choose a book.";

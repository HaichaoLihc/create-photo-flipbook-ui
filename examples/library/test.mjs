import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";
import { books, bookUrl, selectedBook } from "./books.js";
import { restoreOrder } from "./shelf-order.js";

test("the three mock books have unique IDs, no pages, and working reader destinations", async () => {
  assert.equal(books.length, 3);
  assert.equal(new Set(books.map((book) => book.id)).size, 3);
  for (const book of books) {
    assert.deepEqual(book.pages, []);
    const url = new URL(bookUrl(book.id), import.meta.url);
    assert.equal(selectedBook(url.search), book);
    assert.ok((await stat(new URL(url.pathname, url))).isFile());
  }
});

test("missing and unknown reader IDs do not silently select a different book", () => {
  for (const search of ["", "?book=", "?book=missing", "?book=../outside", "?book=%3Cscript%3E"]) {
    assert.equal(selectedBook(search), null);
  }
});

test("saved arrangements ignore stale IDs and duplicates, appending newly added books", () => {
  const ids = ["a", "b", "c", "new"];
  const saved = ["removed", "c", "c", null, "a", { id: "b" }];
  assert.deepEqual(restoreOrder(ids, saved), ["c", "a", "b", "new"]);
  assert.deepEqual(ids, ["a", "b", "c", "new"]);
  assert.deepEqual(saved, ["removed", "c", "c", null, "a", { id: "b" }]);
});

test("absent or malformed saved arrangements retain the catalog order", () => {
  for (const saved of [null, undefined, false, 12, "c,a,b", { a: 1 }, []]) {
    assert.deepEqual(restoreOrder(["a", "b", "c"], saved), ["a", "b", "c"]);
  }
  assert.deepEqual(restoreOrder([], ["removed"]), []);
});

test("HTML assets, return links, and module imports resolve locally", async () => {
  for (const filename of ["index.html", "book.html", "collection.js", "book.js", "books.js", "shelf-order.js"]) {
    const base = new URL(filename, import.meta.url);
    const source = await readFile(base, "utf8");
    const references = filename.endsWith(".html")
      ? [...source.matchAll(/(?:href|src)="([^"#]+)"/g)].map((match) => match[1])
      : [...source.matchAll(/from\s+"([^"]+)"/g)].map((match) => match[1]);
    for (const reference of references) {
      if (reference.startsWith("data:")) continue;
      const url = new URL(reference, base);
      assert.equal(url.protocol, "file:", `${filename}: unexpected external dependency ${reference}`);
      assert.ok((await stat(url)).isFile(), `${filename}: missing ${reference}`);
    }
  }
});

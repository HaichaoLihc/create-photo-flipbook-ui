import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("./", import.meta.url);
const index = await readFile(new URL("index.html", root), "utf8");
const script = await readFile(new URL("flipbook.js", root), "utf8");
const styles = await readFile(new URL("styles.css", root), "utf8");
const pages = [...index.matchAll(/<article\b[^>]*class="[^"]*\bbook-page\b[^"]*"[^>]*>/g)].map(
  ([tag]) => tag,
);

test("template is vanilla HTML", () => {
  assert.doesNotMatch(`${index}\n${script}\n${styles}`, /react|jsx|vite/i);
  assert.match(index, /id="book"/);
  assert.match(index, /data-page-width="\d+"/);
  assert.match(index, /data-page-height="\d+"/);
  assert.match(index, /vendor\/page-flip\.browser\.js/);
  assert.match(script, /new St\.PageFlip/);
  assert.match(script, /loadFromHTML\(pages\)/);
  assert.match(script, /bookElement\.dataset\.pageWidth/);
  assert.match(script, /bookElement\.dataset\.pageHeight/);
  assert.match(styles, /\.book-page\.\--left::before/);
  assert.match(styles, /\.book-page\.\--right::before/);
  assert.match(styles, /z-index:\s*3/);
  assert.match(styles, /linear-gradient\(to (?:left|right)/);
  assert.doesNotMatch(styles, /box-shadow:\s*inset/);
  assert.doesNotMatch(styles, /book-gutter|data-orientation="landscape"/);
});

test("cover and page density contract is valid", () => {
  assert.ok(pages.length >= 2);
  assert.match(pages[0], /data-density="hard"/);
  assert.match(pages.at(-1), /data-density="hard"/);
  for (const page of pages.slice(1, -1)) assert.doesNotMatch(page, /data-density="hard"/);
});

test("default page size stays inside the UI envelope", () => {
  const width = Number(index.match(/data-page-width="(\d+)"/)?.[1]);
  const height = Number(index.match(/data-page-height="(\d+)"/)?.[1]);
  assert.ok(Math.max(width, height) <= 640);
});

test("generated spread halves preserve cover and facing-page order", () => {
  const attribute = (tag, name) => tag.match(new RegExp(`${name}="([^"]+)"`))?.[1];
  assert.ok(pages.length >= 4 && pages.length % 2 === 0);
  for (const page of pages) {
    assert.match(page, /\bgenerated-page\b/);
    assert.ok(attribute(page, "data-spread-id"));
  }
  const coverId = attribute(pages[0], "data-spread-id");
  assert.equal(attribute(pages.at(-1), "data-spread-id"), coverId);
  assert.equal(attribute(pages[0], "data-half"), "right");
  assert.equal(attribute(pages.at(-1), "data-half"), "left");
  const seen = new Set([coverId]);
  for (let index = 1; index < pages.length - 1; index += 2) {
    const id = attribute(pages[index], "data-spread-id");
    assert.equal(seen.has(id), false, `Repeated spread: ${id}`);
    seen.add(id);
    assert.equal(attribute(pages[index + 1], "data-spread-id"), id);
    assert.equal(attribute(pages[index], "data-half"), "left");
    assert.equal(attribute(pages[index + 1], "data-half"), "right");
  }
});

test("vendored runtime and artwork directories exist", async () => {
  assert.equal((await stat(new URL("vendor/page-flip.browser.js", root))).isFile(), true);
  for (const directory of ["assets/pages/", "assets/spreads/"]) {
    assert.equal((await stat(new URL(directory, root))).isDirectory(), true);
  }
});

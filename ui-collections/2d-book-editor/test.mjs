import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const root = new URL("./", import.meta.url);
const index = await readFile(new URL("index.html", root), "utf8");
const script = await readFile(new URL("flipbook.js", root), "utf8");

test("example is vanilla HTML with the expected page contract", () => {
  assert.doesNotMatch(index, /react|vite/i);
  assert.equal((index.match(/class="book-page/g) || []).length, 8);
  assert.match(index, /vendor\/page-flip\.browser\.js/);
  assert.match(index, /data-page-width="\d+"/);
  assert.match(index, /data-page-height="\d+"/);
  assert.match(script, /new St\.PageFlip/);
  assert.match(script, /loadFromHTML\(pages\)/);
});

test("upload and vendored runtime folders exist", async () => {
  assert.equal((await stat(new URL("assets/photos/", root))).isDirectory(), true);
  assert.equal((await stat(new URL("vendor/page-flip.browser.js", root))).isFile(), true);
});

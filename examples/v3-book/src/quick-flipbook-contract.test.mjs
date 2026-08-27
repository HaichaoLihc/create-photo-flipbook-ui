import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
const books = await readFile(new URL("./books.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("./style.css", import.meta.url), "utf8");
const config = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");

test("v3 uses the requested Quick FlipBook lifecycle", () => {
  assert.match(main, /import \{ FlipBook \} from "quick_flipbook"/);
  assert.match(main, /new FlipBook\(/);
  assert.match(main, /flipBook\.setPages\(/);
  assert.match(main, /flipBook\.animate\(delta\)/);
});

test("reader supports buttons, pointer gestures, and keyboard navigation", () => {
  assert.match(main, /flipBook\.nextPage\(\)/);
  assert.match(main, /flipBook\.previousPage\(\)/);
  assert.match(main, /pointerdown/);
  assert.match(main, /pointercancel/);
  assert.match(main, /ArrowRight/);
  assert.match(main, /ArrowLeft/);
});

test("v3 exposes four editions and owns its public asset library", () => {
  assert.equal((books.match(/id: "/g) || []).length, 4);
  assert.match(config, /publicDir: "public"/);
});

test("v3 keeps the interface silent and the stage white", () => {
  assert.doesNotMatch(html, /QUICK FLIPBOOK STUDY|FOUR EDITIONS|CLICK EITHER SIDE|PREV|NEXT/);
  assert.match(styles, /background:\s*#fff/);
  assert.match(main, /scene\.background = new THREE\.Color\("#ffffff"\)/);
});

test("v3 uses a straight-on fitted camera and flat page materials", () => {
  assert.match(main, /new THREE\.OrthographicCamera/);
  assert.match(main, /camera\.up\.set\(0, 0, -1\)/);
  assert.match(main, /bookRig\.rotation\.set\(0, 0, 0\)/);
  assert.match(main, /new THREE\.MeshBasicMaterial\(\{ map: texture, toneMapped: false \}\)/);
  assert.match(main, /const spreadWidth = selectedBook\.ratio \* 2/);
  assert.match(main, /camera\.right = halfHeight \* aspect/);
});

test("v3 settles page materials and avoids per-frame DOM writes", () => {
  assert.match(main, /for \(let index = 0; index < pageMaterials\.length; index \+= 1\) await Promise\.resolve\(\)/);
  assert.match(main, /if \(statusKey === lastStatusKey\) return/);
});

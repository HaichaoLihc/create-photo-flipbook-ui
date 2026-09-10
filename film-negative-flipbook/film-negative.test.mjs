import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { index, records, sleeveCount } from "./test-fixture.mjs";

const root = new URL("./", import.meta.url);
const styles = await readFile(new URL("styles.css", root), "utf8");
const script = await readFile(new URL("flipbook.js", root), "utf8");
const arrangement = await readFile(new URL("strip-arrangement.js", root), "utf8");
const archiveSleeves = [...index.matchAll(/<article class="book-page sleeve-page[^"]*"[^>]*aria-label="Negative sleeve[^"]*">([\s\S]*?)<\/article>/g)];
const archiveMarkup = archiveSleeves.map(([sleeve]) => sleeve).join("");

test("every archive photograph appears once inside a negative frame", () => {
  const frames = [...archiveMarkup.matchAll(/<button class="negative-frame"/g)];
  const sources = [...archiveMarkup.matchAll(/src="assets\/full-archive\/(archive-\d+\.png)"/g)].map((match) => match[1]);

  assert.equal(frames.length, records.length);
  assert.equal(sources.length, records.length);
  assert.equal(new Set(sources).size, records.length);
});

test("supplied sequence is preserved with a partially filled final sleeve", () => {
  const rendered = [...archiveMarkup.matchAll(/src="assets\/full-archive\/archive-(\d+)\.png"/g)].map((match) => Number(match[1]));
  assert.deepEqual(rendered, records.map(record => record.index));
  assert.equal(archiveSleeves.length, sleeveCount);
  assert.equal([...archiveSleeves.at(-1)[1].matchAll(/<button /g)].length, records.length % 35);
});

test("every populated sleeve is a five by seven grid", () => {
  const sleeves = archiveSleeves;

  assert.equal(sleeves.length, sleeveCount);
  for (const [, sleeve] of sleeves) {
    assert.equal([...sleeve.matchAll(/class="negative-frame/g)].length, 35);
    assert.equal([...sleeve.matchAll(/class="film-pocket"/g)].length, 7);
  }
  assert.match(styles, /grid-template-columns:\s*repeat\(5,/);
  assert.match(styles, /grid-template-rows:\s*repeat\(7,/);
});

test("archive starts on the first right leaf and preserves spread parity", () => {
  const leaves = [...index.matchAll(/<article\b[^>]*>[\s\S]*?<\/article>/g)].map(([leaf]) => leaf);
  assert.match(leaves[1], /opening-blank/);
  assert.match(leaves[2], /sleeve-page recto/);
  assert.match(leaves[2], /Negative sleeve 1,/);
  assert.equal(leaves.length, sleeveCount + 3 + (sleeveCount % 2 === 0 ? 1 : 0));
  assert.equal(leaves.length % 2, 0);
  for (let i = 2; i < leaves.length - 1; i++) {
    if (leaves[i].includes("sleeve-page")) assert.match(leaves[i], new RegExp("sleeve-page " + (i % 2 ? "verso" : "recto")));
  }
});

test("sleeve stays clean and uses only a grey punched binding rail", () => {
  assert.doesNotMatch(index, /class="sleeve-label"/);
  assert.doesNotMatch(index, /class="sleeve-footer"/);
  assert.match(styles, /\.binder-holes[\s\S]*background:/);
  assert.match(styles, /\.binder-holes i:nth-child\(5\)/);
  assert.match(styles, /\.negative-frame[\s\S]*border:\s*0/);
});

test("turning sleeves keep a stable pre-composited plastic colour", () => {
  const sleeveRule = styles.match(/\.sleeve-page\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";
  const blankRule = styles.match(/\.opening-blank,\s*\n\.closing-blank\s*\{([\s\S]*?)\n\}/)?.[1] ?? "";

  assert.match(styles, /--sleeve-plastic:\s*#[0-9a-f]{6}/i);
  assert.match(styles, /--sleeve-plastic-turning:\s*#[0-9a-f]{6}/i);
  assert.match(sleeveRule, /var\(--sleeve-plastic\)/);
  assert.match(blankRule, /var\(--blank-plastic\)/);
  assert.doesNotMatch(sleeveRule, /rgba\(242\s*,\s*243\s*,\s*241\s*,\s*\.48\)/);
  assert.match(script, /classList\.add\("is-turning-leaf"\)/);
  assert.match(script, /requestAnimationFrame\(syncTurningLeafTone\)/);
});

test("first spread has a blank left leaf and no decorative ring overlay", () => {
  const frontEnd = index.indexOf('</article>', index.indexOf('aria-label="Front cover"'));
  const blankAt = index.indexOf('class="book-page opening-blank"');
  const firstSleeveAt = index.indexOf('class="book-page sleeve-page');
  assert.ok(frontEnd < blankAt && blankAt < firstSleeveAt);
  assert.doesNotMatch(index, /class="metal-rings"/);
  assert.doesNotMatch(styles, /\.metal-rings/);
});

test("outer stage and covers stay minimal", () => {
  assert.doesNotMatch(index, /class="light-table"/);
  assert.doesNotMatch(index, /class="cover-spine"/);
  assert.doesNotMatch(index, /class="cover-window"/);
  assert.doesNotMatch(styles, /\.light-table|\.cover-spine|\.cover-window/);
  assert.match(index, /class="cover-type"/);
});

test("negative images develop to positive on hover, focus, or tap", () => {
  assert.match(styles, /\.negative-frame img[\s\S]*filter:\s*invert\(1\)/);
  assert.doesNotMatch(index, /stock-bw/);
  assert.match(styles, /\.negative-frame\.is-positive img[\s\S]*filter:\s*none/);
  assert.match(script, /classList\.toggle\("is-positive"\)/);
  assert.match(script, /aria-pressed/);
  assert.match(script, /disableFlipByClick:\s*true/);
});

test("strip gestures are separate from page turns and photo clicks", () => {
  assert.ok(index.indexOf('src="strip-arrangement.js') < index.indexOf('src="flipbook.js'));
  assert.match(script, /new FilmStripArrangement/);
  assert.match(script, /isTurning \|\| isArranging/);
  assert.match(script, /stripArrangement\.suppressClick/);
  assert.match(arrangement, /\['mousedown', 'touchstart'/);
  assert.match(arrangement, /pointercancel/);
  assert.match(arrangement, /lostpointercapture/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(arrangement, /const handle = event\.target\.closest\?\.\('\.strip-handle'\)/);
  assert.match(arrangement, /if \(this\.ownsStripGesture\) event\.stopPropagation\(\)/);
  assert.doesNotMatch(arrangement, /this\.settling \|\| event\.target\.closest\?\.\('\.film-strip'\)/);
  assert.match(styles, /\.sleeve-page\.verso \.strip-handle/);
  assert.match(script, /clickEventForward:\s*false/);
  assert.match(script, /showPageCorners:\s*true/);
});

test("exchanges preserve intact films and use validated local-only persistence", () => {
  assert.match(arrangement, /target\.pocket\.append\(drag\.source\.strip\)/);
  assert.match(arrangement, /drag\.source\.pocket\.append\(target\.strip\)/);
  assert.match(arrangement, /new Set\(saved\.order\)\.size/);
  assert.match(arrangement, /localStorage\.setItem/);
  assert.doesNotMatch(arrangement, /fetch\(|XMLHttpRequest/);
  assert.match(arrangement, /prefers-reduced-motion:\s*reduce/);
  assert.match(arrangement, /ArrowUp/);
  assert.match(index, /id="undo-strip-swap"/);
});

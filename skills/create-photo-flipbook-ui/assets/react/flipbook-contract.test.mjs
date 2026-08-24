import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const component = await readFile(new URL("./PhotoFlipbook.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("./photo-flipbook.css", import.meta.url), "utf8");

test("every rendered leaf uses the two-face hard-page path", () => {
  assert.match(component, /data-density="hard"/);
  assert.match(component, /onChangeState=/);
  assert.match(component, /disabled=\{current === 0 \|\| isTurning\}/);
});

test("page-flip owns absolute page positioning", () => {
  assert.match(styles, /\.photo-leaf\.stf__item\s*\{[\s\S]*?position:\s*absolute/);
  assert.doesNotMatch(styles, /\.photo-leaf\s*\{[\s\S]*?position:\s*relative/);
});

test("visual transforms live on the rig instead of the engine root", () => {
  assert.match(component, /className="photo-book-rig"/);
  const engineRule = styles.match(/\.photo-book\s*\{([^}]*)\}/)?.[1] ?? "";
  assert.doesNotMatch(engineRule, /\btransform\s*:/);
});

test("the rig is constrained by viewport width and height", () => {
  assert.match(styles, /width:\s*min\([^;]*100svh/);
  assert.match(styles, /@media \(max-width: 720px\)/);
});

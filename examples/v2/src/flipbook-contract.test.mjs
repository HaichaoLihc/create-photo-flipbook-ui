import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const component = await readFile(new URL("./PhotoFlipbook.tsx", import.meta.url), "utf8");
const styles = await readFile(new URL("./photo-flipbook.css", import.meta.url), "utf8");
const pageData = await readFile(new URL("./book-pages.ts", import.meta.url), "utf8");
const library = await readFile(new URL("./main.tsx", import.meta.url), "utf8");
const textureLoader = await readFile(new URL("./book-textures.ts", import.meta.url), "utf8");

test("the reader uses segmented skinned pages with front and back materials", () => {
  assert.match(component, /new BoxGeometry\(/);
  assert.match(component, /new Skeleton\(bones\)/);
  assert.match(component, /new SkinnedMesh\(geometry, materials\)/);
  assert.match(component, /skinIndex/);
  assert.match(component, /skinWeight/);
});

test("source artwork is contained rather than cropped", () => {
  assert.match(textureLoader, /Math\.min\(width \/ sourceWidth, height \/ sourceHeight\)/);
  assert.match(textureLoader, /context\.drawImage/);
});

test("page turns support direct page clicks, controls, and keyboard navigation", () => {
  assert.match(component, /onSelect\(opened \? number : number \+ 1\)/);
  assert.match(component, /event\.key === "ArrowLeft"/);
  assert.match(component, /event\.key === "ArrowRight"/);
  assert.match(component, /aria-label="Next spread"/);
});

test("the canvas is responsive and touch-ready", () => {
  assert.match(styles, /\.r3f-book-canvas\s*\{[^}]*min-height:\s*0/);
  assert.match(styles, /touch-action:\s*none/);
  assert.match(styles, /@media \(max-width: 720px\)/);
});

test("the Death Valley volume includes all fourteen finished leaves", () => {
  const deathValley = pageData.match(/id: "death-valley",[\s\S]*?\n  },\n];/)?.[0] ?? "";
  assert.match(deathValley, /page-00-front-cover\.png/);
  assert.match(deathValley, /page-13-back-cover\.png/);
  const filenames = [...deathValley.matchAll(/"page-\d{2}[^\"]+\.png"/g)];
  assert.equal(filenames.length, 14);
});

test("the v2 catalog contains only the Death Valley volume", () => {
  assert.equal([...pageData.matchAll(/^    id: "/gm)].length, 1);
  assert.match(pageData, /id: "death-valley"/);
});

test("library and detail reader share one persistent WebGL scene", () => {
  assert.equal([...library.matchAll(/<Canvas\b/g)].length, 1);
  assert.match(library, /<FloatingCover/);
  assert.match(library, /<PhotoBook3D/);
  assert.match(library, /phase === "closing"/);
});

test("selected-book loading cannot suspend or blank the library scene", () => {
  assert.match(library, /<BookLoader/);
  assert.match(library, /warmBookTextures\(book, gl/);
  assert.match(textureLoader, /gl\.initTexture\(texture\)/);
  assert.match(textureLoader, /await nextFrame\(\)/);
});

test("only the selected book mounts an animated page stack", () => {
  assert.match(library, /const showPages = selected && textures !== null/);
  assert.match(library, /\{showPages && textures \? \(/);
  assert.match(component, /mesh\.castShadow = isCover/);
});

test("direct ImageBitmap page textures decode upright", () => {
  assert.match(textureLoader, /imageOrientation: "flipY"/);
  assert.match(textureLoader, /premultiplyAlpha: "none"/);
});

test("non-selected books disappear while a volume is active", () => {
  assert.match(library, /const visible = selected \|\| phase === "library"/);
  assert.match(library, /visible=\{visible\}/);
  assert.match(library, /if \(!visible \|\| !group\.current\) return/);
});

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { books as bookFixtures } from "./books.js";

const main = await readFile(new URL("./main.js", import.meta.url), "utf8");
const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
const styles = await readFile(new URL("./style.css", import.meta.url), "utf8");
const config = await readFile(new URL("../vite.config.js", import.meta.url), "utf8");
const editor = await readFile(new URL("./editor.js", import.meta.url), "utf8");

test("3D Book 2 uses the requested Quick FlipBook lifecycle", () => {
  assert.match(main, /import \{ FlipBook \} from "quick_flipbook"/);
  assert.match(main, /new FlipBook\(/);
  assert.match(main, /flipBook\.setPages\(/);
  assert.match(main, /flipBook\.animate\(delta\)/);
});

test("reader supports buttons, pointer gestures, and keyboard navigation", () => {
  assert.match(main, /flipBook\.nextPage\(\)/);
  assert.match(main, /flipBook\.previousPage\(\)/);
  assert.match(main, /pointerdown/);
  assert.match(main, /pointermove/);
  assert.match(main, /pointerleave/);
  assert.match(main, /pointercancel/);
  assert.doesNotMatch(html, /id="book-interaction"/);
  assert.doesNotMatch(main, /interactionSurface/);
  assert.match(main, /canvas\.addEventListener\("pointermove"/);
  assert.match(main, /start\.pendingFraction = fraction/);
  assert.match(main, /const preview = takeEdgePreviewForDrag\(\)/);
  assert.match(main, /startFraction: preview\?\.fraction \?\? 0/);
  assert.match(main, /start\.startFraction/);
  assert.match(main, /function applyDragFrame\(\)/);
  assert.match(main, /flipBook\.progress = start\.sheet \+ start\.direction \* start\.pendingFraction/);
  assert.match(main, /const dragOwnsFrame = applyDragFrame\(\)/);
  assert.match(main, /if \(!dragOwnsFrame\) flipBook\.animate\(delta\)/);
  assert.match(main, /shouldCompleteDrag\(start\.fraction, elapsed\)/);
  assert.match(main, /if \(!isActivePointer\(start, event\.pointerId\)\) return/);
  assert.match(main, /if \(!isActivePointer\(pointerStart, event\.pointerId\)\) return/);
  assert.match(main, /ArrowRight/);
  assert.match(main, /ArrowLeft/);
});

test("the page edge offers a restrained, motion-safe hover preview", () => {
  assert.match(main, /const EDGE_PREVIEW_AMOUNT = 0\.055/);
  assert.match(main, /const EDGE_PREVIEW_ZONE = 28/);
  assert.match(main, /prefers-reduced-motion: reduce/);
  assert.match(main, /edgePreviewDirection\(/);
  assert.match(main, /edgePreviewPose\(/);
  assert.match(main, /animateEdgePreview\(delta\)/);
  assert.match(main, /edgePreview\.target = EDGE_PREVIEW_AMOUNT/);
  assert.match(main, /sheet\.flip\(pose\.pageProgress, edgePreview\.direction, pose\.curveIntensity\)/);
  assert.match(styles, /#book-scene\s*\{[^}]*cursor:\s*grab;/s);
  assert.match(styles, /#book-scene:active\s*\{\s*cursor:\s*grabbing;/);
  assert.doesNotMatch(main, /classList\.(?:add|remove)\("is-dragging"\)/);
  assert.doesNotMatch(styles, /#book-scene\s*\{[^}]*pointer-events:\s*none/s);
});

test("reduced motion snaps automatic page turns", () => {
  assert.match(main, /const reducedMotion = window\.matchMedia/);
  assert.match(main, /flipDuration: reducedMotion \? 0\.001 : 0\.78/);
});

test("the loading live region is removed from the accessibility tree when idle", () => {
  assert.match(html, /id="loading-card"[^>]*hidden/);
  assert.match(html, /id="loading-card"[^>]*aria-hidden="true"/);
  assert.match(main, /loadingCard\.hidden = !value/);
  assert.match(main, /loadingCard\.setAttribute\("aria-hidden", String\(!value\)\)/);
  assert.match(main, /loadingCopy\.textContent = value \? copy : ""/);
});

test("3D Book 2 exposes only the Death Valley edition", () => {
  assert.deepEqual(bookFixtures.map(({ id }) => id), ["death-valley"]);
  assert.equal(bookFixtures[0].scenes.length, 8);
  assert.match(config, /publicDir: "public"/);
  assert.match(main, /return `\$\{import\.meta\.env\.BASE_URL\}/);
  assert.match(main, /textureLoader\.loadAsync\(assetUrl\(source\)\)/);
});

test("3D Book 2 uses restrained editor chrome and a neutral stage", () => {
  assert.doesNotMatch(html, /QUICK FLIPBOOK STUDY|FOUR EDITIONS|CLICK EITHER SIDE|PREV|NEXT/);
  assert.match(html, /id="timeline-track"/);
  assert.match(html, /id="copy-title"/);
  assert.match(styles, /--timeline:\s*#151815/);
  assert.match(main, /scene\.background = new THREE\.Color\("#e9e7e1"\)/);
});

test("the editor supports persistent custom timing, copy, positioning, and scene order", () => {
  assert.match(editor, /window\.localStorage\.setItem/);
  assert.match(editor, /clampSceneDuration/);
  assert.match(editor, /data-copy-position/);
  assert.match(editor, /moveScene\(scenes, fromIndex, toIndex\)/);
  assert.match(editor, /requestAnimationFrame\(playbackTick\)/);
  assert.match(editor, /onSceneOrderChange\(scenes, activeIndex\)/);
});

test("3D Book 2 uses a straight-on fitted camera and shadow-responsive paper materials", () => {
  assert.match(main, /new THREE\.OrthographicCamera/);
  assert.match(main, /camera\.up\.set\(0, 0, -1\)/);
  assert.match(main, /bookRig\.rotation\.set\(0, 0, 0\)/);
  assert.match(main, /new THREE\.MeshStandardMaterial/);
  assert.match(main, /material\.shadowSide = THREE\.DoubleSide/);
  assert.doesNotMatch(main, /aoMap/);
  assert.match(main, /const spreadWidth = selectedBook\.ratio \* 2/);
  assert.match(main, /camera\.right = halfHeight \* aspect/);
});

test("3D Book 2 renders soft dynamic shadows and refreshes every deformed sheet's normals", () => {
  assert.match(main, /renderer\.shadowMap\.enabled = true/);
  assert.match(main, /renderer\.shadowMap\.type = THREE\.PCFShadowMap/);
  assert.match(main, /keyLight\.castShadow = true/);
  assert.match(main, /keyLight\.shadow\.normalBias = 0\.012/);
  assert.match(main, /keyLight\.shadow\.radius = 3/);
  assert.match(main, /object\.castShadow = true/);
  assert.match(main, /object\.receiveShadow = true/);
  assert.match(main, /dirtySheets\.add\(sheet\)/);
  assert.match(main, /for \(const sheet of dirtySheets\)/);
  assert.match(main, /refreshDirtyPageNormals\(\)/);
  assert.match(main, /sheet\.page\.geometry\.computeVertexNormals\(\)/);
});

test("3D Book 2 bounds geometry, pixel, shadow, and texture work", () => {
  assert.match(main, /const PAGE_SUBDIVISIONS = 16/);
  assert.match(main, /const MAX_PIXEL_RATIO = 1\.5/);
  assert.match(main, /const SHADOW_MAP_SIZE = 1024/);
  assert.match(main, /const MAX_TEXTURE_EDGE = 1024/);
  assert.match(main, /const MAX_TEXTURE_ANISOTROPY = 4/);
  assert.match(main, /Math\.min\(window\.devicePixelRatio, MAX_PIXEL_RATIO\)/);
  assert.match(main, /resizeTextureImage\(texture\)/);
});

test("3D Book 2 memoizes settled sheets and bounds the material cache", () => {
  assert.match(main, /function memoizeSheetDeformation\(\)/);
  assert.match(main, /pageProgress === previousPageProgress/);
  assert.match(main, /const CACHED_BOOK_LIMIT = 2/);
  assert.match(main, /material\.map\?\.dispose\(\)/);
  assert.match(main, /material\.dispose\(\)/);
});

test("3D Book 2 renders on demand and parks a settled edge preview", () => {
  assert.match(main, /function requestRender\(\)/);
  assert.match(main, /let animationFrame = null/);
  assert.match(main, /const previewNeedsFrame = animateEdgePreview\(delta\)/);
  assert.match(main, /if \(previewNeedsFrame \|\| \(!dragOwnsFrame && progressChanged\)\) continueRendering\(\)/);
  assert.match(main, /stop feeding the modifier stack identical poses/);
});

test("3D Book 2 settles page materials and avoids per-frame DOM writes", () => {
  assert.match(main, /for \(let index = 0; index < pageMaterials\.length; index \+= 1\) await Promise\.resolve\(\)/);
  assert.match(main, /if \(statusKey === lastStatusKey\) return/);
});

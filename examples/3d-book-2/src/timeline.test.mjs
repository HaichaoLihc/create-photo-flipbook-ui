import assert from "node:assert/strict";
import test from "node:test";
import {
  clampSceneDuration,
  elapsedBeforeScene,
  flattenScenePages,
  formatTime,
  moveScene,
  restoreTimeline,
  sceneIndexFromCurrentPage,
  timelineDuration,
} from "./timeline.js";

const scenes = [
  { id: "cover", name: "Cover", duration: 3, pages: ["cover"], copy: { title: "Cover" } },
  { id: "one", name: "One", duration: 4.5, pages: ["one-left", "one-right"], copy: { title: "One" } },
  { id: "two", name: "Two", duration: 5, pages: ["two-left", "two-right"], copy: { title: "Two" } },
  { id: "back", name: "Back", duration: 2, pages: ["back"], copy: { title: "Back" } },
];

test("timeline helpers calculate time and page order", () => {
  assert.equal(timelineDuration(scenes), 14.5);
  assert.equal(elapsedBeforeScene(scenes, 2), 7.5);
  assert.equal(formatTime(65.9), "01:05");
  assert.deepEqual(flattenScenePages(scenes), [
    "cover", "one-left", "one-right", "two-left", "two-right", "back",
  ]);
});

test("duration is half-second stepped and bounded", () => {
  assert.equal(clampSceneDuration(0), 1.5);
  assert.equal(clampSceneDuration(4.26), 4.5);
  assert.equal(clampSceneDuration(99), 12);
  assert.equal(clampSceneDuration("bad"), 4);
});

test("only interior scenes can be reordered", () => {
  assert.deepEqual(moveScene(scenes, 1, 2).map(({ id }) => id), ["cover", "two", "one", "back"]);
  assert.deepEqual(moveScene(scenes, 0, 2).map(({ id }) => id), scenes.map(({ id }) => id));
  assert.deepEqual(moveScene(scenes, 1, 3).map(({ id }) => id), ["cover", "two", "one", "back"]);
});

test("page state maps to a stable scene index", () => {
  assert.equal(sceneIndexFromCurrentPage(0, 4), 0);
  assert.equal(sceneIndexFromCurrentPage(2, 4), 1);
  assert.equal(sceneIndexFromCurrentPage(5.7, 4), 3);
  assert.equal(sceneIndexFromCurrentPage(100, 4), 3);
});

test("saved edits are restored without trusting removed pages or endpoints", () => {
  const restored = restoreTimeline(scenes, [
    { id: "cover", name: "My cover", duration: 99, copy: { title: "New title", position: "top-right" } },
    { id: "two", name: "Second first", duration: 6, copy: { body: "A note" } },
    { id: "one", pages: ["untrusted-page"] },
    { id: "back" },
  ]);
  assert.deepEqual(restored.map(({ id }) => id), ["cover", "two", "one", "back"]);
  assert.equal(restored[0].name, "My cover");
  assert.equal(restored[0].duration, 12);
  assert.equal(restored[0].copy.position, "top-right");
  assert.deepEqual(restored[2].pages, scenes[1].pages);
});

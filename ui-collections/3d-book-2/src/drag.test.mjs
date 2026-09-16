import assert from "node:assert/strict";
import test from "node:test";
import {
  chooseDragDirection,
  dragFraction,
  edgePreviewDirection,
  edgePreviewPose,
  isActivePointer,
  isPointerOverBook,
  shouldCompleteDrag,
} from "./drag.js";

test("drag direction follows the visible page and respects the covers", () => {
  assert.equal(chooseDragDirection(0, 4, 200, 500), 1);
  assert.equal(chooseDragDirection(4, 4, 800, 500), -1);
  assert.equal(chooseDragDirection(2, 4, 300, 500), -1);
  assert.equal(chooseDragDirection(2, 4, 700, 500), 1);
});

test("drag distance maps to a clamped page-turn fraction", () => {
  assert.equal(dragFraction(-50, 1, 200), 0.25);
  assert.equal(dragFraction(50, -1, 200), 0.25);
  assert.equal(dragFraction(400, -1, 200), 1);
  assert.equal(dragFraction(50, 1, 200), 0);
});

test("drag distance can continue from an edge-preview fraction", () => {
  assert.ok(Math.abs(dragFraction(-20, 1, 200, 0.05) - 0.15) < 1e-9);
  assert.ok(Math.abs(dragFraction(20, -1, 200, 0.05) - 0.15) < 1e-9);
  assert.equal(dragFraction(10, 1, 200, 0.05), 0);
});

test("release commits deliberate drags and short flicks", () => {
  assert.equal(shouldCompleteDrag(0.32, 500), true);
  assert.equal(shouldCompleteDrag(0.12, 250), true);
  assert.equal(shouldCompleteDrag(0.11, 250), false);
  assert.equal(shouldCompleteDrag(0.2, 500), false);
});

test("only the pointer that started a drag can finish it", () => {
  const pointerStart = { pointerId: 7 };
  assert.equal(isActivePointer(pointerStart, 7), true);
  assert.equal(isActivePointer(pointerStart, 8), false);
  assert.equal(isActivePointer(null, 7), false);
});

test("edge preview targets only the available outer page edges", () => {
  const metrics = {
    maxSheet: 4,
    centerX: 500,
    centerY: 400,
    pageWidth: 300,
    pageHeight: 400,
    edgeZone: 24,
  };

  assert.equal(edgePreviewDirection({ ...metrics, sheet: 0, pointerX: 650, pointerY: 400 }), 1);
  assert.equal(edgePreviewDirection({ ...metrics, sheet: 4, pointerX: 350, pointerY: 400 }), -1);
  assert.equal(edgePreviewDirection({ ...metrics, sheet: 2, pointerX: 200, pointerY: 400 }), -1);
  assert.equal(edgePreviewDirection({ ...metrics, sheet: 2, pointerX: 800, pointerY: 400 }), 1);
  assert.equal(edgePreviewDirection({ ...metrics, sheet: 2, pointerX: 500, pointerY: 400 }), 0);
  assert.equal(edgePreviewDirection({ ...metrics, sheet: 2, pointerX: 800, pointerY: 610 }), 0);
});

test("edge preview preserves one bend direction while lifting and returning", () => {
  assert.deepEqual(edgePreviewPose(0, 1, 0.05, 4), {
    progress: 0.05,
    sheetIndex: 0,
    pageProgress: 0.05,
    curveIntensity: 0.05,
  });

  assert.deepEqual(edgePreviewPose(2, -1, 0.05, 4), {
    progress: 1.95,
    sheetIndex: 1,
    pageProgress: 0.95,
    curveIntensity: 1,
  });

  const backCoverPose = edgePreviewPose(4, -1, 0.05, 4);
  assert.equal(backCoverPose.sheetIndex, 3);
  assert.equal(backCoverPose.pageProgress, 0.95);
  assert.ok(Math.abs(backCoverPose.curveIntensity - 0.05) < 1e-9);
  assert.equal(edgePreviewPose(4, 1, 0.05, 4), null);
});

test("the hit area matches a single cover and an open spread", () => {
  const metrics = {
    maxSheet: 4,
    centerX: 500,
    centerY: 400,
    pageWidth: 300,
    pageHeight: 400,
  };

  assert.equal(isPointerOverBook({ ...metrics, sheet: 0, pointerX: 640, pointerY: 400 }), true);
  assert.equal(isPointerOverBook({ ...metrics, sheet: 0, pointerX: 700, pointerY: 400 }), false);
  assert.equal(isPointerOverBook({ ...metrics, sheet: 2, pointerX: 790, pointerY: 400 }), true);
  assert.equal(isPointerOverBook({ ...metrics, sheet: 2, pointerX: 500, pointerY: 610 }), false);
});

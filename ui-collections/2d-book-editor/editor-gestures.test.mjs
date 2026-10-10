import assert from "node:assert/strict";
import test from "node:test";
import { changeGeometry, changeImageGeometry } from "./editor-gestures.js";

const bounds = { width: 471, height: 640 };
const block = { x: 50, y: 80, width: 200, height: 100 };

test("图片四角缩放保持比例、固定对角并限制页面边界", () => {
  for (const corner of ["nw", "ne", "sw", "se"]) {
    const box = changeImageGeometry(block, 900, 900, corner, bounds);
    assert.equal(box.width / box.height, block.width / block.height);
    assert.ok(box.x >= 0 && box.y >= 0 && box.x + box.width <= bounds.width && box.y + box.height <= bounds.height);
    assert.equal(corner.includes("w") ? box.x + box.width : box.x, corner.includes("w") ? block.x + block.width : block.x);
    assert.equal(corner.includes("n") ? box.y + box.height : box.y, corner.includes("n") ? block.y + block.height : block.y);
  }
});
test("dragging remains within the page", () => {
  assert.deepEqual(changeGeometry(block, -100, 900, null, bounds), { ...block, x: 0, y: 540 });
});
test("corner resizing preserves the opposite corner and minimum size", () => {
  assert.deepEqual(changeGeometry(block, 300, 300, "nw", bounds), { x: 242, y: 172, width: 8, height: 8 });
  assert.deepEqual(changeGeometry(block, 900, 900, "se", bounds), { x: 50, y: 80, width: 421, height: 560 });
});

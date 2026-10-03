import assert from "node:assert/strict";
import test from "node:test";
import { moveLayer, orderLayerBlocks } from "./editor-layers.js";

test("相同层级按原始顺序排列，单层移动只交换相邻区块", () => {
  const blocks = Array.from({ length: 3 }, () => ({ style: { zIndex: "" } }));
  assert.deepEqual(orderLayerBlocks(blocks), blocks);
  assert.deepEqual(moveLayer(blocks, blocks[0], "forward"), [blocks[1], blocks[0], blocks[2]]);
  assert.deepEqual(blocks.map((block) => block.style.zIndex), ["2", "1", "3"]);
});

test("置顶置底保持其他区块顺序，并限制边界", () => {
  const blocks = Array.from({ length: 3 }, (_, index) => ({ style: { zIndex: String(index + 1) } }));
  assert.deepEqual(moveLayer(blocks, blocks[1], "front"), [blocks[0], blocks[2], blocks[1]]);
  assert.deepEqual(moveLayer(blocks, blocks[1], "forward"), [blocks[0], blocks[2], blocks[1]]);
  assert.deepEqual(moveLayer(blocks, blocks[1], "back"), [blocks[1], blocks[0], blocks[2]]);
});

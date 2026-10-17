import { BLOCK_SELECTOR } from "./book-document.js";

const MIN_SIZE = 8;
const CORNERS = ["nw", "ne", "sw", "se"];

export function changeGeometry(start, dx, dy, corner, bounds) {
  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  if (!corner) return { ...start, x: clamp(start.x + dx, 0, Math.max(0, bounds.width - start.width)), y: clamp(start.y + dy, 0, Math.max(0, bounds.height - start.height)) };
  const right = start.x + start.width;
  const bottom = start.y + start.height;
  const x = corner.includes("w") ? clamp(start.x + dx, 0, right - MIN_SIZE) : start.x;
  const y = corner.includes("n") ? clamp(start.y + dy, 0, bottom - MIN_SIZE) : start.y;
  const nextRight = corner.includes("e") ? clamp(right + dx, x + MIN_SIZE, bounds.width) : right;
  const nextBottom = corner.includes("s") ? clamp(bottom + dy, y + MIN_SIZE, bounds.height) : bottom;
  return { x, y, width: nextRight - x, height: nextBottom - y };
}

export function changeImageGeometry(start, dx, dy, corner, bounds) {
  if (!corner) return changeGeometry(start, dx, dy, corner, bounds);
  const west = corner.includes("w");
  const north = corner.includes("n");
  const anchorX = west ? start.x + start.width : start.x;
  const anchorY = north ? start.y + start.height : start.y;
  const horizontal = (west ? -dx : dx) / start.width;
  const vertical = (north ? -dy : dy) / start.height;
  const requested = 1 + (Math.abs(horizontal) >= Math.abs(vertical) ? horizontal : vertical);
  const maximum = Math.min((west ? anchorX : bounds.width - anchorX) / start.width, (north ? anchorY : bounds.height - anchorY) / start.height);
  const minimum = Math.max(MIN_SIZE / start.width, MIN_SIZE / start.height);
  const scale = Math.min(maximum, Math.max(minimum, requested));
  const width = start.width * scale;
  const height = start.height * scale;
  return { x: west ? anchorX - width : anchorX, y: north ? anchorY - height : anchorY, width, height };
}

export function initializeBlockGestures(canvas, settings) {
  const selection = document.createElement("div");
  selection.className = "editor-selection";
  selection.hidden = true;
  canvas.append(selection);
  for (const corner of CORNERS) {
    const handle = document.createElement("span");
    handle.className = `resize-handle handle-${corner}`;
    handle.dataset.corner = corner;
    selection.append(handle);
  }
  let gesture;
  function geometry(block) {
    return { x: parseFloat(block.style.left), y: parseFloat(block.style.top), width: parseFloat(block.style.width), height: parseFloat(block.style.height) };
  }
  function refresh() {
    const block = settings.getSelected();
    if (!selection.isConnected) canvas.append(selection);
    selection.hidden = !block;
    if (!block) return;
    const box = geometry(block);
    Object.assign(selection.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
  }
  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    const corner = event.target.dataset.corner;
    const block = corner ? settings.getSelected() : event.target.closest(BLOCK_SELECTOR);
    if (!block) return;
    if (!corner && block.isContentEditable) return;
    if (!corner) settings.select(block);
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    gesture = { block, corner, x: event.clientX, y: event.clientY, start: geometry(block) };
    refresh();
  });
  canvas.addEventListener("pointermove", (event) => {
    if (!gesture) return;
    const scale = canvas.getBoundingClientRect().width / settings.width;
    const resize = gesture.block.tagName === "IMG" ? changeImageGeometry : changeGeometry;
    const box = resize(gesture.start, (event.clientX - gesture.x) / scale, (event.clientY - gesture.y) / scale, gesture.corner, settings);
    Object.assign(gesture.block.style, { left: `${box.x}px`, top: `${box.y}px`, width: `${box.width}px`, height: `${box.height}px` });
    settings.update();
    refresh();
  });
  const finish = () => { gesture = undefined; };
  canvas.addEventListener("pointerup", finish);
  canvas.addEventListener("pointercancel", finish);
  return { refresh };
}

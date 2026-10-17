import { layersCatalog as t } from "./catalogs/layers.js";

const ACTIONS = ["back", "backward", "forward", "front"];
const ICON_PATHS = {
  back: "M5 19h14M12 4v11m-4-4 4 4 4-4",
  backward: "M12 4v15m-5-5 5 5 5-5",
  forward: "M12 20V5m-5 5 5-5 5 5",
  front: "M5 5h14M12 20V9m-4 4 4-4 4 4",
};

export function orderLayerBlocks(blocks) {
  return [...blocks].sort((left, right) => (Number(left.style.zIndex) || 0) - (Number(right.style.zIndex) || 0));
}

export function moveLayer(blocks, selected, action) {
  const ordered = orderLayerBlocks(blocks);
  const index = ordered.indexOf(selected);
  if (index < 0 || !ACTIONS.includes(action)) return ordered;
  const last = ordered.length - 1;
  const target = { back: 0, backward: Math.max(0, index - 1), forward: Math.min(last, index + 1), front: last }[action];
  ordered.splice(index, 1);
  ordered.splice(target, 0, selected);
  ordered.forEach((block, layer) => { block.style.zIndex = String(layer + 1); });
  return ordered;
}

export function initializeLayerControls(parent, { getBlocks, getSelected, applyOrder }) {
  const section = document.createElement("section");
  section.className = "editor-layers";
  section.setAttribute("aria-label", t.title);
  const heading = document.createElement("h3");
  heading.textContent = t.title;
  const controls = document.createElement("div");
  controls.className = "layer-actions";
  const buttons = new Map();
  for (const action of ACTIONS) {
    const button = document.createElement("button");
    button.type = "button";
    button.title = t[action];
    button.setAttribute("aria-label", t[action]);
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("viewBox", "0 0 24 24");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", ICON_PATHS[action]);
    svg.append(path);
    button.append(svg);
    button.addEventListener("click", () => {
      const selected = getSelected();
      if (!selected) return;
      applyOrder(moveLayer(getBlocks(), selected, action));
      sync();
    });
    buttons.set(action, button);
    controls.append(button);
  }
  section.append(heading, controls);
  parent.append(section);
  function sync() {
    const blocks = orderLayerBlocks(getBlocks());
    const index = blocks.indexOf(getSelected());
    heading.textContent = t.current.replace("{current}", String(index + 1)).replace("{total}", String(blocks.length));
    for (const action of ACTIONS) {
      buttons.get(action).disabled = index < 0 || (action === "back" || action === "backward" ? index === 0 : index === blocks.length - 1);
    }
  }
  return { sync };
}

import { BLOCK_SELECTOR, getBookPages, updateBookPage, resetBookPage, saveBookDocument } from "./book-document.js";
import { editorCatalog as t } from "./catalogs/editor.js";

import { themeSelect } from "./editor-controls.js";
import { initializeBlockGestures, changeGeometry } from "./editor-gestures.js";
import { initializeRichText } from "./editor-rich-text.js";
import { initializePageBackground } from "./editor-background.js";
import { initializeLayerControls } from "./editor-layers.js";
import { FONT_OPTIONS, identifyFont } from "./editor-fonts.js";
import { setActionIcon } from "./editor-icons.js";
import { fitImageBlock } from "./editor-images.js";

const THEME_COLORS = ["#243f39", "#29271f", "#f0e9d8", "#71908b", "#d7b16b", "#6f493f"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MIN_BLOCK_SIZE = 8;
const NUDGE_STEP = 1;
const LARGE_NUDGE_STEP = 10;
const NEW_BLOCK_WIDTH_RATIO = 0.6;
const NEW_BLOCK_HEIGHT_RATIO = 0.3;
const NEW_TEXT_FONT_SIZE = 32;
const NUMBER_FIELDS = ["x", "y", "width", "height", "fontSize"];

export function initializeEditor() {
  const book = document.querySelector("#book");
  const button = document.querySelector("#edit-book");
  const exportButton = document.querySelector("#export-pdf");
  const width = Number(book.dataset.pageWidth);
  const height = Number(book.dataset.pageHeight);
  const overlay = document.createElement("section");
  overlay.className = "book-editor";
  overlay.hidden = true;
  overlay.setAttribute("aria-label", t.edit);
  const viewport = document.createElement("div");
  viewport.className = "editor-viewport";
  const canvas = document.createElement("div");
  canvas.className = "editor-canvas";
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  viewport.append(canvas);
  const navigation = document.createElement("nav");
  navigation.className = "editor-navigation";
  const prevPage = document.createElement("button");
  prevPage.type = "button";
  prevPage.textContent = "←";
  prevPage.setAttribute("aria-label", t.previous);
  const nextPage = document.createElement("button");
  nextPage.type = "button";
  nextPage.textContent = "→";
  nextPage.setAttribute("aria-label", t.next);
  const navigationStatus = document.createElement("span");
  navigationStatus.setAttribute("aria-live", "polite");
  navigation.append(prevPage, navigationStatus, nextPage);
  viewport.append(navigation);
  const panel = document.createElement("aside");
  panel.className = "editor-panel";
  overlay.append(viewport, panel);
  document.querySelector(".room").append(overlay);
  let currentIndex = 0;
  let currentPage;
  let selected;
  let active = false;
  let dirty = false;
  const fields = {};
  const gestures = initializeBlockGestures(canvas, {
    width, height,
    getSelected: () => selected,
    select: (block) => selectBlock(block),
    update: () => { selectBlock(selected); commit(); },
  });
  const richText = initializeRichText(canvas, { select: selectBlock, getSelected: () => selected, commit, refresh: () => gestures.refresh(), label: t.inlineText });
  const heading = document.createElement("h2");
  heading.textContent = t.panel;
  panel.append(heading);
  const pageSelect = addField("page", document.createElement("select"));
  getBookPages().forEach((page, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = t.pageOption.replace("{page}", String(index + 1));
    pageSelect.append(option);
  });
  const hint = document.createElement("p");
  hint.className = "editor-hint";
  hint.textContent = t.empty;
  panel.append(hint);
  const insertTools = document.createElement("div");
  insertTools.className = "editor-insert";
  const addTextButton = document.createElement("button");
  addTextButton.type = "button";
  addTextButton.textContent = t.addText;
  addTextButton.addEventListener("click", () => {
    const block = document.createElement("p");
    block.textContent = t.newText;
    block.dataset.editorTextModified = "true";
    Object.assign(block.style, { fontSize: `${NEW_TEXT_FONT_SIZE}px`, fontFamily: FONT_OPTIONS.chinese, color: getComputedStyle(currentPage).color, whiteSpace: "pre-wrap" });
    insertBlock(block);
    richText.begin(block);
  });
  const addImageButton = document.createElement("button");
  addImageButton.type = "button";
  addImageButton.textContent = t.addImage;
  const addImageFile = document.createElement("input");
  addImageFile.type = "file";
  addImageFile.accept = "image/png,image/jpeg,image/webp,image/gif";
  addImageFile.hidden = true;
  addImageFile.setAttribute("aria-label", t.addImage);
  addImageButton.addEventListener("click", () => addImageFile.click());
  addImageFile.addEventListener("change", async () => {
    const imageFile = addImageFile.files[0];
    if (!imageFile) return;
    const targetPage = currentPage;
    try {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(imageFile.type)) { message.textContent = t.imageError; return; }
      if (imageFile.size > MAX_IMAGE_BYTES) { message.textContent = t.imageTooLarge; return; }
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(imageFile);
      });
      const image = document.createElement("img");
      image.src = src;
      image.alt = imageFile.name;
      image.style.objectFit = "contain";
      await image.decode();
      if (active && currentPage === targetPage) insertBlock(image);
    } catch (error) {
      console.error("Unable to insert image", error);
      message.textContent = t.imageError;
    } finally { addImageFile.value = ""; }
  });
  insertTools.append(addImageButton, addTextButton, addImageFile);
  panel.append(insertTools);
  const background = initializePageBackground(panel, {
    getPage: () => active ? currentPage : undefined, commit,
    reportError: (text) => { message.textContent = text; },
  });
  const properties = document.createElement("fieldset");
  properties.className = "editor-properties";
  properties.disabled = true;
  properties.hidden = true;
  panel.append(properties);
  for (const name of NUMBER_FIELDS) {
    const input = document.createElement("input");
    input.type = "number";
    input.step = "1";
    input.min = name === "x" || name === "y" ? "0" : String(MIN_BLOCK_SIZE);
    input.max = String(name === "height" || name === "y" ? height : width);
    if (name === "fontSize") input.type = "range";
    fields[name] = name === "fontSize" ? addField(name, input, properties) : input;
    if (name === "fontSize") {
      const output = document.createElement("output");
      input.parentElement.append(output);
      input.addEventListener("input", () => { output.textContent = input.value; });
    }
    input.addEventListener("input", applyProperties);
  }
  const alignment = document.createElement("div");
  alignment.className = "editor-alignment";
  for (const [key, field, dimension] of [["centerX", "x", "width"], ["centerY", "y", "height"]]) {
    const control = document.createElement("button");
    control.type = "button";
    control.textContent = t[key];
    control.addEventListener("click", () => {
      if (!selected) return;
      fields[field].value = String(Math.round(((dimension === "width" ? width : height) - Number(fields[dimension].value)) / 2));
      applyProperties();
    });
    alignment.append(control);
  }
  properties.append(alignment);
  const layers = initializeLayerControls(properties, {
    getBlocks: () => [...currentPage.querySelectorAll(BLOCK_SELECTOR)], getSelected: () => selected,
    applyOrder: (blocks) => { currentPage.append(...blocks); commit(); gestures.refresh(); },
  });
  fields.fontFamily = addSelect("fontFamily", Object.keys(FONT_OPTIONS), properties);
  for (const option of fields.fontFamily.options) option.style.fontFamily = FONT_OPTIONS[option.value];
  fields.fontWeight = addSelect("fontWeight", ["regular", "bold"], properties);
  fields.color = addField("color", document.createElement("input"), properties);
  fields.color.type = "color";
  const palette = document.createElement("div");
  palette.className = "editor-palette";
  palette.setAttribute("aria-label", t.palette);
  fields.color.closest("label").prepend(palette);
  for (const color of THEME_COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.setProperty("--swatch-color", color);
    swatch.setAttribute("aria-label", t.colorOption.replace("{color}", color));
    swatch.addEventListener("click", () => {
      fields.color.value = color;
      applyTextStyle();
      updatePalette();
    });
    palette.append(swatch);
  }
  fields.color.setAttribute("aria-label", t.customColor);
  function updatePalette() {
    for (const swatch of palette.children) swatch.setAttribute("aria-pressed", String(swatch.style.getPropertyValue("--swatch-color") === fields.color.value));
  }
  for (const name of ["fontFamily", "fontWeight", "color"]) fields[name].addEventListener("input", applyTextStyle);
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp,image/gif";
  fields.replace = addField("replace", file, properties);
  file.hidden = true;
  const uploadButton = document.createElement("button");
  uploadButton.type = "button";
  uploadButton.className = "editor-upload";
  const uploadIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  uploadIcon.setAttribute("viewBox", "0 0 24 24");
  uploadIcon.setAttribute("aria-hidden", "true");
  const uploadPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
  uploadPath.setAttribute("d", "M12 16V4m-4 4 4-4 4 4M4 15v5h16v-5");
  uploadIcon.append(uploadPath);
  const uploadText = document.createElement("span");
  const uploadTitle = document.createElement("strong");
  uploadTitle.textContent = t.chooseImage;
  uploadText.append(uploadTitle);
  uploadButton.append(uploadIcon, uploadText);
  uploadButton.addEventListener("click", () => file.click());
  file.closest("label").append(uploadButton);
  file.addEventListener("change", replaceImage);
  const actions = document.createElement("div");
  actions.className = "editor-actions";
  actions.hidden = true;
  panel.append(actions);
  const save = document.createElement("button");
  save.type = "button";
  save.textContent = t.save;
  save.addEventListener("click", saveDocument);
  save.className = "editor-save";
  actions.append(save);
  const reset = document.createElement("button");
  reset.type = "button";
  setActionIcon(reset, t.reset, "M4 10a8 8 0 1 1 2 8M4 4v6h6");
  reset.addEventListener("click", () => {
    resetBookPage(currentIndex);
    currentPage = undefined;
    showPage(currentIndex);
    dirty = true; actions.hidden = false;
  });
  const iconActions = document.createElement("div");
  iconActions.className = "editor-icon-actions";
  actions.append(iconActions);
  reset.className = "editor-action-icon";
  iconActions.append(reset);
  const removeAdded = document.createElement("button");
  removeAdded.type = "button";
  removeAdded.className = "editor-action-icon editor-delete-icon";
  setActionIcon(removeAdded, t.removeAdded, "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 10v7M14 10v7");
  removeAdded.hidden = true;
  removeAdded.addEventListener("click", () => {
    if (!selected || selected.dataset.editorAdded !== "true") return;
    selected.remove();
    selected = undefined;
    properties.disabled = true;
    properties.hidden = true;
    removeAdded.hidden = true;
    hint.textContent = t.empty;
    gestures.refresh();
    commit();
  });
  iconActions.append(removeAdded);
  const message = document.createElement("p");
  message.setAttribute("role", "status");
  message.className = "editor-message";
  actions.append(message);

  function insertBlock(block) {
    const ids = [...currentPage.querySelectorAll("[data-editor-id]")].map((item) => Number(item.dataset.editorId));
    block.dataset.editorId = String(Math.max(-1, ...ids) + 1);
    block.dataset.editorAdded = "true";
    const topLayer = Math.max(0, ...[...currentPage.querySelectorAll(BLOCK_SELECTOR)].map((item) => Number(item.style.zIndex) || 0));
    if (topLayer > 0) block.style.zIndex = String(topLayer + 1);
    const blockWidth = width * NEW_BLOCK_WIDTH_RATIO;
    const blockHeight = height * NEW_BLOCK_HEIGHT_RATIO;
    Object.assign(block.style, {
      position: "absolute", inset: "auto", left: `${(width - blockWidth) / 2}px`, top: `${(height - blockHeight) / 2}px`,
      width: `${blockWidth}px`, height: `${blockHeight}px`, margin: "0",
    });
    currentPage.append(block);
    selectBlock(block);
    commit();
  }

  function addField(name, input, parent = panel) {
    const label = document.createElement("label");
    const caption = document.createElement("span");
    caption.textContent = t[name];
    label.append(caption, input);
    parent.append(label);
    return input;
  }

  function addSelect(name, values, parent) {
    const select = document.createElement("select");
    for (const value of values) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = t[value];
      select.append(option);
    }
    return addField(name, select, parent);
  }

  themeSelect(pageSelect);
  canvas.addEventListener("pointerdown", (event) => {
    if (event.target.closest(BLOCK_SELECTOR) || event.target.closest(".editor-selection")) return;
    richText.finish(); selected?.classList.remove("editor-selected"); selected = undefined;
    properties.hidden = true; properties.disabled = true; removeAdded.hidden = true; reset.hidden = true;
    hint.textContent = t.empty; actions.hidden = !dirty; gestures.refresh();
  });
  for (const name of ["fontFamily", "fontWeight"]) themeSelect(fields[name]);
  prevPage.addEventListener("click", () => showPage(Math.max(0, currentIndex - 1)));
  nextPage.addEventListener("click", () => showPage(Math.min(getBookPages().length - 1, currentIndex + 1)));
  canvas.tabIndex = 0;
  document.addEventListener("keydown", (event) => {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (!active || event.target.closest("input, textarea, select, [contenteditable='true'], [role='combobox'], [role='option']")) return;
    const direction = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (direction && selected && (event.target === canvas || canvas.contains(event.target))) {
      event.preventDefault();
      const step = event.shiftKey ? LARGE_NUDGE_STEP : NUDGE_STEP;
      const start = { x: parseFloat(selected.style.left), y: parseFloat(selected.style.top), width: parseFloat(selected.style.width), height: parseFloat(selected.style.height) };
      const box = changeGeometry(start, direction[0] * step, direction[1] * step, null, { width, height });
      selected.style.left = `${box.x}px`;
      selected.style.top = `${box.y}px`;
      selectBlock(selected);
      commit();
    }
    if (event.key === "PageDown" || event.key === "PageUp") {
      event.preventDefault();
      showPage(Math.max(0, Math.min(getBookPages().length - 1, currentIndex + (event.key === "PageDown" ? 1 : -1))));
    }
  });

  function commit(markDirty = true) {
    const copy = currentPage.cloneNode(true);
    copy.querySelectorAll(".editor-selected").forEach((block) => block.classList.remove("editor-selected"));
    copy.querySelectorAll("[contenteditable]").forEach((block) => {
      block.removeAttribute("contenteditable"); block.removeAttribute("spellcheck"); block.removeAttribute("aria-label"); block.classList.remove("inline-text-editing");
    });
    updateBookPage(currentIndex, copy);
    if (markDirty) dirty = true;
    actions.hidden = !selected && !dirty;
    reset.hidden = !selected;
  }

  function showPage(index) {
    richText.finish();
    if (currentPage) commit(false);
    currentIndex = index;
    currentPage = getBookPages()[index];
    currentPage.style.width = `${width}px`;
    currentPage.style.height = `${height}px`;
    canvas.replaceChildren(currentPage);
    background.sync();
    const pageRect = currentPage.getBoundingClientRect();
    const scale = pageRect.width / width;
    const positions = [...currentPage.querySelectorAll(BLOCK_SELECTOR)].map((block) => {
      const rect = block.getBoundingClientRect();
      return { block, x: (rect.left - pageRect.left) / scale, y: (rect.top - pageRect.top) / scale, width: rect.width / scale, height: rect.height / scale };
    });
    for (const position of positions) {
      Object.assign(position.block.style, {
        position: "absolute", inset: "auto", margin: "0", transform: "none",
        left: `${position.x}px`, top: `${position.y}px`,
        width: `${position.width}px`, height: `${position.height}px`,
      });
    }
    selected = undefined;
    removeAdded.hidden = true;
    properties.disabled = true;
    properties.hidden = true;
    hint.textContent = t.empty;
    actions.hidden = !dirty;
    reset.hidden = true;
    pageSelect.value = String(index);
    pageSelect.dispatchEvent(new Event("editor-sync"));
    prevPage.disabled = index === 0;
    nextPage.disabled = index === getBookPages().length - 1;
    navigationStatus.textContent = t.pageStatus.replace("{current}", String(index + 1)).replace("{total}", String(getBookPages().length));
    gestures.refresh();
  }

  function selectBlock(block) {
    const imageFitted = fitImageBlock(block);
    if (selected !== block) richText.finish();
    selected?.classList.remove("editor-selected");
    selected = block;
    removeAdded.hidden = block.dataset.editorAdded !== "true";
    if (!richText.isEditing(block)) canvas.focus({ preventScroll: true });
    const pageRect = currentPage.getBoundingClientRect();
    const rect = block.getBoundingClientRect();
    const scale = pageRect.width / width;
    const style = getComputedStyle(block);
    fields.x.value = String(Math.round((rect.left - pageRect.left) / scale));
    fields.y.value = String(Math.round((rect.top - pageRect.top) / scale));
    fields.width.value = String(Math.round(rect.width / scale));
    fields.height.value = String(Math.round(rect.height / scale));
    fields.fontSize.value = String(Math.round(parseFloat(style.fontSize)));
    const image = block.matches("img, .photo-placeholder");
    hint.textContent = "";
    actions.hidden = false;
    reset.hidden = false;
    for (const name of ["fontSize", "fontFamily", "fontWeight", "color"]) fields[name].closest("label").hidden = image;
    fields.replace.closest("label").hidden = !image;
    fields.fontFamily.value = identifyFont(style.fontFamily);
    fields.fontWeight.value = Number(style.fontWeight) >= 600 ? "bold" : "regular";
    const rgb = style.color.match(/\d+/g);
    if (rgb) fields.color.value = "#" + rgb.slice(0, 3).map((value) => Number(value).toString(16).padStart(2, "0")).join("");
    properties.disabled = false;
    properties.hidden = false;
    selected.classList.add("editor-selected");
    layers.sync();
    for (const name of ["fontFamily", "fontWeight"]) fields[name].dispatchEvent(new Event("editor-sync"));
    fields.fontSize.parentElement.querySelector("output").textContent = fields.fontSize.value;
    updatePalette();
    gestures.refresh();
    if (imageFitted) commit();
  }

  function applyProperties() {
    if (!selected || NUMBER_FIELDS.some((name) => !fields[name].validity.valid || fields[name].value === "")) return;
    Object.assign(selected.style, {
      position: "absolute", inset: "auto", margin: "0", transform: "none",
      left: `${fields.x.value}px`, top: `${fields.y.value}px`,
      width: `${fields.width.value}px`, height: `${fields.height.value}px`,
      fontSize: `${fields.fontSize.value}px`,
    });
    commit();
    gestures.refresh();
  }

  function applyTextStyle(event) {
    if (!selected) return;
    selected.style.fontFamily = FONT_OPTIONS[fields.fontFamily.value];
    selected.style.fontWeight = fields.fontWeight.value === "bold" ? "700" : "400";
    if (!event || event.target === fields.color) {
      if (!richText.applyColor(fields.color.value)) {
        selected.style.color = fields.color.value;
        selected.querySelectorAll("span[style]").forEach((span) => { span.style.color = ""; });
      }
    }
    commit();
  }

  async function replaceImage() {
    const imageFile = file.files[0];
    if (!imageFile || !selected) return;
    if (!/^image\/(png|jpeg|webp|gif)$/.test(imageFile.type)) { message.textContent = t.imageError; return; }
    if (imageFile.size > MAX_IMAGE_BYTES) { message.textContent = t.imageTooLarge; return; }
    const target = selected;
    try {
      const src = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(imageFile);
      });
      if (!target.isConnected || !active) return;
      const image = document.createElement("img");
      image.src = src;
      image.alt = imageFile.name;
      image.className = target.className;
      image.style.cssText = target.style.cssText;
      image.dataset.editorId = target.dataset.editorId;
      if (target.dataset.editorAdded === "true") image.dataset.editorAdded = "true";
      await image.decode();
      target.replaceWith(image);
      selectBlock(image);
      commit();
      uploadTitle.textContent = imageFile.name;
    } catch (error) {
      console.error("Unable to replace image", error);
      message.textContent = t.imageError;
    } finally { file.value = ""; }
  }

  function saveDocument() {
    if (currentPage) commit(false);
    try {
      saveBookDocument();
      dirty = false; actions.hidden = !selected;
      message.textContent = "";
      save.textContent = t.saved;
      setTimeout(() => { save.textContent = t.save; }, 1200);
    }
    catch (error) { console.warn("Unable to save book", error); message.textContent = t.saveError; }
  }

  pageSelect.addEventListener("change", () => showPage(Number(pageSelect.value)));
  button.setAttribute("aria-label", t.edit);
  button.title = t.edit;
  button.setAttribute("aria-pressed", "false");
  button.addEventListener("click", () => {
    active = !active;
    overlay.hidden = !active;
    document.body.classList.toggle("editing-book", active);
    button.title = active ? t.done : t.edit;
    button.setAttribute("aria-label", button.title);
    button.setAttribute("aria-pressed", String(active));
    exportButton.disabled = active;
    if (active) showPage(currentIndex);
    else {
      richText.finish();
      commit(false);
      document.dispatchEvent(new Event("book-content-changed"));
    }
  });
  new ResizeObserver(() => {
    const rect = viewport.getBoundingClientRect();
    const scale = Math.min((rect.width - 32) / width, (rect.height - 100) / height, 1);
    if (scale > 0) canvas.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }).observe(viewport);
}

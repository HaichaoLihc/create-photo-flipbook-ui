import { readTextRuns, renderTextRuns } from "./editor-rich-text.js";
import { readPageBackground, restorePageBackground } from "./editor-background.js";

export const BLOCK_SELECTOR = "img, .photo-placeholder, h1, h2, h3, p, .cover-mark";
export const EDITABLE_STYLES = ["position", "left", "top", "width", "height", "inset", "margin", "transform", "fontSize", "fontFamily", "fontWeight", "textAlign", "whiteSpace", "color", "objectFit", "zIndex", "padding", "border"];
const STORAGE_KEY = "2d-book-editor-v1";
let documentPages = [];
let originalPages = [];

export function initializeBookDocument() {
  documentPages = [...document.querySelectorAll("#book .book-page")].map((page) => {
    const copy = page.cloneNode(true);
    copy.querySelectorAll(BLOCK_SELECTOR).forEach((block, index) => {
      block.dataset.editorId = String(index);
    });
    return copy;
  });
  originalPages = documentPages.map((page) => page.cloneNode(true));
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!Array.isArray(stored) || stored.length !== documentPages.length) return;
    stored.forEach((entry, pageIndex) => {
      const blocks = Array.isArray(entry) ? entry : entry?.blocks;
      if (!Array.isArray(blocks)) return;
      if (!Array.isArray(entry)) restorePageBackground(documentPages[pageIndex], entry.background);
      blocks.forEach((patch) => {
        if (!patch || typeof patch.id !== "string" || !/^\d+$/.test(patch.id)) return;
        let block = documentPages[pageIndex].querySelector(`[data-editor-id="${patch.id}"]`);
        if (!block && patch.added === true && (patch.kind === "text" || patch.kind === "image")) {
          block = document.createElement(patch.kind === "image" ? "img" : "p");
          block.dataset.editorId = patch.id;
          block.dataset.editorAdded = "true";
          documentPages[pageIndex].append(block);
        }
        if (!block) return;
        if (typeof patch.src === "string" && /^data:image\/(png|jpeg|webp|gif);base64,/.test(patch.src)) {
          const image = document.createElement("img");
          image.className = block.className;
          image.dataset.editorId = patch.id;
          if (patch.added === true) image.dataset.editorAdded = "true";
          image.src = patch.src;
          image.alt = typeof patch.alt === "string" ? patch.alt : "";
          block.replaceWith(image);
          block = image;
        }
        if ((Array.isArray(patch.runs) || typeof patch.text === "string") && block.tagName !== "IMG" && !block.classList.contains("photo-placeholder")) {
          if (Array.isArray(patch.runs)) renderTextRuns(block, patch.runs);
          else block.textContent = patch.text;
          block.dataset.editorTextModified = "true";
        }
        for (const key of EDITABLE_STYLES) {
          if (typeof patch.styles?.[key] === "string") block.style[key] = patch.styles[key];
        }
      });
      const layered = [...documentPages[pageIndex].querySelectorAll(BLOCK_SELECTOR)].filter((block) => block.style.zIndex);
      documentPages[pageIndex].append(...layered);
    });
  } catch (error) {
    console.warn("Unable to restore book edits", error);
  }
}

export function getBookPages() {
  return documentPages.map((page) => page.cloneNode(true));
}

export function updateBookPage(index, page) {
  documentPages[index] = page.cloneNode(true);
}

export function resetBookPage(index) {
  documentPages[index] = originalPages[index].cloneNode(true);
}

export function saveBookDocument() {
  const patches = documentPages.map((page) => ({
    background: readPageBackground(page),
    blocks: [...page.querySelectorAll(BLOCK_SELECTOR)].map((block) => ({
    id: block.dataset.editorId,
    added: block.dataset.editorAdded === "true",
    kind: block.tagName === "IMG" ? "image" : "text",
    text: block.dataset.editorTextModified === "true" ? block.textContent : undefined,
    runs: block.dataset.editorTextModified === "true" ? readTextRuns(block) : undefined,
    src: block.tagName === "IMG" && block.src.startsWith("data:") ? block.src : undefined,
    alt: block.getAttribute("alt"),
    styles: Object.fromEntries(EDITABLE_STYLES.map((key) => [key, block.style[key]])),
    })),
  }));
  localStorage.setItem(STORAGE_KEY, JSON.stringify(patches));
}

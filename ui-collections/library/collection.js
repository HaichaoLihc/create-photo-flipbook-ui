import { books, bookUrl } from "./books.js";
import { enableShelfOrdering } from "./shelf-order.js";

const viewport = document.querySelector(".shelf-viewport");
const stage = document.querySelector(".shelf-stage");
const shelf = document.querySelector(".shelf");
const progress = document.querySelector(".shelf-progress");
const progressThumb = progress.querySelector("span");
const scrollLabel = document.querySelector(".scroll-label");
const preview = document.querySelector(".cover-preview");
const selection = document.querySelector(".footer-selection");
const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
const shelfLinks = () => [...shelf.querySelectorAll(".volume__link")];
let activeLink = null;

for (const [index, book] of books.entries()) {
  const volume = document.createElement("li");
  volume.className = "volume";
  volume.dataset.bookId = book.id;
  volume.style.setProperty("--paper", book.paper);
  volume.style.setProperty("--ink", book.ink);
  volume.style.setProperty("--height", book.height);

  const link = document.createElement("a");
  link.className = "volume__link";
  link.href = bookUrl(book.id);
  link.draggable = false;
  link.setAttribute("aria-label", `${book.title} — empty book`);
  link.setAttribute("aria-describedby", "shelf-help");
  link.setAttribute("aria-keyshortcuts", "Shift+ArrowLeft Shift+ArrowRight Shift+Home Shift+End");
  link.dataset.title = book.title;
  link.dataset.number = String(index + 1).padStart(2, "0");

  const binding = document.createElement("span");
  binding.className = "binding";
  binding.setAttribute("aria-hidden", "true");
  const title = document.createElement("span");
  title.className = "binding__title";
  title.textContent = book.title;
  binding.append(title);
  link.append(binding);
  volume.append(link);
  shelf.append(volume);
}

document.querySelector("#book-count").textContent = `${books.length} volumes / 0 pages`;

// Long titles fit inside the binding after a resize or a font change.
function fitSpineType() {
  for (const title of shelf.querySelectorAll(".binding__title")) {
    title.style.fontSize = "";
    const binding = title.parentElement;
    const fontSize = parseFloat(getComputedStyle(title).fontSize);
    const availableHeight = Math.max(12, binding.clientHeight - title.offsetTop - 24);
    const scale = Math.min(1, availableHeight / title.scrollHeight, (binding.clientWidth - 10) / title.offsetWidth);
    if (scale < 1) title.style.fontSize = `${Math.floor(fontSize * scale)}px`;
  }
}

function positionPreview() {
  if (!activeLink) return;
  const bounds = activeLink.getBoundingClientRect();
  const width = preview.offsetWidth;
  const left = Math.max(18, Math.min(window.innerWidth - width - 18, bounds.left + bounds.width / 2 - width / 2));
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--preview-gap"));
  preview.style.left = `${left}px`;
  preview.style.top = `${stage.getBoundingClientRect().bottom + gap}px`;
}

function hidePreview() {
  activeLink = null;
  preview.classList.remove("is-visible");
  selection.textContent = "PHOTOGRAPHS, BOUND.";
}

function showPreview(link) {
  if (ordering.busy) return;
  activeLink = link;
  selection.textContent = `${link.dataset.number} / ${link.dataset.title}`;
  preview.querySelector(".cover-preview__title").textContent = link.dataset.title;
  const style = link.closest(".volume").style;
  preview.style.setProperty("--paper", style.getPropertyValue("--paper"));
  preview.style.setProperty("--ink", style.getPropertyValue("--ink"));
  positionPreview();
  preview.classList.add("is-visible");
}

function updateScrollPosition() {
  const range = viewport.scrollWidth - viewport.clientWidth;
  scrollLabel.textContent = range > 1 ? "SCROLL TO EXPLORE →" : `${books.length} VOLUMES / ONE SHELF`;
  progress.hidden = range <= 1;
  const fraction = Math.min(1, viewport.clientWidth / Math.max(1, viewport.scrollWidth));
  progressThumb.style.width = `${fraction * 100}%`;
  const scroll = Math.max(0, Math.min(range, viewport.scrollLeft));
  progressThumb.style.left = `${range > 0 ? scroll / range * (1 - fraction) * 100 : 0}%`;
  if (!activeLink) return;
  const bounds = activeLink.getBoundingClientRect();
  if (bounds.right < 0 || bounds.left > window.innerWidth) hidePreview();
  else positionPreview();
}

const ordering = enableShelfOrdering({ shelf, viewport, onStart: hidePreview, onChange: updateScrollPosition });

for (const link of shelfLinks()) {
  link.addEventListener("pointerenter", () => { if (finePointer.matches) showPreview(link); });
  link.addEventListener("pointerleave", () => {
    if (activeLink === link && !link.matches(":focus-visible")) hidePreview();
  });
  link.addEventListener("focus", () => { if (link.matches(":focus-visible")) showPreview(link); });
  link.addEventListener("blur", () => { if (activeLink === link) hidePreview(); });
  link.addEventListener("click", hidePreview);
}

// Only consume the wheel when this shelf can actually scroll in that direction.
viewport.addEventListener("wheel", (event) => {
  if (event.ctrlKey || event.metaKey) return;
  const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
  const range = viewport.scrollWidth - viewport.clientWidth;
  if (!delta || range <= 1 || (delta < 0 && viewport.scrollLeft <= 0) || (delta > 0 && viewport.scrollLeft >= range)) return;
  const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientWidth : 1;
  event.preventDefault();
  viewport.scrollLeft += delta * unit;
}, { passive: false });

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") hidePreview();
  if (ordering.busy || event.shiftKey || event.altKey || event.ctrlKey || event.metaKey) return;
  const links = shelfLinks();
  const index = links.indexOf(document.activeElement);
  if (index < 0 || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
  event.preventDefault();
  const next = event.key === "Home" ? 0 : event.key === "End" ? links.length - 1
    : Math.max(0, Math.min(links.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
  links[next].focus({ preventScroll: true });
  links[next].scrollIntoView({ block: "nearest", inline: "nearest" });
});

window.addEventListener("resize", () => { fitSpineType(); updateScrollPosition(); });
window.addEventListener("scroll", positionPreview, { passive: true });
window.addEventListener("pageshow", hidePreview);
viewport.addEventListener("scroll", updateScrollPosition, { passive: true });
document.fonts.ready.then(fitSpineType);
fitSpineType();
updateScrollPosition();

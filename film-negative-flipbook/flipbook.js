const bookElement = document.querySelector("#book");
const pages = bookElement.querySelectorAll(".book-page");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const pageStatus = document.querySelector("#page-status");
const orientationStatus = document.querySelector("#orientation");
const pageWidth = Number(bookElement.dataset.pageWidth) || 512;
const pageHeight = Number(bookElement.dataset.pageHeight) || 640;
document.documentElement.style.setProperty("--page-ratio", pageWidth / pageHeight);

const pageFlip = new St.PageFlip(bookElement, {
  width: pageWidth,
  height: pageHeight,
  size: "stretch",
  minWidth: Math.max(1, Math.round(pageWidth * 0.56)),
  maxWidth: Math.max(1, Math.round(pageWidth * 1.04)),
  minHeight: Math.max(1, Math.round(pageHeight * 0.56)),
  maxHeight: Math.max(1, Math.round(pageHeight * 1.04)),
  drawShadow: true,
  flippingTime: 760,
  usePortrait: true,
  startZIndex: 10,
  autoSize: true,
  maxShadowOpacity: 0.42,
  showCover: true,
  mobileScrollSupport: false,
  clickEventForward: false,
  useMouseEvents: true,
  swipeDistance: 24,
  showPageCorners: true,
  disableFlipByClick: true,
});

let currentPage = 0;
let isTurning = false;
let isArranging = false;
let turningToneFrame = 0;
const toneLeaves = [...pages].filter(page => !page.classList.contains('binder-cover'));
const tintedLeaves = new Set();

function syncTurningLeafTone() {
  if (!isTurning) {
    for (const page of tintedLeaves) page.classList.remove("is-turning-leaf");
    tintedLeaves.clear();
    if (turningToneFrame) cancelAnimationFrame(turningToneFrame);
    turningToneFrame = 0;
    return;
  }

  for (const page of toneLeaves) {
    const transform = page.style.transform;
    const softAngle = transform.match(/rotate\((-?[\d.]+)rad\)/);
    const hardAngle = transform.match(/rotateY\((-?[\d.]+)deg\)/);
    const isMovingSoftLeaf = softAngle && Math.abs(Number(softAngle[1])) > 0.001;
    const isMovingHardLeaf = hardAngle && Math.abs(Number(hardAngle[1])) > 0.05;

    const moving = page.style.display !== 'none' && (isMovingSoftLeaf || isMovingHardLeaf);
    if (moving && !tintedLeaves.has(page)) {
      page.classList.add("is-turning-leaf");
      tintedLeaves.add(page);
    } else if (!moving && tintedLeaves.has(page)) {
      page.classList.remove("is-turning-leaf");
      tintedLeaves.delete(page);
    }
  }

  turningToneFrame = requestAnimationFrame(syncTurningLeafTone);
}

function updateControls() {
  const pageCount = pageFlip.getPageCount();
  const lastPage = pageCount - 1;
  bookElement.dataset.edge = currentPage === 0 ? "front" : currentPage === lastPage ? "back" : "inside";

  previousButton.disabled = currentPage === 0 || isTurning || isArranging;
  nextButton.disabled = currentPage === lastPage || isTurning || isArranging;

  if (currentPage === 0) {
    pageStatus.textContent = "Cover";
  } else if (currentPage === lastPage) {
    pageStatus.textContent = "Back cover";
  } else {
    pageStatus.textContent = `${String(currentPage + 1).padStart(2, "0")} / ${String(pageCount).padStart(2, "0")}`;
  }
}

pageFlip.on("flip", (event) => {
  currentPage = Number(event.data);
  updateControls();
});

pageFlip.on("changeState", (event) => {
  isTurning = event.data !== "read";
  bookElement.classList.toggle('is-page-turning', isTurning);
  if (isTurning && !turningToneFrame) turningToneFrame = requestAnimationFrame(syncTurningLeafTone);
  if (!isTurning) syncTurningLeafTone();
  updateControls();
});

function updateOrientation(orientation) {
  bookElement.dataset.layout = orientation;
  orientationStatus.textContent = orientation === "portrait" ? "Single page" : "Open spread";
}

pageFlip.on("init", (event) => updateOrientation(event.data.mode));
pageFlip.on("changeOrientation", (event) => updateOrientation(event.data));

pageFlip.loadFromHTML(pages);
updateControls();

const requestedPage = Number(new URLSearchParams(location.search).get("page"));
if (Number.isInteger(requestedPage) && requestedPage >= 0 && requestedPage < pages.length) {
  pageFlip.turnToPage(requestedPage);
}

previousButton.addEventListener("click", () => {
  if (!isTurning && !isArranging) pageFlip.flipPrev("bottom");
});

nextButton.addEventListener("click", () => {
  if (!isTurning && !isArranging) pageFlip.flipNext("bottom");
});

window.addEventListener("keydown", (event) => {
  if (event.target.closest?.(".film-strip")) return;
  if (event.altKey || event.ctrlKey || event.metaKey || isTurning || isArranging) return;

  if (event.key === "ArrowLeft") {
    event.preventDefault();
    pageFlip.flipPrev("bottom");
  }

  if (event.key === "ArrowRight" || event.key === " ") {
    event.preventDefault();
    pageFlip.flipNext("bottom");
  }

  if (event.key === "Home") pageFlip.turnToPage(0);
  if (event.key === "End") pageFlip.turnToPage(pageFlip.getPageCount() - 1);
});

document.querySelectorAll("button.negative-frame").forEach((frame) => {
  frame.setAttribute("aria-pressed", "false");
});

const stripArrangement = new FilmStripArrangement({
  book: bookElement,
  pages: [...pages],
  canStart: () => !isTurning && !isArranging,
  onBusyChange(busy) {
    isArranging = busy;
    updateControls();
  },
});

document.addEventListener("click", (event) => {
  const frame = event.target.closest?.("button.negative-frame");
  if (!frame) return;

  event.preventDefault();
  event.stopPropagation();
  if (isTurning || isArranging || stripArrangement.suppressClick) return;

  const isPositive = frame.classList.toggle("is-positive");
  frame.setAttribute("aria-pressed", String(isPositive));
  const number = frame.dataset.frame || "";
  frame.setAttribute(
    "aria-label",
    `${isPositive ? "Return" : "Reveal"} exposure ${number} ${isPositive ? "to negative" : "as positive"}`,
  );
}, true);

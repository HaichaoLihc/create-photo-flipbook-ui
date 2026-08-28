const bookElement = document.querySelector("#book");
const pages = bookElement.querySelectorAll(".book-page");
const previousButton = document.querySelector("#previous");
const nextButton = document.querySelector("#next");
const pageStatus = document.querySelector("#page-status");
const orientationStatus = document.querySelector("#orientation");
const pageWidth = Number(bookElement.dataset.pageWidth) || 471;
const pageHeight = Number(bookElement.dataset.pageHeight) || 640;

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
  clickEventForward: true,
  useMouseEvents: true,
  swipeDistance: 24,
  showPageCorners: true,
  disableFlipByClick: false,
});

let currentPage = 0;
let isTurning = false;

function updateControls() {
  const pageCount = pageFlip.getPageCount();
  const lastPage = pageCount - 1;

  previousButton.disabled = currentPage === 0 || isTurning;
  nextButton.disabled = currentPage === lastPage || isTurning;

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
  updateControls();
});

function updateOrientation(orientation) {
  orientationStatus.textContent = orientation === "portrait" ? "Single page" : "Open spread";
}

pageFlip.on("init", (event) => updateOrientation(event.data.mode));
pageFlip.on("changeOrientation", (event) => updateOrientation(event.data));

pageFlip.loadFromHTML(pages);
updateControls();

previousButton.addEventListener("click", () => {
  if (!isTurning) pageFlip.flipPrev("bottom");
});

nextButton.addEventListener("click", () => {
  if (!isTurning) pageFlip.flipNext("bottom");
});

window.addEventListener("keydown", (event) => {
  if (event.altKey || event.ctrlKey || event.metaKey || isTurning) return;

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

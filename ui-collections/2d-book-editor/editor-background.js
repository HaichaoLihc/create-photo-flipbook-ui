import { pageBackgroundCatalog as t } from "./catalogs/page-background.js";

const COLORS = ["#f0e9d8", "#ffffff", "#243f39", "#71908b", "#d7b16b", "#6f493f"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const PAGE_BACKGROUND_STYLES = ["backgroundColor", "backgroundImage", "backgroundSize", "backgroundPosition", "backgroundRepeat"];
const IMAGE_DATA_PATTERN = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/;

export function readPageBackground(page) {
  return Object.fromEntries(PAGE_BACKGROUND_STYLES.map((key) => [key, page.style[key]]));
}

export function restorePageBackground(page, background) {
  if (!background || typeof background !== "object") return;
  if (typeof background.backgroundColor === "string" && CSS.supports("color", background.backgroundColor)) {
    page.style.backgroundColor = background.backgroundColor;
  }
  const image = background.backgroundImage;
  if (image === "none") page.style.backgroundImage = "none";
  const source = typeof image === "string" ? image.match(/^url\("(.*)"\)$/)?.[1] : undefined;
  if (source && IMAGE_DATA_PATTERN.test(source)) {
    Object.assign(page.style, { backgroundImage: image, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" });
  }
}

export function initializePageBackground(panel, { getPage, commit, reportError }) {
  const section = document.createElement("section");
  section.className = "editor-background";
  section.setAttribute("aria-label", t.title);
  const heading = document.createElement("h3");
  heading.textContent = t.title;
  const body = document.createElement("div");
  body.className = "background-controls";
  section.append(heading, body);
  panel.append(section);
  const palette = document.createElement("div");
  palette.className = "editor-palette";
  palette.setAttribute("aria-label", t.color);
  const custom = document.createElement("input");
  custom.type = "color";
  custom.setAttribute("aria-label", t.customColor);
  for (const color of COLORS) {
    const swatch = document.createElement("button");
    swatch.type = "button";
    swatch.className = "color-swatch";
    swatch.style.setProperty("--swatch-color", color);
    swatch.setAttribute("aria-label", t.colorOption.replace("{color}", color));
    swatch.addEventListener("click", () => applyColor(color));
    palette.append(swatch);
  }
  custom.addEventListener("input", () => applyColor(custom.value));
  const actions = document.createElement("div");
  actions.className = "background-actions";
  const upload = document.createElement("button");
  upload.type = "button";
  upload.textContent = t.image;
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp,image/gif";
  file.hidden = true;
  file.setAttribute("aria-label", t.image);
  upload.addEventListener("click", () => file.click());
  const reset = document.createElement("button");
  reset.type = "button";
  reset.title = t.reset;
  reset.setAttribute("aria-label", t.reset);
  reset.className = "background-reset";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M4 10a8 8 0 1 1 2 8M4 4v6h6");
  svg.append(path);
  reset.append(svg);
  reset.addEventListener("click", () => {
    const page = getPage();
    if (!page) return;
    for (const key of PAGE_BACKGROUND_STYLES) page.style[key] = "";
    commit(); sync();
  });
  actions.append(upload, reset, file);
  custom.title = t.customColor;
  custom.className = "background-custom-color";
  const colors = document.createElement("div");
  colors.className = "background-colors";
  colors.append(palette, custom);
  body.append(colors, actions);
  file.addEventListener("change", async () => {
    const imageFile = file.files[0];
    const page = getPage();
    if (!imageFile || !page) return;
    try {
      if (!/^image\/(png|jpeg|webp|gif)$/.test(imageFile.type)) { reportError(t.imageError); return; }
      if (imageFile.size > MAX_IMAGE_BYTES) { reportError(t.imageTooLarge); return; }
      const source = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(imageFile);
      });
      const image = new Image();
      image.src = source;
      await image.decode();
      if (page !== getPage() || !page.isConnected) return;
      Object.assign(page.style, { backgroundImage: `url("${source}")`, backgroundSize: "cover", backgroundPosition: "center", backgroundRepeat: "no-repeat" });
      commit(); sync();
    } catch (error) {
      console.error("Unable to load page background", error);
      reportError(t.imageError);
    } finally { file.value = ""; }
  });

  function applyColor(color) {
    const page = getPage();
    if (!page) return;
    page.style.backgroundColor = color;
    page.style.backgroundImage = "none";
    commit(); sync();
  }

  function sync() {
    const page = getPage();
    if (!page) return;
    const rgb = getComputedStyle(page).backgroundColor.match(/\d+/g);
    if (rgb) custom.value = "#" + rgb.slice(0, 3).map((part) => Number(part).toString(16).padStart(2, "0")).join("");
    const hasImage = getComputedStyle(page).backgroundImage !== "none";
    for (const swatch of palette.children) {
      swatch.setAttribute("aria-pressed", String(!hasImage && swatch.style.getPropertyValue("--swatch-color") === custom.value));
    }
  }
  return { sync };
}

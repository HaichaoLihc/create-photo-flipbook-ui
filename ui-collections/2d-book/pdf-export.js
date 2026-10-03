import { pdfExportCatalog } from "./catalogs/pdf-export.js";
import { getBookPages } from "./book-document.js";

const EXPORT_SCALE = 2;
const IMAGE_QUALITY = 0.95;
const DOWNLOAD_URL_LIFETIME_MS = 60000;
const SCRIPT_PATHS = ["vendor/html2canvas.min.js", "vendor/jspdf.umd.min.js"];
let dependencyPromise;

function loadScript(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = path;
    script.onload = resolve;
    script.onerror = () => {
      script.remove();
      reject(new Error(`Unable to load ${path}`));
    };
    document.head.append(script);
  });
}

async function loadDependencies() {
  if (!dependencyPromise) {
    dependencyPromise = Promise.all(SCRIPT_PATHS.map(loadScript)).catch((error) => {
      dependencyPromise = undefined;
      throw error;
    });
  }
  await dependencyPromise;
}

function formatMessage(message, current, total) {
  return message.replace("{current}", String(current)).replace("{total}", String(total));
}

export function initializePdfExport() {
  const book = document.querySelector("#book");
  const button = document.querySelector("#export-pdf");
  const status = document.querySelector("#export-status");
  button.setAttribute("aria-label", pdfExportCatalog.button);
  button.title = pdfExportCatalog.button;

  button.addEventListener("click", async () => {
    if (button.disabled) return;
    const sourcePages = getBookPages();
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    const width = Number(book.dataset.pageWidth);
    const height = Number(book.dataset.pageHeight);
    const container = document.createElement("div");
    container.className = "pdf-export-stage";
    container.setAttribute("aria-hidden", "true");
    document.body.append(container);
    status.textContent = formatMessage(pdfExportCatalog.progress, 0, sourcePages.length);

    try {
      if (!(width > 0 && height > 0 && sourcePages.length > 0)) {
        throw new Error("Invalid book dimensions or empty book");
      }
      await loadDependencies();
      await document.fonts.ready;
      const orientation = width > height ? "landscape" : "portrait";
      const pdf = new globalThis.jspdf.jsPDF({
        orientation, unit: "px", format: [width, height],
        hotfixes: ["px_scaling"], compress: true,
      });
      for (const [index, source] of sourcePages.entries()) {
        status.textContent = formatMessage(pdfExportCatalog.progress, index + 1, sourcePages.length);
        const page = source.cloneNode(true);
        page.style.width = `${width}px`;
        page.style.height = `${height}px`;
        container.replaceChildren(page);
        await Promise.all([...page.querySelectorAll("img")].map((image) => image.decode()));
        const canvas = await globalThis.html2canvas(page, {
          scale: EXPORT_SCALE, width, height, backgroundColor: null,
          useCORS: true, logging: false,
        });
        if (index > 0) pdf.addPage([width, height], orientation);
        pdf.addImage(canvas.toDataURL("image/jpeg", IMAGE_QUALITY), "JPEG", 0, 0, width, height);
        canvas.width = 0;
        canvas.height = 0;
      }
      const download = document.createElement("a");
      download.href = pdf.output("datauristring");
      download.download = pdfExportCatalog.filename;
      download.hidden = true;
      download.className = "pdf-export-download";
      document.body.append(download);
      download.click();
      setTimeout(() => download.remove(), DOWNLOAD_URL_LIFETIME_MS);
      status.textContent = formatMessage(pdfExportCatalog.complete, sourcePages.length, sourcePages.length);
    } catch (error) {
      console.error("PDF export failed", error);
      status.textContent = pdfExportCatalog.error;
    } finally {
      container.remove();
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  });
}

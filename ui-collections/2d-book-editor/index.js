import { initializePdfExport } from "./pdf-export.js";
import { initializeBookDocument, getBookPages } from "./book-document.js";
import { initializeEditor } from "./editor.js";

initializeBookDocument();
document.querySelector("#book").replaceChildren(...getBookPages());
initializePdfExport();
initializeEditor();

export { initializePdfExport, initializeEditor, initializeBookDocument, getBookPages };

export { themeSelect } from "./editor-controls.js";
export { initializeBlockGestures, changeGeometry } from "./editor-gestures.js";
export { initializeRichText, readTextRuns, renderTextRuns } from "./editor-rich-text.js";
export { initializePageBackground, readPageBackground, restorePageBackground } from "./editor-background.js";
export { pageBackgroundCatalog } from "./catalogs/page-background.js";
export { initializeLayerControls, orderLayerBlocks, moveLayer } from "./editor-layers.js";
export { layersCatalog } from "./catalogs/layers.js";
export { FONT_OPTIONS, identifyFont } from "./editor-fonts.js";
export { setActionIcon } from "./editor-icons.js";
export { fontsCatalog } from "./catalogs/fonts.js";
export { fitImageBlock } from "./editor-images.js";
export { changeImageGeometry } from "./editor-gestures.js";

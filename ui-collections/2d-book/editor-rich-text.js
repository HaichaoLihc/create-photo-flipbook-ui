const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

export function readTextRuns(block) {
  const runs = [];
  function append(text, color) {
    if (!text) return;
    const previous = runs.at(-1);
    if (previous && previous.color === color) previous.text += text;
    else runs.push({ text, color });
  }
  function visit(node, inheritedColor) {
    if (node.nodeType === TEXT_NODE) { append(node.textContent, inheritedColor); return; }
    if (node.nodeType !== ELEMENT_NODE) return;
    if (node.tagName === "BR") { append("\n", inheritedColor); return; }
    const color = node === block ? null : node.style.color || inheritedColor;
    for (const child of node.childNodes) visit(child, color);
    if (node !== block && (node.tagName === "DIV" || node.tagName === "P")) append("\n", color);
  }
  visit(block, null);
  return runs;
}

export function renderTextRuns(block, runs) {
  const nodes = [];
  for (const run of runs) {
    if (!run || typeof run.text !== "string") continue;
    const node = document.createTextNode(run.text);
    if (typeof run.color === "string" && CSS.supports("color", run.color)) {
      const span = document.createElement("span");
      span.style.color = run.color;
      span.append(node);
      nodes.push(span);
    } else nodes.push(node);
  }
  block.replaceChildren(...nodes);
  block.style.whiteSpace = "pre-wrap";
}

export function initializeRichText(canvas, settings) {
  let editing;
  let selectedRange;
  function finish() {
    if (!editing) return;
    editing.removeAttribute("contenteditable");
    editing.removeAttribute("spellcheck");
    editing.removeAttribute("aria-label");
    editing.classList.remove("inline-text-editing");
    editing = undefined;
    selectedRange = undefined;
  }
  function begin(block) {
    if (!block || block.matches("img, .photo-placeholder")) return;
    finish();
    settings.select(block);
    renderTextRuns(block, readTextRuns(block));
    editing = block;
    block.contentEditable = "true";
    block.spellcheck = false;
    block.setAttribute("aria-label", settings.label);
    block.classList.add("inline-text-editing");
    block.focus({ preventScroll: true });
  }
  function changed() {
    if (!editing) return;
    editing.dataset.editorTextModified = "true";
    settings.commit();
    settings.refresh();
  }
  function insertPlainText(text) {
    const selection = window.getSelection();
    if (!editing || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (!editing.contains(range.commonAncestorContainer)) return;
    range.deleteContents();
    const node = document.createTextNode(text);
    range.insertNode(node);
    range.setStartAfter(node);
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
    changed();
  }
  canvas.addEventListener("dblclick", (event) => begin(event.target.closest("[data-editor-id]") || settings.getSelected()));
  canvas.addEventListener("input", changed);
  canvas.addEventListener("beforeinput", (event) => {
    if (editing && (event.inputType === "insertParagraph" || event.inputType === "insertLineBreak")) {
      event.preventDefault();
      insertPlainText("\n");
    }
  });
  canvas.addEventListener("paste", (event) => {
    if (!editing) return;
    event.preventDefault();
    insertPlainText(event.clipboardData.getData("text/plain"));
  });
  canvas.addEventListener("keydown", (event) => {
    if (editing && event.key === "Escape") { event.preventDefault(); finish(); canvas.focus(); }
    else if (!editing && event.key === "Enter") { event.preventDefault(); begin(settings.getSelected()); }
  });
  document.addEventListener("selectionchange", () => {
    const selection = window.getSelection();
    if (!editing || !selection.rangeCount) return;
    const range = selection.getRangeAt(0);
    if (editing.contains(range.commonAncestorContainer)) selectedRange = range.collapsed ? undefined : range.cloneRange();
  });
  return {
    begin, finish,
    isEditing: (block) => block === editing,
    applyColor(color) {
      if (!editing || !selectedRange || selectedRange.collapsed || !editing.contains(selectedRange.commonAncestorContainer)) return false;
      const range = selectedRange.cloneRange();
      const fragment = range.extractContents();
      fragment.querySelectorAll("[style]").forEach((node) => { node.style.color = ""; });
      const span = document.createElement("span");
      span.style.color = color;
      span.append(fragment);
      range.insertNode(span);
      range.selectNodeContents(span);
      selectedRange = range.cloneRange();
      const selection = window.getSelection();
      selection.removeAllRanges();
      selection.addRange(range);
      changed();
      return true;
    },
  };
}

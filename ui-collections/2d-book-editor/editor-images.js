export function fitImageBlock(image) {
  if (image.tagName !== "IMG" || !image.naturalWidth || !image.naturalHeight) return false;
  const width = parseFloat(image.style.width);
  const height = parseFloat(image.style.height);
  if (!(width > 0 && height > 0)) return false;
  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const fittedWidth = image.naturalWidth * scale;
  const fittedHeight = image.naturalHeight * scale;
  const changed = Math.abs(width - fittedWidth) > Number.EPSILON || Math.abs(height - fittedHeight) > Number.EPSILON;
  Object.assign(image.style, {
    left: `${parseFloat(image.style.left) + (width - fittedWidth) / 2}px`,
    top: `${parseFloat(image.style.top) + (height - fittedHeight) / 2}px`,
    width: `${fittedWidth}px`, height: `${fittedHeight}px`, objectFit: "fill",
    padding: "0", border: "0",
  });
  return changed;
}

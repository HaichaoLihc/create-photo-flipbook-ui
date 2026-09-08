export function chooseDragDirection(sheet, maxSheet, pointerX, centerX) {
  if (maxSheet <= 0) return 0;
  if (sheet <= 0) return 1;
  if (sheet >= maxSheet) return -1;
  return pointerX < centerX ? -1 : 1;
}

export function dragFraction(deltaX, direction, pageWidth, startFraction = 0) {
  const safeWidth = Math.max(1, pageWidth);
  const travel = direction === 1 ? -deltaX : deltaX;
  return Math.max(0, Math.min(1, startFraction + travel / safeWidth));
}

export function shouldCompleteDrag(fraction, elapsed) {
  return fraction >= 0.32 || (elapsed <= 280 && fraction >= 0.12);
}

export function isActivePointer(pointerStart, pointerId) {
  return pointerStart?.pointerId === pointerId;
}

export function edgePreviewDirection({
  sheet,
  maxSheet,
  pointerX,
  pointerY,
  centerX,
  centerY,
  pageWidth,
  pageHeight,
  edgeZone,
}) {
  if (maxSheet <= 0 || Math.abs(pointerY - centerY) > pageHeight / 2) return 0;

  let direction;
  let edgeX;
  if (sheet <= 0) {
    direction = 1;
    edgeX = centerX + pageWidth / 2;
  } else if (sheet >= maxSheet) {
    direction = -1;
    edgeX = centerX - pageWidth / 2;
  } else if (pointerX < centerX) {
    direction = -1;
    edgeX = centerX - pageWidth;
  } else {
    direction = 1;
    edgeX = centerX + pageWidth;
  }

  return Math.abs(pointerX - edgeX) <= edgeZone ? direction : 0;
}

export function edgePreviewPose(baseSheet, direction, amount, maxSheet) {
  if (
    maxSheet <= 0
    || (direction !== 1 && direction !== -1)
    || (direction === 1 && baseSheet >= maxSheet)
    || (direction === -1 && baseSheet <= 0)
  ) return null;

  const safeAmount = Math.max(0, Math.min(1, amount));
  const progress = baseSheet + direction * safeAmount;
  const sheetIndex = direction === 1 ? baseSheet : baseSheet - 1;
  const pageProgress = direction === 1 ? safeAmount : 1 - safeAmount;
  const progressFraction = progress - Math.floor(progress);

  let curveIntensity = 1;
  if (progress < 1) curveIntensity = progressFraction;
  else if (progress >= maxSheet) curveIntensity = 0;
  else if (progress >= maxSheet - 1) curveIntensity = 1 - progressFraction;

  return { progress, sheetIndex, pageProgress, curveIntensity };
}

export function isPointerOverBook({
  sheet,
  maxSheet,
  pointerX,
  pointerY,
  centerX,
  centerY,
  pageWidth,
  pageHeight,
}) {
  const halfWidth = sheet <= 0 || sheet >= maxSheet ? pageWidth / 2 : pageWidth;
  return (
    Math.abs(pointerX - centerX) <= halfWidth
    && Math.abs(pointerY - centerY) <= pageHeight / 2
  );
}

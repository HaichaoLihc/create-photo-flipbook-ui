/* Shared geometry: photographs stay upright as the collection changes shape. */
((root) => {
  'use strict';
  const wrap = (value, length) => ((value % length) + length) % length;
  const relative = (index, position, count) => wrap(index - position + count / 2, count) - count / 2;
  const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

  function pose(view, distance, width, height) {
    const slots = width < 560 ? 12 : 18;
    const half = slots / 2;
    const opacity = clamp((half - Math.abs(distance + 0.5)) / 0.15, 0, 1);
    const radius = Math.min(width * 0.368, height * 0.39);
    const cardWidth = radius * (width < 560 ? 0.32 : 0.238);
    const a = distance * Math.PI * 2 / slots;
    let x, y, size, depth = 0, tilt = 0;

    if (view === 'tilt') {
      size = clamp(Math.min(width * 0.183, height * 0.32), 115, 230);
      x = distance * size * 1.18;
      y = Math.pow(distance, 2) * Math.min(height * 0.048, 44) - height * 0.075;
      tilt = clamp(-distance * 5, -24, 24);
      depth = -Math.abs(distance);
    } else if (view === 'ring') {
      const r = Math.min(width * 0.405, height * 0.46);
      const theta = a + Math.PI / 2;
      const px = Math.cos(theta) * r;
      const py = Math.sin(theta) * r * 0.50;
      const rotation = -0.60;
      const perspective = 1 / (1 - Math.sin(theta) * 0.19);
      x = (px * Math.cos(rotation) - py * Math.sin(rotation)) * perspective;
      y = (px * Math.sin(rotation) + py * Math.cos(rotation)) * perspective;
      size = cardWidth * (1 + Math.sin(theta) * 0.31);
      depth = Math.sin(theta);
    } else if (view === 'gallery') {
      const front = (Math.cos(a) + 1) / 2;
      const scale = 0.27 + 0.73 * front * front;
      x = Math.sin(a) * width * 0.61 * (0.65 + front * 0.35);
      y = 0;
      size = clamp(Math.min(width * 0.205, height * 0.36), 130, 270) * scale;
      depth = Math.cos(a);
    } else {
      x = Math.sin(a) * radius;
      y = -Math.cos(a) * radius;
      size = cardWidth;
    }
    return { x, y, size, opacity, depth, tilt };
  }
  const api = { wrap, relative, pose };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.LifeRingLayout = api;
})(typeof window !== 'undefined' ? window : globalThis);

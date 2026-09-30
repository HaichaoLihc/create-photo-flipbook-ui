export const LAYER = 512;

function decode(src) {
  return new Promise((res, rej) => { const img = new Image(); img.decoding = 'async'; img.onload = () => res(img); img.onerror = () => rej(new Error(`Could not load photo: ${src}`)); img.src = src; });
}
export async function loadTextures(gl, photos, onProgress) {
  const limit = gl.getParameter(gl.MAX_ARRAY_TEXTURE_LAYERS);
  if (photos.length > limit) throw new Error(`This device supports at most ${limit} photos; the catalog has ${photos.length}.`);
  const arrTex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrTex);
  gl.texStorage3D(gl.TEXTURE_2D_ARRAY, 1 + Math.log2(LAYER), gl.RGBA8, LAYER, LAYER, photos.length);
  const scratch = document.createElement('canvas'); scratch.width = scratch.height = LAYER;
  const ctx = scratch.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  const tiny = document.createElement('canvas'); tiny.width = tiny.height = 8;
  const tctx = tiny.getContext('2d', { willReadFrequently: true });
  let done = 0;
  const queue = photos.map((_, i) => i);
  const worker = async () => {
    while (queue.length) {
      const i = queue.shift();
      const img = await decode(photos[i].src);
      photos[i].aspect = img.naturalWidth / img.naturalHeight;
      ctx.clearRect(0, 0, LAYER, LAYER);
      ctx.drawImage(img, 0, 0, LAYER, LAYER); // stretched to the square layer; the stream restores the aspect
      tctx.drawImage(scratch, 0, 0, 8, 8);
      const px = tctx.getImageData(0, 0, 8, 8).data; let r = 0, g = 0, b = 0;
      for (let j = 0; j < px.length; j += 4) { r += px[j]; g += px[j + 1]; b += px[j + 2]; }
      photos[i].avg = [r / 64 / 255, g / 64 / 255, b / 64 / 255];
      gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrTex);
      gl.texSubImage3D(gl.TEXTURE_2D_ARRAY, 0, 0, 0, i, LAYER, LAYER, 1, gl.RGBA, gl.UNSIGNED_BYTE, scratch);
      onProgress(++done / photos.length);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrTex);
  gl.generateMipmap(gl.TEXTURE_2D_ARRAY);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D_ARRAY, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return arrTex;
}

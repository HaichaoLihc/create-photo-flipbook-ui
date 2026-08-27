import {
  CanvasTexture,
  DataTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RGBAFormat,
  SRGBColorSpace,
  Texture,
  type WebGLRenderer,
} from "three";
import type { LibraryBook, PhotoBookPage } from "./book-pages";

export const PAPER = "#f3efe5";

/** Longest edge kept for a page texture. A page never covers more than ~900
 *  CSS pixels on screen, so anything larger only costs decode time and VRAM. */
const MAX_EDGE = 1024;
/** Source and page aspect within this tolerance count as identical, which lets
 *  the decoded bitmap be used as-is with no resampling pass. */
const RATIO_TOLERANCE = 0.012;

export type PageTextures = Map<string, Texture>;
type DecodedImage = ImageBitmap | HTMLImageElement;

const cache = new Map<string, Texture>();
const inFlight = new Map<string, Promise<Texture>>();

const cacheKey = (url: string, pageRatio: number) => `${url}@${pageRatio.toFixed(3)}`;

export function declaredRatio(page: PhotoBookPage) {
  return page.width && page.height ? page.width / page.height : undefined;
}

let paper: DataTexture | null = null;

/** Blank leaf. Generated rather than fetched so an unpaired final page never
 *  adds a request to the critical path of opening a book. */
export function paperTexture() {
  if (!paper) {
    paper = new DataTexture(new Uint8Array([0xf3, 0xef, 0xe5, 0xff]), 1, 1, RGBAFormat);
    paper.colorSpace = SRGBColorSpace;
    paper.needsUpdate = true;
  }
  return paper;
}

function tune(texture: Texture) {
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

/** Decode off the main thread where the browser allows it. `createImageBitmap`
 *  keeps a 1.3 MB PNG from blocking the frame the way `<img>` decoding does. */
async function decode(url: string): Promise<DecodedImage> {
  if (typeof createImageBitmap === "function") {
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      // Three.js cannot apply Texture.flipY to ImageBitmap uploads. Flip while
      // decoding so direct bitmap textures and canvas-fitted textures share
      // the same upright UV orientation.
      return await createImageBitmap(await response.blob(), {
        imageOrientation: "flipY",
        premultiplyAlpha: "none",
      });
    } catch {
      // Fall through: some engines reject the option bag, and a failed fetch
      // can still succeed as a plain image request.
    }
  }
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });
}

function sizeOf(image: DecodedImage) {
  return "naturalWidth" in image
    ? { width: image.naturalWidth, height: image.naturalHeight }
    : { width: image.width, height: image.height };
}

/** Contain-fit the artwork onto a paper-coloured leaf of the book's aspect,
 *  downsampling to the texture budget in the same pass. */
function fit(image: DecodedImage, pageRatio: number, sourceRatio?: number) {
  const { width: sourceWidth, height: sourceHeight } = sizeOf(image);
  const resolvedSourceRatio = sourceRatio ?? sourceWidth / sourceHeight;
  const sourceEdge = Math.max(sourceWidth, sourceHeight);
  if (Math.abs(resolvedSourceRatio - pageRatio) < RATIO_TOLERANCE && sourceEdge <= MAX_EDGE) {
    return tune(new Texture(image as HTMLImageElement));
  }

  const longEdge = Math.min(MAX_EDGE, sourceEdge);
  const width = pageRatio >= 1 ? longEdge : Math.round(longEdge * pageRatio);
  const height = pageRatio >= 1 ? Math.round(longEdge / pageRatio) : longEdge;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  context.fillStyle = PAPER;
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  context.drawImage(
    image,
    (width - drawWidth) / 2,
    (height - drawHeight) / 2,
    drawWidth,
    drawHeight,
  );
  if ("close" in image) image.close();
  return tune(new CanvasTexture(canvas));
}

/** Cached per (url, page aspect). Reopening a book costs nothing. */
export function loadPageTexture(url: string, pageRatio: number, sourceRatio?: number) {
  const key = cacheKey(url, pageRatio);
  const ready = cache.get(key);
  if (ready) return Promise.resolve(ready);
  const pending = inFlight.get(key);
  if (pending) return pending;

  const request = decode(url)
    .then((image) => {
      const texture = fit(image, pageRatio, sourceRatio);
      cache.set(key, texture);
      return texture;
    })
    .finally(() => inFlight.delete(key));
  inFlight.set(key, request);
  return request;
}

export async function loadPagesTextures(pages: PhotoBookPage[], pageRatio: number, cover?: string) {
  const wanted = new Map<string, number | undefined>();
  if (cover) wanted.set(cover, undefined);
  for (const page of pages) {
    if (page.image && !wanted.has(page.image)) wanted.set(page.image, declaredRatio(page));
  }
  const entries = await Promise.all(
    [...wanted].map(async ([url, sourceRatio]) => {
      try {
        return [url, await loadPageTexture(url, pageRatio, sourceRatio)] as const;
      } catch {
        // A missing leaf degrades to blank paper instead of wedging the open.
        return [url, paperTexture()] as const;
      }
    }),
  );
  return new Map(entries) as PageTextures;
}

export const loadBookTextures = (book: LibraryBook) =>
  loadPagesTextures(book.pages, book.ratio, book.cover);

export function prefetchBook(book: LibraryBook) {
  void loadBookTextures(book).catch(() => {});
}

const nextFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

const uploaded = new WeakSet<Texture>();

/**
 * Load a book and hand its textures to the GPU one per frame. Uploading a
 * fourteen-leaf book in a single frame stalls the compositor for hundreds of
 * milliseconds; spread across the opening flight it is invisible.
 */
export async function warmBookTextures(
  book: LibraryBook,
  gl: WebGLRenderer,
  aborted: () => boolean,
) {
  const textures = await loadBookTextures(book);
  for (const texture of textures.values()) {
    if (aborted()) return textures;
    // Already resident from an earlier open: reopening should be instant.
    if (uploaded.has(texture)) continue;
    gl.initTexture(texture);
    uploaded.add(texture);
    await nextFrame();
  }
  return textures;
}

import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

export function imageUrl(value) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== 'i.pinimg.com' || url.username || url.password || url.port) {
    throw new Error('Expected an HTTPS image URL on i.pinimg.com.');
  }
  return url.href;
}

function webUrl(value) {
  try { const u = new URL(value); return ['https:', 'http:'].includes(u.protocol) ? u.href : null; }
  catch { return null; }
}

function text(value, max = 200) {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';
}

export function extractPins(data) {
  const results = [];
  const walk = (node, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 30) return;
    if (node.images && /^\d+$/.test(String(node.id))) {
      const images = node.images;
      const original = images.orig || images.originals;
      const preview = images['474x'] || images['236x'] || images['736x'] || original;
      const best = original || images['736x'] || preview;
      try {
        if (!best?.url || !preview?.url) return;
        results.push({
          id: String(node.id),
          title: text(node.grid_title || node.title || node.description) || null,
          image_url: imageUrl(best.url),
          thumbnail_url: imageUrl(preview.url),
          pin_url: `https://www.pinterest.com/pin/${node.id}/`,
          source_url: webUrl(node.link),
          width: Number.isFinite(best.width) ? best.width : null,
          height: Number.isFinite(best.height) ? best.height : null,
          original_available: Boolean(original),
        });
      } catch { /* Ignore non-image / malformed records. */ }
      return;
    }
    for (const child of Object.values(node)) walk(child, depth + 1);
  };
  walk(data);
  return uniquePins(results);
}

export function uniquePins(pins) {
  const ids = new Map();
  const assets = new Set();
  const output = [];
  for (const pin of pins) {
    // Deduplicate the same image saved to multiple pins or served in different sizes/formats.
    const asset = new URL(pin.image_url).pathname.split('/').pop().split('.')[0];
    if (ids.has(pin.id)) {
      const existing = output[ids.get(pin.id)];
      for (const key of ['title', 'source_url', 'width', 'height']) if (!existing[key] && pin[key]) existing[key] = pin[key];
      if (!existing.original_available && pin.original_available) {
        existing.image_url = pin.image_url; existing.original_available = true;
        existing.width = pin.width; existing.height = pin.height;
      }
      continue;
    }
    if (assets.has(asset)) continue;
    ids.set(pin.id, output.length); assets.add(asset); output.push({ ...pin });
  }
  return output;
}

export async function mapLimit(items, concurrency, callback) {
  const output = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (next < items.length) { const i = next++; output[i] = await callback(items[i], i); }
  }));
  return output;
}


export async function findChrome() {
  const candidates = process.env.PINTEREST_CHROME_PATH ? [process.env.PINTEREST_CHROME_PATH] : [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    path.join(os.homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
    '/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser',
    ...['PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'].flatMap(key => process.env[key]
      ? [path.join(process.env[key], 'Google/Chrome/Application/chrome.exe')] : []),
  ];
  for (const candidate of candidates) {
    try { await fs.access(candidate, constants.X_OK); return candidate; } catch { /* Try the next installed browser. */ }
  }
  throw new Error('Chrome/Chromium was not found. Set PINTEREST_CHROME_PATH to its executable.');
}

export async function loadPuppeteer() {
  try { return (await import('puppeteer-core')).default; }
  catch (error) {
    if (error.code !== 'ERR_MODULE_NOT_FOUND') throw error;
    throw new Error('Browser dependency is missing. Run npm ci --omit=dev in this script’s directory.');
  }
}

export class PinterestEngine {
  constructor() { this.browsers = new Map(); this.closed = false; }

  async browser(headless = true) {
    if (this.closed) throw new Error('Pinterest client is closed.');
    let promise = this.browsers.get(headless);
    if (!promise) {
      promise = (async () => {
        const [puppeteer, executablePath] = await Promise.all([loadPuppeteer(), findChrome()]);
        return puppeteer.launch({ executablePath, headless });
      })();
      this.browsers.set(headless, promise);
      try {
        const browser = await promise;
        browser.once('disconnected', () => {
          if (this.browsers.get(headless) === promise) this.browsers.delete(headless);
        });
      } catch (error) { this.browsers.delete(headless); throw error; }
    }
    return promise;
  }

  async withPage(headless, signal, callback) {
    signal?.throwIfAborted();
    const browser = await this.browser(headless);
    signal?.throwIfAborted();
    const page = await browser.newPage();
    const cancel = () => { void page.close().catch(() => {}); };
    signal?.addEventListener('abort', cancel, { once: true });
    try {
      signal?.throwIfAborted();
      page.setDefaultTimeout(12_000);
      return await callback(page);
    } finally {
      signal?.removeEventListener('abort', cancel);
      await page.close().catch(() => {});
    }
  }

  async close() {
    this.closed = true;
    const promises = [...this.browsers.values()];
    this.browsers.clear();
    await Promise.allSettled(promises.map(async promise => (await promise).close()));
  }

  async fetchImage(url, signal, maxBytes = MAX_IMAGE_BYTES) {
    const requestSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(8000)]);
    const response = await fetch(imageUrl(url), { signal: requestSignal, redirect: 'error' });
    try {
      if (!response.ok) throw new Error(`Image request returned HTTP ${response.status}.`);
      const mime = (response.headers.get('content-type') || '').split(';')[0].trim();
      if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'].includes(mime)) {
        throw new Error('URL did not return a supported raster image.');
      }
      if (Number(response.headers.get('content-length')) > maxBytes) throw new Error('Image exceeds the byte limit.');
      let length = 0;
      const chunks = [];
      for await (const chunk of response.body) {
        length += chunk.length;
        if (length > maxBytes) throw new Error('Image exceeds the byte limit.');
        chunks.push(chunk);
      }
      return { bytes: Buffer.concat(chunks), mime };
    } finally {
      if (response.body && !response.body.locked) await response.body.cancel().catch(() => {});
    }
  }

  async downloadSelected(result, indices, directory, signal) {
    if (!Array.isArray(indices) || !indices.length || indices.length > 40 ||
        indices.some(i => !Number.isInteger(i) || i < 1 || i > result.count)) {
      throw new Error(`indices must contain image numbers from 1 to ${result.count}.`);
    }
    const selected = [...new Set(indices)].map(index => result.results[index - 1]);
    const folder = path.resolve(directory, result.search_id);
    await fs.mkdir(folder, { recursive: true });
    const outcomes = await mapLimit(selected, 4, async pin => {
      try {
        const image = await this.fetchImage(pin.image_url, signal);
        const extension = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/gif': 'gif', 'image/avif': 'avif' }[image.mime];
        const output = path.join(folder, `${String(pin.index).padStart(2, '0')}-${pin.id}.${extension}`);
        const temporary = `${output}.${randomUUID()}.tmp`;
        try { await fs.writeFile(temporary, image.bytes, { signal }); await fs.rename(temporary, output); }
        finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
        return { index: pin.index, id: pin.id, path: output, image_url: pin.image_url, bytes: image.bytes.length };
      } catch (error) { signal?.throwIfAborted(); return { index: pin.index, id: pin.id, error: error.message }; }
    });
    return { search_id: result.search_id, downloaded: outcomes.filter(item => !item.error), failed: outcomes.filter(item => item.error) };
  }

  async searchLive(keyword, limit, headless, signal) {
    return this.withPage(headless, signal, async page => {
      const gathered = [];
      const pending = new Set();
      await page.setViewport({ width: 1440, height: 1400 });
      await page.setRequestInterception(true);
      page.on('request', request => {
        const action = ['image', 'font', 'media'].includes(request.resourceType()) ? request.abort() : request.continue();
        void action.catch(() => {});
      });
      page.on('response', response => {
        // Observe only the search response the page itself requested; avoid recommendations / account data.
        const u = new URL(response.url());
        if (!/^\/resource\/(?:BaseSearch|Search)Resource\/get\/$/.test(u.pathname)) return;
        const task = response.json().then(data => { gathered.push(...extractPins(data?.resource_response?.data ?? data)); }).catch(() => {});
        pending.add(task); void task.finally(() => pending.delete(task));
      });
      const response = await page.goto(`https://www.pinterest.com/search/pins/?q=${encodeURIComponent(keyword)}`, {
        waitUntil: 'domcontentloaded', timeout: 20_000,
      });
      if (response && response.status() >= 400) throw new Error(`Pinterest search returned HTTP ${response.status()}.`);
      const warnings = [];
      try { await page.waitForSelector('img[src*="i.pinimg.com/"]', { timeout: 12_000, signal }); }
      catch (error) { signal?.throwIfAborted(); warnings.push('No pin images appeared before the page deadline.'); }

      let pins = [];
      let previousCount = -1;
      let stalled = 0;
      const deadline = Date.now() + 8_000;
      for (let round = 0; round < 7; round++) {
        signal?.throwIfAborted();
        await Promise.allSettled([...pending]);
        pins = uniquePins(gathered);
        // DOM fallback preserves actual srcset URLs; it never invents /originals/ paths.
        if (pins.length < limit || pins.some(pin => !pin.title)) {
          const dom = await page.evaluate(() => Array.from(document.querySelectorAll('img[src*="i.pinimg.com/"]')).flatMap(img => {
            const container = img.closest('[data-test-id="pin"]') || img.closest('[data-test-id="pinWrapper"]');
            const anchor = img.closest('a[href*="/pin/"]') || container?.querySelector('a[href*="/pin/"]');
            const pinId = anchor?.href.match(/\/pin\/(\d+)/)?.[1];
            if (!pinId) return [];
            const candidates = (img.srcset || '').split(',').map(s => s.trim().split(/\s+/)[0]).filter(Boolean);
            const original = candidates.find(url => url.includes('/originals/'));
            const best = original || candidates.at(-1) || img.src;
            return [{ id: pinId, title: img.alt && !/^(pin|unknown title)$/i.test(img.alt.trim()) ? img.alt : null, image_url: best, thumbnail_url: img.src,
              pin_url: `https://www.pinterest.com/pin/${pinId}/`, source_url: null, width: null, height: null,
              original_available: Boolean(original) }];
          }));
          for (const item of dom) {
            try { imageUrl(item.image_url); imageUrl(item.thumbnail_url); gathered.push(item); } catch { /* Ignore unexpected hosts. */ }
          }
          pins = uniquePins(gathered);
        }
        if (pins.length >= limit || Date.now() >= deadline) break;
        stalled = pins.length === previousCount ? stalled + 1 : 0;
        if (stalled >= 2) break;
        previousCount = pins.length;
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 0.8));
        await delay(550, undefined, { signal });
      }
      if (!pins.length) {
        const body = await page.evaluate(() => document.body.innerText.slice(0, 2000));
        if (/captcha|verify you are|unusual traffic/i.test(body)) throw new Error('Pinterest is asking for verification. Try later.');
        if (/log in|sign up/i.test(body)) throw new Error('Pinterest returned a login page with no usable results.');
      }
      if (pins.length < limit) warnings.push(`Pinterest exposed ${pins.length} unique images within the search deadline.`);
      return { results: pins.slice(0, limit), warnings };
    });
  }

  async contactSheet(result, signal) {
    if (!result.count) return null;
    // Bound both raster size and visual density. Larger searches retain all metadata.
    const shown = result.results.slice(0, 16);
    const previewSignal = AbortSignal.any([...(signal ? [signal] : []), AbortSignal.timeout(8000)]);
    const thumbnails = await mapLimit(shown, 6, async pin => {
      try {
        const image = await this.fetchImage(pin.thumbnail_url, previewSignal, 2 * 1024 * 1024);
        return { pin, data: `data:${image.mime};base64,${image.bytes.toString('base64')}` };
      } catch (error) { signal?.throwIfAborted(); return { pin, error: 'Preview unavailable' }; }
    });
    signal?.throwIfAborted();
    const rendered = await this.withPage(true, signal, async page => {
      const columns = Math.min(4, shown.length);
      await page.setViewport({ width: columns * 300 + 48, height: Math.ceil(shown.length / columns) * 360 + 120, deviceScaleFactor: 1 });
      await page.setContent(contactSheetHtml(result.keyword, thumbnails), { waitUntil: 'domcontentloaded' });
      const dimensions = await page.evaluate(async () => {
        await Promise.all(Array.from(document.images, img => img.decode().catch(() => {})));
        return Array.from(document.images, img => ({ index: Number(img.dataset.index), width: img.naturalWidth, height: img.naturalHeight }));
      });
      const bytes = Buffer.from(await page.screenshot({ type: 'jpeg', quality: 82, fullPage: true }));
      return { bytes, dimensions };
    });
    const sheet = {
      data: rendered.bytes.toString('base64'), mimeType: 'image/jpeg',
      shown: shown.length, bytes: rendered.bytes.length,
      failed_indices: thumbnails.filter(item => item.error).map(item => item.pin.index)
        .concat(rendered.dimensions.filter(item => !item.width).map(item => item.index)),
    };
    return sheet;
  }

  async imageInfo(url, signal) {
    const image = await this.fetchImage(url, signal);
    const dimensions = await this.withPage(true, signal, async page => {
      await page.setContent('<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:">');
      return page.evaluate(async data => {
        const img = new Image(); img.src = data; await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight };
      }, `data:${image.mime};base64,${image.bytes.toString('base64')}`);
    });
    return { image_url: imageUrl(url), mime_type: image.mime, bytes: image.bytes.length, ...dimensions };
  }
}

export function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

export function contactSheetHtml(keyword, items) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>
    *{box-sizing:border-box}body{margin:0;padding:24px;background:#f4f2ed;color:#1d2424;font-family:Arial,sans-serif}
    header{height:72px}h1{font-size:20px;font-weight:600;margin:0 0 8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
    p{font-size:12px;color:#58615e;margin:0}.grid{display:grid;grid-template-columns:repeat(${Math.min(4, items.length)},1fr);gap:16px}
    article{height:344px;overflow:hidden;background:#fff;border:1px solid #dddcd6;border-radius:8px}
    .visual{height:286px;display:flex;align-items:center;justify-content:center;background:#eae9e3;color:#68736f;font-size:13px}
    img{max-width:100%;max-height:100%;object-fit:contain}.caption{display:flex;gap:9px;align-items:flex-start;padding:10px}
    b{min-width:25px;height:25px;background:#214f43;color:white;border-radius:5px;text-align:center;line-height:25px;font-size:13px}
    span{font-size:12px;line-height:17px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
    </style></head><body><header><h1>${escapeHtml(keyword)}</h1><p>PINTEREST · ${items.length} numbered references · Full images and source links in the result manifest</p></header>
    <div class="grid">${items.map(item => `<article><div class="visual">${item.data ? `<img data-index="${item.pin.index}" src="${item.data}" alt="">` : 'Preview unavailable'}</div><div class="caption"><b>${item.pin.index}</b><span>${escapeHtml(item.pin.title || 'Title unavailable')}</span></div></article>`).join('')}</div></body></html>`;
}

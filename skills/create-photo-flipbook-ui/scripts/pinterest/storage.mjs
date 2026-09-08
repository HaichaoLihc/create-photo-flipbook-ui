import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { imageUrl } from './engine.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validateQuery(keyword, limit) {
  if (typeof keyword !== 'string' || !keyword.trim() || keyword.length > 300) throw new Error('query must contain 1–300 characters.');
  if (!Number.isInteger(limit) || limit < 1 || limit > 40) throw new Error('limit must be an integer from 1 to 40.');
  return keyword.trim().replace(/\s+/g, ' ');
}

export function validateManifest(result) {
  if (!result || result.schema_version !== 1 || result.kind !== 'pinterest-search' || !UUID.test(result.search_id)) {
    throw new Error('Expected a saved Pinterest search manifest (schema version 1).');
  }
  validateQuery(result.keyword, result.requested);
  if (!Array.isArray(result.results) || result.count !== result.results.length || result.count < 1 || result.count > result.requested) {
    throw new Error('Invalid manifest result count.');
  }
  const ids = new Set();
  for (let i = 0; i < result.count; i++) {
    const pin = result.results[i];
    if (pin.index !== i + 1 || typeof pin.id !== 'string' || !/^\d+$/.test(pin.id) || ids.has(pin.id)) {
      throw new Error('Invalid manifest pin ID or numbering.');
    }
    ids.add(pin.id);
    imageUrl(pin.image_url); imageUrl(pin.thumbnail_url);
    if (pin.pin_url !== `https://www.pinterest.com/pin/${pin.id}/`) throw new Error('Invalid manifest pin link.');
  }
  return result;
}

export async function readManifest(filename) {
  if ((await fs.stat(filename)).size > 1024 * 1024) throw new Error('Manifest exceeds 1 MB.');
  return validateManifest(JSON.parse(await fs.readFile(filename, 'utf8')));
}

export async function atomicWrite(filename, contents) {
  await fs.mkdir(path.dirname(filename), { recursive: true });
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try { await fs.writeFile(temporary, contents); await fs.rename(temporary, filename); }
  finally { await fs.rm(temporary, { force: true }).catch(() => {}); }
}

export async function searchToFiles(engine, options, signal) {
  const start = performance.now();
  const { limit = 12, output, jsonOnly = false, headless = true } = options;
  const keyword = validateQuery(options.query, limit);
  if (!output) throw new Error('output directory is required.');
  signal?.throwIfAborted();
  const live = await engine.searchLive(keyword, limit, headless, signal);
  if (!live.results.length) throw new Error('Pinterest returned no usable pins. Try a different query or try later.');
  const manifest = validateManifest({
    schema_version: 1, kind: 'pinterest-search', search_id: randomUUID(), keyword,
    requested: limit, count: live.results.length,
    results: live.results.map((pin, i) => ({ ...pin, index: i + 1 })),
    partial: live.results.length < limit, warnings: live.warnings,
    created_at: new Date().toISOString(),
  });
  const searchMs = Math.round(performance.now() - start);
  const warnings = [...(manifest.warnings || [])];
  const previewStart = performance.now();
  let sheet;
  if (!jsonOnly) {
    try {
      const rendered = await engine.contactSheet(manifest, signal);
      if (rendered) {
        const { data, ...metadata } = rendered;
        sheet = { ...metadata, buffer: Buffer.from(data, 'base64') };
      }
    } catch (error) { signal?.throwIfAborted(); warnings.push(`Contact sheet: ${error.message}`); }
  }
  if (sheet?.failed_indices.length) warnings.push(`Contact sheet: previews unavailable for indices ${sheet.failed_indices.join(', ')}.`);
  signal?.throwIfAborted();
  const folder = path.resolve(output, manifest.search_id);
  const manifestPath = path.join(folder, 'manifest.json');
  let sheetMetadata = null;
  if (sheet) {
    const { buffer, ...metadata } = sheet;
    sheetMetadata = metadata;
    await atomicWrite(path.join(folder, 'contact-sheet.jpg'), buffer);
  }
  const result = {
    ...manifest, warnings,
    contact_sheet: sheetMetadata ? { ...sheetMetadata, path: path.join(folder, 'contact-sheet.jpg') } : null,
    manifest_path: manifestPath,
    timings_ms: { search: searchMs, contact_sheet: Math.round(performance.now() - previewStart), total: Math.round(performance.now() - start) },
  };
  await atomicWrite(manifestPath, JSON.stringify(result, null, 2) + '\n');
  return result;
}

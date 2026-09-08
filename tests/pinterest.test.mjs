import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { PinterestEngine, extractPins, imageUrl, uniquePins, mapLimit, contactSheetHtml } from '../skills/create-photo-flipbook-ui/scripts/pinterest/engine.mjs';
import { searchToFiles, readManifest } from '../skills/create-photo-flipbook-ui/scripts/pinterest/storage.mjs';
import { parseCommand } from '../skills/create-photo-flipbook-ui/scripts/pinterest/cli.mjs';

const cli = fileURLToPath(new URL('../skills/create-photo-flipbook-ui/scripts/pinterest/cli.mjs', import.meta.url));
const jpeg = Buffer.from([255, 216, 255, 217]);
const pin = (id = '123', image = 'aaa') => extractPins({ id, title: 'A reference', images: {
  orig: { url: `https://i.pinimg.com/originals/${image}.png`, width: 1080, height: 1350 },
  '474x': { url: `https://i.pinimg.com/474x/${image}.jpg`, width: 474, height: 593 },
}, link: 'https://example.com/book' })[0];
const engine = (pins = [pin()]) => ({
  searches: 0, previews: 0,
  async searchLive() { this.searches++; return { results: pins, warnings: [] }; },
  async contactSheet(result) { this.previews++; return { data: jpeg.toString('base64'), bytes: jpeg.length, mimeType: 'image/jpeg', shown: result.count, failed_indices: [] }; },
});
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'pinterest-skill-test-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return { root, query: 'photo book', limit: 2, output: path.join(root, 'out') };
}

test('metadata preserves original PNG URLs and deduplicates references without inventing titles', () => {
  const first = pin(); first.title = null;
  const merged = uniquePins([first, pin(), pin('456')]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].title, 'A reference');
  assert.match(merged[0].image_url, /originals\/aaa\.png$/);
  assert.equal(merged[0].width, 1080);
});

test('image URLs reject other hosts, credentials, redirects by URL, and non-HTTPS schemes', () => {
  for (const value of ['https://example.com/a.png', 'file:///tmp/image', 'http://i.pinimg.com/a.png', 'https://user@i.pinimg.com/a.png', 'https://i.pinimg.com:123/a.png']) assert.throws(() => imageUrl(value));
  assert.equal(imageUrl('https://i.pinimg.com/originals/a.png'), 'https://i.pinimg.com/originals/a.png');
});

test('each repeated query fetches current results and preserves earlier output', async t => {
  const options = await temporary(t), client = engine();
  const a = await searchToFiles(client, options);
  client.searchLive = async () => { client.searches++; return { results: [pin('456', 'bbb')], warnings: [] }; };
  const b = await searchToFiles(client, options);
  assert.equal(client.searches, 2); assert.equal(client.previews, 2);
  assert.notEqual(a.search_id, b.search_id);
  assert.notEqual(a.manifest_path, b.manifest_path);
  assert.equal((await readManifest(a.manifest_path)).results[0].id, '123');
  assert.equal((await readManifest(b.manifest_path)).results[0].id, '456');
  assert.deepEqual(await fs.readFile(a.contact_sheet.path), jpeg);
  assert.deepEqual(await fs.readFile(b.contact_sheet.path), jpeg);
  assert.deepEqual(await fs.readdir(options.root), ['out']);
  assert.equal(Object.hasOwn(b, 'cache_hit'), false);
  assert.equal(Object.hasOwn(b, 'cache_expires_at'), false);
});

test('json-only searches write a usable manifest without generating a preview', async t => {
  const options = await temporary(t), client = engine();
  const result = await searchToFiles(client, { ...options, jsonOnly: true });
  assert.equal(client.searches, 1); assert.equal(client.previews, 0);
  assert.equal(result.contact_sheet, null);
  assert.deepEqual(await fs.readdir(path.dirname(result.manifest_path)), ['manifest.json']);
  assert.equal((await readManifest(result.manifest_path)).results[0].id, '123');
});

test('failed previews keep usable metadata and report the failure', async t => {
  const options = await temporary(t), client = engine();
  client.contactSheet = async () => { throw new Error('preview failure'); };
  const result = await searchToFiles(client, options);
  assert.equal(result.contact_sheet, null);
  assert.match(result.warnings.join(), /preview failure/);
  assert.equal((await readManifest(result.manifest_path)).count, 1);
});

test('empty searches and invalid limits do not create successful manifests', async t => {
  const options = await temporary(t), client = engine([]);
  await assert.rejects(searchToFiles(client, options), /no usable pins/);
  for (const limit of [0, 41, 1.5, NaN]) await assert.rejects(searchToFiles(client, { ...options, limit }), /limit/);
  assert.equal(client.searches, 1);
  await assert.rejects(fs.stat(options.output), { code: 'ENOENT' });
});

test('old saved manifests still support downloads with partial failures and actual MIME extensions', async t => {
  const options = await temporary(t);
  const result = await searchToFiles(engine([pin(), pin('456', 'bbb')]), options);
  const saved = JSON.parse(await fs.readFile(result.manifest_path));
  saved.cache_expires_at = '1990-01-01T00:00:00Z';
  await fs.writeFile(result.manifest_path, JSON.stringify(saved));
  const client = new PinterestEngine(); t.after(() => client.close());
  client.fetchImage = async url => {
    if (url.includes('aaa')) throw new Error('HTTP 404');
    return { mime: 'image/png', bytes: Buffer.from('png fixture') };
  };
  const selection = await client.downloadSelected(await readManifest(result.manifest_path), [2, 1, 2], path.join(options.root, 'selected'));
  assert.equal(selection.downloaded.length, 1); assert.equal(selection.failed[0].index, 1);
  assert.match(selection.downloaded[0].path, /02-456\.png$/);
  assert.equal(await fs.readFile(selection.downloaded[0].path, 'utf8'), 'png fixture');
  assert.equal((await fs.readdir(path.dirname(selection.downloaded[0].path))).length, 1);
});

test('tampered manifest numbering and IDs are rejected before download', async t => {
  const options = await temporary(t), result = await searchToFiles(engine(), options);
  for (const patch of [{ index: 2 }, { id: '../escape' }, { image_url: 'https://example.com/private' }]) {
    const bad = structuredClone(result); Object.assign(bad.results[0], patch);
    await fs.writeFile(result.manifest_path, JSON.stringify(bad));
    await assert.rejects(readManifest(result.manifest_path));
  }
});

test('streamed image downloads enforce byte and MIME limits', async t => {
  const client = new PinterestEngine(); t.after(() => client.close());
  const original = globalThis.fetch; t.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => new Response(new Uint8Array(5), { headers: { 'content-type': 'image/png' } });
  await assert.rejects(client.fetchImage('https://i.pinimg.com/a.png', undefined, 4), /byte limit/);
  globalThis.fetch = async () => new Response('oops', { headers: { 'content-type': 'text/html' } });
  await assert.rejects(client.fetchImage('https://i.pinimg.com/a.png'), /raster image/);
});

test('CLI rejects misspelled flags and exposes help without requiring a browser', () => {
  assert.throws(() => parseCommand(['search', '--limti', '4']));
  assert.throws(() => parseCommand(['search', '--fresh']));
  assert.throws(() => parseCommand(['search', '--cache-dir', '/tmp/unused']));
  const run = spawnSync(process.execPath, [cli, '--help'], { encoding: 'utf8' });
  assert.equal(run.status, 0); assert.match(run.stdout, /No MCP setup/);
});

test('parallel fetches are bounded and keep reference order', async () => {
  let active = 0, peak = 0;
  const result = await mapLimit([25, 5, 15, 1], 2, async (ms, index) => {
    peak = Math.max(peak, ++active);
    await new Promise(resolve => setTimeout(resolve, ms)); active--; return index;
  });
  assert.equal(peak, 2); assert.deepEqual(result, [0, 1, 2, 3]);
});

test('contact-sheet labels escape reference text', () => {
  const html = contactSheetHtml('<script>query</script>', [{ pin: { index: 1, title: '<img onerror=alert(1)>' }, error: 'unavailable' }]);
  assert.doesNotMatch(html, /<script>|<img onerror/);
  assert.match(html, /&lt;script&gt;/);
});

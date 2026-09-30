import { readFile, access } from 'node:fs/promises';
import { validateCatalog } from '../dist/js/catalog.js';

const root = new URL('../dist/', import.meta.url);
const read = async name => JSON.parse(await readFile(new URL(name, root), 'utf8'));
try {
  const { photos, authored } = validateCatalog(await read('photos.json'), await read('stories.json'));
  await Promise.all(photos.map(async p => {
    try { await access(new URL(p.src, root)); }
    catch { throw new Error(`Missing local photo: ${p.src}`); }
  }));
  console.log(`Valid: ${photos.length} local photos, ${authored.length} authored stories.`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

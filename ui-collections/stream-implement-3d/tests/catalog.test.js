import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCatalog } from '../dist/js/catalog.js';
import { buildStories, NF } from '../dist/js/stories.js';

const photo = id => ({ id, src: `assets/photos/${id}.jpg` });
const story = (changes = {}) => ({ id: 'summer', title: 'Summer', chapters: [{ photo: 'a' }], ...changes });
const validate = (photos, stories = [], journal = []) => validateCatalog({ photos }, { stories, journal });

test('a single photo can fill the curtain without empty chapters or invalid colors', () => {
  const { photos, authored, journal } = validate([photo('a')]);
  photos[0].aspect = 1.5;
  const result = buildStories(photos, authored, journal);
  assert.equal(result.length, NF);
  assert.equal(new Set(result.map(s => s.id)).size, NF);
  for (const s of result) {
    assert.equal(s.chapters.length, 1);
    assert.equal(s.chapters[0].src, 'assets/photos/a.jpg');
    assert.ok(s.col.every(Number.isFinite));
  }
});

test('authored order and text win; shared journal fills missing entries', () => {
  const data = validate([photo('a'), photo('b')], [story({ line: 20, chapters: [
    { photo: 'b', text: 'My words', date: '' }, { photo: 'a' },
  ] })], [{ date: 'Day 1', text: 'Start' }, { date: 'Day 2', text: 'End' }]);
  data.photos.forEach(p => { p.aspect = 1; });
  const result = buildStories(data.photos, data.authored, data.journal);
  assert.deepEqual(result[20].chapters.map(c => c.photo), ['b', 'a']);
  assert.equal(result[20].chapters[0].text, 'My words');
  assert.equal(result[20].chapters[0].date, '');
  assert.equal(result[20].chapters[1].text, 'End');
  assert.deepEqual(result, buildStories(data.photos, data.authored, data.journal));
});

test('rejects empty catalogs, duplicate IDs and paths outside the photo folder', () => {
  assert.throws(() => validate([]), /at least one/);
  assert.throws(() => validate([photo('a'), photo('a')]), /duplicate/);
  assert.throws(() => validate([{ ...photo('a'), src: 'assets/photos/../../secret' }]), /local path/);
});

test('rejects missing photos and unsupported chapter counts instead of silently dropping them', () => {
  assert.throws(() => validate([photo('a')], [story({ chapters: [{ photo: 'missing' }] })]), /unknown photo/);
  assert.throws(() => validate([photo('a')], [story({ chapters: [] })]), /1–8/);
  assert.throws(() => validate([photo('a')], [story({ chapters: Array(9).fill({ photo: 'a' }) })]), /1–8/);
});

test('rejects duplicate story IDs, reserved IDs and colliding or invalid lines', () => {
  assert.throws(() => validate([photo('a')], [story(), story()]), /duplicate story/);
  assert.throws(() => validate([photo('a')], [story({ id: 'line-1' })]), /reserved/);
  assert.throws(() => validate([photo('a')], [story({ line: NF })]), /invalid/);
  assert.throws(() => validate([photo('a')], [story({ line: 0 }), story({ id: 'winter', line: 0 })]), /occupied/);
});

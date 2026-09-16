import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { runInNewContext } from 'node:vm';
import { index } from './test-fixture.mjs';

const source = await readFile(new URL('./archive-search.js', import.meta.url), 'utf8');
const select = runInNewContext(`${source}\nselectSearchPhotos`);
const plain = value => JSON.parse(JSON.stringify(value));

test('selected photos follow their exact physical order, including within a sleeve', () => {
  const order = new Map([['b',0],['c',1],['d',2],['a',3]]);
  const photos = [{id:'c',score:.6},{id:'a',score:.95},{id:'b',score:.8},{id:'d',score:.9}];
  assert.deepEqual(plain(select(photos, order)).map(photo=>photo.id), ['b','c','d','a']);
  assert.equal(photos[0].id, 'c');
});

test('the client preserves every photo in a batch without a hidden top-50 cap', () => {
  const photos = Array.from({length:70}, (_,i)=>({id:String(i),score:i/100}));
  const order = new Map(photos.map((photo,i)=>[photo.id,i]));
  const result = plain(select(photos,order));
  assert.equal(result.length,70);
  assert.deepEqual(result.map(photo=>Number(photo.id)), Array.from({length:70}, (_,i)=>i));
});

test('duplicates and invalid or absent photos do not consume result slots', () => {
  const photos = [{id:'a',score:.5},{id:'a',score:.9},{id:'missing',score:1},{id:'b',score:NaN},null];
  assert.deepEqual(plain(select(photos, new Map([['a',0],['b',1]]))), [{id:'a',score:.9}]);
  const many = Array.from({length:60},(_,i)=>({id:String(i),score:.8}));
  const order = new Map(many.map((photo,i)=>[photo.id,i]));
  assert.equal(select([...many,...many],order).length,60);
});

test('equal scores are deterministic and ordering follows original strip exchanges', () => {
  const photos = [{id:'b',score:.8},{id:'a',score:.8}];
  assert.deepEqual(plain(select(photos,new Map([['a',0],['b',1]]))).map(photo=>photo.id), ['a','b']);
  assert.deepEqual(plain(select(photos,new Map([['b',0],['a',1]]))).map(photo=>photo.id), ['b','a']);
});

test('results reuse the book with reversible temporary leaves and cancellable motion', () => {
  assert.match(index, /archive-search\.js/);
  assert.match(index, /archive-search\.css/);
  assert.doesNotMatch(source, /archive-workspace|showModal|localStorage\.setItem/);
  assert.match(source, /pageFlip\.updateFromHtml\(leaves\)/);
  assert.match(source, /this\.mount\(\[\.\.\.pages\], true/);
  assert.match(source, /offset=\$\{index \* 35\}&limit=35/);
  assert.match(source, /this\.frames\.get\(photos\[column\]\.id\)\.cloneNode\(true\)/);
  assert.match(source, /animation\.cancel\(\)/);
  assert.match(source, /ticket !== this\.generation/);
  assert.match(source, /prefers-reduced-motion/);
  assert.match(source, /is-search-match/);
});

test('spread navigation advances past both visible sleeves and reverses one spread', () => {
  const move = runInNewContext(`${source}\nArchiveSearch.prototype.move`);
  for (const [visible, direction, expected] of [[[0],1,1], [[1,2],1,3], [[3,4],-1,2], [[1,2],-1,0], [[5],1,6]]) {
    let target;
    move.call({visibleIndices:()=>visible,go:index=>{target=index;}}, direction);
    assert.equal(target,expected);
  }
});

test('pagination preserves native leaves, cancels requests, and exposes retry', () => {
  assert.match(source, /leaf\.querySelector\('\.sleeve'\)\.replaceWith/);
  assert.match(source, /this\.pageRequests\.values\(\)\) request\.abort\(\)/);
  assert.match(source, /this\.batches\.has\(index\)/);
  assert.match(source, /this\.errors\.has\(index\)/);
  assert.match(source, /retry-search/);
  assert.match(source, /visible\.at\(-1\) \+ ahead/);
});

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { wrap, relative, pose } = require('../layout.js');
const records = require('../placeholders.json');
const views = ['flat', 'tilt', 'ring', 'gallery'];

test('Every photo is reachable across positive and negative loops, with a bounded display window', () => {
  assert.equal(records.length, 48);
  assert.equal(new Set(records.map(photo => photo.id)).size, 48);
  for (const width of [390, 1044]) {
    for (let progress = -97; progress <= 97; progress += 0.25) {
      let visible = 0;
      for (let i = 0; i < 48; i++) {
        if (pose('flat', relative(i, progress, 48), width, 850).opacity > 0) visible++;
      }
      assert(visible >= (width < 560 ? 11 : 17));
      assert(visible <= (width < 560 ? 12 : 18));
      const current = wrap(Math.round(progress), 48);
      assert(Math.abs(relative(current, progress, 48)) <= 0.5);
    }
  }
});

test('Four distinct layouts stay finite, and both circles fit narrow and wide screens', () => {
  for (const [width, height] of [[320, 450], [390, 650], [844, 230], [1044, 900], [1728, 1100]]) {
    const signatures = new Set();
    for (const view of views) {
      signatures.add(JSON.stringify([0, 2, 4].map(i => pose(view, i, width, height))));
      for (let d = -9; d <= 9; d += 0.1) {
        const p = pose(view, d, width, height);
        Object.values(p).forEach(value => assert(Number.isFinite(value)));
        assert(p.size > 0);
        assert(p.opacity >= 0 && p.opacity <= 1);
        if (p.opacity > 0 && ['flat', 'ring'].includes(view)) {
          assert(Math.abs(p.x) + p.size / 2 <= width / 2, `${view} clips horizontally at ${width}`);
          assert(Math.abs(p.y) + p.size * 2 / 3 <= height / 2, `${view} clips vertically at ${height}`);
        }
      }
    }
    assert.equal(signatures.size, 4);
  }
});

function harness(reduce = false) {
  const listeners = {};
  class Element {
    constructor(data = {}) { this.isButton = !!data.view; this.dataset = data; this.style = {}; this.attributes = {}; this.events = {}; this.classList = { add() {} }; }
    addEventListener(name, handler) { this.events[name] = handler; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    getBoundingClientRect() { return {width:1044,height:1040,top:995,bottom:60}; }
    setPointerCapture() { this.captured = true; }
    hasPointerCapture() { return this.captured; }
    releasePointerCapture() { this.captured = false; }
    closest(selector) { return selector === '.views' && this.isButton ? this : null; }
    focus() { this.focused = true; }
  }
  const stage = new Element(), orbit = new Element(), counter = new Element();
  const cards = records.map(record => new Element({ ...record.mock_metadata }));
  const buttons = views.map(view => new Element({view}));
  const captionCategory = new Element(), captionPlace = new Element(), captionPeriod = new Element();
  const general = new Element();
  const queue = [];
  let time = 0;
  const context = {
    window: {LifeRingLayout:{wrap,relative,pose}, matchMedia:()=>({matches:reduce,addEventListener(){}}),addEventListener(){}},
    document: {
      getElementById:id=>id==='collection'?stage:orbit,
      querySelectorAll:selector=>selector==='.work'?cards:buttons,
      querySelector:selector=>({'.counter':counter,'.caption-category':captionCategory,'.caption-place':captionPlace,'.caption-period':captionPeriod}[selector] || general),
      addEventListener:(name,handler)=>listeners[name]=handler,
    },
    requestAnimationFrame:handler=>{queue.push(handler);return queue.length;},
  };
  vm.runInNewContext(fs.readFileSync(require.resolve('../app.js'),'utf8'),context);
  function settle() {
    let frames=0;
    while(queue.length && frames++<500)queue.shift()(time+=16.67);
    assert.equal(queue.length,0,'animation must settle without a permanent frame loop');
  }
  function event(values={}) { return {preventDefault(){},target:stage,...values}; }
  settle();
  return {stage,cards,buttons,counter,captionCategory,captionPlace,captionPeriod,settle,event,listeners};
}

test('View buttons preserve photo position; wheel, keyboard, and touch traverse and reset the collection', () => {
  const h = harness();
  for(let i=0;i<23;i++)h.listeners.keydown(h.event({key:'ArrowRight'}));
  h.settle(); assert.equal(h.counter.textContent,'24 — 48');
  assert.equal(h.captionCategory.textContent,records[23].mock_metadata.category);
  assert.equal(h.captionPlace.textContent,records[23].mock_metadata.place);
  assert.equal(h.captionPeriod.textContent,records[23].mock_metadata.period);
  const transforms = new Set();
  for(const button of h.buttons){
    button.events.click(); h.settle();
    assert.equal(h.counter.textContent,'24 — 48');
    assert.equal(h.captionPlace.textContent,records[23].mock_metadata.place);
    assert.equal(h.buttons.filter(b=>b.attributes['aria-pressed']==='true').length,1);
    transforms.add(h.cards[23].style.transform);
  }
  assert.equal(transforms.size,4);
  h.stage.events.wheel(h.event({deltaMode:0,deltaX:0,deltaY:180}));h.settle();
  assert.equal(h.counter.textContent,'25 — 48');
  assert.equal(h.captionCategory.textContent,records[24].mock_metadata.category);
  assert.equal(h.captionPlace.textContent,records[24].mock_metadata.place);
  h.stage.events.pointerdown(h.event({button:0,pointerId:1,clientX:400,clientY:400}));
  h.stage.events.pointermove(h.event({pointerId:1,clientX:100,clientY:400,pointerType:'touch'}));
  h.stage.events.pointerup(h.event({pointerId:1}));h.settle();
  assert.notEqual(h.counter.textContent,'25 — 48');
  assert.equal(h.stage.captured,false);
  h.listeners.keydown(h.event({key:'Home'}));h.settle();
  assert.equal(h.counter.textContent,'01 — 48');
  assert.equal(h.captionCategory.textContent,records[0].mock_metadata.category);
  assert.equal(h.captionPlace.textContent,records[0].mock_metadata.place);
  assert.equal(h.captionPeriod.textContent,records[0].mock_metadata.period);
  h.cards.filter(card=>card.style.visibility==='visible').forEach(card=>assert(!/NaN|Infinity/.test(card.style.transform)));
});

test('Reduced motion settles immediately and keyboard view navigation selects a real view', () => {
  const h=harness(true);
  h.listeners.keydown(h.event({key:'ArrowRight',target:h.buttons[0]}));h.settle();
  assert.equal(h.stage.dataset.view,'tilt');
  assert(h.buttons[1].focused);
  assert.equal(h.counter.textContent,'01 — 48');
  h.listeners.keydown(h.event({key:'ArrowLeft'}));h.settle();
  assert.equal(h.counter.textContent,'48 — 48');
  assert.equal(h.captionCategory.textContent,records[47].mock_metadata.category);
  assert.equal(h.captionPlace.textContent,records[47].mock_metadata.place);
});

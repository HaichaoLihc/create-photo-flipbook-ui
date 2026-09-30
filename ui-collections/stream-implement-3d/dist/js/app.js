// Undertow — a waterfall of light in which every thread is a life.
//
// A curtain of 2,400 optical fibres hangs in the dark. Each fibre is one story, and its
// photographs flow down it as a stream. Far away the fibres are a curtain of blue light;
// closer, each thread takes its story's colour; closer still, the threads become a mosaic of
// tiny moving pictures, and finally single photographs drifting down one line. Point at a
// thread to lift it out of the curtain; touch it to open its story.
//
// The streams cost nothing extra: the fibre fragment shader works out which photograph of
// which story sits at each point of each fibre. Everything is drawn additively into a
// half-float buffer, with a mirrored, blurred copy for the floor, a mip-chain bloom, and a
// final tone-mapping pass.

import { StoryView } from './story.js';
import { clamp, smooth, damp, mulberry } from './math.js';
import { createGLHelpers } from './gl.js';
import { loadCatalog } from './catalog.js';
import { loadTextures } from './photos.js';
import { buildStories, NF } from './stories.js';
import { IDLE, FIBRE_VS, FIBRE_FS, FLOOR_VS, FLOOR_FS, POST_VS, DOWN_FS, UP_FS, BLUR_FS, COMPOSITE_FS } from './shaders.js';

const canvas = document.getElementById('stream');
const CAPTURE = new URLSearchParams(location.search).has('capture');
const gl = canvas.getContext('webgl2', { antialias: false, alpha: false, depth: false, stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: CAPTURE });
const body = document.body;
const $ = s => document.querySelector(s);
const $loader = $('#loader i'), $meter = $('#meter'), $cursor = $('#cursor'), $announce = $('#announce');

const SEG = 64;           // segments per fibre
const CH = 15;            // height of the bar the curtain hangs from
const YB = 1.05;          // height where fibres start to bend onto the floor
const F = 1.6;            // focal length (NDC)
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;

const rng = mulberry(0x2545f491);

// ────────────────────────────────────────────────────────────── state

let W = innerWidth, H = innerHeight, DPR = Math.min(devicePixelRatio || 1, 2), PW = 1, PH = 1;
let CW = 18, SPACING = CW / NF, PHOTO_W = 0.8 * SPACING, SLOT = 1.9 * PHOTO_W;
let stories = [], photos = [];
const fib = {
  x0: new Float32Array(NF), seed: new Float32Array(NF), speed: new Float32Array(NF),
  o: new Float32Array(NF), v: new Float32Array(NF), py: new Float32Array(NF).fill(CH * 0.5), phase: new Float64Array(NF),
  flow: new Float64Array(NF), hold: new Float32Array(NF),   // hold: 1 while a thread is being looked at
};
const P = {}, T = {}, vaos = {};
let RT = null, arrTex = null;
let program, dataTexture, updateTexture, target, freeTarget;

const cam = { x: 0, y: 0, ls: 0, lsT: 0, vx: 0, vy: 0 };
let anchor = null, motion = 1;
const pointer = { x: -1, y: -1, inside: false, speed: 0, reach: 0, wvx: 0, lastX: -1 };
const hover = { line: -1, t: 0 };
let kbLine = -1;
const select = { line: -1, t: 0, target: 0 };
const pluck = { line: -1, age: 99, amp: 0 };
const idle = Array.from({ length: IDLE }, () => ({ line: -1, age: 99 }));
let idleNext = 2.5;
let flow = 1, paused = false, time = 0, intro = 0, lastInput = 0;
let sleeping = false, last = performance.now(), zoomUntil = 0;
let drag = null, pinch = null;
const touches = new Map();
let view = null, lsBeforeStory = null;

const FRAME_TOP = CH + 2.4, FRAME_BOTTOM = -4.6;
const HOME_Y = (FRAME_TOP + FRAME_BOTTOM) / 2;
const fitScale = () => Math.min(H / (FRAME_TOP - FRAME_BOTTOM), W / (CW + 3.4));
const LS_MIN = () => Math.log(fitScale() * 0.94);
const LS_MAX = () => Math.log(Math.min(W, H) * 0.55 / PHOTO_W);
const camDist = () => F * H / (2 * Math.exp(cam.ls));
const zoomT = () => clamp((cam.ls - LS_MIN()) / (LS_MAX() - LS_MIN()), 0, 1);

function unproject(sx, sy) {
  const d = camDist();
  return { x: cam.x + (sx / W * 2 - 1) * (W / H) * d / F, y: cam.y + (1 - sy / H * 2) * d / F };
}
function project(x, y) {
  const d = camDist();
  return { x: ((x - cam.x) * F / d / (W / H) + 1) / 2 * W, y: (1 - (y - cam.y) * F / d) / 2 * H };
}

// ────────────────────────────────────────────────────────────── world

function buildFibres() {
  CW = clamp(CH * (W / H) * 0.8, 8.5, 22);
  SPACING = CW / NF; PHOTO_W = 0.8 * SPACING; SLOT = 1.9 * PHOTO_W;
  const rows = Math.ceil(NF / 1024), fs = new Float32Array(1024 * rows * 4);
  for (let i = 0; i < NF; i++) {
    fib.x0[i] = -CW / 2 + (i + 0.5 + (rng() - 0.5) * 0.2) * SPACING;
    fib.seed[i] = rng(); fib.speed[i] = 0.8 + rng() * 0.45; fib.phase[i] = rng() * 50 * SLOT;
    fs.set([fib.x0[i], fib.seed[i], fib.speed[i], rng()], i * 4);
  }
  T.fibS = dataTexture(1024, rows, fs);
  T.fibD = dataTexture(1024, rows, new Float32Array(1024 * rows * 4));
}

function uploadStories() {
  const data = new Float32Array(1024 * Math.ceil(NF * 3 / 1024) * 4);
  stories.forEach((s, i) => {
    const L = s.chapters.map(c => c.layer);
    data.set([s.chapters.length, ...s.col], i * 12);
    data.set([L[0] ?? 0, L[1] ?? 0, L[2] ?? 0, L[3] ?? 0, L[4] ?? 0, L[5] ?? 0, L[6] ?? 0, L[7] ?? 0], i * 12 + 4);
  });
  T.story = dataTexture(1024, Math.ceil(NF * 3 / 1024), data);
  T.layers = dataTexture(photos.length, 1, new Float32Array(photos.flatMap(p => [p.aspect, 0, 0, 0])));
}

function disp(i, y) { // mirrors disp() in the shaders, for picking threads
  const x0 = fib.x0[i];
  const hang = clamp((CH - y) / CH, 0, 1), anchorF = smooth(0, 0.18, hang);
  const wind = (Math.sin(time * 0.55 + x0 * 0.9 + y * 0.21) * 0.035 + Math.sin(time * 0.31 - x0 * 0.37 + y * 0.07) * 0.05) * hang * motion * (i === hover.line ? 1 - hover.t : 1);
  const d = (y - fib.py[i]) / motion;
  const push = fib.o[i] * Math.exp(-d * d / (d > 0 ? 3 : 10));
  let pl = 0;
  if (i === pluck.line) {
    const dist = (CH - y) / motion, front = pluck.age * 10;
    pl = pluck.amp * Math.exp(-pluck.age * 1.4) * Math.sin(dist * 2.2 - pluck.age * 14) * smooth(front + 0.1, front - 2.5, dist);
  }
  return (wind + push + pl) * anchorF;
}
// The thread nearest a point on screen, with a little stickiness so hovering feels calm.
function pickLine(sx, sy) {
  const p = unproject(sx, sy);
  if (p.y < -0.4 || p.y > CH + 0.25 || Math.abs(p.x) > CW / 2 + 1.4) return -1;
  const y = clamp(p.y, YB, CH), scale = Math.exp(cam.ls);
  const tol = Math.max(10 / scale, SPACING * 0.6);
  const est = Math.round((p.x + CW / 2) / SPACING - 0.5), K = Math.min(80, Math.ceil(tol / SPACING) + 3);
  let best = -1, bd = Infinity;
  for (let k = Math.max(0, est - K); k <= Math.min(NF - 1, est + K); k++) {
    const d = Math.abs(fib.x0[k] + disp(k, y) - p.x);
    if (d < bd) { bd = d; best = k; }
  }
  if (bd > tol) return -1;
  if (hover.line >= 0 && hover.line !== best && Math.abs(hover.line - best) < K) {
    const dh = Math.abs(fib.x0[hover.line] + disp(hover.line, y) - p.x);
    if (dh < bd + 2.5 / scale) return hover.line;
  }
  return best;
}
// Which moment of a thread's story sits at height y (only meaningful once photographs are visible).
function chapterAt(i, y) {
  const n = stories[i].chapters.length, slot = Math.floor(((CH - y) - fib.phase[i]) / SLOT);
  return ((slot % n) + n) % n;
}

// ────────────────────────────────────────────────────────────── stories

function openStory(i, { chapter = null, x = null } = {}) {
  if (i < 0 || view.isOpen) return;
  const sx = x ?? project(fib.x0[i], CH * 0.5).x;
  pluck.line = i; pluck.age = 0; pluck.amp = 0.12 * motion;
  view.open(i, { chapter, x: clamp(sx, 0, W) });
}
function onStoryShow(i) {
  select.line = i; select.target = 1;
  if (lsBeforeStory == null) lsBeforeStory = cam.lsT;
  hideLabel();
}
function onStoryCovered() { sleeping = true; }
function onStoryHide() {
  sleeping = false; last = performance.now();
  select.target = 0;
  if (lsBeforeStory != null) { cam.lsT = lsBeforeStory; lsBeforeStory = null; }
  canvas.focus({ preventScroll: true });
}

// ────────────────────────────────────────────────────────────── input

function markInput() { lastInput = performance.now(); }
function showMeter() { zoomUntil = performance.now() + 1100; }
function zoomBy(delta, sx, sy) {
  const p = unproject(sx, sy);
  anchor = { wx: p.x, wy: p.y, sx, sy };
  cam.lsT = clamp(cam.lsT + delta, LS_MIN(), LS_MAX());
  showMeter();
}
function hideLabel() { body.classList.remove('over-line'); }
function announce(i) { const s = stories[i]; $announce.textContent = `${s.title}. ${s.chapters.length} moments. Press Enter to open.`; }

canvas.addEventListener('wheel', e => {
  e.preventDefault(); markInput();
  if (view?.isOpen) return;
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? H : 1;
  zoomBy(-e.deltaY * unit * (e.ctrlKey ? 0.014 : 0.003), e.clientX, e.clientY);
}, { passive: false });

canvas.addEventListener('pointerdown', e => {
  if (!view) return;
  canvas.setPointerCapture(e.pointerId); markInput();
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (touches.size === 2) {
    const [a, b] = [...touches.values()];
    pinch = { dist: Math.hypot(a.x - b.x, a.y - b.y), ls: cam.lsT }; drag = null;
    return;
  }
  const p = unproject(e.clientX, e.clientY);
  drag = { sx: e.clientX, sy: e.clientY, t: performance.now(), moved: false, wx: p.x, wy: p.y, touch: e.pointerType !== 'mouse' };
  cam.vx = cam.vy = 0;
});
canvas.addEventListener('pointermove', e => {
  pointer.x = e.clientX; pointer.y = e.clientY; pointer.inside = true;
  body.classList.add('pointer');
  $cursor.style.transform = `translate3d(${e.clientX}px,${e.clientY}px,0)`;
  kbLine = -1;
  if (!touches.has(e.pointerId)) return;
  touches.set(e.pointerId, { x: e.clientX, y: e.clientY });
  markInput();
  if (pinch && touches.size === 2) {
    const [a, b] = [...touches.values()];
    const target = clamp(pinch.ls + Math.log(Math.hypot(a.x - b.x, a.y - b.y) / pinch.dist), LS_MIN(), LS_MAX());
    zoomBy(target - cam.lsT, (a.x + b.x) / 2, (a.y + b.y) / 2);
    return;
  }
  if (!drag) return;
  if (!drag.moved && Math.hypot(e.clientX - drag.sx, e.clientY - drag.sy) > 6) { drag.moved = true; body.classList.add('dragging'); }
  if (drag.moved) anchor = { wx: drag.wx, wy: drag.wy, sx: e.clientX, sy: e.clientY, drag: true };
});
function endPointer(e) {
  touches.delete(e.pointerId);
  if (touches.size < 2) pinch = null;
  body.classList.remove('dragging');
  if (!drag) return;
  const d = drag; drag = null;
  if (d.moved) { anchor = null; return; }
  if (e.type === 'pointercancel' || performance.now() - d.t > 600 || view.isOpen) return;
  const i = pickLine(e.clientX, e.clientY);
  if (i < 0) return;
  // A tap on a touch screen first lifts the thread out; a second tap on it opens the story.
  if (d.touch && hover.line !== i) { kbLine = i; announce(i); return; }
  const p = unproject(e.clientX, e.clientY);
  const readable = SLOT * Math.exp(cam.ls) > 40 && p.y > YB && p.y < CH;
  openStory(i, { chapter: readable ? chapterAt(i, p.y) : null, x: e.clientX });
}
canvas.addEventListener('pointerup', endPointer);
canvas.addEventListener('pointercancel', endPointer);
canvas.addEventListener('pointerleave', () => { pointer.inside = false; body.classList.remove('pointer'); });
canvas.addEventListener('contextmenu', e => e.preventDefault());

addEventListener('keydown', e => {
  if (!view || view.isOpen) return;
  markInput();
  const k = e.key;
  if (k === 'ArrowRight' || k === 'ArrowLeft') {
    e.preventDefault();
    const from = kbLine >= 0 ? kbLine : hover.line >= 0 ? hover.line : clamp(Math.round((unproject(W / 2, H / 2).x + CW / 2) / SPACING), 0, NF - 1);
    kbLine = clamp(from + (k === 'ArrowRight' ? 1 : -1) * (e.shiftKey ? 25 : 1), 0, NF - 1);
    announce(kbLine);
  } else if (k === 'Enter' && (kbLine >= 0 || hover.line >= 0)) {
    openStory(kbLine >= 0 ? kbLine : hover.line);
  } else if (k === '+' || k === '=') zoomBy(0.7, W / 2, H / 2);
  else if (k === '-' || k === '_') zoomBy(-0.7, W / 2, H / 2);
  else if (k === 'Escape') { anchor = null; cam.lsT = LS_MIN(); kbLine = -1; showMeter(); }
  else if (k === ' ') { e.preventDefault(); paused = !paused; }
});

function resize() {
  W = innerWidth; H = innerHeight; DPR = Math.min(devicePixelRatio || 1, 2);
  PW = Math.round(W * DPR); PH = Math.round(H * DPR);
  canvas.width = PW; canvas.height = PH;
  if (RT) { freeTarget(RT.scene); RT.refl.forEach(freeTarget); RT.bloom.forEach(freeTarget); }
  RT = {
    scene: target(PW, PH),
    refl: [target(PW / 2, PH / 2), target(PW / 2, PH / 2)],
    bloom: Array.from({ length: 6 }, (_, i) => target(PW / 2 ** (i + 1), PH / 2 ** (i + 1))),
  };
  if (stories.length) cam.lsT = clamp(cam.lsT, LS_MIN(), LS_MAX());
}
addEventListener('resize', () => { if (RT) resize(); });

// ────────────────────────────────────────────────────────────── frame

function step(dt, now) {
  intro += dt; time += dt;
  const lsMin = LS_MIN(), lsMax = LS_MAX();
  cam.lsT = clamp(cam.lsT, lsMin, lsMax);
  cam.ls = damp(cam.ls, cam.lsT, 5.5, dt);
  if (anchor) {
    const p = unproject(anchor.sx, anchor.sy);
    const ox = anchor.wx - p.x, oy = anchor.wy - p.y;
    cam.x += ox; cam.y += oy;
    if (anchor.drag) { cam.vx = damp(cam.vx, ox / Math.max(dt, 1e-3), 18, dt); cam.vy = damp(cam.vy, oy / Math.max(dt, 1e-3), 18, dt); }
    else if (Math.abs(cam.ls - cam.lsT) < 0.002) anchor = null;
  } else {
    cam.x += cam.vx * dt; cam.y += cam.vy * dt;
    cam.vx *= Math.exp(-dt * 3.4); cam.vy *= Math.exp(-dt * 3.4);
  }
  const zt = zoomT(), home = 1 - smooth(0, 0.14, zt);
  cam.x = damp(cam.x, 0, 7 * home, dt); cam.y = damp(cam.y, HOME_Y, 7 * home, dt);
  cam.x = clamp(cam.x, -CW / 2 - 0.6, CW / 2 + 0.6); cam.y = clamp(cam.y, -2.5, CH + 1.2);

  // Time dilation: a waterfall far away, a slow drift up close, almost still behind an open story.
  const scale = Math.exp(cam.ls);
  motion = Math.min(1, 40 / scale);
  select.t = damp(select.t, select.target, select.target ? 3.2 : 4, dt);
  flow = damp(flow, paused ? 0 : 1 - 0.85 * select.t, 2.2, dt);
  const rate = 55 * Math.pow(0.4, zt) / scale * flow;

  // What is under the hand.
  let line = -1;
  if (!view.isOpen) {
    if (kbLine >= 0) line = kbLine;
    else if (pointer.inside && !drag?.moved && !pinch) line = pickLine(pointer.x, pointer.y);
  }
  if (line >= 0) hover.line = line;
  hover.t = line >= 0 ? damp(hover.t, 1, 9, dt) : damp(hover.t, 0, 5, dt);
  if (hover.t < 0.01 && line < 0) hover.line = -1;

  // The hand in the curtain: threads part around the one being pointed at and swing back.
  const moved = pointer.lastX < 0 ? 0 : (pointer.x - pointer.lastX);
  pointer.lastX = pointer.x;
  pointer.speed = damp(pointer.speed, Math.abs(moved) / Math.max(dt, 1e-3), 10, dt);
  const wp = pointer.x >= 0 ? unproject(pointer.x, pointer.y) : { x: 0, y: -99 };
  pointer.wvx = damp(pointer.wvx, moved / Math.max(dt, 1e-3) / scale, 12, dt);
  const active = (pointer.inside || kbLine >= 0) && !pinch && !view.isOpen && (kbLine >= 0 || (wp.y > -0.5 && wp.y < CH + 0.3));
  pointer.reach = damp(pointer.reach, active ? (line >= 0 ? 0.2 : 0.08) + Math.min(pointer.speed / 900, 0.6) : 0, 4, dt);
  const cx = line >= 0 ? fib.x0[line] : wp.x, cy = kbLine >= 0 ? CH * 0.55 : wp.y;
  const R = 46 / scale, R2 = R * 1.8;
  const dyn = T.fibD.data, kHold = 1 - Math.exp(-dt * 7);
  for (let i = 0; i < NF; i++) {
    const dx = fib.x0[i] - cx, ad = Math.abs(dx);
    let target = 0;
    if (active && ad < R2 && i !== line) {
      if (ad < R) target = (dx < 0 ? -1 : 1) * (R - ad) * 0.9 * pointer.reach;
      fib.v[i] += pointer.wvx * (1 - ad / R2) * 2 * dt;
      fib.py[i] = cy;
    }
    const a = 60 * (target - fib.o[i]) - 7.2 * fib.v[i];
    fib.v[i] += a * dt; fib.o[i] += fib.v[i] * dt;
    // The thread under the hand eases to a stop: its photographs and its light hold still.
    fib.hold[i] += ((i === line ? 1 : 0) - fib.hold[i]) * kHold;
    const go = dt * rate * (1 - fib.hold[i]);
    const period = SLOT * stories[i].chapters.length;
    fib.phase[i] = (fib.phase[i] + go * fib.speed[i]) % period;
    fib.flow[i] = (fib.flow[i] + go) % 4000;
    dyn[i * 4] = fib.o[i]; dyn[i * 4 + 1] = fib.py[i]; dyn[i * 4 + 2] = fib.phase[i]; dyn[i * 4 + 3] = fib.flow[i];
  }
  pluck.age += dt;

  body.classList.toggle('over-line', line >= 0);

  // Now and then a life glimmers by itself somewhere in view.
  idleNext -= dt;
  for (const g of idle) g.age += dt;
  if (!REDUCED && idleNext <= 0 && hover.t < 0.05 && now - lastInput > 1500) {
    const g = idle.find(g => g.age > 3.4);
    if (g) {
      const x = unproject(W * (0.15 + rng() * 0.7), H / 2).x;
      g.line = clamp(Math.round((x + CW / 2) / SPACING), 0, NF - 1); g.age = 0;
    }
    idleNext = 0.9 + rng() * 1.6;
  }

  body.classList.toggle('zooming', now < zoomUntil);
  $meter.style.setProperty('--z', zt.toFixed(4));
}

function bindCommon(p, hpx, mirror) {
  const u = p.u;
  gl.uniform3f(u.uCam, cam.x, cam.y, camDist());
  gl.uniform1f(u.uF, F); gl.uniform1f(u.uAspect, W / H); gl.uniform1f(u.uHpx, hpx);
  gl.uniform1f(u.uCW, CW); gl.uniform1f(u.uCH, CH); gl.uniform1f(u.uYB, YB);
  gl.uniform1f(u.uTime, time); gl.uniform1f(u.uMotion, motion);
  gl.uniform4f(u.uPluck, pluck.line, pluck.age, pluck.amp, 0);
  gl.uniform1f(u.uMirror, mirror ? 1 : 0); gl.uniform1f(u.uIntro, REDUCED ? 99 : intro);
  gl.uniform1i(u.uFibS, 0); gl.uniform1i(u.uFibD, 1);
}

function drawWorld(rt, mirror) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, rt.fb);
  gl.viewport(0, 0, rt.w, rt.h);
  if (mirror) gl.clearColor(0, 0, 0, 1); else gl.clearColor(0.006, 0.007, 0.016, 1);
  gl.clear(gl.COLOR_BUFFER_BIT);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
  const zt = zoomT();

  if (!mirror) {
    const { p, u } = P.floor; gl.useProgram(p);
    gl.uniform3f(u.uCam, cam.x, cam.y, camDist()); gl.uniform1f(u.uF, F); gl.uniform1f(u.uAspect, W / H);
    gl.uniform1f(u.uCW, CW); gl.uniform1f(u.uTime, time); gl.uniform1f(u.uGain, 1 - 0.6 * select.t); gl.uniform1f(u.uIntro, REDUCED ? 99 : intro);
    gl.bindVertexArray(vaos.quad); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  const pr = P.fibre, u = pr.u; gl.useProgram(pr.p); bindCommon(pr, rt.h, mirror);
  gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, T.story.t); gl.uniform1i(u.uStory, 2);
  gl.activeTexture(gl.TEXTURE3); gl.bindTexture(gl.TEXTURE_2D, T.layers.t); gl.uniform1i(u.uLayers, 3);
  gl.activeTexture(gl.TEXTURE4); gl.bindTexture(gl.TEXTURE_2D_ARRAY, arrTex); gl.uniform1i(u.uArr, 4);
  gl.uniform1f(u.uMinPx, mirror ? 1.6 : 1.0);
  gl.uniform1f(u.uSpacing, SPACING); gl.uniform1f(u.uW, PHOTO_W); gl.uniform1f(u.uS, SLOT);
  gl.uniform1f(u.uGain, (mirror ? 0.55 : 0.78) * (1.05 - 0.2 * zt));
  gl.uniform4f(u.uHover, hover.line, hover.t, 0, 0);
  gl.uniform1f(u.uDim, 0.22 * hover.t);
  gl.uniform2f(u.uSelect, select.line, select.t);
  gl.uniform1fv(u.uIdleL, idle.map(g => g.line)); gl.uniform1fv(u.uIdleA, idle.map(g => g.age));
  gl.bindVertexArray(vaos.fibre);
  gl.drawArraysInstanced(gl.TRIANGLE_STRIP, 0, (SEG + 1) * 2, NF);
}

function post(prog, dst, setup) {
  gl.bindFramebuffer(gl.FRAMEBUFFER, dst ? dst.fb : null);
  gl.viewport(0, 0, dst ? dst.w : PW, dst ? dst.h : PH);
  gl.useProgram(prog.p); setup(prog.u);
  gl.bindVertexArray(vaos.empty);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function render() {
  const zt = zoomT();
  gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.fibS.t);
  gl.activeTexture(gl.TEXTURE1); updateTexture(T.fibD);

  const floorV = 0.5 + 0.5 * ((0 - cam.y) * F / camDist());
  const hasRefl = floorV > -0.02;
  if (hasRefl) {
    drawWorld(RT.refl[0], true);
    gl.disable(gl.BLEND);
    const [a, b] = RT.refl;
    post(P.blur, b, u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 0, 2.2 / a.h); });
    post(P.blur, a, u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, b.tex); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 1.1 / a.w, 0); });
    post(P.blur, b, u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, a.tex); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uDir, 0, 5 / a.h); });
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, T.fibS.t);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, T.fibD.t);
  }

  drawWorld(RT.scene, false);

  // Bloom: a chain of progressively smaller, softer copies added back together.
  gl.disable(gl.BLEND);
  let src = RT.scene;
  for (const dst of RT.bloom) {
    const s = src;
    post(P.down, dst, u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uTexel, 1 / s.w, 1 / s.h); });
    src = dst;
  }
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
  for (let i = RT.bloom.length - 1; i > 0; i--) {
    const s = RT.bloom[i];
    post(P.up, RT.bloom[i - 1], u => { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, s.tex); gl.uniform1i(u.uSrc, 0); gl.uniform2f(u.uTexel, 1 / s.w, 1 / s.h); });
  }
  gl.disable(gl.BLEND);

  post(P.composite, null, u => {
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, RT.scene.tex); gl.uniform1i(u.uScene, 0);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, RT.bloom[0].tex); gl.uniform1i(u.uBloom, 1);
    gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, RT.refl[1].tex); gl.uniform1i(u.uRefl, 2);
    gl.uniform1f(u.uBloomK, 0.16 - 0.12 * smooth(0.15, 0.6, zt));
    gl.uniform1f(u.uReflK, 1);
    gl.uniform1f(u.uHasRefl, hasRefl ? 1 : 0);
    gl.uniform1f(u.uFloorV, floorV);
    gl.uniform1f(u.uTime, time);
    gl.uniform2f(u.uRes, PW, PH);
  });
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - last) / 1000); last = now;
  if (sleeping || document.hidden) return;
  step(dt, now);
  render();
}

// ────────────────────────────────────────────────────────────── boot

async function boot() {
  if (!gl) throw new Error('WebGL 2 is not available');
  ({ program, dataTexture, updateTexture, target, freeTarget } = createGLHelpers(gl));
  P.fibre = program(FIBRE_VS, FIBRE_FS);
  P.floor = program(FLOOR_VS, FLOOR_FS);
  P.down = program(POST_VS, DOWN_FS);
  P.up = program(POST_VS, UP_FS);
  P.blur = program(POST_VS, BLUR_FS);
  P.composite = program(POST_VS, COMPOSITE_FS);

  const strip = new Float32Array((SEG + 1) * 4);
  for (let k = 0; k <= SEG; k++) {
    const u = k <= 40 ? 0.86 * k / 40 : 0.86 + 0.14 * (k - 40) / (SEG - 40);
    strip.set([u, -1, u, 1], k * 4);
  }
  vaos.fibre = gl.createVertexArray(); gl.bindVertexArray(vaos.fibre);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, strip, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  vaos.quad = gl.createVertexArray(); gl.bindVertexArray(vaos.quad);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer()); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
  vaos.empty = gl.createVertexArray();
  gl.bindVertexArray(null);

  resize();
  const catalog = await loadCatalog();
  photos = catalog.photos;
  arrTex = await loadTextures(gl, photos, progress => $loader.style.setProperty('--p', progress.toFixed(3)));
  buildFibres();
  stories = buildStories(photos, catalog.authored, catalog.journal);
  uploadStories();

  cam.x = 0; cam.y = HOME_Y; cam.lsT = LS_MIN(); cam.ls = cam.lsT - 0.25;
  view = new StoryView({ stories, onShow: onStoryShow, onCovered: onStoryCovered, onHide: onStoryHide });
  body.classList.add('ready');
  last = performance.now();
  requestAnimationFrame(frame);
  view.route(); // a shared link opens straight into its story
  window.__undertow = { cam, stories, fib, get hover() { return hover; }, pickLine, chapterAt, project, unproject, openStory, zoomBy, LS_MIN, LS_MAX, get slot() { return SLOT; } };
}
boot().catch(err => {
  console.error(err);
  body.classList.add('ready');
  const message = document.getElementById('error');
  message.textContent = err.message;
  message.hidden = false;
});

// The inside of a thread. The chosen thread pours down, moves to the centre and unfolds into
// its photographs, which keep flowing down it in an endless column — the same stream as in
// the curtain, seen from close by. Routed through the hash (#/story/<id>[/<moment>]) so every
// story has an address and the back button returns to the waterfall.

const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
import { clamp, smooth, damp, mod } from './math.js';
const DRIFT = 30; // px/s the stream flows on its own

export class StoryView {
  constructor({ stories, onShow, onCovered, onHide }) {
    this.stories = stories;
    this.onShow = onShow; this.onCovered = onCovered; this.onHide = onHide;
    this.index = -1; this.origin = innerWidth / 2; this.pushed = false; this.timers = [];

    const el = this.el = document.getElementById('story');
    const q = s => el.querySelector(s);
    this.flow = q('.story-flow');
    this.strip = q('.strip');
    this.title = q('#story-title');
    this.back = q('.story-back');
    this.prev = q('.story-side.prev');
    this.next = q('.story-side.next');
    this.lb = q('.lightbox');

    this.offset = 0; this.target = 0; this.vel = 0; this.drift = 0; this.hovering = false; this.paused = false;
    this.nodes = []; this.raf = 0;

    this.back.addEventListener('click', () => this.close());
    this.prev.addEventListener('click', () => this.step(-1));
    this.next.addEventListener('click', () => this.step(1));
    this.lb.addEventListener('click', () => this.closeLightbox());
    this.flow.addEventListener('wheel', e => {
      e.preventDefault();
      const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? innerHeight : 1;
      this.target -= e.deltaY * unit;
    }, { passive: false });
    this.flow.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.hovering = !!e.target.closest('.item'); });
    this.flow.addEventListener('pointerleave', () => { this.hovering = false; });
    this.strip.addEventListener('click', e => {
      const shot = e.target.closest('.shot');
      if (shot && !this.dragged) this.openLightbox(+shot.dataset.i);
    });
    this.flow.addEventListener('pointerdown', e => this.dragStart(e));
    this.flow.addEventListener('pointermove', e => this.dragMove(e));
    this.flow.addEventListener('pointerup', e => this.dragEnd(e));
    this.flow.addEventListener('pointercancel', e => this.dragEnd(e, true));
    addEventListener('resize', () => { if (this.isOpen) this.layout(); });
    addEventListener('hashchange', () => this.route());
    addEventListener('keydown', e => {
      if (!this.isOpen) return;
      const k = e.key;
      if (k === 'Escape') { e.preventDefault(); this.lb.hidden ? this.close() : this.closeLightbox(); }
      else if (k === 'ArrowLeft' || k === 'ArrowRight') { e.preventDefault(); this.lb.hidden ? this.step(k === 'ArrowRight' ? 1 : -1) : this.lightboxStep(k === 'ArrowRight' ? 1 : -1); }
      else if (k === 'ArrowUp' || k === 'ArrowDown') { e.preventDefault(); this.target += k === 'ArrowUp' ? 180 : -180; }
      else if (k === ' ') { e.preventDefault(); this.paused = !this.paused; }
      e.stopImmediatePropagation();
    }, true);
  }

  get isOpen() { return !this.el.hidden; }

  // ── routing ──────────────────────────────────────────────────────────

  open(index, { chapter = null, x = innerWidth / 2, replace = false } = {}) {
    const s = this.stories[index];
    if (!s) return;
    this.origin = x;
    const hash = `#/story/${encodeURIComponent(s.id)}` + (chapter != null ? `/${chapter + 1}` : '');
    if (location.hash === hash) return this.route();
    if (replace) { history.replaceState(null, '', hash); this.route(); }
    else { this.pushed = true; location.hash = hash; }
  }
  close() {
    if (!this.isOpen) return;
    if (this.pushed) { this.pushed = false; history.back(); }
    else { history.replaceState(null, '', location.pathname + location.search); this.route(); }
  }
  step(d) { this.open(mod(this.index + d, this.stories.length), { replace: true }); }
  route() {
    const m = location.hash.match(/^#\/story\/([^/]+)(?:\/(\d+))?/);
    const index = m ? this.stories.findIndex(s => s.id === decodeURIComponent(m[1])) : -1;
    if (index < 0) return this.hide();
    this.show(index, m[2] ? +m[2] - 1 : null);
  }

  later(fn, ms) { const t = setTimeout(fn, REDUCED ? 0 : ms); this.timers.push(t); return t; }
  clearTimers() { this.timers.forEach(clearTimeout); this.timers = []; }

  // ── opening, switching, closing ─────────────────────────────────────

  show(index, chapter) {
    const el = this.el;
    if (this.isOpen && !el.classList.contains('closing')) {
      if (index === this.index) { if (chapter != null) this.centre(chapter, true); return; }
      // Another thread: this one folds back into its line, the next one unfolds.
      this.clearTimers();
      this.resetDelays();
      el.classList.add('folding'); el.classList.remove('unfolded');
      this.onShow(index);
      this.later(() => {
        this.render(index, chapter);
        el.classList.remove('folding');
        this.unfold(40);
      }, 520);
      return;
    }
    this.clearTimers();
    this.lastFocus = document.activeElement;
    el.hidden = false;                                     // visible first, so entries can be measured
    el.classList.remove('closing', 'folding', 'on', 'poured', 'centered', 'unfolded');
    this.render(index, chapter);
    el.style.setProperty('--tx', `${Math.round(this.origin)}px`);
    void el.offsetWidth;
    document.body.classList.add('story-open');
    this.onShow(index);
    el.classList.add('on', 'poured');                       // backdrop darkens, the thread pours down
    this.later(() => el.classList.add('centered'), 560);   // …and glides to the centre
    this.later(() => this.unfold(0), 1180);                // …and opens into its photographs
    this.later(() => this.onCovered(), 1000);
    this.back.focus({ preventScroll: true, focusVisible: false });
    this.drift = 0;
    this.loop();
  }

  hide() {
    const el = this.el;
    if (!this.isOpen || el.classList.contains('closing')) return;
    this.clearTimers();
    this.closeLightbox(true);
    this.onHide();
    this.resetDelays();
    el.classList.add('closing', 'folding');
    el.classList.remove('unfolded');
    this.later(() => el.classList.remove('poured'), 260);
    this.later(() => el.classList.remove('on'), 380);
    document.body.classList.remove('story-open');
    this.later(() => {
      el.hidden = true;
      el.classList.remove('closing', 'folding', 'centered');
      cancelAnimationFrame(this.raf); this.raf = 0;
      this.index = -1;
    }, 1000);
    (this.lastFocus && this.lastFocus !== document.body ? this.lastFocus : document.getElementById('stream')).focus?.({ preventScroll: true });
  }

  unfold(base) {
    // The photographs open out of the line from the top down, following the flow; each
    // journal entry surfaces a beat after its photograph.
    const order = this.nodes.filter(n => n.y > -n.h && n.y < innerHeight).sort((a, b) => a.y - b.y);
    this.resetDelays();
    order.forEach((n, r) => {
      n.frame.style.transitionDelay = `${base + r * 110}ms`;
      if (n.entry) n.entry.style.transitionDelay = `${base + r * 110 + 520}ms`;
    });
    this.el.classList.add('unfolded');
    this.later(() => this.resetDelays(), base + order.length * 110 + 1800);
  }
  resetDelays() {
    for (const n of this.nodes) { n.frame.style.transitionDelay = '0ms'; if (n.entry) n.entry.style.transitionDelay = '0ms'; }
  }

  // ── the column ──────────────────────────────────────────────────────

  render(index, chapter) {
    const s = this.stories[index], n = this.stories.length;
    this.index = index;
    this.el.style.setProperty('--accent', s.rgb);
    this.title.textContent = s.title;
    const pv = this.stories[mod(index - 1, n)], nx = this.stories[mod(index + 1, n)];
    this.prev.style.setProperty('--c', pv.rgb); this.prev.setAttribute('aria-label', `Previous thread: ${pv.title}`);
    this.next.style.setProperty('--c', nx.rgb); this.next.setAttribute('aria-label', `Next thread: ${nx.title}`);
    // Top to bottom the newest moment comes first, so as the column flows down the story plays forward.
    this.chapters = s.chapters.map((c, i) => ({ ...c, i })).reverse();
    this.layout();
    this.centre(chapter ?? s.chapters.length - 1, false);
  }

  layout() {
    const vw = innerWidth, vh = innerHeight;
    const gap = clamp(vh * 0.075, 36, 80), textW = clamp(vw * 0.2, 220, 300), gutter = clamp(vw * 0.04, 36, 60);
    let base = Math.min(clamp(vh * 0.44, 220, 380), vw * 0.64);
    // Wide screens keep the journal beside each photograph, alternating sides; narrow ones below.
    const beside = vw >= base + 2 * (gutter + textW + 40);
    if (!beside) base = Math.min(vw * 0.8, 440);
    this.el.classList.toggle('stacked', !beside);
    this.el.style.setProperty('--gap', `${Math.round(gap)}px`);
    this.el.style.setProperty('--textw', `${Math.round(textW)}px`);
    this.el.style.setProperty('--gutter', `${Math.round(gutter)}px`);

    this.strip.textContent = '';
    this.nodes = [];
    const first = this.chapters.map(c => {
      const w = Math.round(c.aspect < 1 ? base * 0.72 : base), h = Math.round(w / c.aspect);
      const el = document.createElement('div');
      el.className = 'item';
      el.style.width = `${w}px`;
      el.innerHTML = `
        <button class="shot" type="button" data-i="${c.i}" style="height:${h}px" aria-label="${esc(c.caption || 'Photograph')}, larger">
          <span class="frame"><img alt="" decoding="async" src="${esc(c.src)}"></span>
        </button>
        ${c.text || c.date ? `<div class="entry ${c.i % 2 ? 'right' : 'left'}">
          ${c.date ? `<span class="date">${esc(c.date)}</span>` : ''}
          ${c.text ? `<p>${esc(c.text)}</p>` : ''}
        </div>` : ''}`;
      this.strip.appendChild(el);
      return { c, el, w, h };
    });
    // Measure once the entries are in the page (they add height only when stacked).
    let y = 0;
    this.items = first.map(({ c, el, w, h }) => {
      const entry = el.querySelector('.entry');
      const H = beside || !entry ? h : h + entry.offsetHeight + 22;
      el.style.height = `${H}px`;
      const it = { ...c, w, h, H, y0: y, el };
      y += H + gap;
      return it;
    });
    this.cycle = y;
    this.copies = Math.ceil(vh / this.cycle) + 2;
    for (let k = 0; k < this.copies; k++) for (const it of this.items) {
      let el = it.el;
      if (k) {
        el = it.el.cloneNode(true);
        el.setAttribute('aria-hidden', 'true');
        el.querySelector('.shot').tabIndex = -1;
        this.strip.appendChild(el);
      }
      this.nodes.push({ el, frame: el.querySelector('.frame'), entry: el.querySelector('.entry'), base: k * this.cycle + it.y0, h: it.H, i: it.i, y: 0 });
    }
    const side = beside ? Math.min(vw * 0.5 - 28, base / 2 + gutter + textW + 44) : Math.min(vw * 0.5 - 28, base / 2 + clamp(vw * 0.12, 56, 200));
    this.el.style.setProperty('--side', `${Math.round(side)}px`);
    this.place();
  }

  // Put moment `i` in the middle of the screen.
  centre(i, animate) {
    const it = this.items.find(t => t.i === i) ?? this.items[0];
    const want = innerHeight / 2 - it.H / 2 - it.y0;
    const now = this.target;
    const d = mod(want - now + this.cycle / 2, this.cycle) - this.cycle / 2; // shortest way round
    this.target = now + d;
    if (!animate) this.offset = this.target;
  }

  place() {
    const vh = innerHeight, span = this.copies * this.cycle;
    for (const n of this.nodes) {
      const y = mod(n.base + this.offset, span) - this.cycle;
      n.y = y;
      // Moments dim into the dark as they near the edges; the thread between them stays straight.
      const d = (y + n.h / 2 - vh / 2) / (vh / 2);
      n.el.style.transform = `translate3d(-50%, ${y.toFixed(2)}px, 0)`;
      n.el.style.opacity = (1 - smooth(0.78, 1.18, Math.abs(d))).toFixed(3);
    }
  }

  loop() {
    if (this.raf) return;
    let last = performance.now();
    const tick = now => {
      this.raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const flowing = this.el.classList.contains('unfolded') && !this.paused && !REDUCED && this.lb.hidden;
      const hold = this.hovering && !this.drag;
      this.drift = damp(this.drift, flowing && !hold ? DRIFT : 0, hold ? 5 : 1.6, dt);
      if (!this.drag) { this.target += (this.drift + this.vel) * dt; this.vel *= Math.exp(-dt * 3); }
      this.offset = damp(this.offset, this.target, this.drag ? 30 : 9, dt);
      this.place();
    };
    this.raf = requestAnimationFrame(tick);
  }

  // ── touch and drag ──────────────────────────────────────────────────

  dragStart(e) {
    if (e.button > 0) return;
    this.drag = { x: e.clientX, y: e.clientY, lastY: e.clientY, lastT: performance.now(), id: e.pointerId };
    this.dragged = false; this.vel = 0;
  }
  dragMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!this.dragged && Math.hypot(dx, dy) > 6) { this.dragged = true; this.flow.setPointerCapture(e.pointerId); this.el.classList.add('dragging'); }
    if (!this.dragged) return;
    const now = performance.now();
    this.target += e.clientY - d.lastY;
    this.vel = damp(this.vel, (e.clientY - d.lastY) / Math.max((now - d.lastT) / 1000, 1e-3), 20, (now - d.lastT) / 1000);
    d.lastY = e.clientY; d.lastT = now;
  }
  dragEnd(e, cancel = false) {
    const d = this.drag;
    if (!d || e.pointerId !== d.id) return;
    this.drag = null;
    this.el.classList.remove('dragging');
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!cancel && this.dragged && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) { this.vel = 0; this.step(dx < 0 ? 1 : -1); }
    setTimeout(() => { this.dragged = false; }, 0);
  }

  // ── a single photograph, large ──────────────────────────────────────

  openLightbox(i) {
    const c = this.stories[this.index].chapters[i];
    this.lbIndex = i;
    const img = this.lb.querySelector('img');
    img.src = c.src; img.alt = c.caption || '';
    this.lb.querySelector('.lb-cap').textContent = [c.date, c.credit].filter(Boolean).join('  ·  ');
    if (this.lb.hidden) { this.lb.hidden = false; requestAnimationFrame(() => this.lb.classList.add('on')); }
  }
  lightboxStep(d) { this.openLightbox(mod(this.lbIndex + d, this.stories[this.index].chapters.length)); }
  closeLightbox(now = false) {
    if (this.lb.hidden) return;
    this.lb.classList.remove('on');
    const done = () => { this.lb.hidden = true; };
    now ? done() : setTimeout(done, 400);
  }
}

function esc(s = '') {
  return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

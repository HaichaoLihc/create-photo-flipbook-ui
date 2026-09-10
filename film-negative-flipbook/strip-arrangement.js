/* A strip is one object. Pockets never move; only the two films exchange places. */
class FilmStripArrangement {
  constructor({ book, pages, canStart, onBusyChange }) {
    this.book = book;
    this.canStart = canStart;
    this.onBusyChange = onBusyChange;
    this.pockets = pages.flatMap(page => [...page.querySelectorAll('.film-pocket')]);
    this.strips = this.pockets.map(pocket => pocket.firstElementChild);
    this.flights = new Map();
    this.history = [];
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.storageKey = 'negative-archive-strip-order-v1';
    this.hint = document.querySelector('#interaction-hint');
    this.undoButton = document.querySelector('#undo-strip-swap');
    this.announcement = document.createElement('span');
    this.announcement.className = 'visually-hidden';
    this.announcement.setAttribute('role', 'status');
    document.body.append(this.announcement);

    this.strips.forEach((strip, index) => {
      const exposures = [...strip.querySelectorAll('button[data-frame]')].map(frame =>
        frame.dataset.photoId ? `${frame.dataset.frame}:${frame.dataset.photoId}` : frame.dataset.frame);
      strip.dataset.stripId = exposures.length ? exposures.join('-') : `empty-${index}`;
      strip.tabIndex = 0;
      strip.setAttribute('role', 'group');
      strip.setAttribute('aria-roledescription', 'movable film strip');
      strip.setAttribute('aria-keyshortcuts', 'Space Enter ArrowUp ArrowDown ArrowLeft ArrowRight Escape');
      strip.title = 'Drag to turn the page. To exchange strips, drag the end nearest the spine.';
      const handle = document.createElement('span');
      handle.className = 'strip-handle';
      handle.setAttribute('aria-hidden', 'true');
      handle.title = 'Drag this inner end to exchange the strip';
      strip.append(handle);
      strip.querySelectorAll('img').forEach(image => { image.draggable = false; });
    });
    this.originalOrder = this.order();
    this.byId = new Map(this.strips.map(strip => [strip.dataset.stripId, strip]));
    this.restore();
    this.describe();

    document.addEventListener('pointerdown', event => this.pointerDown(event), true);
    document.addEventListener('pointermove', event => this.pointerMove(event), true);
    document.addEventListener('pointerup', event => this.pointerUp(event), true);
    document.addEventListener('pointercancel', event => {
      if (event.pointerId === this.pending?.pointerId || event.pointerId === this.drag?.pointerId ||
          event.pointerId === this.pageGesture?.pointerId) this.cancel();
    }, true);
    document.addEventListener('lostpointercapture', event => {
      // Touch starts with implicit capture on the photo button. Transferring it
      // to the book emits a loss on that button; only losing OUR capture cancels.
      if (event.target === this.book && event.pointerId === this.drag?.pointerId && !this.settling) this.cancel();
    }, true);

    // Decide ownership on DOWN, never from the element under a moving pointer.
    // In particular, a page drag must retain its move AND release events when
    // it crosses photos, empty pockets, or another strip's handle.
    for (const type of ['mousedown', 'touchstart']) {
      document.addEventListener(type, event => {
        if (this.ownsStripGesture || event.target.closest?.('.strip-handle')) event.stopPropagation();
      }, { capture: true, passive: true });
    }
    for (const type of ['mousemove', 'touchmove', 'mouseup', 'touchend']) {
      document.addEventListener(type, event => {
        if (this.ownsStripGesture) event.stopPropagation();
      }, { capture: true, passive: true });
    }
    document.addEventListener('dragstart', event => {
      if (event.target.closest?.('.film-strip')) event.preventDefault();
    }, true);
    document.addEventListener('click', event => {
      if (this.suppressClick && event.target.closest?.('.film-strip, .film-pocket')) {
        event.preventDefault();
        event.stopImmediatePropagation();
      }
    }, true);
    document.addEventListener('keydown', event => this.keyDown(event), true);
    window.addEventListener('blur', () => this.cancel());
    window.addEventListener('resize', () => this.cancel(true));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.cancel(true);
    });
    this.undoButton?.addEventListener('click', () => this.undo());
  }

  get ownsStripGesture() { return Boolean(this.pending || this.drag || this.settling || this.undoing); }
  get suppressClick() { return this.ownsStripGesture || this.pageGesture?.moved || performance.now() < (this.clickDeadline || 0); }
  order() { return this.pockets.map(pocket => pocket.firstElementChild.dataset.stripId); }

  restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(this.storageKey));
      if (!saved || JSON.stringify(saved.original) !== JSON.stringify(this.originalOrder)) return;
      if (!Array.isArray(saved.order) || saved.order.length !== this.strips.length ||
          new Set(saved.order).size !== this.strips.length || saved.order.some(id => !this.byId.has(id))) return;
      saved.order.forEach((id, index) => this.pockets[index].append(this.byId.get(id)));
    } catch { /* Storage can be unavailable; arranging still works in memory. */ }
  }

  save() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify({ original: this.originalOrder, order: this.order() }));
      return true;
    } catch { return false; }
  }

  describe() {
    this.pockets.forEach((pocket, index) => {
      pocket.firstElementChild.setAttribute('aria-label', `Film strip, sleeve ${Math.floor(index / 7) + 1}, row ${index % 7 + 1}`);
    });
  }

  // Hit-test rendered leaves, not the hidden leaves in the engine.
  visibleSlots() {
    return this.pockets.flatMap(pocket => {
      const strip = pocket.firstElementChild;
      const rect = strip.getBoundingClientRect();
      if (!rect.width || !rect.height) return [];
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2;
      const leaf = pocket.closest('.book-page');
      if (document.elementFromPoint(x, y)?.closest('.book-page') !== leaf) return [];
      return [{ pocket, strip, rect, x, y }];
    });
  }

  pointerDown(event) {
    if (!this.book.contains(event.target) || !event.isPrimary || event.button !== 0) return;
    if (this.ownsStripGesture) { event.stopPropagation(); return; }
    const handle = event.target.closest?.('.strip-handle');
    if (!handle) {
      this.pageGesture = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      this.clickDeadline = 0;
      return;
    }
    event.stopPropagation();
    if (!this.canStart()) return;
    const strip = handle.closest('.film-strip');
    this.pending = { strip, pointerId: event.pointerId, x: event.clientX, y: event.clientY, pointerType: event.pointerType };
  }

  pointerMove(event) {
    if (this.pageGesture?.pointerId === event.pointerId) {
      if (Math.hypot(event.clientX - this.pageGesture.x, event.clientY - this.pageGesture.y) >= 6) {
        this.pageGesture.moved = true;
      }
      return;
    }
    if (this.pending?.pointerId === event.pointerId) {
      const distance = Math.hypot(event.clientX - this.pending.x, event.clientY - this.pending.y);
      if (distance < (this.pending.pointerType === 'touch' ? 9 : 5)) return;
      const pending = this.pending;
      this.pending = null;
      if (!this.lift(pending.strip, pending.x, pending.y, pending.pointerId)) return;
      try { this.book.setPointerCapture(event.pointerId); } catch { /* Pointer may already have ended. */ }
    }
    if (!this.drag || this.drag.pointerId !== event.pointerId || this.settling) return;
    event.preventDefault();
    event.stopPropagation();
    this.drag.pointerX = event.clientX;
    this.drag.pointerY = event.clientY;
    this.choose(this.slotAt(event.clientX, event.clientY));
    if (!this.frame) this.frame = requestAnimationFrame(time => this.follow(time));
  }

  pointerUp(event) {
    if (this.pageGesture?.pointerId === event.pointerId) {
      if (this.pageGesture.moved) this.clickDeadline = performance.now() + 400;
      this.pageGesture = null;
      return; // The flip engine still needs the following mouseup/touchend.
    }
    if (this.pending?.pointerId === event.pointerId) this.pending = null;
    if (!this.drag || this.drag.pointerId !== event.pointerId || this.settling) return;
    event.stopPropagation();
    if (this.drag.viewportWidth !== innerWidth || this.drag.viewportHeight !== innerHeight) {
      this.cancel(true);
      return;
    }
    this.choose(this.slotAt(event.clientX, event.clientY));
    this.place(Boolean(this.drag.target));
  }

  lift(strip, x, y, pointerId = null) {
    const slots = this.visibleSlots();
    const source = slots.find(slot => slot.strip === strip);
    if (!source) return false;
    this.onBusyChange(true);
    this.book.dataset.arranging = 'true';
    document.body.classList.add('is-arranging-film');
    const ghost = this.makeGhost(strip, source.rect);
    ghost.classList.add('film-in-hand');
    this.drag = {
      source, slots, pointerId, ghost, target: null,
      viewportWidth: innerWidth, viewportHeight: innerHeight,
      pointerX: x, pointerY: y, offsetX: x - source.rect.left, offsetY: y - source.rect.top,
      x: source.rect.left, y: source.rect.top, tilt: 0, lift: 0, time: 0,
    };
    this.setHint('Release to exchange · Esc to cancel');
    this.say('Film lifted. Choose another strip, then release to exchange. Escape cancels.');
    this.frame = requestAnimationFrame(time => this.follow(time));
    return true;
  }

  slotAt(x, y) {
    const { slots, source, target } = this.drag;
    // The whole pocket is a target, including the small gap between films.
    // Keep a few pixels of hysteresis at row boundaries to avoid flicker.
    if (target && x >= target.rect.left - 5 && x <= target.rect.right + 5 && Math.abs(y - target.y) <= target.rect.height / 2 + 6) return target;
    return slots.find(slot => slot !== source && x >= slot.rect.left - 8 && x <= slot.rect.right + 8 && Math.abs(y - slot.y) <= slot.rect.height / 2 + 5) || null;
  }

  makeGhost(strip, rect) {
    const wrapper = document.createElement('div');
    wrapper.className = 'film-flight';
    wrapper.setAttribute('aria-hidden', 'true');
    wrapper.inert = true;
    Object.assign(wrapper.style, { left: '0px', top: '0px', width: `${rect.width}px`, height: `${rect.height}px`, transform: `translate3d(${rect.left}px, ${rect.top}px, 0)` });
    const copy = strip.cloneNode(true);
    copy.classList.remove('is-film-lifted');
    copy.removeAttribute('data-strip-id');
    copy.removeAttribute('tabindex');
    copy.querySelector('.strip-handle')?.remove();
    copy.querySelectorAll('img').forEach(image => { image.loading = 'eager'; });
    // Preserve explicit positive selections; hover itself does not develop a
    // moving negative. The actual perforated film is the only painted surface.
    wrapper.append(copy);
    document.body.append(wrapper);
    strip.classList.add('is-film-lifted');
    return wrapper;
  }

  follow(time) {
    this.frame = 0;
    const drag = this.drag;
    if (!drag || this.settling) return;
    const dt = Math.min(32, time - (drag.time || time - 16));
    const follow = this.motion.matches ? 1 : 1 - Math.exp(-dt / 24);
    const nextX = drag.pointerX - drag.offsetX;
    const nextY = drag.pointerY - drag.offsetY - (this.motion.matches ? 0 : 5);
    const velocity = nextX - drag.x;
    drag.x += (nextX - drag.x) * follow;
    drag.y += (nextY - drag.y) * follow;
    drag.lift += (1 - drag.lift) * (1 - Math.exp(-dt / 65));
    const targetTilt = this.motion.matches ? 0 : Math.max(-.85, Math.min(.85, velocity * .025));
    drag.tilt += (targetTilt - drag.tilt) * .2;
    drag.time = time;
    drag.ghost.style.transform = `translate3d(${drag.x}px, ${drag.y}px, 0)`;
    drag.ghost.firstElementChild.style.transform = `rotate(${drag.tilt}deg) scale(${1 + (this.motion.matches ? 0 : .012 * drag.lift)})`;
    if (Math.abs(nextX - drag.x) + Math.abs(nextY - drag.y) + Math.abs(drag.tilt) + (1 - drag.lift) > .025) {
      this.frame = requestAnimationFrame(nextTime => this.follow(nextTime));
    }
  }

  choose(target) {
    if (target === this.drag.target) return;
    const previous = this.drag.target;
    this.drag.target = target;
    if (previous) this.fly(previous, previous.rect, true);
    if (target) {
      this.fly(target, this.drag.source.rect, false);
      this.say(`Exchange with ${target.strip.getAttribute('aria-label').toLowerCase()}.`);
    }
  }

  animateTo(ghost, rect, duration = 340) {
    const current = ghost.getBoundingClientRect();
    ghost.getAnimations().forEach(animation => animation.cancel());
    const from = `translate3d(${current.left}px, ${current.top}px, 0)`;
    const to = `translate3d(${rect.left}px, ${rect.top}px, 0)`;
    ghost.style.transform = to;
    return ghost.animate([{ transform: from }, { transform: to }], {
      duration: this.motion.matches ? 0 : duration,
      easing: 'cubic-bezier(.22, 1, .36, 1)',
    }).finished.catch(() => {});
  }

  fly(slot, destination, returning) {
    let flight = this.flights.get(slot.strip);
    if (!flight) {
      flight = { ghost: this.makeGhost(slot.strip, slot.rect), token: 0 };
      this.flights.set(slot.strip, flight);
    }
    const token = ++flight.token;
    flight.finished = this.animateTo(flight.ghost, destination).then(() => {
      if (returning && flight.token === token) this.removeFlight(slot.strip);
    });
    return flight.finished;
  }

  removeFlight(strip) {
    const flight = this.flights.get(strip);
    if (!flight) return;
    flight.token++;
    flight.ghost.remove();
    strip.classList.remove('is-film-lifted');
    this.flights.delete(strip);
  }

  async place(commit) {
    const drag = this.drag;
    if (!drag || this.settling) return;
    this.settling = true;
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    const target = commit ? drag.target : null;
    if (!commit && drag.target) this.choose(null);
    const destination = target || drag.source;
    const children = drag.ghost.firstElementChild;
    const landing = children.animate([
      { transform: children.style.transform || 'none' },
      { transform: 'rotate(0deg) scale(1)' },
    ], { duration: this.motion.matches ? 0 : 300, easing: 'cubic-bezier(.22, 1, .36, 1)' });
    children.style.transform = 'none';
    drag.ghost.classList.remove('film-in-hand');
    const settled = this.animateTo(drag.ghost, destination.rect, 360);
    await Promise.all([settled, landing.finished.catch(() => {}), ...[...this.flights.values()].map(flight => flight.finished)]);
    if (this.drag !== drag) return;
    if (target) {
      drag.source.pocket.append(target.strip);
      target.pocket.append(drag.source.strip);
      this.history.push([drag.source.strip, target.strip]);
      if (this.history.length > 40) this.history.shift();
      const saved = this.save();
      this.describe();
      this.say(saved ? 'Strips exchanged. Arrangement saved on this device.' : 'Strips exchanged. Storage unavailable; this arrangement lasts for this visit.');
    } else this.say('Film returned to its original pocket.');
    this.finish(drag);
    if (drag.pointerId === null) drag.source.strip.focus({ preventScroll: true });
  }

  finish(drag) {
    drag.ghost.remove();
    drag.source.strip.classList.remove('is-film-lifted');
    for (const strip of this.flights.keys()) this.removeFlight(strip);
    this.drag = null;
    this.settling = false;
    this.clickDeadline = performance.now() + 100;
    delete this.book.dataset.arranging;
    document.body.classList.remove('is-arranging-film');
    if (drag.pointerId !== null && this.book.hasPointerCapture(drag.pointerId)) this.book.releasePointerCapture(drag.pointerId);
    this.onBusyChange(false);
    this.setHint('Drag to flip · Inner film edge to swap');
    if (this.undoButton) this.undoButton.hidden = !this.history.length;
  }

  cancel(immediate = false) {
    if (this.pageGesture?.moved) this.clickDeadline = performance.now() + 400;
    this.pageGesture = null;
    this.pending = null;
    if (!this.drag) return;
    if (immediate) {
      cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.finish(this.drag);
    } else if (!this.settling) this.place(false);
  }

  keyDown(event) {
    const strip = event.target.closest?.('.film-strip');
    if (event.key === 'Escape' && (this.pending || this.drag)) {
      event.preventDefault(); event.stopPropagation(); this.cancel(); return;
    }
    if ((event.metaKey || event.ctrlKey) && !event.shiftKey && event.key.toLowerCase() === 'z' && this.history.length) {
      if (event.target.closest?.('input, textarea, [contenteditable="true"]')) return;
      event.preventDefault(); event.stopPropagation(); this.undo(); return;
    }
    if (this.drag && event.key === 'Tab') { this.cancel(true); return; }
    if (!strip || event.target !== strip || event.altKey || event.ctrlKey || event.metaKey) return;
    if (this.settling) { event.preventDefault(); return; }
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault(); event.stopPropagation();
      if (this.drag) this.place(Boolean(this.drag.target));
      else if (this.canStart()) {
        const rect = strip.getBoundingClientRect();
        this.lift(strip, rect.left + rect.width / 2, rect.top + rect.height / 2);
      }
    } else if (this.drag && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) {
      event.preventDefault(); event.stopPropagation();
      const current = this.drag.target || this.drag.source;
      const vertical = event.key === 'ArrowUp' || event.key === 'ArrowDown';
      const direction = event.key === 'ArrowUp' || event.key === 'ArrowLeft' ? -1 : 1;
      const candidates = this.drag.slots.filter(slot => vertical
        ? Math.abs(slot.x - current.x) < 10 && (slot.y - current.y) * direction > 10
        : (slot.x - current.x) * direction > 10);
      candidates.sort((a, b) => Math.hypot(a.x - current.x, a.y - current.y) - Math.hypot(b.x - current.x, b.y - current.y));
      const target = candidates[0];
      if (!target) return;
      this.choose(target === this.drag.source ? null : target);
      this.drag.pointerX = target.rect.left + this.drag.offsetX;
      this.drag.pointerY = target.rect.top + this.drag.offsetY;
      if (!this.frame) this.frame = requestAnimationFrame(time => this.follow(time));
    }
  }

  async undo() {
    if (!this.canStart() || !this.history.length) return;
    const [a, b] = this.history.pop();
    const slots = this.visibleSlots();
    const aSlot = slots.find(slot => slot.strip === a), bSlot = slots.find(slot => slot.strip === b);
    this.onBusyChange(true);
    this.undoing = true;
    if (aSlot && bSlot) await Promise.all([this.fly(aSlot, bSlot.rect, false), this.fly(bSlot, aSlot.rect, false)]);
    const aPocket = a.parentElement, bPocket = b.parentElement;
    aPocket.append(b);
    bPocket.append(a);
    this.removeFlight(a); this.removeFlight(b);
    this.save(); this.describe();
    this.undoing = false;
    this.onBusyChange(false);
    if (this.undoButton) this.undoButton.hidden = !this.history.length;
    this.say('Last exchange undone.');
  }

  setHint(text) { if (this.hint) this.hint.textContent = text; }
  say(text) { this.announcement.textContent = text; }
}

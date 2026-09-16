/* Relevance selects the photographs; the archive determines their sequence. */
function selectSearchPhotos(matches, order) {
  const seen = new Set();
  return [...matches].filter(item => typeof item?.id === 'string' && Number.isFinite(item.score) && order.has(item.id))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))
    .filter(item => { if (seen.has(item.id)) return false; seen.add(item.id); return true; })
    .sort((a, b) => order.get(a.id) - order.get(b.id));
}

class ArchiveSearch {
  constructor() {
    this.frames = new Map([...pages].flatMap(page => [...page.querySelectorAll('button.negative-frame')])
      .map(frame => [frame.dataset.frame, frame]));
    this.batches = new Map(); this.pageRequests = new Map(); this.errors = new Map();
    this.total = 0; this.sleeves = []; this.layout = []; this.cursor = 0;
    this.generation = 0; this.animations = new Set();
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.form = document.createElement('form');
    this.form.id = 'archive-search'; this.form.setAttribute('role', 'search');
    this.form.innerHTML = `<input id="photo-query" type="search" maxlength="160" autocomplete="off" placeholder="Search the archive…" aria-label="Search photos in this book" aria-keyshortcuts="/ Meta+k Control+k">
      <button id="clear-search" type="button" aria-label="Clear search" title="Clear search" hidden>×</button>
      <button type="submit" aria-label="Assemble matching photographs" title="Assemble matching photographs">↗</button>`;
    orientationStatus.replaceWith(this.form);
    orientationStatus.hidden = true; this.form.append(orientationStatus);
    this.input = this.form.querySelector('input');
    this.clearButton = this.form.querySelector('#clear-search');
    this.status = document.createElement('small');
    this.status.id = 'search-status'; this.status.hidden = true;
    this.status.setAttribute('role', 'status');
    document.querySelector('.status').append(this.status);
    this.retryButton = document.createElement('button');
    this.retryButton.id = 'retry-search'; this.retryButton.type = 'button';
    this.retryButton.textContent = 'Retry loading'; this.retryButton.hidden = true;
    this.status.after(this.retryButton);
    this.retryButton.addEventListener('click', () => {
      for (const index of this.visibleIndices()) this.errors.delete(index);
      this.preparePages(); updateControls();
    });
    this.form.addEventListener('submit', event => { event.preventDefault(); this.search(); });
    this.clearButton.addEventListener('click', () => { this.clear(); this.input.focus(); });
    this.input.addEventListener('input', () => {
      this.clearButton.hidden = !this.input.value;
      if (!this.input.value.trim()) this.clear();
    });
    this.input.addEventListener('keydown', event => {
      if (event.key === 'Escape' && !event.isComposing) {
        event.preventDefault(); this.clear(); this.input.blur();
      }
    });
    document.addEventListener('keydown', event => {
      if (event.target.closest('input, textarea, select, [contenteditable], dialog') || isArranging || isInspecting) return;
      if (event.key === '/' || ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k')) {
        event.preventDefault(); this.input.focus(); this.input.select();
      } else if (event.key === 'Escape' && !event.defaultPrevented && !stripArrangement.ownsStripGesture) this.clear();
    });
    window.addEventListener('resize', () => this.resize());
    this.motion.addEventListener('change', () => this.stopAnimations());
  }

  get active() { return this.sleeves.length > 0; }
  get busy() { return Boolean(this.navigating || this.assembling); }
  get matches() { return [...this.batches].sort(([a], [b]) => a - b).flatMap(([, photos]) => photos); }

  visibleIndices() { return this.visibleLeaves().map(leaf => this.sleeves.indexOf(leaf)).filter(index => index >= 0); }

  visibleLeaves() {
    const leaves = this.active ? this.layout : [...pages];
    const current = pageFlip.getCurrentPageIndex();
    const spread = pageFlip.getOrientation() === 'landscape' && (this.active || current > 0);
    return leaves.slice(current, current + (spread ? 2 : 1));
  }

  message(text) {
    this.status.textContent = text; this.status.hidden = !text;
    document.body.classList.toggle('has-book-search', Boolean(text));
  }

  updateControls() {
    document.body.classList.toggle('has-search-matches', this.active);
    previousButton.setAttribute('aria-label', this.active ? 'Previous search results' : 'Previous page');
    nextButton.setAttribute('aria-label', this.active ? 'Next batch of search results' : 'Next page');
    this.retryButton.hidden = true;
    if (this.busy) { previousButton.disabled = true; nextButton.disabled = true; }
    if (!this.active || this.mounting) return;
    const visible = this.visibleIndices();
    if (visible.length) this.cursor = visible[0];
    const loading = visible.some(index => !this.batches.has(index));
    const error = visible.map(index => this.errors.get(index)).find(Boolean);
    const busy = isTurning || isArranging || isInspecting || this.busy;
    previousButton.disabled = busy || this.cursor === 0;
    nextButton.disabled = busy || loading || visible.at(-1) >= this.sleeves.length - 1;
    const start = this.cursor * 35 + 1, end = Math.min((this.cursor + visible.length) * 35, this.total);
    pageStatus.textContent = `${String(start).padStart(2, '0')}–${String(end).padStart(2, '0')} / ${this.total}`;
    if (!this.request && !this.busy) {
      this.retryButton.hidden = !error;
      this.message(error || (loading ? 'Loading photographs…'
        : end === this.total ? 'End of search results' : 'Search results · Each sleeve in book order'));
    }
    if (!busy) queueMicrotask(() => { this.preparePages(); this.reveal(); });
  }

  cancelPageRequests() {
    for (const request of this.pageRequests.values()) request.abort();
    this.pageRequests.clear(); this.errors.clear();
  }

  async fetchBatch(query, index, signal) {
    const response = await fetch(`/api/search?q=${encodeURIComponent(query)}&offset=${index * 35}&limit=35`, { signal });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Search is unavailable.');
    if (!Number.isInteger(data.total) || data.total < 0 || data.total > this.frames.size || !Array.isArray(data.photos))
      throw new Error('Invalid search response. Restart the local search server.');
    const photos = selectSearchPhotos(data.photos, this.order);
    if (photos.length !== Math.max(0, Math.min(35, data.total - index * 35)))
      throw new Error('Incomplete search batch. Please retry.');
    return { photos, total: data.total };
  }

  preparePages() {
    if (!this.active || this.request || this.busy || this.mounting || isTurning || isInspecting) return;
    const visible = this.visibleIndices();
    if (!visible.length) return;
    // Empty sleeve shells keep native page gestures intact. Only the visible
    // leaves and one spread ahead acquire photo nodes and decoded images.
    const ahead = pageFlip.getOrientation() === 'landscape' ? 2 : 1;
    const end = Math.min(this.sleeves.length - 1, visible.at(-1) + ahead);
    for (let index = visible[0]; index <= end; index++) {
      if (!this.batches.has(index) && !this.pageRequests.has(index) && !this.errors.has(index)) this.loadSleeve(index);
    }
  }

  async loadSleeve(index) {
    const ticket = this.generation, request = new AbortController();
    this.pageRequests.set(index, request);
    try {
      const data = await this.fetchBatch(this.queryText, index, request.signal);
      if (ticket !== this.generation) return;
      if (data.total !== this.total) throw new Error('Search results changed. Please search again.');
      const ready = this.makeSleeve(data.photos, index);
      await Promise.all([...ready.querySelectorAll('img')].map(img => img.decode().catch(() => {})));
      while (this.busy && ticket === this.generation) await new Promise(resolve => setTimeout(resolve, 32));
      if (!await this.rest(ticket)) return;
      const known = new Set(this.matches.map(photo => photo.id));
      if (data.photos.some(photo => known.has(photo.id))) throw new Error('Duplicate search batch. Please retry.');
      const leaf = this.sleeves[index];
      leaf.querySelector('.sleeve').replaceWith(ready.querySelector('.sleeve'));
      leaf.setAttribute('aria-label', ready.getAttribute('aria-label'));
      leaf.setAttribute('aria-busy', 'false');
      leaf.classList.remove('is-pending-results');
      this.batches.set(index, data.photos);
    } catch (error) {
      if (ticket === this.generation && error.name !== 'AbortError') this.errors.set(index,
        error instanceof TypeError || error instanceof SyntaxError ? 'Local search is offline. Please retry.' : error.message);
    } finally {
      if (ticket === this.generation) { this.pageRequests.delete(index); updateControls(); }
    }
  }

  setAssembling(value) {
    this.assembling = value; bookElement.inert = value;
    bookElement.classList.toggle('is-assembling-results', value);
    bookElement.setAttribute('aria-busy', String(value));
    updateControls();
  }

  stopAnimations() {
    for (const animation of this.animations) animation.cancel();
    this.animations.clear();
  }

  async animate(element, frames, options, hold = false) {
    const animation = element.animate(frames, { ...options, fill: 'both' });
    this.animations.add(animation);
    await animation.finished.catch(() => {});
    if (!hold) { this.animations.delete(animation); animation.cancel(); }
  }

  async rest(ticket) {
    while (isTurning || isArranging || isInspecting || stripArrangement.ownsStripGesture || stripArrangement.pageGesture) {
      await new Promise(resolve => setTimeout(resolve, 32));
      if (ticket !== this.generation) return false;
      if (!stripArrangement.pageGesture && !stripArrangement.ownsStripGesture) settlePageCorner();
    }
    return ticket === this.generation;
  }

  makeSleeve(matches, index) {
    const page = document.createElement('article');
    page.className = 'book-page sleeve-page recto is-awaiting-results';
    page.setAttribute('aria-label', `Search sleeve ${index + 1}` + (matches.length
      ? `, results ${index * 35 + 1} through ${index * 35 + matches.length}` : ', loading photographs'));
    page.classList.toggle('is-pending-results', !matches.length);
    page.setAttribute('aria-busy', String(!matches.length));
    page.append(pages[2].querySelector('.binder-holes').cloneNode(true));
    const sleeve = document.createElement('div'); sleeve.className = 'sleeve';
    for (let row = 0; row < 7; row++) {
      const pocket = document.createElement('div'); pocket.className = 'film-pocket';
      const photos = matches.slice(row * 5, row * 5 + 5);
      if (photos.length) {
        const strip = document.createElement('div'); strip.className = 'film-strip';
        for (let column = 0; column < 5; column++) {
          const frame = photos[column] ? this.frames.get(photos[column].id).cloneNode(true) : document.createElement('span');
          if (photos[column]) {
            frame.classList.add('is-search-match'); frame.setAttribute('aria-expanded', 'false');
            frame.querySelector('img').loading = 'eager';
          } else { frame.className = 'negative-frame is-empty'; frame.setAttribute('aria-hidden', 'true'); }
          strip.append(frame);
        }
        pocket.append(strip);
      }
      sleeve.append(pocket);
    }
    page.append(sleeve); return page;
  }

  mount(leaves, showCover, target) {
    this.mounting = true;
    // Reset the index before shortening the book. Original DOM nodes, their
    // photographs, and any saved strip arrangement remain untouched offscreen.
    pageFlip.turnToPage(0);
    pageFlip.getSettings().showCover = showCover;
    toneLeaves = leaves.filter(page => !page.classList.contains('binder-cover'));
    pageFlip.updateFromHtml(leaves);
    pageFlip.turnToPage(target);
    this.mounting = false; updateControls();
  }

  mountResults(cursor = 0) {
    this.layoutMode = pageFlip.getOrientation();
    const landscape = this.layoutMode === 'landscape';
    this.sleeves.forEach((page, index) => {
      page.classList.toggle('verso', landscape && index % 2 === 1);
      page.classList.toggle('recto', !landscape || index % 2 === 0);
    });
    this.layout = [...this.sleeves];
    if (landscape) {
      const blank = () => {
        const page = document.createElement('article');
        page.className = 'book-page opening-blank'; page.setAttribute('aria-label', 'Blank sleeve'); return page;
      };
      this.layout.unshift(blank());
      if (this.layout.length % 2) this.layout.push(blank());
    }
    this.mount(this.layout, false, cursor + (landscape ? 1 : 0));
  }

  async fadeFilms(ticket) {
    const strips = this.visibleLeaves().flatMap(leaf => [...leaf.querySelectorAll('.film-strip')]);
    await Promise.all(strips.map((strip, index) => this.animate(strip, [
      { opacity: 1, transform: 'translate3d(0,0,0)' },
      { opacity: 0, transform: this.motion.matches ? 'none' : 'translate3d(0,9px,0)' },
    ], { duration: this.motion.matches ? 100 : 230, delay: this.motion.matches ? 0 : index * 12, easing: 'ease-in' }, true)));
    return ticket === this.generation;
  }

  async reveal() {
    if (!this.active || this.busy || isTurning || isInspecting || this.mounting) return;
    const leaves = this.visibleLeaves().filter(leaf => leaf.classList.contains('is-awaiting-results') && !leaf.classList.contains('is-pending-results'));
    if (!leaves.length) return;
    const ticket = this.generation;
    this.setAssembling(true);
    const flights = [];
    for (const leaf of leaves) {
      const strips = [...leaf.querySelectorAll('.film-strip')];
      const rect = leaf.getBoundingClientRect();
      strips.forEach((strip, index) => {
        const slot = strip.getBoundingClientRect();
        const x = (leaf.classList.contains('verso') ? 1 : -1) * slot.width * .14;
        const y = rect.top + rect.height * .56 - slot.top;
        flights.push(this.animate(strip, this.motion.matches ? [{ opacity: 0 }, { opacity: 1 }] : [
          { opacity: 0, transform: `translate3d(${x}px,${y}px,0) rotate(${(index - 3) * .55}deg) scale(.96)` },
          { opacity: 1, offset: .2 },
          { opacity: 1, transform: 'translate3d(0,0,0) rotate(0deg) scale(1)' },
        ], { duration: this.motion.matches ? 140 : 820, delay: this.motion.matches ? 0 : index * 48,
          easing: 'cubic-bezier(.18,1,.28,1)' }));
      });
      leaf.classList.remove('is-awaiting-results');
    }
    await Promise.all(flights);
    if (ticket === this.generation) this.setAssembling(false);
  }

  async restore(ticket) {
    if (!await this.rest(ticket)) return false;
    if (this.active) {
      this.cancelPageRequests();
      this.sleeves = []; this.layout = []; this.batches.clear(); this.total = 0; this.cursor = 0;
      this.mount([...pages], true, this.returnPage ?? 2);
    } else if (this.returnPage != null) pageFlip.turnToPage(this.returnPage);
    this.returnPage = null;
    return true;
  }

  async clear() {
    this.cancelPageRequests();
    this.request?.abort(); this.request = null;
    const ticket = ++this.generation;
    this.stopAnimations(); this.navigating = true; this.setAssembling(false);
    this.input.value = ''; this.clearButton.hidden = true;
    this.form.removeAttribute('aria-busy'); this.message('');
    if (!await this.restore(ticket)) return;
    this.returnPage = null;
    this.navigating = false; this.message(''); updateControls();
  }

  async search() {
    const query = this.input.value.trim();
    if (!query) { this.clear(); return; }
    this.cancelPageRequests();
    this.request?.abort();
    const request = new AbortController(), ticket = ++this.generation;
    this.request = request; this.stopAnimations();
    this.navigating = false; this.setAssembling(false);
    this.clearButton.hidden = false; this.form.setAttribute('aria-busy', 'true');
    this.message('Searching your archive…');
    try {
      this.order = new Map([...pages].flatMap(page => [...page.querySelectorAll('button.negative-frame')])
        .map((frame, index) => [frame.dataset.frame, index]));
      const data = await this.fetchBatch(query, 0, request.signal);
      if (ticket !== this.generation) return;
      const matches = data.photos;
      this.navigating = true; updateControls();
      if (!matches.length) {
        if (await this.restore(ticket)) this.message('No matching photos. Try another keyword.');
        return;
      }
      const sleeves = [];
      for (let index = 0; index < Math.ceil(data.total / 35); index++) sleeves.push(this.makeSleeve(index === 0 ? matches : [], index));
      await Promise.all(sleeves.flatMap(leaf => [...leaf.querySelectorAll('img')]).map(img => img.decode().catch(() => {})));
      if (!await this.rest(ticket)) return;
      if (!this.active && this.returnPage == null) this.returnPage = pageFlip.getCurrentPageIndex();
      this.message('Gathering your photographs…');
      const first = this.active ? (this.layoutMode === 'landscape' ? 1 : 0) : 2;
      if (this.motion.matches) pageFlip.turnToPage(first);
      else pageFlip.flip(first, 'bottom');
      if (!await this.rest(ticket)) return;
      this.setAssembling(true);
      if (!await this.fadeFilms(ticket)) return;
      this.stopAnimations();
      this.batches = new Map([[0, matches]]); this.total = data.total; this.queryText = query;
      this.sleeves = sleeves; this.cursor = 0;
      this.mountResults();
      await new Promise(resolve => requestAnimationFrame(resolve));
      if (ticket !== this.generation) return;
      this.navigating = false; this.setAssembling(false);
      await this.reveal();
    } catch (error) {
      if (error.name !== 'AbortError' && ticket === this.generation) {
        this.stopAnimations();
        await this.restore(ticket);
        if (ticket === this.generation) this.message(error instanceof SyntaxError || error instanceof TypeError
          ? 'Local search is offline. Start archive_server.py to connect.' : error.message);
      }
    } finally {
      if (ticket === this.generation) {
        this.request = null; this.navigating = false; this.setAssembling(false);
        this.form.removeAttribute('aria-busy');
      }
    }
  }

  move(direction) {
    const visible = this.visibleIndices();
    if (visible.length) this.go(direction > 0 ? visible.at(-1) + 1 : visible[0] - 1);
  }

  go(index) {
    if (!this.active || this.busy || isTurning || isInspecting || index < 0 || index >= this.sleeves.length) return;
    const target = this.layout.indexOf(this.sleeves[index]);
    if (this.motion.matches) pageFlip.turnToPage(target);
    else pageFlip.flip(target, 'bottom');
  }

  resize() {
    this.stopAnimations();
    clearTimeout(this.resizeTimer);
    this.resizeTimer = setTimeout(async () => {
      const ticket = this.generation;
      while (this.busy && ticket === this.generation) await new Promise(resolve => setTimeout(resolve, 32));
      if (!await this.rest(ticket) || !this.active || this.layoutMode === pageFlip.getOrientation()) return;
      this.mountResults(this.cursor);
    }, 50);
  }
}

if (typeof document !== 'undefined') archiveSearch = new ArchiveSearch();

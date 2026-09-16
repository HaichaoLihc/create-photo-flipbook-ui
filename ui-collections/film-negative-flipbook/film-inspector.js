/* One reversible, compositor-driven flight from the original film to the viewer. */
class FilmInspector {
  constructor({ canOpen, onBusyChange }) {
    this.canOpen = canOpen;
    this.onBusyChange = onBusyChange;
    this.state = 'idle';
    this.motion = matchMedia('(prefers-reduced-motion: reduce)');
    this.dialog = document.createElement('dialog');
    this.dialog.id = 'film-inspector';
    this.dialog.setAttribute('aria-label', 'Inspect a film exposure');
    this.dialog.innerHTML = `<div class="inspect-shade"></div>
      <div class="inspect-scene"><button class="inspect-flight" type="button" aria-label="Return this exposure to its sleeve"><span class="inspect-tilt"><span class="inspect-card"><span class="inspect-material"></span></span></span></button></div>
      <div class="inspect-ui"><div class="inspect-actions"><button class="inspect-flip" type="button" aria-keyshortcuts="F" aria-pressed="false" disabled>Turn over <span aria-hidden="true">↻</span></button><button class="inspect-return" type="button" autofocus>Return to sleeve <span aria-hidden="true">↙</span></button></div>
        <p class="inspect-caption"><span id="inspect-number"></span><span id="inspect-side" aria-live="polite">BASE · GLOSS</span><span>F TO TURN · ESC TO RETURN</span></p></div>`;
    document.body.append(this.dialog);
    this.flight = this.dialog.querySelector('.inspect-flight');
    this.card = this.dialog.querySelector('.inspect-card');
    this.tilt = this.dialog.querySelector('.inspect-tilt');
    this.material = this.dialog.querySelector('.inspect-material');
    this.flipButton = this.dialog.querySelector('.inspect-flip');
    this.sideLabel = this.dialog.querySelector('#inspect-side');
    this.shade = this.dialog.querySelector('.inspect-shade');
    this.ui = this.dialog.querySelector('.inspect-ui');
    this.dialog.addEventListener('click', () => this.close());
    this.dialog.addEventListener('cancel', event => { event.preventDefault(); this.close(); });
    this.dialog.addEventListener('close', () => { if (!this.dialog.open) this.finish(); });
    this.flipButton.addEventListener('click', event => { event.stopPropagation(); this.flip(); });
    this.dialog.addEventListener('keydown', event => {
      if (event.key.toLowerCase() === 'f' && !event.altKey && !event.ctrlKey && !event.metaKey && !event.isComposing) {
        event.preventDefault(); event.stopPropagation(); this.flip();
      }
    });
    this.flight.addEventListener('pointermove', event => {
      if (this.state !== 'open' || this.motion.matches || event.pointerType === 'touch') return;
      const { width, height, left, top } = this.bounds;
      this.lightTarget = { x: Math.max(-1, Math.min(1, (event.clientX - left) / width * 2 - 1)),
        y: Math.max(-1, Math.min(1, (event.clientY - top) / height * 2 - 1)) };
      if (!this.lightFrame) this.lightFrame = requestAnimationFrame(time => this.followLight(time));
    });
    this.flight.addEventListener('pointerleave', () => {
      this.lightTarget = { x: 0, y: 0 };
      if (this.state === 'open' && !this.lightFrame) this.lightFrame = requestAnimationFrame(time => this.followLight(time));
    });
    // The page renderer must not respond to movement or releases inside the viewer.
    for (const type of ['mousedown', 'mousemove', 'mouseup', 'touchstart', 'touchmove', 'touchend']) {
      this.dialog.addEventListener(type, event => event.stopPropagation());
    }
    window.addEventListener('resize', () => this.finish());
    this.motion.addEventListener('change', () => this.finish());
  }

  open(frame) {
    if (this.state !== 'idle' || !this.canOpen()) return;
    const source = frame.querySelector('img');
    const rect = frame.getBoundingClientRect();
    const strip = frame.closest('.film-strip');
    const stripRect = strip.getBoundingClientRect();
    if (!source || !rect.width || !stripRect.height) return;

    this.exposureRevision = (this.exposureRevision || 0) + 1;
    const exposure = this.exposureRevision;
    this.state = 'opening'; this.source = frame; this.strip = strip;
    const imageStyle = getComputedStyle(source);
    this.sourceAppearance = { filter: imageStyle.filter, opacity: imageStyle.opacity, transform: imageStyle.transform };
    const gutter = Math.min(1, Math.max(0, rect.left - stripRect.left));
    const sourceWidth = rect.width + gutter + Math.min(1, Math.max(0, stripRect.right - rect.right));
    const ratio = sourceWidth / stripRect.height;
    const width = Math.max(1, Math.min(900, innerWidth - 40, Math.max(48, innerHeight - 156) * ratio));
    const height = width / ratio;
    const scale = width / sourceWidth;
    const x = rect.left - gutter, y = stripRect.top;
    const endX = (innerWidth - width) / 2, endY = (innerHeight - height) / 2;
    this.bounds = { width, height, left: endX, top: endY };
    this.emulsionFacing = false; this.sideRevision = 0;
    this.updateSide(); this.resetLight();
    const rail = (rect.top - stripRect.top) * scale;
    const holeOffset = (((stripRect.width - 8) / 2) % 8 - (x - stripRect.left)) * scale;
    Object.assign(this.flight.style, { width: `${width}px`, height: `${height}px` });
    this.flight.style.setProperty('--inspect-rail', `${rail}px`);
    this.flight.style.setProperty('--inspect-border', `${gutter * scale}px`);
    this.flight.style.setProperty('--inspect-pitch', `${8 * scale}px`);
    this.flight.style.setProperty('--inspect-hole-offset', `${holeOffset}px`);
    this.material.replaceChildren();
    for (const side of ['front', 'back']) {
      const face = document.createElement('span');
      face.className = `inspect-face inspect-${side}`;
      face.dataset.surface = side === 'front' ? 'emulsion' : 'base';
      face.setAttribute('aria-hidden', 'true');
      const window = document.createElement('span');
      window.className = 'inspect-image';
      const image = source.cloneNode();
      image.src = source.currentSrc || source.src;
      image.loading = 'eager'; image.draggable = false; image.alt = '';
      if (side === 'front') {
        Object.assign(image.style, this.sourceAppearance);
        this.emulsionImage = image;
      }
      const sheen = document.createElement('span'); sheen.className = 'inspect-sheen';
      const reflection = document.createElement('span'); reflection.className = 'inspect-reflection';
      sheen.append(reflection);
      window.append(image, sheen); face.append(window); this.material.append(face);
    }
    this.reflections = [...this.material.querySelectorAll('.inspect-reflection')];
    this.dialog.querySelector('#inspect-number').textContent = `EXPOSURE / ${frame.dataset.frame}`;
    this.dialog.setAttribute('aria-label', `Exposure ${frame.dataset.frame}. ${source.alt}`);
    frame.setAttribute('aria-expanded', 'true');
    document.body.classList.add('is-inspecting-film');
    this.onBusyChange(true);
    this.dialog.showModal();

    // Cut this exact segment out of the source strip, including both perforated rails.
    strip.style.setProperty('--extracted-start', `${x - stripRect.left}px`);
    strip.style.setProperty('--extracted-end', `${x - stripRect.left + sourceWidth}px`);
    strip.classList.add('has-extracted-frame');
    const transform = (x, y, s, tilt = 0) => `translate3d(${x}px, ${y}px, 0) scale(${s}) rotate(${tilt}deg)`;
    const start = transform(x, y, 1 / scale);
    const end = transform(endX, endY, 1);
    const duration = this.motion.matches ? 140 : 940;
    const options = { duration, fill: 'both' };
    const travel = this.flight.animate(this.motion.matches ? [{ transform: end, opacity: 0 }, { transform: end, opacity: 1 }] : [
      { transform: start, offset: 0, easing: 'cubic-bezier(.3,.6,.3,1)' },
      { transform: transform(x + (endX - x) * .06, y - 18, 1.15 / scale, -1.1), offset: .16, easing: 'cubic-bezier(.18,1,.3,1)' },
      { transform: end, offset: 1 },
    ], options);
    const turn = this.card.animate(this.motion.matches ? [{ transform: 'rotateY(180deg)' }, { transform: 'rotateY(180deg)' }] : [
      { transform: 'rotateY(0deg) rotateX(0deg)', offset: 0 },
      { transform: 'rotateY(0deg) rotateX(-3deg)', offset: .12, easing: 'cubic-bezier(.35,0,.18,1)' },
      { transform: 'rotateY(180deg) rotateX(0deg)', offset: 1 },
    ], options);
    const shade = this.shade.animate([{ opacity: 0 }, { opacity: 1, offset: .7 }, { opacity: 1 }], options);
    const ui = this.ui.animate([{ opacity: 0 }, { opacity: 0, offset: .65 }, { opacity: 1 }], options);
    this.animations = [travel, turn, shade, ui];
    if (!this.motion.matches) {
      for (const sheen of this.material.querySelectorAll('.inspect-sheen')) this.animations.push(sheen.animate([
        { transform: 'translateX(-20%)', opacity: 0 },
        { transform: 'translateX(-8%)', opacity: .65, offset: .35 },
        { transform: 'translateX(0)', opacity: 1 },
      ], options));
    }
    // Reversing uses these same timelines, including an interrupted opening.
    travel.finished.then(() => {
      if (this.state !== 'opening' || exposure !== this.exposureRevision) return;
      this.state = 'open'; this.flipButton.disabled = false;
      // The base is the normal reading side. Looking through the emulsion side
      // mirrors that same image; it does not turn a negative into a positive.
      Object.assign(this.emulsionImage.style, { filter: 'none', opacity: '1', transform: 'scaleX(-1)' });
    }).catch(() => {});
  }

  updateSide() {
    this.sideLabel.textContent = this.emulsionFacing ? 'EMULSION · SATIN' : 'BASE · GLOSS';
    this.flipButton.setAttribute('aria-pressed', String(this.emulsionFacing));
    this.flipButton.setAttribute('aria-label', this.emulsionFacing ? 'Turn to the glossy base side' : 'Turn to the satin emulsion side');
  }

  flip() {
    if (this.state !== 'open') return;
    this.emulsionFacing = !this.emulsionFacing;
    const exposure = this.exposureRevision;
    const revision = ++this.sideRevision;
    if (this.motion.matches) {
      this.sideTurn?.cancel();
      this.material.style.transform = this.emulsionFacing ? 'rotateY(180deg)' : 'rotateY(0deg)';
      this.sideTurn = this.material.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 140 });
    } else if (this.sideTurn) this.sideTurn.reverse();
    else this.sideTurn = this.material.animate([{ transform: 'rotateY(0deg)' }, { transform: 'rotateY(180deg)' }],
      { duration: 620, easing: 'cubic-bezier(.3,.65,.2,1)', fill: 'both' });
    this.flipButton.setAttribute('aria-pressed', String(this.emulsionFacing));
    this.sideTurn.finished.then(() => {
      if (revision !== this.sideRevision || exposure !== this.exposureRevision || this.state !== 'open') return;
      if (!this.emulsionFacing || this.motion.matches) { this.sideTurn.cancel(); this.sideTurn = null; }
      this.updateSide();
    }).catch(() => {});
  }

  followLight(time) {
    this.lightFrame = 0;
    if (this.state !== 'open' || this.motion.matches) return;
    const dt = Math.min(32, time - (this.lightTime || time - 16)); this.lightTime = time;
    const blend = 1 - Math.exp(-dt / 75);
    this.light.x += (this.lightTarget.x - this.light.x) * blend;
    this.light.y += (this.lightTarget.y - this.light.y) * blend;
    const { x, y } = this.light;
    this.tilt.style.transform = `rotateX(${-y * 3}deg) rotateY(${x * 5}deg)`;
    this.reflections.forEach((reflection, index) => {
      const base = index === 1;
      reflection.style.transform = `translate3d(${x * (base ? 18 : 6)}%,${y * (base ? 10 : 5)}%,0)`;
      reflection.style.opacity = String((base ? .28 : .17) + Math.hypot(x, y) * (base ? .13 : .025));
    });
    if (Math.abs(this.lightTarget.x - x) + Math.abs(this.lightTarget.y - y) > .002)
      this.lightFrame = requestAnimationFrame(nextTime => this.followLight(nextTime));
  }

  resetLight() {
    cancelAnimationFrame(this.lightFrame); this.lightFrame = 0; this.lightTime = 0;
    this.light = { x: 0, y: 0 }; this.lightTarget = { x: 0, y: 0 };
    this.tilt.style.removeProperty('transform');
    for (const reflection of this.reflections || []) reflection.removeAttribute('style');
  }

  async close() {
    if (this.state !== 'open' && this.state !== 'opening') return;
    const exposure = this.exposureRevision;
    this.state = 'closing'; this.flipButton.disabled = true; this.sideRevision++;
    cancelAnimationFrame(this.lightFrame); this.lightFrame = 0;
    const neutral = [];
    if (this.tilt.style.transform) neutral.push(this.tilt.animate([
      { transform: this.tilt.style.transform }, { transform: 'rotateX(0deg) rotateY(0deg)' },
    ], { duration: this.motion.matches ? 0 : 180, fill: 'forwards' }));
    if (this.sideTurn || this.emulsionFacing) {
      const from = getComputedStyle(this.material).transform;
      this.sideTurn?.cancel(); this.sideTurn = null;
      this.material.style.transform = 'rotateY(0deg)';
      neutral.push(this.material.animate([{ transform: from }, { transform: 'rotateY(0deg)' }],
        { duration: this.motion.matches ? 0 : 340, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' }));
    }
    this.neutralAnimations = neutral;
    if (neutral.length) await Promise.all(neutral.map(animation => animation.finished.catch(() => {})));
    if (this.state !== 'closing' || exposure !== this.exposureRevision) return;
    neutral.forEach(animation => animation.cancel()); this.neutralAnimations = [];
    this.resetLight();
    Object.assign(this.emulsionImage.style, this.sourceAppearance);
    for (const animation of this.animations) animation.reverse();
    this.animations[0].finished.then(() => {
      if (this.state === 'closing' && exposure === this.exposureRevision) this.finish();
    }).catch(() => {});
  }

  finish() {
    if (this.state === 'idle') return;
    this.state = 'idle';
    this.exposureRevision++;
    this.sideRevision++; this.flipButton.disabled = true;
    this.sideTurn?.cancel(); this.sideTurn = null;
    for (const animation of this.neutralAnimations || []) animation.cancel();
    this.neutralAnimations = [];
    this.material.style.removeProperty('transform');
    this.resetLight();
    for (const animation of this.animations || []) animation.cancel();
    this.animations = [];
    this.strip?.classList.remove('has-extracted-frame');
    this.strip?.style.removeProperty('--extracted-start');
    this.strip?.style.removeProperty('--extracted-end');
    this.source?.setAttribute('aria-expanded', 'false');
    document.body.classList.remove('is-inspecting-film');
    if (this.dialog.open) this.dialog.close();
    this.material.replaceChildren(); this.reflections = []; this.emulsionImage = null;
    if (this.source?.isConnected) this.source.focus({ preventScroll: true });
    this.source = null; this.strip = null;
    this.onBusyChange(false);
  }
}

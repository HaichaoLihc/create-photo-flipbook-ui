(() => {
  'use strict';
  const stage = document.getElementById('collection');
  const orbit = document.getElementById('orbit');
  const cards = [...document.querySelectorAll('.work')];
  const buttons = [...document.querySelectorAll('[data-view]')];
  const counter = document.querySelector('.counter');
  const captionCategory = document.querySelector('.caption-category');
  const captionPlace = document.querySelector('.caption-place');
  const captionPeriod = document.querySelector('.caption-period');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const { wrap, relative, pose } = window.LifeRingLayout;
  const count = cards.length;
  const states = cards.map(() => null);
  let view = 'flat';
  let position = 0;
  let targetPosition = 0;
  let width = 0;
  let height = 0;
  let centerY = 0;
  let fullHeight = 0;
  let pointer = null;
  let drag = null;
  let frame = 0;
  let lastTime = 0;
  let active = -1;

  function render(instant = false, elapsed = 16.67) {
    const immediate = instant || reducedMotion.matches;
    const rotationEase = immediate ? 1 : 1 - Math.exp(-elapsed / 95);
    const layoutEase = immediate ? 1 : 1 - Math.exp(-elapsed / 135);
    position += (targetPosition - position) * rotationEase;
    let moving = Math.abs(targetPosition - position) > 0.0001;
    const current = wrap(Math.round(position), count);
    if (current !== active) {
      active = current;
      counter.textContent = `${String(current + 1).padStart(2, '0')} — ${String(count).padStart(2, '0')}`;
      counter.setAttribute('aria-label', `当前照片 ${current + 1}，共 ${count} 张`);
      const memory = cards[current].dataset;
      captionCategory.textContent = memory.category;
      captionPlace.textContent = memory.place;
      captionPeriod.textContent = memory.period;
    }

    cards.forEach((card, index) => {
      const distance = relative(index, position, count);
      const next = pose(view, distance, width, height);
      next.y += centerY - fullHeight / 2;
      if (next.opacity <= 0) {
        card.style.visibility = 'hidden';
        card.setAttribute('aria-hidden', 'true');
        states[index] = null;
        return;
      }
      if (pointer && !drag && !reducedMotion.matches && (view === 'flat' || view === 'ring')) {
        const dx = width / 2 + next.x - pointer.x;
        const dy = fullHeight / 2 + next.y - pointer.y;
        const length = Math.hypot(dx, dy);
        const reach = Math.min(width, height) * 0.20;
        if (length > 0.1 && length < reach) {
          const force = Math.pow(1 - length / reach, 2) * reach * 0.24;
          next.x += dx / length * force;
          next.y += dy / length * force;
        }
      }
      let currentState = states[index];
      if (!currentState) currentState = states[index] = { ...next, opacity: immediate ? next.opacity : 0 };
      for (const key of ['x', 'y', 'size', 'tilt', 'opacity']) {
        currentState[key] += (next[key] - currentState[key]) * layoutEase;
        moving ||= Math.abs(next[key] - currentState[key]) > (key === 'opacity' ? 0.002 : 0.03);
      }
      card.style.visibility = 'visible';
      card.removeAttribute('aria-hidden');
      card.style.opacity = currentState.opacity.toFixed(3);
      card.style.zIndex = String(Math.round((next.depth + 10) * 100));
      card.style.transform = `translate(-50%, -50%) translate3d(${currentState.x.toFixed(3)}px, ${currentState.y.toFixed(3)}px, 0) perspective(900px) rotateY(${currentState.tilt.toFixed(2)}deg) scale(${(currentState.size / 180).toFixed(5)})`;
    });
    return moving;
  }

  function animate(now) {
    const elapsed = lastTime ? Math.min(now - lastTime, 50) : 16.67;
    lastTime = now;
    if (render(false, elapsed)) frame = requestAnimationFrame(animate);
    else {
      frame = 0;
      lastTime = 0;
      // Rebase after settling, so long browsing sessions retain numeric precision.
      if (Math.abs(position) > count * 10) {
        const laps = Math.floor(position / count) * count;
        position -= laps;
        targetPosition -= laps;
      }
    }
  }
  function wake() { if (!frame) frame = requestAnimationFrame(animate); }
  function resize() {
    const bounds = stage.getBoundingClientRect();
    const top = document.querySelector('.header').getBoundingClientRect().bottom + 15;
    const bottom = bounds.height - document.querySelector('.footer').getBoundingClientRect().top + 15;
    width = bounds.width;
    fullHeight = bounds.height;
    height = Math.max(160, bounds.height - top - bottom);
    centerY = top + height / 2;
    render(true);
    orbit.classList.add('is-ready');
    wake();
  }
  function switchView(nextView) {
    if (!buttons.some(button => button.dataset.view === nextView)) return;
    view = nextView;
    stage.dataset.view = view;
    pointer = null;
    buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.view === view)));
    wake();
  }
  buttons.forEach(button => button.addEventListener('click', () => switchView(button.dataset.view)));

  stage.addEventListener('wheel', event => {
    if (event.ctrlKey) return;
    event.preventDefault();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    targetPosition += Math.max(-180, Math.min(180, delta * unit)) * 0.006;
    pointer = null;
    wake();
  }, { passive: false });
  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: targetPosition };
    stage.setPointerCapture(event.pointerId);
    pointer = null;
  });
  stage.addEventListener('pointermove', event => {
    if (drag && event.pointerId === drag.id) {
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      targetPosition = drag.start + (-dx + (view === 'gallery' ? 0 : dy)) / Math.max(65, Math.min(width, height) * 0.14);
    } else if (event.pointerType === 'mouse') pointer = { x: event.clientX, y: event.clientY };
    wake();
  });
  function stopDrag(event) {
    if (!drag || event.pointerId !== drag.id) return;
    drag = null;
    pointer = null;
    if (stage.hasPointerCapture(event.pointerId)) stage.releasePointerCapture(event.pointerId);
    wake();
  }
  stage.addEventListener('pointerup', stopDrag);
  stage.addEventListener('pointercancel', stopDrag);
  stage.addEventListener('lostpointercapture', stopDrag);
  stage.addEventListener('pointerleave', () => { pointer = null; wake(); });
  document.addEventListener('keydown', event => {
    if (event.altKey || event.metaKey || event.ctrlKey) return;
    const forward = ['ArrowRight', 'ArrowDown'].includes(event.key);
    const backward = ['ArrowLeft', 'ArrowUp'].includes(event.key);
    if (forward || backward) {
      event.preventDefault();
      if (event.target.closest('.views')) {
        const index = buttons.findIndex(button => button.dataset.view === view);
        const button = buttons[wrap(index + (forward ? 1 : -1), buttons.length)];
        switchView(button.dataset.view);
        button.focus();
      } else {
        targetPosition = Math.round(targetPosition) + (forward ? 1 : -1);
        pointer = null;
        wake();
      }
    } else if (event.key === 'Home') {
      event.preventDefault();
      targetPosition = Math.round(position / count) * count;
      pointer = null;
      wake();
    }
  });
  reducedMotion.addEventListener('change', () => { render(true); wake(); });
  window.addEventListener('resize', resize);
  resize();
})();

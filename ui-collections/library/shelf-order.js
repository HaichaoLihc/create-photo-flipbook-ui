const STORAGE_KEY = "photo-flipbook-example:library:order:v1";

// Keep known IDs once, then append any books added since the last visit.
export function restoreOrder(ids, saved) {
  const remaining = new Set(ids);
  const result = [];
  if (Array.isArray(saved)) {
    for (const id of saved) {
      if (remaining.delete(id)) result.push(id);
    }
  }
  return [...result, ...remaining];
}

export function enableShelfOrdering({ shelf, viewport, onStart, onChange }) {
  const original = [...shelf.children];
  const reset = document.querySelector(".order-reset");
  const status = document.querySelector("#shelf-status");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const volumes = () => [...shelf.children].filter((item) => item.matches(".volume:not(.volume--placeholder)"));
  let gesture = null;
  let frame = 0;
  let blockClickUntil = 0;

  function updateReset() {
    reset.hidden = volumes().every((item, index) => item === original[index]);
  }

  function save() {
    updateReset();
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(volumes().map((item) => item.dataset.bookId)));
      return true;
    } catch {
      return false;
    }
  }

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    const byId = new Map(original.map((item) => [item.dataset.bookId, item]));
    for (const id of restoreOrder([...byId.keys()], saved)) shelf.append(byId.get(id));
  } catch {
    // A malformed preference or blocked storage leaves the original order intact.
  }
  updateReset();

  function animateLayout(change) {
    const before = new Map(volumes().filter((item) => !item.hidden).map((item) => [item, item.getBoundingClientRect().left]));
    change();
    for (const item of volumes()) {
      item.getAnimations().forEach((animation) => animation.cancel());
      const distance = before.get(item) - item.getBoundingClientRect().left;
      if (reducedMotion.matches || !Number.isFinite(distance) || Math.abs(distance) < 1 || item.hidden) continue;
      item.animate([{ transform: `translateX(${distance}px)` }, { transform: "translateX(0)" }], {
        duration: 180,
        easing: "cubic-bezier(.2,.75,.25,1)",
      });
    }
  }

  function announcePlacement(item, saved) {
    const title = item.querySelector(".volume__link").dataset.title;
    const persistence = saved ? "Arrangement saved." : "Arranged for this visit; browser storage is unavailable.";
    status.textContent = `${title}, position ${volumes().indexOf(item) + 1} of ${original.length}. ${persistence}`;
  }

  function placeAtPointer() {
    const { item, placeholder, x } = gesture;
    const others = volumes().filter((volume) => volume !== item);
    const shelfLeft = shelf.getBoundingClientRect().left;
    // Layout offsets exclude the temporary animation transforms of neighboring spines.
    const next = others.find((volume) => x < shelfLeft + volume.offsetLeft + volume.offsetWidth / 2);
    const children = [...shelf.children];
    const currentNext = children.slice(children.indexOf(placeholder) + 1).find((volume) => volume !== item);
    if (next !== currentNext) animateLayout(() => shelf.insertBefore(placeholder, next ?? null));
  }

  function dragFrame(time) {
    if (gesture?.mode !== "drag") return;
    const elapsed = Math.min(32, time - (gesture.lastFrame ?? time));
    gesture.lastFrame = time;
    const bounds = viewport.getBoundingClientRect();
    const edge = Math.min(64, bounds.width / 5);
    const speed = gesture.x < bounds.left + edge
      ? -Math.min(1, (bounds.left + edge - gesture.x) / edge)
      : gesture.x > bounds.right - edge
        ? Math.min(1, (gesture.x - bounds.right + edge) / edge)
        : 0;
    viewport.scrollLeft += speed * elapsed * 0.65;
    placeAtPointer();
    const tilt = reducedMotion.matches ? 0 : Math.max(-3, Math.min(3, (gesture.x - gesture.startX) / 45));
    gesture.ghost.style.transform = `translate3d(${gesture.x - gesture.offsetX}px, ${gesture.y - gesture.offsetY - 14}px, 0) rotate(${tilt}deg)`;
    frame = requestAnimationFrame(dragFrame);
  }

  function startDrag() {
    if (gesture?.mode !== "pending") return;
    clearTimeout(gesture.hold);
    onStart();
    const { item, link } = gesture;
    item.getAnimations().forEach((animation) => animation.cancel());
    const bounds = item.getBoundingClientRect();
    const ghost = item.cloneNode(true);
    ghost.classList.add("volume--ghost");
    ghost.setAttribute("aria-hidden", "true");
    ghost.removeAttribute("data-book-id");
    ghost.style.width = `${bounds.width}px`;
    ghost.style.height = `${bounds.height}px`;
    const ghostLink = ghost.querySelector("a");
    ghostLink.removeAttribute("href");
    ghostLink.tabIndex = -1;
    document.body.append(ghost);

    const placeholder = document.createElement("li");
    placeholder.className = "volume volume--placeholder";
    placeholder.style.cssText = item.style.cssText;
    placeholder.setAttribute("aria-hidden", "true");
    shelf.insertBefore(placeholder, item);
    item.hidden = true;
    Object.assign(gesture, {
      mode: "drag",
      ghost,
      placeholder,
      offsetX: gesture.startX - bounds.left,
      offsetY: gesture.startY - bounds.top,
    });
    viewport.setPointerCapture(gesture.id);
    document.body.classList.add("is-arranging");
    status.textContent = `${link.dataset.title} picked up. Drag to a new position; Escape cancels.`;
    frame = requestAnimationFrame(dragFrame);
  }

  function finish(cancelled = false) {
    if (!gesture) return;
    const current = gesture;
    clearTimeout(current.hold);
    cancelAnimationFrame(frame);
    gesture = null;
    if (current.mode !== "pending") blockClickUntil = performance.now() + 500;
    if (viewport.hasPointerCapture(current.id)) viewport.releasePointerCapture(current.id);
    if (current.mode !== "drag") return;
    document.body.classList.remove("is-arranging");
    current.ghost.remove();
    animateLayout(() => {
      if (cancelled) current.placeholder.remove();
      else current.placeholder.replaceWith(current.item);
      current.item.hidden = false;
    });
    if (!reducedMotion.matches) {
      current.item.querySelector(".binding").animate([{ transform: "translateY(-14px)" }, { transform: "translateY(0)" }], {
        duration: 240,
        easing: "cubic-bezier(.2,.75,.25,1)",
      });
    }
    current.link.focus({ preventScroll: true });
    onChange();
    if (cancelled) status.textContent = "Move cancelled. The book is back in its original position.";
    else announcePlacement(current.item, save());
  }

  viewport.addEventListener("pointerdown", (event) => {
    const link = event.target.closest(".volume__link");
    if (!link || !event.isPrimary || event.button !== 0 || event.ctrlKey || event.metaKey || event.altKey || event.shiftKey || gesture) return;
    blockClickUntil = 0;
    gesture = {
      mode: "pending",
      id: event.pointerId,
      link,
      item: link.closest(".volume"),
      touch: event.pointerType !== "mouse",
      startX: event.clientX,
      startY: event.clientY,
      x: event.clientX,
      y: event.clientY,
      scrollLeft: viewport.scrollLeft,
    };
    if (gesture.touch) gesture.hold = setTimeout(startDrag, 340);
  });

  window.addEventListener("pointermove", (event) => {
    if (!gesture || event.pointerId !== gesture.id) return;
    gesture.x = event.clientX;
    gesture.y = event.clientY;
    if (gesture.mode === "pending" && Math.hypot(gesture.x - gesture.startX, gesture.y - gesture.startY) > 7) {
      if (gesture.touch) {
        clearTimeout(gesture.hold);
        gesture.mode = "scroll";
        viewport.setPointerCapture(gesture.id);
        onStart();
      } else {
        startDrag();
      }
    }
    if (gesture.mode === "scroll") viewport.scrollLeft = gesture.scrollLeft - (gesture.x - gesture.startX);
    if (gesture.mode !== "pending") event.preventDefault();
  }, { passive: false });

  window.addEventListener("pointerup", (event) => {
    if (event.pointerId !== gesture?.id) return;
    if (gesture.mode === "drag") {
      gesture.x = event.clientX;
      gesture.y = event.clientY;
      placeAtPointer();
    }
    finish();
  });
  window.addEventListener("pointercancel", (event) => { if (event.pointerId === gesture?.id) finish(true); });
  viewport.addEventListener("lostpointercapture", (event) => { if (event.pointerId === gesture?.id) finish(true); });
  viewport.addEventListener("dragstart", (event) => event.preventDefault());
  viewport.addEventListener("contextmenu", (event) => { if (gesture?.touch) event.preventDefault(); });
  viewport.addEventListener("click", (event) => {
    const moving = gesture !== null && gesture.mode !== "pending";
    if (!moving && performance.now() >= blockClickUntil) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    blockClickUntil = 0;
  }, true);
  window.addEventListener("blur", () => finish(true));
  window.addEventListener("pagehide", () => finish(true));
  window.addEventListener("resize", () => finish(true));

  viewport.addEventListener("keydown", (event) => {
    const link = event.target.closest(".volume__link");
    if (!link || !event.shiftKey || event.altKey || event.ctrlKey || event.metaKey || !["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    event.stopPropagation();
    if (gesture) return;
    const item = link.closest(".volume");
    const current = volumes();
    const index = current.indexOf(item);
    const next = event.key === "Home" ? 0 : event.key === "End" ? current.length - 1
      : Math.max(0, Math.min(current.length - 1, index + (event.key === "ArrowRight" ? 1 : -1)));
    if (index === next) return;
    onStart();
    animateLayout(() => shelf.insertBefore(item, next > index ? current[next].nextSibling : current[next]));
    link.focus({ preventScroll: true });
    item.scrollIntoView({ block: "nearest", inline: "nearest" });
    onChange();
    announcePlacement(item, save());
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && gesture) {
      event.preventDefault();
      finish(true);
    }
  });

  reset.addEventListener("click", () => {
    finish(true);
    onStart();
    animateLayout(() => original.forEach((item) => shelf.append(item)));
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Reset still works for this visit when storage is unavailable.
    }
    updateReset();
    original[0]?.querySelector("a").focus({ preventScroll: true });
    viewport.scrollLeft = 0;
    onChange();
    status.textContent = "Original shelf order restored.";
  });

  return {
    get busy() { return gesture !== null && gesture.mode !== "pending"; },
  };
}

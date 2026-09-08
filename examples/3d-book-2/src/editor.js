import {
  clampSceneDuration,
  elapsedBeforeScene,
  flattenScenePages,
  formatTime,
  moveScene,
  restoreTimeline,
  timelineDuration,
} from "./timeline.js";

function readStoredScenes(key) {
  try {
    return JSON.parse(window.localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function isEditableTarget(target) {
  return target instanceof Element && Boolean(target.closest("input, textarea, select, button"));
}

export function createFlipbookEditor({ book, assetUrl, onNavigate, onSceneOrderChange }) {
  const storageKey = `flipbook-studio:${book.id}:timeline-v1`;
  const refs = {
    projectTitle: document.querySelector("#project-title"),
    saveState: document.querySelector("#save-state"),
    reset: document.querySelector("#reset-project"),
    previewToggle: document.querySelector("#preview-toggle"),
    timelinePlay: document.querySelector("#timeline-play"),
    timelineTrack: document.querySelector("#timeline-track"),
    timecode: document.querySelector("#timeline-timecode"),
    sceneIndicator: document.querySelector("#scene-indicator"),
    inspectorTitle: document.querySelector("#inspector-scene-title"),
    sceneName: document.querySelector("#scene-name"),
    durationRange: document.querySelector("#scene-duration-range"),
    durationNumber: document.querySelector("#scene-duration-number"),
    eyebrow: document.querySelector("#copy-eyebrow"),
    title: document.querySelector("#copy-title"),
    body: document.querySelector("#copy-body"),
    positionButtons: [...document.querySelectorAll("[data-copy-position]")],
    moveEarlier: document.querySelector("#move-scene-earlier"),
    moveLater: document.querySelector("#move-scene-later"),
    copyPreview: document.querySelector("#copy-preview"),
    previewEyebrow: document.querySelector("#preview-eyebrow"),
    previewTitle: document.querySelector("#preview-title"),
    previewBody: document.querySelector("#preview-body"),
  };

  let scenes = restoreTimeline(book.scenes, readStoredScenes(storageKey));
  let activeIndex = 0;
  let draggedIndex = null;
  let playing = false;
  let busy = false;
  let playbackStartedAt = 0;
  let playbackFrame = null;
  let lastPlaybackPaint = -Infinity;

  refs.projectTitle.textContent = book.title;

  function activeScene() {
    return scenes[activeIndex];
  }

  function persist() {
    try {
      const serializable = scenes.map(({ id, name, duration, copy }) => ({ id, name, duration, copy }));
      window.localStorage.setItem(storageKey, JSON.stringify(serializable));
      refs.saveState.textContent = "已保存到本机";
    } catch {
      refs.saveState.textContent = "当前浏览器未允许保存";
    }
  }

  function renderCopyPreview() {
    const { copy } = activeScene();
    refs.previewEyebrow.textContent = copy.eyebrow;
    refs.previewTitle.textContent = copy.title;
    refs.previewBody.textContent = copy.body;
    refs.copyPreview.dataset.position = copy.position;
    refs.copyPreview.hidden = !copy.eyebrow && !copy.title && !copy.body;
  }

  function syncInspector() {
    const scene = activeScene();
    const movable = activeIndex > 0 && activeIndex < scenes.length - 1;
    refs.inspectorTitle.textContent = `场景 ${String(activeIndex + 1).padStart(2, "0")}`;
    refs.sceneIndicator.textContent = `场景 ${String(activeIndex + 1).padStart(2, "0")} / ${String(scenes.length).padStart(2, "0")}`;
    refs.sceneName.value = scene.name;
    refs.durationRange.value = String(scene.duration);
    refs.durationNumber.value = String(scene.duration);
    refs.eyebrow.value = scene.copy.eyebrow;
    refs.title.value = scene.copy.title;
    refs.body.value = scene.copy.body;
    refs.positionButtons.forEach((button) => {
      const selected = button.dataset.copyPosition === scene.copy.position;
      button.classList.toggle("is-selected", selected);
      button.setAttribute("aria-pressed", String(selected));
    });
    refs.moveEarlier.disabled = busy || !movable || activeIndex === 1;
    refs.moveLater.disabled = busy || !movable || activeIndex === scenes.length - 2;
    renderCopyPreview();
  }

  function paintTimelineProgress(elapsed = 0) {
    const total = timelineDuration(scenes);
    const current = Math.min(total, elapsedBeforeScene(scenes, activeIndex) + elapsed);
    refs.timecode.textContent = `${formatTime(current)} / ${formatTime(total)}`;
    const activeProgress = refs.timelineTrack.querySelector(".timeline-clip.is-active .timeline-clip__progress");
    if (activeProgress) {
      const progress = Math.min(1, elapsed / activeScene().duration);
      activeProgress.style.transform = `scaleX(${progress})`;
    }
  }

  function setActiveStyles() {
    refs.timelineTrack.querySelectorAll(".timeline-clip").forEach((clip, index) => {
      const selected = index === activeIndex;
      clip.classList.toggle("is-active", selected);
      clip.setAttribute("aria-current", selected ? "true" : "false");
      const progress = clip.querySelector(".timeline-clip__progress");
      if (progress) progress.style.transform = "scaleX(0)";
    });
    paintTimelineProgress();
  }

  function navigateTo(index, { keepPlaying = false } = {}) {
    const nextIndex = Math.min(scenes.length - 1, Math.max(0, index));
    if (!keepPlaying) pause();
    activeIndex = nextIndex;
    playbackStartedAt = performance.now();
    syncInspector();
    setActiveStyles();
    onNavigate(nextIndex);
  }

  function reorder(fromIndex, toIndex) {
    if (busy) return;
    const next = moveScene(scenes, fromIndex, toIndex);
    if (next.every((scene, index) => scene.id === scenes[index].id)) return;
    const activeId = activeScene().id;
    scenes = next;
    activeIndex = scenes.findIndex((scene) => scene.id === activeId);
    persist();
    renderTimeline();
    syncInspector();
    onSceneOrderChange(scenes, activeIndex);
  }

  function renderTimeline() {
    refs.timelineTrack.replaceChildren();
    scenes.forEach((scene, index) => {
      const clip = document.createElement("button");
      clip.type = "button";
      clip.className = "timeline-clip";
      clip.dataset.sceneIndex = String(index);
      clip.style.setProperty("--scene-duration", String(scene.duration));
      clip.draggable = index > 0 && index < scenes.length - 1;
      clip.disabled = busy;
      clip.setAttribute("aria-label", `场景 ${index + 1}：${scene.name}，${scene.duration} 秒`);

      const image = document.createElement("img");
      image.src = assetUrl(scene.pages[0]);
      image.alt = "";
      image.draggable = false;

      const shade = document.createElement("span");
      shade.className = "timeline-clip__shade";
      const number = document.createElement("span");
      number.className = "timeline-clip__number";
      number.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("strong");
      name.className = "timeline-clip__name";
      name.textContent = scene.name;
      const duration = document.createElement("span");
      duration.className = "timeline-clip__duration";
      duration.textContent = `${scene.duration}s`;
      const progress = document.createElement("span");
      progress.className = "timeline-clip__progress";

      clip.append(image, shade, number, name, duration, progress);
      clip.addEventListener("click", () => navigateTo(index));
      clip.addEventListener("dragstart", (event) => {
        draggedIndex = index;
        clip.classList.add("is-dragging");
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", String(index));
      });
      clip.addEventListener("dragend", () => {
        draggedIndex = null;
        clip.classList.remove("is-dragging");
        refs.timelineTrack.querySelectorAll(".is-drop-target").forEach((target) => target.classList.remove("is-drop-target"));
      });
      clip.addEventListener("dragover", (event) => {
        if (draggedIndex === null || index === 0 || index === scenes.length - 1) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        clip.classList.add("is-drop-target");
      });
      clip.addEventListener("dragleave", () => clip.classList.remove("is-drop-target"));
      clip.addEventListener("drop", (event) => {
        event.preventDefault();
        clip.classList.remove("is-drop-target");
        reorder(draggedIndex, index);
      });
      refs.timelineTrack.append(clip);
    });
    setActiveStyles();
  }

  function updatePlayButtons() {
    refs.previewToggle.classList.toggle("is-playing", playing);
    refs.previewToggle.setAttribute("aria-pressed", String(playing));
    refs.previewToggle.querySelector("span").textContent = playing ? "暂停预览" : "播放预览";
    refs.timelinePlay.textContent = playing ? "❚❚" : "▶";
    refs.timelinePlay.setAttribute("aria-label", playing ? "暂停时间线" : "播放时间线");
  }

  function playbackTick(timestamp) {
    playbackFrame = null;
    if (!playing) return;
    if (busy) {
      playbackStartedAt = timestamp;
      playbackFrame = requestAnimationFrame(playbackTick);
      return;
    }

    const elapsed = (timestamp - playbackStartedAt) / 1000;
    if (timestamp - lastPlaybackPaint > 80) {
      paintTimelineProgress(elapsed);
      lastPlaybackPaint = timestamp;
    }

    if (elapsed >= activeScene().duration) {
      if (activeIndex >= scenes.length - 1) {
        paintTimelineProgress(activeScene().duration);
        pause({ keepTimecode: true });
        return;
      }
      activeIndex += 1;
      playbackStartedAt = timestamp;
      syncInspector();
      setActiveStyles();
      onNavigate(activeIndex);
    }
    playbackFrame = requestAnimationFrame(playbackTick);
  }

  function play() {
    if (busy || playing) return;
    if (activeIndex >= scenes.length - 1) navigateTo(0, { keepPlaying: true });
    playing = true;
    playbackStartedAt = performance.now();
    updatePlayButtons();
    playbackFrame = requestAnimationFrame(playbackTick);
  }

  function pause({ keepTimecode = false } = {}) {
    if (!playing && playbackFrame === null) return;
    playing = false;
    if (playbackFrame !== null) cancelAnimationFrame(playbackFrame);
    playbackFrame = null;
    updatePlayButtons();
    if (!keepTimecode) paintTimelineProgress();
  }

  function togglePlayback() {
    playing ? pause() : play();
  }

  function updateDuration(value) {
    const duration = clampSceneDuration(value);
    activeScene().duration = duration;
    refs.durationRange.value = String(duration);
    refs.durationNumber.value = String(duration);
    const clip = refs.timelineTrack.children[activeIndex];
    clip?.style.setProperty("--scene-duration", String(duration));
    const durationLabel = clip?.querySelector(".timeline-clip__duration");
    if (durationLabel) durationLabel.textContent = `${duration}s`;
    persist();
    paintTimelineProgress();
  }

  function updateText(field, value) {
    activeScene().copy[field] = value;
    persist();
    renderCopyPreview();
  }

  refs.previewToggle.addEventListener("click", togglePlayback);
  refs.timelinePlay.addEventListener("click", togglePlayback);
  refs.durationRange.addEventListener("input", (event) => updateDuration(event.target.value));
  refs.durationNumber.addEventListener("input", (event) => updateDuration(event.target.value));
  refs.sceneName.addEventListener("input", (event) => {
    activeScene().name = event.target.value.slice(0, 40);
    const clip = refs.timelineTrack.children[activeIndex];
    const name = clip?.querySelector(".timeline-clip__name");
    if (name) name.textContent = activeScene().name || "未命名场景";
    persist();
  });
  refs.eyebrow.addEventListener("input", (event) => updateText("eyebrow", event.target.value.slice(0, 60)));
  refs.title.addEventListener("input", (event) => updateText("title", event.target.value.slice(0, 80)));
  refs.body.addEventListener("input", (event) => updateText("body", event.target.value.slice(0, 180)));
  refs.positionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      activeScene().copy.position = button.dataset.copyPosition;
      persist();
      syncInspector();
    });
  });
  refs.moveEarlier.addEventListener("click", () => reorder(activeIndex, activeIndex - 1));
  refs.moveLater.addEventListener("click", () => reorder(activeIndex, activeIndex + 1));
  refs.reset.addEventListener("click", () => {
    pause();
    scenes = restoreTimeline(book.scenes, null);
    activeIndex = 0;
    try { window.localStorage.removeItem(storageKey); } catch { /* Storage can be blocked. */ }
    refs.saveState.textContent = "已恢复示例";
    renderTimeline();
    syncInspector();
    onSceneOrderChange(scenes, activeIndex);
  });

  window.addEventListener("keydown", (event) => {
    if (event.code === "Space" && event.metaKey && !isEditableTarget(event.target)) {
      event.preventDefault();
      togglePlayback();
    }
  });

  renderTimeline();
  syncInspector();
  updatePlayButtons();

  return {
    get scenes() { return scenes; },
    get activeIndex() { return activeIndex; },
    get playing() { return playing; },
    pageSources: () => flattenScenePages(scenes),
    pause,
    setActiveScene(index) {
      const nextIndex = Math.min(scenes.length - 1, Math.max(0, index));
      if (nextIndex === activeIndex) return;
      activeIndex = nextIndex;
      playbackStartedAt = performance.now();
      syncInspector();
      setActiveStyles();
    },
    setBusy(value) {
      busy = value;
      refs.timelineTrack.querySelectorAll(".timeline-clip").forEach((clip) => { clip.disabled = value; });
      refs.previewToggle.disabled = value;
      refs.timelinePlay.disabled = value;
      syncInspector();
    },
  };
}

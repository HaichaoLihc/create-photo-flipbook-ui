export const MIN_SCENE_DURATION = 1.5;
export const MAX_SCENE_DURATION = 12;

export function clampSceneDuration(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 4;
  return Math.min(MAX_SCENE_DURATION, Math.max(MIN_SCENE_DURATION, Math.round(parsed * 2) / 2));
}

export function timelineDuration(scenes) {
  return scenes.reduce((total, scene) => total + clampSceneDuration(scene.duration), 0);
}

export function elapsedBeforeScene(scenes, index) {
  return scenes
    .slice(0, Math.max(0, index))
    .reduce((total, scene) => total + clampSceneDuration(scene.duration), 0);
}

export function formatTime(seconds) {
  const safeSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

export function flattenScenePages(scenes) {
  return scenes.flatMap((scene) => scene.pages);
}

export function sceneIndexFromCurrentPage(currentPage, sceneCount) {
  if (!sceneCount) return 0;
  const index = Math.round((Number(currentPage) || 0) / 2);
  return Math.min(sceneCount - 1, Math.max(0, index));
}

export function moveScene(scenes, fromIndex, toIndex) {
  if (scenes.length < 3) return [...scenes];
  const firstEditable = 1;
  const lastEditable = scenes.length - 2;
  const from = Math.min(lastEditable, Math.max(firstEditable, fromIndex));
  const to = Math.min(lastEditable, Math.max(firstEditable, toIndex));
  if (from !== fromIndex || from === to) return [...scenes];

  const next = [...scenes];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

function cleanText(value, fallback, maxLength) {
  return typeof value === "string" ? value.slice(0, maxLength) : fallback;
}

function mergeScene(template, stored = {}) {
  const positions = new Set(["top-left", "top-right", "bottom-left", "bottom-right"]);
  return {
    ...template,
    name: cleanText(stored.name, template.name, 40),
    duration: clampSceneDuration(stored.duration ?? template.duration),
    copy: {
      eyebrow: cleanText(stored.copy?.eyebrow, template.copy?.eyebrow ?? "", 60),
      title: cleanText(stored.copy?.title, template.copy?.title ?? "", 80),
      body: cleanText(stored.copy?.body, template.copy?.body ?? "", 180),
      position: positions.has(stored.copy?.position)
        ? stored.copy.position
        : (template.copy?.position ?? "bottom-left"),
    },
  };
}

export function restoreTimeline(templateScenes, storedScenes) {
  const templates = new Map(templateScenes.map((scene) => [scene.id, scene]));
  const stored = Array.isArray(storedScenes) ? storedScenes : [];
  const storedById = new Map(stored.map((scene) => [scene?.id, scene]));
  const orderedInteriorIds = stored
    .map((scene) => scene?.id)
    .filter((id, index, ids) => (
      templates.has(id)
      && id !== templateScenes[0]?.id
      && id !== templateScenes.at(-1)?.id
      && ids.indexOf(id) === index
    ));

  for (const scene of templateScenes.slice(1, -1)) {
    if (!orderedInteriorIds.includes(scene.id)) orderedInteriorIds.push(scene.id);
  }

  const orderedTemplates = [
    templateScenes[0],
    ...orderedInteriorIds.map((id) => templates.get(id)),
    templateScenes.at(-1),
  ].filter(Boolean);

  return orderedTemplates.map((template) => mergeScene(template, storedById.get(template.id)));
}

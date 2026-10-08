export const FONT_OPTIONS = Object.freeze({
  serif: 'Georgia, "Times New Roman", serif', sans: "Arial, sans-serif",
  chinese: '"Microsoft YaHei", sans-serif', song: 'SimSun, serif', kai: 'KaiTi, serif',
  fang: 'FangSong, serif', hei: 'SimHei, sans-serif', times: '"Times New Roman", serif',
  calibri: 'Calibri, sans-serif', gabriola: 'Gabriola, cursive',
  script: '"Segoe Script", cursive', handwriting: '"Segoe Print", cursive', comic: '"Comic Sans MS", cursive',
});

export function identifyFont(family) {
  return Object.keys(FONT_OPTIONS).find((key) => family.toLowerCase().includes(FONT_OPTIONS[key].split(",")[0].replaceAll('"', "").toLowerCase())) || "serif";
}

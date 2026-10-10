import { fontsCatalog } from "./fonts.js";

export const editorCatalog = Object.freeze({
  ...fontsCatalog,
  edit: "编辑相册", done: "完成编辑", panel: "区块设置", hint: "点击书页上的图片或文字进行编辑",
  page: "编辑页面", pageOption: "第 {page} 页", selectedImage: "图片区块", selectedText: "文本区块",
  x: "水平位置", y: "垂直位置", width: "宽度", height: "高度", text: "文本内容",
  fontSize: "字号", fontFamily: "字体", serif: "衬线字体", sans: "无衬线字体", chinese: "微软雅黑",
  fontWeight: "字重", regular: "常规", bold: "加粗", color: "文字颜色", replace: "替换图片",
  save: "保存",
  saved: "已保存", saveError: "本机存储空间不足或不可用；请先导出 PDF 保存当前作品。",
  imageError: "请选择 PNG、JPEG、WebP 或 GIF 图片。", imageTooLarge: "图片超过 5 MB，请缩小图片后重试。",
  note: "拖动移动 · 四角缩放。方向键微调 1 像素，Shift + 方向键移动 10 像素。Page Up / Page Down 翻页。",
  chooseImage: "选择本地图片", imageFormats: "PNG / JPEG / WebP / GIF · 最大 5 MB",
  reset: "恢复本页默认排版",
  previous: "上一页", next: "下一页", pageStatus: "{current} / {total}",
  palette: "主题色板", customColor: "自定义颜色",
  colorOption: "使用颜色 {color}", centerX: "水平居中", centerY: "垂直居中",
  addImage: "新增图片", addText: "新增文本", newText: "在这里写下文字",
  removeAdded: "删除新增区块",
  inlineText: "编辑书页文字",
  empty: "选中区块进行编辑，或新增图片、文本，也可以修改本页背景。",
});

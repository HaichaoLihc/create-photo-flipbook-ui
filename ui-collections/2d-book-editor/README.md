# 2D Book Editor

独立的原生 HTML 翻页画册编辑器，提供区块编辑、每页背景、层级与 PDF 导出。基于 2D Book 阅读器扩展，原有 `ui-collections/2d-book/` 保持独立。

替换 `index.html` 中的占位内容即可使用，也可在编辑模式新增图片和文字。本地图片放在 `assets/photos/`。复制整个目录即可运行，不依赖相邻的原版模板。

From this directory, start a local preview:

```sh
python3 -m http.server 4184 --bind 127.0.0.1
```

打开[编辑版画册](http://127.0.0.1:4184/)，无需安装依赖或构建。

Validate with `node --test test.mjs`. The bundled page-turn engine's license is
in [`vendor/PAGE-FLIP-LICENSE`](vendor/PAGE-FLIP-LICENSE).

## 编辑相册

点击右上角圆形铅笔图标进入编辑模式。在面板中选择书页，再点击图片、标题或其他文本区块，可修改位置、大小、文本内容、字体、字号、字重与颜色。图片区块支持替换本地 PNG、JPEG、WebP、GIF 图片，单张最大 5 MB。选框紧贴图片四边，四角缩放保持原始比例。

点击“保存”保存修改；同一浏览器和网址下刷新后可恢复。点击铅笔图标完成编辑，返回翻页阅读。PDF 导出使用当前修改后的页面。编辑器文案集中在 `catalogs/editor.js`。

无需选中区块即可通过“新增图片”和“新增文本”添加内容，空白页也可以使用。新增区块支持编辑、保存恢复和 PDF 导出，也可通过“删除新增区块”移除。

双击书页中的文字，或选中后按 Enter，直接修改文本；新增文本自动进入输入状态。选中部分文字后点击色板或选择自定义颜色，只修改选中的文字，同一句话可使用多个颜色。没有选择文字范围时，色板修改整个区块的默认颜色。按 Escape 结束文字输入，恢复拖动和方向键微调。保存、刷新恢复及 PDF 导出均保留文字分段颜色。

编辑画布下方的圆形箭头可快速切换书页，也支持 Page Up / Page Down（输入文本时不触发）。选中区块后直接拖动可移动位置，拖动选框四角圆点可调整大小；方向键移动 1 像素，Shift + 方向键移动 10 像素。字号使用滑杆，文字颜色提供主题色板和自定义颜色选择。页面、字体、字重使用统一主题下拉菜单。

每页背景可独立设置主题色、自定义颜色或本地图片，背景图片居中铺满书页；恢复背景图标仅恢复背景。图片和文字提供置底、下移一层、上移一层、置顶操作，显示当前顺序，1 为最底层。背景与层级随保存和 PDF 导出保留。

字体提供 13 种系统字体选项，包括 Gabriola、Segoe Script 花体、Segoe Print 手写体及中文楷体、宋体、仿宋等，列表按相应字形预览。字体依赖阅读设备已安装的字体；花体主要适用于拉丁字符，缺少字体时使用字体栈中的备用字体。未选中且没有待保存修改时，操作按钮隐藏并显示编辑提示。

交互边界检查：`node --test test.mjs editor-gestures.test.mjs editor-layers.test.mjs`。

## 导出 PDF

点击页面顶部的“导出 PDF”，按 HTML 中的书页顺序将封面、内页和封底合并为一个 PDF，每张书页对应一页。页面宽高沿用 `#book` 的 `data-page-width` 和 `data-page-height`；图片与文字以两倍分辨率栅格化，文字不可选中。

导出在浏览器本地完成，依赖已随模板提供，无需联网。新按钮及进度文案集中在 `catalogs/pdf-export.js`。替换图片时建议使用本地图片；跨域图片需要源站允许 CORS，否则导出可能失败。

导出依赖：html2canvas 1.4.1 和 jsPDF 3.0.4，均采用 MIT 许可证，见 `vendor/HTML2CANVAS-LICENSE` 和 `vendor/JSPDF-LICENSE`。

# Photo Ring · 照片年轮

不依赖框架的交互式照片布局示例，使用本地 SVG 编号占位图，可离线运行。

## 打开

直接在浏览器中打开 `index.html`，或在此目录运行：

```bash
python3 -m http.server 4175 --bind 127.0.0.1
```

访问 http://127.0.0.1:4175/ 。无需安装依赖或编译。

## 交互

- **Flat**：平面圆环。
- **Tilt**：放大的弧形排列。
- **Ring**：有透视层次的斜向圆环。
- **Gallery**：横向画廊。
- 滚轮、拖动及方向键浏览全部 48 张占位图；Home 回到起点。
- 切换视图保留当前浏览位置；每张前景图后有 5 张向右上方等距排列的图片。
- 左下角的分类、地点、时间为示例文案，随当前图片更新。
- 支持触摸、键盘导航及系统减少动态效果设置。

## 文件

- `index.html`：图片顺序、堆叠关系、说明文字和视图按钮。
- `styles.css`：布局样式、响应式规则和堆叠偏移。
- `layout.js`：四种布局的几何计算。
- `app.js`：滚动、拖动、视图切换和文字同步。
- `assets/placeholders/`：48 张本地 SVG 占位图，不请求外部图片。
- `placeholders.json`：示例图片与文字清单，也是测试的数据来源。
- `tests/collection.test.cjs`：布局与交互逻辑检查。

## 替换内容

图片和文案已静态写入 HTML，不在运行时读取 JSON。修改 `index.html` 中的图片 `src`、`alt` 和照片节点的 `data-category`、`data-place`、`data-period`；同步更新 `placeholders.json` 以保持测试数据一致。

堆叠层数由 `.photo-stack` 内的图片数量决定，`--stack-depth` 从远到近为 5、4、3、2、1。`styles.css` 中的 `3px` 与 `-3px` 控制每层向右、向上的偏移。

## 检查

```bash
node --test tests/collection.test.cjs
```

本示例仅包含编号占位图和示例文字，不含私人照片、原照片文件名、拍摄元数据、部署配置或原项目的 Git 历史。

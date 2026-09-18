# Create Photo Flipbook UI

[English](README.md) · **简体中文**

## [访问项目网站 →](https://haichaolihc.github.io/create-photo-flipbook-ui/zh/)

**[了解项目，体验在线翻页相册](https://haichaolihc.github.io/create-photo-flipbook-ui/zh/)** · [English website](https://haichaolihc.github.io/create-photo-flipbook-ui/?lang=en) · [全屏演示](https://haichaolihc.github.io/create-photo-flipbook-ui/zh/demo.html)

用你的照片制作一本可以翻页的相册。这项 Codex 技能帮助你筛选照片、设计有表现力的跨页排版，并生成可交互的翻页相册网站。技能使用 [`assets/html/`](skills/create-photo-flipbook-ui/assets/html/) 中自带的 **2D Book** 阅读器（原 v1）。

网站支持英文和简体中文。从网站主入口访问时，会根据浏览器偏好的语言自动选择；也可以手动切换，网站会记住你的选择。README 的语言通过顶部链接切换。

项目官网和 GitHub Pages 构建位于独立的 [`website/`](website/) 目录，可复用的界面模板位于 [`ui-collections/`](ui-collections/)。

## 界面模板

这些模板位于技能目录之外的 `ui-collections/`，可以按需复制和修改，不会随技能一起安装。技能使用自带的 2D 阅读器；书架、3D 阅读器、胶片档案和空间画廊是独立的可选模板。

| [书架 Library](ui-collections/library/) | [2D Book](ui-collections/2d-book/) |
| --- | --- |
| ![包含三本示例空书的书架](docs/images/library.png) | ![2D Book 的照片跨页示例](docs/images/death-valley-flipbook.jpg) |
| 可拖动排序的书架，包含三本示例空书。 | 技能自带 2D 阅读器的参考示例。 |

| [3D Book 1](ui-collections/3d-book-1/) | [3D Book 2](ui-collections/3d-book-2/) |
| --- | --- |
| ![深色背景上的 3D Book 1](docs/images/3d-book-1.png) | ![浅色背景上的 3D Book 2](docs/images/3d-book-2.png) |
| 基于 React 和 WebGL 的阅读器，带有弯曲书页和深色背景。 | 基于 Three.js 和 Quick FlipBook 的阅读器，采用浅色背景和柔和阴影。 |

| [卡片画廊 Card Gallery](ui-collections/card-gallery/) | [图像图谱 Image Atlas](ui-collections/image-atlas/) | [照片环 Photo Ring](ui-collections/photo-ring/) |
| --- | --- | --- |
| ![使用编号占位卡片的卡片画廊](docs/images/card-gallery.png) | ![按年份排列为同心圆环的图像图谱](docs/images/image-atlas.png) | ![使用多层占位图像的照片环](docs/images/photo-ring.png) |
| 通过滚动或拖动，在环形、弧形、堆叠和展开长条之间浏览卡片。 | 探索按年份排列的同心圆空间档案，支持主题搜索和单图浏览。 | 在平铺、倾斜、环形和画廊布局之间切换，同时保留浏览位置。 |

这三个画廊使用原生 HTML、CSS 和 JavaScript，附带本地 SVG 占位图和虚构示例内容，不含个人照片，也不会请求外部图片。无需安装或构建；本地预览和替换图片的方法见各模板的 README。

<a id="install"></a>

## 安装

```bash
python3 ~/.codex/skills/.system/skill-installer/scripts/install-skill-from-github.py \
  --repo HaichaoLihc/create-photo-flipbook-ui \
  --path skills/create-photo-flipbook-ui \
  --ref main
```

## 使用

```text
使用 $create-photo-flipbook-ui，把这些照片制作成相册。
```

整个流程分为三个阶段：

1. **理解照片：** 分析照片的形式、内容和主题，可使用语义搜索和照片总览图。
2. **确定风格与设计：** 根据你的要求，制作风格连贯、完成度高的相册。可使用 Pinterest、照片技能目录和图像生成工具。没有指定风格时，保留原始照片，采用自带的默认相册风格。
3. **构建界面：** 使用内置的 2D HTML 阅读器呈现相册，并提供可打开的本地网址。

技能定义目标并提供工具，具体流程由智能体选择。

[默认相册风格](skills/create-photo-flipbook-ui/references/default-style.md) 提供简明的文字指导、Source Serif 4 字体、纸张与布面纹理，以及阅读器中可复用的页面样式。初始模板不包含示例照片。

## 照片搜索与可复用代码

技能声明了现有的 `photo-search` MCP 依赖，用于照片库搜索、按相关性排序的照片总览图和大图预览。MCP 本身只读。随技能提供的 `scripts/photo_library.py` 适配器复用已安装照片搜索引擎的 `index.py` 和 `PhotoSearchEngine`，为指定文件夹建立缓存索引并提供语义搜索；它不会替换已连接 MCP 的全局索引。

请单独安装搜索引擎及其 Python 依赖，将 `PHOTO_SEARCH_ENGINE_DIR` 设为引擎目录，并使用该引擎的 Python 解释器。具体方法见[照片库配置与命令](skills/create-photo-flipbook-ui/references/photo-library.md)。索引缓存保存在技能和源照片目录之外。新增或变更的图片会增量计算嵌入，未变化的图片复用已有结果。搜索输出包含照片总览图和清单，所选照片保留稳定 ID 与原始路径。

技能附带的可复用资源包括照片库适配器、有序照片总览图渲染器、Pinterest 辅助工具和 2D 阅读器。视觉设计与照片编排仍由工作流指令指导。技能包不包含模型权重或照片库。

各模板的本地预览方法见对应 README。

[Negative Sleeves](ui-collections/film-negative-flipbook/) 是一个独立的胶片档案界面，不附带照片，支持页角预览、拖动胶片条、可返回的单帧查看，以及可选的连续分页语义搜索。使用其 Python 构建工具导入本地照片文件夹；生成的相册和照片不会被 Git 跟踪。

## 验证

```bash
python3 tests/validate_repo.py
```

参见[评估指南](evals/README.md)。

<a id="license"></a>

## 许可证

项目原创代码和可安装技能采用 [MIT 许可证](LICENSE)。第三方组件保留各自的许可证。除非另有明确说明，`ui-collections/3d-book-1/` 中的改编代码，以及所有照片、视频和其他媒体，均不在此授权范围内。

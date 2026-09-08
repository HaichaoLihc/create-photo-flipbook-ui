# 3D Book 1

A reusable React and WebGL book template with a dark stage, curved pages,
and one sample Death Valley volume. The library and reader share a single scene.

```bash
npm ci
npm run dev
```

Select the floating volume to open it. Pages use segmented skinned meshes
and spring-damped curl motion adapted from
[wass08/r3f-animated-book-slider-final](https://github.com/wass08/r3f-animated-book-slider-final).
Click either side of the book or use the arrow keys to turn pages. Press Escape
to return to the floating library.

Validate with `npm test` and `npm run build`. See [3D Book 2](../3d-book-2/)
for the independent Quick FlipBook template using the same sample artwork.

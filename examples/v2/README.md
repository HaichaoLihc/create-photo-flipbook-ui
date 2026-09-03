# Leaf v2 — library view experiment

This folder is the preserved v2 implementation. The independent
[`../v3-book/`](../v3-book/) example uses `quick_flipbook` with the same photo-book assets.

A minimal spine-only library for photo books created with
`create-photo-flipbook-ui`. This preserved demo contains one interactive
Death Valley volume.

```bash
npm run dev
```

The library and reader now share one continuous WebGL scene: select a floating
volume to bring it forward, then open it without a scene change. Pages use
segmented skinned meshes and spring-damped curl motion adapted from
[wass08/r3f-animated-book-slider-final](https://github.com/wass08/r3f-animated-book-slider-final).
Click either side of the book or use the arrow keys to turn pages. Press Escape
to return to the floating library.

# 3D Book 2

A reusable vanilla Three.js book template with a light stage and its own copy
of the sample Death Valley assets in `public`. The page mesh and deformation engine
comes from [`quick_flipbook`](https://github.com/bandinopla/quick_flipbook).

The reader uses a straight-on orthographic camera, dynamically fits the complete
open spread, and supplies clean, mipmapped paper materials with soft dynamic
shadows and bend-aware lighting, without the engine's decorative AO surface
treatment.

```bash
npm ci
npm run dev
```

The root URL opens the standalone book reader. Project landing pages, language
selection, SEO metadata, and GitHub Pages deployment live in [`website/`](../../website/).
The website reuses this reader's source and sample pages for its demo. This
template has no dependency on the website and can be copied and built on its own.

## Interaction

- Open the Death Valley edition from the library rail.
- Hover a page edge for a subtle lift, drag to scrub its turn, or click, swipe,
  and use the arrow keys.
- Home and End jump to the front and back covers.

## Verification

```bash
npm test
npm run build
```

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for dependency attribution.

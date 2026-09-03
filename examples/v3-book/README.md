# V3 Book — Quick FlipBook example

An independent vanilla Three.js reader with its own copy of the Death Valley
photo-book assets in `public`. The page mesh and deformation engine
comes from [`quick_flipbook`](https://github.com/bandinopla/quick_flipbook).

The reader uses a straight-on orthographic camera, dynamically fits the complete
open spread, and supplies clean, mipmapped paper materials with soft dynamic
shadows and bend-aware lighting, without the engine's decorative AO surface
treatment.

```bash
npm install
npm run dev
```

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

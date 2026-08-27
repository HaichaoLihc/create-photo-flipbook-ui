# V3 Book — Quick FlipBook example

An independent vanilla Three.js reader with its own copy of the photo-book assets
in `public`. The page mesh and deformation engine
comes from [`quick_flipbook`](https://github.com/bandinopla/quick_flipbook).

The reader uses a straight-on orthographic camera, dynamically fits the complete
open spread, and supplies flat, mipmapped page materials without the engine's
decorative AO surface treatment.

```bash
npm install
npm run dev
```

## Interaction

- Choose one of four editions from the library rail.
- Click the left or right side of the stage, swipe, or use the arrow keys.
- Home and End jump to the front and back covers.

## Verification

```bash
npm test
npm run build
```

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for dependency attribution.

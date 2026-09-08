# 3D Book 2

A reusable vanilla Three.js photo-book editor with a light stage and its own copy
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

## Interaction

- Edit each scene name, duration, eyebrow, title, body copy, and overlay position
  from the inspector.
- Click a timeline clip to jump to it, drag interior clips to reorder them, or use
  the accessible move buttons in the inspector. Covers stay fixed.
- Play the custom timeline from either play control. Each scene advances using
  its own duration; `Command + Space` toggles playback.
- Edits are saved to local storage and can be restored to the bundled example.
- Hover a page edge for a subtle lift, drag to scrub its turn, or click, swipe,
  and use the arrow keys.
- Home and End jump to the front and back covers.

Scene presets live in `src/books.js`. Timeline validation and persistence rules
live in `src/timeline.js`; the editing interface is isolated in `src/editor.js`.

## Verification

```bash
npm test
npm run build
```

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for dependency attribution.

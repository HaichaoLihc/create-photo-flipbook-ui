# Built-in 3D hardcover book UI

Use `assets/3d-book/` by default. Copy the whole directory into the output book directory, including `assets/paper/`, `assets/fonts/`, and `assets/vendor/`. It is a static Three.js reader with hardcover boards, curling pages, a felt desk, paper-stock selection, page sounds, and mouse/touch/keyboard controls. No package install or build is needed. Keep the bundled third-party licenses. The reader's desk and materials do not prescribe the artwork's palette or style.

## Artwork and data

Split each accepted ImageGen master at its exact center into lossless PNG leaves, with no overlap or missing strip. Use an even master width and consistent dimensions throughout the book. Preserve all artwork; correct a mismatched generation rather than cropping or stretching it. Put the leaves in `assets/pages/`.

Populate `book-data.js` (`window.PHOTOBOOK`):

- `id`: unique book identifier, also used to isolate saved paper/sound preferences.
- `title`: book title; the runtime updates visible titles and document metadata.
- `pageWidth`, `pageHeight`: actual pixel dimensions of one half-spread; geometry derives its aspect ratio from these values.
- `frontCover`, `backCover`: objects with `file` (relative to `assets/pages/`) and meaningful `alt` text, including essential in-image wording.
- `spreads`: at least one interior spread, in reading order. Each has an `id`, a `left` object and a `right` object, each with `file` and `alt`.

The scaffold shows one interior spread; replace its descriptions and add pairs as needed. `frontCover` is the outside-cover master's **right** half; `backCover` is its **left** half. For `N` interior spreads, supply exactly `2N + 2` generated faces. Opening the front board reveals spread 1; turning each sheet reveals the next spread; closing the back board reveals the back cover. The board interiors use the first left and final right leaves, so do not add ungenerated endpapers or blanks. Record each file's spread ID and left/right half in `generation-manifest.json`. The runtime maps complete leaf images to book surfaces; do not rebuild photo placement, type, or backgrounds in HTML/CSS.

## Validation and preview

Check that every referenced leaf exists, matches the declared dimensions, and maps to an accepted ImageGen master. Confirm the two halves reproduce their master without reversal or a missing seam. Resolve all script/font/texture paths and remove scaffold wording. Run `node --check book.js` and `node --check book-data.js`.

Serve the output directory on an available port:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

Review front cover, several interior spreads, and back cover at desktop and mobile sizes. Exercise previous/next, direct spread dots, keyboard arrows, page click/drag, paper selection, and sound toggle. Verify the loader clears and the browser reports no missing assets or rendering errors. `#stage` exposes `data-spread`, `data-left`, and `data-right` for checking the visible artwork order. WebGL is required; a failure message must not be mistaken for a working preview. Deliver the local URL and output directory.

For an explicitly requested 2D reader, use `assets/html/` and [legacy runtime notes](book-editing-2d.md).

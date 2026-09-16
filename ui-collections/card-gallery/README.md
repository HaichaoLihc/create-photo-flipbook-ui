# Card Gallery

A standalone HTML, CSS, and vanilla JavaScript example of cards transitioning from a ring to an arc, a stack, and an unfolded strip. Adapted from the Vision card study; the interaction reference is [Inkwell](https://inkwell.tech/).

All 49 images are local, numbered SVG placeholders. The example uses system fonts and includes no photographs, photo filenames, personal collection metadata, hosting configuration, or remote image requests. No install or build step is needed.

## Run

From this directory:

```sh
python3 -m http.server 4182 --bind 127.0.0.1
```

Open http://127.0.0.1:4182/ . Use an HTTP server because `app.js` loads `assets/cards.json` with `fetch`.

## Interactions

- Scroll or drag to scrub from the ring through the stack and unfolded cards.
- Use the top navigation or right progress rail to jump through the sequence.
- Arrow keys and Page Up / Page Down browse; Home / End reach the endpoints; Escape returns to the arc.
- Click the center ring card to open its stack, or another ring card to focus it.
- Reduced-motion preferences are respected.

## Customize

- `index.html`: page title, navigation, captions, and accessibility instructions.
- `styles.css`: layout, type, surfaces, card dimensions, and responsive rules.
- `app.js`: transforms, scroll/drag/keyboard controls, and chapter positions.
- `assets/cards.json`: card names, categories, image paths, and alternative text.
- `assets/placeholders/`: 49 generated SVG placeholders with a 232:300 aspect ratio.

Keep 24 `moments` records for the ring: its current geometry assumes 24 cards, and the eleventh card is the stack's front cover. The 25 `daily` records follow it in the unfolded strip; their count can be changed. To customize imagery, replace the placeholder `src` values and update names and `alt` text. No source collection images are needed to run or modify this example.

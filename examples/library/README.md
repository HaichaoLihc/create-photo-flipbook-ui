# Photo Books Library

A reusable adaptation of the local Photo Books Library UI: a black shelf,
slim bindings, hover and keyboard cover previews, and a reorderable collection.
It contains exactly three mock books. Their covers are plain placeholders;
their readers have no photographs, pages, or page-turn runtime.

## Run

From this directory:

```sh
npm run dev
```

Open [the library](http://127.0.0.1:4180/). Python 3 serves the static files;
there are no packages to install and no build step. Alternatively, run
`python3 -m http.server 4180 --bind 127.0.0.1` directly. Use an HTTP server
rather than opening the HTML as a local file because the scripts use ES modules.

## Interactions

- Hover or keyboard-focus a spine to preview its placeholder cover; Escape hides it.
- Click or press Enter to open an empty reader. The Library link returns to the shelf.
- Drag to reorder. On touch screens, hold briefly before dragging.
- Left/Right and Home/End move focus. Hold Shift with those keys to reorder.
- Escape cancels a drag. Reset order restores the original sequence.

The arrangement is saved locally in the browser under an example-specific key.
Blocked storage and outdated saved IDs fall back safely. Reduced motion is respected.
If the shelf overflows, swipe or scroll over it to browse horizontally.

## Files

- `books.js`: the three mock records and reader URL lookup.
- `index.html`, `collection.css`, `collection.js`: shelf, previews, and navigation.
- `shelf-order.js`: pointer, touch, keyboard, and persisted ordering.
- `book.html`, `book.css`, `book.js`: shared empty reader and unknown-book state.

Edit mock titles, colors, and heights in `books.js`. The `pages` arrays are empty
fixtures; this example intentionally does not render page content.
All styling uses system fonts and CSS; no source collection artwork is included.

## Check

```sh
npm test
```

The Node tests check mock destinations, empty content, unknown-book handling,
saved-order recovery, and local asset references. They also run through the
repository's `python3 tests/validate_repo.py` command.

# 2D Book

A reusable vanilla HTML flipbook template with sample page layouts, drag and
swipe gestures, and keyboard controls. Replace the placeholders in `index.html`
with your photographs; put local images in `assets/photos/`.

From this directory, start a local preview:

```sh
python3 -m http.server 4181 --bind 127.0.0.1
```

Open [the book](http://127.0.0.1:4181/). No package installation or build step is needed.

Validate with `node --test test.mjs`. The bundled page-turn engine's license is
in [`vendor/PAGE-FLIP-LICENSE`](vendor/PAGE-FLIP-LICENSE).

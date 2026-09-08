# Built-in 2D book UI

The reusable runtime is in `assets/html/`. It includes the [default style](default-style.md), fonts, textures, and an empty book scaffold. Copy it into the output book directory and supply the designed pages. Reuse its visual proportions while developing the content and sequence.

Runtime contract:

- Pages are `.book-page` elements inside `#book`; only the first and last leaves have `data-density="hard"`.
- Page dimensions follow the artwork ratio, with the longer UI edge at most `640`. `contain` preserves whole images when source ratios differ.
- Full-spread artwork can be split at its gutter for display as paired leaves. Preserve the accepted artwork in the displayed pages.
- Keep the bundled responsive layout, mouse/touch/keyboard controls, turn lock, and page-bound spine shadows.

The default page layer uses `.art-page` with `paper`, `endpaper`, or `cloth`. A `.plate` can be `small`, `medium`, `large`, or `portrait`, optionally positioned `high`, `low`, or `aside`. Blank pages, title text, colophon, and cover markup are demonstrated in the starter. `style/book-style.css` owns the reusable visual settings; `styles.css` owns the reader. A different requested style can replace the page layer.

Validation: `node --test html-contract.test.mjs` in the book directory, plus checks for asset paths, leaf order, and spread pairing.

Local preview from the output directory, using an available port:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

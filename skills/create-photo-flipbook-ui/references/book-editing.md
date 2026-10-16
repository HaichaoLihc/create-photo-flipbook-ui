# Built-in 2D book UI

The reusable runtime is in `assets/html/`. Copy it into the output book directory and populate the scaffold with the artwork from [spread generation](spread-generation.md). Art direction follows the chosen creative direction and [artist-book principles](default-style.md); the runtime provides navigation, responsive sizing, and binding shadows. Its surrounding UI is not a palette or material reference for the generated pages and cover.

Runtime contract:

- Pages are `.book-page.generated-page` elements inside `#book`; only the first and last leaves have `data-density="hard"`.
- Page dimensions follow the generated artwork's half-spread ratio, with the longer UI edge at most `640`. Use an even master width so both halves have the same dimensions. Preserve all artwork; request a corrected generation if its ratio is wrong rather than cropping the design to fit.
- Split each accepted master at its exact center into lossless PNG leaves, with no overlap or missing strip. Each page contains one `.generated-artwork` image showing its complete half. Do not rebuild its photo placement, paper, or type with HTML/CSS overlays.
- Mark each leaf with `data-spread-id` and `data-half="left"` or `"right"`, matching the generation manifest. For a book with `N` interior spreads, leaf order is: outside-cover **right** (front), spread 1 **left**, spread 1 **right**, ... spread N **left**, spread N **right**, outside-cover **left** (back). Total leaves: `2N + 2`. Do not insert additional ungenerated blanks.
- Keep the bundled responsive layout, mouse/touch/keyboard controls, turn lock, and page-bound spine shadows.

The starter illustrates one outside cover and one interior spread; duplicate the interior pair as needed and insert the real artwork. Give each image useful alt text, including essential in-image text where practical. `style/book-style.css` supplies the generated-image surface; `styles.css` owns the reader.

Validation: run `node --test html-contract.test.mjs` in the book directory. Before delivery, also check that every visible leaf maps to an actual ImageGen master in `generation-manifest.json`, every image/font/script path resolves, the two halves reproduce their master without a seam or reversal, and no scaffold comments stand in for finished pages. Review the cover, several spreads, and the closing pages in desktop and mobile layouts; exercise page buttons and keyboard controls. The scaffold tests alone do not prove generation coverage or visual quality.

Local preview from the output directory, using an available port:

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

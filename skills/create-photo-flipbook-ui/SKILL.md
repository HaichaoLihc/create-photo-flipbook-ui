---
name: create-photo-flipbook-ui
description: Turn supplied raw photographs, finished page images, contact sheets, existing book HTML, or visual references into a responsive 3D page-turning photobook website using raw HTML, CSS, and vanilla JavaScript. Use for photo flipbooks, albums, travel zines, lookbooks, portfolios, fine-art photo books, sequencing raw photos, or wrapping already-designed pages in a book UI. Includes self-contained poetic-documentary and ImageGen-authored tactile travel-zine styles, ordered contact-sheet generation, and a dependency-free HTML page-turn template.
---

# Create Photo Flipbook UI

Choose the path from the user's requested level of editing. Reuse the bundled runtime; do not force already-finished page artwork through an internal redesign.

## Intent gate

Use the finished-page fast path only when the user explicitly asks to assemble the supplied images as-is, preserve their order, perform no editing, or simply wrap them in a book UI. If the request is ambiguous, default to the editing path.

## Choose the path

### Finished-page fast path

Trigger this path only from an explicit no-edit or assemble-as-is request. It applies to raw photographs and designed pages alike.

- Preserve every supplied image and its artwork exactly.
- Make each image one complete HTML leaf; do not crop, caption, or redesign it.
- Derive the book ratio from the finished pages. Normalize the longer UI edge to at most `640`; never use raw pixel dimensions as UI dimensions.
- Use the exact common ratio when dimensions match. Otherwise use the dominant ratio with `contain`.
- Preserve a supplied front cover. Otherwise make a restrained cover whose surface color matches the empty back cover.
- Copy the runtime, insert the pages, set ratio and colors, validate, and stop.

### Default editing path

Use this path whenever the user has not explicitly declined editing. For more than three images, generate and actually view a contact sheet before making editorial decisions; creating the file is not inspection.

For standalone photographs, edit selection, sequence, pairings, pacing, and layout. For already-designed pages, treat each page image as an indivisible artwork: edit selection, sequence, pacing, blank leaves, and covers, but do not alter its internal composition unless requested.

Follow this order:

1. Generate and view a source contact sheet
2. Inspect the collection; open originals only to resolve focus, expression, crop, or near-duplicates. Do not preserve every image or filename order automatically.
3. Choose one style from **Styles**, read that style file, and use its editing, sequencing, pacing, composition, typography, material, cover, and critique rules. Do not blend styles unless requested or apply a separate generic editorial doctrine.
4. Build spreads directly from the selected sequence using the production method required by the style.
5. When a non-interactive static renderer is available, render spread previews, assemble them in reading order with the contact-sheet script, and inspect the whole book using the style's critique rules. If no renderer exists, state that visual spread QA was not performed; do not pretend that generating HTML is the same as inspecting it.
6. Revise only when the spread overview reveals a clear improvement, then produce final HTML and PDF when requested.

### Mixed or existing-book inputs

On the default editing path, preserve the internal artwork of polished pages while editing unresolved photographs and the book-level sequence. Modify supplied HTML in place when practical. Preserve filenames, captions, and existing controls unless requested otherwise; preserve ordering only on the fast path or when explicitly requested.

## Styles

- Use [poetic-documentary.md](references/styles/poetic-documentary.md) for artistic fine-art books shaped by associative sequence, documentary observation, lyrical detail, and restrained design.
- Use [travel-zine.md](references/styles/travel-zine.md) for informal, place-driven travel stories that benefit from ImageGen-authored tactile paper, selective scrapbook-like assembly, maps or notes, expressive type, and lively scale changes.

Choose from the user's stated direction first, then the collection's subject and visual character. If both styles could fit and the user did not choose, select the stronger interpretation and state it briefly. Never use every or most photographs merely to increase page count; follow the selected style's curation rules and copy only selected source files into the output.

Keep every future style self-contained. Each style file must own its selection, sequencing, pairing, pacing, spread composition, typography, cover, and critique rules. Do not add shared editorial references or assume every style should edit photographs the same way.

Add another concise style file only when requested. Create a separate skill only when a style requires fundamentally different tools or source transformation.

## Runtime

Copy `assets/html/` into the output root when a runtime is needed. Keep raw `.book-page` elements inside `#book`; do not introduce React, TypeScript, JSX, Vite, or a required page manifest.

Place `index.html` directly in the requested output root. Do not create a nested `site/` directory unless requested. Put photographs under `assets/photos/` and reference them directly.

When a style requires generated page artwork, put the flattened leaves under `assets/pages/`. Make each `.book-page` contain only one full-page image; do not reconstruct or embellish that artwork with HTML or CSS.

Do not read or rewrite the vendored page-turn library. On the fast path, copy the runtime and edit only `index.html`, page-size settings, and necessary theme tokens.

Keep these invariants:

- Only the first and last leaves use `data-density="hard"`; interior leaves remain soft.
- Add a blank interior leaf when correct spread pairing requires it.
- Keep the final leaf empty and use the same surface color as the front cover.
- Lock controls while renderer state is not `read`.
- Preserve mouse, touch, buttons, keyboard, desktop-spread, and mobile single-page behavior.
- Constrain the book by viewport width and height.
- Do not add a visible center gap or book-level overlay. Use page-bound pseudo-elements above page content for spine shadows so photographs cannot cover them and the shadows move with turns.

## Contact sheets

Pass filenames in the exact display order; the script does not discover or sort files. Use it first for source photos and again for rendered spreads. Stable IDs come from the supplied labels.

```bash
python3 scripts/make_contact_sheet.py --output contact-sheet.jpg image-03.jpg image-01.jpg image-08.jpg
python3 scripts/make_contact_sheet.py --output spread-contact-sheet.jpg spread-01.png spread-02.png spread-03.png
```

Review the spread contact sheet using the selected style file's critique rules.

## Efficiency

- Do not inspect or rewrite the vendored runtime.
- Copy the template once and make one focused editing pass.
- Do not install packages or retry unavailable image tools; the bundled contact-sheet script is sufficient for collection inspection.
- Run the bundled contract test once after editing. Add a small targeted check only for requirements the contract does not cover; avoid large ad hoc validation scripts.

## Validation

- Verify referenced assets exist and copied sources remain unchanged.
- Run `node --test html-contract.test.mjs` after copying the runtime.
- Check page count, order, cover density, source references, selected ratio, and matching cover colors programmatically.
- On the editing path, verify the rendered order and inspect the static spread contact sheet when a renderer is available.
- Do not use browser interaction to test animation. Do not claim animation was tested.
- Do not claim PDF delivery unless a PDF file was actually generated and validated.
- Report checks that passed and provide the start command.

From the directory containing `index.html`, serve the book with:

```bash
python3 -m http.server 4173
```

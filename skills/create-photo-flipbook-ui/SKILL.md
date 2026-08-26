---
name: create-photo-flipbook-ui
description: Turn supplied raw photographs, finished page images, contact sheets, existing book HTML, or visual references into a responsive 3D page-turning photo-book website made with raw HTML, CSS, and vanilla JavaScript. Use for photo flipbooks, albums, lookbooks, portfolios, editorial photo books, sequencing raw photos, or wrapping already-designed pages in a book UI. Includes ordered contact-sheet generation and a dependency-free HTML page-turn template.
---

# Create Photo Flipbook UI

Inspect the input before deciding how much editorial work it needs. Reuse the bundled vanilla runtime without forcing every project through the same workflow.

## Decide the path

First inspect the complete set, preferably through a contact sheet when there are several images. Check visual finish, dimensions, aspect ratios, orientation, likely order, and whether the files are pages or raw photographs.

### Finished-page fast path

Use this path when the images already contain deliberate typography, collage, margins, or other page design. Matching or nearly matching dimensions make this an especially direct wrapper task; varied dimensions alone do not turn finished pages back into raw photographs.

- Preserve the supplied order and files exactly unless the user asks for changes.
- Make each supplied image one complete HTML leaf. Do not redesign, crop, caption, or place it inside a new composition.
- Set the book page ratio from the finished pages. Normalize only the on-screen scale; do not force the template's default portrait ratio.
- If all dimensions match, use that exact source ratio. If dimensions differ, use the dominant ratio and `contain`; preserve differently shaped pages without cropping and choose the least disruptive page surface.
- If a supplied file is clearly the finished front cover, keep it and match the back cover to its dominant edge or paper color. Otherwise create a simple front cover from the collection theme.
- Choose a cover surface color from the collection's palette and mood. For generated covers, use exactly the same surface color for front and back; the front may add restrained title content while the back stays empty.
- Prefer the smallest working implementation: copy the runtime, add the pages, set the ratio and theme, run the contract check, and stop.

### Raw-photo editorial path

Use this path when the inputs look like standalone photographs and the sequence or layout is unresolved. Mixed dimensions are supporting evidence, not the deciding signal.

- Spend time on selection, sequence, pacing, spread pairing, and image placement before writing the book.
- Use contact sheets as the primary inspection surface. Open originals only when crop, focus, expression, or near-duplicate choice is uncertain.
- Infer a coherent theme from subject, palette, atmosphere, chronology, and repeated motifs.
- Choose a narrative sequence rather than accepting filename order automatically. Preserve chronology when it is meaningful; otherwise build an intentional opening, development, pause, and ending.
- Author each leaf directly in HTML. Use full bleed, containment, margins, diptychs, grids, text, or blank space as the photographs require; do not impose one layout system on every page.
- Crop only deliberately. Keep important subjects safe and preserve the original files.
- Use the same theme-derived surface color for front and back covers. Keep the back cover photo-free and text-free.
- Review the planned sequence and pairings from the source contact sheet before coding.

### Mixed or existing-book inputs

Preserve already-polished pages and apply editorial layout only to unresolved raw photographs. When an existing HTML book is supplied, modify it in place when practical instead of replacing its structure. Maintain compatibility with supplied ordering, filenames, captions, and existing controls unless the request changes them.

## Runtime

Copy `assets/html/` into the output directory when a runtime is needed. Keep pages as raw `.book-page` HTML elements inside `#book`; do not introduce React, TypeScript, JSX, Vite, or a required page manifest.

Place `index.html` directly in the requested output root. Do not create a nested `site/` directory unless the user asks for one; the reported server command must open the book at `/`, not a directory listing.

Do not read or rewrite the vendored page-turn library. On the finished-page fast path, avoid rereading unchanged template files; copy the runtime and edit only `index.html`, the page-size settings, and necessary theme tokens.

Set `data-page-width` and `data-page-height` on `#book` to a normalized size with the selected source aspect ratio. Normalize the longer page edge to at most `640`; never use raw image pixel dimensions as UI dimensions. Put photographs under `assets/photos/` and reference them directly.

Keep these invariants:

- Only the first and last leaves use `data-density="hard"`; interior leaves stay soft.
- Add a blank interior leaf when needed for correct spread pairing.
- The final leaf is an empty back cover using the same surface color as the front cover.
- Controls stay locked while the renderer state is not `read`.
- Mouse, touch, buttons, keyboard, desktop spread, and mobile single-page behavior remain usable.
- The book is constrained by both viewport width and height.
- Do not add a visible center gap or overlay. Use subtle inset shadows on the inner edges of left and right pages so the spine cue moves naturally with each page turn.

## Contact sheets

Pass filenames in the exact intended display order. The script does not discover or sort files.

```bash
python3 scripts/make_contact_sheet.py --output contact-sheet.jpg image-03.jpg image-01.jpg image-08.jpg
```

## Validation

- Verify referenced assets exist and copied sources remain unchanged.
- Run `node --test html-contract.test.mjs` after copying the runtime.
- Check page count, order, hard-cover placement, source references, selected page ratio, and matching cover colors programmatically.
- Do not start a local server, use browser tools, capture screenshots, or manually exercise animation for validation.
- Report the static checks that passed and provide the start command. Do not claim that runtime animation was tested.

From the directory containing `index.html`, serve the book with:

```bash
python3 -m http.server 4173
```

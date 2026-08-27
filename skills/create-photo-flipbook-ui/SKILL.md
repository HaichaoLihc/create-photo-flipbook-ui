---
name: create-photo-flipbook-ui
description: Curate and sequence supplied photographs, finished pages, contact sheets, or existing book HTML into a responsive 3D page-turning photobook website using raw HTML, CSS, and vanilla JavaScript. Use for photo flipbooks, albums, zines, lookbooks, portfolios, sequencing raw photos, wrapping designed pages, or orchestrating a visual photo skill into a book. This style-neutral engine owns book editing and presentation while routing visual transformation to a curated list of separate photo skills.
---

# Create Photo Flipbook UI

Own the book, not the visual style. Curate, sequence, pace, pair, and present the work; route image transformation to a separate photo skill. Reuse the bundled runtime and do not force finished artwork through redesign.

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

For standalone photographs, edit selection, sequence, pairings, pacing, and spread roles. For already-designed pages, treat each page image as an indivisible artwork: edit selection, sequence, pacing, blank leaves, and covers, but do not alter its internal composition unless requested.

Follow this order:

1. Generate and view a source contact sheet.
2. Explore the collection before editing it. Identify its strongest subjects, recurring motifs, visual range, emotional register, technical limits, and possible forms. Open originals only to resolve focus, expression, crop, or near-duplicates.
3. Read [photo-skill-catalog.md](references/photo-skill-catalog.md). Use the user's named compatible photo skills when supplied; otherwise choose the smallest set of listed skills that fits the collection. One is usually sufficient, but choose more than one when their combination has a clear purpose and can form one coherent book. If none fits, keep the photographs visually unchanged rather than inventing a house style.
4. Read every selected photo skill's `SKILL.md` and required resources. Separate each skill's non-negotiable invariants from adaptable variables. When combining skills, define a shared visual system and a distinct book-level role for each skill before editing.
5. Read [book-editing.md](references/book-editing.md) as baseline knowledge, not a fixed recipe. Let the selected photo skills, the photographs, and the intended book experience determine the actual edit. Curate only photographs that are both strong and suitable for that direction, then design the complete sequence and its changing rhythm before generating artwork. Do not preserve every image or filename order automatically.
6. Generate the outside-cover spread first: the left half is the back cover and the right half is the front cover. Then generate every interior double-page spread in reading order. Keep one spread ratio and consistent dimensions, protect the intended gutter, and treat each accepted spread as indivisible artwork.
7. Split the accepted outside-cover spread so its right half becomes the first front-cover leaf and its left half becomes the final back-cover leaf. Split each accepted interior spread only at its intended gutter. Assemble the leaves in the bundled runtime without rebuilding their internal design in HTML.
8. Build a contact sheet from the accepted full spreads in reading order. Inspect it using every relevant selected photo skill's quality gate and the book-level rhythm critique in [book-editing.md](references/book-editing.md). Regenerate only clear visual failures, revise only clear sequencing failures, then produce final HTML and PDF when requested.

### Mixed or existing-book inputs

On the default editing path, preserve the internal artwork of polished pages while editing unresolved photographs and the book-level sequence. Modify supplied HTML in place when practical. Preserve filenames, captions, and existing controls unless requested otherwise; preserve ordering only on the fast path or when explicitly requested.

## Visual skill routing

- Keep this skill free of visual styles, artist references, palettes, texture systems, typography systems, and generation prompts.
- Choose one or more visual photo skills according to the collection. Prefer the smallest sufficient set; combine skills only when their visual languages are compatible and their different roles strengthen the sequence.
- Treat [photo-skill-catalog.md](references/photo-skill-catalog.md) as the default allowlist. A user may explicitly name another available photo skill; use it when its output can become a page or spread without violating the runtime contract.
- If a selected skill is unavailable, state that briefly and use the closest available catalog entry only when the substitution preserves the requested direction.
- Do not copy another skill's instructions into this skill. Extend the catalog with a routing entry instead.

## Style fidelity vs book coherence

Treat each selected photo skill as a visual grammar, not a rigid spread template.

- Preserve its signature invariants: source-photo treatment, material or process character, palette logic, typography behavior, collage or illustration language, and quality gate.
- Let the selected grammar shape editorial decisions too. A sparse style may demand a shorter edit and longer pauses; a layered or multi-photo style may support denser pairings and faster passages. Decide from the selected skill set rather than applying one universal sequencing formula.
- Vary book-level composition when the sequence needs it: image count and scale, density, negative space, contrast, crop or bleed, accent intensity, text presence, visual weight, and quiet versus peak spreads.
- Adapt a page- or poster-oriented skill to the book's spread ratio while keeping its recognizable grammar. Do not repeat one recipe across the whole book.
- Maintain continuity through a limited recurring palette, type system, material language, and motifs. Create rhythm through deliberate changes in space, scale, contrast, density, and emotional temperature.
- Prefer a coherent book over isolated showpiece spreads. When combining skills, unify them through shared palette, typography, materials, image treatment, or recurring motifs; assign each skill a consistent purpose rather than switching styles arbitrarily.

## Runtime

Copy `assets/html/` into the output root when a runtime is needed. Keep raw `.book-page` elements inside `#book`; do not introduce React, TypeScript, JSX, Vite, or a required page manifest.

Place `index.html` directly in the requested output root. Do not create a nested `site/` directory unless requested. Put unchanged photographs under `assets/photos/`, accepted full-spread artwork under `assets/spreads/`, and split runtime leaves under `assets/pages/`.

Make each transformed `.book-page` contain only its accepted artwork image. Do not reconstruct, decorate, caption, or repair another photo skill's artwork with HTML or CSS.

Do not read or rewrite the vendored page-turn library. On the fast path, copy the runtime and edit only `index.html`, page-size settings, and necessary theme tokens.

Keep these invariants:

- Only the first and last leaves use `data-density="hard"`; interior leaves remain soft.
- Add a blank interior leaf when correct spread pairing requires it.
- On the editing path, keep the generated back cover as the final hard leaf. On the fast path, preserve a supplied back cover; only use an empty final leaf when no back cover exists, matching its surface color to the front cover.
- Lock controls while renderer state is not `read`.
- Preserve mouse, touch, buttons, keyboard, desktop-spread, and mobile single-page behavior.
- Constrain the book by viewport width and height.
- Do not add a visible center gap or book-level overlay. Use page-bound pseudo-elements above page content for spine shadows so photographs cannot cover them and the shadows move with turns.

## Contact sheets

Pass filenames in the exact display order; the script does not discover or sort files. Use it first for source photos and again for accepted full spreads. Stable IDs come from the supplied labels.

```bash
python3 scripts/make_contact_sheet.py --output contact-sheet.jpg image-03.jpg image-01.jpg image-08.jpg
python3 scripts/make_contact_sheet.py --output spread-contact-sheet.jpg spread-00-cover.png spread-01.png spread-02.png
```

Review the final contact sheet using every relevant selected photo skill's quality gate and the book-editing critique.

## Efficiency

- Do not inspect or rewrite the vendored runtime.
- Copy the template once and make one focused editing pass.
- Do not install packages or retry unavailable image tools; the bundled contact-sheet script is sufficient for collection inspection.
- Run the bundled contract test once after editing. Add a small targeted check only for requirements the contract does not cover; avoid large ad hoc validation scripts.

## Validation

- Verify referenced assets exist and copied sources remain unchanged.
- Run `node --test html-contract.test.mjs` after copying the runtime.
- Check page count, order, cover density, source references, selected ratio, and matching cover colors programmatically.
- On the editing path, verify the finished artwork order and inspect its page contact sheet.
- Do not use browser interaction to test animation. Do not claim animation was tested.
- Do not claim PDF delivery unless a PDF file was actually generated and validated.
- Report checks that passed and provide the start command.

From the directory containing `index.html`, serve the book with:

```bash
python3 -m http.server 4173
```

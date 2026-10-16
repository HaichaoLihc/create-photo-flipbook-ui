# ImageGen production for every spread

Use the built-in ImageGen tool for each finished double-page artwork. Generate the outside cover and every interior spread, including title/endpaper, colophon, and intentionally quiet spreads. Generating a cover, background texture, or a few decorative elements does not satisfy this requirement. Do not substitute a CSS collage, programmatic drawing, or a contact-sheet montage for a generated spread.

## Plan and reference

Choose a consistent leaf ratio and plan the sequence as facing pairs using [book rhythm](book-rhythm.md). For leaf width `w` and height `h`, a spread has ratio `2w:h`. Record each spread's source photos, narrative role, composition, exact text or intentional absence of text, and changing visual intensity. Use the [default zine direction](default-style.md) unless the user requests another aesthetic.

Inspect the actual source photographs. Supply the selected photos as ImageGen image references, explicitly identifying the content, shapes, colors, or mood to draw from. They are creative inputs that can be transformed according to the art direction. Supplied design references guide the visual language. Carry only the book's essential constants into every prompt; specify each spread's distinct role and intensity separately. A saturated cover is not a universal style reference. Use an accepted quiet reference for quiet work when helpful, and tell ImageGen which properties to borrow and which to vary.

## Generate and review

- Make a separate generation call for each distinct spread. Request **one flat, edge-to-edge, print-ready double-page artwork**, with left and right page composition and a central fold position. Exclude photographed books, perspective, page curls, cast shadows, and black presentation-board margins; the reader supplies the physical book treatment.
- Generate the entire layout, including photos, graphic marks, paper treatment, typography, and captions. Keep critical text and faces away from the center fold. In the outside-cover artwork, **back cover is left, front cover is right**.
- Describe the desired visual transformations, such as cutouts, fragmented collage, duotones, overprinting, illustration, or abstraction. Do not automatically add requirements that photos remain photographs or that faces, gestures, scenery, and other details stay unchanged; include preservation constraints only when the user requests them.
- Quote the exact text and its language in the prompt. Prefer concise text that can remain readable at the final book size. When generated text is wrong, revise the artwork with ImageGen and inspect it again.
- Describe text scale explicitly: a small casual pencil note is different from a large handwritten title. Specify no headline or no text where planned. Handwriting alone does not make oversized lettering quiet.
- Name what must remain absent on this spread, such as extra motifs, patterns, saturated fields, or decorative lines. Ask for the planned amount of open space and restraint as concretely as the focal image.
- Generate and compare a quiet/impact pair first, as described in [book rhythm](book-rhythm.md). Inspect every output for its source connection, legibility, hierarchy, fold safety, and role in the sequence. Compare the whole book with [contact sheets](../scripts/make_contact_sheet.py), then review the actual page turns. Regenerate spreads that erase intended contrast or repeat a successful composition too closely. Resolve failed or missing spreads before calling the book complete.

A useful prompt shape (adapt, do not copy the example literally):

```text
Create one flat double-page zine artwork, spread ratio [2w:h].
Book constants: [premise, paper character, handwriting voice, restrained palette vocabulary].
Source references: [image 1 = principal subject or motif; image 2 = supporting shapes or details].
Style reference, if any: [accepted spread; specific properties to borrow and vary].
Sequence role: [what precedes/follows; pause, build, peak, release, or another intended effect].
Composition: [left/right hierarchy, image scale/count, occupied area and open space].
Text verbatim and treatment: [exact words, size, casual handwriting and placement; or no text].
Color and mark intensity: [coverage, saturation, texture, motifs, lines/shapes; what stays absent].
Visual transformations: [how the source material should be reinterpreted].
Keep key content clear of the center fold. Artwork fills the canvas.
No book mockup, perspective, page curl, binding shadow, or presentation border.
```

## Save and assemble

Keep accepted full-spread masters in the output's `assets/spreads/`, and lossless display halves in `assets/pages/`. Retain a `generation-manifest.json` recording, for each spread, a stable ID, actual tool used, source/reference paths, saved prompt, generated master path, and left/right leaf paths. Record actual tool outputs; never label a programmatic composite as generated. This makes coverage and later revisions reviewable.

Assembly may copy and losslessly split accepted artwork at its center, but must not redesign, filter, add captions to, or replace parts of it. Read [runtime notes](book-editing.md) for precise leaf ordering. The final UI displays the generated artwork itself, including its typography, with accessible descriptions alongside it.

If the tool fails or is unavailable, retain the completed work and report which spreads are missing. Do not silently fall back to a different renderer or a paid API. An alternative method requires the user's explicit instruction.

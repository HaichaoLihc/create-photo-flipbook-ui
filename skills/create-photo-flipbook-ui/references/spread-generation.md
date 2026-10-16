# ImageGen production for every spread

Use the built-in ImageGen tool for each finished double-page layout. Generate the outside cover and every interior spread, including title/endpaper, colophon, and intentionally quiet spreads. Each output is a complete designed spread; it can contain separate photographs and page space. Generating a cover, background texture, or a few decorative elements does not satisfy this requirement. Do not substitute a CSS collage, programmatic drawing, or a contact-sheet montage for a generated spread.

## Plan and reference

Begin with the selected concept in `creative-direction.md`; complete [creative ideation](creative-ideation.md) before committing to generation prompts. Choose a consistent leaf ratio and plan the sequence as facing pairs using [book rhythm](book-rhythm.md). For leaf width `w` and height `h`, a spread has ratio `2w:h`. Record each spread's source photos, narrative role, composition, page ground, exact text or intentional absence of text, and changing visual intensity. Apply the [default editorial zine principles](default-style.md) unless the user requests another aesthetic.

Inspect the actual source photographs. Supply the selected photos as ImageGen image references, explicitly identifying the content, shapes, colors, or mood to draw from. They are creative inputs that can be transformed according to the art direction. Supplied design references guide the visual language. Carry only the book's essential constants into every prompt; specify each spread's distinct role and intensity separately. A saturated cover is not a universal style reference. Use an accepted quiet reference for quiet work when helpful, and tell ImageGen which properties to borrow and which to vary.

Every generation brief must carry the compact overall arc, the current spread's position and purpose, and its relationship to the preceding and following spreads. State what continues, contrasts, accumulates, pauses, or returns across those turns. Use the neighbors' accepted artwork when available and their planned descriptions otherwise. Do not assume the image model remembers other calls. When a visual reference clarifies continuity, attach the relevant accepted spread and identify the properties to retain without copying its layout. The first and last spreads use their opening/closing roles rather than invented neighbors.

Carry the same book-wide typography specification into every text-bearing prompt: family or consistent hand, text roles, relative size hierarchy, weights, case, and spacing. Once an accepted pilot establishes the letterforms, reuse it as a typography reference when helpful, explicitly separating its type from its composition and color. A typographic anchor can be a different reference from a neighboring spread. Choose or revise copy in the reading-order plan before generation; ImageGen receives exact words and their role in the book's text thread, rather than inventing a new caption or voice for each picture.

Translate the idea into an artistic operation and a page composition together. Identify the source detail, what stays photographic, what changes medium or form, and how they interact across the leaves. For example, a natural photograph of a reaching arm can face a feather detail enlarged into a sparse ink fan, with a small photographic gull crossing the fan's edge. Then specify crop, scale, image edges, open space, and type relationships. Adapt the operation to the source and sequence; do not reuse this example as a formula. For a planned photographic rest, say explicitly that the intervention recedes. For a mixed passage, make the intended transformation as concrete as the layout.

Check the shared prompt prefix for biases in either direction. Blanket rules such as “no rectangular photos” or “one integrated montage” erase editorial structure; “only clean rectangles,” “no illustration,” “no overlap,” or “no graphic marks” can erase the artistic language. Use those constraints only for passages that need them, not for the whole book. Likewise, do not automatically carry “cream paper,” “faint wash,” or “small handwritten note” into a concept that calls for another visual world. Specify the page ground and its role explicitly, including the cover. Lead with what should make the spread artistically compelling, then add relevant local constraints.

## Generate and review

- Make a separate generation call for each distinct spread using the shared book brief and surrounding-sequence context above. Generate the two facing leaves together, not independently. Request **one flat scan-like reproduction of a designed double-page photo-zine layout**, with explicit left and right page composition and a central fold position. The page surface fills the canvas; photographs need not. Internal margins, image borders, columns, and blank page areas are part of the artwork. Exclude an external desk or presentation surround, photographed book perspective, page curls, and binding shadows; the reader supplies the physical book treatment. An intentional black page ground or shadow within a source photograph remains valid.
- Generate the entire layout, including photos, graphic marks, paper treatment, typography, and captions. Keep critical text and faces away from the center fold. In the outside-cover artwork, **back cover is left, front cover is right**.
- Specify the degree of intervention and which source content remains photographic, which part is transformed, and how the two interact. In mixed passages, allow selective drawing, overprint, masks, cutouts, or graphic extensions while retaining recognizable photographic content. Preserve distinct spatial identities where meaningful; do not require every component to stay in an intact rectangular frame. A continuous invented scene belongs only to a deliberate stronger passage. Honor the user's fidelity or transformation requirements.
- Quote the exact planned text and its language in the prompt. Prefer concise text that can remain readable at the final book size. Inspect both wording and consistency with the shared typography; correct unplanned family, handwriting, or hierarchy changes as well as wrong words. Revise the artwork with ImageGen and inspect it again.
- Describe text scale explicitly: a small casual pencil note is different from a large handwritten title. Specify no headline or no text where planned. Handwriting alone does not make oversized lettering quiet.
- Name what must remain absent on this spread, such as extra motifs, patterns, saturated fields, or decorative lines. Ask for the planned amount of open space and restraint as concretely as the focal image.
- Generate and compare the cover, quiet, impact, and representative middle pilots described in [book rhythm](book-rhythm.md). Inspect source connection, actual artistic operation, degree of intervention, page composition, crop/spacing precision, type hierarchy, fold safety, and role in the sequence. An actual ImageGen output is a production requirement, not proof of artistic quality. Compare the whole book with [contact sheets](../scripts/make_contact_sheet.py), then review the page turns. Regenerate spreads that flatten planned transformations into plain photo boxes, over-transform photographic content, erase intended contrast, lose editorial hierarchy, or repeat a composition too closely. Resolve failed or missing spreads before calling the book complete.

A useful prompt shape (adapt, do not copy the example literally):

```text
Create one flat scan-like reproduction of a designed double-page photo-zine layout, spread ratio [2w:h].
Chosen book concept and this spread's operation: [what the reader experiences; how the idea becomes visible here].
Book constants: [shared artistic vocabulary, material behavior, type, and color decisions from creative-direction.md].
Overall arc and position: [compact whole-book progression; current movement and spread number].
Source references: [image 1 = principal subject or motif; image 2 = supporting shapes or details].
Artistic and editorial operation: [specific source detail -> treatment -> relationship to the photographic material and page; what it expresses].
Style reference, if any: [accepted spread; specific properties to borrow and vary].
Neighboring turns: [preceding spread's accepted/planned composition and words -> current response -> following spread's setup; intended continuity or contrast].
Page architecture: [left/right roles; each image unit's crop, size, position, edges, margins and alignments; reading order].
Degree of intervention: [light, mixed, or strong; what remains photographic, what changes, what stays untouched; independent of loud/quiet intensity].
Page ground: [dark/light, colored/photographic/material field, edges and coverage; why it belongs to this passage].
Shared typography: [unchanged family or hand, roles and hierarchy, case/weight/spacing rules; accepted type reference if available].
Text verbatim and purpose: [exact words from the plan, connection to the book's theme and nearby text, shared type role and local placement; or no text].
Color and mark intensity: [coverage, saturation, texture, motifs, lines/shapes; what stays absent].
Selective richness: [a meaningful secondary relationship or close-view detail, if this passage needs one; otherwise leave it quiet].
Keep key content clear of the center fold. The page surface fills the canvas; preserve the designed internal margins and image boundaries.
No book mockup, perspective, page curl, binding shadow, or external presentation surround.
```

## Save and assemble

Keep accepted full-spread masters in the output's `assets/spreads/`, and lossless display halves in `assets/pages/`. Retain a `generation-manifest.json` recording, for each spread, a stable ID, actual tool used, source/reference paths, saved prompt, generated master path, and left/right leaf paths. Record actual tool outputs; never label a programmatic composite as generated. This makes coverage and later revisions reviewable.

Assembly may copy and losslessly split accepted artwork at its center, but must not redesign, filter, add captions to, or replace parts of it. Read [runtime notes](book-editing.md) for precise leaf ordering. The final UI displays the generated artwork itself, including its typography, with accessible descriptions alongside it.

If the tool fails or is unavailable, retain the completed work and report which spreads are missing. Do not silently fall back to a different renderer or a paid API. An alternative method requires the user's explicit instruction.

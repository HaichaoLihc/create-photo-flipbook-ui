# Travel Zine

Use for personal journeys, city wandering, road trips, holidays, and place-based diaries. Make the pages feel assembled, printed, and handled rather than designed as a website. Draw from the references' physical-zine character without copying a specific layout.

## Edit

- Curate aggressively. A photograph must contribute a place, encounter, transition, atmosphere, visual motif, or useful contrast; technical adequacy alone is insufficient.
- Prefer a small, convincing edit over broad coverage. It is acceptable to use very few photographs, leave quiet pages, or make a short book.
- Reject near-duplicates, weak establishing shots, generic scenery, and images that repeat information without changing rhythm or meaning.
- Keep only the strongest version of a repeated moment. Do not create a slot for every supplied image and do not copy rejected files into the output.
- Balance recognizable place with incidental evidence: people, storefronts, transit, food, signs, rooms, weather, maps, receipts, and odd details when the collection actually contains them.

## Sequence

- Find the journey's character before imposing chronology. Use chronology when it carries movement; otherwise sequence through neighborhood, color, gesture, recurring symbol, or emotional shift.
- Shape a compact arc: invitation or departure, immersion, one change of pace, and a memorable final trace. Chapters are optional, not mandatory.
- Use page turns for arrival, surprise, geographic movement, day-to-night change, or a shift from public view to private detail.
- Let recurring colors, signs, routes, objects, or human gestures reappear with variation.

## Pair and pace

- Mix one decisive hero image with small clusters of two or three supporting fragments. Do not turn every spread into a collage.
- Pair wide views with telling details, public scenes with personal evidence, motion with stillness, or polished vistas with awkward everyday moments.
- Vary image scale, placement, and density while preserving a readable dominant image. Use blank paper as active pacing.
- Allow photographs to cross the gutter only when the center does not destroy a face, sign, horizon, or essential detail.

## Production method: ImageGen required

- Use ImageGen to create every finished leaf, including the front cover. Do not compose page artwork with HTML, CSS, SVG, canvas, or positioned DOM elements.
- Decide each spread as a pair, then generate its left and right leaves as separate, flattened raster images with identical pixel dimensions and a consistent page ratio. Keep their paper stock, palette, printing process, and gutter relationship coherent.
- Supply only the selected source photographs needed for that leaf as image references. Preserve their recognizable people, places, objects, and documentary content; use generation for layout, paper, print texture, typography, and physical ephemera rather than inventing new travel scenes.
- Keep faces, readable signs, and essential subjects away from the gutter and trim. Do not invent dates, coordinates, tickets, handwriting, messages, or geographic facts.
- Keep generated wording short. Verify all visible text character by character and regenerate any leaf with misspelling, malformed type, fake metadata, distorted faces, or materially altered photographic facts. Do not repair the page with an HTML text overlay.
- Put final leaves under `assets/pages/`. In the flipbook HTML, render each leaf as one edge-to-edge `<img>` only; HTML provides page turning and accessibility, never the travel-zine composition.
- Build the final page contact sheet directly from the generated leaf images, inspect it in reading order, and regenerate only weak or inconsistent leaves. Do not run a browser or HTML renderer to preview artwork that already exists as raster pages.

## Compose as paper

- Build each leaf as a physical page surface first: warm uncoated stock, recycled grey, faded color stock, tracing-paper tint, or lightly printed ink field chosen from the photographs.
- Use subtle fiber, grain, ink variation, edge wear, imperfect registration, or photocopy/riso noise. Texture must remain quiet enough to protect photographs and legibility; avoid one uniform digital-noise overlay across the whole book.
- Treat photographs as prints: full bleed, pasted snapshot, contact-print strip, clipped fragment, or image partly interrupted by type or an annotation. Slight offsets and overlaps are welcome when intentional.
- Use simple physical cues sparingly: tape, staples, pencil or route lines, crop marks, torn or deckled edges, stamps, tickets, labels, or translucent overlays. Derive wording and facts from supplied context; never invent dates, coordinates, messages, tickets, or travel facts.
- Avoid webpage language inside the pages: no cards, chips, pills, glass panels, rounded UI containers, chat bubbles, menus, buttons, dashboards, or evenly repeated component grids.
- Avoid pristine white browser-canvas pages, generic drop-shadow cards, and perfectly centered modular layouts. Shadows should describe pasted paper, page curvature, or the binding—not floating web components.

## Type and color

- Use expressive, print-minded typography: a bold grotesque, loose display sans, hand-drawn accent, or occasional condensed face, supported by one plain text face. Limit the book to two principal families plus a rare handwritten treatment.
- Let place names or a single phrase become image-like, but do not place small metadata around large display type. Keep most other text compact.
- Rotate, crop, repeat, outline, or run type vertically only when it strengthens movement or place. Avoid decorative distortion on every spread.
- Use notes, captions, and diary fragments selectively. Prefer brief, specific language over tourism copy.
- Pull two or three colors from the selected photographs, then add at most one assertive accent. Allow stocks and ink colors to change between sections while keeping a coherent print family.

## Cover and finish

- Make the cover feel printed: one strong place/title gesture, one photograph or source-derived illustration field, and restrained issue/date information only when known.
- Do not make the cover resemble an app splash screen or marketing landing page.
- Match the back-cover stock or dominant ink color to the front; keep it mostly quiet.

## Critique

On the spread contact sheet, reject:

- a book that uses most inputs or preserves filename order without editorial reason;
- several merely competent photographs where one strong image would suffice;
- page surfaces that read as white webpages or UI component layouts;
- identical paper texture, collage density, or photo scale on every spread;
- decorative tape, stickers, stamps, notes, or coordinates without source meaning;
- clutter without a dominant image, or scrapbook effects that hide the photographs;
- typography that looks like web headings and captions instead of printed matter;
- an ending chosen because the source folder ran out rather than because it resonates.

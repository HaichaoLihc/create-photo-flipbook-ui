---
name: create-photo-flipbook-ui
description: Create photobooks by understanding input photos, art-directing a zine, generating every spread with ImageGen, and building a local 2D flipbook. Use for photobooks and artist books from photos, image folders, or visual references.
---

# Photobook Art Direction

Create a photobook through the stages below. Honor the user's scope and keep source files intact. `SKILL_DIR` is the directory containing this file.

**Every finished spread must be generated with ImageGen.** This includes the outside cover and interior spreads containing title pages, endpapers, colophon, or intentional blank space. Generate each spread as one complete artwork; HTML/CSS serves as the reader, not a substitute for spread generation. This requirement applies to the default and requested styles unless the user explicitly overrides it. If ImageGen is unavailable, report the limitation rather than silently delivering a different production method.

## 1. Understand the photos

Goal: develop a basic understanding of the input photos' form, content, and themes.

Available tools: [semantic photo search](references/photo-library.md) and [contact sheets](scripts/make_contact_sheet.py).

## 2. Design and generate the spreads

Goal: create a coherent artist book whose page turns have emotional and visual rhythm. Design the sequence as carefully as each individual spread.

Without a preferred style, use the [default editorial zine aesthetic](references/default-style.md), with casual handwritten text, expressive source transformations, and deliberate breathing room. Adapt it to the collection. A requested style or supplied reference guides the art direction; it does not remove the ImageGen requirement.

Treat the photos as creative source material. ImageGen may reinterpret them through collage, cutouts, recoloring, illustration, abstraction, and print treatments. Only impose photographic fidelity or detail-preservation constraints when the user requests them.

Read [book rhythm](references/book-rhythm.md) and [spread generation](references/spread-generation.md) before production. Save a sequence plan that varies text, images, motifs, patterns, objects, color, lines, and shapes across leaves and page turns. Establish both an impact spread and a genuinely quiet spread before extending the visual language. Pass selected source photographs as image references, generate every spread, and review the actual sequence for repetition and fatigue. Keep the sequence plan, prompts, source associations, accepted masters, and rhythm review with the output.

Optional research tools: [Pinterest](references/pinterest-style-research.md) and the [photo-skill catalogue](references/photo-skill-catalog.md).

## 3. Build the book UI

Goal: deliver the designed book as a working local 2D flipbook, with its URL and output directory.

Use the built-in [HTML runtime](assets/html/index.html). Display the accepted generated artwork as paired leaves without recomposing it in HTML. [Runtime notes](references/book-editing.md) cover cover order, splitting, and validation. Completion requires a generated master for every spread and a working local preview.

---
name: create-photo-flipbook-ui
description: Create editorial photo zines and photobooks by exploring creative concepts, editing and composing photographs into pages, generating every spread with ImageGen, and building a local 2D flipbook. Use for photobooks, photo zines, and artist books from photos, image folders, or visual references.
---

# Photobook Art Direction

Create a photobook through the stages below. Honor the user's scope and keep source files intact. `SKILL_DIR` is the directory containing this file.

**Every finished spread must be generated with ImageGen.** This includes the outside cover and interior spreads containing title pages, endpapers, colophon, or intentional blank space. Generate each spread as one complete page layout, which may contain distinct photographs, type, graphic elements, and unprinted space. One generated file does not imply one continuous illustrated scene. HTML/CSS serves as the reader, not a substitute for spread generation. This requirement applies to the default and requested styles unless the user explicitly overrides it. If ImageGen is unavailable, report the limitation rather than silently delivering a different production method.

## 1. Understand the photos

Goal: discover the collection's character and possibilities. Inspect the photos for subjects, light, color, recurring forms, gestures, textures, contrasts, and unexpected relationships. Ground the later ideas in specific images and details.

Available tools: [semantic photo search](references/photo-library.md) and [contact sheets](scripts/make_contact_sheet.py).

## 2. Explore creative directions

Goal: invent a book that could only grow from this collection. Explore ideas before committing to a palette, cover, layout system, or sequence.

Read [creative ideation](references/creative-ideation.md). For an open brief, develop several genuinely different concepts (usually three), including how each would change the theme, image presentation, motifs, material, typography, cover, and page turns. Use knowledge of books, printmaking, cinema, illustration, and other arts to invent editorial relationships. Different colors on the same layout are not different concepts; neither are different metaphors rendered as the same full-spread montage.

Save a concise `creative-direction.md` with the source observations, alternatives, chosen direction and rationale, and concrete design rules. Select and proceed autonomously unless the user asked to choose. When a style or concept is already specified, explore within it rather than reopening the brief.

Without a preferred style, make an expressive editorial photo zine using the [default zine principles](references/default-style.md): recognizable photography, selective artistic transformation, purposeful page composition, and relationships across images and turns. Choose a small artistic vocabulary from the sources—such as cutout and overprint, photographic fragments and drawn contours, or selective abstraction—and develop it across the book. Its character should be visible in ordinary middle passages as well as the cover. White or cream paper, faint backgrounds, and a small centered cover image are choices to justify, not defaults. Dark, saturated, photographic, patterned, and material-led books are equally available. Breathing room is about visual demand, not pale color. A requested style or supplied reference guides the art direction; it does not remove the ImageGen requirement.

## 3. Design and generate the spreads

Goal: create a coherent artist book whose page turns have emotional and visual rhythm. Design the sequence as carefully as each individual spread.

Carry the selected concept into the sequence and generation prompts. Design the whole book before generating its spreads: each call receives the overall arc, its place in that arc, and the preceding and following spreads' intended relationship. Separate generation calls are production units, not independent design briefs. These creative stages apply even when the request says only “make a photobook”; they must not depend on earlier conversation or an extra art-director brief.

Establish one book-wide typographic system and writing voice in `creative-direction.md`. Prefer handwritten-style text. Use one primary type family or consistent handwriting style; introduce another only for a necessary, defined role. Plan and edit the actual words together in reading order under the book's theme. Keep the language specific, natural, and grounded in the photos or the user's account. Carry the same type rules and approved wording into generation, then review visual rhythm, typography, and the text's continuity across the finished book.

Keep the photographs recognizable while actively art-directing their relationship to the page. Develop image treatment and composition together: a photographic detail might become an ink shape, an edge may open into drawing, or a cutout may interact with a second image and type. Vary the amount of intervention through the sequence: lightly treated rests, sustained passages mixing photography with selective transformation, and occasional more radical images. A whole book of untouched rectangles on colored paper misses this default, as does transforming every image into a continuous painting. Honor any user-specified fidelity or transformation requirements.

Across the whole book, select zero or one photo to present as-is; if choosing one, use the strongest, most visually compelling photo in the set.

Read [book rhythm](references/book-rhythm.md) and [spread generation](references/spread-generation.md) for planning and production.

Save a sequence plan with changing page structures, degrees of artistic intervention, text, images, motifs, patterns, objects, color, lines, and shapes. Establish the outside cover, an impact spread, a genuinely quiet spread, and a representative middle passage before extending the book. For the default zine, the middle pilot must visibly combine recognizable photography with a meaningful artistic operation and a considered left/right relationship. Check both failure modes: generic photo placement and indiscriminate transformation. Pass selected source photographs as image references and generate every spread. Keep the creative direction, sequence plan, prompts, source associations, accepted masters, and an actual-artwork rhythm review with the output. Richness should deepen selected passages while preserving the rests.

## 4. Build the book UI

Goal: deliver the designed book as a working local 2D flipbook, with its URL and output directory.

Use the built-in [HTML runtime](assets/html/index.html). Display the accepted generated artwork as paired leaves without recomposing it in HTML. [Runtime notes](references/book-editing.md) cover cover order, splitting, and validation. Completion requires a generated master for every spread and a working local preview.

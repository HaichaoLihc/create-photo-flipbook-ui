---
name: create-photo-flipbook-ui
description: Create photobooks by understanding input photos, defining the book's style and design, and building a local 2D flipbook. Use for photobooks and artist books from photos, image folders, or visual references.
---

# Photobook Art Direction

Create a photobook through the stages below. Choose the process and tools as needed to reach each outcome; honor the user's scope and keep source files intact. Tool references are optional. `SKILL_DIR` is the directory containing this file.

## 1. Understand the photos

Goal: develop a basic understanding of the input photos' form, content, and themes.

Available tools: [semantic photo search](references/photo-library.md) and [contact sheets](scripts/make_contact_sheet.py).

## 2. Define the book's style and design

Goal: finalize a coherent, aesthetically strong, high-quality style and design that fulfills the user's request.

Without a preferred style, preserve the original photos and use the [default photobook style](references/default-style.md), with its bundled design assets. For a requested style or supplied reference, choose appropriate tools to realize it; artistic treatments often require image generation for each spread.

Available tools: [Pinterest](references/pinterest-style-research.md), the [photo-skill catalogue](references/photo-skill-catalog.md), and image generation with [spread guidance](references/spread-generation.md).

## 3. Build the book UI

Goal: deliver the designed book as a working local 2D flipbook, with its URL and output directory.

Use the built-in [HTML runtime](assets/html/index.html). [Runtime notes](references/book-editing.md) cover integration and validation.

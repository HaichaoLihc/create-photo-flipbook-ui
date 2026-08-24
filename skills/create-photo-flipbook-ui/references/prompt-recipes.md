# Image-generation prompt recipes

Use these only in art-directed spread mode. Use the built-in image-generation tool unless the user explicitly requests a CLI/API workflow.

## Cover

```text
Use case: compositing
Asset type: high-resolution portrait photo-book cover
Primary request: Create a print-quality editorial cover from the supplied photographs while matching the requested theme.
Input images: Label every image as a factual photo anchor or style reference.
Composition: portrait book page; strong title zone; one clear photographic focal point; tactile paper detail.
Text (verbatim): "<TITLE>" and "<YEAR>"
Constraints: preserve people and factual photo content; render exact text once; no mockup frame; no watermark; no extra logos.
```

## Two-page spread

```text
Use case: compositing
Asset type: high-resolution two-page photo-book spread
Primary request: Create one continuous, print-quality editorial spread using the supplied photographs.
Input images: Label each source photo and its role.
Composition: 3:2 landscape spread; exact center gutter; balanced left and right leaves; preserve any requested sequence.
Style: premium minimal editorial photo book with restrained collage and real paper texture.
Text (verbatim): "<EXACT COPY OR NONE>"
Constraints: preserve faces, identity, place, and documentary details; no outer book mockup; no page duplication; no watermark; no extra text.
```

## Low-resolution reference reconstruction

```text
Use case: precise-object-edit
Asset type: high-resolution page or spread artwork
Primary request: Reconstruct the low-resolution reference at print quality while preserving its composition, crop, proportions, colors, page boundary, and placement of every element.
Input images: Image 1 is the factual edit target and composition lock.
Constraints: improve resolution and material fidelity only; preserve all legible wording verbatim; remove screenshot UI overlays; no invented content; no outer mockup frame; no watermark.
```

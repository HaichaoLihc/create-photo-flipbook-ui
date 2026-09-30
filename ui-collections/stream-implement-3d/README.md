# Undertow

A WebGL 2 curtain of 2,400 light threads. Each thread opens into a flowing photo story.
Vanilla JavaScript and CSS; no runtime dependencies or build step. `dist/` is the
editable website, not generated output.

## Run

From this directory:

```sh
python3 serve.py
```

Open http://localhost:8766. The preview server disables caching. Any static HTTP
server can serve `dist/`; opening `index.html` as a file will not load the modules
and JSON catalogs correctly.

**Photo files are local and deliberately excluded from Git.** The checked-in
`dist/photos.json` describes the existing 48-photo demo and preserves its credits
and source URLs (Lorem Picsum / Unsplash). A fresh clone needs those files restored
under `dist/assets/photos/`, or a replacement catalog and your own photos. There
is no automatic download. `npm run check` reports missing files.

## Structure

| File | Responsibility |
| --- | --- |
| `dist/index.html`, `style.css` | Page structure and presentation |
| `dist/js/app.js` | Camera, input, fibre simulation, render loop and startup |
| `dist/js/shaders.js` | GLSL for fibres, floor, reflections and bloom |
| `dist/js/gl.js` | WebGL programs, textures and render targets |
| `dist/js/photos.js` | Image loading, aspect ratios, average colors and GPU upload |
| `dist/js/catalog.js` | Catalog loading and validation |
| `dist/js/stories.js` | Generated stories and authored chapter data |
| `dist/js/story.js` | Story dialog, routing, scrolling and lightbox |
| `dist/js/math.js` | Shared math and seeded random generator |
| `dist/photos.json` | Photo IDs, local paths, descriptions and credits |
| `dist/stories.json` | Authored stories and shared sample journal entries |
| `scripts/` | Local photo import and catalog checks |

`work/` and `outputs/` are ignored local experiments, recordings and previous
exports. They are not loaded by the website; older exports do not reflect the
current source. `.openai/hosting.json` retains the existing static hosting target.

## How photos are organized

There is one flat library of 48 local JPEGs, totaling about 7.2 MB. Each catalog
entry has a stable string `id` and an `src` relative to `dist/`. Optional
`description` supplies the default caption, and `photographer` supplies the credit.
`category`, `source_page` and `source_url` are descriptive metadata, not grouping
or ordering rules. Photos need no atlas or manually entered dimensions.

`stories.json` currently has an empty `stories` array. All 2,400 threads therefore
use deterministic generated stories, normally with 4–8 distinct photos each
(fewer for small libraries). These reuse the photo library; there are not 2,400
separate albums. Adding or reordering catalog entries can change generated stories.
Use authored stories for a stable selection and sequence.

The shared `journal` contains sample writing, not dates extracted from photographs.
Its first and last entries are spread across each story. Per-chapter `date` and
`text` override the samples; set them to empty strings to suppress them, or set
`journal` to `[]` to remove all shared text.

## Add photos

```sh
python3 scripts/add-photo.py /path/to/summer.jpg --id summer \
  --description "An afternoon by the sea" --photographer "Your name"
```

This copies the file to `dist/assets/photos/summer.jpg` and appends its metadata to
`dist/photos.json`. Duplicate IDs/files are rejected. JPEG, PNG, WebP and AVIF are
accepted; use a format supported by your target browsers. The script does not resize
or convert files. Export reasonably sized images first (the current demo's longest
edge is about 1,400 pixels). The file remains ignored by Git; its catalog entry is
tracked. Refresh the page to include it in the generated stories.

Alternatively, copy files yourself and add entries like:

```json
{
  "id": "summer",
  "src": "assets/photos/summer.jpg",
  "description": "An afternoon by the sea",
  "photographer": "Your name"
}
```

To start with your own library, replace `photos.json` with `{"photos": []}` and
import at least one photo before launching. Keep filenames free of spaces. Removing
a photo requires removing its catalog entry and any authored chapter references.

## Author a story

Add an object to the `stories` array in `dist/stories.json`:

```json
{
  "id": "summer-at-sea",
  "title": "Summer at sea",
  "line": 1200,
  "chapters": [
    { "photo": "summer", "date": "June 2026", "text": "We stayed until the light went." }
  ]
}
```

IDs must be unique; `line-N` is reserved for generated stories. `line` is optional,
zero-based, and must be between 0 and 2399. Omitted lines are spread evenly across
the curtain; collisions are reported so you can choose explicit lines. A story
must have 1–8 chapters. The eight-chapter limit comes from the shader's texture
layout, not the size of the photo library.

Write chapters oldest to newest. The story view shows the newest first from top
to bottom while the stream moves downward. Share a story with
`#/story/summer-at-sea`; append `/1` to center its first chapter. Dates are display
text and do not sort chapters. Optional chapter `caption` and `credit` override
the photo defaults.

## Checks and limits

With Node.js 20 or newer (no `npm install` needed):

```sh
npm test
npm run check
```

Tests cover small libraries, deterministic story generation, ordering, journal
overrides and invalid references. The catalog check also verifies local files.
Image decoding and WebGL rendering still need a browser check.

All photos load at startup. Each gets a 512×512 RGBA texture plus mipmaps: roughly
1.33 MiB per photo, or 64 MiB for 48, before render targets and decoded images.
The device's texture-array layer limit is checked before upload. Adding a handful
of photos is straightforward; a library of thousands needs a different loading
strategy (paging/lazy loading), not just a larger catalog.

Use arrows and Enter to select/open threads, scroll or pinch to zoom, Space to
pause, and Escape to go back. Inside a story, left/right switches stories (or
lightbox photos), up/down scrolls, and clicking a photo enlarges it.

# Negative Sleeves

A photo-free, reusable film-sleeve UI: translucent pages, 5 × 7 negative frames,
corner-hover previews, page dragging, and whole-strip exchanges. Plain HTML,
CSS, and JavaScript with one vendored page-flip dependency. No npm install,
framework, or external fonts. Optional in-book semantic search reuses your
existing photo-search engine.

## Add your photos

From this directory, with Python 3.10 or newer:

```sh
python3 build_archive.py "/path/to/your/photos"
python3 -m http.server 4181 --bind 127.0.0.1
```

Open [the local preview](http://127.0.0.1:4181/?page=2).
The importer finds JPEG, PNG, and WebP files recursively, sorts them naturally by
filename, copies them unchanged, and creates the entire book. Rerun the first
command to rebuild after adding or changing photos. Export HEIC/RAW images to
JPEG first. An optional `--sequence order.json` accepts an `ordered_indices`
array containing every one-based source index exactly once.

`index.html` is generated, not shipped. It embeds the full book markup; no
runtime manifest or build server is needed. Photos go into `assets/full-archive/`.
An ignored `source-manifest.json` records the import locally. Old unused copies
are not deleted automatically. Rebuilding replaces the generated book; it does
not modify your source folder.

## Put the book in chronological order

After importing, run this with a Python environment that includes Pillow:

```sh
/path/to/photo-search/.venv/bin/python reorder_by_date.py
```

This resequences the existing book from earliest to latest camera capture time
using EXIF `DateTimeOriginal` (including subseconds), then `DateTimeDigitized` if
needed. It uses the camera's recorded local time, never the export/modification
date. Undated photos go last; identical timestamps retain source-index order.
The importer and reordering utility never modify the original photographs.

Only generated HTML and private ordering metadata are rebuilt. The previous
generated arrangement is backed up under ignored `working/before-chronological-*`.
Photo identifiers stay unchanged. Old browser-saved strip layouts no longer apply
to the resequenced book, so a previous manual arrangement cannot undo the new order.
After importing additional photos, rerun this command to restore chronological order.

## Rearrange film strips

Drag the narrow end nearest the spine to lift all five frames. A subtle grip
appears when hovering that inner end. Hover over another row to
preview an exchange; release to swap. Both visible sleeves accept strips.
Dragging outside the available rows or pressing Escape returns the film.
The sleeve itself stays unchanged, including its transparent perforations.
Each strip has a fine amber cut edge, a shallow contact shadow, and a continuous
surface reflection that suggests a slight bow in the thin film. Both the film
base and the reflection share perforated masks, so highlights never fill the
holes. Static, irregular micrograin replaces repeating dots; it is shared with
the enlarged film surfaces. Hover gently changes reflection opacity without
moving the strip, adding event handlers, or interfering with page gestures.
Drag elsewhere (including over photos) or use the arrow controls to turn pages;
a click or stationary tap inspects one exposure. Gesture ownership is fixed on press, so moving
across a strip or a handle never interrupts a page turn.

Exchanges are saved in this browser's local storage without modifying the
source photographs or semantic sequence. Use the understated Undo control or
Cmd/Ctrl-Z to undo exchanges from this visit. With a strip focused, Space lifts,
arrow keys choose a destination, and Enter places. Reduced-motion preferences
disable the lift/settle animation. Invalid or obsolete saved orders are ignored.

## Inspect one exposure

Click a photograph to lift its single film segment out of the sleeve, enlarge it,
and turn it over to reveal the positive image. Both perforated rails travel with
the photograph; the source strip temporarily shows the matching cutout. The photo
keeps its film-frame crop. No photograph or saved arrangement is changed.

The enlarged segment has two distinct surfaces: a glossy base with a narrow,
moving reflection and very fine texture, and a satin emulsion with a broad,
diffuse reflection and more visible micrograin. **Turn over** or **F** compares
the two sides; the emulsion view mirrors the same image, as seen through the
opposite side of a transparent film. A small pointer-driven tilt changes the
reflection without moving the archive underneath. The default reading side stays
upright and positive. Positive development is a UI preview, not a physical effect
of turning a negative over. The material distinction follows
[Epson's film-holder guidance](https://files.support.epson.com/pdf/pr125_/pr125_sb.pdf).

Click the film, the surrounding background, or **Return to sleeve** to put it back;
Escape works too. The same animation runs backward, including if interrupted while
opening. If the emulsion side is facing outward, it first turns back before
returning to the sleeve. Keyboard users can focus a photo and press Enter; focus returns to that
photo after closing. On touch screens, stationary taps inspect and swipes still
turn pages. A viewport resize safely returns the exposure to its sleeve.

Movement, turning, and the brief surface reflection use only transform/opacity
animations. Reduced-motion preferences replace the flight and rotation with a short
fade. While inspecting, the book is inert and pending search navigation waits until
the exposure has returned. Closing does not clear the search or its highlights.

## Search inside the book

The vendored page-turn runtime includes small gesture fixes: backward turns use
the renderer's coordinate offset (as forward turns do), and finger tracking starts
immediately so slower swipes do not acquire the wrong page-turn direction, and
releasing an unavailable turn at either end of the book returns to the idle state.
Slow portrait drags complete after crossing half the page, without requiring the
finger to leave the screen. Desktop spread geometry remains unchanged.

Type a keyword or description in the header and press Enter. `/` or Cmd/Ctrl-K
focuses the search field. Search is paginated, with no 50- or 200-photo ceiling.
Each sleeve takes the next 35 highest-scoring photographs and sequences that batch
in archive order. The same book returns to its opening spread;
the old films fade away and seven strips fan into the right sleeve, holding the
first 35 results. The left page stays blank. Turn the page to assemble the next
spread (up to 70 photographs), then keep turning until the matching index is exhausted.
On phones, each turn shows one sleeve of up to 35 photographs.

Only the visible sleeves and one spread ahead load new photo nodes and images.
Lightweight empty leaves preserve native page dragging and corner previews;
loading a batch fills the existing leaf instead of rebuilding the book. Previously
loaded sleeves stay available when going backward. During a slow load the footer
shows progress and you can still return to an earlier spread. Failed batches offer
**Retry loading** without discarding the other results. The last sleeve may be
partially filled; the footer explicitly marks the end of results.

The ordinary arrows, page dragging, and corner previews navigate these temporary
result sleeves. The footer shows the visible result range. Each result uses the
same developed color and glow as hover, and clicking still extracts a single
exposure for inspection. Empty rows stay bare, without placeholder film strips.

The × control, an empty query, or Escape restores the original archive at the page
where search began. Original page nodes, chronological order, strip exchanges,
and local storage are preserved; search sleeves cannot be rearranged. No separate
results grid or workspace is created. Reduced motion uses short fades instead of
page turns and fanning strips. A newer query or clearing search cancels unfinished
assembly and outstanding batch requests, and resizing safely settles the strips
into their new layout. Later batches are less relevant, and each batch—not the
entire result set—is chronological. The existing nonnegative similarity threshold
is retained; the total describes available candidates, not a confidence guarantee.

For local semantic search, replace the static server above with:

```sh
/path/to/photo-search/.venv/bin/python archive_server.py \
  --engine-dir /path/to/photo-search \
  --index-dir /path/to/photo-search-index
```

The existing installation must provide `photo_search_engine.py` and its Python
dependencies (including NumPy). The index directory must contain
`paths.json` and `embeddings.npy`, with paths matching this book's imported source
photos. The model must already be cached; the server does not download one.
`--index-dir` defaults to `--engine-dir`. Environment variables
`PHOTO_SEARCH_ENGINE_DIR` and `PHOTO_SEARCH_INDEX_DIR` are also supported.

This adapter reuses `PhotoSearchEngine`'s loaded model, text processor, and embeddings,
makes an archive-only index copy in ignored `.search-cache/`, and leaves the original
engine and index untouched. Since the shared engine's convenience `search()` method
caps requests at 200, the adapter uses the same text encoding and similarity calculation
to rank the whole scoped index. An in-memory, eight-query LRU cache keeps that ranking
stable between batches without rerunning model inference on every page. Queries and
rankings are not written to disk. `/api/search?q=…&offset=0&limit=35` returns `photos`,
`total`, and `next_offset` (null at the end); response limits are 1–70, not a total cap. Search
status reports the number of indexed archive photos. Without an engine configured,
the book still works; semantic search is unavailable. Search is read-only and does
not save queries or change your browser's existing saved strip order.

## Privacy and publishing

The directory's `.gitignore` excludes imported photos, generated HTML, private
manifests, local sequencing data, search caches, and preview images. The GitHub
package contains only source code, tests, and the page-flip library's MIT license.
No photos are uploaded by the importer or UI.

The search server binds only to `127.0.0.1`, rejects cross-origin requests,
and serves only UI assets and photos referenced by the archive. Private manifests,
source paths, and search caches are not served. Do not expose this local server
as a public hosting service.

To publish a static populated book later, explicitly copy `index.html`, the seven UI
files (`styles.css`, `archive-search.css`, `film-inspector.css`, `flipbook.js`,
`strip-arrangement.js`, `archive-search.js`, `film-inspector.js`), `style/film-perforations.svg`,
`vendor/`, and only the referenced photos to your host. Do not publish the local
manifest or leftover photos. Hosting a populated book makes those photos public
unless you separately restrict access. Semantic search requires the local
server and are not available on a static host.

## Check

No personal photos or third-party Python packages are needed:

```sh
python3 -m unittest test_build_archive.py
node --test html-contract.test.mjs film-negative.test.mjs archive-search.test.mjs
```

Backend tests use synthetic images, NumPy, Pillow, and PyTorch; no model or personal photos:

```sh
/path/to/photo-search/.venv/bin/python -m unittest test_archive_server.py test_reorder_by_date.py
```

Original UI code follows the repository's MIT license. The unmodified renderer
retains [its own MIT notice](vendor/PAGE-FLIP-LICENSE).

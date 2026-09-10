# Negative Sleeves

A photo-free, reusable film-sleeve UI: translucent pages, 5 × 7 negative frames,
corner-hover previews, page dragging, and whole-strip exchanges. Plain HTML,
CSS, and JavaScript with one vendored page-flip dependency. No npm install,
framework, external fonts, or image service.

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

## Rearrange film strips

Drag the narrow end nearest the spine to lift all five frames. A subtle grip
appears when hovering that inner end. Hover over another row to
preview an exchange; release to swap. Both visible sleeves accept strips.
Dragging outside the available rows or pressing Escape returns the film.
The sleeve itself stays unchanged, including its transparent perforations.
Drag elsewhere (including over photos) or use the arrow controls to turn pages;
a tap still develops a photo. Gesture ownership is fixed on press, so moving
across a strip or a handle never interrupts a page turn.

Exchanges are saved in this browser's local storage without modifying the
source photographs or semantic sequence. Use the understated Undo control or
Cmd/Ctrl-Z to undo exchanges from this visit. With a strip focused, Space lifts,
arrow keys choose a destination, and Enter places. Reduced-motion preferences
disable the lift/settle animation. Invalid or obsolete saved orders are ignored.

## Privacy and publishing

The directory's `.gitignore` excludes imported photos, generated HTML, private
manifests, local sequencing data, and preview images. The GitHub package contains
only UI source, the importer, tests, and the page-flip library's MIT license.
No photos are uploaded by the importer or UI.

To publish a populated book later, explicitly copy `index.html`, the three UI
files (`styles.css`, `flipbook.js`, `strip-arrangement.js`), `style/film-perforations.svg`,
`vendor/`, and only the referenced photos to your host. Do not publish the local
manifest or leftover photos. Hosting a populated book makes those photos public
unless you separately restrict access.

## Check

No personal photos or third-party Python packages are needed:

```sh
python3 -m unittest test_build_archive.py
node --test html-contract.test.mjs film-negative.test.mjs
```

Original UI code follows the repository's MIT license. The unmodified renderer
retains [its own MIT notice](vendor/PAGE-FLIP-LICENSE).

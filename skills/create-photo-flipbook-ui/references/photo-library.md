# Photo tools

Semantic search, previews, and contact sheets are available to help understand input photos. Choose whichever tools are useful; the examples below are not a required sequence.

## Existing MCP library

The `photo-search` MCP provides:

- `photo_search_stats()` checks readiness and indexed count.
- `search_photo_contact_sheet(query, count=25, threshold=0.0)` returns 10–50 ranked photos in a five-column grid plus a JSON manifest. View the image and use the manifest to map a 1-based row/column to `photo_id`.
- `get_photo(photo_id, max_edge=1600)` opens a larger preview for a shortlist. Use original paths from the manifest for production, not contact-sheet thumbnails.

The current MCP is read-only and has no folder selector or indexing tool. Its global index may not cover a supplied folder; the adapter below supports folder-scoped semantic search.

`agents/openai.yaml` declares the dependency. The engine must still be installed; the skill does not contain model weights or configure an MCP server. Preserve the existing server configuration and its global index.

## Folder collection adapter

The reusable [photo_library.py](../scripts/photo_library.py) adapter calls the installed engine's `index.py` and `PhotoSearchEngine`. It keeps a separate collection per canonical source folder, re-embeds new or changed files, removes deleted entries from the active index, and reuses unchanged vectors. It never modifies originals. Changes are detected by size and nanosecond modification time; use a new cache directory for a complete rebuild when those attributes were deliberately preserved.

Find the engine directory from the configured `photo-search` MCP command/arguments or a user-provided location. Set `PHOTO_SEARCH_ENGINE_DIR` to that directory and `PHOTO_PYTHON` to its Python interpreter (usually `.venv/bin/python`). Keep machine-specific paths out of the skill. Check setup without loading the model:

```bash
python3 "$SKILL_DIR/scripts/photo_library.py" --engine-dir "$PHOTO_SEARCH_ENGINE_DIR" doctor
```

Use the engine's interpreter for indexing and search; its requirements supply NumPy, PyTorch, Transformers, and Pillow. Overview and selection need no model; contact sheets need Pillow.

```bash
"$PHOTO_PYTHON" "$SKILL_DIR/scripts/photo_library.py" --engine-dir "$PHOTO_SEARCH_ENGINE_DIR" \
  index "$PHOTO_FOLDER" --cache-dir "$PHOTO_LIBRARY_CACHE"
```

Set `PHOTO_FOLDER` to the supplied folder and `PHOTO_LIBRARY_CACHE` to a persistent writable cache **outside** the photo folder and the installed skill. Without `--cache-dir`, the default is `~/.cache/photo-search/collections`. Index only the requested folder. Supported source extensions are `.jpg`, `.jpeg`, `.png`, and `.webp`; other formats need conversion to working copies. Symlinks escaping the folder are excluded.

Index output includes `collection_dir`, `status`, `total_images`, `reused`, `embedded`, and `skipped`. `COLLECTION_DIR` below is the returned path. Partial indexing is identified explicitly; an engine failure leaves the previous active snapshot intact. Immutable snapshots remain in the cache, and only one indexing run per collection can run at a time.

## Contact sheets and queries

An overview is an evenly spaced sample of sorted paths, not a complete inventory or semantic clustering:

```bash
"$PHOTO_PYTHON" "$SKILL_DIR/scripts/photo_library.py" overview \
  --collection "$COLLECTION_DIR" --count 25 --output "$BOOK_WORK/source-overview"
```

Semantic queries can describe subjects, light, mood, geometry, or relationships:

```bash
"$PHOTO_PYTHON" "$SKILL_DIR/scripts/photo_library.py" --engine-dir "$PHOTO_SEARCH_ENGINE_DIR" search \
  --collection "$COLLECTION_DIR" --query "a small figure in a vast landscape" \
  --count 25 --output "$BOOK_WORK/search-01"
```

`BOOK_WORK` is the book's working directory; each sheet requires a new output directory. The adapter accepts 1–50 results with five-column ordering. An empty result has `count: 0` and `contact_sheet: null`. Similarity scores measure retrieval similarity, not aesthetic quality or confidence. Each CLI search loads the model; the MCP reuses its loaded model for its connected library.

Returned `contact_sheet` paths can be viewed with the image viewer; manifests map cells to original paths. Collection-only IDs may not exist in the global MCP's `get_photo`. A direct [contact-sheet helper](../scripts/make_contact_sheet.py) also accepts an explicit ordered image list without indexing:

```bash
python3 "$SKILL_DIR/scripts/make_contact_sheet.py" --output contact-sheet.jpg image-01.jpg image-02.jpg
```

## Selection export

Selection export accepts IDs from a saved manifest in the requested order. Duplicates retain their first occurrence:

```bash
"$PHOTO_PYTHON" "$SKILL_DIR/scripts/photo_library.py" select \
  --manifest "$BOOK_WORK/search-01/manifest.json" --collection "$COLLECTION_DIR" \
  --ids "$PHOTO_ID_1" "$PHOTO_ID_2" --output "$BOOK_WORK/selection.json"
```

Use actual returned IDs. `select` also accepts the JSON portion of a saved MCP manifest. Pass `--collection` when enforcing a folder boundary. The selection records original paths, stable IDs, and file fingerprints; it does not copy or redesign photos. Keep query manifests with the project. Search rank is not final book order.

Photo interpretation, aesthetic judgments, and sequencing remain the agent's decisions. Direct contact sheets remain available without the semantic-search engine.

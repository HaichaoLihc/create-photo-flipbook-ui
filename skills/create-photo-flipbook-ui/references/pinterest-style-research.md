# Pinterest Research

Pinterest is available for visual references, image treatments, materials, typography, and book design. Choose whether and how to research based on the user's request.

## Run the helper

Set `SKILL_DIR` to the directory containing the loaded `SKILL.md`. Run from the project's working directory. Requires Node.js 22.12+, Chrome/Chromium, and the helper's pinned dependency; no MCP server.

```bash
node "$SKILL_DIR/scripts/pinterest/cli.mjs" doctor
```

If the dependency is missing, install once:

```bash
npm --prefix "$SKILL_DIR/scripts/pinterest" ci --omit=dev
```

Set `PINTEREST_CHROME_PATH` if Chrome is outside the detected locations.

```bash
node "$SKILL_DIR/scripts/pinterest/cli.mjs" search \
  --query "botanical portrait torn paper collage" --limit 12 \
  --output "$PWD/pinterest-references"
```

Queries return `contact_sheet.path` and `manifest_path`. A sheet shows at most 16 references; `failed_indices` identifies missing previews. Searches allow 1–40 results. Every search is live; saved results can be reused.

Reference numbers belong to their manifest and `search_id`. Titles can be null; pin and image URLs identify the source. Selected originals can be downloaded for closer inspection:

```bash
node "$SKILL_DIR/scripts/pinterest/cli.mjs" download \
  --manifest "/absolute/path/to/manifest.json" --indices 2,5 \
  --output "$PWD/pinterest-selected"
```

Saved manifests work across runs. Partial download failure exits nonzero but retains successful files and a failure list. `info --url IMAGE_URL` reports dimensions and MIME type. `--json-only` skips previews.

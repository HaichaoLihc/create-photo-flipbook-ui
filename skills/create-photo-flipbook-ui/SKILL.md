---
name: create-photo-flipbook-ui
description: Turn supplied photographs, image folders, contact sheets, finished page images, or visual references into a responsive 3D page-turning photo-book website. Use for photo flipbooks, albums, lookbooks, portfolios, editorial photo books, and recreating photographed book layouts. Supports faithful-photo output, optional art-directed spreads, bundled React page-flip integration, and build-only validation.
---

# Create Photo Flipbook UI

Build the smallest complete photo-book app that satisfies the request. Reuse the bundled implementation and preserve supplied photographs.

## Workflow

1. Inventory filenames, pixel dimensions, orientation, and order.
2. View one or two representative photos locally to determine the overall palette, mood, and suitable subtle page texture. Inspect more only when composition or cropping is uncertain.
3. Use faithful mode unless the user explicitly requests collage, zine, scrapbook, restoration, or newly generated artwork.
4. Copy the bundled React files into the app and adapt only the page manifest, image paths, text, and CSS theme tokens.
5. Run the bundled contract test, the application's existing tests, and the production build.
6. Report the build result and start command. Publish only when requested.

## Dependency policy

Dependency provisioning belongs to the project or evaluation harness, not this skill.

- Reuse the existing package manager, lockfile, and installed dependencies.
- If dependencies are missing, run exactly one install: use the lockfile when present (for example, `npm ci --no-audit --no-fund`), otherwise use the existing package manager once to create it.
- Do not inspect, copy, clean, or repair global npm/pnpm caches.
- Do not switch package managers, change versions to match a cache, edit a lockfile manually, install packages one at a time, or run retry loops.
- If the single install fails because of network, cache, permission, or platform restrictions, stop dependency work and report the blocker. Do not claim that the build passed.

The evaluation harness should provide a dependency-ready workspace when it requires a successful offline build.

## Faithful mode

- Keep supplied images unchanged and in deterministic filename order.
- Treat the first image as the front cover unless the user says otherwise.
- Use original files rather than screenshots.
- Record each image's `width` and `height` in the page manifest.
- If every image has the same pixel dimensions, use that aspect ratio for the book and render images edge to edge with `fill`.
- If dimensions differ or are unavailable, keep the default 500×680 book, center images with `contain`, and leave the template's small four-sided padding.
- Preserve the source aspect ratio when sizing the book; normalize only its on-screen scale. Avoid cropping unless requested.
- Override `fit` or `padding` on individual pages only when their composition needs it.
- Derive the page surface from the representative photos. Set restrained theme colors and a subtle CSS paper, fiber, grain, or print texture using the bundled surface tokens.
- Use one color and texture consistently for every interior page. Only the front and back covers may use different surface colors; do not create per-page themes.
- Keep content in the typed page manifest so images, captions, and text remain extensible.

Copy all files from `assets/react/`. Do not rewrite the interaction engine, remove its contract test, or change these renderer invariants:

- Keep only the first and last leaves `hard`; keep interior leaves `soft`.
- Keep `.photo-leaf.stf__item { position: absolute; }`; never add `position: relative` to `.photo-leaf`.
- Apply visual transforms to `.photo-book-rig`, not `.photo-book`.
- Lock controls while the renderer state is not `read`.
- Constrain the rig by both viewport width and viewport height.

Run the copied `flipbook-contract.test.mjs` unchanged. Fix the implementation when it fails.

## Art-directed mode

Read [references/prompt-recipes.md](references/prompt-recipes.md) only when generating artwork.

- Generate one portrait cover and complete landscape spreads.
- Generate independent spreads concurrently when safe.
- Split spreads only with `scripts/split_spreads.sh`.
- Verify the resulting page order and crops from the generated contact sheet.

## Validation boundary

Validation is build-only:

- Check page order and source-file preservation programmatically.
- Run the contract test and existing application tests once.
- Run the production build once; after a code fix, rerun only the failed check and the final build.
- Do not load a browser skill, start dev or preview servers, use curl as UI validation, capture screenshots, or perform manual browser inspection.
- Do not add source-string tests merely to assert that props or CSS text exist beyond the bundled renderer contract test.

A passing build does not certify runtime animation. State that limitation briefly instead of attempting browser QA.

## UI requirements

- Desktop spread and mobile single-page layouts.
- Mouse, touch, buttons, and keyboard page turns.
- Page shading, book shadow, paper texture, and reduced-motion support.
- Accessible page labels, controls, and live page status.
- No heavy toolbar or fake browser chrome.

When `.openai/hosting.json` exists, follow the Sites skills after the production build, but only if publishing is in scope.

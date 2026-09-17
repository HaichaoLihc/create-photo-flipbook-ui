# 3D Book 2

A reusable vanilla Three.js book template with a light stage and its own copy
of the sample Death Valley assets in `public`. The page mesh and deformation engine
comes from [`quick_flipbook`](https://github.com/bandinopla/quick_flipbook).

The reader uses a straight-on orthographic camera, dynamically fits the complete
open spread, and supplies clean, mipmapped paper materials with soft dynamic
shadows and bend-aware lighting, without the engine's decorative AO surface
treatment.

```bash
npm ci
npm run dev
```

The root URL is a plain, scrollable project page with an introduction, embedded
demo, workflow, example prompt, and answers to common questions. It uses system
fonts and static HTML; its content and navigation work without JavaScript.
The 3D reader is available at `/demo.html` and requires JavaScript and WebGL.

## Languages

The landing page is available in English at `/` and Simplified Chinese at `/zh/`.
Both are complete static HTML pages, so the translated content and language links
also work without JavaScript. The Chinese reader at `/zh/demo.html` translates
controls and screen-reader announcements; the sample book artwork is unchanged.

On the main URL, a small script checks the browser's ordered language preferences
and chooses the first supported language (English or Chinese), falling back to
English. All Chinese locale variants currently use the Simplified Chinese page.
The header's language switch remembers a manual choice in local storage. Explicit
`?lang=en` / `?lang=zh` links take priority and work even when storage is blocked.
A direct visit to `/zh/` stays Chinese. Switching preserves the current section.
Automatic detection requires JavaScript; only manual choices are stored.

To preview the production build with the GitHub Pages subpath:

```bash
npm run build -- --base /create-photo-flipbook-ui/
npm run preview
```

Open `http://127.0.0.1:4173/create-photo-flipbook-ui/`.

## Search metadata

Both landing pages include translated static copy, their own canonical URL,
Open Graph and Twitter sharing metadata, and WebPage / SoftwareSourceCode
structured data. Reciprocal `hreflang` links identify the English and Simplified
Chinese versions, following [Google's localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).
The social preview reuses the repository's existing Death Valley screenshot.
`public/sitemap.xml` lists both landing pages and both full-screen demos.
All four HTML entry points are built by Vite and published by the existing
GitHub Pages workflow.

After deployment, verify the URL-prefix property
`https://haichaolihc.github.io/create-photo-flipbook-ui/` in Google Search Console,
submit `sitemap.xml`, and request indexing of the landing page. Any verification
tag or file must come from the project owner's Search Console account.

This is a GitHub Pages project site. A `robots.txt` file under the project subpath
would not control crawling; only `https://haichaolihc.github.io/robots.txt` does.
No project-level robots file is needed. Update canonical, social, structured-data,
and sitemap URLs together if the public domain or project path changes.

## Interaction

- Open the Death Valley edition from the library rail.
- Hover a page edge for a subtle lift, drag to scrub its turn, or click, swipe,
  and use the arrow keys.
- Home and End jump to the front and back covers.

## Verification

```bash
npm test
npm run build
```

See [`THIRD_PARTY_NOTICES.md`](./THIRD_PARTY_NOTICES.md) for dependency attribution.

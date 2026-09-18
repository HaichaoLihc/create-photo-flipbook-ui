# Project website

This directory owns the public Create Photo Flipbook UI website: its plain
landing page, English and Simplified Chinese content, language selection,
search metadata, and GitHub Pages build.

The reusable UI templates live separately in [`ui-collections/`](../ui-collections/).
The installable skill lives in [`skills/create-photo-flipbook-ui/`](../skills/create-photo-flipbook-ui/).

## Local development

Run from this directory in a checkout of the repository:

```bash
npm ci
npm run dev
```

To preview the production build with the GitHub Pages subpath:

```bash
npm run build -- --base /create-photo-flipbook-ui/
npm run preview
```

Open `http://127.0.0.1:4173/create-photo-flipbook-ui/`.

## Pages and shared demo

- `index.html`: English landing page.
- `zh/index.html`: Simplified Chinese landing page.
- `demo.html` and `zh/demo.html`: full-screen demo pages, with website-specific metadata and localized controls.
- `styles.css` and `src/site.js`: landing-page styling and language selection.
- `public/`: website favicon, social preview image, and sitemap.

`src/demo.js` imports the reader from `ui-collections/3d-book-2/src/main.js`.
Vite resolves its third-party dependencies from this website's `node_modules`,
so the template does not need a separate install or build to run the website.

Before development or build, `scripts/prepare-demo.mjs` copies the template's
sample book pages into the generated, Git-ignored `public/books/` directory.
The source photos and reader remain in the template; they are not duplicated
in version control. The complete website is bundled into `dist/` and runs
without access to the source repository after deployment.

The original code and media retain their existing licensing terms; see the
[project license](../LICENSE) and [reader dependency notices](../ui-collections/3d-book-2/THIRD_PARTY_NOTICES.md).

## Languages

Both landing pages contain complete static HTML, so their content and language
links work without JavaScript. The demos require JavaScript and WebGL. The
Chinese demo translates controls and screen-reader announcements; the sample
book artwork is unchanged.

On the main URL, a small script checks the browser's ordered language preferences
and chooses the first supported language (English or Chinese), falling back to
English. Chinese locale variants use the Simplified Chinese page. The header's
language switch remembers a manual choice in local storage. Explicit `?lang=en`
and `?lang=zh` links take priority, including when storage is blocked. A direct
visit to `/zh/` stays Chinese. Switching preserves the current section.
Automatic detection requires JavaScript; only manual choices are stored.

## Search metadata and deployment

Both landing pages include their own canonical URL, translated Open Graph and
Twitter metadata, and WebPage / SoftwareSourceCode structured data. Reciprocal
`hreflang` links identify the language versions, following
[Google's localized-page guidance](https://developers.google.com/search/docs/specialty/international/localized-versions).
The social preview reuses the repository's Death Valley screenshot.
`public/sitemap.xml` lists both landing pages and both demos.

The [Pages workflow](../.github/workflows/pages.yml) installs dependencies here,
builds these four HTML entry points, and deploys `website/dist` on pushes to
`main`. The UI template's build output is not deployed as the project website.

After deployment, verify the URL-prefix property
`https://haichaolihc.github.io/create-photo-flipbook-ui/` in Google Search Console,
submit `sitemap.xml`, and request indexing. Any verification tag or file must
come from the project owner's Search Console account.

This is a GitHub Pages project site. Only a `robots.txt` at the domain root
controls crawling; no project-level robots file is needed. Update canonical,
social, structured-data, and sitemap URLs together if the public domain or
project path changes.

## Verification

```bash
npm test
npm run build -- --base /create-photo-flipbook-ui/
```

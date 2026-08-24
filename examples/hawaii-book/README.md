# Folio Interactive Book

A responsive, page-turning Hawaii photo book built with React, vinext, and
`react-pageflip`.

## Prerequisites

- Node.js `>=22.13.0`

## Quick Start

```bash
npm install
npm run dev
npm run build
```

## Project structure

- `app/page.tsx`: flipbook interaction and page rendering
- `app/book-pages.ts`: extendable book content manifest
- `app/globals.css`: visual design, responsive layout, and page-turn styling
- `public/book-pages-hd/`: production page artwork
- `.openai/hosting.json`: Sites project identity

## Useful Commands

- `npm run dev`: start local development
- `npm run build`: verify the vinext build output
- `npm test`: build and verify the rendered page

## Learn More

- [vinext Documentation](https://github.com/cloudflare/vinext)
- [react-pageflip](https://github.com/Nodlik/react-pageflip)

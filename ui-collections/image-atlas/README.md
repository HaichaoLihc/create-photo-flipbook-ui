# Image Atlas · 生命的年轮

A standalone vanilla HTML/CSS/JavaScript example of a spatial photo archive.
Images form concentric rings grouped by year. Drag to explore, scroll or pinch
to travel through depth, choose a year, or search a theme. Select an image to
focus it; use the arrow buttons or left/right keys to browse, and Escape to return.

## Run locally

From this directory:

```sh
python3 -m http.server 4184 --bind 127.0.0.1
```

Open <http://127.0.0.1:4184/>. No installation or build is needed. Use a local
HTTP server because browsers restrict JavaScript modules on `file://` pages.

## Placeholder content

- 459 fictional records across 2020–2024 reproduce a dense archive.
- 24 bundled SVG placeholders provide landscape, portrait, and square formats.
- All displayed dates are synthetic and labelled 示例日期 when an image is focused.
- No personal photos, original photo filenames, source photo index, account IDs,
  deployment configuration, or Git history are included.
- All image assets are local; opening the example makes no third-party requests.

## Customize

Edit `gallery.js` to replace the demo `images` array. Each record has:

| Field | Purpose |
| --- | --- |
| `id` | Unique stable image ID |
| `title`, `tags` | Display label and searchable keywords |
| `src`, `full` | Relative thumbnail and full-size image paths |
| `aspect` | Intrinsic width divided by height |
| `date`, `year` | ISO date and numeric year for the timeline |
| `dateSource` | `demo`, `captured`, or `file`; file dates are labelled |
| `sourceFile` | Optional filename available to keyword search |

Keep `aspect` consistent with the image to preserve its composition. Customize
the title in `index.html`, the layout and palette in `styles.css`, and interaction
settings in `app.js`. The optional `navigate_to_image` WebMCP tool uses the same
search flow when supported by the browser.

Source files are served directly from this directory. The existing personal
photo website is a separate project and is not required to run this example.

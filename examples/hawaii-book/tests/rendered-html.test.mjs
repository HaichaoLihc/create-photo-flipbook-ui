import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/", {
      headers: { accept: "text/html" },
    }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
      IMAGES: {
        input() {
          throw new Error("Image optimization is not expected during SSR");
        },
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

test("server-renders the photo-book shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<title>Hawaii 2026 — Interactive Photo Book<\/title>/i);
  assert.match(html, /class="atelier/);
  assert.match(html, /Interactive Hawaii photo book/);
  assert.match(html, /aria-label="Previous page"/);
  assert.match(html, /aria-label="Next page"/);
  assert.match(html, />12<\/span>/);
  assert.doesNotMatch(html, /codex-preview|Building your site|SkeletonPreview/i);
});

test("keeps content data-driven and ships every referenced page image", async () => {
  const [pageSource, manifestSource] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/book-pages.ts", import.meta.url), "utf8"),
  ]);

  assert.match(pageSource, /bookPages\.map/);
  assert.match(manifestSource, /export type BookPage/);
  assert.match(manifestSource, /title\?: string/);
  assert.match(manifestSource, /body\?: string/);
  assert.match(manifestSource, /caption\?: string/);

  const imagePaths = [...manifestSource.matchAll(/image:\s*"([^"]+)"/g)].map(
    ([, imagePath]) => imagePath,
  );
  assert.equal(imagePaths.length, 11);

  await Promise.all(
    imagePaths.map((imagePath) =>
      access(new URL(`../public${imagePath}`, import.meta.url)),
    ),
  );
});

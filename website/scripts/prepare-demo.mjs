import { cp, rm } from "node:fs/promises";

// Only this generated directory is replaced. The template owns the sample pages.
const source = new URL("../../ui-collections/3d-book-2/public/books/", import.meta.url);
const target = new URL("../public/books/", import.meta.url);
await rm(target, { recursive: true, force: true });
await cp(source, target, { recursive: true });

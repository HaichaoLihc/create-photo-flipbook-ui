import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  publicDir: "public",
  // Resolve shared reader imports against this website's own installed dependencies.
  resolve: {
    dedupe: ["three", "quick_flipbook"],
  },
  build: {
    chunkSizeWarningLimit: 650,
    rollupOptions: {
      input: {
        index: fileURLToPath(new URL("./index.html", import.meta.url)),
        demo: fileURLToPath(new URL("./demo.html", import.meta.url)),
        chinese: fileURLToPath(new URL("./zh/index.html", import.meta.url)),
        chineseDemo: fileURLToPath(new URL("./zh/demo.html", import.meta.url)),
      },
    },
  },
  server: {
    host: "127.0.0.1",
    fs: {
      allow: [
        fileURLToPath(new URL("./", import.meta.url)),
        fileURLToPath(new URL("../ui-collections/3d-book-2/src/", import.meta.url)),
      ],
    },
  },
});

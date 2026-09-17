import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  publicDir: "public",
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
  },
});

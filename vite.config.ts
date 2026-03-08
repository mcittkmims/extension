import { defineConfig } from "vite";

export default defineConfig({
  build: {
    emptyOutDir: false,
    minify: "esbuild",
    reportCompressedSize: false,
    target: "firefox115"
  },
  esbuild: {
    legalComments: "none"
  }
});

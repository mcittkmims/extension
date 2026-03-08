import { copyFile, cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";

const rootDir = dirname(fileURLToPath(import.meta.url));

interface ExtensionBundleConfig {
  entry: string;
  fileName: string;
  name: string;
  copyPublicDir?: boolean;
  emptyOutDir?: boolean;
}

export function createExtensionConfig({
  entry,
  fileName,
  name,
  copyPublicDir = false,
  emptyOutDir = false
}: ExtensionBundleConfig) {
  return defineConfig({
    publicDir: copyPublicDir ? "public" : false,
    plugins: copyPublicDir ? [copyKaTeXAssetsPlugin()] : [],
    build: {
      outDir: "dist",
      emptyOutDir,
      minify: "esbuild",
      reportCompressedSize: false,
      target: "firefox115",
      lib: {
        entry: resolve(rootDir, entry),
        fileName: () => fileName,
        formats: ["iife"],
        name
      },
      rollupOptions: {
        output: {
          extend: true
        }
      }
    },
    esbuild: {
      legalComments: "none"
    }
  });
}

function copyKaTeXAssetsPlugin() {
  return {
    name: "copy-katex-assets",
    async writeBundle() {
      const sourceDir = resolve(rootDir, "node_modules/katex/dist");
      const targetDir = resolve(rootDir, "dist/katex");

      await mkdir(targetDir, { recursive: true });
      await copyFile(
        resolve(sourceDir, "katex.min.css"),
        resolve(targetDir, "katex.min.css")
      );
      await cp(resolve(sourceDir, "fonts"), resolve(targetDir, "fonts"), {
        recursive: true,
        force: true
      });
    }
  };
}

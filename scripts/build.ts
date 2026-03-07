import { copyFile, mkdir, rm } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { build, mergeConfig } from "vite";

import baseConfig from "../vite.config";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const buildRootDir = resolve(rootDir, ".vite-build");
const watch = process.argv.includes("--watch") ? {} : null;

const builds = [
  {
    entry: resolve(rootDir, "src/content/index.ts"),
    fileName: "content.js",
    name: "ClipboardManagerContent"
  },
  {
    entry: resolve(rootDir, "src/background/index.ts"),
    fileName: "background.js",
    name: "ClipboardManagerBackground"
  },
  {
    entry: resolve(rootDir, "src/popup/index.ts"),
    fileName: "popup.js",
    name: "ClipboardManagerPopup"
  }
];

await rm(buildRootDir, { force: true, recursive: true });

function copyEntryPlugin(outputFile: string) {
  return {
    name: `copy-${outputFile}`,
    async writeBundle(options: { dir?: string }) {
      if (!options.dir) {
        return;
      }

      const sourceFile = resolve(options.dir, outputFile);
      const targetFile = resolve(rootDir, outputFile);

      await mkdir(dirname(targetFile), { recursive: true });
      await copyFile(sourceFile, targetFile);
    }
  };
}

for (const { entry, fileName, name } of builds) {
  await build(
    mergeConfig(baseConfig, {
      plugins: [copyEntryPlugin(fileName)],
      build: {
        emptyOutDir: false,
        lib: {
          entry,
          fileName: () => fileName,
          formats: ["iife"],
          name
        },
        outDir: resolve(buildRootDir, name),
        rollupOptions: {
          output: {
            extend: true
          }
        },
        watch
      }
    })
  );
}

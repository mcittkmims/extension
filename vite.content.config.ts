import { createExtensionConfig } from "./vite.config";

export default createExtensionConfig({
  entry: "src/content/index.ts",
  fileName: "content.js",
  name: "ClipboardManagerContent",
  copyPublicDir: true,
  emptyOutDir: true
});

import { createExtensionConfig } from "./vite.config";

export default createExtensionConfig({
  entry: "src/background/index.ts",
  fileName: "background.js",
  name: "ClipboardManagerBackground"
});

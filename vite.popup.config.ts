import { createExtensionConfig } from "./vite.config";

export default createExtensionConfig({
  entry: "src/popup/index.ts",
  fileName: "popup.js",
  name: "ClipboardManagerPopup"
});

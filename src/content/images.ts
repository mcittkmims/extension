import type { OverlayState } from "./types";
import { getById } from "./utils";

export interface ImageController {
  handleFile: (file: File) => void;
  remove: () => void;
  openPicker: () => void;
  getAttachment: () => { base64: string | null; mimeType: string | null };
}

export function createImageController(state: OverlayState): ImageController {
  function handleFile(file: File): void {
    if (!file.type.startsWith("image/")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result;
      if (typeof result !== "string") {
        return;
      }

      state.currentImageBase64 = result.split(",")[1] ?? null;
      state.currentImageMimeType = file.type;
      getById<HTMLImageElement>("ai-preview-img").src = result;
      getById<HTMLDivElement>("ai-image-preview").classList.remove("hidden");
    };
    reader.readAsDataURL(file);
  }

  function remove(): void {
    state.currentImageBase64 = null;
    state.currentImageMimeType = null;
    getById<HTMLDivElement>("ai-image-preview").classList.add("hidden");
  }

  function openPicker(): void {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.addEventListener("change", (event) => {
      const target = event.target;
      if (
        target instanceof HTMLInputElement &&
        target.files &&
        target.files.length > 0
      ) {
        handleFile(target.files[0]);
      }
    });
    fileInput.click();
  }

  return {
    handleFile,
    remove,
    openPicker,
    getAttachment() {
      return {
        base64: state.currentImageBase64,
        mimeType: state.currentImageMimeType
      };
    }
  };
}

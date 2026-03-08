import type { EventBindingsOptions } from "./types";
import { getById } from "../utils";

export function bindImageEvents({
  state,
  images
}: Pick<EventBindingsOptions, "state" | "images">): void {
  const imagePreview = getById<HTMLDivElement>("ai-image-preview");
  const inputArea = getById<HTMLDivElement>("ai-dropzone");

  imagePreview.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.id === "ai-remove-image" || target.closest("#ai-remove-image")) {
      return;
    }
    images.openPicker();
  });

  inputArea.addEventListener("dragover", (event) => {
    event.preventDefault();
    inputArea.classList.add("dragover");
  });
  inputArea.addEventListener("dragleave", (event) => {
    event.preventDefault();
    inputArea.classList.remove("dragover");
  });
  inputArea.addEventListener("drop", (event) => {
    event.preventDefault();
    inputArea.classList.remove("dragover");
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      images.handleFile(files[0]);
    }
  });

  document.addEventListener("paste", (event) => {
    if (!state.isOpen) {
      return;
    }
    const items = event.clipboardData?.items;
    if (!items) {
      return;
    }

    for (const item of Array.from(items)) {
      if (item.type.includes("image")) {
        const file = item.getAsFile();
        if (file) {
          images.handleFile(file);
        }
        break;
      }
    }
  });
}

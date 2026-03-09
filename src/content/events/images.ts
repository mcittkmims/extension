import type { EventBindingsOptions } from "./types";
import { getById } from "../utils";

export function bindImageEvents({
  elements,
  state,
  images
}: Pick<EventBindingsOptions, "elements" | "state" | "images">): void {
  const { chatbox } = elements;
  const imagePreview = getById<HTMLDivElement>("ai-image-preview");
  const inputArea = getById<HTMLDivElement>("ai-dropzone");
  let dragDepth = 0;

  function hasImageFile(dataTransfer: DataTransfer | null): boolean {
    if (!dataTransfer) {
      return false;
    }

    return Array.from(dataTransfer.items || []).some(
      (item) => item.kind === "file" && item.type.startsWith("image/")
    );
  }

  function setDragActive(isActive: boolean): void {
    inputArea.classList.toggle("dragover", isActive);
  }

  function handleDrop(dataTransfer: DataTransfer | null): void {
    if (!dataTransfer) {
      return;
    }

    const file = Array.from(dataTransfer.files).find((entry) =>
      entry.type.startsWith("image/")
    );

    if (file) {
      images.handleFile(file);
    }
  }

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

  chatbox.addEventListener("dragenter", (event) => {
    if (!state.isOpen || !hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepth += 1;
    setDragActive(true);
  });

  chatbox.addEventListener("dragover", (event) => {
    if (!state.isOpen || !hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    setDragActive(true);
  });

  chatbox.addEventListener("dragleave", (event) => {
    if (!state.isOpen || !hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepth = Math.max(0, dragDepth - 1);
    if (dragDepth === 0) {
      setDragActive(false);
    }
  });

  chatbox.addEventListener("drop", (event) => {
    if (!state.isOpen || !hasImageFile(event.dataTransfer)) {
      return;
    }

    event.preventDefault();
    dragDepth = 0;
    setDragActive(false);
    handleDrop(event.dataTransfer);
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

import type { EventBindingsOptions } from "./types";
import type { Position } from "../types";
import { getById } from "../utils";

export function bindDragEvents({
  elements,
  state,
  posKey,
  chat,
  settings,
  layout
}: Pick<
  EventBindingsOptions,
  "elements" | "state" | "posKey" | "chat" | "settings" | "layout"
>): void {
  const { aiButton, chatbox } = elements;
  const resizeCorner = getById<HTMLDivElement>("ai-resize-corner");

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }

    const positionChange = changes[posKey];
    if (positionChange?.newValue && !state.isDragging) {
      const pos = positionChange.newValue as Position;
      layout.normalizeViewportState({ left: pos.left, top: pos.top });
    }
  });

  aiButton.addEventListener("mousedown", (event) => {
    if (event.button !== 0) {
      return;
    }

    state.isDragging = true;
    state.dragMoved = false;
    state.dragStartX = event.clientX;
    state.dragStartY = event.clientY;
    state.btnStartLeft = aiButton.offsetLeft;
    state.btnStartTop = aiButton.offsetTop;
    event.preventDefault();
  });

  resizeCorner.addEventListener("mousedown", (event) => {
    state.isResizing = true;
    const rect = chatbox.getBoundingClientRect();
    state.resizeAnchorX =
      state.resizeCornerHorizontal === "left" ? rect.right : rect.left;
    state.resizeAnchorY =
      state.resizeCornerVertical === "top" ? rect.bottom : rect.top;
    event.preventDefault();
    event.stopPropagation();
  });

  document.addEventListener("mousemove", (event) => {
    if (!state.isDragging) {
      return;
    }

    const dx = event.clientX - state.dragStartX;
    const dy = event.clientY - state.dragStartY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      state.dragMoved = true;
    }
    if (state.dragMoved) {
      document.body.style.userSelect = "none";
      aiButton.style.cursor = "grabbing";
      layout.normalizeViewportState({
        left: state.btnStartLeft + dx,
        top: state.btnStartTop + dy
      });
    }
  });

  document.addEventListener("mousemove", (event) => {
    if (!state.isResizing) {
      return;
    }

    const viewport = layout.getViewportBounds();
    const limits = layout.getChatSizeLimits();
    const minLeft = viewport.left + 4;
    const maxRight = viewport.left + viewport.width - 4;
    const minTop = viewport.top + 4;
    const maxBottom = viewport.top + viewport.height - 4;
    const pointerX = event.clientX;
    const pointerY = event.clientY;
    let newWidth =
      state.resizeCornerHorizontal === "left"
        ? state.resizeAnchorX - pointerX
        : pointerX - state.resizeAnchorX;
    let newHeight =
      state.resizeCornerVertical === "top"
        ? state.resizeAnchorY - pointerY
        : pointerY - state.resizeAnchorY;

    const maxWidthWithinViewport =
      state.resizeCornerHorizontal === "left"
        ? state.resizeAnchorX - minLeft
        : maxRight - state.resizeAnchorX;
    const maxHeightWithinViewport =
      state.resizeCornerVertical === "top"
        ? state.resizeAnchorY - minTop
        : maxBottom - state.resizeAnchorY;
    const maxWidth = Math.max(
      limits.minWidth,
      Math.min(limits.maxWidth, maxWidthWithinViewport)
    );
    const maxHeight = Math.max(
      limits.minHeight,
      Math.min(limits.maxHeight, maxHeightWithinViewport)
    );

    newWidth = Math.max(limits.minWidth, Math.min(maxWidth, newWidth));
    newHeight = Math.max(limits.minHeight, Math.min(maxHeight, newHeight));

    let newLeft =
      state.resizeCornerHorizontal === "left"
        ? state.resizeAnchorX - newWidth
        : state.resizeAnchorX;
    let newTop =
      state.resizeCornerVertical === "top"
        ? state.resizeAnchorY - newHeight
        : state.resizeAnchorY;

    newLeft = Math.max(minLeft, Math.min(maxRight - newWidth, newLeft));
    newTop = Math.max(minTop, Math.min(maxBottom - newHeight, newTop));

    chatbox.style.width = `${newWidth}px`;
    chatbox.style.height = `${newHeight}px`;
    chatbox.style.maxHeight = `${newHeight}px`;
    chatbox.style.left = `${newLeft}px`;
    chatbox.style.top = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!state.isDragging) {
      return;
    }

    state.isDragging = false;
    document.body.style.userSelect = "";
    aiButton.style.cursor = "";
    if (state.dragMoved) {
      void browser.storage.local.set({
        [posKey]: { left: aiButton.offsetLeft, top: aiButton.offsetTop }
      });
      state.dragMoved = false;
      return;
    }

    chat.toggle();
  });

  document.addEventListener("mouseup", () => {
    if (!state.isResizing) {
      return;
    }

    state.isResizing = false;
    void settings.autoSave();
  });
}

import type { OverlayElements, OverlayState, Position } from "./types";
import {
  getById,
  getInputEventValue,
  isEditableTarget,
  queryRequired
} from "./utils";

interface EventBindingsOptions {
  elements: OverlayElements;
  state: OverlayState;
  posKey: string;
  chat: {
    toggle: () => void;
    close: () => void;
    send: () => Promise<void>;
    runQuizScreenshot: () => Promise<void>;
  };
  settings: {
    toggle: () => void;
    autoSave: () => Promise<void>;
    updateProviderModels: (
      provider: string,
      model: string | null,
      settings?: object
    ) => Promise<void>;
  };
  layout: {
    normalizeViewportState: (options?: {
      left?: number;
      top?: number;
      persist?: boolean;
    }) => void;
    getViewportBounds: () => Position & { width: number; height: number };
    getChatSizeLimits: () => {
      minWidth: number;
      maxWidth: number;
      minHeight: number;
      maxHeight: number;
    };
  };
  theme: {
    updateDarkMode: () => void;
  };
  images: {
    handleFile: (file: File) => void;
    remove: () => void;
    openPicker: () => void;
  };
}

export function bindOverlayEvents({
  elements,
  state,
  posKey,
  chat,
  settings,
  layout,
  theme,
  images
}: EventBindingsOptions): void {
  const { aiButton, chatbox } = elements;
  const resizeCorner = getById<HTMLDivElement>("ai-resize-corner");
  const providerSelect = getById<HTMLSelectElement>("ai-provider-select");
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  const apiKeyInput = getById<HTMLInputElement>("ai-sync-key");
  const opencodePasswordInput = getById<HTMLInputElement>(
    "ai-opencode-password"
  );
  const opencodeUrlInput = getById<HTMLInputElement>("ai-opencode-url");
  const opacitySlider = getById<HTMLInputElement>("ai-opacity-slider");
  const buttonOpacitySlider = getById<HTMLInputElement>(
    "ai-btn-opacity-slider"
  );
  const chatboxInput = getById<HTMLTextAreaElement>("ai-chatbox-input");
  const imagePreview = getById<HTMLDivElement>("ai-image-preview");
  const inputArea = getById<HTMLDivElement>("ai-dropzone");

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
      return;
    }

    chat.toggle();
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
    if (!state.isResizing) {
      return;
    }

    const viewport = layout.getViewportBounds();
    const limits = layout.getChatSizeLimits();
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

    newWidth = Math.max(limits.minWidth, Math.min(limits.maxWidth, newWidth));
    newHeight = Math.max(
      limits.minHeight,
      Math.min(limits.maxHeight, newHeight)
    );

    let newLeft =
      state.resizeCornerHorizontal === "left"
        ? state.resizeAnchorX - newWidth
        : state.resizeAnchorX;
    let newTop =
      state.resizeCornerVertical === "top"
        ? state.resizeAnchorY - newHeight
        : state.resizeAnchorY;

    newLeft = Math.max(
      viewport.left + 4,
      Math.min(viewport.left + viewport.width - newWidth - 4, newLeft)
    );
    newTop = Math.max(
      viewport.top + 4,
      Math.min(viewport.top + viewport.height - newHeight - 4, newTop)
    );

    chatbox.style.width = `${newWidth}px`;
    chatbox.style.height = `${newHeight}px`;
    chatbox.style.maxHeight = `${newHeight}px`;
    chatbox.style.left = `${newLeft}px`;
    chatbox.style.top = `${newTop}px`;
  });

  document.addEventListener("mouseup", () => {
    if (!state.isResizing) {
      return;
    }

    state.isResizing = false;
    void settings.autoSave();
  });

  const scheduleViewportNormalize = () => {
    if (state.viewportNormalizeTimer) {
      clearTimeout(state.viewportNormalizeTimer);
    }
    state.viewportNormalizeTimer = window.setTimeout(() => {
      layout.normalizeViewportState({ persist: true });
    }, 120);
  };

  window.addEventListener("resize", scheduleViewportNormalize);
  window.visualViewport?.addEventListener("resize", scheduleViewportNormalize);

  document.addEventListener("keydown", (event) => {
    if (
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.code !== "KeyC"
    ) {
      return;
    }

    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) {
      return;
    }

    event.preventDefault();
    chat.toggle();
  });

  document.addEventListener("keydown", (event) => {
    if (
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.code !== "KeyQ"
    ) {
      return;
    }

    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) {
      return;
    }

    event.preventDefault();
    void chat.runQuizScreenshot();
  });

  queryRequired<HTMLButtonElement>(chatbox, ".ai-close").addEventListener(
    "click",
    chat.close
  );
  getById<HTMLButtonElement>("ai-settings-toggle").addEventListener(
    "click",
    settings.toggle
  );

  providerSelect.addEventListener("change", async () => {
    await settings.updateProviderModels(providerSelect.value, null);
    await settings.autoSave();
  });

  modelSelect.addEventListener("change", () => {
    void settings.autoSave();
  });
  apiKeyInput.addEventListener("blur", () => {
    void settings.autoSave();
  });

  opencodePasswordInput.addEventListener("blur", async () => {
    const nextSettings = {
      opencodeUrl: opencodeUrlInput.value,
      opencodePassword: opencodePasswordInput.value
    };
    state.opencodeModelCache = { key: "", models: [] };
    await settings.autoSave();
    if (providerSelect.value === "opencode") {
      await settings.updateProviderModels(
        "opencode",
        modelSelect.value,
        nextSettings
      );
    }
  });

  opencodeUrlInput.addEventListener("blur", async () => {
    const nextSettings = {
      opencodeUrl: opencodeUrlInput.value,
      opencodePassword: opencodePasswordInput.value
    };
    state.opencodeModelCache = { key: "", models: [] };
    await settings.autoSave();
    if (providerSelect.value === "opencode") {
      await settings.updateProviderModels(
        "opencode",
        modelSelect.value,
        nextSettings
      );
    }
  });

  opacitySlider.addEventListener("input", (event) => {
    getById<HTMLSpanElement>("ai-opacity-value").textContent =
      `${getInputEventValue(event)}%`;
    elements.chatbox.style.opacity = `${parseInt(getInputEventValue(event), 10) / 100}`;
    void settings.autoSave();
  });

  buttonOpacitySlider.addEventListener("input", (event) => {
    getById<HTMLSpanElement>("ai-btn-opacity-value").textContent =
      `${getInputEventValue(event)}%`;
    elements.aiButton.style.opacity = `${parseInt(getInputEventValue(event), 10) / 100}`;
    void settings.autoSave();
  });

  getById<HTMLButtonElement>("ai-chatbox-send").addEventListener(
    "click",
    () => {
      void chat.send();
    }
  );
  getById<HTMLButtonElement>("ai-quiz-screenshot-btn").addEventListener(
    "click",
    () => {
      void chat.runQuizScreenshot();
    }
  );
  chatboxInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void chat.send();
    }
  });
  getById<HTMLButtonElement>("ai-remove-image").addEventListener(
    "click",
    images.remove
  );
  getById<HTMLButtonElement>("ai-attach-image-btn").addEventListener(
    "click",
    images.openPicker
  );

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

  const darkObserver = new MutationObserver(theme.updateDarkMode);
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
  });
  darkObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
  });
}

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
  toggleChatbox: () => void;
  closeChatbox: () => void;
  toggleSettings: () => void;
  autoSave: () => Promise<void>;
  normalizeViewportState: (options?: {
    left?: number;
    top?: number;
    persist?: boolean;
  }) => void;
  updateDarkMode: () => void;
  updateProviderModels: (
    provider: string,
    model: string | null,
    settings?: object
  ) => Promise<void>;
  handleSend: () => Promise<void>;
  handleQuizScreenshot: () => Promise<void>;
  handleImageFile: (file: File) => void;
  removeImage: () => void;
  openImagePicker: () => void;
}

export function bindOverlayEvents({
  elements,
  state,
  posKey,
  toggleChatbox,
  closeChatbox,
  toggleSettings,
  autoSave,
  normalizeViewportState,
  updateDarkMode,
  updateProviderModels,
  handleSend,
  handleQuizScreenshot,
  handleImageFile,
  removeImage,
  openImagePicker
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
      normalizeViewportState({ left: pos.left, top: pos.top });
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
      normalizeViewportState({
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

    toggleChatbox();
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

  document.addEventListener("mouseup", () => {
    if (!state.isResizing) {
      return;
    }

    state.isResizing = false;
    void autoSave();
  });

  const scheduleViewportNormalize = () => {
    if (state.viewportNormalizeTimer) {
      clearTimeout(state.viewportNormalizeTimer);
    }
    state.viewportNormalizeTimer = window.setTimeout(() => {
      normalizeViewportState({ persist: true });
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
    toggleChatbox();
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
    void handleQuizScreenshot();
  });

  queryRequired<HTMLButtonElement>(chatbox, ".ai-close").addEventListener(
    "click",
    closeChatbox
  );
  getById<HTMLButtonElement>("ai-settings-toggle").addEventListener(
    "click",
    toggleSettings
  );

  providerSelect.addEventListener("change", async () => {
    await updateProviderModels(providerSelect.value, null);
    await autoSave();
  });

  modelSelect.addEventListener("change", () => {
    void autoSave();
  });
  apiKeyInput.addEventListener("blur", () => {
    void autoSave();
  });

  opencodePasswordInput.addEventListener("blur", async () => {
    const settings = {
      opencodeUrl: opencodeUrlInput.value,
      opencodePassword: opencodePasswordInput.value
    };
    state.opencodeModelCache = { key: "", models: [] };
    await autoSave();
    if (providerSelect.value === "opencode") {
      await updateProviderModels("opencode", modelSelect.value, settings);
    }
  });

  opencodeUrlInput.addEventListener("blur", async () => {
    const settings = {
      opencodeUrl: opencodeUrlInput.value,
      opencodePassword: opencodePasswordInput.value
    };
    state.opencodeModelCache = { key: "", models: [] };
    await autoSave();
    if (providerSelect.value === "opencode") {
      await updateProviderModels("opencode", modelSelect.value, settings);
    }
  });

  opacitySlider.addEventListener("input", (event) => {
    getById<HTMLSpanElement>("ai-opacity-value").textContent =
      `${getInputEventValue(event)}%`;
    elements.chatbox.style.opacity = `${parseInt(getInputEventValue(event), 10) / 100}`;
    void autoSave();
  });

  buttonOpacitySlider.addEventListener("input", (event) => {
    getById<HTMLSpanElement>("ai-btn-opacity-value").textContent =
      `${getInputEventValue(event)}%`;
    elements.aiButton.style.opacity = `${parseInt(getInputEventValue(event), 10) / 100}`;
    void autoSave();
  });

  getById<HTMLButtonElement>("ai-chatbox-send").addEventListener(
    "click",
    () => {
      void handleSend();
    }
  );
  getById<HTMLButtonElement>("ai-quiz-screenshot-btn").addEventListener(
    "click",
    () => {
      void handleQuizScreenshot();
    }
  );
  chatboxInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  });
  getById<HTMLButtonElement>("ai-remove-image").addEventListener(
    "click",
    removeImage
  );
  getById<HTMLButtonElement>("ai-attach-image-btn").addEventListener(
    "click",
    openImagePicker
  );

  imagePreview.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) {
      return;
    }
    if (target.id === "ai-remove-image" || target.closest("#ai-remove-image")) {
      return;
    }
    openImagePicker();
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
      handleImageFile(files[0]);
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
          handleImageFile(file);
        }
        break;
      }
    }
  });

  const darkObserver = new MutationObserver(updateDarkMode);
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
  });
  darkObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
  });
}

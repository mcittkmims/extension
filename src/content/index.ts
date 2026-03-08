// Quick Notes - Study Helper - Content Script

import { createOverlay } from "./dom";
import { bindOverlayEvents } from "./events";
import { createLayoutController } from "./layout";
import { loadKaTeX, parseMarkdown, renderMath } from "./markdown";
import { sendToAI as sendAIRequest } from "./requests";
import {
  getApiKey,
  normalizeOpenCodeUrl,
  populateModels,
  saveApiKey,
  updateProviderSettingsUI
} from "./settings";
import type {
  CaptureTabResponse,
  OverlayState,
  PendingRequest,
  StoredSettings
} from "./types";
import { getById } from "./utils";

(() => {
  "use strict";

  if (document.getElementById("moodle-ai-assistant-btn")) {
    return;
  }

  const elements = createOverlay();
  const { aiButton, chatbox } = elements;
  const POS_KEY = "ai_btn_pos";
  const pendingAPIRequests = new Map<string, PendingRequest>();
  const state: OverlayState = {
    isOpen: false,
    settingsOpen: false,
    settingsLoaded: false,
    currentImageBase64: null,
    currentImageMimeType: null,
    settingsMinHeight: 354,
    opencodeModelCache: { key: "", models: [] },
    resizeCornerVertical: "top",
    resizeCornerHorizontal: "left",
    resizeAnchorX: 0,
    resizeAnchorY: 0,
    isDragging: false,
    dragMoved: false,
    dragStartX: 0,
    dragStartY: 0,
    btnStartLeft: 0,
    btnStartTop: 0,
    isResizing: false,
    viewportNormalizeTimer: null
  };

  const layout = createLayoutController({
    posKey: POS_KEY,
    elements,
    state,
    onResizeCornerChange(layoutResult) {
      state.resizeCornerVertical = layoutResult.isAbove ? "top" : "bottom";
      state.resizeCornerHorizontal = layoutResult.isButtonLeft
        ? "right"
        : "left";
      const resizeCorner = getById<HTMLDivElement>("ai-resize-corner");
      resizeCorner.style.top =
        resizeCorner.style.bottom =
        resizeCorner.style.left =
        resizeCorner.style.right =
          "";
      resizeCorner.style[state.resizeCornerVertical] = "0";
      resizeCorner.style[state.resizeCornerHorizontal] = "0";
      const radiusMap: Record<string, string> = {
        tl: "8px 0 0 0",
        tr: "0 8px 0 0",
        br: "0 0 8px 0",
        bl: "0 0 0 8px"
      };
      const key =
        state.resizeCornerVertical[0] + state.resizeCornerHorizontal[0];
      resizeCorner.setAttribute("data-corner", key);
      resizeCorner.style.borderRadius = radiusMap[key] || "";
      resizeCorner.style.cursor =
        (state.resizeCornerVertical === "top") ===
        (state.resizeCornerHorizontal === "left")
          ? "nwse-resize"
          : "nesw-resize";
    },
    onAutoSave() {
      void autoSave();
    }
  });

  function updateDarkMode(): void {
    const elementsToCheck: HTMLElement[] = [
      document.documentElement,
      document.body
    ].filter((element): element is HTMLElement => Boolean(element));
    let luminance = 1;
    for (const element of elementsToCheck) {
      const bg = window.getComputedStyle(element).backgroundColor;
      const matches = bg.match(/[\d.]+/g);
      if (!matches || matches.length < 3) {
        continue;
      }

      const [r, g, b] = matches.slice(0, 3).map(Number);
      const alpha = matches[3] != null ? Number(matches[3]) : 1;
      if (alpha === 0) {
        continue;
      }

      luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      break;
    }
    chatbox.classList.toggle("ai-page-dark", luminance < 0.5);
  }

  function getPageSessionKey(): string {
    return `${window.location.origin}${window.location.pathname}${window.location.search}`;
  }

  function toggleChatbox(): void {
    state.isOpen = !state.isOpen;
    chatbox.classList.toggle("open", state.isOpen);
    aiButton.classList.toggle("active", state.isOpen);
    if (state.isOpen) {
      layout.normalizeViewportState({ persist: true });
    }
  }

  function closeChatbox(): void {
    state.isOpen = false;
    chatbox.classList.remove("open");
    aiButton.classList.remove("active");
  }

  function toggleSettings(): void {
    state.settingsOpen = !state.settingsOpen;
    getById<HTMLDivElement>("ai-settings-panel").classList.toggle(
      "visible",
      state.settingsOpen
    );
  }

  function addMessage(text: string, isUser = false): void {
    const messagesContainer = getById<HTMLDivElement>(
      "moodle-ai-chatbox"
    ).querySelector(".ai-messages") as HTMLDivElement;
    const messageDiv = document.createElement("div");
    messageDiv.className = isUser ? "ai-msg ai-msg-user" : "ai-msg ai-msg-bot";
    if (isUser) {
      messageDiv.textContent = text;
    } else {
      messageDiv.appendChild(parseMarkdown(text));
      renderMath(messageDiv);
    }
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function addLoadingIndicator(): void {
    const messagesContainer = chatbox.querySelector(
      ".ai-messages"
    ) as HTMLDivElement;
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg ai-msg-bot ai-loading";
    loadingDiv.id = "ai-loading-indicator";
    loadingDiv.innerHTML =
      '<div class="ai-typing"><span></span><span></span><span></span></div>';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function removeLoadingIndicator(): void {
    document.getElementById("ai-loading-indicator")?.remove();
  }

  function handleImageFile(file: File): void {
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

  function removeImage(): void {
    state.currentImageBase64 = null;
    state.currentImageMimeType = null;
    getById<HTMLDivElement>("ai-image-preview").classList.add("hidden");
  }

  async function sendToAI(
    text: string,
    imageBase64: string | null = null,
    imageMimeType: string | null = null
  ): Promise<string> {
    const settings = await getApiKey();
    return sendAIRequest({
      text,
      imageBase64,
      imageMimeType,
      settings,
      normalizeOpenCodeUrl,
      getPageSessionKey,
      pendingRequests: pendingAPIRequests
    });
  }

  async function handleSend(): Promise<void> {
    const input = getById<HTMLTextAreaElement>("ai-chatbox-input");
    const text = input.value.trim();
    if (!text && !state.currentImageBase64) {
      return;
    }

    if (text) {
      addMessage(text, true);
    }
    if (state.currentImageBase64) {
      addMessage("[Image attached]", true);
    }

    input.value = "";
    addLoadingIndicator();

    try {
      const response = await sendToAI(
        text,
        state.currentImageBase64,
        state.currentImageMimeType
      );
      removeLoadingIndicator();
      addMessage(response, false);
      removeImage();
    } catch (error) {
      removeLoadingIndicator();
      addMessage(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  async function handleQuizScreenshot(): Promise<void> {
    addMessage("📸 Screenshot sent — answering quiz…", true);
    addLoadingIndicator();

    try {
      chatbox.style.display = "none";
      aiButton.style.display = "none";
      await new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
      );

      let captured: CaptureTabResponse;
      try {
        captured = await browser.runtime.sendMessage({ type: "captureTab" });
      } finally {
        chatbox.style.display = "";
        aiButton.style.display = "";
      }

      if (!captured.success || !captured.base64 || !captured.mimeType) {
        throw new Error(captured.error || "Screenshot failed");
      }

      const quizPrompt = `You are a precise quiz-answering assistant. Your only job is to find and answer the question visible in this screenshot.

RULES - follow them exactly, no exceptions:
1. Do NOT describe, summarize, or comment on the screenshot.
2. Scan the screenshot for a question (quiz, test, exercise, form field, etc.).
3. If NO question is found -> respond with exactly: no question found
4. If a MULTIPLE-CHOICE or SINGLE-CHOICE question is found -> respond with ONLY the letter or number of the correct option (e.g. "B" or "3"). No explanation.
5. If any OTHER type of question is found (fill-in, short answer, calculation, etc.) -> respond with the shortest correct answer only. No explanation, no full sentences unless the answer itself is a sentence.

Begin.`;

      const response = await sendToAI(
        quizPrompt,
        captured.base64,
        captured.mimeType
      );
      removeLoadingIndicator();
      addMessage(response, false);
    } catch (error) {
      removeLoadingIndicator();
      addMessage(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  }

  async function updateProviderModels(
    provider: string,
    model: string | null,
    settings?: Partial<StoredSettings>
  ): Promise<void> {
    updateProviderSettingsUI(provider);
    await populateModels(provider, model, settings, state.opencodeModelCache);
  }

  async function loadSettings(): Promise<void> {
    const settings = await getApiKey();
    if (settings.key) {
      getById<HTMLInputElement>("ai-sync-key").value = settings.key;
    }
    getById<HTMLInputElement>("ai-opencode-url").value = normalizeOpenCodeUrl(
      settings.opencodeUrl
    );
    getById<HTMLInputElement>("ai-opencode-password").value =
      settings.opencodePassword;

    const resolvedProvider = settings.provider || "gemini";
    getById<HTMLSelectElement>("ai-provider-select").value = resolvedProvider;
    await updateProviderModels(resolvedProvider, settings.model, {
      opencodeUrl: normalizeOpenCodeUrl(settings.opencodeUrl),
      opencodePassword: settings.opencodePassword
    });

    const pct = Math.round(settings.opacity * 100);
    getById<HTMLInputElement>("ai-opacity-slider").value = String(pct);
    getById<HTMLSpanElement>("ai-opacity-value").textContent = `${pct}%`;
    chatbox.style.opacity = String(settings.opacity);

    const btnPct = Math.round(settings.btnOpacity * 100);
    getById<HTMLInputElement>("ai-btn-opacity-slider").value = String(btnPct);
    getById<HTMLSpanElement>("ai-btn-opacity-value").textContent = `${btnPct}%`;
    aiButton.style.opacity = String(settings.btnOpacity);

    const appliedSize = layout.applyChatSize(
      settings.chatWidth,
      settings.chatHeight
    );
    if (
      appliedSize.width !== settings.chatWidth ||
      appliedSize.height !== settings.chatHeight
    ) {
      await autoSave();
    }
    state.settingsLoaded = true;
  }

  async function autoSave(): Promise<void> {
    const key = getById<HTMLInputElement>("ai-sync-key").value.trim();
    const provider = getById<HTMLSelectElement>("ai-provider-select").value;
    const model = getById<HTMLSelectElement>("ai-model-select").value;
    const opacity =
      parseInt(getById<HTMLInputElement>("ai-opacity-slider").value, 10) / 100;
    const buttonOpacity =
      parseInt(getById<HTMLInputElement>("ai-btn-opacity-slider").value, 10) /
      100;
    await saveApiKey(
      key,
      provider,
      model,
      normalizeOpenCodeUrl(getById<HTMLInputElement>("ai-opencode-url").value),
      getById<HTMLInputElement>("ai-opencode-password").value,
      opacity,
      buttonOpacity,
      chatbox.offsetWidth || 320,
      chatbox.offsetHeight || 480
    );
  }

  function openImagePicker(): void {
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
        handleImageFile(target.files[0]);
      }
    });
    fileInput.click();
  }

  layout.loadBtnPos((initialPosition) => {
    layout.normalizeViewportState({
      left: initialPosition.left,
      top: initialPosition.top,
      persist: true
    });
    aiButton.style.visibility = "";
    updateDarkMode();
  });

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    for (const [key, change] of Object.entries(changes)) {
      if (key === POS_KEY || !change.newValue) {
        continue;
      }

      const pending = pendingAPIRequests.get(key);
      if (!pending) {
        continue;
      }

      pendingAPIRequests.delete(key);
      void browser.storage.local.remove(key);
      const response = change.newValue as {
        success?: boolean;
        text?: string;
        error?: string;
      };
      if (response.success && response.text) {
        pending.resolve(response.text);
      } else {
        pending.reject(new Error(response.error || "Request failed"));
      }
    }
  });

  bindOverlayEvents({
    elements,
    state,
    posKey: POS_KEY,
    toggleChatbox,
    closeChatbox,
    toggleSettings,
    autoSave,
    normalizeViewportState: layout.normalizeViewportState,
    updateDarkMode,
    updateProviderModels,
    handleSend,
    handleQuizScreenshot,
    handleImageFile,
    removeImage,
    openImagePicker
  });

  (function measureSettingsHeight() {
    const panel = getById<HTMLDivElement>("ai-settings-panel");
    const header = chatbox.querySelector(".ai-header") as HTMLElement | null;
    const previous = {
      display: chatbox.style.display,
      visibility: chatbox.style.visibility
    };
    const panelWasVisible = panel.classList.contains("visible");
    chatbox.style.visibility = "hidden";
    chatbox.style.display = "flex";
    panel.classList.add("visible");
    const headerHeight = header?.offsetHeight ?? 41;
    const measured = headerHeight + panel.offsetHeight + 16;
    if (measured > 100) {
      state.settingsMinHeight = measured;
    }
    chatbox.style.display = previous.display;
    chatbox.style.visibility = previous.visibility;
    if (!panelWasVisible) {
      panel.classList.remove("visible");
    }
  })();

  updateDarkMode();
  void loadSettings();
  void loadKaTeX();
})();

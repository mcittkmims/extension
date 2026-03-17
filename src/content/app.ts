import { createChatController } from "./chat";
import { createOverlay } from "./dom";
import { bindOverlayEvents } from "./events";
import { createImageController } from "./images";
import { createLayoutController } from "./layout";
import { loadKaTeX } from "./markdown";
import { createMessageController } from "./messages";
import { createQuizController } from "./quiz";
import { sendToAI as sendAIRequest } from "./requests";
import {
  getDefaultButtonPosition,
  setupContentRuntime,
  setupPendingRequestRuntime
} from "./runtime";
import { createOverlayState } from "./state";
import {
  createSettingsController,
  getApiKey,
  getSelectedProviderInfo,
  updateComposerMetaUI
} from "./settings";
import { createOverlayController } from "./overlay";
import { createThemeController } from "./theme";
import type { PendingRequest } from "./types";

const POSITION_STORAGE_KEY = "ai_btn_pos";
const CHAT_HISTORY_STORAGE_KEY = "aiGlobalChatHistory";
const SESSION_SCOPE_KEY = "global";

export async function startContentApp(): Promise<void> {
  const elements = createOverlay();
  const { aiButton, chatbox } = elements;
  const messages = createMessageController(chatbox, CHAT_HISTORY_STORAGE_KEY);
  const theme = createThemeController(chatbox);
  const pendingRequests = new Map<string, PendingRequest>();
  const state = createOverlayState();

  const image = createImageController(state);

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
      getPageSessionKey: () => SESSION_SCOPE_KEY,
      pendingRequests
    });
  }

  async function beforeSend() {
    updateComposerMetaUI();
    return getSelectedProviderInfo();
  }

  async function resetConversation(): Promise<void> {
    pendingRequests.forEach((pending, requestId) => {
      pending.reject(new Error("Conversation reset."));
      pendingRequests.delete(requestId);
    });

    await Promise.all([
      messages.clear(),
      browser.runtime.sendMessage({
        type: "restartOpenCodeSession",
        pageKey: SESSION_SCOPE_KEY
      })
    ]);
  }

  const settingsController = createSettingsController({
    elements,
    state
  });
  // settingsController created
  // expose helpers on window so runtime can call them reliably
  try {
    (window as any).__aiAdjustChatOpacity = settingsController.adjustChatOpacity;
    (window as any).__aiAdjustBtnOpacity = settingsController.adjustBtnOpacity;
  } catch (e) {}
  const overlay = createOverlayController({
    aiButton,
    chatbox,
    state
  });

  // Initialize chat open state from storage so it's synced across tabs
  try {
    const st = await browser.storage.local.get("aiChatOpen");
    const shouldOpen = Boolean(st.aiChatOpen);
    if (typeof overlay.setOpen === "function") {
      overlay.setOpen(shouldOpen);
    }
  } catch (e) {
    // ignore
  }

  const layout = createLayoutController({
    posKey: POSITION_STORAGE_KEY,
    elements,
    state,
    onResizeCornerChange: overlay.updateResizeCorner,
    onAutoSave() {
      void settingsController.autoSave();
    }
  });
  settingsController.attachLayout(layout);
  overlay.attachLayout(layout);
  const chatController = createChatController({
    messages,
    image,
    beforeSend,
    sendToAI,
    resetConversation
  });

  const quiz = createQuizController({
    elements,
    messages,
    beforeSend,
    sendToAI,
    captureTab: () => browser.runtime.sendMessage({ type: "captureTab" })
  });

  layout.loadBtnPos((initialPosition) => {
    layout.normalizeViewportState({
      left: initialPosition.left,
      top: initialPosition.top,
      persist: true
    });
    aiButton.style.visibility = "";
    theme.updateDarkMode();
  });

  setupPendingRequestRuntime({
    posKey: POSITION_STORAGE_KEY,
    pendingRequests
  });
  setupContentRuntime({
    onResetPosition() {
      const position = getDefaultButtonPosition(layout.getViewportBounds);
      layout.normalizeViewportState({
        left: position.left,
        top: position.top,
        persist: true
      });
    },
    onQuizScreenshot: quiz.runScreenshotQuiz
  });

  bindOverlayEvents({
    elements,
    state,
    posKey: POSITION_STORAGE_KEY,
    chat: {
      toggle: overlay.toggleChatbox,
      close: overlay.closeChatbox,
      send: chatController.send,
      reset: chatController.reset,
      runQuizScreenshot: quiz.runScreenshotQuiz
    },
    settings: {
      toggle: overlay.toggleSettings,
      autoSave: settingsController.autoSave,
      updateProviderModels: settingsController.updateProviderModels,
      adjustChatOpacity: settingsController.adjustChatOpacity,
      adjustBtnOpacity: settingsController.adjustBtnOpacity
    },
    layout: {
      normalizeViewportState: layout.normalizeViewportState,
      getViewportBounds: layout.getViewportBounds,
      getChatSizeLimits: layout.getChatSizeLimits
    },
    theme: {
      updateDarkMode: theme.updateDarkMode
    },
    images: {
      handleFile: image.handleFile,
      remove: image.remove,
      openPicker: image.openPicker
    }
  });

  settingsController.measurePanelHeight();
  theme.updateDarkMode();
  await messages.loadHistory();
  await Promise.all([settingsController.load(), loadKaTeX()]);

  // Sync chat size from storage when the tab becomes active/visible
  async function syncChatSizeFromStorage(): Promise<void> {
    try {
      const result = await browser.storage.local.get(["chatWidth", "chatHeight"]);
      const w = typeof result.chatWidth === "number" ? result.chatWidth : null;
      const h = typeof result.chatHeight === "number" ? result.chatHeight : null;
      if (typeof w === "number" && typeof h === "number") {
        layout.applyChatSize(w, h);
        layout.normalizeViewportState();
      }
    } catch (e) {
      // ignore
    }
  }

  // Sync opacity (chat + button) from storage when tab becomes active or when other tabs change it
  async function syncOpacityFromStorage(): Promise<void> {
    try {
      const result = await browser.storage.local.get(["chatOpacity", "btnOpacity"]);
      const chatOp = typeof result.chatOpacity === "number" ? result.chatOpacity : null;
      const btnOp = typeof result.btnOpacity === "number" ? result.btnOpacity : null;
      if (typeof chatOp === "number") {
        chatbox.style.opacity = String(chatOp);
        const slider = document.getElementById("ai-opacity-slider") as HTMLInputElement | null;
        const value = document.getElementById("ai-opacity-value") as HTMLElement | null;
        if (slider) slider.value = String(Math.round(chatOp * 100));
        if (value) value.textContent = `${Math.round(chatOp * 100)}%`;
      }
      if (typeof btnOp === "number") {
        aiButton.style.opacity = String(btnOp);
        const btnSlider = document.getElementById("ai-btn-opacity-slider") as HTMLInputElement | null;
        const btnValue = document.getElementById("ai-btn-opacity-value") as HTMLElement | null;
        if (btnSlider) btnSlider.value = String(Math.round(btnOp * 100));
        if (btnValue) btnValue.textContent = `${Math.round(btnOp * 100)}%`;
      }
    } catch (e) {
      // ignore
    }
  }

  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (Object.prototype.hasOwnProperty.call(changes, "chatOpacity") || Object.prototype.hasOwnProperty.call(changes, "btnOpacity")) {
      void syncOpacityFromStorage();
    }
  });

  window.addEventListener("focus", () => {
    void syncChatSizeFromStorage();
    void messages.loadHistory();
  });
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) void syncChatSizeFromStorage();
  });
  window.addEventListener("pageshow", () => {
    void syncChatSizeFromStorage();
    void messages.loadHistory();
  });
}

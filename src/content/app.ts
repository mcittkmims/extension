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
  normalizeOpenCodeUrl
} from "./settings";
import { createOverlayController } from "./overlay";
import { createThemeController } from "./theme";
import type { PendingRequest } from "./types";

const POSITION_STORAGE_KEY = "ai_btn_pos";

function getPageSessionKey(): string {
  return `${window.location.origin}${window.location.pathname}${window.location.search}`;
}

export async function startContentApp(): Promise<void> {
  const elements = createOverlay();
  const { aiButton, chatbox } = elements;
  const messages = createMessageController(chatbox);
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
      normalizeOpenCodeUrl,
      getPageSessionKey,
      pendingRequests
    });
  }

  const settings = createSettingsController({
    elements,
    state
  });
  const overlay = createOverlayController({
    aiButton,
    chatbox,
    state
  });

  const layout = createLayoutController({
    posKey: POSITION_STORAGE_KEY,
    elements,
    state,
    onResizeCornerChange: overlay.updateResizeCorner,
    onAutoSave() {
      void settings.autoSave();
    }
  });
  settings.attachLayout(layout);
  overlay.attachLayout(layout);
  const chatController = createChatController({
    messages,
    image,
    sendToAI
  });

  const quiz = createQuizController({
    elements,
    messages,
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
      runQuizScreenshot: quiz.runScreenshotQuiz
    },
    settings: {
      toggle: overlay.toggleSettings,
      autoSave: settings.autoSave,
      updateProviderModels: settings.updateProviderModels
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

  settings.measurePanelHeight();
  theme.updateDarkMode();
  await Promise.all([settings.load(), loadKaTeX()]);
}

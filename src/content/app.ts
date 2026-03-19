import { createChatController } from "./chat";
import { createOverlay } from "./dom";
import { bindOverlayEvents } from "./events";
import { createImageController } from "./images";
import { createLayoutController } from "./layout";
import { loadKaTeX } from "./markdown";
import { createMessageController } from "./messages";
import { createQuizAutofillController } from "./quiz-autofill-controller";
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
import type { ContextMessage } from "./messages";

const POSITION_STORAGE_KEY = "ai_btn_pos";
const CHAT_HISTORY_STORAGE_KEY = "aiGlobalChatHistory";
const CHAT_OPEN_STORAGE_KEY = "ai_chat_open";
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
    imageMimeType: string | null = null,
    contextMessages: ContextMessage[] = []
  ): Promise<string> {
    const settings = await getApiKey();
    return sendAIRequest({
      text,
      imageBase64,
      imageMimeType,
      settings,
      contextMessages,
      getPageSessionKey: () => SESSION_SCOPE_KEY,
      pendingRequests
    });
  }

  async function beforeSend() {
    const settings = await getApiKey();
    const contextMessages = messages.getContextMessages();
    if (!settings.keepContext) {
      await messages.clear();
    }
    updateComposerMetaUI();
    return {
      ...getSelectedProviderInfo(),
      contextMessages
    };
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
  const quizAutofill = createQuizAutofillController({
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
      toggle: () => {
        overlay.toggleChatbox();
        persistChatOpen(state.isOpen);
      },
      close: () => {
        overlay.closeChatbox();
        persistChatOpen(false);
      },
      send: chatController.send,
      reset: chatController.reset,
      runQuizScreenshot: quiz.runScreenshotQuiz,
      runQuizAutofill: quizAutofill.runQuizAutofill
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

  function persistChatOpen(isOpen: boolean): void {
    void browser.storage.local.set({ [CHAT_OPEN_STORAGE_KEY]: isOpen });
  }

  function onChatOpenStorageChanged(
    changes: Record<string, browser.storage.StorageChange>,
    areaName: string
  ): void {
    if (areaName !== "local" || !(CHAT_OPEN_STORAGE_KEY in changes)) {
      return;
    }

    const newValue = changes[CHAT_OPEN_STORAGE_KEY].newValue;
    if (typeof newValue === "boolean" && newValue !== state.isOpen) {
      overlay.toggleChatbox();
    }
  }

  settings.measurePanelHeight();
  theme.updateDarkMode();
  await messages.loadHistory();
  await Promise.all([settings.load(), loadKaTeX()]);

  const chatOpenResult = (await browser.storage.local.get(
    CHAT_OPEN_STORAGE_KEY
  )) as Record<string, unknown>;
  if (chatOpenResult[CHAT_OPEN_STORAGE_KEY] === true) {
    overlay.toggleChatbox();
  }

  browser.storage.onChanged.addListener(onChatOpenStorageChanged);
}

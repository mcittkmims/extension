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
import { createThemeController } from "./theme";
import type { PendingRequest } from "./types";
import { getById } from "./utils";

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

  const settings = createSettingsController({
    elements,
    state,
    layout: {
      applyChatSize(width: number, height: number) {
        return layout.applyChatSize(width, height);
      }
    }
  });

  const layout = createLayoutController({
    posKey: POSITION_STORAGE_KEY,
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
      void settings.autoSave();
    }
  });

  const quiz = createQuizController({
    elements,
    messages,
    sendToAI,
    captureTab: () => browser.runtime.sendMessage({ type: "captureTab" })
  });

  async function handleSend(): Promise<void> {
    const input = getById<HTMLTextAreaElement>("ai-chatbox-input");
    const text = input.value.trim();
    const attachment = image.getAttachment();
    if (!text && !attachment.base64) {
      return;
    }

    if (text) {
      messages.addUserMessage(text);
    }
    if (attachment.base64) {
      messages.addUserMessage("[Image attached]");
    }

    input.value = "";
    messages.showLoading();

    try {
      const response = await sendToAI(
        text,
        attachment.base64,
        attachment.mimeType
      );
      messages.hideLoading();
      messages.addBotMessage(response);
      image.remove();
    } catch (error) {
      messages.hideLoading();
      messages.showError(error);
    }
  }

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
      toggle: toggleChatbox,
      close: closeChatbox,
      send: handleSend,
      runQuizScreenshot: quiz.runScreenshotQuiz
    },
    settings: {
      toggle: toggleSettings,
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

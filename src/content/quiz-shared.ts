import type { CaptureTabResponse, OverlayElements } from "./types";
import type { MessageController } from "./messages";

export interface QuizProviderContext {
  providerLabel: string;
  modelLabel: string;
  badgeLabel: string;
  signature: string;
  contextMessages: Array<{
    role: "user" | "assistant";
    text: string;
  }>;
}

export interface QuizControllerOptions {
  elements: OverlayElements;
  messages: MessageController;
  beforeSend: () => Promise<QuizProviderContext>;
  sendToAI: (
    text: string,
    imageBase64?: string | null,
    imageMimeType?: string | null,
    contextMessages?: Array<{
      role: "user" | "assistant";
      text: string;
    }>
  ) => Promise<string>;
  captureTab: () => Promise<CaptureTabResponse>;
}

interface QuizRunSetup {
  userMessage: string;
  buildPrompt: () =>
    | Promise<{
        prompt: string;
        onResponse?: (response: string) => void | Promise<void>;
      }>
    | {
        prompt: string;
        onResponse?: (response: string) => void | Promise<void>;
      };
}

export async function runQuizRequest(
  {
    elements,
    messages,
    beforeSend,
    sendToAI,
    captureTab
  }: QuizControllerOptions,
  { userMessage, buildPrompt }: QuizRunSetup
): Promise<void> {
  const { aiButton, chatbox } = elements;
  const context = await beforeSend();
  messages.ensureProviderContext(context);
  messages.addUserMessage(userMessage);
  messages.showLoading();

  try {
    const { prompt, onResponse } = await buildPrompt();

    chatbox.style.display = "none";
    aiButton.style.display = "none";
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
    );

    let captured: CaptureTabResponse;
    try {
      captured = await captureTab();
    } finally {
      chatbox.style.display = "";
      aiButton.style.display = "";
    }

    if (!captured.success || !captured.base64 || !captured.mimeType) {
      throw new Error(captured.error || "Screenshot failed");
    }

    const response = await sendToAI(
      prompt,
      captured.base64,
      captured.mimeType,
      context.contextMessages
    );
    await onResponse?.(response);

    messages.hideLoading();
    messages.addBotMessage(response, {
      providerLabel: context.providerLabel,
      modelLabel: context.badgeLabel
    });
  } catch (error) {
    messages.hideLoading();
    messages.showError(error);
  }
}

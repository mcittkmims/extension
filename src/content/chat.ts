import type { ImageController } from "./images";
import type { MessageController } from "./messages";
import { getById } from "./utils";

interface ChatControllerOptions {
  messages: MessageController;
  image: ImageController;
  beforeSend: () => Promise<{
    providerLabel: string;
    modelLabel: string;
    badgeLabel: string;
    signature: string;
  }>;
  sendToAI: (
    text: string,
    imageBase64?: string | null,
    imageMimeType?: string | null
  ) => Promise<string>;
  resetConversation: () => Promise<void>;
}

export function createChatController({
  messages,
  image,
  beforeSend,
  sendToAI,
  resetConversation
}: ChatControllerOptions) {
  return {
    async send(): Promise<void> {
      const input = getById<HTMLTextAreaElement>("ai-chatbox-input");
      const text = input.value.trim();
      const attachment = image.getAttachment();

      if (text === "/reset" && !attachment.base64) {
        input.value = "";
        await resetConversation();
        return;
      }

      if (!text && !attachment.base64) {
        return;
      }

      const context = await beforeSend();
      messages.ensureProviderContext(context);

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
        messages.addBotMessage(response, {
          providerLabel: context.providerLabel,
          modelLabel: context.badgeLabel
        });
        image.remove();
      } catch (error) {
        messages.hideLoading();
        messages.showError(error);
      }
    },
    async reset(): Promise<void> {
      const input = getById<HTMLTextAreaElement>("ai-chatbox-input");
      input.value = "";
      image.remove();
      await resetConversation();
    }
  };
}

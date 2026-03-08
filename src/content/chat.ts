import type { ImageController } from "./images";
import type { MessageController } from "./messages";
import { getById } from "./utils";

interface ChatControllerOptions {
  messages: MessageController;
  image: ImageController;
  sendToAI: (
    text: string,
    imageBase64?: string | null,
    imageMimeType?: string | null
  ) => Promise<string>;
}

export function createChatController({
  messages,
  image,
  sendToAI
}: ChatControllerOptions) {
  return {
    async send(): Promise<void> {
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
  };
}

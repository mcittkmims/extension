import { parseMarkdown, renderMath } from "./markdown";
import { queryRequired } from "./utils";

export interface MessageController {
  addUserMessage: (text: string) => void;
  addBotMessage: (text: string) => void;
  showLoading: () => void;
  hideLoading: () => void;
  showError: (error: unknown) => void;
}

export function createMessageController(
  chatbox: HTMLDivElement
): MessageController {
  const messagesContainer = queryRequired<HTMLDivElement>(
    chatbox,
    ".ai-messages"
  );

  function appendMessage(text: string, isUser: boolean): void {
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

  function showLoading(): void {
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg ai-msg-bot ai-loading";
    loadingDiv.id = "ai-loading-indicator";
    loadingDiv.innerHTML =
      '<div class="ai-typing"><span></span><span></span><span></span></div>';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideLoading(): void {
    document.getElementById("ai-loading-indicator")?.remove();
  }

  return {
    addUserMessage(text) {
      appendMessage(text, true);
    },
    addBotMessage(text) {
      appendMessage(text, false);
    },
    showLoading,
    hideLoading,
    showError(error) {
      appendMessage(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    }
  };
}

import { parseMarkdown, renderMath } from "./markdown";
import { queryRequired } from "./utils";

interface StoredChatMessage {
  type: "message";
  role: "user" | "bot";
  text: string;
  providerLabel?: string;
  modelLabel?: string;
}

interface StoredChatDivider {
  type: "divider";
  text: string;
  signature: string;
}

type StoredChatEntry = StoredChatMessage | StoredChatDivider;

interface BotMessageMeta {
  providerLabel: string;
  modelLabel: string;
}

interface ProviderContextMeta extends BotMessageMeta {
  signature: string;
}

export interface MessageController {
  loadHistory: () => Promise<void>;
  ensureProviderContext: (context: ProviderContextMeta) => void;
  addUserMessage: (text: string) => void;
  addBotMessage: (text: string, meta?: BotMessageMeta) => void;
  showLoading: () => void;
  hideLoading: () => void;
  showError: (error: unknown) => void;
  clear: () => Promise<void>;
}

export function createMessageController(
  chatbox: HTMLDivElement,
  storageKey: string
): MessageController {
  const messagesContainer = queryRequired<HTMLDivElement>(
    chatbox,
    ".ai-messages"
  );
  let history: StoredChatEntry[] = [];
  let activeSignature = "";
  let isLoading = false;

  function entriesEqual(a: StoredChatEntry, b: StoredChatEntry): boolean {
    if (a.type !== b.type) {
      return false;
    }

    if (a.type === "divider" && b.type === "divider") {
      return a.text === b.text && a.signature === b.signature;
    }

    const messageA = a as StoredChatMessage;
    const messageB = b as StoredChatMessage;

    return (
      messageA.role === messageB.role &&
      messageA.text === messageB.text &&
      messageA.providerLabel === messageB.providerLabel &&
      messageA.modelLabel === messageB.modelLabel
    );
  }

  function syncActiveSignature(): void {
    const lastDivider = [...history]
      .reverse()
      .find((entry) => entry.type === "divider");
    activeSignature =
      lastDivider?.type === "divider" ? lastDivider.signature : "";
  }

  function appendHistoryEntry(entry: StoredChatEntry): void {
    if (entry.type === "divider") {
      appendDivider(entry.text, entry.signature, false);
      return;
    }

    appendMessage(entry.text, entry.role === "user", false, {
      providerLabel: entry.providerLabel || "",
      modelLabel: entry.modelLabel || ""
    });
  }

  function renderHistory(): void {
    messagesContainer.innerHTML = "";
    history.forEach(appendHistoryEntry);
    syncActiveSignature();

    if (isLoading) {
      showLoading();
    }
  }

  function applyHistory(nextHistory: StoredChatEntry[]): void {
    const sameLength = nextHistory.length === history.length;
    const sharedLength = Math.min(nextHistory.length, history.length);
    let prefixMatches = true;

    for (let index = 0; index < sharedLength; index += 1) {
      if (!entriesEqual(history[index], nextHistory[index])) {
        prefixMatches = false;
        break;
      }
    }

    if (sameLength && prefixMatches) {
      return;
    }

    if (prefixMatches && nextHistory.length > history.length) {
      history = nextHistory;
      nextHistory.slice(sharedLength).forEach(appendHistoryEntry);
      syncActiveSignature();
      return;
    }

    history = nextHistory;
    renderHistory();
  }

  function persistHistory(): void {
    void browser.storage.local.set({ [storageKey]: history });
  }

  function appendDivider(
    text: string,
    signature: string,
    persist = true
  ): void {
    const divider = document.createElement("div");
    divider.className = "ai-divider";
    divider.textContent = text;
    messagesContainer.appendChild(divider);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    activeSignature = signature;
    if (persist) {
      history.push({ type: "divider", text, signature });
      persistHistory();
    }
  }

  function appendMessage(
    text: string,
    isUser: boolean,
    persist = true,
    meta?: BotMessageMeta
  ): void {
    const messageDiv = document.createElement("div");
    messageDiv.className = isUser ? "ai-msg ai-msg-user" : "ai-msg ai-msg-bot";
    if (isUser) {
      messageDiv.textContent = text;
    } else {
      if (meta?.providerLabel) {
        const badge = document.createElement("div");
        badge.className = "ai-msg-badge";
        badge.textContent = meta.modelLabel
          ? `${meta.providerLabel} - ${meta.modelLabel}`
          : meta.providerLabel;
        messageDiv.appendChild(badge);
      }
      messageDiv.appendChild(parseMarkdown(text));
      renderMath(messageDiv);
    }

    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    if (persist) {
      history.push({
        type: "message",
        role: isUser ? "user" : "bot",
        text,
        providerLabel: meta?.providerLabel,
        modelLabel: meta?.modelLabel
      });
      persistHistory();
    }
  }

  function showLoading(): void {
    hideLoading();
    isLoading = true;
    const loadingDiv = document.createElement("div");
    loadingDiv.className = "ai-msg ai-msg-bot ai-loading";
    loadingDiv.id = "ai-loading-indicator";
    loadingDiv.innerHTML =
      '<div class="ai-typing"><span></span><span></span><span></span></div>';
    messagesContainer.appendChild(loadingDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  }

  function hideLoading(): void {
    isLoading = false;
    document.getElementById("ai-loading-indicator")?.remove();
  }

  async function loadHistory(): Promise<void> {
    const result = (await browser.storage.local.get(storageKey)) as Record<
      string,
      unknown
    >;
    const stored = result[storageKey];
    if (!Array.isArray(stored)) {
      applyHistory([]);
      return;
    }

    const nextHistory = stored.reduce<StoredChatEntry[]>((entries, entry) => {
      if (!entry || typeof entry !== "object" || !("type" in entry)) {
        return entries;
      }

      if (entry.type === "divider") {
        const text = entry.text;
        const signature = entry.signature;
        if (typeof text !== "string" || typeof signature !== "string") {
          return entries;
        }

        entries.push({ type: "divider", text, signature });
        return entries;
      }

      if (
        entry.type !== "message" ||
        !("role" in entry) ||
        !("text" in entry)
      ) {
        return entries;
      }

      const role = entry.role;
      const text = entry.text;
      if ((role !== "user" && role !== "bot") || typeof text !== "string") {
        return entries;
      }

      const providerLabel =
        typeof entry.providerLabel === "string"
          ? entry.providerLabel
          : undefined;
      const modelLabel =
        typeof entry.modelLabel === "string" ? entry.modelLabel : undefined;

      entries.push({
        type: "message",
        role,
        text,
        providerLabel,
        modelLabel
      });
      return entries;
    }, []);

    applyHistory(nextHistory);
  }

  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local" || !(storageKey in changes)) {
      return;
    }

    void loadHistory();
  });

  return {
    loadHistory,
    ensureProviderContext(context) {
      if (activeSignature === context.signature) {
        return;
      }

      const prefix = history.length === 0 ? "Using" : "Switched to";
      appendDivider(
        `${prefix} ${context.providerLabel} - ${context.modelLabel}`,
        context.signature
      );
    },
    addUserMessage(text) {
      appendMessage(text, true);
    },
    addBotMessage(text, meta) {
      appendMessage(text, false, true, meta);
    },
    showLoading,
    hideLoading,
    showError(error) {
      appendMessage(
        `Error: ${error instanceof Error ? error.message : String(error)}`,
        false
      );
    },
    async clear() {
      history = [];
      activeSignature = "";
      hideLoading();
      renderHistory();
      await browser.storage.local.remove(storageKey);
    }
  };
}

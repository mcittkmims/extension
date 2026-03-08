import type { PendingRequest, Position } from "./types";

interface StorageResponse {
  success?: boolean;
  text?: string;
  error?: string;
}

interface RuntimeMessage {
  type?: string;
}

interface PendingRequestRuntimeOptions {
  posKey: string;
  pendingRequests: Map<string, PendingRequest>;
}

interface ContentRuntimeOptions {
  onResetPosition: () => void;
  onQuizScreenshot: () => Promise<void>;
}

export function setupPendingRequestRuntime({
  posKey,
  pendingRequests
}: PendingRequestRuntimeOptions): void {
  browser.storage.onChanged.addListener((changes, areaName) => {
    if (areaName !== "local") {
      return;
    }

    for (const [key, change] of Object.entries(changes)) {
      if (key === posKey || !change.newValue) {
        continue;
      }

      const pending = pendingRequests.get(key);
      if (!pending) {
        continue;
      }

      pendingRequests.delete(key);
      void browser.storage.local.remove(key);
      const response = change.newValue as StorageResponse;
      if (response.success && response.text) {
        pending.resolve(response.text);
      } else {
        pending.reject(new Error(response.error || "Request failed"));
      }
    }
  });
}

export function setupContentRuntime({
  onResetPosition,
  onQuizScreenshot
}: ContentRuntimeOptions): void {
  browser.runtime.onMessage.addListener((message: RuntimeMessage) => {
    if (message.type === "resetPosition") {
      onResetPosition();
      return Promise.resolve({ success: true });
    }

    if (message.type === "quizScreenshot") {
      void onQuizScreenshot();
      return Promise.resolve({ success: true });
    }

    return false;
  });
}

export function getDefaultButtonPosition(
  getViewportBounds: () => Position & { width: number; height: number }
): Position {
  const viewport = getViewportBounds();
  return {
    left: viewport.left + viewport.width - 38,
    top: viewport.top + viewport.height - 38
  };
}

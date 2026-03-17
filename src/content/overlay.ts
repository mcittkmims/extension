import type { LayoutResult } from "./types";
import { getById } from "./utils";

const RESIZE_CORNER_RADIUS: Record<string, string> = {
  tl: "8px 0 0 0",
  tr: "0 8px 0 0",
  br: "0 0 8px 0",
  bl: "0 0 0 8px"
};

interface OverlayControllerOptions {
  aiButton: HTMLButtonElement;
  chatbox: HTMLDivElement;
  state: {
    isOpen: boolean;
    settingsOpen: boolean;
    resizeCornerVertical: "top" | "bottom";
    resizeCornerHorizontal: "left" | "right";
  };
}

export function createOverlayController({
  aiButton,
  chatbox,
  state
}: OverlayControllerOptions) {
  let normalizeViewportState:
    | ((options?: { persist?: boolean }) => void)
    | null = null;
  // Listen for cross-tab changes to the chat open state
  try {
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (!Object.prototype.hasOwnProperty.call(changes, "aiChatOpen")) return;
      const newVal = Boolean(changes.aiChatOpen.newValue);
      if (newVal === state.isOpen) return;
      state.isOpen = newVal;
      chatbox.classList.toggle("open", state.isOpen);
      aiButton.classList.toggle("active", state.isOpen);
      if (state.isOpen && normalizeViewportState) {
        normalizeViewportState({ persist: true });
      }
    });
  } catch {
    // best-effort: storage.onChanged may not be available in some test contexts
  }

  return {
    attachLayout(controller: {
      normalizeViewportState: (options?: { persist?: boolean }) => void;
    }): void {
      normalizeViewportState = controller.normalizeViewportState;
    },

    toggleChatbox(): void {
      state.isOpen = !state.isOpen;
      chatbox.classList.toggle("open", state.isOpen);
      aiButton.classList.toggle("active", state.isOpen);
      if (state.isOpen && normalizeViewportState) {
        normalizeViewportState({ persist: true });
      }
      try {
        void browser.storage.local.set({ aiChatOpen: state.isOpen });
      } catch {
        // ignore
      }
    },

    closeChatbox(): void {
      state.isOpen = false;
      chatbox.classList.remove("open");
      aiButton.classList.remove("active");
      try {
        void browser.storage.local.set({ aiChatOpen: false });
      } catch {
        // ignore
      }
    },

    setOpen(open: boolean): void {
      state.isOpen = Boolean(open);
      chatbox.classList.toggle("open", state.isOpen);
      aiButton.classList.toggle("active", state.isOpen);
      if (state.isOpen && normalizeViewportState) {
        normalizeViewportState({ persist: true });
      }
      try {
        void browser.storage.local.set({ aiChatOpen: state.isOpen });
      } catch {
        // ignore
      }
    },

    toggleSettings(): void {
      state.settingsOpen = !state.settingsOpen;
      getById<HTMLDivElement>("ai-settings-panel").classList.toggle(
        "visible",
        state.settingsOpen
      );
    },

    updateResizeCorner(layoutResult: LayoutResult): void {
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

      const key =
        state.resizeCornerVertical[0] + state.resizeCornerHorizontal[0];
      resizeCorner.setAttribute("data-corner", key);
      resizeCorner.style.borderRadius = RESIZE_CORNER_RADIUS[key] || "";
      resizeCorner.style.cursor =
        (state.resizeCornerVertical === "top") ===
        (state.resizeCornerHorizontal === "left")
          ? "nwse-resize"
          : "nesw-resize";
    }
  };
}

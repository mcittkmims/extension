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
    },

    closeChatbox(): void {
      state.isOpen = false;
      chatbox.classList.remove("open");
      aiButton.classList.remove("active");
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

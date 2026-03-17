import type { EventBindingsOptions } from "./types";
import { isEditableTarget } from "../utils";
import { loadShortcuts, matchEvent } from "../shortcuts";

export function bindRuntimeEvents({
  elements,
  state,
  chat,
  layout,
  theme,
  settings
}: Pick<
  EventBindingsOptions,
  "elements" | "state" | "chat" | "layout" | "theme" | "settings"
>): void {
  const { chatbox } = elements;

  try {
  } catch (e) {}

  // load shortcuts and keep in-memory copy
  let SHORTCUTS: Record<string, any> = {};
  void loadShortcuts().then((m) => (SHORTCUTS = m));
  browser.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") return;
    if (Object.prototype.hasOwnProperty.call(changes, "shortcuts")) {
      void loadShortcuts().then((m) => (SHORTCUTS = m));
    }
  });

  const scheduleViewportNormalize = () => {
    if (state.viewportNormalizeTimer) {
      clearTimeout(state.viewportNormalizeTimer);
    }
    state.viewportNormalizeTimer = window.setTimeout(() => {
      layout.normalizeViewportState({ persist: true });
    }, 120);
  };

  window.addEventListener("resize", scheduleViewportNormalize);
  window.addEventListener("scroll", scheduleViewportNormalize, {
    passive: true
  });
  window.visualViewport?.addEventListener("resize", scheduleViewportNormalize);
  window.visualViewport?.addEventListener("scroll", scheduleViewportNormalize, {
    passive: true
  });

  document.addEventListener("keydown", (event) => {
    // ignore while capturing a shortcut in settings
    if ((window as any).__SHORTCUT_CAPTURE_ACTIVE) return;
    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) return;

    // (debug logs removed)

    // toggle chat
    const tog = SHORTCUTS["toggleChat"] || null;
    if (tog && matchEvent(event, tog)) {
      event.preventDefault();
      chat.toggle();
      return;
    }

    // quiz screenshot
    const quiz = SHORTCUTS["runQuizScreenshot"] || null;
    if (quiz && matchEvent(event, quiz)) {
      event.preventDefault();
      void chat.runQuizScreenshot();
      return;
    }

    // increase / decrease opacity
    const inc = SHORTCUTS["increaseOpacity"] || null;
    const dec = SHORTCUTS["decreaseOpacity"] || null;
      if (inc && matchEvent(event, inc)) {
      event.preventDefault();
      if (settings && typeof settings.adjustChatOpacity === "function") {
        settings.adjustChatOpacity(5);
      } else if (typeof (window as any).__aiAdjustChatOpacity === "function") {
        (window as any).__aiAdjustChatOpacity(5);
      } else {
        // DOM fallback: update slider and dispatch input event
        try {
          const slider = document.getElementById("ai-opacity-slider") as HTMLInputElement | null;
          if (slider) {
            const cur = parseInt(slider.value, 10) || 95;
            let next = cur + 5;
            if (next > 100) next = 100;
            if (next < 5) next = 5;
            slider.value = String(next);
            slider.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            // last resort: set chatbox style directly
            const chatboxEl = chatbox as HTMLElement | null;
            if (chatboxEl) {
              const curOp = parseFloat(chatboxEl.style.opacity || "0.95") || 0.95;
              let nextOp = Math.min(1, curOp + 0.05);
              chatboxEl.style.opacity = String(nextOp);
            }
          }
        } catch (e) {
          // best-effort
        }
      }
      return;
    }
    if (dec && matchEvent(event, dec)) {
      event.preventDefault();
      if (settings && typeof settings.adjustChatOpacity === "function") {
        settings.adjustChatOpacity(-5);
      } else if (typeof (window as any).__aiAdjustChatOpacity === "function") {
        (window as any).__aiAdjustChatOpacity(-5);
      } else {
        // DOM fallback: update slider and dispatch input event
        try {
          const slider = document.getElementById("ai-opacity-slider") as HTMLInputElement | null;
          if (slider) {
            const cur = parseInt(slider.value, 10) || 95;
            let next = cur - 5;
            if (next > 100) next = 100;
            if (next < 5) next = 5;
            slider.value = String(next);
            slider.dispatchEvent(new Event("input", { bubbles: true }));
          } else {
            const chatboxEl = chatbox as HTMLElement | null;
            if (chatboxEl) {
              const curOp = parseFloat(chatboxEl.style.opacity || "0.95") || 0.95;
              let nextOp = Math.max(0.05, curOp - 0.05);
              chatboxEl.style.opacity = String(nextOp);
            }
          }
        } catch (e) {
          // best-effort
        }
      }
      return;
    }

    // open TikTok
    const ot = SHORTCUTS["openTikTok"] || null;
    if (ot && matchEvent(event, ot)) {
      event.preventDefault();
      try {
        void browser.runtime.sendMessage({ type: "openTikTok" });
      } catch (e) {
        // best-effort
      }
      return;
    }
  });

  const darkObserver = new MutationObserver(theme.updateDarkMode);
  darkObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
  });
  darkObserver.observe(document.body, {
    attributes: true,
    attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
  });
}

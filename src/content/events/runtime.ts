import type { EventBindingsOptions } from "./types";
import { isEditableTarget } from "../utils";

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
    if (
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.code !== "KeyC"
    ) {
      return;
    }

    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) {
      return;
    }

    event.preventDefault();
    chat.toggle();
  });

  document.addEventListener("keydown", (event) => {
    if (
      !event.altKey ||
      event.ctrlKey ||
      event.metaKey ||
      event.code !== "KeyQ"
    ) {
      return;
    }

    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) {
      return;
    }

    event.preventDefault();
    void chat.runQuizScreenshot();
  });

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }

    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) {
      return;
    }

    const adjust = (deltaPct: number) => {
      const computed = window.getComputedStyle(chatbox).opacity;
      const current = Math.round((parseFloat(computed) || 0) * 100);
      let next = current + deltaPct;
      if (next > 100) next = 100;
      if (next < 5) next = 5;
      chatbox.style.opacity = String(next / 100);
      const slider = document.getElementById("ai-opacity-slider") as HTMLInputElement | null;
      const value = document.getElementById("ai-opacity-value") as HTMLElement | null;
      if (slider) slider.value = String(next);
      if (value) value.textContent = `${next}%`;
      if (settings && typeof settings.autoSave === "function") {
        void settings.autoSave();
      }
    };

    if (event.code === "KeyJ") {
      event.preventDefault();
      adjust(5);
    } else if (event.code === "KeyK") {
      event.preventDefault();
      adjust(-5);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (!event.altKey || event.ctrlKey || event.metaKey || event.code !== "Delete") {
      return;
    }

    const active = document.activeElement;
    if (!chatbox.contains(active) && isEditableTarget(active)) {
      return;
    }

    event.preventDefault();
    try {
      void browser.runtime.sendMessage({ type: "openTikTok" });
    } catch (e) {
      // best-effort
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

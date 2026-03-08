import type { EventBindingsOptions } from "./types";
import { isEditableTarget } from "../utils";

export function bindRuntimeEvents({
  elements,
  state,
  chat,
  layout,
  theme
}: Pick<
  EventBindingsOptions,
  "elements" | "state" | "chat" | "layout" | "theme"
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

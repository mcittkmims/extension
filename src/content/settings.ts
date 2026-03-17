import {
  OPENCODE_DEFAULT_URL,
  PROVIDER_MODELS,
  getProviderLabel
} from "./constants";
import type { LayoutController } from "./layout";
import type {
  OverlayElements,
  OverlayState,
  ModelCache,
  ModelOption,
  OpenCodeConfig,
  OpenCodeModelsResponse,
  StoredSettings
} from "./types";
import { getById } from "./utils";
import { normalizeOpenCodeUrl } from "../shared/opencode";
import { loadShortcuts, formatShortcut, saveShortcut, saveShortcuts, DEFAULT_SHORTCUTS } from "./shortcuts";
import type { ShortcutDef } from "./shortcuts";

export { normalizeOpenCodeUrl } from "../shared/opencode";

export interface SelectedProviderInfo {
  provider: string;
  providerLabel: string;
  model: string | null;
  modelLabel: string;
  badgeLabel: string;
  signature: string;
}

function shortenModelLabel(label: string): string {
  const trimmed = label
    .replace(/\s*\((latest|stable)\)\s*/gi, "")
    .replace(/\s*Preview\s*/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  if (trimmed.length <= 24) {
    return trimmed;
  }

  const slashIndex = trimmed.lastIndexOf("/");
  if (slashIndex >= 0 && slashIndex < trimmed.length - 1) {
    return trimmed.slice(slashIndex + 1);
  }

  return `${trimmed.slice(0, 21).trimEnd()}...`;
}

function getSelectedModelLabel(): string {
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  const selectedOption = modelSelect.selectedOptions[0];
  return selectedOption?.textContent?.trim() || "Default model";
}

export function getSelectedProviderInfo(): SelectedProviderInfo {
  const provider = getById<HTMLSelectElement>("ai-provider-select").value;
  const model = getById<HTMLSelectElement>("ai-model-select").value || null;
  const providerLabel = getProviderLabel(provider);
  const modelLabel = getSelectedModelLabel();

  return {
    provider,
    providerLabel,
    model,
    modelLabel,
    badgeLabel: shortenModelLabel(modelLabel),
    signature: `${provider}::${model || ""}`
  };
}

export function updateComposerMetaUI(): void {
  const info = getSelectedProviderInfo();
  const chip = getById<HTMLSpanElement>("ai-provider-chip");
  const status = getById<HTMLSpanElement>("ai-provider-status");
  const input = getById<HTMLTextAreaElement>("ai-chatbox-input");

  chip.textContent = info.providerLabel;
  input.placeholder = `Message ${info.providerLabel} or paste image`;
  status.textContent = info.modelLabel;
}

export function setModelOptions(
  models: ModelOption[],
  savedModel: string | null
) {
  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  modelSelect.innerHTML = "";
  models.forEach((m) => {
    const opt = document.createElement("option");
    opt.value = m.value;
    opt.textContent = m.label;
    modelSelect.appendChild(opt);
  });
  if (savedModel && models.some((m) => m.value === savedModel)) {
    modelSelect.value = savedModel;
  } else if (models.length > 0) {
    modelSelect.value = models[0].value;
  }

  updateComposerMetaUI();
}

export function updateProviderSettingsUI(provider: string): void {
  const isOpenCode = provider === "opencode";
  getById<HTMLDivElement>("ai-api-key-group").classList.toggle(
    "hidden",
    isOpenCode
  );
  getById<HTMLDivElement>("ai-opencode-group").classList.toggle(
    "hidden",
    !isOpenCode
  );
}

export async function fetchOpenCodeModels(
  opencodeConfig: OpenCodeConfig
): Promise<OpenCodeModelsResponse> {
  const response = (await browser.runtime.sendMessage({
    type: "getOpenCodeModels",
    opencodeConfig
  })) as OpenCodeModelsResponse;

  if (!response || !response.success) {
    throw new Error(response?.error || "Failed to load models");
  }

  return response;
}

export async function populateModels(
  provider: string,
  savedModel: string | null,
  settings: Partial<StoredSettings> | undefined,
  modelCache: ModelCache
): Promise<void> {
  if (provider !== "opencode") {
    setModelOptions(PROVIDER_MODELS[provider] || [], savedModel);
    return;
  }

  const modelSelect = getById<HTMLSelectElement>("ai-model-select");
  const status = getById<HTMLSpanElement>("ai-opencode-status");
  modelSelect.innerHTML = "";
  const loading = document.createElement("option");
  loading.value = "";
  loading.textContent = "Loading models...";
  modelSelect.appendChild(loading);

  const conf = settings || (await getApiKey());
  const opencodeConfig = {
    baseUrl: normalizeOpenCodeUrl(conf.opencodeUrl),
    password: conf.opencodePassword || ""
  };
  const cacheKey = `${opencodeConfig.baseUrl}::${opencodeConfig.password}`;

  try {
    let serverModels: ModelOption[] = [];
    let defaultModel = "";

    if (modelCache.key === cacheKey && modelCache.models.length > 0) {
      serverModels = modelCache.models;
    } else {
      const data = await fetchOpenCodeModels(opencodeConfig);
      serverModels = Array.isArray(data.models) ? data.models : [];
      defaultModel = data.defaultModel || "";
      modelCache.key = cacheKey;
      modelCache.models = serverModels;
    }

    const merged = [{ value: "", label: "Server default model" }].concat(
      serverModels
    );
    setModelOptions(merged, savedModel || defaultModel || "");
    status.textContent = `Connected to ${opencodeConfig.baseUrl}`;
  } catch (error) {
    setModelOptions([{ value: "", label: "Server default model" }], "");
    status.textContent = `Model fetch failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export async function getApiKey(): Promise<StoredSettings> {
  const result = await browser.storage.local.get([
    "geminiApiKey",
    "apiProvider",
    "apiModel",
    "opencodeServerUrl",
    "opencodePassword",
    "chatOpacity",
    "btnOpacity",
    "chatWidth",
    "chatHeight"
  ]);

  return {
    key: (result.geminiApiKey as string | undefined) || null,
    provider: (result.apiProvider as string | undefined) || "aistudio",
    model: (result.apiModel as string | undefined) || null,
    opencodeUrl:
      (result.opencodeServerUrl as string | undefined) || OPENCODE_DEFAULT_URL,
    opencodePassword: (result.opencodePassword as string | undefined) || "",
    opacity: typeof result.chatOpacity === "number" ? result.chatOpacity : 0.95,
    btnOpacity:
      typeof result.btnOpacity === "number" ? result.btnOpacity : 0.25,
    chatWidth: typeof result.chatWidth === "number" ? result.chatWidth : 320,
    chatHeight: typeof result.chatHeight === "number" ? result.chatHeight : 480
  };
}

export async function saveApiKey(
  key: string,
  provider: string,
  model: string,
  opencodeUrl: string,
  opencodePassword: string,
  opacity: number,
  btnOp: number,
  chatWidth: number,
  chatHeight: number
): Promise<void> {
  await browser.storage.local.set({
    geminiApiKey: key,
    apiProvider: provider,
    apiModel: model,
    opencodeServerUrl: normalizeOpenCodeUrl(opencodeUrl),
    opencodePassword: opencodePassword || "",
    chatOpacity: opacity,
    btnOpacity: btnOp,
    chatWidth,
    chatHeight
  });
}

interface SettingsControllerOptions {
  elements: OverlayElements;
  state: OverlayState;
}

export function createSettingsController({
  elements,
  state
}: SettingsControllerOptions) {
  const { aiButton, chatbox } = elements;
  let layoutController: Pick<LayoutController, "applyChatSize"> | null = null;
  let announcer: HTMLElement | null = null;

  async function updateProviderModels(
    provider: string,
    model: string | null,
    settings?: Partial<StoredSettings>
  ): Promise<void> {
    updateProviderSettingsUI(provider);
    await populateModels(provider, model, settings, state.opencodeModelCache);
  }

  async function autoSave(): Promise<void> {
    const key = getById<HTMLInputElement>("ai-sync-key").value.trim();
    const provider = getById<HTMLSelectElement>("ai-provider-select").value;
    const model = getById<HTMLSelectElement>("ai-model-select").value;
    const opacity =
      parseInt(getById<HTMLInputElement>("ai-opacity-slider").value, 10) / 100;
    const buttonOpacity =
      parseInt(getById<HTMLInputElement>("ai-btn-opacity-slider").value, 10) /
      100;
    await saveApiKey(
      key,
      provider,
      model,
      normalizeOpenCodeUrl(getById<HTMLInputElement>("ai-opencode-url").value),
      getById<HTMLInputElement>("ai-opencode-password").value,
      opacity,
      buttonOpacity,
      chatbox.offsetWidth || 320,
      chatbox.offsetHeight || 480
    );
    updateComposerMetaUI();
  }

  async function load(): Promise<void> {
    if (!layoutController) {
      throw new Error("Settings layout controller has not been attached.");
    }

    const settings = await getApiKey();
    if (settings.key) {
      getById<HTMLInputElement>("ai-sync-key").value = settings.key;
    }
    getById<HTMLInputElement>("ai-opencode-url").value = normalizeOpenCodeUrl(
      settings.opencodeUrl
    );
    getById<HTMLInputElement>("ai-opencode-password").value =
      settings.opencodePassword;

    const resolvedProvider = settings.provider || "aistudio";
    getById<HTMLSelectElement>("ai-provider-select").value = resolvedProvider;
    await updateProviderModels(resolvedProvider, settings.model, {
      opencodeUrl: normalizeOpenCodeUrl(settings.opencodeUrl),
      opencodePassword: settings.opencodePassword
    });

    const pct = Math.round(settings.opacity * 100);
    getById<HTMLInputElement>("ai-opacity-slider").value = String(pct);
    getById<HTMLSpanElement>("ai-opacity-value").textContent = `${pct}%`;
    chatbox.style.opacity = String(settings.opacity);

    const btnPct = Math.round(settings.btnOpacity * 100);
    getById<HTMLInputElement>("ai-btn-opacity-slider").value = String(btnPct);
    getById<HTMLSpanElement>("ai-btn-opacity-value").textContent = `${btnPct}%`;
    aiButton.style.opacity = String(settings.btnOpacity);

    const appliedSize = layoutController.applyChatSize(
      settings.chatWidth,
      settings.chatHeight
    );
    if (
      appliedSize.width !== settings.chatWidth ||
      appliedSize.height !== settings.chatHeight
    ) {
      await autoSave();
    }
    updateComposerMetaUI();
    state.settingsLoaded = true;
    // load shortcuts into UI
    try {
      const SHORTS = await loadShortcuts();
      const map: Record<string, string> = {
        toggleChat: "ai-shortcut-toggleChat",
        increaseOpacity: "ai-shortcut-increaseOpacity",
        decreaseOpacity: "ai-shortcut-decreaseOpacity",
        openTikTok: "ai-shortcut-openTikTok",
        runQuizScreenshot: "ai-shortcut-runQuizScreenshot"
      };
      for (const k of Object.keys(map)) {
        const el = getById<HTMLInputElement>(map[k]);
        const def = SHORTS[k] as ShortcutDef | undefined || null;
        el.value = formatShortcut(def);
        installShortcutCapture(el, k);
      }
      // reset button
      const resetBtn = document.getElementById("ai-shortcuts-reset") as HTMLButtonElement | null;
      announcer = document.getElementById("ai-shortcut-announce") as HTMLElement | null;
      if (resetBtn) {
        resetBtn.addEventListener("click", async () => {
          await saveShortcuts(DEFAULT_SHORTCUTS as Record<string, ShortcutDef>);
          // update inputs
          const updated = await loadShortcuts();
          for (const k of Object.keys(map)) {
            const el = getById<HTMLInputElement>(map[k]);
            el.value = formatShortcut(updated[k] as ShortcutDef | undefined || null);
          }
          if (announcer) announcer.textContent = "Shortcuts reset to defaults.";
          const hintEl = document.querySelector(".shortcuts-hint small") as HTMLElement | null;
          if (hintEl) hintEl.textContent = "Shortcuts reset to defaults.";
          setTimeout(() => {
            if (announcer) announcer.textContent = "";
            if (hintEl) hintEl.textContent = "Click a field and press the desired key combination. Conflicts will be shown.";
          }, 2500);
        });
      }
    } catch (e) {
      // ignore
    }
  }

  function installShortcutCapture(input: HTMLInputElement, actionKey: string) {
    let listener: (ev: KeyboardEvent) => void;
    let interimMods = { alt: false, ctrl: false, shift: false, meta: false };
    const hintEl = document.querySelector(".shortcuts-hint small") as HTMLElement | null;

    input.addEventListener("focus", () => {
      // mark capture active so runtime ignores shortcuts
      (window as any).__SHORTCUT_CAPTURE_ACTIVE = true;
      input.value = "...press keys";
      interimMods = { alt: false, ctrl: false, shift: false, meta: false };

      listener = (ev: KeyboardEvent) => {
        ev.preventDefault();
        // cancel on Escape
        if (ev.key === "Escape") {
          input.value = formatShortcut(null);
          input.blur();
          window.removeEventListener("keydown", listener, true);
          return;
        }

        // update interim modifiers if only modifiers are pressed
        const isModifier = /^(Shift|Control|Alt|Meta)/.test(ev.code);
        if (isModifier) {
          interimMods = {
            alt: !!ev.altKey,
            ctrl: !!ev.ctrlKey,
            shift: !!ev.shiftKey,
            meta: !!ev.metaKey
          };
          const preview: ShortcutDef = {
            code: ev.code.replace(/(Left|Right)$/i, ""),
            altKey: interimMods.alt,
            ctrlKey: interimMods.ctrl,
            shiftKey: interimMods.shift,
            metaKey: interimMods.meta
          };
          input.value = formatShortcut(preview);
          return; // wait for non-modifier
        }

        // non-modifier key pressed -> capture full combo
        const def: ShortcutDef = {
          code: ev.code,
          altKey: !!ev.altKey,
          ctrlKey: !!ev.ctrlKey,
          shiftKey: !!ev.shiftKey,
          metaKey: !!ev.metaKey
        };

        // check conflicts using helper
        void loadShortcuts().then((cur) => {
          import("./shortcuts").then((mod) => {
            const friendly: Record<string, string> = {
              toggleChat: "Toggle Chat",
              increaseOpacity: "Increase Opacity",
              decreaseOpacity: "Decrease Opacity",
              openTikTok: "Open TikTok",
              runQuizScreenshot: "Quiz Screenshot"
            };
            const other = mod.findConflict(cur, def, actionKey);
            if (other) {
              const conflictLabel = friendly[other] || other;
              if (hintEl) hintEl.textContent = `Conflict with '${conflictLabel}'. Choose another combo.`;
              if (announcer) announcer.textContent = `Shortcut conflicts with ${conflictLabel}.`;
              input.value = formatShortcut(def) + " (conflict)";
              setTimeout(() => {
                if (announcer) announcer.textContent = "";
              }, 2500);
              // clear capture flag and stop
              try { (window as any).__SHORTCUT_CAPTURE_ACTIVE = false; } catch (e) {}
              return;
            }
            // save and show
            void saveShortcut(actionKey, def).then(() => {
              input.value = formatShortcut(def);
              if (hintEl) hintEl.textContent = "";
              if (announcer) announcer.textContent = `Shortcut saved for ${friendly[actionKey] || actionKey}.`;
              setTimeout(() => {
                if (announcer) announcer.textContent = "";
              }, 1500);
            });
          });
        }).finally(() => {
          input.blur();
          try {
            window.removeEventListener("keydown", listener, true);
          } catch (e) {
            // ignore
          }
        });
      };
      window.addEventListener("keydown", listener, true);
    });

    input.addEventListener("blur", () => {
      // clear capture active flag
      try {
        (window as any).__SHORTCUT_CAPTURE_ACTIVE = false;
      } catch (e) {
        // ignore
      }
      try {
        window.removeEventListener("keydown", listener, true);
      } catch (e) {
        // ignore
      }
    });
  }

  function measurePanelHeight(): void {
    const panel = getById<HTMLDivElement>("ai-settings-panel");
    const header = chatbox.querySelector(".ai-header") as HTMLElement | null;
    const previous = {
      display: chatbox.style.display,
      visibility: chatbox.style.visibility
    };
    const panelWasVisible = panel.classList.contains("visible");
    chatbox.style.visibility = "hidden";
    chatbox.style.display = "flex";
    panel.classList.add("visible");
    const headerHeight = header?.offsetHeight ?? 41;
    const measured = headerHeight + panel.offsetHeight + 16;
    if (measured > 100) {
      state.settingsMinHeight = measured;
    }
    chatbox.style.display = previous.display;
    chatbox.style.visibility = previous.visibility;
    if (!panelWasVisible) {
      panel.classList.remove("visible");
    }
  }
  function adjustChatOpacity(deltaPct: number): void {
    try {
      // eslint-disable-next-line no-console
      // adjustChatOpacity called
    } catch (e) {}
    const slider = getById<HTMLInputElement>("ai-opacity-slider");
    const valueEl = getById<HTMLSpanElement>("ai-opacity-value");
    const current = parseInt(slider.value, 10) || Math.round((parseFloat(chatbox.style.opacity) || 0.95) * 100);
    let next = current + deltaPct;
    if (next > 100) next = 100;
    if (next < 5) next = 5;
    slider.value = String(next);
    valueEl.textContent = `${next}%`;
    chatbox.style.opacity = String(next / 100);
    void autoSave();
  }

  function adjustBtnOpacity(deltaPct: number): void {
    try {
      // eslint-disable-next-line no-console
      // adjustBtnOpacity called
    } catch (e) {}
    const slider = getById<HTMLInputElement>("ai-btn-opacity-slider");
    const valueEl = getById<HTMLSpanElement>("ai-btn-opacity-value");
    const current = parseInt(slider.value, 10) || Math.round((parseFloat(aiButton.style.opacity) || 0.25) * 100);
    let next = current + deltaPct;
    if (next > 100) next = 100;
    if (next < 5) next = 5;
    slider.value = String(next);
    valueEl.textContent = `${next}%`;
    aiButton.style.opacity = String(next / 100);
    void autoSave();
  }

  return {
    attachLayout(layout: Pick<LayoutController, "applyChatSize">) {
      layoutController = layout;
    },
    updateProviderModels,
    load,
    autoSave,
    adjustChatOpacity,
    adjustBtnOpacity,
    measurePanelHeight
  };
}

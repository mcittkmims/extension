import { OPENCODE_DEFAULT_URL, PROVIDER_MODELS } from "./constants";
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

export { normalizeOpenCodeUrl } from "../shared/opencode";

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
    provider: (result.apiProvider as string | undefined) || "gemini",
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
  layout: Pick<LayoutController, "applyChatSize">;
}

export function createSettingsController({
  elements,
  state,
  layout
}: SettingsControllerOptions) {
  const { aiButton, chatbox } = elements;

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
  }

  async function load(): Promise<void> {
    const settings = await getApiKey();
    if (settings.key) {
      getById<HTMLInputElement>("ai-sync-key").value = settings.key;
    }
    getById<HTMLInputElement>("ai-opencode-url").value = normalizeOpenCodeUrl(
      settings.opencodeUrl
    );
    getById<HTMLInputElement>("ai-opencode-password").value =
      settings.opencodePassword;

    const resolvedProvider = settings.provider || "gemini";
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

    const appliedSize = layout.applyChatSize(
      settings.chatWidth,
      settings.chatHeight
    );
    if (
      appliedSize.width !== settings.chatWidth ||
      appliedSize.height !== settings.chatHeight
    ) {
      await autoSave();
    }
    state.settingsLoaded = true;
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

  return {
    updateProviderModels,
    load,
    autoSave,
    measurePanelHeight
  };
}

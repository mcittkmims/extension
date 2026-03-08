import { OPENCODE_DEFAULT_URL, PROVIDER_MODELS } from "./constants";
import type {
  ModelCache,
  ModelOption,
  OpenCodeConfig,
  OpenCodeModelsResponse,
  StoredSettings
} from "./types";
import { getById } from "./utils";

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

export function normalizeOpenCodeUrl(url: string | null | undefined): string {
  const raw = (url || "").trim();
  if (!raw) return OPENCODE_DEFAULT_URL;
  return raw.replace(/\/$/, "");
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

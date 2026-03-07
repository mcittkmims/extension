// @ts-nocheck

import { OPENCODE_DEFAULT_URL, PROVIDER_MODELS } from "./constants";

export function setModelOptions(models, savedModel) {
  const modelSelect = document.getElementById("ai-model-select");
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

export function normalizeOpenCodeUrl(url) {
  const raw = (url || "").trim();
  if (!raw) return OPENCODE_DEFAULT_URL;
  return raw.replace(/\/$/, "");
}

export function updateProviderSettingsUI(provider) {
  const isOpenCode = provider === "opencode";
  document
    .getElementById("ai-api-key-group")
    .classList.toggle("hidden", isOpenCode);
  document
    .getElementById("ai-opencode-group")
    .classList.toggle("hidden", !isOpenCode);
}

export function fetchOpenCodeModels(opencodeConfig) {
  return new Promise((resolve, reject) => {
    browser.runtime.sendMessage(
      {
        type: "getOpenCodeModels",
        opencodeConfig
      },
      (response) => {
        if (browser.runtime.lastError) {
          reject(new Error(browser.runtime.lastError.message));
          return;
        }
        if (!response || !response.success) {
          reject(
            new Error(
              response && response.error
                ? response.error
                : "Failed to load models"
            )
          );
          return;
        }
        resolve(response);
      }
    );
  });
}

export async function populateModels(
  provider,
  savedModel,
  settings,
  modelCache
) {
  if (provider !== "opencode") {
    setModelOptions(PROVIDER_MODELS[provider] || [], savedModel);
    return;
  }

  const modelSelect = document.getElementById("ai-model-select");
  const status = document.getElementById("ai-opencode-status");
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
    let serverModels = [];
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
    status.textContent = `Model fetch failed: ${error.message}`;
  }
}

export async function getApiKey() {
  return new Promise((resolve) => {
    browser.storage.local.get(
      [
        "geminiApiKey",
        "apiProvider",
        "apiModel",
        "opencodeServerUrl",
        "opencodePassword",
        "chatOpacity",
        "btnOpacity",
        "chatWidth",
        "chatHeight"
      ],
      (result) => {
        resolve({
          key: result.geminiApiKey || null,
          provider: result.apiProvider || "gemini",
          model: result.apiModel || null,
          opencodeUrl: result.opencodeServerUrl || OPENCODE_DEFAULT_URL,
          opencodePassword: result.opencodePassword || "",
          opacity: result.chatOpacity != null ? result.chatOpacity : 0.95,
          btnOpacity: result.btnOpacity != null ? result.btnOpacity : 0.25,
          chatWidth: result.chatWidth != null ? result.chatWidth : 320,
          chatHeight: result.chatHeight != null ? result.chatHeight : 480
        });
      }
    );
  });
}

export async function saveApiKey(
  key,
  provider,
  model,
  opencodeUrl,
  opencodePassword,
  opacity,
  btnOp,
  chatWidth,
  chatHeight
) {
  return new Promise((resolve) => {
    browser.storage.local.set(
      {
        geminiApiKey: key,
        apiProvider: provider,
        apiModel: model,
        opencodeServerUrl: normalizeOpenCodeUrl(opencodeUrl),
        opencodePassword: opencodePassword || "",
        chatOpacity: opacity,
        btnOpacity: btnOp,
        chatWidth,
        chatHeight
      },
      resolve
    );
  });
}

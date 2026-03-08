(function() {
  "use strict";
  function setupLifecycle() {
    browser.runtime.onInstalled.addListener(function(details) {
      if (details.reason === "install") {
        console.log("Quick Notes: Extension installed");
      } else if (details.reason === "update") {
        console.log("Quick Notes: Extension updated");
      }
    });
    browser.menus.removeAll().then(function() {
      browser.menus.create({
        id: "quiz-screenshot",
        title: "Add to clipboard",
        contexts: ["all"]
      });
    });
    browser.menus.onClicked.addListener(function(info, tab) {
      if (info.menuItemId === "quiz-screenshot" && tab && tab.id) {
        browser.tabs.sendMessage(tab.id, { type: "quizScreenshot" });
      }
    });
  }
  function getProviderErrorMessage(text, status) {
    if (!text) return `Request failed: ${status}`;
    try {
      const err = JSON.parse(text);
      return err.error?.message || `Request failed: ${status}`;
    } catch {
      return `Request failed: ${status} ${text}`;
    }
  }
  function callGemini(apiKey, requestBody) {
    const model = requestBody._geminiModel || "gemini-3.1-pro-preview";
    const body = Object.assign({}, requestBody);
    delete body._geminiModel;
    return fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }
    ).then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    }).then((data) => {
      if (data.candidates && data.candidates[0] && data.candidates[0].content) {
        const textPart = data.candidates[0].content.parts.find((p) => p.text);
        if (textPart) return textPart.text;
      }
      throw new Error("No response generated");
    });
  }
  function callChatCompletions(url, apiKey, requestBody, headers = {}) {
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...headers
      },
      body: JSON.stringify(requestBody)
    }).then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    }).then((data) => {
      if (data.choices && data.choices[0] && data.choices[0].message) {
        return data.choices[0].message.content;
      }
      throw new Error("No response generated");
    });
  }
  function callOpenAI(apiKey, requestBody) {
    return callChatCompletions(
      "https://api.openai.com/v1/chat/completions",
      apiKey,
      requestBody
    );
  }
  function callAnthropic(apiKey, requestBody) {
    return fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify(requestBody)
    }).then((response) => {
      if (!response.ok) {
        return response.text().then((text) => {
          throw new Error(getProviderErrorMessage(text, response.status));
        });
      }
      return response.json();
    }).then((data) => {
      if (data.content && data.content[0] && data.content[0].text) {
        return data.content[0].text;
      }
      throw new Error("No response generated");
    });
  }
  function callGrok(apiKey, requestBody) {
    return callChatCompletions(
      "https://api.x.ai/v1/chat/completions",
      apiKey,
      requestBody
    );
  }
  function callOpenRouter(apiKey, requestBody) {
    return callChatCompletions(
      "https://openrouter.ai/api/v1/chat/completions",
      apiKey,
      requestBody,
      {
        "HTTP-Referer": "https://else.fcim.utm.md",
        "X-Title": "Quick Notes"
      }
    );
  }
  const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";
  const OPENCODE_SESSION_MAP_KEY = "opencodeSessionsByPage";
  function parseErrorPayload(text) {
    if (!text) {
      return "";
    }
    try {
      const json = JSON.parse(text);
      if (typeof json.error?.message === "string") {
        return json.error.message;
      }
      if (typeof json.data?.message === "string") {
        return json.data.message;
      }
      if (typeof json.message === "string") {
        return json.message;
      }
      return text;
    } catch {
      return text;
    }
  }
  function normalizeOpenCodeUrl(url) {
    const raw = (url || "").trim();
    if (!raw) {
      return OPENCODE_DEFAULT_URL;
    }
    return raw.replace(/\/$/, "");
  }
  function createOpenCodeAuthHeader(password) {
    if (!password) {
      return null;
    }
    return `Basic ${btoa(`opencode:${password}`)}`;
  }
  function buildOpenCodeCorsHint(baseUrl) {
    const extensionOrigin = `moz-extension://${browser.runtime.id}`;
    let hostname = "127.0.0.1";
    let port = "4096";
    try {
      const parsed = new URL(baseUrl);
      if (parsed.hostname) {
        hostname = parsed.hostname;
      }
      if (parsed.port) {
        port = parsed.port;
      } else if (parsed.protocol === "https:") {
        port = "443";
      } else {
        port = "80";
      }
    } catch {
    }
    return `Cannot reach OpenCode server at ${baseUrl}. If it is local, run:
opencode serve --hostname ${hostname} --port ${port} --cors ${extensionOrigin}`;
  }
  async function openCodeFetch(baseUrl, password, path, options = {}) {
    const headers = new Headers(options.headers ?? {});
    if (options.method && options.method !== "GET" && !headers.has("Content-Type")) {
      headers.set("Content-Type", "application/json");
    }
    const authHeader = createOpenCodeAuthHeader(password);
    if (authHeader) {
      headers.set("Authorization", authHeader);
    }
    let response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: options.method,
        body: options.body,
        headers
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Network error";
      throw new Error(`${buildOpenCodeCorsHint(baseUrl)}
Details: ${message}`);
    }
    if (!response.ok) {
      const text2 = await response.text();
      const message = parseErrorPayload(text2) || response.statusText || "Request failed";
      if (response.status === 401) {
        throw new Error(
          "OpenCode authentication failed. Check the Server Password in settings."
        );
      }
      throw new Error(`OpenCode request failed (${response.status}): ${message}`);
    }
    if (response.status === 204) {
      return null;
    }
    const text = await response.text();
    if (!text) {
      return {};
    }
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("OpenCode returned an invalid JSON response.");
    }
  }
  async function getOpenCodeSessionMap() {
    const result = await browser.storage.local.get(
      OPENCODE_SESSION_MAP_KEY
    );
    const map = result[OPENCODE_SESSION_MAP_KEY];
    if (map && typeof map === "object") {
      return map;
    }
    return {};
  }
  async function setOpenCodeSessionMap(map) {
    await browser.storage.local.set({ [OPENCODE_SESSION_MAP_KEY]: map });
  }
  async function getOpenCodeSessionId(pageKey) {
    const map = await getOpenCodeSessionMap();
    return map[pageKey] || null;
  }
  async function saveOpenCodeSessionId(pageKey, sessionId) {
    const map = await getOpenCodeSessionMap();
    map[pageKey] = sessionId;
    await setOpenCodeSessionMap(map);
  }
  async function clearOpenCodeSessionId(pageKey) {
    const map = await getOpenCodeSessionMap();
    if (map[pageKey]) {
      delete map[pageKey];
      await setOpenCodeSessionMap(map);
    }
  }
  async function createOpenCodeSession(baseUrl, password, pageKey) {
    const title = `Page: ${pageKey.slice(0, 120)}`;
    const body = title ? { title } : {};
    const data = await openCodeFetch(
      baseUrl,
      password,
      "/session",
      {
        method: "POST",
        body: JSON.stringify(body)
      }
    );
    if (!data?.id) {
      throw new Error("OpenCode did not return a session ID.");
    }
    return data.id;
  }
  async function ensureOpenCodeSession(baseUrl, password, pageKey) {
    const existing = await getOpenCodeSessionId(pageKey);
    if (existing) {
      return existing;
    }
    const created = await createOpenCodeSession(baseUrl, password, pageKey);
    await saveOpenCodeSessionId(pageKey, created);
    return created;
  }
  function shouldRetryWithNewSession(error) {
    return error instanceof Error && /\(404\)/.test(error.message);
  }
  function extractOpenCodeText(parts) {
    if (!Array.isArray(parts)) {
      return "";
    }
    return parts.filter((part) => part?.type === "text" && typeof part.text === "string").map((part) => part.text).join("\n\n").trim();
  }
  async function callOpenCode(opencodeConfig, requestBody, pageKey) {
    const baseUrl = normalizeOpenCodeUrl(opencodeConfig?.baseUrl);
    const password = opencodeConfig?.password || "";
    const scopedPageKey = pageKey || "default";
    if (!requestBody?.parts || requestBody.parts.length === 0) {
      throw new Error("OpenCode request is missing message parts.");
    }
    await openCodeFetch(baseUrl, password, "/global/health", { method: "GET" });
    let sessionId = await ensureOpenCodeSession(baseUrl, password, scopedPageKey);
    let data;
    try {
      data = await openCodeFetch(
        baseUrl,
        password,
        `/session/${encodeURIComponent(sessionId)}/message`,
        {
          method: "POST",
          body: JSON.stringify(requestBody)
        }
      );
    } catch (error) {
      if (!shouldRetryWithNewSession(error)) {
        throw error;
      }
      await clearOpenCodeSessionId(scopedPageKey);
      sessionId = await ensureOpenCodeSession(baseUrl, password, scopedPageKey);
      data = await openCodeFetch(
        baseUrl,
        password,
        `/session/${encodeURIComponent(sessionId)}/message`,
        {
          method: "POST",
          body: JSON.stringify(requestBody)
        }
      );
    }
    const text = extractOpenCodeText(data.parts);
    if (!text) {
      throw new Error("No response generated");
    }
    return text;
  }
  async function getOpenCodeModels(opencodeConfig) {
    const baseUrl = normalizeOpenCodeUrl(opencodeConfig?.baseUrl);
    const password = opencodeConfig?.password || "";
    await openCodeFetch(baseUrl, password, "/global/health", { method: "GET" });
    const providersData = await openCodeFetch(
      baseUrl,
      password,
      "/config/providers",
      { method: "GET" }
    );
    const providers = Array.isArray(providersData.providers) ? providersData.providers : [];
    const defaults = providersData.default && typeof providersData.default === "object" ? providersData.default : {};
    const models = [];
    providers.forEach((provider) => {
      if (!provider?.id || !provider.models || typeof provider.models !== "object") {
        return;
      }
      Object.entries(provider.models).forEach(([modelKey, model]) => {
        if (model?.status === "deprecated") {
          return;
        }
        const id = `${provider.id}/${modelKey}`;
        const label = model?.name ? `${model.name} (${provider.id})` : id;
        models.push({ value: id, label });
      });
    });
    models.sort((a, b) => a.label.localeCompare(b.label));
    let defaultModel = "";
    const defaultProviders = Object.keys(defaults);
    if (defaultProviders.length > 0) {
      const providerId = defaultProviders[0];
      const modelId = defaults[providerId];
      if (providerId && modelId) {
        defaultModel = `${providerId}/${modelId}`;
      }
    }
    return { models, defaultModel };
  }
  function setupRuntimeMessages() {
    browser.runtime.onMessage.addListener((request) => {
      if (request.type === "getSyncKey") {
        return browser.storage.local.get(["geminiApiKey", "apiProvider"]).then((result) => ({
          syncKey: result.geminiApiKey || null,
          provider: result.apiProvider || "gemini"
        }));
      }
      if (request.type === "getOpenCodeModels") {
        return getOpenCodeModels(request.opencodeConfig).then((data) => ({
          success: true,
          models: data.models,
          defaultModel: data.defaultModel || ""
        })).catch((error) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
      }
      if (request.type === "captureTab") {
        return browser.tabs.captureVisibleTab(void 0, { format: "png" }).then((dataUrl) => ({
          success: true,
          base64: dataUrl.replace(/^data:image\/png;base64,/, ""),
          mimeType: "image/png"
        })).catch((error) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
      }
      if (request.type !== "sendToAPI" || !request.requestId || !request.requestBody) {
        return void 0;
      }
      const selectedProvider = request.provider || "gemini";
      let apiCall;
      switch (selectedProvider) {
        case "openai":
          apiCall = callOpenAI(request.apiKey || "", request.requestBody);
          break;
        case "anthropic":
          apiCall = callAnthropic(request.apiKey || "", request.requestBody);
          break;
        case "openrouter":
          apiCall = callOpenRouter(request.apiKey || "", request.requestBody);
          break;
        case "grok":
          apiCall = callGrok(request.apiKey || "", request.requestBody);
          break;
        case "opencode":
          apiCall = callOpenCode(
            request.opencodeConfig,
            request.requestBody,
            request.pageKey
          );
          break;
        case "gemini":
        default:
          apiCall = callGemini(request.apiKey || "", request.requestBody);
          break;
      }
      void apiCall.then(
        (text) => browser.storage.local.set({
          [request.requestId]: { success: true, text }
        })
      ).catch(
        (error) => browser.storage.local.set({
          [request.requestId]: {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        })
      );
      return Promise.resolve({ received: true });
    });
  }
  setupLifecycle();
  setupRuntimeMessages();
})();

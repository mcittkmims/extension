// @ts-nocheck

export const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";
const OPENCODE_SESSION_MAP_KEY = "opencodeSessionsByPage";

function parseErrorPayload(text) {
  if (!text) return "";
  try {
    const json = JSON.parse(text);
    if (json.error && typeof json.error.message === "string") {
      return json.error.message;
    }
    if (json.data && typeof json.data.message === "string") {
      return json.data.message;
    }
    if (typeof json.message === "string") return json.message;
    return text;
  } catch {
    return text;
  }
}

export function normalizeOpenCodeUrl(url) {
  const raw = (url || "").trim();
  if (!raw) return OPENCODE_DEFAULT_URL;
  return raw.replace(/\/$/, "");
}

function createOpenCodeAuthHeader(password) {
  if (!password) return null;
  return `Basic ${btoa(`opencode:${password}`)}`;
}

function buildOpenCodeCorsHint(baseUrl) {
  const extensionOrigin = `moz-extension://${browser.runtime.id}`;
  let hostname = "127.0.0.1";
  let port = "4096";

  try {
    const parsed = new URL(baseUrl);
    if (parsed.hostname) hostname = parsed.hostname;
    if (parsed.port) {
      port = parsed.port;
    } else if (parsed.protocol === "https:") {
      port = "443";
    } else {
      port = "80";
    }
  } catch {
    // Keep defaults
  }

  return `Cannot reach OpenCode server at ${baseUrl}. If it is local, run:\nopencode serve --hostname ${hostname} --port ${port} --cors ${extensionOrigin}`;
}

async function openCodeFetch(baseUrl, password, path, options = {}) {
  const authHeader = createOpenCodeAuthHeader(password);
  const headers = Object.assign({}, options.headers || {});
  if (options.method && options.method !== "GET") {
    headers["Content-Type"] = headers["Content-Type"] || "application/json";
  }
  if (authHeader) headers.Authorization = authHeader;

  const url = `${baseUrl}${path}`;
  let response;
  try {
    response = await fetch(url, Object.assign({}, options, { headers }));
  } catch (error) {
    throw new Error(
      `${buildOpenCodeCorsHint(baseUrl)}\nDetails: ${error.message || "Network error"}`
    );
  }

  if (!response.ok) {
    const text = await response.text();
    const message =
      parseErrorPayload(text) || response.statusText || "Request failed";
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
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("OpenCode returned an invalid JSON response.");
  }
}

function storageGet(keys) {
  return new Promise((resolve) => {
    browser.storage.local.get(keys, resolve);
  });
}

function storageSet(values) {
  return new Promise((resolve) => {
    browser.storage.local.set(values, resolve);
  });
}

async function getOpenCodeSessionMap() {
  const result = await storageGet([OPENCODE_SESSION_MAP_KEY]);
  const map = result[OPENCODE_SESSION_MAP_KEY];
  if (map && typeof map === "object") return map;
  return {};
}

async function setOpenCodeSessionMap(map) {
  await storageSet({ [OPENCODE_SESSION_MAP_KEY]: map });
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
  const title = pageKey ? `Page: ${pageKey.slice(0, 120)}` : undefined;
  const body = title ? { title } : {};
  const data = await openCodeFetch(baseUrl, password, "/session", {
    method: "POST",
    body: JSON.stringify(body)
  });

  if (!data || !data.id) {
    throw new Error("OpenCode did not return a session ID.");
  }
  return data.id;
}

async function ensureOpenCodeSession(baseUrl, password, pageKey) {
  const existing = await getOpenCodeSessionId(pageKey);
  if (existing) return existing;
  const created = await createOpenCodeSession(baseUrl, password, pageKey);
  await saveOpenCodeSessionId(pageKey, created);
  return created;
}

function shouldRetryWithNewSession(error) {
  const message = error && error.message ? error.message : "";
  return /\(404\)/.test(message);
}

function extractOpenCodeText(parts) {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter(
      (part) => part && part.type === "text" && typeof part.text === "string"
    )
    .map((part) => part.text)
    .join("\n\n")
    .trim();
}

export async function callOpenCode(opencodeConfig, requestBody, pageKey) {
  const baseUrl = normalizeOpenCodeUrl(
    opencodeConfig && opencodeConfig.baseUrl
  );
  const password =
    opencodeConfig && opencodeConfig.password ? opencodeConfig.password : "";
  const scopedPageKey = pageKey || "default";

  if (
    !requestBody ||
    !Array.isArray(requestBody.parts) ||
    requestBody.parts.length === 0
  ) {
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

  const text = extractOpenCodeText(data && data.parts);
  if (!text) {
    throw new Error("No response generated");
  }

  return text;
}

export async function getOpenCodeModels(opencodeConfig) {
  const baseUrl = normalizeOpenCodeUrl(
    opencodeConfig && opencodeConfig.baseUrl
  );
  const password =
    opencodeConfig && opencodeConfig.password ? opencodeConfig.password : "";

  await openCodeFetch(baseUrl, password, "/global/health", { method: "GET" });
  const providersData = await openCodeFetch(
    baseUrl,
    password,
    "/config/providers",
    { method: "GET" }
  );

  const providers = Array.isArray(providersData && providersData.providers)
    ? providersData.providers
    : [];
  const defaults =
    providersData && typeof providersData.default === "object"
      ? providersData.default
      : {};

  const models = [];
  providers.forEach((provider) => {
    if (
      !provider ||
      !provider.id ||
      !provider.models ||
      typeof provider.models !== "object"
    ) {
      return;
    }

    Object.keys(provider.models).forEach((modelKey) => {
      const model = provider.models[modelKey] || {};
      if (model.status === "deprecated") return;

      const id = `${provider.id}/${modelKey}`;
      const label = model.name ? `${model.name} (${provider.id})` : id;
      models.push({ value: id, label });
    });
  });

  models.sort((a, b) => a.label.localeCompare(b.label));

  let defaultModel = "";
  const defaultProviders = Object.keys(defaults);
  if (defaultProviders.length > 0) {
    const providerID = defaultProviders[0];
    const modelID = defaults[providerID];
    if (providerID && modelID) {
      defaultModel = `${providerID}/${modelID}`;
    }
  }

  return { models, defaultModel };
}

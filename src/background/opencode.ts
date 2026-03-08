import { normalizeOpenCodeUrl } from "../shared/opencode";

const OPENCODE_SESSION_MAP_KEY = "opencodeSessionsByPage";

interface OpenCodeConfig {
  baseUrl?: string;
  password?: string;
}

interface OpenCodeFetchOptions {
  method?: string;
  headers?: HeadersInit;
  body?: string;
}

interface OpenCodeSessionMap {
  [pageKey: string]: string;
}

interface OpenCodeTextPart {
  type?: string;
  text?: string;
}

interface OpenCodeSessionResponse {
  id?: string;
}

interface OpenCodeMessageResponse {
  parts?: OpenCodeTextPart[];
}

interface OpenCodeProvidersResponse {
  providers?: Array<{
    id?: string;
    models?: Record<string, { status?: string; name?: string }>;
  }>;
  default?: Record<string, string>;
}

interface OpenCodeModelOption {
  value: string;
  label: string;
}

function parseErrorPayload(text: string): string {
  if (!text) {
    return "";
  }

  try {
    const json = JSON.parse(text) as {
      error?: { message?: string };
      data?: { message?: string };
      message?: string;
    };
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

function createOpenCodeAuthHeader(password: string): string | null {
  if (!password) {
    return null;
  }
  return `Basic ${btoa(`opencode:${password}`)}`;
}

function buildOpenCodeCorsHint(baseUrl: string): string {
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
    // Keep defaults.
  }

  return `Cannot reach OpenCode server at ${baseUrl}. If it is local, run:\nopencode serve --hostname ${hostname} --port ${port} --cors ${extensionOrigin}`;
}

async function openCodeFetch<T>(
  baseUrl: string,
  password: string,
  path: string,
  options: OpenCodeFetchOptions = {}
): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  if (
    options.method &&
    options.method !== "GET" &&
    !headers.has("Content-Type")
  ) {
    headers.set("Content-Type", "application/json");
  }

  const authHeader = createOpenCodeAuthHeader(password);
  if (authHeader) {
    headers.set("Authorization", authHeader);
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      method: options.method,
      body: options.body,
      headers
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Network error";
    throw new Error(`${buildOpenCodeCorsHint(baseUrl)}\nDetails: ${message}`);
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
    return null as T;
  }

  const text = await response.text();
  if (!text) {
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error("OpenCode returned an invalid JSON response.");
  }
}

async function getOpenCodeSessionMap(): Promise<OpenCodeSessionMap> {
  const result = (await browser.storage.local.get(
    OPENCODE_SESSION_MAP_KEY
  )) as Record<string, unknown>;
  const map = result[OPENCODE_SESSION_MAP_KEY];
  if (map && typeof map === "object") {
    return map as OpenCodeSessionMap;
  }
  return {};
}

async function setOpenCodeSessionMap(map: OpenCodeSessionMap): Promise<void> {
  await browser.storage.local.set({ [OPENCODE_SESSION_MAP_KEY]: map });
}

async function getOpenCodeSessionId(pageKey: string): Promise<string | null> {
  const map = await getOpenCodeSessionMap();
  return map[pageKey] || null;
}

async function saveOpenCodeSessionId(
  pageKey: string,
  sessionId: string
): Promise<void> {
  const map = await getOpenCodeSessionMap();
  map[pageKey] = sessionId;
  await setOpenCodeSessionMap(map);
}

async function clearOpenCodeSessionId(pageKey: string): Promise<void> {
  const map = await getOpenCodeSessionMap();
  if (map[pageKey]) {
    delete map[pageKey];
    await setOpenCodeSessionMap(map);
  }
}

async function createOpenCodeSession(
  baseUrl: string,
  password: string,
  pageKey: string
): Promise<string> {
  const title = pageKey ? `Page: ${pageKey.slice(0, 120)}` : undefined;
  const body = title ? { title } : {};
  const data = await openCodeFetch<OpenCodeSessionResponse>(
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

async function ensureOpenCodeSession(
  baseUrl: string,
  password: string,
  pageKey: string
): Promise<string> {
  const existing = await getOpenCodeSessionId(pageKey);
  if (existing) {
    return existing;
  }
  const created = await createOpenCodeSession(baseUrl, password, pageKey);
  await saveOpenCodeSessionId(pageKey, created);
  return created;
}

function shouldRetryWithNewSession(error: unknown): boolean {
  return error instanceof Error && /\(404\)/.test(error.message);
}

function extractOpenCodeText(parts: OpenCodeTextPart[] | undefined): string {
  if (!Array.isArray(parts)) {
    return "";
  }

  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n\n")
    .trim();
}

export async function callOpenCode(
  opencodeConfig: OpenCodeConfig | undefined,
  requestBody: { parts?: unknown[] } | undefined,
  pageKey: string | undefined
): Promise<string> {
  const baseUrl = normalizeOpenCodeUrl(opencodeConfig?.baseUrl);
  const password = opencodeConfig?.password || "";
  const scopedPageKey = pageKey || "default";

  if (!requestBody?.parts || requestBody.parts.length === 0) {
    throw new Error("OpenCode request is missing message parts.");
  }

  await openCodeFetch(baseUrl, password, "/global/health", { method: "GET" });

  let sessionId = await ensureOpenCodeSession(baseUrl, password, scopedPageKey);
  let data: OpenCodeMessageResponse;

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

export async function getOpenCodeModels(
  opencodeConfig: OpenCodeConfig | undefined
): Promise<{ models: OpenCodeModelOption[]; defaultModel: string }> {
  const baseUrl = normalizeOpenCodeUrl(opencodeConfig?.baseUrl);
  const password = opencodeConfig?.password || "";

  await openCodeFetch(baseUrl, password, "/global/health", { method: "GET" });
  const providersData = await openCodeFetch<OpenCodeProvidersResponse>(
    baseUrl,
    password,
    "/config/providers",
    { method: "GET" }
  );

  const providers = Array.isArray(providersData.providers)
    ? providersData.providers
    : [];
  const defaults =
    providersData.default && typeof providersData.default === "object"
      ? providersData.default
      : {};

  const models: OpenCodeModelOption[] = [];
  providers.forEach((provider) => {
    if (
      !provider?.id ||
      !provider.models ||
      typeof provider.models !== "object"
    ) {
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

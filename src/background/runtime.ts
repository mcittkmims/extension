import {
  callAIStudio,
  callAnthropic,
  callGrok,
  callOpenAI,
  callOpenRouter,
  callVertexAI
} from "./providers";
import {
  callOpenCode,
  getOpenCodeModels,
  restartOpenCodeSession
} from "./opencode";

interface RuntimeRequest {
  type: string;
  apiKey?: string;
  requestBody?: Record<string, unknown> & { parts?: unknown[] };
  provider?: string;
  opencodeConfig?: { baseUrl?: string; password?: string };
  pageKey?: string;
  requestId?: string;
}

export function setupRuntimeMessages(): void {
  browser.runtime.onMessage.addListener((request: RuntimeRequest) => {
    if (request.type === "getSyncKey") {
      return browser.storage.local
        .get(["geminiApiKey", "apiProvider"])
        .then((result) => ({
          syncKey: (result.geminiApiKey as string | undefined) || null,
          provider: (result.apiProvider as string | undefined) || "aistudio"
        }));
    }

    if (request.type === "getOpenCodeModels") {
      return getOpenCodeModels(request.opencodeConfig)
        .then((data) => ({
          success: true,
          models: data.models,
          defaultModel: data.defaultModel || ""
        }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (request.type === "restartOpenCodeSession") {
      return restartOpenCodeSession(request.pageKey)
        .then(() => ({ success: true }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (request.type === "captureTab") {
      return browser.tabs
        .captureVisibleTab(undefined, { format: "png" })
        .then((dataUrl) => ({
          success: true,
          base64: dataUrl.replace(/^data:image\/png;base64,/, ""),
          mimeType: "image/png"
        }))
        .catch((error: unknown) => ({
          success: false,
          error: error instanceof Error ? error.message : String(error)
        }));
    }

    if (
      request.type !== "sendToAPI" ||
      !request.requestId ||
      !request.requestBody
    ) {
      return undefined;
    }

    const selectedProvider = request.provider || "aistudio";
    let apiCall: Promise<string>;
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
      case "vertex":
        apiCall = callVertexAI(request.apiKey || "", request.requestBody);
        break;
      case "aistudio":
      default:
        apiCall = callAIStudio(request.apiKey || "", request.requestBody);
        break;
    }

    void apiCall
      .then((text) =>
        browser.storage.local.set({
          [request.requestId as string]: { success: true, text }
        })
      )
      .catch((error: unknown) =>
        browser.storage.local.set({
          [request.requestId as string]: {
            success: false,
            error: error instanceof Error ? error.message : String(error)
          }
        })
      );

    return Promise.resolve({ received: true });
  });
}

// @ts-nocheck

import {
  callAnthropic,
  callGemini,
  callGrok,
  callOpenAI,
  callOpenRouter
} from "./providers";
import { callOpenCode, getOpenCodeModels } from "./opencode";

export function setupRuntimeMessages() {
  browser.runtime.onMessage.addListener(
    function (request, sender, sendResponse) {
      if (request.type === "getSyncKey") {
        browser.storage.local.get(
          ["geminiApiKey", "apiProvider"],
          function (result) {
            sendResponse({
              syncKey: result.geminiApiKey || null,
              provider: result.apiProvider || "gemini"
            });
          }
        );
        return true;
      }

      if (request.type === "getOpenCodeModels") {
        getOpenCodeModels(request.opencodeConfig)
          .then((data) => {
            sendResponse({
              success: true,
              models: data.models,
              defaultModel: data.defaultModel || ""
            });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }

      if (request.type === "captureTab") {
        browser.tabs
          .captureVisibleTab(null, { format: "png" })
          .then((dataUrl) => {
            const base64 = dataUrl.replace(/^data:image\/png;base64,/, "");
            sendResponse({ success: true, base64, mimeType: "image/png" });
          })
          .catch((error) => {
            sendResponse({ success: false, error: error.message });
          });
        return true;
      }

      if (request.type === "sendToAPI") {
        const {
          apiKey,
          requestBody,
          provider,
          opencodeConfig,
          pageKey,
          requestId
        } = request;
        const selectedProvider = provider || "gemini";

        let apiCall;
        switch (selectedProvider) {
          case "openai":
            apiCall = callOpenAI(apiKey, requestBody);
            break;
          case "anthropic":
            apiCall = callAnthropic(apiKey, requestBody);
            break;
          case "openrouter":
            apiCall = callOpenRouter(apiKey, requestBody);
            break;
          case "grok":
            apiCall = callGrok(apiKey, requestBody);
            break;
          case "opencode":
            apiCall = callOpenCode(opencodeConfig, requestBody, pageKey);
            break;
          case "gemini":
          default:
            apiCall = callGemini(apiKey, requestBody);
            break;
        }

        apiCall
          .then((text) => {
            browser.storage.local.set({ [requestId]: { success: true, text } });
          })
          .catch((error) => {
            browser.storage.local.set({
              [requestId]: { success: false, error: error.message }
            });
          });

        sendResponse({ received: true });
        return true;
      }
    }
  );
}

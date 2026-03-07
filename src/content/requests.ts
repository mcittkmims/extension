// @ts-nocheck

export function imageFilenameForMime(mimeType) {
  const map = {
    "image/jpeg": "image.jpg",
    "image/png": "image.png",
    "image/webp": "image.webp",
    "image/gif": "image.gif",
    "image/bmp": "image.bmp",
    "image/heic": "image.heic",
    "image/heif": "image.heif"
  };
  return map[mimeType] || "image.bin";
}

export function buildRequestBody(
  provider,
  model,
  text,
  imageBase64,
  imageMimeType
) {
  const instruction =
    "You are a helpful AI assistant. Respond using Markdown formatting where appropriate: use **bold**, *italic*, `inline code`, ```code blocks```, bullet lists, numbered lists, and headers. For short factual answers (a letter, number, or single word) just reply directly without extra markup.";

  const userText = text
    ? "Question: " + text
    : "What is the correct answer to this question shown in the image?";

  if (provider === "gemini") {
    const modelId = model || "gemini-3.1-pro-preview";
    const parts = [];
    parts.push({ text: instruction });
    if (imageBase64 && imageMimeType) {
      parts.push({
        inline_data: { mime_type: imageMimeType, data: imageBase64 }
      });
    }
    parts.push({ text: userText });
    return {
      _geminiModel: modelId,
      contents: [{ parts }],
      generationConfig: {
        temperature: 0.1,
        topK: 1,
        topP: 0.8,
        maxOutputTokens: 2048
      }
    };
  }

  if (provider === "openai" || provider === "openrouter") {
    const messages = [{ role: "system", content: instruction }];
    const userContent = [];
    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
      });
    }
    userContent.push({ type: "text", text: userText });
    messages.push({ role: "user", content: userContent });

    const defaultModel =
      provider === "openai" ? "gpt-5.2" : "google/gemini-3.1-pro-preview";
    return {
      model: model || defaultModel,
      messages,
      temperature: 0.1,
      max_tokens: 2048
    };
  }

  if (provider === "grok") {
    const selectedModel = model || "grok-4-fast-reasoning";
    const messages = [{ role: "system", content: instruction }];
    const userContent = [];
    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: "image_url",
        image_url: { url: `data:${imageMimeType};base64,${imageBase64}` }
      });
    }
    userContent.push({ type: "text", text: userText });
    messages.push({ role: "user", content: userContent });

    return {
      model: selectedModel,
      messages,
      stream: false,
      temperature: 0,
      max_tokens: 2048
    };
  }

  if (provider === "anthropic") {
    const userContent = [];
    if (imageBase64 && imageMimeType) {
      userContent.push({
        type: "image",
        source: {
          type: "base64",
          media_type: imageMimeType,
          data: imageBase64
        }
      });
    }
    userContent.push({ type: "text", text: userText });
    return {
      model: model || "claude-sonnet-4-6",
      max_tokens: 2048,
      system: instruction,
      messages: [{ role: "user", content: userContent }]
    };
  }

  if (provider === "opencode") {
    const parts = [];
    if (imageBase64 && imageMimeType) {
      parts.push({
        type: "file",
        mime: imageMimeType,
        filename: imageFilenameForMime(imageMimeType),
        url: `data:${imageMimeType};base64,${imageBase64}`
      });
    }
    parts.push({ type: "text", text: userText });

    const body = {
      system: instruction,
      parts
    };

    if (model && model.includes("/")) {
      const splitIndex = model.indexOf("/");
      body.model = {
        providerID: model.slice(0, splitIndex),
        modelID: model.slice(splitIndex + 1)
      };
    }

    return body;
  }

  return {};
}

export async function sendToAI({
  text,
  imageBase64 = null,
  imageMimeType = null,
  settings,
  normalizeOpenCodeUrl,
  getPageSessionKey,
  pendingRequests
}) {
  const { key: apiKey, provider, model } = settings;
  if (provider !== "opencode" && !apiKey) {
    throw new Error("API key not configured. Click ⚙️ to set up.");
  }

  const requestBody = buildRequestBody(
    provider,
    model,
    text,
    imageBase64,
    imageMimeType
  );
  const opencodeConfig = {
    baseUrl: normalizeOpenCodeUrl(settings.opencodeUrl),
    password: settings.opencodePassword || ""
  };

  const requestId = Math.random().toString(36).slice(2) + Date.now();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (pendingRequests.has(requestId)) {
        pendingRequests.delete(requestId);
        reject(new Error("Request timed out. Please try again."));
      }
    }, 180000);

    pendingRequests.set(requestId, {
      resolve: (value) => {
        clearTimeout(timeout);
        resolve(value);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      }
    });

    browser.runtime.sendMessage(
      {
        type: "sendToAPI",
        requestId,
        apiKey,
        requestBody,
        provider,
        opencodeConfig,
        pageKey: getPageSessionKey()
      },
      () => {
        if (browser.runtime.lastError) {
          const pending = pendingRequests.get(requestId);
          if (pending) {
            pendingRequests.delete(requestId);
            pending.reject(
              new Error(
                "Could not reach background script. Try reloading the page."
              )
            );
          }
        }
      }
    );
  });
}

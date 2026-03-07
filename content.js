(function() {
  "use strict";
  const OPENCODE_DEFAULT_URL = "http://127.0.0.1:4096";
  const PROVIDER_MODELS = {
    gemini: [
      {
        value: "gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro Preview (latest)"
      },
      { value: "gemini-3-flash-preview", label: "Gemini 3 Flash Preview" },
      { value: "gemini-2.5-pro", label: "Gemini 2.5 Pro (stable)" },
      { value: "gemini-2.5-flash", label: "Gemini 2.5 Flash (stable)" },
      { value: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" }
    ],
    openai: [
      { value: "gpt-5.2", label: "GPT-5.2 (latest)" },
      { value: "gpt-5.2-pro", label: "GPT-5.2 Pro" },
      { value: "gpt-5-mini", label: "GPT-5 Mini" },
      { value: "gpt-5-nano", label: "GPT-5 Nano" },
      { value: "gpt-4.1", label: "GPT-4.1" },
      { value: "gpt-4o", label: "GPT-4o" }
    ],
    anthropic: [
      { value: "claude-opus-4-6", label: "Claude Opus 4.6 (latest)" },
      { value: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
    ],
    openrouter: [
      {
        value: "google/gemini-3.1-pro-preview",
        label: "Gemini 3.1 Pro Preview"
      },
      { value: "openai/gpt-5.2", label: "GPT-5.2" },
      { value: "anthropic/claude-opus-4-6", label: "Claude Opus 4.6" },
      { value: "anthropic/claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { value: "qwen/qwen3.5-122b-a10b", label: "Qwen 3.5 122B" },
      {
        value: "meta-llama/llama-3.3-70b-instruct",
        label: "Llama 3.3 70B"
      },
      { value: "deepseek/deepseek-r1", label: "DeepSeek R1" }
    ],
    grok: [
      {
        value: "grok-4-fast-reasoning",
        label: "Grok 4 Fast Reasoning (latest)"
      },
      { value: "grok-4", label: "Grok 4" },
      { value: "grok-3", label: "Grok 3" },
      { value: "grok-3-mini", label: "Grok 3 Mini" }
    ]
  };
  function createOverlay() {
    const aiButton = document.createElement("button");
    aiButton.id = "moodle-ai-assistant-btn";
    aiButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    `;
    aiButton.title = "Clipboard (Alt+C)";
    const chatbox = document.createElement("div");
    chatbox.id = "moodle-ai-chatbox";
    chatbox.innerHTML = `
        <header class="ai-header">
            <span class="ai-title">Clipboard</span>
            <div class="ai-header-actions">
                <button class="ai-btn-icon" id="ai-settings-toggle" title="Settings">⚙</button>
                <button class="ai-btn-icon ai-close" title="Close">&times;</button>
            </div>
        </header>
        <div class="ai-settings" id="ai-settings-panel">
            <label for="ai-provider-select">Provider</label>
            <select id="ai-provider-select">
                <option value="gemini">Gemini (Google)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openrouter">OpenRouter</option>
                <option value="grok">Grok (xAI)</option>
                <option value="opencode">OpenCode (local)</option>
            </select>
            <label for="ai-model-select" class="mt">Model</label>
            <select id="ai-model-select"></select>
            <div id="ai-api-key-group">
                <label for="ai-sync-key" class="mt">API Key</label>
                <input type="password" id="ai-sync-key" placeholder="Enter API key...">
                <small class="hint">Key for the selected AI provider</small>
            </div>
            <div id="ai-opencode-group" class="hidden">
                <label for="ai-opencode-url" class="mt">OpenCode Server URL</label>
                <input type="text" id="ai-opencode-url" placeholder="http://127.0.0.1:4096">
                <label for="ai-opencode-password" class="mt">Server Password (optional)</label>
                <input type="password" id="ai-opencode-password" placeholder="OPENCODE_SERVER_PASSWORD">
                <small class="hint" id="ai-opencode-status">Models load from your OpenCode server.</small>
            </div>
            <label for="ai-opacity-slider" class="mt">Chat Opacity</label>
            <div class="slider-row">
                <input type="range" id="ai-opacity-slider" min="5" max="100" step="5" value="95">
                <span id="ai-opacity-value" class="slider-value">95%</span>
            </div>
            <label for="ai-btn-opacity-slider" class="mt">Button Opacity</label>
            <div class="slider-row">
                <input type="range" id="ai-btn-opacity-slider" min="5" max="100" step="5" value="60">
                <span id="ai-btn-opacity-value" class="slider-value">60%</span>
            </div>
        </div>
        <div class="ai-messages"></div>
        <div class="ai-input-area" id="ai-dropzone">
            <div class="ai-preview hidden" id="ai-image-preview">
                <img id="ai-preview-img" src="" alt="Preview">
                <button class="ai-preview-remove" id="ai-remove-image">&times;</button>
            </div>
            <div class="ai-input-row">
                <textarea id="ai-chatbox-input" placeholder="Message or paste image..." rows="1"></textarea>
                <button class="ai-btn" id="ai-attach-image-btn" title="Attach image">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path>
                    </svg>
                </button>
                <button class="ai-btn" id="ai-quiz-screenshot-btn" title="Screenshot & answer quiz (Alt+Q)">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                </button>
                <button class="ai-btn ai-btn-send" id="ai-chatbox-send" title="Send">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <line x1="22" y1="2" x2="11" y2="13"></line>
                        <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                    </svg>
                </button>
            </div>
        </div>
        <div class="ai-resize" id="ai-resize-corner"></div>
    `;
    document.body.appendChild(chatbox);
    aiButton.style.visibility = "hidden";
    document.body.appendChild(aiButton);
    return { aiButton, chatbox };
  }
  const ALLOWED_MARKDOWN_TAGS = /* @__PURE__ */ new Set([
    "A",
    "BLOCKQUOTE",
    "BR",
    "CODE",
    "DEL",
    "EM",
    "H1",
    "H2",
    "H3",
    "H4",
    "H5",
    "H6",
    "HR",
    "LI",
    "OL",
    "P",
    "PRE",
    "SPAN",
    "STRONG",
    "TABLE",
    "TBODY",
    "TD",
    "TH",
    "THEAD",
    "TR",
    "UL"
  ]);
  const MARKED_OPTIONS = {
    gfm: true,
    breaks: true,
    headerIds: false,
    mangle: false
  };
  const MARKED_API = globalThis.marked && typeof globalThis.marked.parse === "function" ? globalThis.marked : null;
  let katexReady = null;
  function loadKaTeX() {
    if (!katexReady) katexReady = Promise.resolve();
    return katexReady;
  }
  function renderMath(el) {
    loadKaTeX().then(() => {
      if (!window.katex) return;
      el.querySelectorAll(".ai-math-display").forEach((span) => {
        try {
          katex.render(span.dataset.latex, span, {
            displayMode: true,
            throwOnError: false
          });
        } catch {
          span.textContent = span.dataset.latex;
        }
      });
      el.querySelectorAll(".ai-math-inline").forEach((span) => {
        try {
          katex.render(span.dataset.latex, span, {
            displayMode: false,
            throwOnError: false
          });
        } catch {
          span.textContent = span.dataset.latex;
        }
      });
    });
  }
  function sanitizeMarkdownNode(node, doc) {
    if (node.nodeType === Node.TEXT_NODE) {
      return doc.createTextNode(node.textContent);
    }
    if (node.nodeType !== Node.ELEMENT_NODE) {
      return null;
    }
    if (!ALLOWED_MARKDOWN_TAGS.has(node.tagName)) {
      const fragment = doc.createDocumentFragment();
      Array.from(node.childNodes).forEach((child) => {
        const sanitizedChild = sanitizeMarkdownNode(child, doc);
        if (sanitizedChild) fragment.appendChild(sanitizedChild);
      });
      return fragment;
    }
    const el = doc.createElement(node.tagName.toLowerCase());
    if (node.tagName === "A") {
      const href = node.getAttribute("href") || "";
      if (/^(https?:|mailto:)/i.test(href)) {
        el.setAttribute("href", href);
        el.setAttribute("target", "_blank");
        el.setAttribute("rel", "noopener noreferrer");
      }
    } else if (node.tagName === "SPAN") {
      const cls = node.getAttribute("class") || "";
      if (cls === "ai-math-display" || cls === "ai-math-inline") {
        el.setAttribute("class", cls);
        const latex = node.getAttribute("data-latex");
        if (latex != null) el.setAttribute("data-latex", latex);
      }
    } else if (node.tagName === "CODE") {
      const cls = node.getAttribute("class") || "";
      if (/^language-[a-z0-9_-]+$/i.test(cls)) {
        el.setAttribute("class", cls);
      }
    } else if (node.tagName === "TH" || node.tagName === "TD") {
      const align = node.getAttribute("align");
      if (align && /^(left|center|right)$/i.test(align)) {
        el.setAttribute("align", align.toLowerCase());
      }
    }
    Array.from(node.childNodes).forEach((child) => {
      const sanitizedChild = sanitizeMarkdownNode(child, doc);
      if (sanitizedChild) el.appendChild(sanitizedChild);
    });
    return el;
  }
  function sanitizeMarkdownHtml(html) {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(html, "text/html");
    const fragment = document.createDocumentFragment();
    Array.from(parsed.body.childNodes).forEach((node) => {
      const sanitizedNode = sanitizeMarkdownNode(node, document);
      if (sanitizedNode) fragment.appendChild(sanitizedNode);
    });
    return fragment;
  }
  function extractMath(text) {
    const mathStore = [];
    const stash = (latex, display) => {
      const idx = mathStore.length;
      mathStore.push({ latex: latex.trim(), display });
      return `\0MATH${idx}\0`;
    };
    return {
      text: text.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => stash(latex, true)).replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => stash(latex, false)).replace(
        /(?<!\$)\$(?!\$)([^$\n]+?)\$/g,
        (_, latex) => stash(latex, false)
      ).replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => stash(latex, true)),
      mathStore
    };
  }
  function renderMarkdown(text) {
    return MARKED_API ? MARKED_API.parse(text, MARKED_OPTIONS) : `<p>${text}</p>`;
  }
  function restoreMath(html, mathStore) {
    return html.replace(/\x00MATH(\d+)\x00/g, (_, i) => {
      const { latex, display } = mathStore[+i];
      const cls = display ? "ai-math-display" : "ai-math-inline";
      const escaped = latex.replace(/"/g, "&quot;");
      return `<span class="${cls}" data-latex="${escaped}"></span>`;
    });
  }
  function parseMarkdown(text) {
    const parsed = extractMath(text);
    const html = renderMarkdown(parsed.text);
    return sanitizeMarkdownHtml(restoreMath(html, parsed.mathStore));
  }
  function imageFilenameForMime(mimeType) {
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
  function buildRequestBody(provider, model, text, imageBase64, imageMimeType) {
    const instruction = "You are a helpful AI assistant. Respond using Markdown formatting where appropriate: use **bold**, *italic*, `inline code`, ```code blocks```, bullet lists, numbered lists, and headers. For short factual answers (a letter, number, or single word) just reply directly without extra markup.";
    const userText = text ? "Question: " + text : "What is the correct answer to this question shown in the image?";
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
      const defaultModel = provider === "openai" ? "gpt-5.2" : "google/gemini-3.1-pro-preview";
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
  async function sendToAI({
    text,
    imageBase64 = null,
    imageMimeType = null,
    settings,
    normalizeOpenCodeUrl: normalizeOpenCodeUrl2,
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
      baseUrl: normalizeOpenCodeUrl2(settings.opencodeUrl),
      password: settings.opencodePassword || ""
    };
    const requestId = Math.random().toString(36).slice(2) + Date.now();
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (pendingRequests.has(requestId)) {
          pendingRequests.delete(requestId);
          reject(new Error("Request timed out. Please try again."));
        }
      }, 18e4);
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
  function setModelOptions(models, savedModel) {
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
  function normalizeOpenCodeUrl(url) {
    const raw = (url || "").trim();
    if (!raw) return OPENCODE_DEFAULT_URL;
    return raw.replace(/\/$/, "");
  }
  function updateProviderSettingsUI(provider) {
    const isOpenCode = provider === "opencode";
    document.getElementById("ai-api-key-group").classList.toggle("hidden", isOpenCode);
    document.getElementById("ai-opencode-group").classList.toggle("hidden", !isOpenCode);
  }
  function fetchOpenCodeModels(opencodeConfig) {
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
                response && response.error ? response.error : "Failed to load models"
              )
            );
            return;
          }
          resolve(response);
        }
      );
    });
  }
  async function populateModels(provider, savedModel, settings, modelCache) {
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
    const conf = settings || await getApiKey();
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
  async function getApiKey() {
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
  async function saveApiKey(key, provider, model, opencodeUrl, opencodePassword, opacity, btnOp, chatWidth, chatHeight) {
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
  (function() {
    if (document.getElementById("moodle-ai-assistant-btn")) {
      return;
    }
    const { aiButton, chatbox } = createOverlay();
    const POS_KEY = "ai_btn_pos";
    const pendingAPIRequests = /* @__PURE__ */ new Map();
    let isDragging = false;
    let dragMoved = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let btnStartLeft = 0;
    let btnStartTop = 0;
    let isOpen = false;
    let settingsOpen = false;
    let settingsLoaded = false;
    let currentImageBase64 = null;
    let currentImageMimeType = null;
    let settingsMinHeight = 354;
    let opencodeModelCache = { key: "", models: [] };
    let resizeCornerVertical = "top";
    let resizeCornerHorizontal = "left";
    let resizeAnchorX = 0;
    let resizeAnchorY = 0;
    let isResizing = false;
    let viewportNormalizeTimer = null;
    function loadBtnPos(cb) {
      browser.storage.local.get([POS_KEY], (result) => {
        cb(result[POS_KEY] || getDefaultButtonPos());
      });
    }
    function saveBtnPos(left, top) {
      browser.storage.local.set({ [POS_KEY]: { left, top } });
    }
    function clampValue(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }
    function getViewportBounds() {
      const vv = window.visualViewport;
      return {
        left: Math.round(vv && vv.offsetLeft != null ? vv.offsetLeft : 0),
        top: Math.round(vv && vv.offsetTop != null ? vv.offsetTop : 0),
        width: Math.round(vv && vv.width ? vv.width : window.innerWidth),
        height: Math.round(vv && vv.height ? vv.height : window.innerHeight)
      };
    }
    function getDefaultButtonPos() {
      const viewport = getViewportBounds();
      return {
        left: viewport.left + viewport.width - 38,
        top: viewport.top + viewport.height - 38
      };
    }
    function clampButtonToViewport(left, top) {
      const viewport = getViewportBounds();
      const bw = aiButton.offsetWidth || 20;
      const bh = aiButton.offsetHeight || 20;
      return {
        left: clampValue(
          left,
          viewport.left + 4,
          viewport.left + viewport.width - bw - 4
        ),
        top: clampValue(
          top,
          viewport.top + 4,
          viewport.top + viewport.height - bh - 4
        )
      };
    }
    function getCurrentButtonPos() {
      const fallback = getDefaultButtonPos();
      return {
        left: parseFloat(aiButton.style.left) || aiButton.offsetLeft || fallback.left,
        top: parseFloat(aiButton.style.top) || aiButton.offsetTop || fallback.top
      };
    }
    function getCurrentChatSize() {
      return {
        width: parseFloat(chatbox.style.width) || chatbox.offsetWidth || 320,
        height: parseFloat(chatbox.style.height) || chatbox.offsetHeight || 480
      };
    }
    function getChatSizeLimits() {
      const viewport = getViewportBounds();
      const availableWidth = Math.max(1, viewport.width - 8);
      const availableHeight = Math.max(1, viewport.height - 8);
      const minWidth = Math.min(220, availableWidth);
      const minHeight = Math.min(settingsMinHeight, availableHeight);
      return {
        minWidth,
        maxWidth: Math.max(minWidth, Math.min(700, availableWidth)),
        minHeight,
        maxHeight: Math.max(minHeight, Math.min(700, availableHeight))
      };
    }
    function computeLayout(left, top) {
      const viewportBounds = getViewportBounds();
      const boxW = chatbox.offsetWidth || 320;
      const boxH = chatbox.offsetHeight || 480;
      const bw = aiButton.offsetWidth || 20;
      const bh = aiButton.offsetHeight || 20;
      const gap = 6;
      const margin = 4;
      const viewport = clampButtonToViewport(left, top);
      if (!isOpen) {
        const closedTop = clampValue(
          viewport.top + bh + gap,
          viewportBounds.top + margin,
          viewportBounds.top + viewportBounds.height - boxH - margin
        );
        const btnCenterX2 = viewport.left + bw / 2;
        const isButtonLeft2 = btnCenterX2 < viewportBounds.left + viewportBounds.width / 2;
        const closedLeft = isButtonLeft2 ? clampValue(
          viewport.left,
          viewportBounds.left + margin,
          viewportBounds.left + viewportBounds.width - boxW - margin
        ) : clampValue(
          viewport.left + bw - boxW,
          viewportBounds.left + margin,
          viewportBounds.left + viewportBounds.width - boxW - margin
        );
        return {
          buttonLeft: viewport.left,
          buttonTop: viewport.top,
          chatLeft: closedLeft,
          chatTop: closedTop,
          isAbove: false,
          isButtonLeft: isButtonLeft2
        };
      }
      let finalLeft = viewport.left;
      let finalTop = viewport.top;
      const isAbove = viewport.top - boxH - gap >= viewportBounds.top + margin;
      const minTop = isAbove ? Math.max(
        viewportBounds.top + margin,
        viewportBounds.top + boxH + gap + margin
      ) : viewportBounds.top + margin;
      const maxTop = isAbove ? viewportBounds.top + viewportBounds.height - bh - margin : Math.min(
        viewportBounds.top + viewportBounds.height - bh - margin,
        viewportBounds.top + viewportBounds.height - boxH - bh - gap - margin
      );
      if (minTop <= maxTop) {
        finalTop = clampValue(finalTop, minTop, maxTop);
      }
      const btnCenterX = viewport.left + bw / 2;
      const isButtonLeft = btnCenterX < viewportBounds.left + viewportBounds.width / 2;
      const minLeft = isButtonLeft ? viewportBounds.left + margin : Math.max(
        viewportBounds.left + margin,
        viewportBounds.left + boxW - bw + margin
      );
      const maxLeft = isButtonLeft ? Math.min(
        viewportBounds.left + viewportBounds.width - bw - margin,
        viewportBounds.left + viewportBounds.width - boxW - margin
      ) : viewportBounds.left + viewportBounds.width - bw - margin;
      if (minLeft <= maxLeft) {
        finalLeft = clampValue(finalLeft, minLeft, maxLeft);
      }
      let chatTop = isAbove ? finalTop - boxH - gap : finalTop + bh + gap;
      chatTop = clampValue(
        chatTop,
        viewportBounds.top + margin,
        viewportBounds.top + viewportBounds.height - boxH - margin
      );
      let chatLeft = isButtonLeft ? finalLeft : finalLeft + bw - boxW;
      chatLeft = clampValue(
        chatLeft,
        viewportBounds.left + margin,
        viewportBounds.left + viewportBounds.width - boxW - margin
      );
      return {
        buttonLeft: finalLeft,
        buttonTop: finalTop,
        chatLeft,
        chatTop,
        isAbove,
        isButtonLeft
      };
    }
    function updateResizeCorner(layout) {
      const el = document.getElementById("ai-resize-corner");
      if (!el) return;
      resizeCornerVertical = layout.isAbove ? "top" : "bottom";
      resizeCornerHorizontal = layout.isButtonLeft ? "right" : "left";
      el.style.top = el.style.bottom = el.style.left = el.style.right = "";
      el.style[resizeCornerVertical] = "0";
      el.style[resizeCornerHorizontal] = "0";
      const radiusMap = {
        tl: "8px 0 0 0",
        tr: "0 8px 0 0",
        br: "0 0 8px 0",
        bl: "0 0 0 8px"
      };
      const key = resizeCornerVertical[0] + resizeCornerHorizontal[0];
      el.setAttribute("data-corner", key);
      el.style.borderRadius = radiusMap[key] || "";
      el.style.cursor = resizeCornerVertical === "top" === (resizeCornerHorizontal === "left") ? "nwse-resize" : "nesw-resize";
    }
    function positionChatbox(buttonLeft, buttonTop) {
      const layout = computeLayout(buttonLeft, buttonTop);
      chatbox.style.left = layout.chatLeft + "px";
      chatbox.style.top = layout.chatTop + "px";
      updateResizeCorner(layout);
      return layout;
    }
    function applyPos(left, top) {
      const layout = positionChatbox(left, top);
      aiButton.style.left = layout.buttonLeft + "px";
      aiButton.style.top = layout.buttonTop + "px";
      return { left: layout.buttonLeft, top: layout.buttonTop };
    }
    function applyChatOpacity(val) {
      chatbox.style.opacity = val;
    }
    function applyChatSize(width, height) {
      const limits = getChatSizeLimits();
      const nextWidth = clampValue(width, limits.minWidth, limits.maxWidth);
      const nextHeight = clampValue(height, limits.minHeight, limits.maxHeight);
      chatbox.style.minWidth = limits.minWidth + "px";
      chatbox.style.minHeight = limits.minHeight + "px";
      chatbox.style.maxWidth = limits.maxWidth + "px";
      chatbox.style.width = nextWidth + "px";
      chatbox.style.height = nextHeight + "px";
      chatbox.style.maxHeight = nextHeight + "px";
      return { width: nextWidth, height: nextHeight };
    }
    function applyButtonOpacity(val) {
      aiButton.style.opacity = val;
    }
    function normalizeViewportState(options = {}) {
      const { left, top, persist = false } = options;
      const originalPos = {
        left: left != null ? left : getCurrentButtonPos().left,
        top: top != null ? top : getCurrentButtonPos().top
      };
      const originalSize = getCurrentChatSize();
      const appliedSize = applyChatSize(originalSize.width, originalSize.height);
      const appliedPos = applyPos(originalPos.left, originalPos.top);
      const positionChanged = appliedPos.left !== originalPos.left || appliedPos.top !== originalPos.top;
      const sizeChanged = appliedSize.width !== originalSize.width || appliedSize.height !== originalSize.height;
      if (persist) {
        if (positionChanged) saveBtnPos(appliedPos.left, appliedPos.top);
        if (sizeChanged && settingsLoaded) autoSave();
      }
      return {
        positionChanged,
        sizeChanged,
        left: appliedPos.left,
        top: appliedPos.top,
        width: appliedSize.width,
        height: appliedSize.height
      };
    }
    function getPageLuminance() {
      const els = [document.documentElement, document.body];
      for (const el of els) {
        const bg = window.getComputedStyle(el).backgroundColor;
        const m = bg.match(/[\d.]+/g);
        if (!m || m.length < 3) continue;
        const [r, g, b] = m.slice(0, 3).map(Number);
        const alpha = m[3] != null ? Number(m[3]) : 1;
        if (alpha === 0) continue;
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      }
      return 1;
    }
    function updateDarkMode() {
      chatbox.classList.toggle("ai-page-dark", getPageLuminance() < 0.5);
    }
    function getPageSessionKey() {
      return `${window.location.origin}${window.location.pathname}${window.location.search}`;
    }
    function toggleChatbox() {
      isOpen = !isOpen;
      chatbox.classList.toggle("open", isOpen);
      aiButton.classList.toggle("active", isOpen);
      if (isOpen) {
        normalizeViewportState({ persist: true });
      }
    }
    function closeChatbox() {
      isOpen = false;
      chatbox.classList.remove("open");
      aiButton.classList.remove("active");
    }
    function toggleSettings() {
      settingsOpen = !settingsOpen;
      document.getElementById("ai-settings-panel").classList.toggle("visible", settingsOpen);
    }
    function addMessage(text, isUser = false) {
      const messagesContainer = chatbox.querySelector(".ai-messages");
      const messageDiv = document.createElement("div");
      messageDiv.className = isUser ? "ai-msg ai-msg-user" : "ai-msg ai-msg-bot";
      if (isUser) {
        messageDiv.textContent = text;
      } else {
        messageDiv.appendChild(parseMarkdown(text));
        renderMath(messageDiv);
      }
      messagesContainer.appendChild(messageDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    function addLoadingIndicator() {
      const messagesContainer = chatbox.querySelector(".ai-messages");
      const loadingDiv = document.createElement("div");
      loadingDiv.className = "ai-msg ai-msg-bot ai-loading";
      loadingDiv.id = "ai-loading-indicator";
      loadingDiv.innerHTML = '<div class="ai-typing"><span></span><span></span><span></span></div>';
      messagesContainer.appendChild(loadingDiv);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    function removeLoadingIndicator() {
      const loading = document.getElementById("ai-loading-indicator");
      if (loading) {
        loading.remove();
      }
    }
    function handleImageFile(file) {
      if (!file.type.startsWith("image/")) {
        return;
      }
      const reader = new FileReader();
      reader.onload = function(event) {
        const base64Data = event.target.result;
        currentImageBase64 = base64Data.split(",")[1];
        currentImageMimeType = file.type;
        const preview = document.getElementById("ai-image-preview");
        const previewImg = document.getElementById("ai-preview-img");
        previewImg.src = base64Data;
        preview.classList.remove("hidden");
      };
      reader.readAsDataURL(file);
    }
    function removeImage() {
      currentImageBase64 = null;
      currentImageMimeType = null;
      document.getElementById("ai-image-preview").classList.add("hidden");
    }
    async function sendToAI$1(text, imageBase64 = null, imageMimeType = null) {
      const settings = await getApiKey();
      return sendToAI({
        text,
        imageBase64,
        imageMimeType,
        settings,
        normalizeOpenCodeUrl,
        getPageSessionKey,
        pendingRequests: pendingAPIRequests
      });
    }
    async function handleSend() {
      const input = document.getElementById("ai-chatbox-input");
      const text = input.value.trim();
      if (!text && !currentImageBase64) {
        return;
      }
      if (text) {
        addMessage(text, true);
      }
      if (currentImageBase64) {
        addMessage("[Image attached]", true);
      }
      input.value = "";
      addLoadingIndicator();
      try {
        const response = await sendToAI$1(
          text,
          currentImageBase64,
          currentImageMimeType
        );
        removeLoadingIndicator();
        addMessage(response, false);
        removeImage();
      } catch (error) {
        removeLoadingIndicator();
        addMessage("Error: " + error.message, false);
      }
    }
    async function handleQuizScreenshot() {
      addMessage("📸 Screenshot sent — answering quiz…", true);
      addLoadingIndicator();
      try {
        chatbox.style.display = "none";
        aiButton.style.display = "none";
        await new Promise(
          (resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))
        );
        let captured;
        try {
          captured = await new Promise((resolve, reject) => {
            browser.runtime.sendMessage({ type: "captureTab" }, (response2) => {
              if (browser.runtime.lastError) {
                reject(new Error(browser.runtime.lastError.message));
              } else if (response2 && response2.success) {
                resolve(response2);
              } else {
                reject(
                  new Error(response2 && response2.error || "Screenshot failed")
                );
              }
            });
          });
        } finally {
          chatbox.style.display = "";
          aiButton.style.display = "";
        }
        const quizPrompt = `You are a precise quiz-answering assistant. Your only job is to find and answer the question visible in this screenshot.

RULES — follow them exactly, no exceptions:
1. Do NOT describe, summarize, or comment on the screenshot.
2. Scan the screenshot for a question (quiz, test, exercise, form field, etc.).
3. If NO question is found -> respond with exactly: no question found
4. If a MULTIPLE-CHOICE or SINGLE-CHOICE question is found -> respond with ONLY the letter or number of the correct option (e.g. "B" or "3"). No explanation.
5. If any OTHER type of question is found (fill-in, short answer, calculation, etc.) -> respond with the shortest correct answer only. No explanation, no full sentences unless the answer itself is a sentence.

Begin.`;
        const response = await sendToAI$1(
          quizPrompt,
          captured.base64,
          captured.mimeType
        );
        removeLoadingIndicator();
        addMessage(response, false);
      } catch (error) {
        removeLoadingIndicator();
        addMessage("Error: " + error.message, false);
      }
    }
    async function loadSettings() {
      const {
        key,
        provider,
        model,
        opencodeUrl,
        opencodePassword,
        opacity,
        btnOpacity,
        chatWidth,
        chatHeight
      } = await getApiKey();
      if (key) document.getElementById("ai-sync-key").value = key;
      document.getElementById("ai-opencode-url").value = normalizeOpenCodeUrl(opencodeUrl);
      document.getElementById("ai-opencode-password").value = opencodePassword || "";
      const resolvedProvider = provider || "gemini";
      document.getElementById("ai-provider-select").value = resolvedProvider;
      updateProviderSettingsUI(resolvedProvider);
      await populateModels(
        resolvedProvider,
        model,
        {
          opencodeUrl: normalizeOpenCodeUrl(opencodeUrl),
          opencodePassword: opencodePassword || ""
        },
        opencodeModelCache
      );
      const pct = Math.round(opacity * 100);
      document.getElementById("ai-opacity-slider").value = pct;
      document.getElementById("ai-opacity-value").textContent = pct + "%";
      applyChatOpacity(opacity);
      const btnPct = Math.round(btnOpacity * 100);
      document.getElementById("ai-btn-opacity-slider").value = btnPct;
      document.getElementById("ai-btn-opacity-value").textContent = btnPct + "%";
      applyButtonOpacity(btnOpacity);
      const appliedSize = applyChatSize(chatWidth, chatHeight);
      if (appliedSize.width !== chatWidth || appliedSize.height !== chatHeight) {
        autoSave();
      }
      settingsLoaded = true;
    }
    async function autoSave() {
      const key = document.getElementById("ai-sync-key").value.trim();
      const provider = document.getElementById("ai-provider-select").value;
      const model = document.getElementById("ai-model-select").value;
      const opencodeUrl = normalizeOpenCodeUrl(
        document.getElementById("ai-opencode-url").value
      );
      const opencodePassword = document.getElementById(
        "ai-opencode-password"
      ).value;
      const opacity = parseInt(document.getElementById("ai-opacity-slider").value, 10) / 100;
      const btnOp = parseInt(document.getElementById("ai-btn-opacity-slider").value, 10) / 100;
      const chatWidth = chatbox.offsetWidth || 320;
      const chatHeight = chatbox.offsetHeight || 480;
      await saveApiKey(
        key,
        provider,
        model,
        opencodeUrl,
        opencodePassword,
        opacity,
        btnOp,
        chatWidth,
        chatHeight
      );
    }
    function openImagePicker() {
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = "image/*";
      fileInput.onchange = (event) => {
        if (event.target.files.length > 0) {
          handleImageFile(event.target.files[0]);
        }
      };
      fileInput.click();
    }
    loadBtnPos((initPos) => {
      normalizeViewportState({
        left: initPos.left,
        top: initPos.top,
        persist: true
      });
      aiButton.style.visibility = "";
      updateDarkMode();
    });
    updateDarkMode();
    const darkObserver = new MutationObserver(updateDarkMode);
    darkObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
    });
    darkObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class", "style", "data-theme", "data-color-scheme"]
    });
    browser.storage.onChanged.addListener((changes, area) => {
      if (area !== "local") return;
      if (changes[POS_KEY] && !isDragging) {
        const pos = changes[POS_KEY].newValue;
        if (pos) normalizeViewportState({ left: pos.left, top: pos.top });
      }
      for (const [key, change] of Object.entries(changes)) {
        if (key === POS_KEY || !change.newValue) continue;
        const pending = pendingAPIRequests.get(key);
        if (pending) {
          pendingAPIRequests.delete(key);
          browser.storage.local.remove(key);
          const resp = change.newValue;
          if (resp.success) {
            pending.resolve(resp.text);
          } else {
            pending.reject(new Error(resp.error || "Request failed"));
          }
        }
      }
    });
    aiButton.addEventListener("mousedown", (e) => {
      if (e.button !== 0) return;
      isDragging = true;
      dragMoved = false;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      btnStartLeft = aiButton.offsetLeft;
      btnStartTop = aiButton.offsetTop;
      e.preventDefault();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
      if (dragMoved) {
        document.body.style.userSelect = "none";
        aiButton.style.cursor = "grabbing";
        applyPos(btnStartLeft + dx, btnStartTop + dy);
      }
    });
    document.addEventListener("mouseup", () => {
      if (!isDragging) return;
      isDragging = false;
      document.body.style.userSelect = "";
      aiButton.style.cursor = "";
      if (dragMoved) {
        saveBtnPos(aiButton.offsetLeft, aiButton.offsetTop);
      } else {
        toggleChatbox();
      }
    });
    const resizeCorner = document.getElementById("ai-resize-corner");
    resizeCorner.addEventListener("mousedown", (e) => {
      isResizing = true;
      const rect = chatbox.getBoundingClientRect();
      resizeAnchorX = resizeCornerHorizontal === "left" ? rect.right : rect.left;
      resizeAnchorY = resizeCornerVertical === "top" ? rect.bottom : rect.top;
      e.preventDefault();
      e.stopPropagation();
    });
    document.addEventListener("mousemove", (e) => {
      if (!isResizing) return;
      const viewport = getViewportBounds();
      const limits = getChatSizeLimits();
      const pointerX = e.clientX;
      const pointerY = e.clientY;
      let newWidth = resizeCornerHorizontal === "left" ? resizeAnchorX - pointerX : pointerX - resizeAnchorX;
      let newHeight = resizeCornerVertical === "top" ? resizeAnchorY - pointerY : pointerY - resizeAnchorY;
      newWidth = clampValue(newWidth, limits.minWidth, limits.maxWidth);
      newHeight = clampValue(newHeight, limits.minHeight, limits.maxHeight);
      let newLeft = resizeCornerHorizontal === "left" ? resizeAnchorX - newWidth : resizeAnchorX;
      let newTop = resizeCornerVertical === "top" ? resizeAnchorY - newHeight : resizeAnchorY;
      newLeft = Math.max(
        viewport.left + 4,
        Math.min(viewport.left + viewport.width - newWidth - 4, newLeft)
      );
      newTop = Math.max(
        viewport.top + 4,
        Math.min(viewport.top + viewport.height - newHeight - 4, newTop)
      );
      chatbox.style.width = newWidth + "px";
      chatbox.style.height = newHeight + "px";
      chatbox.style.maxHeight = newHeight + "px";
      chatbox.style.left = newLeft + "px";
      chatbox.style.top = newTop + "px";
    });
    document.addEventListener("mouseup", () => {
      if (!isResizing) return;
      isResizing = false;
      autoSave();
    });
    const scheduleViewportNormalize = () => {
      if (viewportNormalizeTimer) clearTimeout(viewportNormalizeTimer);
      viewportNormalizeTimer = setTimeout(() => {
        normalizeViewportState({ persist: true });
      }, 120);
    };
    window.addEventListener("resize", scheduleViewportNormalize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener("resize", scheduleViewportNormalize);
    }
    document.addEventListener("keydown", function(e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
        const active = document.activeElement;
        const tag = active && active.tagName.toLowerCase();
        const insideChatbox = active && chatbox.contains(active);
        if (!insideChatbox && (tag === "input" || tag === "textarea" || tag === "select" || active && active.isContentEditable)) {
          return;
        }
        e.preventDefault();
        toggleChatbox();
      }
    });
    document.addEventListener("keydown", function(e) {
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyQ") {
        const active = document.activeElement;
        const tag = active && active.tagName.toLowerCase();
        const insideChatbox = active && chatbox.contains(active);
        if (!insideChatbox && (tag === "input" || tag === "textarea" || tag === "select" || active && active.isContentEditable)) {
          return;
        }
        e.preventDefault();
        handleQuizScreenshot();
      }
    });
    chatbox.querySelector(".ai-close").addEventListener("click", closeChatbox);
    document.getElementById("ai-settings-toggle").addEventListener("click", toggleSettings);
    document.getElementById("ai-provider-select").addEventListener("change", async () => {
      const provider = document.getElementById("ai-provider-select").value;
      updateProviderSettingsUI(provider);
      await populateModels(provider, null, null, opencodeModelCache);
      await autoSave();
    });
    document.getElementById("ai-model-select").addEventListener("change", () => autoSave());
    document.getElementById("ai-sync-key").addEventListener("blur", () => autoSave());
    document.getElementById("ai-opencode-password").addEventListener("blur", async () => {
      const settings = {
        opencodeUrl: normalizeOpenCodeUrl(
          document.getElementById("ai-opencode-url").value
        ),
        opencodePassword: document.getElementById("ai-opencode-password").value
      };
      await autoSave();
      opencodeModelCache = { key: "", models: [] };
      if (document.getElementById("ai-provider-select").value === "opencode") {
        await populateModels(
          "opencode",
          document.getElementById("ai-model-select").value,
          settings,
          opencodeModelCache
        );
      }
    });
    document.getElementById("ai-opencode-url").addEventListener("blur", async () => {
      const settings = {
        opencodeUrl: normalizeOpenCodeUrl(
          document.getElementById("ai-opencode-url").value
        ),
        opencodePassword: document.getElementById("ai-opencode-password").value
      };
      await autoSave();
      opencodeModelCache = { key: "", models: [] };
      if (document.getElementById("ai-provider-select").value === "opencode") {
        await populateModels(
          "opencode",
          document.getElementById("ai-model-select").value,
          settings,
          opencodeModelCache
        );
      }
    });
    document.getElementById("ai-opacity-slider").addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      document.getElementById("ai-opacity-value").textContent = pct + "%";
      applyChatOpacity(pct / 100);
      autoSave();
    });
    document.getElementById("ai-btn-opacity-slider").addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      document.getElementById("ai-btn-opacity-value").textContent = pct + "%";
      applyButtonOpacity(pct / 100);
      autoSave();
    });
    document.getElementById("ai-chatbox-send").addEventListener("click", handleSend);
    document.getElementById("ai-quiz-screenshot-btn").addEventListener("click", handleQuizScreenshot);
    document.getElementById("ai-chatbox-input").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
    document.getElementById("ai-remove-image").addEventListener("click", removeImage);
    document.getElementById("ai-attach-image-btn").addEventListener("click", openImagePicker);
    document.getElementById("ai-image-preview").addEventListener("click", (e) => {
      if (e.target.id === "ai-remove-image" || e.target.closest("#ai-remove-image")) {
        return;
      }
      openImagePicker();
    });
    const inputArea = document.getElementById("ai-dropzone");
    inputArea.addEventListener("dragover", (e) => {
      e.preventDefault();
      inputArea.classList.add("dragover");
    });
    inputArea.addEventListener("dragleave", (e) => {
      e.preventDefault();
      inputArea.classList.remove("dragover");
    });
    inputArea.addEventListener("drop", (e) => {
      e.preventDefault();
      inputArea.classList.remove("dragover");
      const files = e.dataTransfer.files;
      if (files.length > 0) {
        handleImageFile(files[0]);
      }
    });
    document.addEventListener("paste", (e) => {
      if (!isOpen) return;
      const items = e.clipboardData.items;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf("image") !== -1) {
          const file = items[i].getAsFile();
          handleImageFile(file);
          break;
        }
      }
    });
    (function measureSettingsHeight() {
      const panel = document.getElementById("ai-settings-panel");
      const header = chatbox.querySelector(".ai-header");
      const boxPrev = {
        display: chatbox.style.display,
        visibility: chatbox.style.visibility
      };
      const panelWasVisible = panel.classList.contains("visible");
      chatbox.style.visibility = "hidden";
      chatbox.style.display = "flex";
      panel.classList.add("visible");
      const headerH = header ? header.offsetHeight : 41;
      const measured = headerH + panel.offsetHeight + 16;
      if (measured > 100) settingsMinHeight = measured;
      chatbox.style.display = boxPrev.display;
      chatbox.style.visibility = boxPrev.visibility;
      if (!panelWasVisible) panel.classList.remove("visible");
    })();
    loadSettings();
    loadKaTeX();
  })();
})();

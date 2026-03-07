// @ts-nocheck
// Quick Notes - Study Helper - Content Script

import { OPENCODE_DEFAULT_URL } from "./constants";
import { createOverlay } from "./dom";
import { loadKaTeX, parseMarkdown, renderMath } from "./markdown";
import { sendToAI as sendAIRequest } from "./requests";
import {
  getApiKey,
  normalizeOpenCodeUrl,
  populateModels,
  saveApiKey,
  updateProviderSettingsUI
} from "./settings";

(function () {
  "use strict";

  if (document.getElementById("moodle-ai-assistant-btn")) {
    return;
  }

  const { aiButton, chatbox } = createOverlay();

  const POS_KEY = "ai_btn_pos";
  const pendingAPIRequests = new Map();
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
      left:
        parseFloat(aiButton.style.left) || aiButton.offsetLeft || fallback.left,
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
      const btnCenterX = viewport.left + bw / 2;
      const isButtonLeft =
        btnCenterX < viewportBounds.left + viewportBounds.width / 2;
      const closedLeft = isButtonLeft
        ? clampValue(
            viewport.left,
            viewportBounds.left + margin,
            viewportBounds.left + viewportBounds.width - boxW - margin
          )
        : clampValue(
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
        isButtonLeft
      };
    }

    let finalLeft = viewport.left;
    let finalTop = viewport.top;
    const isAbove = viewport.top - boxH - gap >= viewportBounds.top + margin;
    const minTop = isAbove
      ? Math.max(
          viewportBounds.top + margin,
          viewportBounds.top + boxH + gap + margin
        )
      : viewportBounds.top + margin;
    const maxTop = isAbove
      ? viewportBounds.top + viewportBounds.height - bh - margin
      : Math.min(
          viewportBounds.top + viewportBounds.height - bh - margin,
          viewportBounds.top + viewportBounds.height - boxH - bh - gap - margin
        );
    if (minTop <= maxTop) {
      finalTop = clampValue(finalTop, minTop, maxTop);
    }

    const btnCenterX = viewport.left + bw / 2;
    const isButtonLeft =
      btnCenterX < viewportBounds.left + viewportBounds.width / 2;
    const minLeft = isButtonLeft
      ? viewportBounds.left + margin
      : Math.max(
          viewportBounds.left + margin,
          viewportBounds.left + boxW - bw + margin
        );
    const maxLeft = isButtonLeft
      ? Math.min(
          viewportBounds.left + viewportBounds.width - bw - margin,
          viewportBounds.left + viewportBounds.width - boxW - margin
        )
      : viewportBounds.left + viewportBounds.width - bw - margin;
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
    el.style.cursor =
      (resizeCornerVertical === "top") === (resizeCornerHorizontal === "left")
        ? "nwse-resize"
        : "nesw-resize";
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
    const positionChanged =
      appliedPos.left !== originalPos.left ||
      appliedPos.top !== originalPos.top;
    const sizeChanged =
      appliedSize.width !== originalSize.width ||
      appliedSize.height !== originalSize.height;

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
    document
      .getElementById("ai-settings-panel")
      .classList.toggle("visible", settingsOpen);
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
    loadingDiv.innerHTML =
      '<div class="ai-typing"><span></span><span></span><span></span></div>';
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
    reader.onload = function (event) {
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

  async function sendToAI(text, imageBase64 = null, imageMimeType = null) {
    const settings = await getApiKey();
    return sendAIRequest({
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
      const response = await sendToAI(
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
      await new Promise((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      );

      let captured;
      try {
        captured = await new Promise((resolve, reject) => {
          browser.runtime.sendMessage({ type: "captureTab" }, (response) => {
            if (browser.runtime.lastError) {
              reject(new Error(browser.runtime.lastError.message));
            } else if (response && response.success) {
              resolve(response);
            } else {
              reject(
                new Error((response && response.error) || "Screenshot failed")
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
      const response = await sendToAI(
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
    document.getElementById("ai-opencode-url").value =
      normalizeOpenCodeUrl(opencodeUrl);
    document.getElementById("ai-opencode-password").value =
      opencodePassword || "";
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
    const opacity =
      parseInt(document.getElementById("ai-opacity-slider").value, 10) / 100;
    const btnOp =
      parseInt(document.getElementById("ai-btn-opacity-slider").value, 10) /
      100;
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
    let newWidth =
      resizeCornerHorizontal === "left"
        ? resizeAnchorX - pointerX
        : pointerX - resizeAnchorX;
    let newHeight =
      resizeCornerVertical === "top"
        ? resizeAnchorY - pointerY
        : pointerY - resizeAnchorY;
    newWidth = clampValue(newWidth, limits.minWidth, limits.maxWidth);
    newHeight = clampValue(newHeight, limits.minHeight, limits.maxHeight);

    let newLeft =
      resizeCornerHorizontal === "left"
        ? resizeAnchorX - newWidth
        : resizeAnchorX;
    let newTop =
      resizeCornerVertical === "top"
        ? resizeAnchorY - newHeight
        : resizeAnchorY;

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

  document.addEventListener("keydown", function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyC") {
      const active = document.activeElement;
      const tag = active && active.tagName.toLowerCase();
      const insideChatbox = active && chatbox.contains(active);
      if (
        !insideChatbox &&
        (tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (active && active.isContentEditable))
      ) {
        return;
      }
      e.preventDefault();
      toggleChatbox();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === "KeyQ") {
      const active = document.activeElement;
      const tag = active && active.tagName.toLowerCase();
      const insideChatbox = active && chatbox.contains(active);
      if (
        !insideChatbox &&
        (tag === "input" ||
          tag === "textarea" ||
          tag === "select" ||
          (active && active.isContentEditable))
      ) {
        return;
      }
      e.preventDefault();
      handleQuizScreenshot();
    }
  });

  chatbox.querySelector(".ai-close").addEventListener("click", closeChatbox);
  document
    .getElementById("ai-settings-toggle")
    .addEventListener("click", toggleSettings);

  document
    .getElementById("ai-provider-select")
    .addEventListener("change", async () => {
      const provider = document.getElementById("ai-provider-select").value;
      updateProviderSettingsUI(provider);
      await populateModels(provider, null, null, opencodeModelCache);
      await autoSave();
    });

  document
    .getElementById("ai-model-select")
    .addEventListener("change", () => autoSave());
  document
    .getElementById("ai-sync-key")
    .addEventListener("blur", () => autoSave());

  document
    .getElementById("ai-opencode-password")
    .addEventListener("blur", async () => {
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

  document
    .getElementById("ai-opencode-url")
    .addEventListener("blur", async () => {
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

  document
    .getElementById("ai-opacity-slider")
    .addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      document.getElementById("ai-opacity-value").textContent = pct + "%";
      applyChatOpacity(pct / 100);
      autoSave();
    });

  document
    .getElementById("ai-btn-opacity-slider")
    .addEventListener("input", (e) => {
      const pct = parseInt(e.target.value, 10);
      document.getElementById("ai-btn-opacity-value").textContent = pct + "%";
      applyButtonOpacity(pct / 100);
      autoSave();
    });

  document
    .getElementById("ai-chatbox-send")
    .addEventListener("click", handleSend);
  document
    .getElementById("ai-quiz-screenshot-btn")
    .addEventListener("click", handleQuizScreenshot);
  document
    .getElementById("ai-chatbox-input")
    .addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    });
  document
    .getElementById("ai-remove-image")
    .addEventListener("click", removeImage);
  document
    .getElementById("ai-attach-image-btn")
    .addEventListener("click", openImagePicker);
  document.getElementById("ai-image-preview").addEventListener("click", (e) => {
    if (
      e.target.id === "ai-remove-image" ||
      e.target.closest("#ai-remove-image")
    ) {
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

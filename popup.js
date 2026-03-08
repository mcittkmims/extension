(function() {
  "use strict";
  const STORAGE_KEY = "clipboardHistory";
  function getById(id) {
    const element = document.getElementById(id);
    if (!element) {
      throw new Error(`Missing element #${id}`);
    }
    return element;
  }
  async function loadHistory() {
    const result = await browser.storage.local.get(STORAGE_KEY);
    return Array.isArray(result[STORAGE_KEY]) ? result[STORAGE_KEY] : [];
  }
  document.addEventListener("DOMContentLoaded", () => {
    const newItemInput = getById("newItemInput");
    const addBtn = getById("addBtn");
    const historyList = getById("historyList");
    const clearAllBtn = getById("clearAllBtn");
    const toast = getById("toast");
    let toastTimer = null;
    function showToast(message) {
      toast.textContent = message;
      toast.classList.add("show");
      if (toastTimer) {
        clearTimeout(toastTimer);
      }
      toastTimer = window.setTimeout(() => {
        toast.classList.remove("show");
      }, 1800);
    }
    function renderHistory(items) {
      historyList.innerHTML = "";
      items.forEach((text, index) => {
        const item = document.createElement("div");
        item.className = "clip-item";
        const span = document.createElement("span");
        span.className = "clip-text";
        span.textContent = text;
        span.title = text;
        span.addEventListener("click", () => {
          void copyText(text);
        });
        const copyBtn = document.createElement("button");
        copyBtn.className = "clip-copy";
        copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
        copyBtn.title = "Copy";
        copyBtn.addEventListener("click", () => {
          void copyText(text);
        });
        const deleteButton = document.createElement("button");
        deleteButton.className = "clip-delete";
        deleteButton.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        deleteButton.title = "Remove";
        deleteButton.addEventListener("click", () => {
          void removeItem(index);
        });
        item.append(span, copyBtn, deleteButton);
        historyList.appendChild(item);
      });
    }
    async function copyText(text) {
      try {
        await navigator.clipboard.writeText(text);
        showToast("Copied!");
      } catch {
        showToast("Copy failed");
      }
    }
    async function addItem() {
      const text = newItemInput.value.trim();
      if (!text) {
        return;
      }
      const items = await loadHistory();
      const updated = [text, ...items.filter((item) => item !== text)];
      await browser.storage.local.set({ [STORAGE_KEY]: updated });
      newItemInput.value = "";
      renderHistory(updated);
      showToast("Saved!");
    }
    async function removeItem(index) {
      const items = await loadHistory();
      items.splice(index, 1);
      await browser.storage.local.set({ [STORAGE_KEY]: items });
      renderHistory(items);
    }
    addBtn.addEventListener("click", () => {
      void addItem();
    });
    newItemInput.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        void addItem();
      }
    });
    clearAllBtn.addEventListener("click", async () => {
      await browser.storage.local.set({
        [STORAGE_KEY]: [],
        chatOpacity: 0.95,
        btnOpacity: 0.25,
        chatWidth: 320,
        chatHeight: 480
      });
      renderHistory([]);
      showToast("Clipboard cleared!");
      const tabs = await browser.tabs.query({
        active: true,
        currentWindow: true
      });
      if (tabs[0]?.id !== void 0) {
        void browser.tabs.sendMessage(tabs[0].id, { type: "resetPosition" });
      }
    });
    void loadHistory().then(renderHistory);
  });
})();

// Clipboard Manager - Popup script
document.addEventListener('DOMContentLoaded', function() {
    const newItemInput = document.getElementById('newItemInput');
    const addBtn       = document.getElementById('addBtn');
    const historyList  = document.getElementById('historyList');
    const clearAllBtn  = document.getElementById('clearAllBtn');
    const toast        = document.getElementById('toast');

    const STORAGE_KEY = 'clipboardHistory';
    let toastTimer = null;

    // ── Toast helper ─────────────────────────────────────────────────────────
    function showToast(msg) {
        toast.textContent = msg;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function() { toast.classList.remove('show'); }, 1800);
    }

    // ── Render history list ───────────────────────────────────────────────────
    function renderHistory(items) {
        historyList.innerHTML = '';
        items.forEach(function(text, idx) {
            const item = document.createElement('div');
            item.className = 'clip-item';

            const span = document.createElement('span');
            span.className = 'clip-text';
            span.textContent = text;
            span.title = text;
            span.addEventListener('click', function() { copyText(text); });

            const copyBtn = document.createElement('button');
            copyBtn.className = 'clip-copy';
            copyBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>';
            copyBtn.title = 'Copy';
            copyBtn.addEventListener('click', function() { copyText(text); });

            const delBtn = document.createElement('button');
            delBtn.className = 'clip-delete';
            delBtn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
            delBtn.title = 'Remove';
            delBtn.addEventListener('click', function() { removeItem(idx); });

            item.appendChild(span);
            item.appendChild(copyBtn);
            item.appendChild(delBtn);
            historyList.appendChild(item);
        });
    }

    // ── Copy to system clipboard ──────────────────────────────────────────────
    function copyText(text) {
        navigator.clipboard.writeText(text).then(function() {
            showToast('Copied!');
        }).catch(function() {
            showToast('Copy failed');
        });
    }

    // ── Load from storage ─────────────────────────────────────────────────────
    function loadHistory(cb) {
        browser.storage.local.get([STORAGE_KEY], function(result) {
            const items = result[STORAGE_KEY] || [];
            cb(items);
        });
    }

    loadHistory(renderHistory);

    // ── Add item ──────────────────────────────────────────────────────────────
    function addItem() {
        const text = newItemInput.value.trim();
        if (!text) return;
        loadHistory(function(items) {
            // Prepend, remove duplicates
            const updated = [text].concat(items.filter(function(i) { return i !== text; }));
            browser.storage.local.set({ [STORAGE_KEY]: updated }, function() {
                newItemInput.value = '';
                renderHistory(updated);
                showToast('Saved!');
            });
        });
    }

    addBtn.addEventListener('click', addItem);
    newItemInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') addItem();
    });

    // ── Remove single item ────────────────────────────────────────────────────
    function removeItem(idx) {
        loadHistory(function(items) {
            items.splice(idx, 1);
            browser.storage.local.set({ [STORAGE_KEY]: items }, function() {
                renderHistory(items);
            });
        });
    }

    // ── Clear all + reset appearance ──────────────────────────────────────────
    clearAllBtn.addEventListener('click', function() {
        browser.storage.local.set({
            [STORAGE_KEY]: [],
            chatOpacity: 0.95,
            btnOpacity: 0.25,
            chatWidth: 320,
            chatHeight: 480
        }, function() {
            renderHistory([]);
            showToast('Clipboard cleared!');
        });
        browser.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (tabs[0]) browser.tabs.sendMessage(tabs[0].id, { type: 'resetPosition' });
        });
    });
});

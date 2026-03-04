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
            copyBtn.textContent = '⎘';
            copyBtn.title = 'Copy';
            copyBtn.addEventListener('click', function() { copyText(text); });

            const delBtn = document.createElement('button');
            delBtn.className = 'clip-delete';
            delBtn.textContent = '✕';
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

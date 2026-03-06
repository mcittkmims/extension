// Quick Notes - Study Helper - Content Script
(function() {
    'use strict';

    // Check if we've already injected
    if (document.getElementById('moodle-ai-assistant-btn')) {
        return;
    }

    // Create the clipboard button (small, subtle)
    const aiButton = document.createElement('button');
    aiButton.id = 'moodle-ai-assistant-btn';
    aiButton.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
        </svg>
    `;
    aiButton.title = 'Clipboard (Alt+C)';

    // Create the chatbox container
    const chatbox = document.createElement('div');
    chatbox.id = 'moodle-ai-chatbox';
    chatbox.innerHTML = `
        <div class="ai-chatbox-header">
            <span class="ai-chatbox-title">Clipboard</span>
            <div style="display: flex; align-items: center; gap: 6px;">
                <button class="ai-chatbox-settings-btn" id="ai-settings-toggle" title="Settings">⚙</button>
                <button class="ai-chatbox-close" title="Close">&times;</button>
            </div>
        </div>
        <div class="ai-settings-panel" id="ai-settings-panel">
            <label for="ai-provider-select">Provider</label>
            <select id="ai-provider-select" class="ai-settings-select">
                <option value="gemini">Gemini (Google)</option>
                <option value="openai">OpenAI (GPT)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="openrouter">OpenRouter</option>
                <option value="grok">Grok (xAI)</option>
                <option value="opencode">OpenCode (local)</option>
            </select>
            <label for="ai-model-select" style="margin-top:8px">Model</label>
            <select id="ai-model-select" class="ai-settings-select"></select>
            <div id="ai-api-key-group">
                <label for="ai-sync-key" style="margin-top:8px">API Key</label>
                <input type="password" id="ai-sync-key" placeholder="Enter API key...">
                <div class="settings-hint">Key for the selected AI provider</div>
            </div>
            <div id="ai-opencode-group" style="display:none; margin-top:8px;">
                <label for="ai-opencode-url">OpenCode Server URL</label>
                <input type="text" id="ai-opencode-url" placeholder="http://127.0.0.1:4096">
                <label for="ai-opencode-password" style="margin-top:8px">Server Password (optional)</label>
                <input type="password" id="ai-opencode-password" placeholder="OPENCODE_SERVER_PASSWORD">
                <div class="settings-hint" id="ai-opencode-status">Models load from your OpenCode server.</div>
            </div>
            <label for="ai-opacity-slider" style="margin-top:8px">Chat Opacity</label>
            <div style="display:flex;align-items:center;gap:8px">
                <input type="range" id="ai-opacity-slider" min="5" max="100" step="5" value="95" style="flex:1">
                <span id="ai-opacity-value" style="font-size:11px;color:inherit;min-width:30px;text-align:right">95%</span>
            </div>
            <label for="ai-btn-opacity-slider" style="margin-top:8px">Button Opacity</label>
            <div style="display:flex;align-items:center;gap:8px">
                <input type="range" id="ai-btn-opacity-slider" min="5" max="100" step="5" value="60" style="flex:1">
                <span id="ai-btn-opacity-value" style="font-size:11px;color:inherit;min-width:30px;text-align:right">60%</span>
            </div>
        </div>
        <div class="ai-chatbox-messages">
        </div>
        <div class="ai-chatbox-dropzone" id="ai-dropzone">
            <div class="ai-dropzone-content">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                    <circle cx="8.5" cy="8.5" r="1.5"></circle>
                    <polyline points="21 15 16 10 5 21"></polyline>
                </svg>
                <p>Drop or click</p>
            </div>
            <div class="ai-image-preview" id="ai-image-preview" style="display: none;">
                <img id="ai-preview-img" src="" alt="Preview">
                <button class="ai-remove-image" id="ai-remove-image">&times;</button>
            </div>
        </div>
        <div class="ai-chatbox-input-container">
            <textarea class="ai-chatbox-input" id="ai-chatbox-input" placeholder="Add to clipboard..." rows="2"></textarea>
            <button class="ai-chatbox-quiz-btn" id="ai-quiz-screenshot-btn" title="Screenshot & answer quiz (Alt+Q)">
                <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                    <circle cx="12" cy="13" r="4"></circle>
                    <polyline points="9 10 9 6 15 6 15 10" style="display:none"></polyline>
                </svg>
            </button>
            <button class="ai-chatbox-send" id="ai-chatbox-send" title="Send">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>

        <div class="ai-resize-corner" id="ai-resize-corner"></div>
    `;

    // Insert elements as a floating overlay on the page
    document.body.appendChild(chatbox);
    aiButton.style.visibility = 'hidden';
    document.body.appendChild(aiButton);

    // ── Drag-to-move ──────────────────────────────────────────────────────────
    const POS_KEY = 'ai_btn_pos';
    let isDragging = false, dragMoved = false;
    let dragStartX = 0, dragStartY = 0, btnStartLeft = 0, btnStartTop = 0;

    function loadBtnPos(cb) {
        browser.storage.local.get([POS_KEY], (result) => {
            cb(result[POS_KEY] || { left: window.innerWidth - 38, top: window.innerHeight - 38 });
        });
    }

    function saveBtnPos(left, top) {
        browser.storage.local.set({ [POS_KEY]: { left, top } });
    }

    function clamp(left, top) {
        const bw = aiButton.offsetWidth  || 20;
        const bh = aiButton.offsetHeight || 20;
        return {
            left: Math.max(4, Math.min(window.innerWidth  - bw - 4, left)),
            top:  Math.max(4, Math.min(window.innerHeight - bh - 4, top))
        };
    }

    // Corner-tracking & resize anchor (must be declared before first positionChatbox call)
    let _cornerV = 'bottom'; // which chatbox side is near the button: 'top' or 'bottom'
    let _cornerH = 'right';  // 'left' or 'right'
    let resizeRV = 'top';    // which side the resize corner is on
    let resizeRH = 'left';
    let resizeAnchorX = 0, resizeAnchorY = 0;

    function positionChatbox(bl, bt) {
        const boxW = chatbox.offsetWidth  || 320;
        const boxH = chatbox.offsetHeight || 480;
        const bw = aiButton.offsetWidth  || 20;
        const bh = aiButton.offsetHeight || 20;
        const gap = 6;

        // ── Vertical ──────────────────────────────────────────────────────
        const isAbove = bt - boxH - gap >= 4;
        let top = isAbove ? bt - boxH - gap : bt + bh + gap;
        top = Math.min(top, window.innerHeight - boxH - 4);
        top = Math.max(4, top);

        // ── Horizontal: left-align if button is in left half, otherwise right-align ──
        const btnCenterX = bl + bw / 2;
        const isButtonLeft = btnCenterX < window.innerWidth / 2;
        let left;
        if (isButtonLeft) {
            left = bl; // chat extends rightward from button left edge
        } else {
            left = bl + bw - boxW; // chat extends leftward from button right edge
        }
        left = Math.max(4, Math.min(window.innerWidth - boxW - 4, left));

        chatbox.style.left = left + 'px';
        chatbox.style.top  = top  + 'px';

        // Track which chatbox corner is near the button (opposite = resize corner)
        _cornerV = isAbove ? 'bottom' : 'top';
        _cornerH = isButtonLeft ? 'left' : 'right';
        updateResizeCorner();
    }

    function updateResizeCorner() {
        const el = document.getElementById('ai-resize-corner');
        if (!el) return;
        resizeRV = _cornerV === 'bottom' ? 'top' : 'bottom';
        resizeRH = _cornerH === 'right'  ? 'left' : 'right';
        el.style.top = el.style.bottom = el.style.left = el.style.right = '';
        el.style[resizeRV] = '0';
        el.style[resizeRH] = '0';
        const radiusMap = { tl:'8px 0 0 0', tr:'0 8px 0 0', br:'0 0 8px 0', bl:'0 0 0 8px' };
        const key = resizeRV[0] + resizeRH[0];
        el.setAttribute('data-corner', key);
        el.style.borderRadius = radiusMap[key] || '';
        el.style.cursor = (resizeRV === 'top') === (resizeRH === 'left') ? 'nwse-resize' : 'nesw-resize';
    }

    function applyPos(left, top) {
        const c = clamp(left, top);
        aiButton.style.left = c.left + 'px';
        aiButton.style.top  = c.top  + 'px';
        positionChatbox(c.left, c.top);
        return c;
    }

    // Restore saved position (async — shared across all websites)
    loadBtnPos((initPos) => {
        applyPos(initPos.left, initPos.top);
        aiButton.style.visibility = '';
        updateDarkMode();
    });

    // Detect page dark mode by checking background luminance
    function getPageLuminance() {
        const els = [document.documentElement, document.body];
        for (const el of els) {
            const bg = window.getComputedStyle(el).backgroundColor;
            const m = bg.match(/\d+/g);
            if (!m || m.length < 3) continue;
            const [r, g, b] = m.map(Number);
            if (r === 0 && g === 0 && b === 0) continue; // transparent/unset
            // relative luminance
            const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
            return lum;
        }
        return 1; // default to light
    }

    function updateDarkMode() {
        const lum = getPageLuminance();
        chatbox.classList.toggle('ai-page-dark', lum < 0.5);
    }

    updateDarkMode();
    // Re-check if background changes
    const _darkObserver = new MutationObserver(updateDarkMode);
    _darkObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] });
    _darkObserver.observe(document.body, { attributes: true, attributeFilter: ['class', 'style', 'data-theme', 'data-color-scheme'] });

    // Sync button position in real-time across all open tabs
    browser.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes[POS_KEY]) return;
        if (isDragging) return; // don't interrupt an active drag
        const pos = changes[POS_KEY].newValue;
        if (pos) applyPos(pos.left, pos.top);
    });

    aiButton.addEventListener('mousedown', (e) => {
        if (e.button !== 0) return;
        isDragging  = true;
        dragMoved   = false;
        dragStartX  = e.clientX;
        dragStartY  = e.clientY;
        btnStartLeft = aiButton.offsetLeft;
        btnStartTop  = aiButton.offsetTop;
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        if (Math.abs(dx) > 4 || Math.abs(dy) > 4) dragMoved = true;
        if (dragMoved) {
            document.body.style.userSelect = 'none';
            aiButton.style.cursor = 'grabbing';
            applyPos(btnStartLeft + dx, btnStartTop + dy);
        }
    });

    document.addEventListener('mouseup', () => {
        if (!isDragging) return;
        isDragging = false;
        document.body.style.userSelect = '';
        aiButton.style.cursor = '';
        if (dragMoved) {
            saveBtnPos(aiButton.offsetLeft, aiButton.offsetTop);
        } else {
            toggleChatbox();
        }
    });
    // ─────────────────────────────────────────────────────────────────────────

    // State
    let isOpen = false;
    let settingsOpen = false;
    let currentImageBase64 = null;
    let currentImageMimeType = null;
    let currentProvider = 'gemini';
    let _settingsMinH = 354; // measured once at init
    const OPENCODE_DEFAULT_URL = 'http://127.0.0.1:4096';
    let opencodeModelCache = { key: '', models: [] };

    // Available models per provider
    const PROVIDER_MODELS = {
        gemini: [
            { value: 'gemini-3.1-pro-preview',  label: 'Gemini 3.1 Pro Preview (latest)' },
            { value: 'gemini-3-flash-preview',   label: 'Gemini 3 Flash Preview' },
            { value: 'gemini-2.5-pro',           label: 'Gemini 2.5 Pro (stable)' },
            { value: 'gemini-2.5-flash',         label: 'Gemini 2.5 Flash (stable)' },
            { value: 'gemini-2.5-flash-lite',    label: 'Gemini 2.5 Flash-Lite' },
        ],
        openai: [
            { value: 'gpt-5.2',       label: 'GPT-5.2 (latest)' },
            { value: 'gpt-5.2-pro',   label: 'GPT-5.2 Pro' },
            { value: 'gpt-5-mini',    label: 'GPT-5 Mini' },
            { value: 'gpt-5-nano',    label: 'GPT-5 Nano' },
            { value: 'gpt-4.1',       label: 'GPT-4.1' },
            { value: 'gpt-4o',        label: 'GPT-4o' },
        ],
        anthropic: [
            { value: 'claude-opus-4-6',            label: 'Claude Opus 4.6 (latest)' },
            { value: 'claude-sonnet-4-6',          label: 'Claude Sonnet 4.6' },
            { value: 'claude-haiku-4-5-20251001',  label: 'Claude Haiku 4.5' },
        ],
        openrouter: [
            { value: 'google/gemini-3.1-pro-preview',           label: 'Gemini 3.1 Pro Preview' },
            { value: 'openai/gpt-5.2',                          label: 'GPT-5.2' },
            { value: 'anthropic/claude-opus-4-6',               label: 'Claude Opus 4.6' },
            { value: 'anthropic/claude-sonnet-4-6',             label: 'Claude Sonnet 4.6' },
            { value: 'qwen/qwen3.5-122b-a10b',                  label: 'Qwen 3.5 122B' },
            { value: 'meta-llama/llama-3.3-70b-instruct',       label: 'Llama 3.3 70B' },
            { value: 'deepseek/deepseek-r1',                    label: 'DeepSeek R1' },
        ],
        grok: [
            { value: 'grok-4-fast-reasoning',  label: 'Grok 4 Fast Reasoning (latest)' },
            { value: 'grok-4',                  label: 'Grok 4' },
            { value: 'grok-3',                  label: 'Grok 3' },
            { value: 'grok-3-mini',             label: 'Grok 3 Mini' },
        ],
    };

    function setModelOptions(models, savedModel) {
        const modelSelect = document.getElementById('ai-model-select');
        modelSelect.innerHTML = '';
        models.forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.value;
            opt.textContent = m.label;
            modelSelect.appendChild(opt);
        });
        if (savedModel && models.some(m => m.value === savedModel)) {
            modelSelect.value = savedModel;
        } else if (models.length > 0) {
            modelSelect.value = models[0].value;
        }
    }

    function normalizeOpenCodeUrl(url) {
        const raw = (url || '').trim();
        if (!raw) return OPENCODE_DEFAULT_URL;
        return raw.replace(/\/$/, '');
    }

    function getPageSessionKey() {
        return `${window.location.origin}${window.location.pathname}${window.location.search}`;
    }

    function updateProviderSettingsUI(provider) {
        const isOpenCode = provider === 'opencode';
        document.getElementById('ai-api-key-group').style.display = isOpenCode ? 'none' : 'block';
        document.getElementById('ai-opencode-group').style.display = isOpenCode ? 'block' : 'none';
    }

    function fetchOpenCodeModels(opencodeConfig) {
        return new Promise((resolve, reject) => {
            browser.runtime.sendMessage({
                type: 'getOpenCodeModels',
                opencodeConfig
            }, (response) => {
                if (browser.runtime.lastError) {
                    reject(new Error(browser.runtime.lastError.message));
                    return;
                }
                if (!response || !response.success) {
                    reject(new Error(response && response.error ? response.error : 'Failed to load models'));
                    return;
                }
                resolve(response);
            });
        });
    }

    // Populate model dropdown for given provider, optionally pre-selecting savedModel
    async function populateModels(provider, savedModel, settings) {
        if (provider !== 'opencode') {
            setModelOptions(PROVIDER_MODELS[provider] || [], savedModel);
            return;
        }

        const modelSelect = document.getElementById('ai-model-select');
        const status = document.getElementById('ai-opencode-status');
        modelSelect.innerHTML = '';
        const loading = document.createElement('option');
        loading.value = '';
        loading.textContent = 'Loading models...';
        modelSelect.appendChild(loading);

        const conf = settings || await getApiKey();
        const opencodeConfig = {
            baseUrl: normalizeOpenCodeUrl(conf.opencodeUrl),
            password: conf.opencodePassword || ''
        };
        const cacheKey = `${opencodeConfig.baseUrl}::${opencodeConfig.password}`;

        try {
            let serverModels = [];
            let defaultModel = '';

            if (opencodeModelCache.key === cacheKey && opencodeModelCache.models.length > 0) {
                serverModels = opencodeModelCache.models;
            } else {
                const data = await fetchOpenCodeModels(opencodeConfig);
                serverModels = Array.isArray(data.models) ? data.models : [];
                defaultModel = data.defaultModel || '';
                opencodeModelCache = { key: cacheKey, models: serverModels };
            }

            const merged = [{ value: '', label: 'Server default model' }].concat(serverModels);
            setModelOptions(merged, savedModel || defaultModel || '');
            status.textContent = `Connected to ${opencodeConfig.baseUrl}`;
        } catch (error) {
            setModelOptions([{ value: '', label: 'Server default model' }], '');
            status.textContent = `Model fetch failed: ${error.message}`;
        }
    }

    // Toggle chatbox
    function toggleChatbox() {
        isOpen = !isOpen;
        chatbox.classList.toggle('open', isOpen);
        aiButton.classList.toggle('active', isOpen);
        if (isOpen) {
            const r = aiButton.getBoundingClientRect();
            positionChatbox(r.left, r.top);
        }
    }

    // Close chatbox
    function closeChatbox() {
        isOpen = false;
        chatbox.classList.remove('open');
        aiButton.classList.remove('active');
    }

    // Toggle settings
    function toggleSettings() {
        settingsOpen = !settingsOpen;
        document.getElementById('ai-settings-panel').classList.toggle('open', settingsOpen);
    }

    // Lightweight Markdown → HTML renderer
    // KaTeX is pre-injected by the manifest before content.js — just wrap in a resolved promise
    let katexReady = null;
    function loadKaTeX() {
        if (!katexReady) katexReady = Promise.resolve();
        return katexReady;
    }

    // Render KaTeX placeholders inside an element
    function renderMath(el) {
        loadKaTeX().then(() => {
            if (!window.katex) return;
            el.querySelectorAll('.ai-math-display').forEach(span => {
                try {
                    katex.render(span.dataset.latex, span, { displayMode: true, throwOnError: false });
                } catch(e) { span.textContent = span.dataset.latex; }
            });
            el.querySelectorAll('.ai-math-inline').forEach(span => {
                try {
                    katex.render(span.dataset.latex, span, { displayMode: false, throwOnError: false });
                } catch(e) { span.textContent = span.dataset.latex; }
            });
        });
    }

    function parseMarkdown(text) {
        const escape = s => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');

        // Stash math blocks BEFORE any escaping so backslashes/braces survive
        const mathStore = [];
        const stash = (latex, display) => {
            const idx = mathStore.length;
            mathStore.push({ latex, display });
            return `\x00MATH${idx}\x00`;
        };

        // Display math: \[...\]
        text = text.replace(/\\\[([\s\S]*?)\\\]/g, (_, latex) => stash(latex.trim(), true));
        // Inline math: \(...\)
        text = text.replace(/\\\(([\s\S]*?)\\\)/g, (_, latex) => stash(latex.trim(), false));
        // Also handle $...$ inline (but not $$)
        text = text.replace(/(?<!\$)\$(?!\$)([^$\n]+?)\$/g, (_, latex) => stash(latex.trim(), false));
        // And $$...$$
        text = text.replace(/\$\$([\s\S]*?)\$\$/g, (_, latex) => stash(latex.trim(), true));

        // Fenced code blocks
        text = text.replace(/```([\s\S]*?)```/g, (_, code) =>
            `<pre><code>${escape(code.trim())}</code></pre>`);

        // Inline code
        text = text.replace(/`([^`]+)`/g, (_, code) =>
            `<code>${escape(code)}</code>`);

        // Headers (most # first to avoid partial matches)
        text = text.replace(/^#{6}\s+(.+)$/gm, '<h6>$1</h6>');
        text = text.replace(/^#{5}\s+(.+)$/gm, '<h5>$1</h5>');
        text = text.replace(/^#{4}\s+(.+)$/gm, '<h4>$1</h4>');
        text = text.replace(/^#{3}\s+(.+)$/gm, '<h3>$1</h3>');
        text = text.replace(/^#{2}\s+(.+)$/gm, '<h2>$1</h2>');
        text = text.replace(/^#{1}\s+(.+)$/gm, '<h1>$1</h1>');

        // Bold + italic
        text = text.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');

        // Horizontal rule
        text = text.replace(/^---$/gm, '<hr>');

        // Unordered lists
        text = text.replace(/((?:^[\-\*]\s.+\n?)+)/gm, match => {
            const items = match.trim().split('\n').map(l => `<li>${l.replace(/^[\-\*]\s/, '')}</li>`).join('');
            return `<ul>${items}</ul>`;
        });

        // Ordered lists
        text = text.replace(/((?:^\d+\.\s.+\n?)+)/gm, match => {
            const items = match.trim().split('\n').map(l => `<li>${l.replace(/^\d+\.\s/, '')}</li>`).join('');
            return `<ol>${items}</ol>`;
        });

        // Paragraphs
        text = text.replace(/^(?!<[hup]|<ol|<pre|<hr|<li|<\/)(.*\S.*)$/gm, '<p>$1</p>');

        // Line breaks
        text = text.replace(/(?<!>)\n(?!<)/g, '<br>');

        // Restore math as KaTeX placeholder spans
        text = text.replace(/\x00MATH(\d+)\x00/g, (_, i) => {
            const { latex, display } = mathStore[+i];
            const cls = display ? 'ai-math-display' : 'ai-math-inline';
            const escaped = latex.replace(/"/g, '&quot;');
            return `<span class="${cls}" data-latex="${escaped}"></span>`;
        });

        return text;
    }

    // Add message to chat
    function addMessage(text, isUser = false) {
        const messagesContainer = chatbox.querySelector('.ai-chatbox-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${isUser ? 'ai-user' : 'ai-assistant'}`;
        if (isUser) {
            const p = document.createElement('p');
            p.textContent = text;
            messageDiv.appendChild(p);
        } else {
            const bubble = document.createElement('div');
            bubble.className = 'ai-markdown';
            const parser = new DOMParser();
            const doc = parser.parseFromString(parseMarkdown(text), 'text/html');
            while (doc.body.firstChild) {
                bubble.appendChild(doc.body.firstChild);
            }
            messageDiv.appendChild(bubble);
            renderMath(bubble);
        }
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Add loading indicator
    function addLoadingIndicator() {
        const messagesContainer = chatbox.querySelector('.ai-chatbox-messages');
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'ai-message ai-assistant ai-loading';
        loadingDiv.id = 'ai-loading-indicator';
        loadingDiv.innerHTML = `<div class="ai-typing-indicator"><span></span><span></span><span></span></div>`;
        messagesContainer.appendChild(loadingDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Remove loading indicator
    function removeLoadingIndicator() {
        const loading = document.getElementById('ai-loading-indicator');
        if (loading) {
            loading.remove();
        }
    }

    // Escape HTML
    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }


    // Handle image file
    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            return;
        }

        const reader = new FileReader();
        reader.onload = function(e) {
            const base64Data = e.target.result;
            currentImageBase64 = base64Data.split(',')[1];
            currentImageMimeType = file.type;

            const preview = document.getElementById('ai-image-preview');
            const previewImg = document.getElementById('ai-preview-img');
            const dropzone = document.getElementById('ai-dropzone');
            
            previewImg.src = base64Data;
            preview.style.display = 'flex';
            dropzone.querySelector('.ai-dropzone-content').style.display = 'none';
        };
        reader.readAsDataURL(file);
    }

    // Remove image
    function removeImage() {
        currentImageBase64 = null;
        currentImageMimeType = null;
        const preview = document.getElementById('ai-image-preview');
        const dropzone = document.getElementById('ai-dropzone');
        preview.style.display = 'none';
        dropzone.querySelector('.ai-dropzone-content').style.display = 'flex';
    }

    // Get API key, provider and model from storage
    async function getApiKey() {
        return new Promise((resolve) => {
            browser.storage.local.get([
                'geminiApiKey',
                'apiProvider',
                'apiModel',
                'opencodeServerUrl',
                'opencodePassword',
                'chatOpacity',
                'btnOpacity',
                'chatWidth',
                'chatHeight'
            ], (result) => {
                resolve({
                    key: result.geminiApiKey || null,
                    provider: result.apiProvider || 'gemini',
                    model: result.apiModel || null,
                    opencodeUrl: result.opencodeServerUrl || OPENCODE_DEFAULT_URL,
                    opencodePassword: result.opencodePassword || '',
                    opacity: result.chatOpacity != null ? result.chatOpacity : 0.95,
                    btnOpacity: result.btnOpacity != null ? result.btnOpacity : 0.25,
                    chatWidth: result.chatWidth != null ? result.chatWidth : 320,
                    chatHeight: result.chatHeight != null ? result.chatHeight : 480
                });
            });
        });
    }

    // Save API key, provider and model
    async function saveApiKey(key, provider, model, opencodeUrl, opencodePassword, opacity, btnOp, chatWidth, chatHeight) {
        return new Promise((resolve) => {
            browser.storage.local.set({
                geminiApiKey: key,
                apiProvider: provider,
                apiModel: model,
                opencodeServerUrl: normalizeOpenCodeUrl(opencodeUrl),
                opencodePassword: opencodePassword || '',
                chatOpacity: opacity,
                btnOpacity: btnOp,
                chatWidth,
                chatHeight
            }, () => {
                currentProvider = provider;
                resolve();
            });
        });
    }

    function applyChatOpacity(val) {
        chatbox.style.opacity = val;
    }

    function applyChatSize(w, h) {
        w = Math.max(220, Math.min(700, w));
        h = Math.max(_settingsMinH, Math.min(700, h));
        chatbox.style.width = w + 'px';
        chatbox.style.height = h + 'px';
        chatbox.style.maxHeight = h + 'px';
    }

    let currentBtnOpacity = 0.25;
    function applyButtonOpacity(val) {
        currentBtnOpacity = val;
        aiButton.style.opacity = val;
    }

    // ── Corner resize (both W and H) ─────────────────────────────────────────
    let isResizing = false;
    const resizeCorner = document.getElementById('ai-resize-corner');

    resizeCorner.addEventListener('mousedown', (e) => {
        isResizing = true;
        const rect = chatbox.getBoundingClientRect();
        // Anchor = the corner OPPOSITE to the resize handle; stays fixed during drag
        resizeAnchorX = resizeRH === 'left' ? rect.right  : rect.left;
        resizeAnchorY = resizeRV === 'top'  ? rect.bottom : rect.top;
        e.preventDefault();
        e.stopPropagation();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        let newW = resizeRH === 'left' ? resizeAnchorX - e.clientX : e.clientX - resizeAnchorX;
        let newH = resizeRV === 'top'  ? resizeAnchorY - e.clientY : e.clientY - resizeAnchorY;
        newW = Math.max(220, Math.min(700, newW));
        newH = Math.max(_settingsMinH, Math.min(700, newH));

        let newLeft = resizeRH === 'left' ? resizeAnchorX - newW : resizeAnchorX;
        let newTop  = resizeRV === 'top'  ? resizeAnchorY - newH : resizeAnchorY;

        // Clamp position so the chat box stays fully on screen
        newLeft = Math.max(4, Math.min(window.innerWidth  - newW - 4, newLeft));
        newTop  = Math.max(4, Math.min(window.innerHeight - newH - 4, newTop));

        chatbox.style.width     = newW + 'px';
        chatbox.style.height    = newH + 'px';
        chatbox.style.maxHeight = newH + 'px';
        chatbox.style.left = newLeft + 'px';
        chatbox.style.top  = newTop  + 'px';
    });

    document.addEventListener('mouseup', () => {
        if (!isResizing) return;
        isResizing = false;
        autoSave();
    });
    // ─────────────────────────────────────────────────────────────────────────

    function imageFilenameForMime(mimeType) {
        const map = {
            'image/jpeg': 'image.jpg',
            'image/png': 'image.png',
            'image/webp': 'image.webp',
            'image/gif': 'image.gif',
            'image/bmp': 'image.bmp',
            'image/heic': 'image.heic',
            'image/heif': 'image.heif'
        };
        return map[mimeType] || 'image.bin';
    }

    // Build request body based on provider
    function buildRequestBody(provider, model, text, imageBase64, imageMimeType) {
        const instruction = 'You are a helpful AI assistant. Respond using Markdown formatting where appropriate: use **bold**, *italic*, `inline code`, ```code blocks```, bullet lists, numbered lists, and headers. For short factual answers (a letter, number, or single word) just reply directly without extra markup.';

        let userText = text ? 'Question: ' + text : 'What is the correct answer to this question shown in the image?';

        if (provider === 'gemini') {
            const modelId = model || 'gemini-3.1-pro-preview';
            const parts = [];
            parts.push({ text: instruction });
            if (imageBase64 && imageMimeType) {
                parts.push({ inline_data: { mime_type: imageMimeType, data: imageBase64 } });
            }
            parts.push({ text: userText });
            return {
                _geminiModel: modelId,
                contents: [{ parts: parts }],
                generationConfig: { temperature: 0.1, topK: 1, topP: 0.8, maxOutputTokens: 2048 }
            };
        }

        if (provider === 'openai' || provider === 'openrouter') {
            const messages = [
                { role: 'system', content: instruction }
            ];
            const userContent = [];
            if (imageBase64 && imageMimeType) {
                userContent.push({ type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } });
            }
            userContent.push({ type: 'text', text: userText });
            messages.push({ role: 'user', content: userContent });

            const defaultModel = provider === 'openai' ? 'gpt-5.2' : 'google/gemini-3.1-pro-preview';
            return {
                model: model || defaultModel,
                messages: messages,
                temperature: 0.1,
                max_tokens: 2048
            };
        }

        if (provider === 'grok') {
            const selectedModel = model || 'grok-4-fast-reasoning';
            const messages = [
                { role: 'system', content: instruction }
            ];
            const userContent = [];
            if (imageBase64 && imageMimeType) {
                userContent.push({ type: 'image_url', image_url: { url: `data:${imageMimeType};base64,${imageBase64}` } });
            }
            userContent.push({ type: 'text', text: userText });
            messages.push({ role: 'user', content: userContent });

            return {
                model: selectedModel,
                messages: messages,
                stream: false,
                temperature: 0,
                max_tokens: 2048
            };
        }

        if (provider === 'anthropic') {
            const userContent = [];
            if (imageBase64 && imageMimeType) {
                userContent.push({ type: 'image', source: { type: 'base64', media_type: imageMimeType, data: imageBase64 } });
            }
            userContent.push({ type: 'text', text: userText });
            return {
                model: model || 'claude-sonnet-4-6',
                max_tokens: 2048,
                system: instruction,
                messages: [{ role: 'user', content: userContent }]
            };
        }

        if (provider === 'opencode') {
            const parts = [];
            if (imageBase64 && imageMimeType) {
                parts.push({
                    type: 'file',
                    mime: imageMimeType,
                    filename: imageFilenameForMime(imageMimeType),
                    url: `data:${imageMimeType};base64,${imageBase64}`
                });
            }
            parts.push({ type: 'text', text: userText });

            const body = {
                system: instruction,
                parts
            };

            if (model && model.includes('/')) {
                const splitIndex = model.indexOf('/');
                body.model = {
                    providerID: model.slice(0, splitIndex),
                    modelID: model.slice(splitIndex + 1)
                };
            }

            return body;
        }

        return {};
    }

    // Send request to selected AI provider
    async function sendToAI(text, imageBase64 = null, imageMimeType = null) {
        const settings = await getApiKey();
        const { key: apiKey, provider, model } = settings;
        if (provider !== 'opencode' && !apiKey) {
            throw new Error('API key not configured. Click ⚙️ to set up.');
        }

        const requestBody = buildRequestBody(provider, model, text, imageBase64, imageMimeType);
        const opencodeConfig = {
            baseUrl: normalizeOpenCodeUrl(settings.opencodeUrl),
            password: settings.opencodePassword || ''
        };

        // Send request through background script to avoid CORS
        return new Promise((resolve, reject) => {
            browser.runtime.sendMessage({
                type: 'sendToAPI',
                apiKey: apiKey,
                requestBody: requestBody,
                provider: provider,
                opencodeConfig,
                pageKey: getPageSessionKey()
            }, (response) => {
                if (browser.runtime.lastError) {
                    reject(new Error(browser.runtime.lastError.message));
                } else if (response.success) {
                    resolve(response.text);
                } else {
                    reject(new Error(response.error || 'Request failed'));
                }
            });
        });
    }

    // Handle send
    async function handleSend() {
        const input = document.getElementById('ai-chatbox-input');
        const text = input.value.trim();

        if (!text && !currentImageBase64) {
            return;
        }

        if (text) {
            addMessage(text, true);
        }
        if (currentImageBase64) {
            addMessage('[Image attached]', true);
        }

        input.value = '';

        addLoadingIndicator();

        try {
            const response = await sendToAI(text, currentImageBase64, currentImageMimeType);
            removeLoadingIndicator();
            addMessage(response, false);
            removeImage();
        } catch (error) {
            removeLoadingIndicator();
            addMessage('Error: ' + error.message, false);
        }
    }

    // Handle quiz screenshot: capture page, send to AI with quiz prompt
    async function handleQuizScreenshot() {
        addMessage('📸 Screenshot sent — answering quiz…', true);
        addLoadingIndicator();

        try {
            // Hide the chat UI so it doesn't appear in the screenshot
            chatbox.style.display = 'none';
            aiButton.style.display = 'none';
            // Allow a frame to repaint before capturing
            await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

            let captured;
            try {
                captured = await new Promise((resolve, reject) => {
                    browser.runtime.sendMessage({ type: 'captureTab' }, (response) => {
                        if (browser.runtime.lastError) {
                            reject(new Error(browser.runtime.lastError.message));
                        } else if (response && response.success) {
                            resolve(response);
                        } else {
                            reject(new Error((response && response.error) || 'Screenshot failed'));
                        }
                    });
                });
            } finally {
                // Always restore the UI — clear inline style so the .open CSS class controls display
                chatbox.style.display = '';
                aiButton.style.display = '';
            }

            const quizPrompt = `You are a precise quiz-answering assistant. Your only job is to find and answer the question visible in this screenshot.

RULES — follow them exactly, no exceptions:
1. Do NOT describe, summarize, or comment on the screenshot.
2. Scan the screenshot for a question (quiz, test, exercise, form field, etc.).
3. If NO question is found → respond with exactly: no question found
4. If a MULTIPLE-CHOICE or SINGLE-CHOICE question is found → respond with ONLY the letter or number of the correct option (e.g. "B" or "3"). No explanation.
5. If any OTHER type of question is found (fill-in, short answer, calculation, etc.) → respond with the shortest correct answer only. No explanation, no full sentences unless the answer itself is a sentence.

Begin.`;
            const response = await sendToAI(quizPrompt, captured.base64, captured.mimeType);
            removeLoadingIndicator();
            addMessage(response, false);
        } catch (error) {
            removeLoadingIndicator();
            addMessage('Error: ' + error.message, false);
        }
    }

    // Load saved settings
    async function loadSettings() {
        const { key, provider, model, opencodeUrl, opencodePassword, opacity, btnOpacity, chatWidth, chatHeight } = await getApiKey();
        if (key) document.getElementById('ai-sync-key').value = key;
        document.getElementById('ai-opencode-url').value = normalizeOpenCodeUrl(opencodeUrl);
        document.getElementById('ai-opencode-password').value = opencodePassword || '';
        const resolvedProvider = provider || 'gemini';
        currentProvider = resolvedProvider;
        document.getElementById('ai-provider-select').value = resolvedProvider;
        updateProviderSettingsUI(resolvedProvider);
        await populateModels(resolvedProvider, model, {
            opencodeUrl: normalizeOpenCodeUrl(opencodeUrl),
            opencodePassword: opencodePassword || ''
        });

        const pct = Math.round(opacity * 100);
        document.getElementById('ai-opacity-slider').value = pct;
        document.getElementById('ai-opacity-value').textContent = pct + '%';
        applyChatOpacity(opacity);

        const btnPct = Math.round(btnOpacity * 100);
        document.getElementById('ai-btn-opacity-slider').value = btnPct;
        document.getElementById('ai-btn-opacity-value').textContent = btnPct + '%';
        applyButtonOpacity(btnOpacity);

        applyChatSize(chatWidth, chatHeight);
    }

    async function autoSave() {
        const key      = document.getElementById('ai-sync-key').value.trim();
        const provider = document.getElementById('ai-provider-select').value;
        const model    = document.getElementById('ai-model-select').value;
        const opencodeUrl = normalizeOpenCodeUrl(document.getElementById('ai-opencode-url').value);
        const opencodePassword = document.getElementById('ai-opencode-password').value;
        const opacity  = parseInt(document.getElementById('ai-opacity-slider').value) / 100;
        const btnOp    = parseInt(document.getElementById('ai-btn-opacity-slider').value) / 100;
        const chatWidth  = chatbox.offsetWidth  || 320;
        const chatHeight = chatbox.offsetHeight || 480;
        await saveApiKey(key, provider, model, opencodeUrl, opencodePassword, opacity, btnOp, chatWidth, chatHeight);
    }

    // Event listeners  (click handled by mouseup drag logic above)

    // Keyboard shortcut: Alt+C toggles the chatbox
    document.addEventListener('keydown', function(e) {
        if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyC') {
            const active = document.activeElement;
            const tag = active && active.tagName.toLowerCase();
            // Don't hijack the shortcut when typing in an input/textarea/select/editor
            // UNLESS the focused element is inside our own chatbox (e.g. settings panel)
            const insideChatbox = active && chatbox.contains(active);
            if (!insideChatbox && (tag === 'input' || tag === 'textarea' || tag === 'select'
                || (active && active.isContentEditable))) return;
            e.preventDefault();
            toggleChatbox();
        }
    });

    // Keyboard shortcut: Alt+Q — screenshot & answer quiz
    document.addEventListener('keydown', function(e) {
        if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'KeyQ') {
            const active = document.activeElement;
            const tag = active && active.tagName.toLowerCase();
            const insideChatbox = active && chatbox.contains(active);
            if (!insideChatbox && (tag === 'input' || tag === 'textarea' || tag === 'select'
                || (active && active.isContentEditable))) return;
            e.preventDefault();
            handleQuizScreenshot();
        }
    });

    chatbox.querySelector('.ai-chatbox-close').addEventListener('click', closeChatbox);

    document.getElementById('ai-settings-toggle').addEventListener('click', toggleSettings);

    // Provider change: repopulate models then auto-save
    document.getElementById('ai-provider-select').addEventListener('change', async () => {
        const provider = document.getElementById('ai-provider-select').value;
        updateProviderSettingsUI(provider);
        await populateModels(provider, null);
        await autoSave();
    });

    document.getElementById('ai-model-select').addEventListener('change', () => autoSave());

    document.getElementById('ai-sync-key').addEventListener('blur', () => autoSave());
    document.getElementById('ai-opencode-password').addEventListener('blur', async () => {
        const settings = {
            opencodeUrl: normalizeOpenCodeUrl(document.getElementById('ai-opencode-url').value),
            opencodePassword: document.getElementById('ai-opencode-password').value
        };
        await autoSave();
        opencodeModelCache = { key: '', models: [] };
        if (document.getElementById('ai-provider-select').value === 'opencode') {
            await populateModels('opencode', document.getElementById('ai-model-select').value, settings);
        }
    });
    document.getElementById('ai-opencode-url').addEventListener('blur', async () => {
        const settings = {
            opencodeUrl: normalizeOpenCodeUrl(document.getElementById('ai-opencode-url').value),
            opencodePassword: document.getElementById('ai-opencode-password').value
        };
        await autoSave();
        opencodeModelCache = { key: '', models: [] };
        if (document.getElementById('ai-provider-select').value === 'opencode') {
            await populateModels('opencode', document.getElementById('ai-model-select').value, settings);
        }
    });

    document.getElementById('ai-opacity-slider').addEventListener('input', (e) => {
        const pct = parseInt(e.target.value);
        document.getElementById('ai-opacity-value').textContent = pct + '%';
        applyChatOpacity(pct / 100);
        autoSave();
    });

    document.getElementById('ai-btn-opacity-slider').addEventListener('input', (e) => {
        const pct = parseInt(e.target.value);
        document.getElementById('ai-btn-opacity-value').textContent = pct + '%';
        applyButtonOpacity(pct / 100);
        autoSave();
    });
    
    document.getElementById('ai-chatbox-send').addEventListener('click', handleSend);

    document.getElementById('ai-quiz-screenshot-btn').addEventListener('click', handleQuizScreenshot);

    document.getElementById('ai-chatbox-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    document.getElementById('ai-remove-image').addEventListener('click', removeImage);

    // Drag and drop handlers
    const dropzone = document.getElementById('ai-dropzone');
    
    dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('dragover');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleImageFile(files[0]);
        }
    });

    // Click to select image
    dropzone.addEventListener('click', (e) => {
        if (e.target.id === 'ai-remove-image' || e.target.closest('#ai-remove-image')) {
            return;
        }
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.onchange = (e) => {
            if (e.target.files.length > 0) {
                handleImageFile(e.target.files[0]);
            }
        };
        fileInput.click();
    });

    // Paste from clipboard
    document.addEventListener('paste', (e) => {
        if (!isOpen) return;
        
        const items = e.clipboardData.items;
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                handleImageFile(file);
                break;
            }
        }
    });

    // Load settings on init
    loadSettings();
    loadKaTeX();

    // Measure settings panel height once so min height is always at least that tall
    // Must temporarily show the chatbox (it's display:none), else offsetHeight = 0
    (function measureSettingsHeight() {
        const panel = document.getElementById('ai-settings-panel');
        const header = chatbox.querySelector('.ai-chatbox-header');
        const boxPrev = { display: chatbox.style.display, visibility: chatbox.style.visibility };
        const panPrev = { display: panel.style.display,   visibility: panel.style.visibility };
        chatbox.style.visibility = 'hidden';
        chatbox.style.display    = 'flex';
        panel.style.visibility   = 'hidden';
        panel.style.display      = 'block';
        const headerH = header ? header.offsetHeight : 41;
        const measured = headerH + panel.offsetHeight + 16;
        if (measured > 100) _settingsMinH = measured; // only override fallback if measurement is valid
        chatbox.style.display    = boxPrev.display;
        chatbox.style.visibility = boxPrev.visibility;
        panel.style.display      = panPrev.display;
        panel.style.visibility   = panPrev.visibility;
    })();

    // Listen for reset message from popup
    browser.runtime.onMessage.addListener((msg) => {
        if (msg.type === 'quizScreenshot') {
            handleQuizScreenshot();
            return;
        }
        if (msg.type === 'resetPosition') {
            browser.storage.local.remove(POS_KEY);
            const c = clamp(window.innerWidth - 38, window.innerHeight - 38);
            applyPos(c.left, c.top);
            applyChatSize(320, 480);
            // Reset opacity defaults: chat 95%, button 25%
            applyChatOpacity(0.95);
            document.getElementById('ai-opacity-slider').value = 95;
            document.getElementById('ai-opacity-value').textContent = '95%';
            applyButtonOpacity(0.25);
            document.getElementById('ai-btn-opacity-slider').value = 25;
            document.getElementById('ai-btn-opacity-value').textContent = '25%';
        }
    });

    console.log('Quick Notes: Initialized');
})();

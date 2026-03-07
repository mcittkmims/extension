// @ts-nocheck

export function createOverlay() {
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

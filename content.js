// Quick Notes - Study Helper - Content Script
(function() {
    'use strict';

    // Check if we've already injected
    if (document.getElementById('moodle-ai-assistant-btn')) {
        return;
    }

    // Find the aside element
    const aside = document.getElementById('block-region-side-pre');
    if (!aside) {
        console.log('Quick Notes: Side panel not found');
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
    aiButton.title = 'Clipboard';

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
            <label for="ai-sync-key">Sync Token</label>
            <input type="password" id="ai-sync-key" placeholder="Enter token...">
            <div class="settings-hint">Token for clipboard sync</div>
            <button id="ai-save-settings">Save</button>
        </div>
        <div class="ai-chatbox-messages">
            <div class="ai-message ai-assistant">
                <p>Paste content or drop an image.</p>
            </div>
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
            <textarea class="ai-chatbox-input" id="ai-chatbox-input" placeholder="Add a note or question..." rows="2"></textarea>
            <button class="ai-chatbox-send" id="ai-chatbox-send" title="Send">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="22" y1="2" x2="11" y2="13"></line>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                </svg>
            </button>
        </div>
        <div class="ai-chatbox-status" id="ai-chatbox-status"></div>
    `;

    // Insert elements at the bottom of the sidebar
    aside.appendChild(chatbox);
    aside.appendChild(aiButton);

    // State
    let isOpen = false;
    let settingsOpen = false;
    let currentImageBase64 = null;
    let currentImageMimeType = null;

    // Toggle chatbox
    function toggleChatbox() {
        isOpen = !isOpen;
        chatbox.classList.toggle('open', isOpen);
        aiButton.classList.toggle('active', isOpen);
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

    // Add message to chat
    function addMessage(text, isUser = false) {
        const messagesContainer = chatbox.querySelector('.ai-chatbox-messages');
        const messageDiv = document.createElement('div');
        messageDiv.className = `ai-message ${isUser ? 'ai-user' : 'ai-assistant'}`;
        messageDiv.innerHTML = `<p>${escapeHtml(text)}</p>`;
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

    // Update status
    function updateStatus(message, isError = false) {
        const status = document.getElementById('ai-chatbox-status');
        status.textContent = message;
        status.className = 'ai-chatbox-status' + (isError ? ' error' : '');
        if (message) {
            setTimeout(() => {
                status.textContent = '';
            }, 5000);
        }
    }

    // Handle image file
    function handleImageFile(file) {
        if (!file.type.startsWith('image/')) {
            updateStatus('Please drop an image file', true);
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
            updateStatus('Image attached. Add a note and press Enter.');
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

    // Get API key from storage (disguised as "sync key")
    async function getApiKey() {
        return new Promise((resolve) => {
            browser.storage.local.get('geminiApiKey', (result) => {
                resolve(result.geminiApiKey || null);
            });
        });
    }

    // Save API key
    async function saveApiKey(key) {
        return new Promise((resolve) => {
            browser.storage.local.set({ geminiApiKey: key }, () => {
                resolve();
            });
        });
    }

    // Send request to Gemini API
    async function sendToGemini(text, imageBase64 = null, imageMimeType = null) {
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('Sync key not configured. Click ⚙️ to set up.');
        }

        const contents = [];
        const parts = [];

        // System instruction - always prepended
        const instruction = 'IMPORTANT: Respond with ONLY the correct answer. No explanation, no reasoning, no additional text. Just the answer itself (letter, number, word, or short phrase).';

        // Add instruction first as text
        parts.push({ text: instruction });

        // Add image if present
        if (imageBase64 && imageMimeType) {
            parts.push({
                inline_data: {
                    mime_type: imageMimeType,
                    data: imageBase64
                }
            });
        }

        // Add user's question/text if provided
        if (text) {
            parts.push({ text: 'Question: ' + text });
        } else if (imageBase64) {
            parts.push({ text: 'What is the correct answer to this question shown in the image?' });
        }

        contents.push({ parts: parts });

        const requestBody = {
            contents: contents,
            generationConfig: {
                temperature: 0.1,
                topK: 1,
                topP: 0.8,
                maxOutputTokens: 256
            }
        };

        // Send request through background script to avoid CORS
        return new Promise((resolve, reject) => {
            browser.runtime.sendMessage({
                type: 'sendToAPI',
                apiKey: apiKey,
                requestBody: requestBody
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
            updateStatus('Please enter a note or add an image', true);
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
        updateStatus('Processing...');

        try {
            const response = await sendToGemini(text, currentImageBase64, currentImageMimeType);
            removeLoadingIndicator();
            addMessage(response, false);
            updateStatus('');
            
            removeImage();
        } catch (error) {
            removeLoadingIndicator();
            addMessage('Error: ' + error.message, false);
            updateStatus(error.message, true);
        }
    }

    // Load saved API key into settings
    async function loadSettings() {
        const apiKey = await getApiKey();
        if (apiKey) {
            document.getElementById('ai-sync-key').value = apiKey;
        }
    }

    // Event listeners
    aiButton.addEventListener('click', toggleChatbox);
    
    chatbox.querySelector('.ai-chatbox-close').addEventListener('click', closeChatbox);
    
    document.getElementById('ai-settings-toggle').addEventListener('click', toggleSettings);
    
    document.getElementById('ai-save-settings').addEventListener('click', async () => {
        const keyInput = document.getElementById('ai-sync-key');
        const key = keyInput.value.trim();
        if (key) {
            await saveApiKey(key);
            updateStatus('Settings saved!');
            toggleSettings();
        } else {
            updateStatus('Please enter a sync key', true);
        }
    });
    
    document.getElementById('ai-chatbox-send').addEventListener('click', handleSend);
    
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

    console.log('Quick Notes: Initialized');
})();

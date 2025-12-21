// Clipboard Manager - Popup script
document.addEventListener('DOMContentLoaded', function() {
    const apiKeyInput = document.getElementById('apiKey');
    const saveBtn = document.getElementById('saveBtn');
    const status = document.getElementById('status');
    const currentKey = document.getElementById('currentKey');

    // Load existing clipboard item (API key)
    browser.storage.local.get('geminiApiKey', function(result) {
        if (result.geminiApiKey) {
            const maskedKey = result.geminiApiKey.substring(0, 8) + '••••••••••••' + result.geminiApiKey.slice(-4);
            currentKey.textContent = maskedKey;
        }
    });

    // Save clipboard item (API key)
    saveBtn.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();

        if (!apiKey) {
            showStatus('Please enter text to save', 'error');
            return;
        }

        // Basic validation
        if (apiKey.length < 20) {
            showStatus('Text too short to save', 'error');
            return;
        }

        browser.storage.local.set({ geminiApiKey: apiKey }, function() {
            showStatus('Saved to clipboard!', 'success');
            const maskedKey = apiKey.substring(0, 8) + '••••••••••••' + apiKey.slice(-4);
            currentKey.textContent = maskedKey;
            apiKeyInput.value = '';
        });
    });

    // Handle Enter key
    apiKeyInput.addEventListener('keydown', function(e) {
        if (e.key === 'Enter') {
            saveBtn.click();
        }
    });

    function showStatus(message, type) {
        status.textContent = message;
        status.className = 'status ' + type;
        
        setTimeout(function() {
            status.className = 'status';
        }, 3000);
    }
});

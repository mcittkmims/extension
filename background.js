// Quick Notes - Study Helper - Background script
// Handles extension lifecycle, storage, and API requests

browser.runtime.onInstalled.addListener(function(details) {
    if (details.reason === 'install') {
        console.log('Quick Notes: Extension installed');
    } else if (details.reason === 'update') {
        console.log('Quick Notes: Extension updated');
    }
});

// Handle messages from content scripts
browser.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.type === 'getSyncKey') {
        browser.storage.local.get('geminiApiKey', function(result) {
            sendResponse({ syncKey: result.geminiApiKey || null });
        });
        return true;
    }
    
    // Handle API requests from content script (to avoid CORS)
    if (request.type === 'sendToAPI') {
        const { apiKey, requestBody } = request;
        
        fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            }
        )
        .then(response => {
            if (!response.ok) {
                return response.json().then(err => {
                    throw new Error(err.error?.message || `Request failed: ${response.status}`);
                });
            }
            return response.json();
        })
        .then(data => {
            if (data.candidates && data.candidates[0] && data.candidates[0].content) {
                const textPart = data.candidates[0].content.parts.find(p => p.text);
                if (textPart) {
                    sendResponse({ success: true, text: textPart.text });
                } else {
                    sendResponse({ success: false, error: 'No text in response' });
                }
            } else {
                sendResponse({ success: false, error: 'No response generated' });
            }
        })
        .catch(error => {
            sendResponse({ success: false, error: error.message });
        });
        
        return true; // Keep the message channel open for async response
    }
});

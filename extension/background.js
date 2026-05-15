// background.js
console.log('[Opal] Background script initialized');

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // Get the ID of the tab that sent the message
    const tabId = sender.tab ? sender.tab.id : null;
    
    console.log('[Opal] Received message:', request.type, request.domain, 'Tab:', tabId);

    if (request.type === 'CHECK_BLOCK') {
        fetch(`http://127.0.0.1:9000/check?domain=${encodeURIComponent(request.domain)}&tabId=${tabId}`)
            .then(res => res.json())
            .then(data => sendResponse(data))
            .catch(err => sendResponse({ error: err.message, blocked: false }));
        return true; 
    }

    if (request.type === 'WHITELIST') {
        fetch(`http://127.0.0.1:9000/__opal_whitelist?domain=${encodeURIComponent(request.domain)}&tabId=${tabId}`)
            .then(() => sendResponse({ success: true }))
            .catch(err => sendResponse({ error: err.message }));
        return true;
    }

    if (request.type === 'CLOSE_TAB') {
        if (sender.tab && sender.tab.id) {
            chrome.tabs.remove(sender.tab.id);
        }
        return;
    }
});

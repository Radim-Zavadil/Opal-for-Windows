// overlay.js
const params = new URLSearchParams(window.location.search);
const domain = params.get('domain');

document.getElementById('btn-continue').addEventListener('click', () => {
    // Tell background script to whitelist this domain
    chrome.runtime.sendMessage({ type: 'WHITELIST', domain: domain }, () => {
        // Reload the parent window
        window.parent.postMessage('RELOAD_TOP', '*');
    });
});

document.getElementById('btn-close').addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'CLOSE_TAB' });
});

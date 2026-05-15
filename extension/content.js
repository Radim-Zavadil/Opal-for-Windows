(function() {
    const domain = window.location.hostname;
    if (!domain || domain === '127.0.0.1' || domain === 'localhost') return;

    // Immediately hide the page
    const hideStyle = document.createElement('style');
    hideStyle.id = 'opal-hide-style';
    hideStyle.innerHTML = 'html { display: none !important; }';
    document.documentElement.appendChild(hideStyle);

    // Ask background script to check if this domain is blocked
    chrome.runtime.sendMessage({ type: 'CHECK_BLOCK', domain: domain }, (response) => {
        if (chrome.runtime.lastError || !response || response.error || !response.blocked) {
            removeHideStyle();
            return;
        }

        // It is blocked!
        showOverlay(domain);
    });

    function showOverlay(domain) {
        const overlay = document.createElement('div');
        overlay.id = 'opal-block-overlay';
        overlay.style.cssText = 'position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:2147483647; background:#000;';
        
        const iframe = document.createElement('iframe');
        iframe.src = chrome.runtime.getURL(`overlay.html?domain=${encodeURIComponent(domain)}`);
        iframe.style.cssText = 'width:100%; height:100%; border:none; background:#000;';
        overlay.appendChild(iframe);
        
        document.documentElement.appendChild(overlay);

        // Listen for messages from the iframe (Dismiss/Close)
        window.addEventListener('message', (event) => {
            if (event.data === 'RELOAD_TOP') {
                window.location.reload();
            } else if (event.data === 'CLOSE_TOP') {
                window.location.href = 'about:blank';
            }
        });

        // Small delay to ensure overlay is painted
        setTimeout(removeHideStyle, 100);
    }

    function removeHideStyle() {
        const s = document.getElementById('opal-hide-style');
        if (s) s.remove();
    }
})();

const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { app, shell } = require('electron');
const psList = require('ps-list');
const execAsync = util.promisify(exec);

class Blocker {
  constructor() {
    this.activeInterval = null;
    this.dismissedTabs = new Map(); // tabId -> Set of domains
    this.currentSites = [];
    this.currentApps = [];
    this.server = null;
    
    this.activeOverlays = new Set(); 
    this.dismissedPids = new Map(); // appName -> Set of pids that were dismissed
  }

  async start(sites, apps, onBlockedAppDetected) {
    this.dismissedTabs.clear();
    this.currentSites = (sites || []).map(s => this.normalizeDomain(s));
    this.currentApps = (apps || []).map(a => a.toLowerCase());
    this.activeOverlays.clear();
    this.dismissedPids.clear();

    // 1. App Blocking (ps-list loop)
    if (this.currentApps.length > 0) {
      this.startAppBlocking(onBlockedAppDetected);
    }

    // 2. Website Blocking (Local HTTP Server for Extension)
    await this.startHttpServer();
  }

  async stop() {
    this.stopAppBlocking();
    this.stopHttpServer();
    this.dismissedTabs.clear();
    this.currentSites = [];
    this.currentApps = [];
    this.activeOverlays = new Set();
    this.dismissedPids = new Map();
  }

  temporarilyAllow(domain, tabId) {
    const normalized = this.normalizeDomain(domain);
    if (!tabId) return;
    if (!this.dismissedTabs.has(tabId)) {
      this.dismissedTabs.set(tabId, new Set());
    }
    this.dismissedTabs.get(tabId).add(normalized);
  }

  dismissApp(appName, pids) {
    if (!this.dismissedPids.has(appName.toLowerCase())) {
      this.dismissedPids.set(appName.toLowerCase(), new Set());
    }
    const set = this.dismissedPids.get(appName.toLowerCase());
    pids.forEach(pid => set.add(pid));
    this.setOverlayShown(appName, false);
  }

  isShowingOverlay(appName) {
    return this.activeOverlays.has(appName.toLowerCase());
  }

  setOverlayShown(appName, shown) {
    if (shown) {
      this.activeOverlays.add(appName.toLowerCase());
    } else {
      this.activeOverlays.delete(appName.toLowerCase());
    }
  }

  // --- App Blocker (Existing logic preserved) ---

  startAppBlocking(onBlockedAppDetected) {
    this.stopAppBlocking();
    this.activeInterval = setInterval(async () => {
      try {
        const processes = await psList();
        
        for (const [appName, pids] of this.dismissedPids.entries()) {
          for (const pid of pids) {
            if (!processes.some(p => p.pid === pid)) {
              pids.delete(pid);
            }
          }
        }

        for (const app of this.currentApps) {
          if (this.activeOverlays.has(app)) continue;

          const appPids = processes
            .filter(p => p.name.toLowerCase() === app || p.name.toLowerCase() === (app + '.exe'))
            .map(p => p.pid);

          if (appPids.length > 0) {
            const dismissedSet = this.dismissedPids.get(app) || new Set();
            const hasNewPid = appPids.some(pid => !dismissedSet.has(pid));

            if (hasNewPid) {
              onBlockedAppDetected(app, appPids);
            }
          }
        }
      } catch (err) {
        console.error('App blocking poll error:', err);
      }
    }, 1000);
  }

  stopAppBlocking() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
  }

  // --- Website Blocker (New HTTP Server logic) ---

  async startHttpServer() {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const domain = url.searchParams.get('domain');
      
      console.log(`[Server] ${req.method} ${url.pathname} for ${domain}`);

      // Enable CORS
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      if (url.pathname === '/check') {
        const tabId = url.searchParams.get('tabId');
        const normalized = this.normalizeDomain(domain);
        
        const tabDismissedItems = this.dismissedTabs.get(tabId) || new Set();
        
        const isBlocked = this.currentSites.some(site => 
          (normalized === site || normalized.endsWith('.' + site)) && !tabDismissedItems.has(site)
        );
        
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ blocked: isBlocked }));
      }
      else if (url.pathname.startsWith('/images/')) {
        const imageName = path.basename(url.pathname);
        const imagePath = path.join(__dirname, '..', 'assets', 'images', imageName);
        if (fs.existsSync(imagePath)) {
          res.writeHead(200, { 'Content-Type': 'image/png' });
          const stream = fs.createReadStream(imagePath);
          stream.pipe(res);
          return;
        }
        res.writeHead(404);
        res.end();
      }
      else if (url.pathname === '/interrupt-html') {
        const html = this.getWebSafeInterruptHtml(domain);
        res.writeHead(200, { 
          'Content-Type': 'text/html',
          'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(html);
      }
      else if (url.pathname === '/__opal_whitelist') {
        const tabId = url.searchParams.get('tabId');
        if (domain && tabId) {
          this.temporarilyAllow(domain, tabId);
        }
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      }
      else {
        res.writeHead(404);
        res.end();
      }
    });

    this.server.listen(9000, '127.0.0.1', () => {
      console.log('Opal Local Server listening on http://127.0.0.1:9000');
    });
  }

  stopHttpServer() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }

  getWebSafeInterruptHtml(domain) {
    try {
      let html = fs.readFileSync(path.join(__dirname, '..', 'assets', 'interrupt.html'), 'utf8');
      
      // Fix image paths to point to our local server
      html = html.replace(/src="images\//g, 'src="http://127.0.0.1:9000/images/');
      
      // Replace the Electron-specific script with a browser-safe one
      const browserScript = `
      <script>
        // Browser-safe overrides for Opal Extension
        const btnDismiss = document.getElementById('btn-continue');
        const btnClose = document.getElementById('btn-close');

        if (btnDismiss) {
          btnDismiss.innerText = 'Dismiss';
          btnDismiss.addEventListener('click', (e) => {
            e.preventDefault();
            fetch('http://127.0.0.1:9000/__opal_whitelist?domain=${domain}')
              .then(() => {
                window.top.location.reload();
              });
          });
        }

        if (btnClose) {
          btnClose.innerText = 'Close Tab';
          btnClose.addEventListener('click', (e) => {
            e.preventDefault();
            window.top.location.href = 'about:blank';
          });
        }

        // Hide desktop-only elements
        const dragArea = document.querySelector('.drag-area');
        if (dragArea) dragArea.style.display = 'none';
      </script>
      `;
      
      // Find the <script> tag and replace it
      html = html.replace(/<script>[\s\S]*?<\/script>/, browserScript);
      
      // Also fix any relative paths for images if needed
      // (Assuming assets are served via server or images are external)
      return html;
    } catch (e) {
      return `<h1>Site Blocked</h1><p>${domain} is blocked by Opal.</p>`;
    }
  }

  // --- Extension Helpers ---

  async launchChromeWithExtension() {
    const extensionPath = path.join(__dirname, '..', 'extension');
    const command = `start chrome --load-extension="${extensionPath}"`;
    try {
      await execAsync(command);
    } catch (e) {
      console.error('Failed to launch Chrome:', e);
    }
  }

  isExtensionInstalled() {
    const destDir = path.join(app.getPath('userData'), 'opal-extension');
    return fs.existsSync(path.join(destDir, 'manifest.json'));
  }

  async installExtension() {
    const srcDir = path.join(__dirname, '..', 'extension');
    const destDir = path.join(app.getPath('userData'), 'opal-extension');

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.copyFileSync(path.join(srcDir, 'manifest.json'), path.join(destDir, 'manifest.json'));
    fs.copyFileSync(path.join(srcDir, 'content.js'), path.join(destDir, 'content.js'));

    shell.showItemInFolder(path.join(destDir, 'manifest.json'));
    
    if (process.platform === 'win32') {
      // cmd /c start is often more reliable for internal protocols
      exec('cmd /c start chrome chrome://extensions');
    }
    
    return true;
  }

  async uninstallExtension() {
    const destDir = path.join(app.getPath('userData'), 'opal-extension');
    if (fs.existsSync(destDir)) {
      fs.rmSync(destDir, { recursive: true, force: true });
    }
    
    if (process.platform === 'win32') {
      exec('cmd /c start chrome chrome://extensions');
    }

    return true;
  }

  normalizeDomain(domain) {
    if (!domain) return '';
    return domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split(/[/?#]/)[0].toLowerCase();
  }
}

module.exports = new Blocker();
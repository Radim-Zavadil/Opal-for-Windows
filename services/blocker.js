const fs = require('fs');
const { exec } = require('child_process');

class Blocker {
  constructor() {
    this.hostsPath = process.platform === 'win32' 
      ? 'C:\\Windows\\System32\\drivers\\etc\\hosts' 
      : '/etc/hosts';
    this.activeInterval = null;
    this.START_MARKER = '# FOCUS START';
    this.END_MARKER = '# FOCUS END';
    
    this.allowedItems = new Set();
    this.currentSites = [];
    this.currentApps = [];

    // Cleanup any stale blocks on startup
    this.unblockSites();
  }

  start(sites, apps, onBlockedAppDetected) {
    this.allowedItems.clear();
    this.currentSites = [...(sites || [])];
    this.currentApps = [...(apps || [])];

    if (this.currentSites.length > 0) {
      this.blockSites(this.currentSites);
    }
    
    if (this.currentApps.length > 0 || this.currentSites.length > 0) {
      this.startAppBlocking(onBlockedAppDetected);
    }
  }

  stop() {
    this.unblockSites();
    this.stopAppBlocking();
    this.allowedItems.clear();
    this.currentSites = [];
    this.currentApps = [];
  }

  temporarilyAllow(item) {
    this.allowedItems.add(item);
    
    // If it's a site (doesn't end in .exe), remove from active block list and update hosts
    if (!item.toLowerCase().endsWith('.exe')) {
      this.currentSites = this.currentSites.filter(s => s !== item);
      this.blockSites(this.currentSites); // re-generates the host file without the allowed site
    }
  }

  blockSites(sites) {
    try {
      let content = fs.readFileSync(this.hostsPath, 'utf8');
      content = this.removeBlockFromContent(content);

      if (sites.length > 0) {
        let blockEntries = `\n${this.START_MARKER}\n`;
        sites.forEach(site => {
           const domain = site.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
           blockEntries += `127.0.0.1 ${domain}\n`;
           blockEntries += `127.0.0.1 www.${domain}\n`;
        });
        blockEntries += `${this.END_MARKER}\n`;
        fs.writeFileSync(this.hostsPath, content + blockEntries, 'utf8');
      } else {
        fs.writeFileSync(this.hostsPath, content, 'utf8');
      }
      this.flushDNS();
    } catch (error) {
       console.error('Failed to write to hosts file.', error);
    }
  }

  unblockSites() {
    try {
      let content = fs.readFileSync(this.hostsPath, 'utf8');
      let newContent = this.removeBlockFromContent(content);
      
      if (content !== newContent) {
        fs.writeFileSync(this.hostsPath, newContent, 'utf8');
        this.flushDNS();
      }
    } catch (error) {
       console.error('Failed to restore hosts file.', error);
    }
  }

  removeBlockFromContent(content) {
    const startIdx = content.indexOf(this.START_MARKER);
    const endIdx = content.indexOf(this.END_MARKER);
    
    if (startIdx !== -1 && endIdx !== -1) {
      return content.slice(0, startIdx) + content.slice(endIdx + this.END_MARKER.length + 1);
    }
    return content;
  }

  flushDNS() {
    if (process.platform === 'win32') {
      exec('ipconfig /flushdns', (err) => {});
    }
  }

  startAppBlocking(onBlockedAppDetected) {
    this.stopAppBlocking();
    this.activeInterval = setInterval(() => {
      this.checkApps(onBlockedAppDetected);
    }, 2500);
  }

  stopAppBlocking() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
  }

  checkApps(onBlockedAppDetected) {
    if (process.platform === 'win32') {
      exec('tasklist /V /FO CSV /NH', (err, stdout) => {
        if (err || !stdout) return;
        
        let detected = null;
        const processLines = stdout.toLowerCase().split('\n');

        // Check apps
        for (let app of this.currentApps) {
          if (this.allowedItems.has(app)) continue;
          
          const searchName = app.toLowerCase().endsWith('.exe') ? app.toLowerCase() : app.toLowerCase() + '.exe';
          if (stdout.toLowerCase().includes(`"${searchName}"`)) {
            detected = app;
            break;
          }
        }

        // Check sites
        if (!detected && this.currentSites.length > 0) {
          for (let line of processLines) {
             const columns = line.split('","');
             if (columns.length > 8) {
               const windowTitle = columns[columns.length - 1] || "";
               for (let site of this.currentSites) {
                 if (this.allowedItems.has(site)) continue;

                 const domainName = site.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
                 if (windowTitle.includes(domainName.toLowerCase())) {
                   detected = site;
                   break;
                 }
               }
             }
             if (detected) break;
          }
        }

        if (detected && onBlockedAppDetected) {
          onBlockedAppDetected(detected);
        }
      });
    }
  }
}

module.exports = new Blocker();

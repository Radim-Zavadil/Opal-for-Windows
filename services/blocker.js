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
  }

  start(sites, apps, onBlockedAppDetected) {
    if (sites && sites.length > 0) {
      this.blockSites(sites);
    }
    
    if (apps && apps.length > 0) {
      this.startAppBlocking(apps, onBlockedAppDetected);
    }
  }

  stop() {
    this.unblockSites();
    this.stopAppBlocking();
  }

  blockSites(sites) {
    try {
      let content = fs.readFileSync(this.hostsPath, 'utf8');
      
      // Clean up previous blocks just in case
      content = this.removeBlockFromContent(content);

      let blockEntries = `\n${this.START_MARKER}\n`;
      sites.forEach(site => {
        // block both raw and www
        const domain = site.replace(/^https?:\/\//, '').replace(/\/.*$/, '');
        blockEntries += `127.0.0.1 ${domain}\n`;
        blockEntries += `127.0.0.1 www.${domain}\n`;
      });
      blockEntries += `${this.END_MARKER}\n`;

      fs.writeFileSync(this.hostsPath, content + blockEntries, 'utf8');
      this.flushDNS();
    } catch (error) {
      console.error('Failed to write to hosts file. App needs to run as Administrator.', error);
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
      exec('ipconfig /flushdns', (err) => {
        if (err) console.error('Failed to flush DNS:', err);
      });
    } else if (process.platform === 'darwin') {
      exec('sudo killall -HUP mDNSResponder', (err) => {
        if (err) console.error('Failed to flush DNS:', err);
      });
    }
  }

  startAppBlocking(apps, onBlockedAppDetected) {
    this.stopAppBlocking(); // prevent duplicate
    this.activeInterval = setInterval(() => {
      this.checkApps(apps, onBlockedAppDetected);
    }, 2500);
  }

  stopAppBlocking() {
    if (this.activeInterval) {
      clearInterval(this.activeInterval);
      this.activeInterval = null;
    }
  }

  checkApps(blockedApps, onBlockedAppDetected) {
    if (process.platform === 'win32') {
      exec('tasklist /FO CSV /NH', (err, stdout) => {
        if (err) return;
        
        // Find if any blocked app is running
        for (let app of blockedApps) {
          // ensure app ends with .exe for matching (naive check)
          const searchName = app.toLowerCase().endsWith('.exe') ? app.toLowerCase() : app.toLowerCase() + '.exe';
          if (stdout.toLowerCase().includes(`"${searchName}"`)) {
            if (onBlockedAppDetected) {
              onBlockedAppDetected(app);
            }
            break; // Stop after first match to just show the interrupt
          }
        }
      });
    } else {
      // Stub for macOS (using ps aux) if needed later, 
      // but prompt asked specifically for Windows desktop app.
    }
  }
}

module.exports = new Blocker();

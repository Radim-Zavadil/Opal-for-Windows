const fs = require('fs');
const os = require('os');
const path = require('path');

class Config {
  constructor() {
    this.configPath = path.join(os.homedir(), '.focus-mode.json');
    this.data = this.load();
  }

  load() {
    if (fs.existsSync(this.configPath)) {
      try {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      } catch (e) {
        console.error('Error reading config:', e);
      }
    }
    return this.getDefaultConfig();
  }

  save() {
    try {
      fs.writeFileSync(this.configPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (e) {
      console.error('Error writing config:', e);
    }
  }

  getDefaultConfig() {
    return {
      sites: [],
      apps: [],
      defaultDuration: 3600,
      templates: [
        { name: 'Work Time', desc: 'Weekdays, 9:00 AM - 5:00 PM', icon: '💻' },
        { name: 'Morning', desc: 'Every day, 6:00 AM - 9:00 AM', icon: '☀️' },
        { name: 'Deep Work Hour', desc: 'Every day, 2:00 PM - 3:00 PM', icon: '🕯️' },
        { name: 'Wind Down', desc: 'Weekdays, 5:00 PM - 6:00 PM', icon: '🛋️' },
        { name: 'Good Sleep, Good Life', desc: 'Every day, 10:30 PM - 6:30 AM', icon: '🛏️' }
      ]
    };
  }
}

module.exports = new Config();

const http = require('http');
const fs = require('fs');
const path = require('path');

class Server {
  constructor() {
    this.server = null;
    this.port = 80;
  }

  start() {
    if (this.server) return;

    this.server = http.createServer((req, res) => {
      const blockPagePath = path.join(__dirname, '../assets/blockpage.html');
      
      fs.readFile(blockPagePath, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'text/plain' });
          res.end('Internal Server Error: Missing blockpage.html');
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(data);
      });
    });

    this.server.listen(this.port, '127.0.0.1', () => {
      console.log(`Block page server listening on 127.0.0.1:${this.port}`);
    });
    
    this.server.on('error', (e) => {
      console.error('Server error (Are you running as Admin?): ', e.message);
      this.server = null;
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = new Server();

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const fs = require('fs');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/'
});

app.use(express.json());

const PORT = process.env.PORT || 3001;
const SHELL = 'bash';

const TERMINAL_BASE_DIR = path.resolve(__dirname, 'terminal');

if (!fs.existsSync(TERMINAL_BASE_DIR)) {
  fs.mkdirSync(TERMINAL_BASE_DIR, { recursive: true });
}

app.post('/api/terminal/create-dir', (req, res) => {
  const { folderName } = req.body;
  if (!folderName || typeof folderName !== 'string') {
    return res.status(400).json({ error: 'Invalid folderName' });
  }
  const safeName = folderName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const targetDir = path.join(TERMINAL_BASE_DIR, safeName);
  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    res.json({ success: true, path: targetDir, relativePath: `/terminal/${safeName}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

io.on('connection', (socket) => {
  const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '127.0.0.1';

  const customPS1 = `\\[\\e[36m\\]╭┈┈┈┈┈┈\\[\\e[0m\\][\\[\\e[1;37m\\] Ubuntu \\[\\e[32m\\]${clientIP}\\[\\e[37m\\] ]\\n\\[\\e[36m\\]╰─∘\\[\\e[0m\\] terminal \\[\\e[33m\\]@${clientIP}\\[\\e[0m\\] \\$ `;

  const ptyProcess = pty.spawn(SHELL, ['--norc', '--noprofile', '-i'], {
    name: 'xterm-256color',
    cols: 90,
    rows: 30,
    cwd: TERMINAL_BASE_DIR,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PS1: customPS1
    }
  });

  let buffer = '';

  ptyProcess.onData((data) => {
    socket.emit('terminal:data', data);
  });

  socket.on('terminal:input', (data) => {
    if (data === '\r') {
      const cmd = buffer.trim();
      if (cmd === 'clear') {
        buffer = '';
        socket.emit('terminal:data', '\x1b[2J\x1b[3J\x1b[H');
        ptyProcess.write('\x0c');
        return;
      }
      if (cmd === 'clear --force') {
        buffer = '';
        socket.emit('terminal:data', '\x1b[2J\x1b[3J\x1b[H');
        ptyProcess.write('\x0c');
        return;
      }
      buffer = '';
    } else if (data === '\u007f') {
      buffer = buffer.slice(0, -1);
    } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
      buffer += data;
    }
    if (ptyProcess) ptyProcess.write(data);
  });

  socket.on('terminal:set-folder', (folderName) => {
    if (!folderName || typeof folderName !== 'string') return;
    const safeName = folderName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const targetDir = path.join(TERMINAL_BASE_DIR, safeName);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }
    const cdCmd = `cd "${targetDir}"\r`;
    ptyProcess.write(cdCmd);
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    try { ptyProcess.resize(cols, rows); } catch (err) {}
  });

  socket.on('disconnect', () => {
    try { ptyProcess.kill(); } catch (e) {}
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Terminal server started on port ${PORT}`);
});

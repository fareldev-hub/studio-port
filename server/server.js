const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const fs = require('fs');
const figlet = require('figlet');

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/'
});

const PORT = process.env.PORT || 3001;
const SHELL = 'bash';
const FINAL_CWD = path.resolve(__dirname, '..', 'port_terminal');

function getValidCwd() {
    if (fs.existsSync(FINAL_CWD)) return FINAL_CWD;
    return path.resolve(__dirname, '..'); 
}

const WORKING_DIR = getValidCwd();

function generateBanner() {
    const logo = figlet.textSync('ThePort', {
        font: 'Standard',
        horizontalLayout: 'default',
        verticalLayout: 'default'
    });
    
    const width = 50;
    const line = '─'.repeat(width);
    
    return `\x1b[36m${logo}\x1b[0m\r\n` +
           `Made by \x1b[1mFarelDev\x1b[0m\r\n` +
           `Tiktok : \x1b[35m@logic__vibes\x1b[0m\r\n` +
           `Web    : \x1b[34mfareldev.vercel.app\x1b[0m\r\n\r\n` +
           `Jika membutuhkan bantuan silahkan ketik "\x1b[33mhelp\x1b[0m"\r\n` +
           `\x1b[90m${line}\x1b[0m\r\n`;
}

io.on('connection', (socket) => {
  const clientIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '127.0.0.1';
  
  const customPS1 = `\\[\\e[36m\\]╭┈┈┈┈┈┈\\[\\e[0m\\]\\[\\e[1;37m\\][ Ubuntu \\[\\e[32m\\]${clientIP}\\[\\e[37m\\] ]\r\n\\[\\e[36m\\]╰─∘\\[\\e[0m\\] \\[\\e[1;34m\\]\\W\\[\\e[0m\\] \\[\\e[33m\\]@${clientIP}\\[\\e[0m\\] \\$ `;

  const ptyProcess = pty.spawn(SHELL, ['--norc', '--noprofile', '-i'], {
    name: 'xterm-256color',
    cols: 90,
    rows: 30,
    cwd: WORKING_DIR,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PS1: customPS1
    }
  });

  socket.emit('terminal:data', '\x1b[2J\x1b[H' + generateBanner());
  
  let currentCommand = '';

  ptyProcess.onData((data) => {
    socket.emit('terminal:data', data);
  });

  socket.on('terminal:input', (data) => {
    if (data === '\r') {
        const cmd = currentCommand.trim();
        if (cmd === 'clear') {
            socket.emit('terminal:data', '\x1b[2J\x1b[H' + generateBanner());
            currentCommand = '';
            ptyProcess.write('\x03\r'); 
            return;
        } 
        if (cmd === 'clear --force') {
            socket.emit('terminal:data', '\x1b[2J\x1b[H');
            currentCommand = '';
            ptyProcess.write('\x03\r');
            return;
        }
        currentCommand = '';
    } else if (data === '\u007f') {
        currentCommand = currentCommand.slice(0, -1);
    } else {
        currentCommand += data;
    }
    if (ptyProcess) ptyProcess.write(data);
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
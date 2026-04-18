/**
 * CodeStudio Express.js Backend Server
 * 
 * Features:
 * - Linux terminal via node-pty (real PTY with full shell access)
 * - Socket.IO for real-time terminal communication
 * - Static file serving for the frontend
 * - CORS enabled for development
 * 
 * Prerequisites:
 * - Node.js 16+ 
 * - Linux/macOS (for node-pty)
 * - On Windows: Use WSL2
 * 
 * Installation:
 *   cd server
 *   npm install
 * 
 * Start:
 *   npm start
 * 
 * The server runs on port 3001 by default.
 */

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

// Try to import node-pty, fallback to mock if unavailable
let pty;
try {
  pty = require('node-pty');
  console.log('[OK] node-pty loaded successfully');
} catch (err) {
  console.warn('[WARN] node-pty not available. Terminal will be limited.');
  console.warn('       Install with: npm install node-pty');
  console.warn('       On Linux/macOS: npm install node-pty');
  console.warn('       On Windows WSL: npm install node-pty');
  pty = null;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  path: '/socket.io/'
});

const PORT = process.env.PORT || 3001;
const HOST = process.env.HOST || '127.0.0.1';

// Shell configuration
const SHELL = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
const SHELL_ARGS = process.platform === 'win32' ? [] : ['--norc', '--noprofile', '-i'];

console.log(`[INFO] Platform: ${process.platform}`);
console.log(`[INFO] Shell: ${SHELL}`);
console.log(`[INFO] Home: ${os.homedir()}`);

// Store active PTY processes
const ptyProcesses = new Map();

// Get client IP helper
function getClientIP(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return socket.handshake.address || '127.0.0.1';
}

// Socket.IO connection handler
io.on('connection', (socket) => {
  const clientIP = getClientIP(socket);
  console.log(`[SOCKET] Client connected: ${socket.id} from ${clientIP}`);

  // Initialize PTY for this socket
  if (pty) {
    try {
      // Build the fancy ThePort prompt
      // Using ANSI: \001 = \[ \002 = \] for non-printing chars in PS1
      const C = '\x1b'; // ESC
      const CYAN  = `\x01${C}[36m\x02`;
      const RESET = `\x01${C}[0m\x02`;
      const BOLD  = `\x01${C}[1m\x02`;
      const DIM   = `\x01${C}[2m\x02`;

      // PS1 line 1: ╭┈┈┈┈┈┈❀[ @ <ip> | ThePort ]
      // PS1 line 2: ╰─∘ \w :
      const PS1 = `${CYAN}╭┈┈┈┈┈┈❀[${RESET} ${DIM}@${RESET} ${CYAN}${clientIP}${RESET} ${DIM}|${RESET} ${BOLD}${CYAN}ThePort${RESET} ${CYAN}]${RESET}\\n${CYAN}╰─∘${RESET} \\w ${CYAN}:${RESET} `;

      const ptyProcess = pty.spawn(SHELL, SHELL_ARGS, {
        name: 'xterm-color',
        cols: 120,
        rows: 30,
        cwd: os.homedir(),
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          LANG: 'en_US.UTF-8',
          PS1,
          PROMPT_COMMAND: '',
        }
      });

      ptyProcesses.set(socket.id, ptyProcess);

      // Forward PTY output to socket
      ptyProcess.onData((data) => {
        socket.emit('terminal:data', data);
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[PTY] Process exited: code=${exitCode}, signal=${signal}`);
        socket.emit('terminal:exit', { exitCode, signal });
      });

      // Forward socket input to PTY
      socket.on('terminal:input', (data) => {
        try {
          ptyProcess.write(data);
        } catch (err) {
          console.error('[PTY] Write error:', err.message);
        }
      });

      // Resize PTY
      socket.on('terminal:resize', ({ cols, rows }) => {
        try {
          ptyProcess.resize(cols, rows);
        } catch (err) {
          console.error('[PTY] Resize error:', err.message);
        }
      });

      // Send initial connection success
      socket.emit('terminal:connected', {
        shell: SHELL,
        platform: process.platform,
        hostname: os.hostname(),
        username: os.userInfo().username,
      });

      console.log(`[PTY] Spawned ${SHELL} for socket ${socket.id}`);

    } catch (err) {
      console.error(`[PTY] Failed to spawn: ${err.message}`);
      socket.emit('terminal:error', { message: 'Failed to spawn terminal process' });
    }
  } else {
    // No PTY available - send mock terminal
    socket.emit('terminal:connected', {
      shell: 'mock',
      platform: process.platform,
      hostname: os.hostname(),
      username: os.userInfo().username,
      mock: true,
    });

    // Send welcome message
    setTimeout(() => {
      socket.emit('terminal:data', 
        '\r\n\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m\r\n' +
        '\x1b[36m║\x1b[0m  \x1b[1mCodeStudio Terminal (Mock Mode)\x1b[0m                       \x1b[36m║\x1b[0m\r\n' +
        '\x1b[36m║\x1b[0m  \x1b[33mnode-pty is not installed. Limited functionality.\x1b[0m    \x1b[36m║\x1b[0m\r\n' +
        '\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m\r\n' +
        '\r\n' +
        '\x1b[90mInstall node-pty for full Linux terminal:\x1b[0m\r\n' +
        '\x1b[90m  npm install node-pty\x1b[0m\r\n' +
        '\r\n'
      );
    }, 500);

    // Handle mock commands
    let buffer = '';
    socket.on('terminal:input', (data) => {
      const code = data.charCodeAt(0);
      if (code === 13) { // Enter
        socket.emit('terminal:data', '\r\n');
        handleMockCommand(socket, buffer.trim());
        buffer = '';
      } else if (code === 127) { // Backspace
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          socket.emit('terminal:data', '\b \b');
        }
      } else if (code >= 32 && code < 127) {
        buffer += data;
        socket.emit('terminal:data', data);
      }
    });
  }

  // Disconnect handler
  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    const ptyProcess = ptyProcesses.get(socket.id);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (err) {
        // Process may already be dead
      }
      ptyProcesses.delete(socket.id);
    }
  });
});

function handleMockCommand(socket, cmd) {
  if (!cmd) {
    socket.emit('terminal:data', '\x1b[32mcodestudio\x1b[0m:\x1b[34m~\x1b[0m$ ');
    return;
  }
  
  const args = cmd.split(' ');
  const command = args[0].toLowerCase();
  
  switch (command) {
    case 'help':
      socket.emit('terminal:data', 
        '  \x1b[33mAvailable commands:\x1b[0m\r\n' +
        '    help     - Show this help message\r\n' +
        '    clear    - Clear the terminal\r\n' +
        '    echo     - Print text to terminal\r\n' +
        '    date     - Show current date and time\r\n' +
        '    whoami   - Show current user\r\n' +
        '    pwd      - Show working directory\r\n' +
        '    ls       - List directory contents\r\n' +
        '    uname    - Show system information\r\n' +
        '    node     - Node.js version info\r\n' +
        '    npm      - NPM version info\r\n' +
        '\r\n' +
        '  \x1b[90mInstall node-pty for full Linux terminal access.\x1b[0m\r\n'
      );
      break;
    case 'clear':
      socket.emit('terminal:data', '\x1b[2J\x1b[H');
      break;
    case 'echo':
      socket.emit('terminal:data', '  ' + args.slice(1).join(' ') + '\r\n');
      break;
    case 'date':
      socket.emit('terminal:data', '  ' + new Date().toString() + '\r\n');
      break;
    case 'whoami':
      socket.emit('terminal:data', '  ' + os.userInfo().username + '\r\n');
      break;
    case 'pwd':
      socket.emit('terminal:data', '  ' + os.homedir() + '\r\n');
      break;
    case 'ls':
      socket.emit('terminal:data', '  \x1b[34msrc\x1b[0m/  \x1b[34mpublic\x1b[0m/  package.json  README.md  .gitignore\r\n');
      break;
    case 'uname':
      socket.emit('terminal:data', '  ' + process.platform + ' ' + os.hostname() + ' ' + os.release() + ' ' + os.machine() + '\r\n');
      break;
    case 'node':
      socket.emit('terminal:data', '  ' + process.version + '\r\n');
      break;
    case 'npm':
      socket.emit('terminal:data', '  10.2.3\r\n');
      break;
    default:
      socket.emit('terminal:data', `  \x1b[31mCommand not found: ${command}\x1b[0m\r\n`);
      socket.emit('terminal:data', `  Type '\x1b[33mhelp\x1b[0m' for available commands\r\n`);
  }
  
  socket.emit('terminal:data', '\x1b[32mcodestudio\x1b[0m:\x1b[34m~\x1b[0m$ ');
}

// Serve static frontend files
const staticPath = path.join(__dirname, '../dist');
app.use(express.static(staticPath));

// API health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: process.platform,
    shell: SHELL,
    pty: !!pty,
    timestamp: new Date().toISOString(),
  });
});

// Serve index.html for all routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

// Start server
httpServer.listen(PORT, HOST, () => {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║  CodeStudio Server                                       ║');
  console.log('╠══════════════════════════════════════════════════════════╣');
  console.log(`║  HTTP:  http://${HOST}:${PORT}                             ║`);
  console.log(`║  WS:    ws://${HOST}:${PORT}/socket.io/                    ║`);
  console.log(`║  Shell: ${SHELL.padEnd(49)} ║`);
  console.log(`║  PTY:   ${pty ? 'Available' : 'Not Available (install node-pty)'.padEnd(49)} ║`);
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log('');
});

const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');

let pty;
try {
  pty = require('node-pty');
  console.log('[OK] node-pty loaded successfully');
} catch (err) {
  console.warn('[WARN] node-pty not available. Terminal will be limited.');
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

const SHELL = process.platform === 'win32' ? 'powershell.exe' : process.env.SHELL || '/bin/bash';
const SHELL_ARGS = process.platform === 'win32' ? [] : ['--norc', '--noprofile', '-i'];

console.log(`[INFO] Platform: ${process.platform}`);
console.log(`[INFO] Shell: ${SHELL}`);
console.log(`[INFO] Home: ${os.homedir()}`);

const ptyProcesses = new Map();

function getClientIP(socket) {
  const forwarded = socket.handshake.headers['x-forwarded-for'];
  if (forwarded) return forwarded.split(',')[0].trim();
  return socket.handshake.address || '127.0.0.1';
}

function generateThePortBanner() {
  const C = '\x1b[';
  const CYAN = `${C}36m`;
  const BLUE = `${C}34m`;
  const MAGENTA = `${C}35m`;
  const YELLOW = `${C}33m`;
  const GREEN = `${C}32m`;
  const RESET = `${C}0m`;
  const BOLD = `${C}1m`;

  const asciiArt = [
    ``,
    `${CYAN}║${RESET}  ${BOLD}${BLUE}████████╗${RESET}${MAGENTA}██╗  ██╗${RESET}${YELLOW}███████╗${RESET}${GREEN}██████╗  ${RESET}${CYAN}██████╗ ${RESET}${MAGENTA}██████╗ ${RESET}${YELLOW}████████╗${RESET}  ${CYAN}║${RESET}`,
    `${CYAN}║${RESET}  ${BOLD}${BLUE}╚══██╔══╝${RESET}${MAGENTA}██║  ██║${RESET}${YELLOW}██╔════╝${RESET}${GREEN}██╔══██╗${RESET}${CYAN}██╔═══██╗${RESET}${MAGENTA}██╔══██╗${RESET}${YELLOW}╚══██╔══╝${RESET}  ${CYAN}║${RESET}`,
    `${CYAN}║${RESET}  ${BOLD}${BLUE}   ██║   ${RESET}${MAGENTA}███████║${RESET}${YELLOW}█████╗  ${RESET}${GREEN}██████╔╝${RESET}${CYAN}██║   ██║${RESET}${MAGENTA}██████╔╝${RESET}${YELLOW}   ██║   ${RESET}  ${CYAN}║${RESET}`,
    `${CYAN}║${RESET}  ${BOLD}${BLUE}   ██║   ${RESET}${MAGENTA}██╔══██║${RESET}${YELLOW}██╔══╝  ${RESET}${GREEN}██╔═══╝ ${RESET}${CYAN}██║   ██║${RESET}${MAGENTA}██╔══██╗${RESET}${YELLOW}   ██║   ${RESET}  ${CYAN}║${RESET}`,
    `${CYAN}║${RESET}  ${BOLD}${BLUE}   ██║   ${RESET}${MAGENTA}██║  ██║${RESET}${YELLOW}███████╗${RESET}${GREEN}██║     ${RESET}${CYAN}╚██████╔╝${RESET}${MAGENTA}██║  ██║${RESET}${YELLOW}   ██║   ${RESET}  ${CYAN}║${RESET}`,
    `${CYAN}║${RESET}  ${BOLD}${BLUE}   ╚═╝   ${RESET}${MAGENTA}╚═╝  ╚═╝${RESET}${YELLOW}╚══════╝${RESET}${GREEN}╚═╝     ${RESET}${CYAN} ╚═════╝ ${RESET}${MAGENTA}╚═╝  ╚═╝${RESET}${YELLOW}   ╚═╝   ${RESET}  ${CYAN}║${RESET}`,
    ``
  ];

  return asciiArt.join('\r\n');
}

io.on('connection', (socket) => {
  const clientIP = getClientIP(socket);
  console.log(`[SOCKET] Client connected: ${socket.id} from ${clientIP}`);

  if (pty) {
    try {
      const C = '\\e[';
      const CYAN = `${C}36m`;
      const RESET = `${C}0m`;
      const BOLD = `${C}1m`;
      const DIM = `${C}2m`;

      const PS1 = `\\[${CYAN}\\]╭┈┈┈┈┈┈❀[\\[${RESET}\\] \\[${DIM}\\]@\\[${RESET}\\] \\[${CYAN}\\]${clientIP}\\[${RESET}\\] \\[${DIM}\\]|\\[${RESET}\\] \\[${BOLD}\\]\\[${CYAN}\\]ThePort\\[${RESET}\\] \\[${CYAN}\\]]\\[${RESET}\\]\\n\\[${CYAN}\\]╰─∘\\[${RESET}\\] \\w \\[${CYAN}\\]:\\[${RESET}\\] `;

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
          PS1: PS1,
          PROMPT_COMMAND: '',
        }
      });

      ptyProcesses.set(socket.id, ptyProcess);

      let bannerSent = false;
      let buffer = '';
      let isClearing = false;
      let pendingBanner = false;

      ptyProcess.onData((data) => {
        if (!bannerSent) {
          buffer += data;
          return;
        }

        if (isClearing) {
          if (data.includes('╭┈┈┈') || data.includes('╰─∘') || data.trim() === '') {
            return;
          }
          if (data.includes('\r') || data.includes('\n')) {
            return;
          }
          isClearing = false;
        }

        if (pendingBanner) {
          pendingBanner = false;
          const banner = generateThePortBanner();
          socket.emit('terminal:data', banner + '\r\n\r\n');
        }

        socket.emit('terminal:data', data);
      });

      setTimeout(() => {
        const clearScreen = '\x1b[2J\x1b[H';
        const banner = generateThePortBanner();
        const welcomeMsg = 'Welcome, ketik help jika butuh bantuan\r\n\r\n';
        
        socket.emit('terminal:data', clearScreen + banner + '\r\n\r\n' + welcomeMsg);
        
        setTimeout(() => {
          bannerSent = true;
          if (buffer) {
            const lines = buffer.split('\r\n');
            const cleanLines = lines.filter(line => {
              const trimmed = line.trim();
              if (!trimmed) return false;
              if (trimmed.includes('bash-')) return false;
              if (trimmed.includes('export PS1')) return false;
              if (trimmed.startsWith('[') && trimmed.includes(']')) return false;
              return true;
            });
            if (cleanLines.length > 0) {
              socket.emit('terminal:data', cleanLines.join('\r\n') + '\r\n');
            }
          }
        }, 200);
      }, 500);

      ptyProcess.onExit(({ exitCode, signal }) => {
        console.log(`[PTY] Process exited: code=${exitCode}, signal=${signal}`);
        socket.emit('terminal:exit', { exitCode, signal });
      });

      socket.on('terminal:input', (data) => {
        try {
          if (data === '\r') {
            const currentLine = buffer.split('\r\n').pop() || '';
            const command = currentLine.replace(/^\s*[\$\#]\s*/, '').replace(/^╭┈┈┈.*?\n╰─∘.*?/, '').trim();
            
            if (command === 'clear') {
              isClearing = true;
              pendingBanner = true;
            }
          }
          
          ptyProcess.write(data);
        } catch (err) {
          console.error('[PTY] Write error:', err.message);
        }
      });

      socket.on('terminal:resize', ({ cols, rows }) => {
        try {
          ptyProcess.resize(cols, rows);
        } catch (err) {
          console.error('[PTY] Resize error:', err.message);
        }
      });

      socket.emit('terminal:connected', {
        shell: SHELL,
        platform: process.platform,
        hostname: os.hostname(),
        username: os.userInfo().username,
        silent: true
      });

      console.log(`[PTY] Spawned ${SHELL} for socket ${socket.id}`);

    } catch (err) {
      console.error(`[PTY] Failed to spawn: ${err.message}`);
      socket.emit('terminal:error', { message: 'Failed to spawn terminal process' });
    }
  } else {
    socket.emit('terminal:connected', {
      shell: 'mock',
      platform: process.platform,
      hostname: os.hostname(),
      username: os.userInfo().username,
      mock: true,
      silent: true
    });

    let isClearing = false;
    let pendingBanner = false;
    let currentInput = '';
    
    setTimeout(() => {
      const clearScreen = '\x1b[2J\x1b[H';
      const banner = generateThePortBanner();
      socket.emit('terminal:data', clearScreen + banner + '\r\n\r\n\x1b[32mcodestudio\x1b[0m:\x1b[34m~\x1b[0m$ ');
    }, 500);

    let buffer = '';
    socket.on('terminal:input', (data) => {
      const code = data.charCodeAt(0);
      if (code === 13) {
        if (currentInput.trim() === 'clear') {
          isClearing = true;
          pendingBanner = true;
          socket.emit('terminal:data', '\r\n');
          
          setTimeout(() => {
            const banner = generateThePortBanner();
            socket.emit('terminal:data', banner + '\r\n\r\n\x1b[32mcodestudio\x1b[0m:\x1b[34m~\x1b[0m$ ');
            isClearing = false;
            pendingBanner = false;
          }, 50);
          
          buffer = '';
          currentInput = '';
          return;
        }
        
        currentInput = '';
        socket.emit('terminal:data', '\r\n');
        handleMockCommand(socket, buffer.trim());
        buffer = '';
      } else if (code === 127) {
        if (buffer.length > 0) {
          buffer = buffer.slice(0, -1);
          currentInput = currentInput.slice(0, -1);
          socket.emit('terminal:data', '\b \b');
        }
      } else if (code >= 32 && code < 127) {
        buffer += data;
        currentInput += data;
        socket.emit('terminal:data', data);
      }
    });
  }

  socket.on('disconnect', () => {
    console.log(`[SOCKET] Client disconnected: ${socket.id}`);
    const ptyProcess = ptyProcesses.get(socket.id);
    if (ptyProcess) {
      try {
        ptyProcess.kill();
      } catch (err) {
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
        '    clear    - Clear the terminal but keep banner\r\n' +
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

const staticPath = path.join(__dirname, '../dist');
app.use(express.static(staticPath));

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: process.platform,
    shell: SHELL,
    pty: !!pty,
    timestamp: new Date().toISOString(),
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(staticPath, 'index.html'));
});

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
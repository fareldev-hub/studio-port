import { useEffect, useRef, useState } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onClose: () => void;
  onToggle: () => void;
}

export function Terminal({ onClose, onToggle }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new XTerm({
      theme: {
        background: '#0a0a0a',
        foreground: '#e0e0e0',
        cursor: '#4fc1ff',
        selectionBackground: '#1e3a5f',
        selectionForeground: '#e0e0e0',
        black: '#0d0d0d',
        red: '#f44747',
        green: '#4ec9b0',
        yellow: '#dcdcaa',
        blue: '#4fc1ff',
        magenta: '#c586c0',
        cyan: '#4ec9b0',
        white: '#e0e0e0',
        brightBlack: '#555555',
        brightRed: '#f44747',
        brightGreen: '#4ec9b0',
        brightYellow: '#dcdcaa',
        brightBlue: '#4fc1ff',
        brightMagenta: '#c586c0',
        brightCyan: '#4ec9b0',
        brightWhite: '#ffffff',
      },
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 13,
      cursorBlink: true,
      cursorStyle: 'block',
      scrollback: 10000,
      convertEol: true,
      allowTransparency: false,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    // Try to connect to Express backend via WebSocket
    const connectToBackend = () => {
      try {
        // Detect if we're running on the same origin or need to connect elsewhere
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const host = window.location.host; // Will work when served by Express
        const wsUrl = `${protocol}//${host}/socket.io/?EIO=4&transport=websocket`;

        const socket = new WebSocket(wsUrl);
        socketRef.current = socket;

        socket.onopen = () => {
          console.log('[Terminal] Connected to Express backend');
          setIsConnected(true);
          setShowOffline(false);
        };

        socket.onmessage = (event) => {
          try {
            // Socket.IO messages start with a number
            const data = event.data;
            if (typeof data === 'string' && data.startsWith('42')) {
              // Engine.IO packet type 4 = message, 2 = event
              const jsonStr = data.slice(2);
              const [eventName, payload] = JSON.parse(jsonStr);

              if (eventName === 'terminal:data' && typeof payload === 'string') {
                term.write(payload);
              } else if (eventName === 'terminal:connected') {
                setIsConnected(true);
                setShowOffline(false);
                // Clear the initial offline message
                term.clear();
              } else if (eventName === 'terminal:error') {
                term.writeln(`\r\n\x1b[31m[Error] ${payload.message}\x1b[0m\r\n`);
              }
            }
          } catch {
            // Ignore non-JSON messages
          }
        };

        socket.onclose = () => {
          console.log('[Terminal] Disconnected from backend');
          setIsConnected(false);
          // Show offline message after a delay
          setTimeout(() => setShowOffline(true), 1000);
        };

        socket.onerror = () => {
          setIsConnected(false);
        };

        // Handle terminal input
        term.onData((data) => {
          if (socket.readyState === WebSocket.OPEN) {
            // Send as Socket.IO event
            socket.send(`42["terminal:input",${JSON.stringify(data)}]`);
          }
        });

      } catch {
        setShowOffline(true);
      }
    };

    // Try to connect to backend
    connectToBackend();

    // If no backend, show local shell
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      setupLocalShell(term);
    }

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      if (socketRef.current?.readyState === WebSocket.OPEN) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          socketRef.current.send(
            `42["terminal:resize",${JSON.stringify({ cols: dims.cols, rows: dims.rows })}]`
          );
        }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (socketRef.current) {
        socketRef.current.close();
      }
      term.dispose();
    };
  }, []);

  // Local shell fallback when backend is not connected
  function setupLocalShell(term: XTerm) {
    let currentLine = '';
    const prompt = '\x1b[32mcodestudio\x1b[0m:\x1b[34m~\x1b[0m$ ';

    term.clear();
    term.writeln('\x1b[36m╔══════════════════════════════════════════════════════════╗\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m  \x1b[1mCodeStudio Terminal\x1b[0m                                    \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m║\x1b[0m  \x1b[90mFrontend Shell (Express server not connected)\x1b[0m           \x1b[36m║\x1b[0m');
    term.writeln('\x1b[36m╚══════════════════════════════════════════════════════════╝\x1b[0m');
    term.writeln('');
    term.writeln('\x1b[90mTo enable full Linux terminal, start the backend:\x1b[0m');
    term.writeln('\x1b[90m  cd server && npm install && npm start\x1b[0m');
    term.writeln('');
    term.write(prompt);

    term.onData((data) => {
      // Only handle if not connected to backend
      if (isConnected) return;

      const code = data.charCodeAt(0);

      if (code === 13) {
        term.writeln('');
        handleLocalCommand(term, currentLine.trim());
        currentLine = '';
        term.write(prompt);
      } else if (code === 127) {
        if (currentLine.length > 0) {
          currentLine = currentLine.slice(0, -1);
          term.write('\b \b');
        }
      } else if (code >= 32 && code < 127) {
        currentLine += data;
        term.write(data);
      }
    });
  }

  function handleLocalCommand(term: XTerm, cmd: string) {
    if (!cmd) return;
    const args = cmd.split(' ');
    const command = args[0].toLowerCase();

    switch (command) {
      case 'help':
        term.writeln('  \x1b[33mAvailable commands:\x1b[0m');
        term.writeln('    help     - Show this help message');
        term.writeln('    clear    - Clear the terminal');
        term.writeln('    echo     - Print text to terminal');
        term.writeln('    date     - Show current date and time');
        term.writeln('    whoami   - Show current user');
        term.writeln('    pwd      - Show working directory');
        term.writeln('    ls       - List directory contents');
        term.writeln('    uname    - Show system information');
        term.writeln('    node     - Node.js version info');
        term.writeln('    npm      - NPM version info');
        term.writeln('');
        term.writeln('  \x1b[90mStart the Express server for full Linux terminal:\x1b[0m');
        term.writeln('  \x1b[90m  cd server && npm install && npm start\x1b[0m');
        break;
      case 'clear':
        term.clear();
        break;
      case 'echo':
        term.writeln('  ' + args.slice(1).join(' '));
        break;
      case 'date':
        term.writeln('  ' + new Date().toString());
        break;
      case 'whoami':
        term.writeln('  developer');
        break;
      case 'pwd':
        term.writeln('  /home/developer/project');
        break;
      case 'ls':
        term.writeln('  \x1b[34msrc\x1b[0m/  \x1b[34mpublic\x1b[0m/  package.json  README.md  .gitignore');
        break;
      case 'uname':
        term.writeln('  Linux codestudio 5.15.0 x86_64 GNU/Linux');
        break;
      case 'node':
        term.writeln('  v20.10.0');
        break;
      case 'npm':
        term.writeln('  10.2.3');
        break;
      default:
        term.writeln(`  \x1b[31mCommand not found: ${command}\x1b[0m`);
        term.writeln(`  Type '\x1b[33mhelp\x1b[0m' for available commands`);
    }
  }

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-terminal)' }}>
      {/* Terminal Header */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 28,
          backgroundColor: 'var(--bg-titlebar)',
          borderBottom: '1px solid var(--border-primary)',
        }}
      >
        <div className="flex items-center gap-2">
          <span
            className="font-semibold uppercase"
            style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.06em' }}
          >
            Terminal
          </span>
          {isConnected && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--accent-green)', color: '#0d0d0d', fontSize: 9 }}
            >
              LIVE
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ActionButton icon="fa-plus" title="New Terminal" onClick={() => {}} />
          <ActionButton icon="fa-trash-can" title="Clear" onClick={() => xtermRef.current?.clear()} />
          <ActionButton
            icon={isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'}
            title="Toggle Size"
            onClick={() => {
              setIsExpanded(!isExpanded);
              onToggle();
            }}
          />
          <ActionButton icon="fa-xmark" title="Close" onClick={onClose} />
        </div>
      </div>

      {/* Terminal Body */}
      <div className="flex-1 relative overflow-hidden">
        {showOffline && (
          <div
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-1"
            style={{ backgroundColor: 'rgba(244, 71, 71, 0.1)', borderBottom: '1px solid var(--accent-red)' }}
          >
            <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--accent-red)' }}>
              <i className="fa-solid fa-circle-xmark" style={{ fontSize: 10 }} />
              Terminal server offline. Start the Express backend for full Linux access.
            </span>
          </div>
        )}
        <div ref={terminalRef} className="absolute inset-0 p-2" />
      </div>
    </div>
  );
}

function ActionButton({ icon, title, onClick }: { icon: string; title: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="p-1 rounded transition-colors"
      style={{ color: 'var(--text-muted)' }}
      title={title}
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)';
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: 12 }} />
    </button>
  );
}

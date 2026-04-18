import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onClose: () => void;
  onToggle: () => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function Terminal({ onClose, onToggle, onConnectionChange }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');

  const updateConnection = useCallback((connected: boolean) => {
    setIsConnected(connected);
    onConnectionChange?.(connected);
    setConnectionStatus(connected ? 'connected' : 'offline');
  }, [onConnectionChange]);

  const connectToBackend = useCallback((term: XTerm, fitAddon: FitAddon) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/socket.io/?EIO=4&transport=websocket`;

    let socket: WebSocket;
    try {
      socket = new WebSocket(wsUrl);
    } catch {
      updateConnection(false);
      return;
    }

    socketRef.current = socket;

    socket.onopen = () => {
      console.log('[Terminal] WebSocket opened, waiting for Engine.IO handshake');
    };

    socket.onmessage = (event) => {
      const data = event.data as string;

      if (data === '2') {
        socket.send('3');
        return;
      }

      if (data.startsWith('0')) {
        socket.send('40');
        return;
      }

      if (data.startsWith('40')) {
        console.log('[Terminal] Socket.IO connected to backend');
        updateConnection(true);

        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        heartbeatTimerRef.current = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send('3');
          }
        }, 25000);
        return;
      }

      if (data.startsWith('42')) {
        try {
          const jsonStr = data.slice(2);
          const [eventName, payload] = JSON.parse(jsonStr);

          if (eventName === 'terminal:data' && typeof payload === 'string') {
            term.write(payload);
          } else if (eventName === 'terminal:connected') {
            updateConnection(true);
            term.clear();
            const shellName = payload?.shell || 'bash';
            const isPty = !payload?.mock;
            term.writeln(`\x1b[32m[Connected]\x1b[0m Real Linux terminal via \x1b[36m${shellName}\x1b[0m ${isPty ? '(PTY)' : '(mock)'}`);
            term.writeln('');
          } else if (eventName === 'terminal:error') {
            term.writeln(`\r\n\x1b[31m[Error] ${payload?.message || 'Unknown error'}\x1b[0m\r\n`);
          } else if (eventName === 'terminal:exit') {
            term.writeln(`\r\n\x1b[33m[Process exited]\x1b[0m`);
          }
        } catch {
          // ignore malformed
        }
      }
    };

    socket.onclose = () => {
      console.log('[Terminal] WebSocket closed');
      updateConnection(false);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);

      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = setTimeout(() => {
        if (xtermRef.current && fitAddonRef.current) {
          term.writeln('\r\n\x1b[33m[Reconnecting...]\x1b[0m');
          connectToBackend(term, fitAddonRef.current);
        }
      }, 3000);
    };

    socket.onerror = () => {
      updateConnection(false);
    };

    term.onData((inputData) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(`42["terminal:input",${JSON.stringify(inputData)}]`);
      }
    });

    const handleResize = () => {
      fitAddon.fit();
      if (socket.readyState === WebSocket.OPEN) {
        const dims = fitAddon.proposeDimensions();
        if (dims) {
          socket.send(`42["terminal:resize",${JSON.stringify({ cols: dims.cols, rows: dims.rows })}]`);
        }
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [updateConnection]);

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
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
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

    const cleanup = connectToBackend(term, fitAddon);

    return () => {
      cleanup?.();
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      term.dispose();
    };
  }, []);

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
          {connectionStatus === 'connected' && (
            <span
              className="text-xs px-1.5 py-0.5 rounded flex items-center gap-1"
              style={{ backgroundColor: 'var(--accent-green)', color: '#0d0d0d', fontSize: 9 }}
            >
              <span
                className="inline-block rounded-full"
                style={{ width: 5, height: 5, backgroundColor: '#0d0d0d' }}
              />
              LIVE · Linux PTY
            </span>
          )}
          {connectionStatus === 'connecting' && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--accent-yellow)', color: '#0d0d0d', fontSize: 9 }}
            >
              CONNECTING
            </span>
          )}
          {connectionStatus === 'offline' && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'var(--accent-red)', color: '#fff', fontSize: 9 }}
            >
              OFFLINE
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
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
        {connectionStatus === 'offline' && (
          <div
            className="absolute top-0 left-0 right-0 z-10 flex items-center justify-center py-1"
            style={{ backgroundColor: 'rgba(244, 71, 71, 0.1)', borderBottom: '1px solid var(--accent-red)' }}
          >
            <span className="text-xs flex items-center gap-1.5" style={{ color: 'var(--accent-red)' }}>
              <i className="fa-solid fa-circle-xmark" style={{ fontSize: 10 }} />
              Backend offline — reconnecting…
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

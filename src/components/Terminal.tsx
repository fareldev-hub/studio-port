import { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface TerminalProps {
  onClose: () => void;
  onToggle: () => void;
  onConnectionChange?: (connected: boolean) => void;
  isExpanded?: boolean;
}

export function Terminal({ onClose, onToggle, onConnectionChange, isExpanded: externalIsExpanded }: TerminalProps) {
  const terminalRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const hasReceivedBannerRef = useRef<boolean>(false);
  
  const [isExpanded, setIsExpanded] = useState(externalIsExpanded || false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (externalIsExpanded !== undefined) {
      setIsExpanded(externalIsExpanded);
    }
  }, [externalIsExpanded]);

  const updateConnection = useCallback((connected: boolean) => {
    setIsConnected(connected);
    onConnectionChange?.(connected);
    setConnectionStatus(connected ? 'connected' : 'offline');
  }, [onConnectionChange]);

  const resizeTerminal = useCallback(() => {
    if (!fitAddonRef.current || !xtermRef.current || !containerRef.current) return;
    
    try {
      fitAddonRef.current.fit();
      const dims = fitAddonRef.current.proposeDimensions();
      if (dims && socketRef.current?.readyState === WebSocket.OPEN) {
        socketRef.current.send(`42["terminal:resize",${JSON.stringify({ cols: dims.cols, rows: dims.rows })}]`);
      }
      
      const rect = containerRef.current.getBoundingClientRect();
      setDimensions({ width: Math.round(rect.width), height: Math.round(rect.height) });
    } catch (err) {
      console.warn('[Terminal] Resize error:', err);
    }
  }, []);

  const connectToBackend = useCallback((term: XTerm, fitAddon: FitAddon) => {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    hasReceivedBannerRef.current = false;

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
        
        setTimeout(resizeTerminal, 100);
        return;
      }

      if (data.startsWith('42')) {
        try {
          const jsonStr = data.slice(2);
          const [eventName, payload] = JSON.parse(jsonStr);

          if (eventName === 'terminal:data' && typeof payload === 'string') {
            // Cek apakah ini banner ThePort (mengandung karakteristik logo)
            if (payload.includes('████████╗') || payload.includes('ThePort')) {
              hasReceivedBannerRef.current = true;
            }
            term.write(payload);
          } else if (eventName === 'terminal:connected') {
            updateConnection(true);
            // TAMBAHAN: Jangan tampilkan pesan "[Connected]..." jika sudah ada banner
            // atau jika payload.silent === true
            if (!payload?.silent && !hasReceivedBannerRef.current) {
              term.clear();
              const shellName = payload?.shell || 'bash';
              const isPty = !payload?.mock;
              term.writeln(`\x1b[32m[Connected]\x1b[0m Real Linux terminal via \x1b[36m${shellName}\x1b[0m ${isPty ? '(PTY)' : '(mock)'}`);
              term.writeln('');
            }
            // Jika silent atau sudah ada banner, tidak perlu tampilkan apa-apa
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
      hasReceivedBannerRef.current = false;
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

    return () => {};
  }, [updateConnection, resizeTerminal]);

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
      rows: 24,
      cols: 80,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    xtermRef.current = term;
    fitAddonRef.current = fitAddon;

    if (containerRef.current && 'ResizeObserver' in window) {
      resizeObserverRef.current = new ResizeObserver((entries) => {
        window.requestAnimationFrame(() => {
          if (entries.length > 0) {
            resizeTerminal();
          }
        });
      });
      resizeObserverRef.current.observe(containerRef.current);
    }

    const handleWindowResize = () => {
      resizeTerminal();
    };
    window.addEventListener('resize', handleWindowResize);

    connectToBackend(term, fitAddon);

    const initialResizeTimer = setTimeout(() => {
      resizeTerminal();
    }, 100);

    return () => {
      clearTimeout(initialResizeTimer);
      window.removeEventListener('resize', handleWindowResize);
      if (resizeObserverRef.current) {
        resizeObserverRef.current.disconnect();
      }
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
      if (socketRef.current) {
        socketRef.current.onclose = null;
        socketRef.current.close();
      }
      term.dispose();
    };
  }, []);

  useEffect(() => {
    if (xtermRef.current && fitAddonRef.current) {
      const timer = setTimeout(() => {
        resizeTerminal();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isExpanded, resizeTerminal]);

  const handleToggle = () => {
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    onToggle();
  };

  return (
    <div 
      ref={containerRef}
      className="flex flex-col w-full h-full min-h-0" 
      style={{ 
        backgroundColor: 'var(--bg-terminal)',
        position: 'relative',
        overflow: 'hidden'
      }}
    >
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 32,
          background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)',
          borderBottom: '1px solid #2a2a2a',
          flexShrink: 0,
        }}
      >
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-1">
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: '#f44747', opacity: 0.8 }} />
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: '#dcdcaa', opacity: 0.8 }} />
            <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: '#4ec9b0', opacity: 0.8 }} />
          </div>

          <span style={{ color: '#555', fontSize: 11, margin: '0 2px' }}>|</span>

          <i className="fa-solid fa-terminal" style={{ color: 'var(--accent-blue)', fontSize: 11 }} />
          <span
            className="font-semibold"
            style={{ color: 'var(--text-secondary)', fontSize: 11, letterSpacing: '0.06em' }}
          >
            bash — ThePort Studio
          </span>

          {connectionStatus === 'connected' && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(78,201,176,0.15)', border: '1px solid rgba(78,201,176,0.3)', fontSize: 9 }}
            >
              <span
                className="inline-block rounded-full animate-pulse"
                style={{ width: 5, height: 5, backgroundColor: 'var(--accent-green)' }}
              />
              <span style={{ color: 'var(--accent-green)' }}>LIVE · PTY</span>
            </span>
          )}
          {connectionStatus === 'connecting' && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(220,220,170,0.12)', border: '1px solid rgba(220,220,170,0.25)', color: 'var(--accent-yellow)', fontSize: 9 }}
            >
              CONNECTING…
            </span>
          )}
          {connectionStatus === 'offline' && (
            <span
              className="px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(244,71,71,0.12)', border: '1px solid rgba(244,71,71,0.3)', color: 'var(--accent-red)', fontSize: 9 }}
            >
              OFFLINE
            </span>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          <ActionButton icon="fa-trash-can" title="Clear terminal" onClick={() => xtermRef.current?.clear()} />
          <ActionButton
            icon={isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'}
            title={isExpanded ? "Minimize" : "Maximize"}
            onClick={handleToggle}
          />
          <ActionButton icon="fa-xmark" title="Close terminal" onClick={onClose} />
        </div>
      </div>

      {connectionStatus === 'offline' && (
        <div
          className="flex items-center justify-center gap-1.5 py-1 flex-shrink-0"
          style={{ 
            backgroundColor: 'rgba(244, 71, 71, 0.08)', 
            borderBottom: '1px solid rgba(244,71,71,0.2)',
            flexShrink: 0,
          }}
        >
          <i className="fa-solid fa-circle-xmark" style={{ color: 'var(--accent-red)', fontSize: 10 }} />
          <span className="text-xs" style={{ color: 'var(--accent-red)' }}>Backend offline — reconnecting in 3s…</span>
        </div>
      )}

      <div 
        className="flex-1 relative min-h-0" 
        style={{ 
          position: 'relative',
          overflow: 'hidden',
          paddingBottom: '12px',
        }}
      >
        <div 
          ref={terminalRef} 
          className="absolute inset-0"
          style={{
            padding: '8px',
            paddingBottom: '20px',
            width: '100%',
            height: '100%',
          }}
        />
      </div>
      
      <div 
        className="flex-shrink-0"
        style={{
          height: '8px',
          backgroundColor: 'var(--bg-terminal)',
          borderTop: '1px solid #1a1a1a',
        }}
      />
      
      {process.env.NODE_ENV === 'development' && (
        <div 
          className="flex-shrink-0 px-2 py-1 text-xs"
          style={{ 
            backgroundColor: '#1a1a1a', 
            borderTop: '1px solid #2a2a2a',
            color: '#666',
            fontFamily: 'monospace'
          }}
        >
          {dimensions.width}x{dimensions.height}px | {isExpanded ? 'Expanded' : 'Normal'}
        </div>
      )}
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
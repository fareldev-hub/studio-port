import { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import type { DetectedPort } from '@/types';

const PORT_PATTERNS = [
  /listening on (?:port )?(\d{2,5})/i,
  /server (?:is )?(?:running|started|listening)(?: on)?(?: port)? ?:?(\d{2,5})/i,
  /(?:http|https|ws|wss):\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):(\d{2,5})/i,
  /port[:\s]+(\d{2,5})/i,
  /started on (?:port )?(\d{2,5})/i,
  /bound to.*:(\d{2,5})/i,
  /ready on (?:http:\/\/)?localhost:(\d{2,5})/i,
];

function detectPort(text: string): number | null {
  const stripped = text.replace(/\x1b\[[0-9;]*m/g, '');
  for (const re of PORT_PATTERNS) {
    const m = stripped.match(re);
    if (m) {
      const port = parseInt(m[1], 10);
      if (port >= 1024 && port <= 65535) return port;
    }
  }
  return null;
}

interface TerminalInstanceHandle {
  sendInput: (data: string) => void;
  clear: () => void;
  resize: () => void;
}

interface TerminalInstanceProps {
  sessionId: string;
  isActive: boolean;
  fontSize: number;
  folderName?: string;
  onConnectionChange: (id: string, connected: boolean) => void;
  onPortDetected?: (port: DetectedPort) => void;
}

const TerminalInstance = forwardRef<TerminalInstanceHandle, TerminalInstanceProps>(
  function TerminalInstance({ sessionId, isActive, fontSize, folderName, onConnectionChange, onPortDetected }, ref) {
    const terminalRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const xtermRef = useRef<XTerm | null>(null);
    const fitAddonRef = useRef<FitAddon | null>(null);
    const socketRef = useRef<WebSocket | null>(null);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const resizeObserverRef = useRef<ResizeObserver | null>(null);
    const hasReceivedBannerRef = useRef(false);
    const detectedPortsRef = useRef<Set<number>>(new Set());
    const folderSentRef = useRef<string | undefined>(undefined);
    const folderNameRef = useRef<string | undefined>(folderName);
    useEffect(() => { folderNameRef.current = folderName; }, [folderName]);

    const resizeTerminal = useCallback(() => {
      if (!fitAddonRef.current || !xtermRef.current) return;
      try {
        fitAddonRef.current.fit();
        const dims = fitAddonRef.current.proposeDimensions();
        if (dims && socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(`42["terminal:resize",${JSON.stringify({ cols: dims.cols, rows: dims.rows })}]`);
        }
      } catch { /* ignore */ }
    }, []);

    const updateConn = useCallback((connected: boolean) => {
      onConnectionChange(sessionId, connected);
    }, [sessionId, onConnectionChange]);

    const connectToBackend = useCallback((term: XTerm, fitAddon: FitAddon) => {
      if (socketRef.current?.readyState === WebSocket.OPEN) return;
      hasReceivedBannerRef.current = false;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/socket.io/?EIO=4&transport=websocket`;

      let socket: WebSocket;
      try { socket = new WebSocket(wsUrl); } catch { updateConn(false); return; }
      socketRef.current = socket;

      socket.onopen = () => {};

      socket.onmessage = (event) => {
        const data = event.data as string;
        if (data === '2') { socket.send('3'); return; }
        if (data.startsWith('0')) { socket.send('40'); return; }
        if (data.startsWith('40')) {
          updateConn(true);
          if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
          heartbeatTimerRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) socket.send('3');
          }, 25000);
          setTimeout(resizeTerminal, 100);
          // Send folder if already known on connect
          if (folderNameRef.current) {
            setTimeout(() => {
              if (socket.readyState === WebSocket.OPEN) {
                const fn = folderNameRef.current;
                folderSentRef.current = fn;
                socket.send(`42["terminal:set-folder",${JSON.stringify(fn)}]`);
              }
            }, 600);
          }
          return;
        }
        if (data.startsWith('42')) {
          try {
            const [eventName, payload] = JSON.parse(data.slice(2));
            if (eventName === 'terminal:data' && typeof payload === 'string') {
              if (payload.includes('████████╗') || payload.includes('ThePort')) {
                hasReceivedBannerRef.current = true;
              }
              term.write(payload);
              const port = detectPort(payload);
              if (port && !detectedPortsRef.current.has(port) && onPortDetected) {
                detectedPortsRef.current.add(port);
                const host = window.location.hostname;
                const url = `http://${host}:${port}`;
                onPortDetected({ port, url, detectedAt: Date.now() });
              }
            } else if (eventName === 'terminal:connected') {
              updateConn(true);
              if (!payload?.silent && !hasReceivedBannerRef.current) {
                term.clear();
                const shellName = payload?.shell || 'bash';
                term.writeln(`\x1b[32m[Connected]\x1b[0m Real terminal via \x1b[36m${shellName}\x1b[0m`);
                term.writeln('');
              }
            } else if (eventName === 'terminal:error') {
              term.writeln(`\r\n\x1b[31m[Error] ${payload?.message || 'Unknown error'}\x1b[0m\r\n`);
            } else if (eventName === 'terminal:exit') {
              term.writeln(`\r\n\x1b[33m[Process exited]\x1b[0m`);
            }
          } catch { /* ignore malformed */ }
        }
      };

      socket.onclose = () => {
        updateConn(false);
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

      socket.onerror = () => { updateConn(false); };

      term.onData((inputData) => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(`42["terminal:input",${JSON.stringify(inputData)}]`);
        }
      });
    }, [updateConn, resizeTerminal, onPortDetected]);

    useEffect(() => {
      if (!terminalRef.current) return;
      const term = new XTerm({
        theme: {
          background: '#0a0a0a', foreground: '#e0e0e0', cursor: '#4fc1ff',
          selectionBackground: '#1e3a5f', selectionForeground: '#e0e0e0',
          black: '#0d0d0d', red: '#f44747', green: '#4ec9b0', yellow: '#dcdcaa',
          blue: '#4fc1ff', magenta: '#c586c0', cyan: '#4ec9b0', white: '#e0e0e0',
          brightBlack: '#555555', brightRed: '#f44747', brightGreen: '#4ec9b0',
          brightYellow: '#dcdcaa', brightBlue: '#4fc1ff', brightMagenta: '#c586c0',
          brightCyan: '#4ec9b0', brightWhite: '#ffffff',
        },
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        fontSize,
        cursorBlink: true, cursorStyle: 'block',
        scrollback: 10000, convertEol: true, allowTransparency: false,
        rows: 24, cols: 80,
      });
      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();
      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      if (containerRef.current && 'ResizeObserver' in window) {
        resizeObserverRef.current = new ResizeObserver(() => {
          window.requestAnimationFrame(() => resizeTerminal());
        });
        resizeObserverRef.current.observe(containerRef.current);
      }
      window.addEventListener('resize', resizeTerminal);
      connectToBackend(term, fitAddon);
      const t = setTimeout(() => resizeTerminal(), 100);

      return () => {
        clearTimeout(t);
        window.removeEventListener('resize', resizeTerminal);
        resizeObserverRef.current?.disconnect();
        if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
        if (heartbeatTimerRef.current) clearInterval(heartbeatTimerRef.current);
        if (socketRef.current) { socketRef.current.onclose = null; socketRef.current.close(); }
        term.dispose();
      };
    }, []);

    useEffect(() => {
      if (isActive && xtermRef.current && fitAddonRef.current) {
        const t = setTimeout(() => resizeTerminal(), 150);
        return () => clearTimeout(t);
      }
    }, [isActive, resizeTerminal]);

    useEffect(() => {
      if (folderName && folderName !== folderSentRef.current && socketRef.current?.readyState === WebSocket.OPEN) {
        folderSentRef.current = folderName;
        setTimeout(() => {
          if (socketRef.current?.readyState === WebSocket.OPEN) {
            socketRef.current.send(`42["terminal:set-folder",${JSON.stringify(folderName)}]`);
          }
        }, 600);
      }
    }, [folderName]);

    useImperativeHandle(ref, () => ({
      sendInput: (data: string) => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(`42["terminal:input",${JSON.stringify(data)}]`);
        }
      },
      clear: () => {
        if (socketRef.current?.readyState === WebSocket.OPEN) {
          socketRef.current.send(`42["terminal:input",${JSON.stringify('clear\r')}]`);
        } else {
          xtermRef.current?.clear();
        }
      },
      resize: () => resizeTerminal(),
    }), [resizeTerminal]);

    return (
      <div
        ref={containerRef}
        style={{
          display: isActive ? 'flex' : 'none',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          overflow: 'hidden',
        }}
      >
        <div
          ref={terminalRef}
          style={{ flex: 1, padding: '8px', width: '100%', height: '100%' }}
        />
      </div>
    );
  }
);

interface TerminalSessionState {
  id: string;
  name: string;
  connected: boolean;
}

interface TerminalProps {
  onClose: () => void;
  onToggle: () => void;
  onConnectionChange?: (connected: boolean) => void;
  isExpanded?: boolean;
  folderName?: string;
  onPortDetected?: (port: DetectedPort) => void;
  terminalFontSize?: number;
}

let sessionCounter = 0;
function newSession(n: number): TerminalSessionState {
  return { id: `sess-${++sessionCounter}`, name: `Terminal ${n}`, connected: false };
}

export function Terminal({
  onClose, onToggle, onConnectionChange, isExpanded: externalIsExpanded,
  folderName, onPortDetected, terminalFontSize = 13,
}: TerminalProps) {
  const [sessions, setSessions] = useState<TerminalSessionState[]>(() => [newSession(1)]);
  const [activeId, setActiveId] = useState(() => sessions[0]?.id ?? '');
  const [isExpanded, setIsExpanded] = useState(externalIsExpanded || false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting');

  const instanceRefs = useRef<Map<string, TerminalInstanceHandle>>(new Map());

  useEffect(() => {
    if (externalIsExpanded !== undefined) setIsExpanded(externalIsExpanded);
  }, [externalIsExpanded]);

  const handleConnectionChange = useCallback((id: string, connected: boolean) => {
    setSessions((prev) => prev.map((s) => s.id === id ? { ...s, connected } : s));
    if (id === activeId) {
      setConnectionStatus(connected ? 'connected' : 'offline');
      onConnectionChange?.(connected);
    }
  }, [activeId, onConnectionChange]);

  const handlePortDetected = useCallback((port: DetectedPort) => {
    onPortDetected?.(port);
  }, [onPortDetected]);

  const addSession = () => {
    const s = newSession(sessions.length + 1);
    setSessions((prev) => [...prev, s]);
    setActiveId(s.id);
    setConnectionStatus('connecting');
  };

  const closeSession = (id: string) => {
    if (sessions.length === 1) { onClose(); return; }
    setSessions((prev) => {
      const remaining = prev.filter((s) => s.id !== id);
      if (id === activeId) {
        const newActive = remaining[remaining.length - 1];
        setActiveId(newActive.id);
        setConnectionStatus(newActive.connected ? 'connected' : 'offline');
        onConnectionChange?.(newActive.connected);
      }
      return remaining;
    });
    instanceRefs.current.delete(id);
  };

  const handleTabClick = (id: string) => {
    setActiveId(id);
    const s = sessions.find((x) => x.id === id);
    if (s) {
      setConnectionStatus(s.connected ? 'connected' : 'offline');
      onConnectionChange?.(s.connected);
    }
  };

  const clearActive = () => instanceRefs.current.get(activeId)?.clear();

  const handleToggle = () => {
    setIsExpanded((v) => !v);
    onToggle();
  };

  return (
    <div
      className="flex flex-col w-full h-full min-h-0"
      style={{ backgroundColor: 'var(--bg-terminal)', position: 'relative', overflow: 'hidden' }}
    >
      {/* Header */}
      <div
        className="flex items-center flex-shrink-0"
        style={{
          height: 32,
          background: 'linear-gradient(180deg, #1a1a1a 0%, #141414 100%)',
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        {/* Mac-style dots */}
        <div className="flex items-center gap-1.5 px-2 flex-shrink-0">
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: '#f44747', opacity: 0.8 }} />
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: '#dcdcaa', opacity: 0.8 }} />
          <span className="inline-block rounded-full" style={{ width: 10, height: 10, backgroundColor: '#4ec9b0', opacity: 0.8 }} />
        </div>

        <span style={{ color: '#333', fontSize: 11, margin: '0 4px' }}>|</span>

        {/* Terminal tabs */}
        <div className="flex-1 flex items-center overflow-x-auto" style={{ scrollbarWidth: 'none' }}>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center gap-1.5 cursor-pointer flex-shrink-0 select-none px-2"
              style={{
                height: 32,
                borderRight: '1px solid #2a2a2a',
                backgroundColor: s.id === activeId ? '#0a0a0a' : 'transparent',
                borderTop: s.id === activeId ? '1px solid #4fc1ff' : '1px solid transparent',
              }}
              onClick={() => handleTabClick(s.id)}
            >
              <i className="fa-solid fa-terminal" style={{ color: s.id === activeId ? '#4fc1ff' : '#555', fontSize: 10 }} />
              <span style={{ color: s.id === activeId ? '#ddd' : '#666', fontSize: 10, letterSpacing: '0.04em' }}>
                {s.name}
              </span>
              {s.connected && (
                <span className="inline-block rounded-full" style={{ width: 5, height: 5, backgroundColor: '#4ec9b0' }} />
              )}
              <button
                onClick={(e) => { e.stopPropagation(); closeSession(s.id); }}
                className="rounded transition-colors"
                style={{ color: '#555', padding: '0 1px' }}
                onMouseEnter={(e) => { e.currentTarget.style.color = '#f44747'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
              >
                <i className="fa-solid fa-xmark" style={{ fontSize: 9 }} />
              </button>
            </div>
          ))}

          {/* + New Terminal */}
          <button
            onClick={addSession}
            className="flex-shrink-0 flex items-center justify-center px-2 transition-colors"
            style={{ height: 32, color: '#555' }}
            title="New terminal"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = '#1a1a1a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-plus" style={{ fontSize: 11 }} />
          </button>
        </div>

        {/* Status badge */}
        <div className="flex items-center px-2 flex-shrink-0">
          {connectionStatus === 'connected' && (
            <span
              className="flex items-center gap-1 px-1.5 py-0.5 rounded"
              style={{ backgroundColor: 'rgba(78,201,176,0.15)', border: '1px solid rgba(78,201,176,0.3)', fontSize: 9 }}
            >
              <span className="inline-block rounded-full animate-pulse" style={{ width: 5, height: 5, backgroundColor: '#4ec9b0' }} />
              <span style={{ color: '#4ec9b0' }}>LIVE · PTY</span>
            </span>
          )}
          {connectionStatus === 'connecting' && (
            <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(220,220,170,0.12)', border: '1px solid rgba(220,220,170,0.25)', color: '#dcdcaa', fontSize: 9 }}>
              CONNECTING…
            </span>
          )}
          {connectionStatus === 'offline' && (
            <span className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'rgba(244,71,71,0.12)', border: '1px solid rgba(244,71,71,0.3)', color: '#f44747', fontSize: 9 }}>
              OFFLINE
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-0.5 px-1 flex-shrink-0">
          <ActionButton icon="fa-trash-can" title="Clear terminal" onClick={clearActive} />
          <ActionButton
            icon={isExpanded ? 'fa-chevron-down' : 'fa-chevron-up'}
            title={isExpanded ? 'Minimize' : 'Maximize'}
            onClick={handleToggle}
          />
          <ActionButton icon="fa-xmark" title="Close terminal" onClick={onClose} />
        </div>
      </div>

      {/* Offline banner */}
      {connectionStatus === 'offline' && (
        <div
          className="flex items-center justify-center gap-1.5 py-1 flex-shrink-0"
          style={{ backgroundColor: 'rgba(244,71,71,0.08)', borderBottom: '1px solid rgba(244,71,71,0.2)' }}
        >
          <i className="fa-solid fa-circle-xmark" style={{ color: '#f44747', fontSize: 10 }} />
          <span className="text-xs" style={{ color: '#f44747' }}>Backend offline — reconnecting in 3s…</span>
        </div>
      )}

      {/* Terminal instances */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        {sessions.map((s) => (
          <TerminalInstance
            key={s.id}
            ref={(handle) => {
              if (handle) instanceRefs.current.set(s.id, handle);
              else instanceRefs.current.delete(s.id);
            }}
            sessionId={s.id}
            isActive={s.id === activeId}
            fontSize={terminalFontSize}
            folderName={folderName}
            onConnectionChange={handleConnectionChange}
            onPortDetected={handlePortDetected}
          />
        ))}
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
      onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: 12 }} />
    </button>
  );
}

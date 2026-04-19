import type { DetectedPort } from '@/types';

interface PortsPanelProps {
  ports: DetectedPort[];
  onClose: () => void;
  onClearPort: (port: number) => void;
}

export function PortsPanel({ ports, onClose, onClearPort }: PortsPanelProps) {
  if (ports.length === 0) return null;

  return (
    <div
      className="flex flex-col"
      style={{
        backgroundColor: '#0f1a0f',
        borderTop: '1px solid rgba(78,201,176,0.3)',
        maxHeight: 180,
      }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{ borderBottom: '1px solid rgba(78,201,176,0.15)' }}
      >
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-network-wired" style={{ color: '#4ec9b0', fontSize: 11 }} />
          <span style={{ color: '#4ec9b0', fontSize: 11, fontWeight: 600, letterSpacing: '0.06em' }}>
            RUNNING PORTS ({ports.length})
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded transition-colors"
          style={{ color: '#555' }}
          title="Hide ports panel"
          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
        >
          <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
        </button>
      </div>

      {/* Port list */}
      <div className="flex-1 overflow-y-auto px-3 py-2" style={{ scrollbarWidth: 'thin' }}>
        {ports.map((p) => (
          <PortRow key={p.port} port={p} onClear={() => onClearPort(p.port)} />
        ))}
      </div>
    </div>
  );
}

function PortRow({ port, onClear }: { port: DetectedPort; onClear: () => void }) {
  const openUrl = port.url;
  const elapsed = Math.round((Date.now() - port.detectedAt) / 1000);
  const timeLabel = elapsed < 60 ? `${elapsed}s ago` : `${Math.round(elapsed / 60)}m ago`;

  return (
    <div
      className="flex items-center justify-between py-1.5 rounded px-2"
      style={{ borderBottom: '1px solid rgba(78,201,176,0.08)' }}
    >
      <div className="flex items-center gap-3">
        <span
          className="inline-block rounded-full flex-shrink-0 animate-pulse"
          style={{ width: 7, height: 7, backgroundColor: '#4ec9b0' }}
        />
        <div>
          <div className="flex items-center gap-2">
            <span style={{ color: '#4ec9b0', fontFamily: 'monospace', fontSize: 12, fontWeight: 600 }}>
              :{port.port}
            </span>
            <span style={{ color: '#555', fontSize: 10 }}>{timeLabel}</span>
          </div>
          <a
            href={openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs transition-colors"
            style={{ color: '#666', textDecoration: 'none' }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#4fc1ff'; }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = '#666'; }}
          >
            {openUrl}
          </a>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0">
        <a
          href={openUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors"
          style={{ backgroundColor: 'rgba(78,201,176,0.15)', color: '#4ec9b0', textDecoration: 'none', border: '1px solid rgba(78,201,176,0.3)' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(78,201,176,0.3)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.backgroundColor = 'rgba(78,201,176,0.15)'; }}
          title="Open in browser"
        >
          <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9 }} />
          Open
        </a>
        <button
          onClick={onClear}
          className="p-1 rounded transition-colors"
          style={{ color: '#555' }}
          title="Dismiss"
          onMouseEnter={(e) => { e.currentTarget.style.color = '#f44747'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; }}
        >
          <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} />
        </button>
      </div>
    </div>
  );
}

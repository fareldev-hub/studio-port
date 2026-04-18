interface TitleBarProps {
  folderName?: string;
  terminalConnected: boolean;
  onOpenFolder: () => void;
  onToggleSidebar: () => void;
}

export function TitleBar({ folderName, terminalConnected, onOpenFolder, onToggleSidebar }: TitleBarProps) {
  return (
    <div
      className="flex items-center justify-between px-3 select-none flex-shrink-0"
      style={{ height: 42, backgroundColor: 'var(--bg-titlebar)', borderBottom: '1px solid var(--border-primary)' }}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-3">
        {/* Logo mark */}
        <div className="flex items-center gap-1.5">
          <span style={{ color: 'var(--accent-blue)', fontSize: 18, lineHeight: 1 }}>⚡</span>
          <div className="flex flex-col" style={{ lineHeight: 1 }}>
            <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 700, letterSpacing: '0.04em' }}>
              ThePort
            </span>
            <span style={{ color: 'var(--accent-blue)', fontSize: 8, fontWeight: 500, letterSpacing: '0.12em', marginTop: 1 }}>
              studio
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 20, backgroundColor: 'var(--border-primary)' }} />

        {/* Folder name or Open button */}
        {folderName ? (
          <span className="text-xs truncate max-w-xs" style={{ color: 'var(--text-secondary)' }}>
            <i className="fa-regular fa-folder-open mr-1.5" />
            {folderName}
          </span>
        ) : (
          <button
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs transition-colors"
            style={{ color: 'var(--text-secondary)', backgroundColor: 'var(--bg-hover)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-secondary)')}
          >
            <i className="fa-solid fa-folder-open" />
            <span className="hidden sm:inline">Open Folder</span>
          </button>
        )}
      </div>

      {/* Right: Status + controls */}
      <div className="flex items-center gap-2">
        {/* Developer credit — hidden on mobile */}
        <a
          href="https://fareldev.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1 text-xs transition-colors"
          style={{ color: 'var(--text-muted)', textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--accent-blue)')}
          onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          title="fareldev.vercel.app"
        >
          <i className="fa-solid fa-code" style={{ fontSize: 9 }} />
          <span style={{ fontSize: 10 }}>by fareldev</span>
        </a>

        {/* Divider */}
        <div className="hidden md:block" style={{ width: 1, height: 16, backgroundColor: 'var(--border-primary)' }} />

        {/* Terminal status */}
        <div className="flex items-center gap-1.5" title={terminalConnected ? 'Terminal connected' : 'Terminal offline'}>
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{
              width: 7,
              height: 7,
              backgroundColor: terminalConnected ? 'var(--status-connected)' : 'var(--status-disconnected)',
            }}
          />
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)', fontSize: 10 }}>
            {terminalConnected ? 'Terminal Ready' : 'Terminal Offline'}
          </span>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Toggle Sidebar (Ctrl+B)"
        >
          <i className="fa-solid fa-table-columns" style={{ fontSize: 12 }} />
        </button>

        {/* Settings */}
        <button
          className="p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Settings"
        >
          <i className="fa-solid fa-gear" style={{ fontSize: 12 }} />
        </button>
      </div>
    </div>
  );
}

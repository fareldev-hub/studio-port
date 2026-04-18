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
      style={{ height: 38, backgroundColor: 'var(--bg-titlebar)', borderBottom: '1px solid var(--border-primary)' }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-semibold" style={{ color: 'var(--accent-blue)' }}>
          <i className="fa-solid fa-code mr-1.5" />
        </span>
        <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)', fontSize: 13, letterSpacing: '0.02em' }}>
          CodeStudio
        </span>
        <span
          className="text-xs px-1.5 py-0.5 rounded"
          style={{ backgroundColor: 'var(--bg-active)', color: 'var(--text-muted)', fontSize: 9 }}
        >
          LOCAL
        </span>
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-3">
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
            Open Folder
          </button>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-2">
        {/* Terminal Status dot (always visible) + label (hidden on small screens) */}
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{
              width: 8,
              height: 8,
              backgroundColor: terminalConnected ? 'var(--status-connected)' : 'var(--status-disconnected)',
            }}
          />
          <span className="text-xs hidden sm:inline" style={{ color: 'var(--text-muted)' }}>
            {terminalConnected ? 'Terminal Ready' : 'Terminal Offline'}
          </span>
        </div>

        {/* Sidebar Toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded transition-colors"
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
          <i className="fa-solid fa-columns text-sm" />
        </button>

        {/* Settings */}
        <button
          className="p-1 rounded transition-colors"
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
          <i className="fa-solid fa-gear text-sm" />
        </button>
      </div>
    </div>
  );
}

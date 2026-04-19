interface TitleBarProps {
  folderName?: string;
  terminalConnected: boolean;
  onOpenFolder: () => void;
  onToggleSidebar: () => void;
}

export function TitleBar({ folderName, terminalConnected, onOpenFolder, onToggleSidebar }: TitleBarProps) {
  return (
    <div
      className="flex items-center justify-between px-4 select-none flex-shrink-0"
      style={{ 
        height: 56, 
        backgroundColor: '#000', 
        borderBottom: '1px solid #333' 
      }}
    >
      {/* Left: Brand */}
      <div className="flex items-center gap-4">
        {/* Logo mark */}
        <div className="flex items-center gap-3">
          <img 
            src="https://www.tikdash.my.id/the-port.jpg" 
            alt="ThePort Logo"
            style={{ 
              width: 40, 
              height: 40, 
              objectFit: 'contain',
              borderRadius: 8
            }}
          />
          <div className="flex flex-col" style={{ lineHeight: 1 }}>
            <span style={{ color: '#fff', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em' }}>
              ThePort
            </span>
            <span style={{ color: '#888', fontSize: 9, fontWeight: 500, letterSpacing: '0.12em', marginTop: 2 }}>
              studio
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: 1, height: 24, backgroundColor: '#333' }} />

        {/* Folder name or Open button */}
        {folderName ? (
          <span className="text-sm truncate max-w-xs" style={{ color: '#aaa' }}>
            <i className="fa-regular fa-folder-open mr-1.5" />
            {folderName}
          </span>
        ) : (
          <button
            onClick={onOpenFolder}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-sm transition-colors"
            style={{ color: '#aaa', backgroundColor: '#1a1a1a' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#aaa')}
          >
            <i className="fa-solid fa-folder-open" />
            <span className="hidden sm:inline">Open Folder</span>
          </button>
        )}
      </div>

      {/* Right: Status + controls */}
      <div className="flex items-center gap-3">
        {/* Developer credit — hidden on mobile */}
        <a
          href="https://fareldev.vercel.app"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden md:flex items-center gap-1 text-xs transition-colors"
          style={{ color: '#666', textDecoration: 'none' }}
          onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')}
          onMouseLeave={(e) => (e.currentTarget.style.color = '#666')}
          title="fareldev.vercel.app"
        >
          <i className="fa-solid fa-code" style={{ fontSize: 9 }} />
          <span style={{ fontSize: 10 }}>by fareldev</span>
        </a>

        {/* Divider */}
        <div className="hidden md:block" style={{ width: 1, height: 16, backgroundColor: '#333' }} />

        {/* Terminal status */}
        <div className="flex items-center gap-1.5" title={terminalConnected ? 'Terminal connected' : 'Terminal offline'}>
          <span
            className="inline-block rounded-full flex-shrink-0"
            style={{
              width: 7,
              height: 7,
              backgroundColor: terminalConnected ? '#22c55e' : '#ef4444',
            }}
          />
          <span className="text-xs hidden sm:inline" style={{ color: '#666', fontSize: 10 }}>
            {terminalConnected ? 'Terminal Ready' : 'Terminal Offline'}
          </span>
        </div>

        {/* Sidebar toggle */}
        <button
          onClick={onToggleSidebar}
          className="p-1.5 rounded transition-colors"
          style={{ color: '#666' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.backgroundColor = '#1a1a1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#666';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="Toggle Sidebar (Ctrl+B)"
        >
          <i className="fa-solid fa-table-columns" style={{ fontSize: 12 }} />
        </button>

        {/* Settings */}
        <button
          className="p-1.5 rounded transition-colors"
          style={{ color: '#666' }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#fff';
            e.currentTarget.style.backgroundColor = '#1a1a1a';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#666';
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
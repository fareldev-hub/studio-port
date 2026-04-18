interface StatusBarProps {
  cursorLine: number;
  cursorCol: number;
  language: string;
  fileName: string;
  isDirty: boolean;
  hasFolder: boolean;
}

export function StatusBar({ cursorLine, cursorCol, language, fileName, isDirty, hasFolder }: StatusBarProps) {
  return (
    <div
      className="flex items-center justify-between px-3 flex-shrink-0 select-none"
      style={{
        height: 24,
        backgroundColor: hasFolder ? 'var(--accent-blue)' : 'var(--bg-titlebar)',
        color: hasFolder ? '#0d0d0d' : 'var(--text-secondary)',
      }}
    >
      {/* Left Section */}
      <div className="flex items-center gap-3">
        {hasFolder && (
          <>
            <span className="flex items-center gap-1" style={{ fontSize: 11 }}>
              <i className="fa-solid fa-code-branch" style={{ fontSize: 10 }} />
              main
            </span>
            <span style={{ fontSize: 11 }}>UTF-8</span>
            <span style={{ fontSize: 11 }}>LF</span>
          </>
        )}
      </div>

      {/* Center Section */}
      <div className="flex items-center gap-2">
        {language && (
          <span className="capitalize" style={{ fontSize: 11 }}>
            {language}
          </span>
        )}
        {isDirty && (
          <span style={{ fontSize: 11 }}>
            <i className="fa-solid fa-circle" style={{ fontSize: 6 }} />
            Modified
          </span>
        )}
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-3">
        {fileName && (
          <span style={{ fontSize: 11 }}>
            Ln {cursorLine}, Col {cursorCol}
          </span>
        )}
        <span style={{ fontSize: 11 }}>Spaces: 2</span>
      </div>
    </div>
  );
}

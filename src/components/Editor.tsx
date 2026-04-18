import { useCallback } from 'react';
import Editor from '@monaco-editor/react';
import type { OpenTab } from '@/types';
import { getFileIcon } from '@/lib/fileIcons';
import { registerCodeStudioTheme } from '@/lib/monacoTheme';

interface EditorProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onEditorChange: (tabId: string, value: string) => void;
  onCursorPositionChange: (pos: { line: number; col: number }) => void;
  onNewFile: () => void;
}

export default function EditorPanel({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onEditorChange,
  onCursorPositionChange,
  onNewFile,
}: EditorProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleEditorMount = useCallback((editor: import('monaco-editor').editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
    registerCodeStudioTheme(monaco);
    monaco.editor.setTheme('codestudio-dark');

    editor.onDidChangeCursorPosition((e) => {
      onCursorPositionChange({ line: e.position.lineNumber, col: e.position.column });
    });
  }, [onCursorPositionChange]);

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-editor)' }}>
      {/* Tab Bar */}
      <div
        className="flex items-center flex-shrink-0 overflow-x-auto"
        style={{
          height: 35,
          backgroundColor: 'var(--bg-titlebar)',
          borderBottom: '1px solid var(--border-primary)',
          scrollbarWidth: 'none',
        }}
      >
        {tabs.map((tab) => (
          <TabItem
            key={tab.id}
            tab={tab}
            isActive={tab.id === activeTabId}
            onClick={() => onTabClick(tab.id)}
            onClose={() => onTabClose(tab.id)}
          />
        ))}
        {/* New Tab Button */}
        <button
          onClick={onNewFile}
          className="flex-shrink-0 flex items-center justify-center mx-1 rounded transition-colors"
          style={{
            width: 28,
            height: 28,
            color: 'var(--text-muted)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = 'var(--text-primary)';
            e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = 'var(--text-muted)';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
          title="New File"
        >
          <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
        </button>
      </div>

      {/* Editor Content */}
      <div className="flex-1 relative overflow-hidden">
        {activeTab ? (
          <Editor
            key={activeTab.id}
            height="100%"
            language={activeTab.language}
            value={activeTab.content}
            theme="codestudio-dark"
            onChange={(value) => onEditorChange(activeTab.id, value || '')}
            onMount={handleEditorMount}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              fontFamily: "'JetBrains Mono', monospace",
              lineNumbers: 'on',
              roundedSelection: false,
              scrollBeyondLastLine: false,
              readOnly: false,
              automaticLayout: true,
              padding: { top: 8 },
              scrollbar: {
                useShadows: false,
                verticalHasArrows: false,
                horizontalHasArrows: false,
                vertical: 'auto',
                horizontal: 'auto',
                verticalScrollbarSize: 8,
                horizontalScrollbarSize: 8,
              },
              renderLineHighlight: 'line',
              lineHeight: 22,
              folding: true,
              glyphMargin: false,
              wordWrap: 'off',
              tabSize: 2,
              insertSpaces: true,
            }}
          />
        ) : (
          <EmptyEditorState />
        )}
      </div>
    </div>
  );
}

function TabItem({
  tab,
  isActive,
  onClick,
  onClose,
}: {
  tab: OpenTab;
  isActive: boolean;
  onClick: () => void;
  onClose: () => void;
}) {
  const iconConfig = getFileIcon(tab.name);

  return (
    <div
      className="flex items-center gap-1.5 flex-shrink-0 cursor-pointer select-none transition-colors"
      style={{
        height: 35,
        minWidth: 120,
        maxWidth: 200,
        padding: '0 10px',
        backgroundColor: isActive ? 'var(--bg-editor)' : 'var(--bg-titlebar)',
        borderRight: '1px solid var(--border-primary)',
        borderTop: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
      }}
      onClick={onClick}
      onMouseEnter={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-titlebar)';
      }}
    >
      <i
        className={`fa-solid ${iconConfig.icon}`}
        style={{ fontSize: 12, color: iconConfig.color, minWidth: 14, textAlign: 'center' }}
      />
      <span
        className="truncate flex-1 text-xs"
        style={{
          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
          fontFamily: 'Inter, sans-serif',
        }}
      >
        {tab.name}
      </span>
      {tab.isDirty && (
        <span style={{ color: 'var(--text-accent)', fontSize: 16, lineHeight: 1 }}>&bull;</span>
      )}
      <button
        className="flex items-center justify-center rounded transition-colors flex-shrink-0"
        style={{ width: 16, height: 16, color: 'var(--text-muted)' }}
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = 'var(--accent-red)';
          e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = 'var(--text-muted)';
          e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} />
      </button>
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <span style={{ fontSize: 64, color: 'var(--text-muted)', opacity: 0.2, fontFamily: 'JetBrains Mono, monospace' }}>
        &lt;/&gt;
      </span>
      <span className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
        Select a file to start editing
      </span>
      <div className="flex gap-4 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Ctrl+O Open Folder</span>
        <span>Ctrl+N New File</span>
        <span>Ctrl+S Save</span>
      </div>
    </div>
  );
}

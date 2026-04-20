import { useCallback, useState } from 'react';
import MonacoEditor from '@monaco-editor/react';
import type { OpenTab, AppSettings } from '@/types';
import { getFileIcon } from '@/lib/fileIcons';
import { registerCodeStudioTheme } from '@/lib/monacoTheme';
import { HtmlPreview } from '@/components/HtmlPreview';

interface EditorProps {
  tabs: OpenTab[];
  activeTabId: string | null;
  onTabClick: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  onEditorChange: (tabId: string, value: string) => void;
  onCursorPositionChange: (pos: { line: number; col: number }) => void;
  onNewFile: () => void;
  settings?: AppSettings;
  onRequestFile?: (fileName: string, currentPath: string) => Promise<string | null>;
}

export default function EditorPanel({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onEditorChange,
  onCursorPositionChange,
  onNewFile,
  settings,
  onRequestFile,
}: EditorProps) {
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const [previewTabId, setPreviewTabId] = useState<string | null>(null);

  const isHtml = (tab: OpenTab | undefined) => {
    if (!tab) return false;
    return tab.name.endsWith('.html') || tab.name.endsWith('.htm') || tab.language === 'html';
  };

  const showPreview = previewTabId === activeTabId && isHtml(activeTab);

  const handleEditorMount = useCallback(
    (editor: import('monaco-editor').editor.IStandaloneCodeEditor, monaco: typeof import('monaco-editor')) => {
      registerCodeStudioTheme(monaco);
      monaco.editor.setTheme('codestudio-dark');
      editor.onDidChangeCursorPosition((e) => {
        onCursorPositionChange({ line: e.position.lineNumber, col: e.position.column });
      });
    },
    [onCursorPositionChange]
  );

  const fontSize = settings?.editorFontSize ?? 14;
  const tabSize = settings?.editorTabSize ?? 2;
  const wordWrap = settings?.wordWrap ? 'on' : 'off';
  const minimap = settings?.minimap ?? false;
  const lineHeight = settings?.lineHeight ?? 22;

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
        {/* New File button */}
        <button
          onClick={onNewFile}
          className="flex-shrink-0 flex items-center justify-center mx-1 rounded transition-colors"
          style={{ width: 28, height: 28, color: 'var(--text-muted)' }}
          onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          title="New File"
        >
          <i className="fa-solid fa-plus" style={{ fontSize: 13 }} />
        </button>

        {/* HTML Preview toggle — only when active tab is html */}
        {activeTab && isHtml(activeTab) && (
          <button
            onClick={() => setPreviewTabId(showPreview ? null : (activeTabId ?? null))}
            className="flex-shrink-0 flex items-center gap-1.5 px-2 mx-1 rounded transition-colors"
            style={{
              height: 24,
              fontSize: 11,
              color: showPreview ? '#4fc1ff' : 'var(--text-muted)',
              backgroundColor: showPreview ? 'rgba(79,193,255,0.12)' : 'transparent',
              border: showPreview ? '1px solid rgba(79,193,255,0.3)' : '1px solid transparent',
            }}
            title={showPreview ? 'Hide preview' : 'Show HTML preview'}
            onMouseEnter={(e) => { if (!showPreview) { e.currentTarget.style.color = '#4fc1ff'; e.currentTarget.style.border = '1px solid rgba(79,193,255,0.2)'; } }}
            onMouseLeave={(e) => { if (!showPreview) { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.border = '1px solid transparent'; } }}
          >
            <i className="fa-solid fa-eye" style={{ fontSize: 11 }} />
            <span>Preview</span>
          </button>
        )}
      </div>

      {/* Editor / Preview area */}
      <div className="flex-1 relative overflow-hidden flex">
        {/* Editor (always mounted when tab active, hidden in preview-only mode) */}
        {activeTab && (
          <div
            className="h-full"
            style={{ flex: showPreview ? '0 0 50%' : '1 1 100%', position: 'relative', overflow: 'hidden' }}
          >
            <MonacoEditor
              key={activeTab.id}
              height="100%"
              language={activeTab.language}
              value={activeTab.content}
              theme="codestudio-dark"
              onChange={(value) => onEditorChange(activeTab.id, value || '')}
              onMount={handleEditorMount}
              options={{
                minimap: { enabled: minimap },
                fontSize,
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
                lineHeight,
                folding: true,
                glyphMargin: false,
                wordWrap,
                tabSize,
                insertSpaces: true,
              }}
            />
          </div>
        )}

        {/* Preview pane — shown side-by-side with editor for HTML files */}
        {showPreview && activeTab && isHtml(activeTab) && (
          <div
            className="h-full flex-shrink-0"
            style={{ flex: '0 0 50%', borderLeft: '1px solid var(--border-primary)' }}
          >
            <HtmlPreview
              content={activeTab.content}
              fileName={activeTab.name}
              currentPath={activeTab.path}
              tabs={tabs}
              onClose={() => setPreviewTabId(null)}
              onRequestFile={onRequestFile}
            />
          </div>
        )}

        {/* Empty state */}
        {!activeTab && <EmptyEditorState />}
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
      onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
      onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-titlebar)'; }}
    >
      <i className={`fa-solid ${iconConfig.icon}`} style={{ fontSize: 12, color: iconConfig.color, minWidth: 14, textAlign: 'center' }} />
      <span
        className="truncate flex-1 text-xs"
        style={{ color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}
      >
        {tab.name}
      </span>
      {tab.isDirty && <span style={{ color: 'var(--text-accent)', fontSize: 16, lineHeight: 1 }}>&bull;</span>}
      <button
        className="flex items-center justify-center rounded transition-colors flex-shrink-0"
        style={{ width: 16, height: 16, color: 'var(--text-muted)' }}
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--accent-red)'; e.currentTarget.style.backgroundColor = 'var(--bg-hover)'; }}
        onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.backgroundColor = 'transparent'; }}
      >
        <i className="fa-solid fa-xmark" style={{ fontSize: 10 }} />
      </button>
    </div>
  );
}

function EmptyEditorState() {
  return (
    <div className="flex flex-col items-center justify-center h-full w-full">
      <span style={{ fontSize: 64, color: 'var(--text-muted)', opacity: 0.2, fontFamily: 'JetBrains Mono, monospace' }}>&lt;/&gt;</span>
      <span className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>Select a file to start editing</span>
      <div className="flex gap-4 mt-4 text-xs" style={{ color: 'var(--text-muted)' }}>
        <span>Ctrl+O Open Folder</span>
        <span>Ctrl+N New File</span>
        <span>Ctrl+S Save</span>
      </div>
    </div>
  );
}

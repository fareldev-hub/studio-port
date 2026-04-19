import { useState, useCallback, useEffect, useRef } from 'react';
import { TitleBar } from '@/components/TitleBar';
import { FileExplorer } from '@/components/FileExplorer';
import Editor from '@/components/Editor';
import { Terminal } from '@/components/Terminal';
import { StatusBar } from '@/components/StatusBar';
import { ToastContainer } from '@/components/ToastContainer';
import { ContextMenu } from '@/components/ContextMenu';
import { NewItemModal } from '@/components/NewItemModal';
import { DeleteConfirmModal } from '@/components/DeleteConfirmModal';
import { SettingsModal } from '@/components/SettingsModal';
import { PortsPanel } from '@/components/PortsPanel';
import { useFileSystem } from '@/hooks/useFileSystem';
import { useToast } from '@/hooks/useToast';
import type { FileSystemEntry, OpenTab, ContextMenuItem, AppSettings, DetectedPort } from '@/types';
import { DEFAULT_SETTINGS } from '@/types';
import { getLanguageFromFilename } from '@/lib/fileIcons';
import './App.css';

type MobilePanel = 'explorer' | 'editor' | 'terminal';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return isMobile;
}

function loadSettings(): AppSettings {
  try {
    const raw = localStorage.getItem('theport-settings');
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s: AppSettings) {
  try { localStorage.setItem('theport-settings', JSON.stringify(s)); } catch { /* ignore */ }
}

export default function App() {
  const fs = useFileSystem();
  const toast = useToast();
  const isMobile = useIsMobile();

  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [terminalVisible, setTerminalVisible] = useState(true);
  const [terminalHeight, setTerminalHeight] = useState(200);
  const [tabs, setTabs] = useState<OpenTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<FileSystemEntry | null>(null);
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; items: ContextMenuItem[] } | null>(null);
  const [newItemModal, setNewItemModal] = useState<{ type: 'file' | 'folder'; parentHandle: FileSystemDirectoryHandle } | null>(null);
  const [deleteModal, setDeleteModal] = useState<{ entry: FileSystemEntry } | null>(null);
  const [renamingEntry, setRenamingEntry] = useState<{ entry: FileSystemEntry; newName: string } | null>(null);
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });
  const [terminalConnected, setTerminalConnected] = useState(false);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('editor');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(loadSettings);
  const [detectedPorts, setDetectedPorts] = useState<DetectedPort[]>([]);
  const [portsPanelVisible, setPortsPanelVisible] = useState(true);

  const autoSaveTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const sidebarResizeRef = useRef<{ isResizing: boolean; startX: number; startWidth: number }>({
    isResizing: false, startX: 0, startWidth: 260,
  });
  const terminalResizeRef = useRef<{ isResizing: boolean; startY: number; startHeight: number }>({
    isResizing: false, startY: 0, startHeight: 200,
  });

  const handleSaveFile = useCallback(async (tabId?: string) => {
    const id = tabId ?? activeTabId;
    if (!id) return;
    const tab = tabs.find((t) => t.id === id);
    if (!tab || !tab.handle) return;
    const success = await fs.writeFile(tab.handle, tab.content);
    if (success) {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, isDirty: false } : t)));
      if (!tabId) toast.showFileSaved(tab.name);
    } else {
      toast.showError('Failed to save file. Check permissions.');
    }
  }, [activeTabId, tabs, fs, toast]);

  const handleEditorChange = useCallback((tabId: string, value: string) => {
    setTabs((prev) =>
      prev.map((t) => (t.id === tabId ? { ...t, content: value, isDirty: true } : t))
    );

    if (settings.autoSave) {
      if (autoSaveTimers.current.has(tabId)) {
        clearTimeout(autoSaveTimers.current.get(tabId));
      }
      const timer = setTimeout(() => {
        setTabs((current) => {
          const tab = current.find((t) => t.id === tabId);
          if (tab?.handle && tab.isDirty) {
            fs.writeFile(tab.handle, tab.content).then((ok) => {
              if (ok) {
                setTabs((prev2) => prev2.map((t) => (t.id === tabId ? { ...t, isDirty: false } : t)));
              }
            });
          }
          return current;
        });
        autoSaveTimers.current.delete(tabId);
      }, settings.autoSaveDelay);
      autoSaveTimers.current.set(tabId, timer);
    }
  }, [settings.autoSave, settings.autoSaveDelay, fs]);

  const handleSettingsSave = useCallback((newSettings: AppSettings) => {
    setSettings(newSettings);
    saveSettings(newSettings);
  }, []);

  const handlePortDetected = useCallback((port: DetectedPort) => {
    setDetectedPorts((prev) => {
      if (prev.some((p) => p.port === port.port)) return prev;
      return [...prev, port];
    });
    setPortsPanelVisible(true);
  }, []);

  const handleClearPort = useCallback((port: number) => {
    setDetectedPorts((prev) => prev.filter((p) => p.port !== port));
  }, []);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'o': e.preventDefault(); handleOpenFolder(); break;
          case 'n':
            e.preventDefault();
            if (fs.rootEntry?.handle) setNewItemModal({ type: 'file', parentHandle: fs.rootEntry.handle as FileSystemDirectoryHandle });
            break;
          case 's': e.preventDefault(); handleSaveFile(); break;
          case 'w': e.preventDefault(); if (activeTabId) closeTab(activeTabId); break;
          case 'b':
            e.preventDefault();
            if (isMobile) setMobileSidebarOpen((v) => !v);
            else setSidebarVisible((v) => !v);
            break;
          case ',': e.preventDefault(); setSettingsOpen(true); break;
          case '`':
          case '÷':
            if (e.shiftKey) { e.preventDefault(); setTerminalVisible((v) => !v); }
            break;
        }
      }
      if (e.key === 'F2' && selectedEntry) { e.preventDefault(); setRenamingEntry({ entry: selectedEntry, newName: selectedEntry.name }); }
      if (e.key === 'Delete' && selectedEntry) { e.preventDefault(); setDeleteModal({ entry: selectedEntry }); }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, selectedEntry, fs.rootEntry, isMobile]);

  const handleOpenFolder = useCallback(async () => {
    const result = await fs.openFolder();
    if (result.success) {
      toast.showPermissionGranted(result.name || 'Unknown Folder');
      setExpandedDirs(new Set());
      if (isMobile) { setMobileSidebarOpen(false); setMobilePanel('editor'); }
    } else if (result.reason === 'denied') {
      toast.showPermissionDenied(() => handleOpenFolder());
    }
  }, [fs, toast, isMobile]);

  const handleFileClick = useCallback(
    async (entry: FileSystemEntry) => {
      if (entry.kind !== 'file') return;
      setSelectedEntry(entry);
      const existingTab = tabs.find((t) => t.path === entry.path);
      if (existingTab) {
        setActiveTabId(existingTab.id);
        if (isMobile) { setMobileSidebarOpen(false); setMobilePanel('editor'); }
        return;
      }
      const content = await fs.readFile(entry.handle as FileSystemFileHandle);
      const newTab: OpenTab = {
        id: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        name: entry.name,
        path: entry.path,
        content,
        language: getLanguageFromFilename(entry.name),
        handle: entry.handle as FileSystemFileHandle,
        isDirty: false,
        isActive: true,
      };
      setTabs((prev) => prev.map((t) => ({ ...t, isActive: false })).concat(newTab));
      setActiveTabId(newTab.id);
      if (isMobile) { setMobileSidebarOpen(false); setMobilePanel('editor'); }
    },
    [fs, tabs, isMobile]
  );

  const handleFolderToggle = useCallback(
    async (entry: FileSystemEntry) => {
      if (entry.kind !== 'directory') return;
      setSelectedEntry(entry);
      const newExpanded = new Set(expandedDirs);
      if (newExpanded.has(entry.path)) {
        newExpanded.delete(entry.path);
        setExpandedDirs(newExpanded);
        return;
      }
      newExpanded.add(entry.path);
      setExpandedDirs(newExpanded);
      const children = await fs.expandDirectory(entry);
      const updateEntryChildren = (entries: FileSystemEntry[]): FileSystemEntry[] =>
        entries.map((e) => {
          if (e.path === entry.path) return { ...e, expanded: true, children };
          if (e.children) return { ...e, children: updateEntryChildren(e.children) };
          return e;
        });
      fs.setEntries((prev) => updateEntryChildren(prev));
    },
    [expandedDirs, fs]
  );

  const closeTab = useCallback((tabId: string) => {
    if (autoSaveTimers.current.has(tabId)) {
      clearTimeout(autoSaveTimers.current.get(tabId));
      autoSaveTimers.current.delete(tabId);
    }
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== tabId);
      if (filtered.length > 0 && !filtered.some((t) => t.isActive)) {
        filtered[filtered.length - 1].isActive = true;
        setActiveTabId(filtered[filtered.length - 1].id);
      } else if (filtered.length === 0) {
        setActiveTabId(null);
      }
      return filtered;
    });
  }, []);

  const handleTabClick = useCallback((tabId: string) => {
    setActiveTabId(tabId);
    setTabs((prev) => prev.map((t) => ({ ...t, isActive: t.id === tabId })));
  }, []);

  const handleCreateItem = useCallback(async (name: string) => {
    if (!newItemModal) return;
    const { type, parentHandle } = newItemModal;
    if (type === 'file') {
      const handle = await fs.createFile(parentHandle, name);
      if (handle) { toast.showInfo('File Created', `"${name}" has been created.`); await fs.refreshEntries(); }
      else toast.showError('Failed to create file.');
    } else {
      const handle = await fs.createDirectory(parentHandle, name);
      if (handle) { toast.showInfo('Folder Created', `"${name}" has been created.`); await fs.refreshEntries(); }
      else toast.showError('Failed to create folder.');
    }
    setNewItemModal(null);
  }, [newItemModal, fs, toast]);

  const handleDeleteEntry = useCallback(async () => {
    if (!deleteModal) return;
    const { entry } = deleteModal;
    if (!entry.parentHandle) return;
    const success = await fs.deleteEntry(entry.parentHandle, entry.name);
    if (success) {
      toast.showInfo('Deleted', `"${entry.name}" has been deleted.`);
      const tab = tabs.find((t) => t.path === entry.path);
      if (tab) closeTab(tab.id);
      await fs.refreshEntries();
    } else {
      toast.showError('Failed to delete.');
    }
    setDeleteModal(null);
  }, [deleteModal, fs, toast, tabs, closeTab]);

  const handleRenameEntry = useCallback(async (newName: string) => {
    if (!renamingEntry || !renamingEntry.entry.parentHandle) return;
    const { entry, parentHandle } = { entry: renamingEntry.entry, parentHandle: renamingEntry.entry.parentHandle };
    const success = await fs.renameEntry(parentHandle, entry.name, newName, entry);
    if (success) {
      toast.showInfo('Renamed', `"${entry.name}" renamed to "${newName}".`);
      const tab = tabs.find((t) => t.path === entry.path);
      if (tab) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tab.id ? { ...t, name: newName, path: entry.path.replace(entry.name, newName) } : t
          )
        );
      }
      await fs.refreshEntries();
    } else {
      toast.showError('Failed to rename.');
    }
    setRenamingEntry(null);
  }, [renamingEntry, fs, toast, tabs]);

  const handleSidebarResizeStart = useCallback((e: React.MouseEvent) => {
    sidebarResizeRef.current = { isResizing: true, startX: e.clientX, startWidth: sidebarWidth };
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [sidebarWidth]);

  const handleTerminalResizeStart = useCallback((e: React.MouseEvent) => {
    terminalResizeRef.current = { isResizing: true, startY: e.clientY, startHeight: terminalHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, [terminalHeight]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (sidebarResizeRef.current.isResizing) {
        const delta = e.clientX - sidebarResizeRef.current.startX;
        setSidebarWidth(Math.max(180, Math.min(500, sidebarResizeRef.current.startWidth + delta)));
      }
      if (terminalResizeRef.current.isResizing) {
        const delta = terminalResizeRef.current.startY - e.clientY;
        setTerminalHeight(Math.max(100, Math.min(window.innerHeight * 0.6, terminalResizeRef.current.startHeight + delta)));
      }
    };
    const handleMouseUp = () => {
      sidebarResizeRef.current.isResizing = false;
      terminalResizeRef.current.isResizing = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => { window.removeEventListener('mousemove', handleMouseMove); window.removeEventListener('mouseup', handleMouseUp); };
  }, []);

  const handleEntryContextMenu = useCallback(
    (e: React.MouseEvent, entry: FileSystemEntry) => {
      e.preventDefault();
      e.stopPropagation();
      setSelectedEntry(entry);
      const items: ContextMenuItem[] = [
        { label: 'New File', icon: 'fa-file-circle-plus', action: () => setNewItemModal({ type: 'file', parentHandle: entry.kind === 'directory' ? (entry.handle as FileSystemDirectoryHandle) : (entry.parentHandle as FileSystemDirectoryHandle) }) },
        { label: 'New Folder', icon: 'fa-folder-plus', action: () => setNewItemModal({ type: 'folder', parentHandle: entry.kind === 'directory' ? (entry.handle as FileSystemDirectoryHandle) : (entry.parentHandle as FileSystemDirectoryHandle) }) },
        { label: '', divider: true, action: () => {} },
        { label: 'Rename', icon: 'fa-pen', shortcut: 'F2', action: () => setRenamingEntry({ entry, newName: entry.name }) },
        { label: 'Delete', icon: 'fa-trash-can', shortcut: 'Del', action: () => setDeleteModal({ entry }) },
        { label: '', divider: true, action: () => {} },
        { label: 'Refresh', icon: 'fa-rotate-right', action: () => fs.refreshEntries() },
      ];
      setContextMenu({ x: e.clientX, y: e.clientY, items });
    },
    [fs]
  );

  const activeTab = tabs.find((t) => t.id === activeTabId);

  const fileExplorer = (
    <FileExplorer
      rootName={fs.rootEntry?.name}
      entries={fs.entries}
      expandedDirs={expandedDirs}
      selectedPath={selectedEntry?.path}
      activeFilePath={activeTab?.path}
      renamingEntry={renamingEntry}
      onFileClick={handleFileClick}
      onFolderToggle={handleFolderToggle}
      onContextMenu={handleEntryContextMenu}
      onOpenFolder={handleOpenFolder}
      onNewFile={() => fs.rootEntry?.handle && setNewItemModal({ type: 'file', parentHandle: fs.rootEntry.handle as FileSystemDirectoryHandle })}
      onNewFolder={() => fs.rootEntry?.handle && setNewItemModal({ type: 'folder', parentHandle: fs.rootEntry.handle as FileSystemDirectoryHandle })}
      onRefresh={fs.refreshEntries}
      onRenameSubmit={handleRenameEntry}
      onRenameCancel={() => setRenamingEntry(null)}
    />
  );

  const terminalPanel = (
    <Terminal
      onClose={() => { if (isMobile) setMobilePanel('editor'); else setTerminalVisible(false); }}
      onToggle={() => setTerminalHeight((h) => (h > 250 ? 150 : 300))}
      onConnectionChange={setTerminalConnected}
      folderName={fs.rootEntry?.name}
      onPortDetected={handlePortDetected}
      terminalFontSize={settings.terminalFontSize}
    />
  );

  const editorArea = (
    <Editor
      tabs={tabs}
      activeTabId={activeTabId}
      onTabClick={handleTabClick}
      onTabClose={closeTab}
      onEditorChange={handleEditorChange}
      onCursorPositionChange={setCursorPos}
      onNewFile={() => fs.rootEntry?.handle && setNewItemModal({ type: 'file', parentHandle: fs.rootEntry.handle as FileSystemDirectoryHandle })}
      settings={settings}
    />
  );

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <TitleBar
        folderName={fs.rootEntry?.name}
        terminalConnected={terminalConnected}
        onOpenFolder={handleOpenFolder}
        onToggleSidebar={() => { if (isMobile) setMobileSidebarOpen((v) => !v); else setSidebarVisible((v) => !v); }}
        onOpenSettings={() => setSettingsOpen(true)}
      />

      {isMobile ? (
        <>
          {mobileSidebarOpen && (
            <div className="fixed inset-0 z-50 flex" style={{ top: 38 }}>
              <div className="flex-1 overflow-hidden" style={{ backgroundColor: 'var(--bg-sidebar)', maxWidth: '80vw' }}>
                {fileExplorer}
              </div>
              <div className="flex-1" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setMobileSidebarOpen(false)} />
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            {mobilePanel === 'explorer' && fileExplorer}
            {mobilePanel === 'editor' && <div className="flex flex-col h-full"><div className="flex-1 overflow-hidden">{editorArea}</div></div>}
            {mobilePanel === 'terminal' && <div className="h-full">{terminalPanel}</div>}
          </div>
          <div className="flex items-center justify-around flex-shrink-0" style={{ height: 52, backgroundColor: 'var(--bg-titlebar)', borderTop: '1px solid var(--border-primary)' }}>
            <MobileNavButton icon="fa-folder-tree" label="Explorer" active={mobilePanel === 'explorer'} onClick={() => setMobilePanel('explorer')} />
            <MobileNavButton icon="fa-code" label="Editor" active={mobilePanel === 'editor'} badge={tabs.filter((t) => t.isDirty).length > 0 ? '●' : undefined} onClick={() => setMobilePanel('editor')} />
            <MobileNavButton icon="fa-terminal" label="Terminal" active={mobilePanel === 'terminal'} dot={terminalConnected} onClick={() => setMobilePanel('terminal')} />
          </div>
        </>
      ) : (
        <div className="flex flex-1 overflow-hidden">
          {sidebarVisible && (
            <>
              <div style={{ width: sidebarWidth, minWidth: sidebarWidth }} className="flex-shrink-0">{fileExplorer}</div>
              <div
                className="w-1 flex-shrink-0 cursor-col-resize hover:bg-blue-500/30 transition-colors"
                style={{ backgroundColor: 'var(--border-primary)' }}
                onMouseDown={handleSidebarResizeStart}
              />
            </>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            {editorArea}

            {terminalVisible && (
              <>
                <div
                  className="h-1 flex-shrink-0 cursor-row-resize hover:bg-blue-500/30 transition-colors"
                  style={{ backgroundColor: 'var(--border-primary)' }}
                  onMouseDown={handleTerminalResizeStart}
                />
                <div style={{ height: terminalHeight, minHeight: 100 }} className="flex-shrink-0 flex flex-col">
                  {detectedPorts.length > 0 && portsPanelVisible && (
                    <PortsPanel
                      ports={detectedPorts}
                      onClose={() => setPortsPanelVisible(false)}
                      onClearPort={handleClearPort}
                    />
                  )}
                  <div className="flex-1 min-h-0">{terminalPanel}</div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <StatusBar
        cursorLine={cursorPos.line}
        cursorCol={cursorPos.col}
        language={activeTab?.language || ''}
        fileName={activeTab?.name || ''}
        isDirty={activeTab?.isDirty || false}
        hasFolder={!!fs.rootEntry}
      />

      <ToastContainer toasts={toast.toasts} onRemove={toast.removeToast} />

      {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} items={contextMenu.items} onClose={() => setContextMenu(null)} />}
      {newItemModal && <NewItemModal type={newItemModal.type} onCreate={handleCreateItem} onCancel={() => setNewItemModal(null)} />}
      {deleteModal && <DeleteConfirmModal fileName={deleteModal.entry.name} onConfirm={handleDeleteEntry} onCancel={() => setDeleteModal(null)} />}
      {settingsOpen && <SettingsModal settings={settings} onSave={handleSettingsSave} onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

function MobileNavButton({ icon, label, active, onClick, badge, dot }: {
  icon: string; label: string; active: boolean; onClick: () => void; badge?: string; dot?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className="flex flex-col items-center justify-center gap-0.5 px-4 py-1 rounded-lg transition-colors relative"
      style={{ color: active ? 'var(--accent-blue)' : 'var(--text-muted)', backgroundColor: active ? 'var(--bg-active)' : 'transparent', minWidth: 64 }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: 18 }} />
      <span style={{ fontSize: 10, fontWeight: active ? 600 : 400 }}>{label}</span>
      {badge && <span className="absolute top-1 right-2" style={{ color: 'var(--accent-yellow)', fontSize: 8 }}>{badge}</span>}
      {dot && <span className="absolute top-1 right-1 rounded-full" style={{ width: 6, height: 6, backgroundColor: 'var(--accent-green)' }} />}
    </button>
  );
}

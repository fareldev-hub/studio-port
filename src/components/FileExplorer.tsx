import { useState, useRef, useEffect } from 'react';
import type { FileSystemEntry } from '@/types';
import { getFileIcon } from '@/lib/fileIcons';

interface FileExplorerProps {
  rootName?: string;
  entries: FileSystemEntry[];
  expandedDirs: Set<string>;
  selectedPath?: string;
  activeFilePath?: string;
  renamingEntry: { entry: FileSystemEntry; newName: string } | null;
  onFileClick: (entry: FileSystemEntry) => void;
  onFolderToggle: (entry: FileSystemEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileSystemEntry) => void;
  onOpenFolder: () => void;
  onNewFile: () => void;
  onNewFolder: () => void;
  onRefresh: () => void;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
}

export function FileExplorer({
  rootName,
  entries,
  expandedDirs,
  selectedPath,
  activeFilePath,
  renamingEntry,
  onFileClick,
  onFolderToggle,
  onContextMenu,
  onOpenFolder,
  onNewFile,
  onNewFolder,
  onRefresh,
  onRenameSubmit,
  onRenameCancel,
}: FileExplorerProps) {
  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--bg-sidebar)' }}>
      {/* Section Header */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{ height: 32 }}
      >
        <span
          className="font-semibold uppercase"
          style={{ color: 'var(--text-muted)', fontSize: 11, letterSpacing: '0.06em' }}
        >
          Explorer
        </span>
        <div className="flex items-center gap-1">
          <ActionButton icon="fa-folder-plus" title="New Folder (Ctrl+Shift+N)" onClick={onNewFolder} />
          <ActionButton icon="fa-file-circle-plus" title="New File (Ctrl+N)" onClick={onNewFile} />
          <ActionButton icon="fa-rotate-right" title="Refresh" onClick={onRefresh} />
          <ActionButton icon="fa-folder-open" title="Open Folder (Ctrl+O)" onClick={onOpenFolder} />
        </div>
      </div>

      {/* Folder Info Bar */}
      {rootName && (
        <div
          className="px-3 py-1.5 flex items-center gap-2 flex-shrink-0 truncate"
          style={{ backgroundColor: 'var(--bg-active)' }}
          title={rootName}
        >
          <i className="fa-solid fa-folder-open text-xs" style={{ color: 'var(--accent-yellow)' }} />
          <span className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
            {rootName}
          </span>
        </div>
      )}

      {/* File Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        {rootName ? (
          entries.map((entry) => (
            <TreeItem
              key={entry.path}
              entry={entry}
              depth={0}
              expandedDirs={expandedDirs}
              selectedPath={selectedPath}
              activeFilePath={activeFilePath}
              renamingEntry={renamingEntry}
              onFileClick={onFileClick}
              onFolderToggle={onFolderToggle}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))
        ) : (
          <EmptyState onOpenFolder={onOpenFolder} />
        )}
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
      onMouseEnter={(e) => {
        e.currentTarget.style.color = 'var(--text-primary)';
        e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.color = 'var(--text-muted)';
        e.currentTarget.style.backgroundColor = 'transparent';
      }}
    >
      <i className={`fa-solid ${icon}`} style={{ fontSize: 13 }} />
    </button>
  );
}

interface TreeItemProps {
  entry: FileSystemEntry;
  depth: number;
  expandedDirs: Set<string>;
  selectedPath?: string;
  activeFilePath?: string;
  renamingEntry: { entry: FileSystemEntry; newName: string } | null;
  onFileClick: (entry: FileSystemEntry) => void;
  onFolderToggle: (entry: FileSystemEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileSystemEntry) => void;
  onRenameSubmit: (newName: string) => void;
  onRenameCancel: () => void;
}

function TreeItem({
  entry,
  depth,
  expandedDirs,
  selectedPath,
  activeFilePath,
  renamingEntry,
  onFileClick,
  onFolderToggle,
  onContextMenu,
  onRenameSubmit,
  onRenameCancel,
}: TreeItemProps) {
  const isExpanded = expandedDirs.has(entry.path);
  const isSelected = selectedPath === entry.path;
  const isActive = activeFilePath === entry.path;
  const isRenaming = renamingEntry?.entry.path === entry.path;
  const [renameValue, setRenameValue] = useState(isRenaming ? renamingEntry!.newName : entry.name);
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isRenaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [isRenaming]);

  const handleClick = () => {
    if (entry.kind === 'directory') {
      onFolderToggle(entry);
    } else {
      onFileClick(entry);
    }
  };

  const handleRenameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      onRenameSubmit(renameValue);
    } else if (e.key === 'Escape') {
      onRenameCancel();
    }
  };

  const iconConfig = entry.kind === 'directory'
    ? { icon: isExpanded ? 'fa-folder-open' : 'fa-folder', color: 'var(--accent-yellow)' }
    : getFileIcon(entry.name);

  return (
    <div>
      <div
        className="flex items-center cursor-pointer select-none transition-colors"
        style={{
          height: 26,
          paddingLeft: 8 + depth * 12,
          backgroundColor: isActive ? 'var(--bg-active)' : isSelected ? 'var(--bg-hover)' : 'transparent',
          borderLeft: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
        }}
        onClick={handleClick}
        onContextMenu={(e) => onContextMenu(e, entry)}
        onMouseEnter={(e) => {
          if (!isActive) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
        }}
        onMouseLeave={(e) => {
          if (!isActive && !isSelected) e.currentTarget.style.backgroundColor = 'transparent';
        }}
      >
        {/* Chevron / Spacer */}
        <span className="inline-flex items-center justify-center" style={{ width: 16, minWidth: 16 }}>
          {entry.kind === 'directory' && (
            <i
              className={`fa-solid ${isExpanded ? 'fa-chevron-down' : 'fa-chevron-right'}`}
              style={{ fontSize: 10, color: 'var(--text-muted)' }}
            />
          )}
        </span>

        {/* Icon */}
        <i
          className={`fa-solid ${iconConfig.icon} mr-1.5`}
          style={{ fontSize: 14, color: iconConfig.color, minWidth: 16, textAlign: 'center' }}
        />

        {/* Name / Rename Input */}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={handleRenameKeyDown}
            onBlur={onRenameCancel}
            onClick={(e) => e.stopPropagation()}
            className="flex-1 bg-transparent outline-none text-xs"
            style={{
              color: 'var(--text-primary)',
              borderBottom: '1px solid var(--accent-blue)',
              fontFamily: 'Inter, sans-serif',
            }}
          />
        ) : (
          <span
            className="truncate text-xs flex-1"
            style={{
              color: isActive ? 'var(--text-accent)' : 'var(--text-primary)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            {entry.name}
          </span>
        )}
      </div>

      {/* Children */}
      {entry.kind === 'directory' && isExpanded && entry.children && (
        <div>
          {entry.children.map((child) => (
            <TreeItem
              key={child.path}
              entry={child}
              depth={depth + 1}
              expandedDirs={expandedDirs}
              selectedPath={selectedPath}
              activeFilePath={activeFilePath}
              renamingEntry={renamingEntry}
              onFileClick={onFileClick}
              onFolderToggle={onFolderToggle}
              onContextMenu={onContextMenu}
              onRenameSubmit={onRenameSubmit}
              onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({ onOpenFolder }: { onOpenFolder: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6" style={{ minHeight: 200 }}>
      <i
        className="fa-solid fa-folder-open mb-3"
        style={{ fontSize: 48, color: 'var(--text-muted)', opacity: 0.3 }}
      />
      <span className="text-sm mb-1" style={{ color: 'var(--text-muted)' }}>
        No folder opened
      </span>
      <span className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
        Click &quot;Open Folder&quot; to start
      </span>
      <button
        onClick={onOpenFolder}
        className="px-4 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-90"
        style={{ backgroundColor: 'var(--accent-blue)', color: '#0d0d0d' }}
      >
        <i className="fa-solid fa-folder-open mr-1.5" />
        Open Folder
      </button>
    </div>
  );
}

export interface FileSystemEntry {
  name: string;
  kind: 'file' | 'directory';
  handle: FileSystemFileHandle | FileSystemDirectoryHandle;
  parentHandle?: FileSystemDirectoryHandle;
  path: string;
  children?: FileSystemEntry[];
  expanded?: boolean;
  isLoading?: boolean;
}

export interface OpenTab {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  handle?: FileSystemFileHandle;
  isDirty: boolean;
  isActive: boolean;
}

export interface ToastNotification {
  id: string;
  type: 'permission-request' | 'permission-granted' | 'permission-denied' | 'file-saved' | 'error' | 'info';
  title: string;
  message: string;
  autoDismiss?: number;
  actions?: ToastAction[];
}

export interface ToastAction {
  label: string;
  variant: 'primary' | 'secondary' | 'danger';
  onClick: () => void;
}

export interface ContextMenuItem {
  label: string;
  icon?: string;
  shortcut?: string;
  action: () => void;
  divider?: boolean;
  disabled?: boolean;
}

export interface EditorPosition {
  lineNumber: number;
  column: number;
}

export type PermissionState = 'prompt' | 'granted' | 'denied';

export interface AppSettings {
  autoSave: boolean;
  autoSaveDelay: number;
  editorFontSize: number;
  editorTabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  terminalFontSize: number;
  lineHeight: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoSave: true,
  autoSaveDelay: 1500,
  editorFontSize: 14,
  editorTabSize: 2,
  wordWrap: false,
  minimap: false,
  terminalFontSize: 13,
  lineHeight: 22,
};

export interface DetectedPort {
  port: number;
  url: string;
  detectedAt: number;
}

export interface FileIconConfig {
  icon: string;
  color: string;
}

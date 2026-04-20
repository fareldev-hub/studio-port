import { useState, useCallback, useRef } from 'react';
import type { FileSystemEntry } from '@/types';
import { serverApi, makeServerHandle, isServerHandle } from '@/lib/serverFs';

function entryFromServer(
  project: string,
  item: { name: string; kind: 'file' | 'directory'; path: string },
  parentHandle?: ReturnType<typeof makeServerHandle>
): FileSystemEntry {
  const handle = makeServerHandle(project, item.path, item.kind);
  return {
    name: item.name,
    kind: item.kind,
    handle: handle as unknown as FileSystemFileHandle | FileSystemDirectoryHandle,
    parentHandle: parentHandle as unknown as FileSystemDirectoryHandle,
    path: `${project}/${item.path}`,
    expanded: false,
    children: item.kind === 'directory' ? [] : undefined,
  };
}

export function useServerFileSystem() {
  const [rootEntry, setRootEntry] = useState<FileSystemEntry | null>(null);
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [isRestoring] = useState(false);
  const [currentProject, setCurrentProject] = useState<string | null>(null);
  const currentProjectRef = useRef<string | null>(null);

  const openProject = useCallback(async (projectName: string) => {
    currentProjectRef.current = projectName;
    setCurrentProject(projectName);
    const rootHandle = makeServerHandle(projectName, '', 'directory');
    const root: FileSystemEntry = {
      name: projectName,
      kind: 'directory',
      handle: rootHandle as unknown as FileSystemDirectoryHandle,
      path: projectName,
      expanded: true,
      children: [],
    };
    setRootEntry(root);

    const items = await serverApi.listDir(projectName, '');
    const newEntries = items.map((item) => entryFromServer(projectName, item, rootHandle));
    setEntries(newEntries);
    return { success: true as const, name: projectName };
  }, []);

  const expandDirectory = useCallback(async (entry: FileSystemEntry): Promise<FileSystemEntry[]> => {
    if (entry.kind !== 'directory') return [];
    const h = entry.handle as unknown;
    if (!isServerHandle(h)) return [];
    const items = await serverApi.listDir(h.project, h.relativePath);
    return items.map((item) => entryFromServer(h.project, item, h as ReturnType<typeof makeServerHandle>));
  }, []);

  const readFile = useCallback(async (handle: FileSystemFileHandle): Promise<string> => {
    const h = handle as unknown;
    if (!isServerHandle(h)) return '';
    return serverApi.readFile(h.project, h.relativePath);
  }, []);

  const writeFile = useCallback(async (handle: FileSystemFileHandle, content: string): Promise<boolean> => {
    const h = handle as unknown;
    if (!isServerHandle(h)) return false;
    return serverApi.writeFile(h.project, h.relativePath, content);
  }, []);

  const createFile = useCallback(async (
    parentHandle: FileSystemDirectoryHandle,
    name: string
  ): Promise<FileSystemFileHandle | null> => {
    const h = parentHandle as unknown;
    if (!isServerHandle(h)) return null;
    const relPath = h.relativePath ? `${h.relativePath}/${name}` : name;
    const ok = await serverApi.createFile(h.project, relPath);
    if (!ok) return null;
    return makeServerHandle(h.project, relPath, 'file') as unknown as FileSystemFileHandle;
  }, []);

  const createDirectory = useCallback(async (
    parentHandle: FileSystemDirectoryHandle,
    name: string
  ): Promise<FileSystemDirectoryHandle | null> => {
    const h = parentHandle as unknown;
    if (!isServerHandle(h)) return null;
    const relPath = h.relativePath ? `${h.relativePath}/${name}` : name;
    const ok = await serverApi.createDir(h.project, relPath);
    if (!ok) return null;
    return makeServerHandle(h.project, relPath, 'directory') as unknown as FileSystemDirectoryHandle;
  }, []);

  const deleteEntry = useCallback(async (
    parentHandle: FileSystemDirectoryHandle,
    name: string
  ): Promise<boolean> => {
    const h = parentHandle as unknown;
    if (!isServerHandle(h)) return false;
    const relPath = h.relativePath ? `${h.relativePath}/${name}` : name;
    return serverApi.deleteEntry(h.project, relPath);
  }, []);

  const renameEntry = useCallback(async (
    _parentHandle: FileSystemDirectoryHandle,
    oldName: string,
    newName: string,
    entry: FileSystemEntry
  ): Promise<boolean> => {
    const h = entry.handle as unknown;
    if (!isServerHandle(h)) return false;
    const dir = h.relativePath.split('/').slice(0, -1).join('/');
    const newPath = dir ? `${dir}/${newName}` : newName;
    return serverApi.renameEntry(h.project, h.relativePath, newPath);
  }, []);

  const refreshEntries = useCallback(async () => {
    if (!currentProjectRef.current || !rootEntry) return;
    const items = await serverApi.listDir(currentProjectRef.current, '');
    const rootHandle = makeServerHandle(currentProjectRef.current, '', 'directory');
    setEntries(items.map((item) => entryFromServer(currentProjectRef.current!, item, rootHandle)));
  }, [rootEntry]);

  const setEntries2 = useCallback((updater: (prev: FileSystemEntry[]) => FileSystemEntry[]) => {
    setEntries(updater);
  }, []);

  return {
    rootEntry,
    entries,
    permissionState: 'granted' as const,
    isRestoring,
    rootHandle: rootEntry?.handle as unknown as FileSystemDirectoryHandle | null,
    currentProject,
    openProject,
    expandDirectory,
    readFile,
    writeFile,
    createFile,
    createDirectory,
    deleteEntry,
    renameEntry,
    refreshEntries,
    setEntries: setEntries2,
  };
}


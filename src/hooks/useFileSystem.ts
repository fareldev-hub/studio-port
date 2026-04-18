import { useState, useCallback, useRef } from 'react';
import type { FileSystemEntry, PermissionState } from '@/types';

export function useFileSystem() {
  const [rootEntry, setRootEntry] = useState<FileSystemEntry | null>(null);
  const [entries, setEntries] = useState<FileSystemEntry[]>([]);
  const [permissionState, setPermissionState] = useState<PermissionState>('prompt');
  const rootHandleRef = useRef<FileSystemDirectoryHandle | null>(null);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!rootHandleRef.current) return false;
    try {
      const result = await rootHandleRef.current.requestPermission({ mode: 'readwrite' });
      setPermissionState(result as PermissionState);
      return result === 'granted';
    } catch {
      setPermissionState('denied');
      return false;
    }
  }, []);

  const openFolder = useCallback(async () => {
    try {
      // @ts-ignore - File System Access API
      const handle = await window.showDirectoryPicker();
      rootHandleRef.current = handle;

      const permission = await handle.queryPermission({ mode: 'readwrite' });
      setPermissionState(permission as PermissionState);

      if (permission !== 'granted') {
        const granted = await requestPermission();
        if (!granted) {
          setPermissionState('denied');
          return { success: false, reason: 'denied' as const };
        }
      }

      const root: FileSystemEntry = {
        name: handle.name,
        kind: 'directory',
        handle,
        path: handle.name,
        expanded: true,
        children: [],
      };

      setRootEntry(root);
      const children = await readDirectory(handle, handle.name);
      setEntries(children);

      return { success: true as const, handle, name: handle.name };
    } catch (err) {
      if ((err as Error).name === 'AbortError') {
        return { success: false, reason: 'cancelled' as const };
      }
      return { success: false, reason: 'error' as const, error: err };
    }
  }, [requestPermission]);

  const readDirectory = useCallback(
    async (dirHandle: FileSystemDirectoryHandle, parentPath: string): Promise<FileSystemEntry[]> => {
      const children: FileSystemEntry[] = [];
      try {
        for await (const [name, handle] of dirHandle.entries()) {
          const path = `${parentPath}/${name}`;
          if (handle.kind === 'directory') {
            children.push({
              name,
              kind: 'directory',
              handle,
              parentHandle: dirHandle,
              path,
              expanded: false,
              children: [],
            });
          } else {
            children.push({
              name,
              kind: 'file',
              handle: handle as FileSystemFileHandle,
              parentHandle: dirHandle,
              path,
            });
          }
        }
      } catch {
        // Permission error or other issue
      }
      return children.sort((a, b) => {
        if (a.kind === b.kind) return a.name.localeCompare(b.name);
        return a.kind === 'directory' ? -1 : 1;
      });
    },
    []
  );

  const expandDirectory = useCallback(
    async (entry: FileSystemEntry): Promise<FileSystemEntry[]> => {
      if (entry.kind !== 'directory') return [];
      try {
        const children = await readDirectory(
          entry.handle as FileSystemDirectoryHandle,
          entry.path
        );
        return children;
      } catch {
        return [];
      }
    },
    [readDirectory]
  );

  const readFile = useCallback(async (handle: FileSystemFileHandle): Promise<string> => {
    try {
      const file = await handle.getFile();
      return await file.text();
    } catch {
      return '';
    }
  }, []);

  const writeFile = useCallback(async (handle: FileSystemFileHandle, content: string): Promise<boolean> => {
    try {
      const writable = await handle.createWritable();
      await writable.write(content);
      await writable.close();
      return true;
    } catch {
      return false;
    }
  }, []);

  const createFile = useCallback(
    async (parentHandle: FileSystemDirectoryHandle, name: string): Promise<FileSystemFileHandle | null> => {
      try {
        // @ts-ignore - File System Access API
        const newHandle = await parentHandle.getFileHandle(name, { create: true });
        return newHandle;
      } catch {
        return null;
      }
    },
    []
  );

  const createDirectory = useCallback(
    async (parentHandle: FileSystemDirectoryHandle, name: string): Promise<FileSystemDirectoryHandle | null> => {
      try {
        // @ts-ignore - File System Access API
        const newHandle = await parentHandle.getDirectoryHandle(name, { create: true });
        return newHandle;
      } catch {
        return null;
      }
    },
    []
  );

  const deleteEntry = useCallback(
    async (parentHandle: FileSystemDirectoryHandle, name: string): Promise<boolean> => {
      try {
        // @ts-ignore - File System Access API
        await parentHandle.removeEntry(name, { recursive: true });
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const renameEntry = useCallback(
    async (
      parentHandle: FileSystemDirectoryHandle,
      oldName: string,
      newName: string,
      entry: FileSystemEntry
    ): Promise<boolean> => {
      try {
        // File System Access API doesn't have direct rename, so we copy and delete
        if (entry.kind === 'file') {
          const oldHandle = await parentHandle.getFileHandle(oldName);
          const file = await oldHandle.getFile();
          const content = await file.text();
          // @ts-ignore
          const newHandle = await parentHandle.getFileHandle(newName, { create: true });
          const writable = await newHandle.createWritable();
          await writable.write(content);
          await writable.close();
          // @ts-ignore
          await parentHandle.removeEntry(oldName);
        } else {
          // @ts-ignore
          const oldDirHandle = await parentHandle.getDirectoryHandle(oldName);
          // @ts-ignore
          const newDirHandle = await parentHandle.getDirectoryHandle(newName, { create: true });
          // Copy contents recursively
          await copyDirectory(oldDirHandle, newDirHandle);
          // @ts-ignore
          await parentHandle.removeEntry(oldName, { recursive: true });
        }
        return true;
      } catch {
        return false;
      }
    },
    []
  );

  const refreshEntries = useCallback(async () => {
    if (!rootHandleRef.current || !rootEntry) return;
    const children = await readDirectory(rootHandleRef.current, rootEntry.name);
    setEntries(children);
  }, [rootEntry, readDirectory]);

  return {
    rootEntry,
    entries,
    permissionState,
    rootHandle: rootHandleRef.current,
    openFolder,
    requestPermission,
    readDirectory,
    expandDirectory,
    readFile,
    writeFile,
    createFile,
    createDirectory,
    deleteEntry,
    renameEntry,
    refreshEntries,
    setEntries,
  };
}

async function copyDirectory(src: FileSystemDirectoryHandle, dest: FileSystemDirectoryHandle) {
  // @ts-ignore
  for await (const [name, handle] of src.entries()) {
    if (handle.kind === 'directory') {
      // @ts-ignore
      const newDest = await dest.getDirectoryHandle(name, { create: true });
      await copyDirectory(handle, newDest);
    } else {
      // @ts-ignore
      const newFile = await dest.getFileHandle(name, { create: true });
      const file = await handle.getFile();
      const content = await file.text();
      const writable = await newFile.createWritable();
      await writable.write(content);
      await writable.close();
    }
  }
}

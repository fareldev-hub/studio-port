import { useEffect, useState, useRef } from 'react';
import { serverApi } from '@/lib/serverFs';

interface OpenProjectModalProps {
  onOpen: (projectName: string) => void;
  onClose: () => void;
  onUploadLocal: (projectName: string, files: { path: string; content: string }[]) => Promise<void>;
}

export function OpenProjectModal({ onOpen, onClose, onUploadLocal }: OpenProjectModalProps) {
  const [projects, setProjects] = useState<{ name: string }[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadProjects();
    setTimeout(() => inputRef.current?.focus(), 80);
  }, []);

  async function loadProjects() {
    setLoading(true);
    try {
      const list = await serverApi.listProjects();
      setProjects(list);
    } catch { setError('Cannot reach server. Is the backend running?'); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    if (!newName.trim()) return;
    setCreating(true);
    setError('');
    try {
      const { name } = await serverApi.createProject(newName.trim());
      setProjects((p) => [...p, { name }]);
      onOpen(name);
    } catch (e: unknown) { setError((e as Error).message); }
    finally { setCreating(false); }
  }

  async function handleImportLocal() {
    try {
      // @ts-ignore
      const dirHandle = await window.showDirectoryPicker();
      const projectName = dirHandle.name;
      const files: { path: string; content: string }[] = [];

      async function readAll(handle: FileSystemDirectoryHandle, prefix: string) {
        // @ts-ignore
        for await (const [name, child] of handle.entries()) {
          const rel = prefix ? `${prefix}/${name}` : name;
          if (child.kind === 'directory') {
            await readAll(child, rel);
          } else {
            try {
              const file = await (child as FileSystemFileHandle).getFile();
              const content = await file.text();
              files.push({ path: rel, content });
            } catch { /* skip unreadable */ }
          }
        }
      }

      setUploading(projectName);
      await readAll(dirHandle, '');
      await serverApi.createProject(projectName);
      await onUploadLocal(projectName, files);
      onOpen(projectName);
    } catch (e: unknown) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally { setUploading(null); }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="flex flex-col rounded-lg shadow-2xl"
        style={{ width: 480, maxHeight: '80vh', backgroundColor: '#161616', border: '1px solid #2a2a2a' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-3 flex-shrink-0"
          style={{ borderBottom: '1px solid #2a2a2a' }}
        >
          <div className="flex items-center gap-2">
            <i className="fa-solid fa-folder-open" style={{ color: '#dcdcaa', fontSize: 14 }} />
            <span style={{ color: '#e0e0e0', fontWeight: 600, fontSize: 14 }}>Open Project</span>
          </div>
          <button onClick={onClose} style={{ color: '#555' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#fff')} onMouseLeave={(e) => (e.currentTarget.style.color = '#555')}>
            <i className="fa-solid fa-xmark" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
          {/* Create new */}
          <div>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>New project</p>
            <div className="flex gap-2">
              <input
                ref={inputRef}
                type="text"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                placeholder="project-name"
                className="flex-1 rounded px-3 py-1.5 text-sm outline-none"
                style={{ backgroundColor: '#0d0d0d', border: '1px solid #333', color: '#e0e0e0' }}
              />
              <button
                onClick={handleCreate}
                disabled={creating || !newName.trim()}
                className="px-3 py-1.5 rounded text-sm font-medium transition-opacity"
                style={{ backgroundColor: '#4fc1ff', color: '#000', opacity: (creating || !newName.trim()) ? 0.5 : 1 }}
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>

          {/* Import from local */}
          <div>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Import from your computer</p>
            <button
              onClick={handleImportLocal}
              disabled={!!uploading}
              className="w-full flex items-center justify-center gap-2 py-2 rounded text-sm transition-colors"
              style={{ backgroundColor: '#1a1a1a', border: '1px dashed #333', color: uploading ? '#555' : '#888' }}
              onMouseEnter={(e) => { if (!uploading) { e.currentTarget.style.borderColor = '#4fc1ff'; e.currentTarget.style.color = '#4fc1ff'; } }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#333'; e.currentTarget.style.color = uploading ? '#555' : '#888'; }}
            >
              <i className="fa-solid fa-upload" style={{ fontSize: 12 }} />
              {uploading ? `Uploading "${uploading}"…` : 'Choose a local folder to upload'}
            </button>
          </div>

          {/* Existing projects */}
          <div>
            <p style={{ color: '#888', fontSize: 11, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Existing projects {!loading && `(${projects.length})`}
            </p>
            {loading ? (
              <div className="flex items-center justify-center py-6" style={{ color: '#555', fontSize: 12 }}>
                <i className="fa-solid fa-spinner fa-spin mr-2" /> Loading…
              </div>
            ) : projects.length === 0 ? (
              <div className="flex items-center justify-center py-6" style={{ color: '#444', fontSize: 12 }}>
                No projects yet — create one above
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                {projects.map((p) => (
                  <button
                    key={p.name}
                    onClick={() => onOpen(p.name)}
                    className="flex items-center gap-3 px-3 py-2 rounded text-sm text-left transition-colors"
                    style={{ backgroundColor: '#0d0d0d', border: '1px solid #1e1e1e', color: '#ccc' }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#1a2a3a'; e.currentTarget.style.borderColor = '#4fc1ff40'; e.currentTarget.style.color = '#fff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = '#0d0d0d'; e.currentTarget.style.borderColor = '#1e1e1e'; e.currentTarget.style.color = '#ccc'; }}
                  >
                    <i className="fa-solid fa-folder" style={{ color: '#dcdcaa', fontSize: 13 }} />
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 12 }}>{p.name}</span>
                    <i className="fa-solid fa-arrow-right ml-auto" style={{ fontSize: 11, color: '#444' }} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded text-sm" style={{ backgroundColor: 'rgba(244,71,71,0.1)', border: '1px solid rgba(244,71,71,0.3)', color: '#f44747' }}>
              <i className="fa-solid fa-circle-xmark" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

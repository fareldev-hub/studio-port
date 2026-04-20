export interface ServerHandle {
  __isServer: true;
  project: string;
  relativePath: string;
  kind: 'file' | 'directory';
}

export function isServerHandle(h: unknown): h is ServerHandle {
  return (h as ServerHandle)?.__isServer === true;
}

export function makeServerHandle(project: string, relativePath: string, kind: 'file' | 'directory'): ServerHandle {
  return { __isServer: true, project, relativePath, kind };
}

async function api(url: string, method = 'GET', body?: unknown) {
  const r = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!r.ok) throw new Error(`${method} ${url} → ${r.status}`);
  return r;
}

export const serverApi = {
  async listProjects(): Promise<{ name: string }[]> {
    const r = await api('/api/projects');
    const d = await r.json();
    return d.projects ?? [];
  },

  async createProject(name: string): Promise<{ name: string }> {
    const r = await api('/api/projects', 'POST', { name });
    return r.json();
  },

  async listDir(project: string, relPath = ''): Promise<{ name: string; kind: 'file' | 'directory'; path: string }[]> {
    const r = await api(`/api/files/${encodeURIComponent(project)}/list?path=${encodeURIComponent(relPath)}`);
    const d = await r.json();
    return d.entries ?? [];
  },

  async readFile(project: string, relPath: string): Promise<string> {
    const r = await api(`/api/files/${encodeURIComponent(project)}/read?path=${encodeURIComponent(relPath)}`);
    return r.text();
  },

  async writeFile(project: string, relPath: string, content: string): Promise<boolean> {
    try {
      await api(`/api/files/${encodeURIComponent(project)}/write?path=${encodeURIComponent(relPath)}`, 'PUT', { content });
      return true;
    } catch { return false; }
  },

  async createFile(project: string, relPath: string): Promise<boolean> {
    try {
      await api(`/api/files/${encodeURIComponent(project)}/create`, 'POST', { path: relPath, kind: 'file' });
      return true;
    } catch { return false; }
  },

  async createDir(project: string, relPath: string): Promise<boolean> {
    try {
      await api(`/api/files/${encodeURIComponent(project)}/create`, 'POST', { path: relPath, kind: 'directory' });
      return true;
    } catch { return false; }
  },

  async deleteEntry(project: string, relPath: string): Promise<boolean> {
    try {
      await api(`/api/files/${encodeURIComponent(project)}/delete?path=${encodeURIComponent(relPath)}`, 'DELETE');
      return true;
    } catch { return false; }
  },

  async renameEntry(project: string, oldPath: string, newPath: string): Promise<boolean> {
    try {
      await api(`/api/files/${encodeURIComponent(project)}/rename`, 'POST', { oldPath, newPath });
      return true;
    } catch { return false; }
  },

  async uploadFiles(project: string, files: { path: string; content: string }[]): Promise<number> {
    const r = await api(`/api/files/${encodeURIComponent(project)}/upload`, 'POST', { files });
    const d = await r.json();
    return d.count ?? 0;
  },

  async deleteProject(name: string): Promise<boolean> {
    try {
      await api(`/api/projects/${encodeURIComponent(name)}`, 'DELETE');
      return true;
    } catch { return false; }
  },

  async exportProject(name: string): Promise<{ path: string; content: string }[]> {
    const r = await api(`/api/projects/${encodeURIComponent(name)}/export`);
    const d = await r.json();
    return d.files ?? [];
  },
};

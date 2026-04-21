const express = require('express');
const { createServer } = require('http');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const pty = require('node-pty');
const fs = require('fs');
const fsp = require('fs/promises');
const figlet = require('figlet');

function generateBanner() {
  const logo = figlet.textSync('ThePort', {
    font: 'Standard',
    horizontalLayout: 'default',
    verticalLayout: 'default'
  });
  const line = '─'.repeat(50);
  return `\x1b[36m${logo}\x1b[0m\r\n` +
    `Made by \x1b[1mFarelDev\x1b[0m\r\n` +
    `Tiktok : \x1b[35m@logic__vibes\x1b[0m\r\n` +
    `Web    : \x1b[34mfareldev.vercel.app\x1b[0m\r\n\r\n` +
    `Jika membutuhkan bantuan silahkan ketik "\x1b[33mhelp\x1b[0m"\r\n` +
    `\x1b[90m${line}\x1b[0m\r\n`;
}

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: { origin: "*", methods: ["GET", "POST"] },
  path: '/socket.io/'
});

app.use(express.json({ limit: '50mb' }));

const PORT = process.env.PORT || 3001;
const SHELL = 'bash';
const TERMINAL_BASE = path.resolve(__dirname, 'terminal');

if (!fs.existsSync(TERMINAL_BASE)) fs.mkdirSync(TERMINAL_BASE, { recursive: true });

function safePath(project, relPath) {
  const base = path.join(TERMINAL_BASE, project);
  const full = path.resolve(base, relPath || '');
  if (!full.startsWith(base)) throw new Error('Path escape');
  return full;
}

// ─── Projects ───────────────────────────────────────────────────────────────

app.get('/api/projects', async (req, res) => {
  try {
    const items = await fsp.readdir(TERMINAL_BASE, { withFileTypes: true });
    const projects = items
      .filter(d => d.isDirectory())
      .map(d => ({ name: d.name }));
    res.json({ projects });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/projects', async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: 'name required' });
  const safe = name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const dir = path.join(TERMINAL_BASE, safe);
  try {
    await fsp.mkdir(dir, { recursive: true });
    res.json({ success: true, name: safe });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/projects/:name', async (req, res) => {
  const { name } = req.params;
  const safe = name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const dir = path.join(TERMINAL_BASE, safe);
  if (!dir.startsWith(TERMINAL_BASE)) return res.status(400).json({ error: 'Invalid project name' });
  try {
    await fsp.rm(dir, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/projects/:name/export', async (req, res) => {
  const { name } = req.params;
  const safe = name.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const base = path.join(TERMINAL_BASE, safe);
  if (!base.startsWith(TERMINAL_BASE)) return res.status(400).json({ error: 'Invalid project name' });
  const files = [];
  async function collectFiles(dir, prefix) {
    let items;
    try { items = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
    for (const item of items) {
      const full = path.join(dir, item.name);
      const rel = prefix ? `${prefix}/${item.name}` : item.name;
      if (item.isDirectory()) {
        await collectFiles(full, rel);
      } else {
        try {
          const content = await fsp.readFile(full, 'utf8');
          files.push({ path: rel, content });
        } catch { /* skip binary */ }
      }
    }
  }
  try {
    await collectFiles(base, '');
    res.json({ files });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── File listing (recursive) ────────────────────────────────────────────────

async function listDir(dirPath, relativeTo) {
  const entries = [];
  let items;
  try { items = await fsp.readdir(dirPath, { withFileTypes: true }); }
  catch { return []; }
  for (const item of items) {
    const full = path.join(dirPath, item.name);
    const rel = path.relative(relativeTo, full).replace(/\\/g, '/');
    if (item.isDirectory()) {
      entries.push({ name: item.name, kind: 'directory', path: rel });
    } else {
      entries.push({ name: item.name, kind: 'file', path: rel });
    }
  }
  entries.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'directory' ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
  return entries;
}

app.get('/api/files/:project/list', async (req, res) => {
  const { project } = req.params;
  const rel = req.query.path || '';
  try {
    const base = path.join(TERMINAL_BASE, project);
    const dir = safePath(project, rel);
    const entries = await listDir(dir, base);
    res.json({ entries });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Read file ───────────────────────────────────────────────────────────────

app.get('/api/files/:project/read', async (req, res) => {
  const { project } = req.params;
  const rel = req.query.path || '';
  try {
    const full = safePath(project, rel);
    const content = await fsp.readFile(full, 'utf8');
    res.type('text/plain').send(content);
  } catch (e) { res.status(404).json({ error: e.message }); }
});

// ─── Write file ──────────────────────────────────────────────────────────────

app.put('/api/files/:project/write', async (req, res) => {
  const { project } = req.params;
  const rel = req.query.path || '';
  try {
    const full = safePath(project, rel);
    await fsp.mkdir(path.dirname(full), { recursive: true });
    await fsp.writeFile(full, req.body.content ?? '', 'utf8');
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Create file/directory ───────────────────────────────────────────────────

app.post('/api/files/:project/create', async (req, res) => {
  const { project } = req.params;
  const { path: rel, kind } = req.body;
  try {
    const full = safePath(project, rel);
    if (kind === 'directory') {
      await fsp.mkdir(full, { recursive: true });
    } else {
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, '', 'utf8');
    }
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Delete ──────────────────────────────────────────────────────────────────

app.delete('/api/files/:project/delete', async (req, res) => {
  const { project } = req.params;
  const rel = req.query.path || '';
  try {
    const full = safePath(project, rel);
    await fsp.rm(full, { recursive: true, force: true });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Rename ──────────────────────────────────────────────────────────────────

app.post('/api/files/:project/rename', async (req, res) => {
  const { project } = req.params;
  const { oldPath, newPath } = req.body;
  try {
    const oldFull = safePath(project, oldPath);
    const newFull = safePath(project, newPath);
    await fsp.rename(oldFull, newFull);
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Bulk upload ─────────────────────────────────────────────────────────────

app.post('/api/files/:project/upload', async (req, res) => {
  const { project } = req.params;
  const { files } = req.body; // [{path, content}]
  if (!Array.isArray(files)) return res.status(400).json({ error: 'files array required' });
  try {
    const base = path.join(TERMINAL_BASE, project);
    await fsp.mkdir(base, { recursive: true });
    let count = 0;
    for (const f of files) {
      const full = safePath(project, f.path);
      await fsp.mkdir(path.dirname(full), { recursive: true });
      await fsp.writeFile(full, f.content ?? '', 'utf8');
      count++;
    }
    res.json({ success: true, count });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Terminal directory helper ────────────────────────────────────────────────

app.post('/api/terminal/create-dir', (req, res) => {
  const { folderName } = req.body;
  if (!folderName) return res.status(400).json({ error: 'folderName required' });
  const safe = folderName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
  const dir = path.join(TERMINAL_BASE, safe);
  try {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    res.json({ success: true, path: dir });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Socket.IO / Terminal ────────────────────────────────────────────────────

io.on('connection', (socket) => {
  const rawIP = socket.handshake.headers['x-forwarded-for'] || socket.handshake.address || '127.0.0.1';
  const clientIP = rawIP.split(',')[0].trim();

  const customPS1 = `\\[\\e[36m\\]╭┈┈┈┈┈┈\\[\\e[0m\\]\\[\\e[1;37m\\][ Ubuntu \\[\\e[32m\\]${clientIP}\\[\\e[37m\\] ]\\n\\[\\e[36m\\]╰─∘\\[\\e[0m\\] terminal \\[\\e[33m\\]@${clientIP}\\[\\e[0m\\] \\$ `;

  const ptyProcess = pty.spawn(SHELL, ['--norc', '--noprofile', '-i'], {
    name: 'xterm-256color',
    cols: 90,
    rows: 30,
    cwd: TERMINAL_BASE,
    env: {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PS1: customPS1,
      THEPORT_BASE: TERMINAL_BASE,
    }
  });

  socket.emit('terminal:data', '\x1b[2J\x1b[3J\x1b[H' + generateBanner());

  // Inject restricted cd function so users cannot navigate outside TERMINAL_BASE
  const initFile = path.join(os.tmpdir(), `theport_init_${Date.now()}.sh`);
  const initScript = [
    `export THEPORT_BASE="${TERMINAL_BASE}"`,
    `cd() {`,
    `  local target`,
    `  if [ $# -eq 0 ]; then`,
    `    builtin cd "$THEPORT_BASE" 2>/dev/null; return`,
    `  fi`,
    `  target=$(realpath -m "$1" 2>/dev/null)`,
    `  if [[ "$target" != "$THEPORT_BASE"* ]]; then`,
    `    echo "bash: cd: $1: No such file or directory"; return 1`,
    `  fi`,
    `  builtin cd "$target"`,
    `}`,
    `export -f cd`,
    `rm -f "${initFile}"`,
  ].join('\n');
  fs.writeFileSync(initFile, initScript);
  setTimeout(() => {
    ptyProcess.write(`source "${initFile}" > /dev/null 2>&1\r`);
  }, 200);

  let buffer = '';

  ptyProcess.onData((data) => { socket.emit('terminal:data', data); });

  socket.on('terminal:input', (data) => {
    if (data === '\r') {
      const cmd = buffer.trim();
      if (cmd === 'clear') {
        buffer = '';
        socket.emit('terminal:data', '\x1b[2J\x1b[3J\x1b[H' + generateBanner());
        ptyProcess.write('\x0c');
        return;
      }
      if (cmd === 'clear --force') {
        buffer = '';
        socket.emit('terminal:data', '\x1b[2J\x1b[3J\x1b[H');
        ptyProcess.write('\x0c');
        return;
      }
      buffer = '';
    } else if (data === '\u007f') {
      buffer = buffer.slice(0, -1);
    } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
      buffer += data;
    }
    if (ptyProcess) ptyProcess.write(data);
  });

  socket.on('terminal:set-folder', (folderName) => {
    if (!folderName || typeof folderName !== 'string') return;
    const safe = folderName.replace(/[^a-zA-Z0-9_\-. ]/g, '_');
    const dir = path.join(TERMINAL_BASE, safe);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    const projectPS1 = `$'\\[\\e[36m\\]╭┈┈┈┈┈┈\\[\\e[0m\\]\\[\\e[1;37m\\][ Ubuntu \\[\\e[32m\\]${clientIP}\\[\\e[37m\\] ]\\n\\[\\e[36m\\]╰─∘\\[\\e[0m\\] terminal/${safe} \\[\\e[33m\\]@${clientIP}\\[\\e[0m\\] \\\\$ '`;
    ptyProcess.write(`cd "${dir}" && export PS1=${projectPS1}\r`);
  });

  socket.on('terminal:resize', ({ cols, rows }) => {
    try { ptyProcess.resize(cols, rows); } catch (_) {}
  });

  socket.on('disconnect', () => {
    try { ptyProcess.kill(); } catch (_) {}
  });
});

httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`Terminal server started on port ${PORT}`);
});

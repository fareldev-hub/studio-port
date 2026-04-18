# CodeStudio - Web IDE

A browser-based coding IDE with direct filesystem access, multi-tab code editor with syntax highlighting, and an integrated Linux terminal. All files and folders are stored on your local device — nothing is uploaded to any server.

## Features

- **File Explorer** - Access your local files and folders using the File System Access API
- **Multi-Tab Editor** - Edit multiple files with syntax highlighting powered by Monaco Editor
- **Linux Terminal** - Integrated terminal with full Linux shell access (via Express.js backend)
- **Permission Notifications** - Transparent permission system that keeps you informed
- **FontAwesome Icons** - Professional iconography throughout the interface
- **Keyboard Shortcuts** - Full keyboard support for power users

## File System Access

CodeStudio uses the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API) to read and write files directly on your device:

- Files are stored **locally** on your computer
- The app requests permission each session
- Nothing is uploaded to any server
- All data stays private

### Supported Browsers

- Chrome 86+
- Edge 86+
- Opera 72+
- Other Chromium-based browsers

> Note: Firefox and Safari do not yet support the File System Access API.

## Getting Started

### 1. Run the Frontend (Static)

The frontend is a static React app that can be served by any static file server:

```bash
# After building
npm run build

# Serve with any static server
npx serve dist
# or
python3 -m http.server 3000 -d dist
```

### 2. Run the Express.js Backend (for Terminal)

To enable the full Linux terminal, you need to run the Express.js backend:

```bash
cd server
npm install
npm start
```

The backend will:
- Start on port 3001
- Serve the frontend static files
- Provide a real Linux PTY terminal via node-pty
- Handle WebSocket connections for real-time terminal I/O

### Prerequisites for Terminal Backend

- **Linux/macOS**: node-pty works natively
- **Windows**: Use WSL2 (Windows Subsystem for Linux)

```bash
# On Linux/macOS/WSL:
sudo apt-get install -y build-essential  # Debian/Ubuntu
# or
xcode-select --install  # macOS
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+O` | Open folder |
| `Ctrl+N` | New file |
| `Ctrl+Shift+N` | New folder |
| `Ctrl+S` | Save current file |
| `Ctrl+W` | Close current tab |
| `Ctrl+\`` | Toggle terminal panel |
| `Ctrl+B` | Toggle sidebar |
| `F2` | Rename selected file |
| `Delete` | Delete selected file/folder |

## Project Structure

```
codestudio/
├── src/                          # Frontend source
│   ├── components/               # React components
│   │   ├── TitleBar.tsx          # App title bar
│   │   ├── FileExplorer.tsx      # File tree sidebar
│   │   ├── Editor.tsx            # Monaco code editor
│   │   ├── Terminal.tsx          # XTerm.js terminal
│   │   ├── StatusBar.tsx         # Bottom status bar
│   │   ├── ToastContainer.tsx    # Notification toasts
│   │   ├── ContextMenu.tsx       # Right-click menus
│   │   ├── NewItemModal.tsx      # Create file/folder dialog
│   │   └── DeleteConfirmModal.tsx # Delete confirmation
│   ├── hooks/                    # Custom React hooks
│   │   ├── useFileSystem.ts      # File System Access API hook
│   │   └── useToast.ts           # Toast notification hook
│   ├── lib/                      # Utilities
│   │   ├── fileIcons.ts          # File icon mappings
│   │   └── monacoTheme.ts        # Custom editor theme
│   ├── types/                    # TypeScript types
│   ├── App.tsx                   # Main app component
│   └── main.tsx                  # Entry point
├── server/                       # Express.js backend
│   ├── server.js                 # Main server file
│   └── package.json              # Server dependencies
├── dist/                         # Built frontend
└── README.md                     # This file
```

## Tech Stack

### Frontend
- React 19 + TypeScript
- Vite (build tool)
- Tailwind CSS (styling)
- Monaco Editor (code editing)
- XTerm.js + @xterm/xterm (terminal)
- FontAwesome 6 (icons)
- File System Access API (filesystem)

### Backend
- Express.js (HTTP server)
- Socket.IO (WebSocket communication)
- node-pty (PTY process spawning)

## Architecture

### Frontend-Only Mode
When running without the backend:
- File explorer works fully via File System Access API
- Editor works with syntax highlighting
- Terminal runs a local shell emulator with basic commands

### Full Mode (with Backend)
When the Express.js backend is running:
- Everything from frontend-only mode
- Terminal connects to a real Linux PTY via WebSocket
- Full shell access with all Linux commands available
- All programming languages, tools, and system utilities accessible

## Security Notes

- The File System Access API requires explicit user permission for every folder
- Permissions are scoped per-origin and per-folder
- The app cannot access files outside the folders you explicitly open
- No data leaves your machine
- The terminal backend runs locally on your system

## License

MIT

# CodeStudio

A browser-based IDE with file explorer, Monaco Editor, and integrated terminal.

## Architecture

- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS
  - Runs on port 5000
  - Uses Monaco Editor for code editing
  - Uses XTerm.js for terminal UI
  - File System Access API for local file management
- **Backend**: Express.js + Socket.IO + node-pty
  - Runs on port 3001
  - Provides real Linux PTY terminal via WebSockets
  - Proxied through Vite dev server in development

## Running the Project

Two workflows run simultaneously:
1. **Start application** - Vite dev server on port 5000 (frontend)
2. **Backend Server** - Express server on port 3001 (terminal/socket backend)

Vite proxies `/api` and `/socket.io` to the backend at localhost:3001.

## Key Files

- `src/` - Frontend source (React components)
- `server/server.js` - Express + Socket.IO backend
- `vite.config.ts` - Vite configuration with proxy settings
- `src/components/Editor.tsx` - Monaco Editor integration
- `src/components/Terminal.tsx` - XTerm.js terminal
- `src/hooks/useFileSystem.ts` - File System Access API hook

## Deployment

Configured for autoscale deployment:
- Build: `npm run build && cd server && npm install`
- Run: `node server/server.js` (serves the built frontend from `dist/`)

import { useEffect, useRef, useState, useCallback } from 'react';
import type { OpenTab } from '@/types';

interface ConsoleEntry {
  id: number;
  type: 'log' | 'warn' | 'error' | 'info';
  args: string[];
  timestamp: string;
}

interface HtmlPreviewProps {
  content: string;
  fileName: string;
  currentPath?: string;
  tabs?: OpenTab[];
  onRequestFile?: (fileName: string, currentPath: string) => Promise<string | null>;
  onClose: () => void;
}

let consoleId = 0;

function getDir(path: string): string {
  const parts = path.split('/');
  parts.pop();
  return parts.join('/');
}

function basename(src: string): string {
  return src.split('/').pop() || src;
}

async function buildHtmlWithAssets(
  htmlContent: string,
  currentPath: string,
  tabs: OpenTab[],
  onRequestFile?: (fileName: string, currentPath: string) => Promise<string | null>
): Promise<string> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(htmlContent, 'text/html');
  const dir = getDir(currentPath);

  // Resolve CSS <link> tags
  const links = Array.from(doc.querySelectorAll('link[rel="stylesheet"][href]'));
  for (const link of links) {
    const href = link.getAttribute('href') || '';
    if (href.startsWith('http://') || href.startsWith('https://') || href.startsWith('//')) continue;
    const fileName = basename(href);
    const inTab = tabs.find((t) => t.name === fileName);
    let cssContent = inTab?.content ?? null;
    if (!cssContent && onRequestFile) {
      cssContent = await onRequestFile(fileName, currentPath);
    }
    if (cssContent !== null) {
      const style = doc.createElement('style');
      style.setAttribute('data-src', fileName);
      style.textContent = cssContent;
      link.parentNode?.replaceChild(style, link);
    }
  }

  // Resolve JS <script src> tags (skip external)
  const scripts = Array.from(doc.querySelectorAll('script[src]'));
  for (const script of scripts) {
    const src = script.getAttribute('src') || '';
    if (src.startsWith('http://') || src.startsWith('https://') || src.startsWith('//')) continue;
    const fileName = basename(src);
    const inTab = tabs.find((t) => t.name === fileName);
    let jsContent = inTab?.content ?? null;
    if (!jsContent && onRequestFile) {
      jsContent = await onRequestFile(fileName, currentPath);
    }
    if (jsContent !== null) {
      const newScript = doc.createElement('script');
      newScript.setAttribute('data-src', fileName);
      newScript.textContent = jsContent;
      script.parentNode?.replaceChild(newScript, script);
    }
  }

  const consoleInterceptor = `
<script>
(function() {
  var _methods = ['log','warn','error','info'];
  _methods.forEach(function(method) {
    var original = console[method].bind(console);
    console[method] = function() {
      var args = Array.from(arguments).map(function(a) {
        try { return typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a); }
        catch(e) { return String(a); }
      });
      window.parent.postMessage({ __consoleEvent: true, type: method, args: args }, '*');
      original.apply(console, arguments);
    };
  });
  window.addEventListener('error', function(e) {
    window.parent.postMessage({ __consoleEvent: true, type: 'error', args: [e.message + (e.filename ? ' (' + e.filename + ':' + e.lineno + ')' : '')] }, '*');
  });
})();
</script>
`;

  const head = doc.querySelector('head') || doc.documentElement;
  head.insertAdjacentHTML('afterbegin', consoleInterceptor);

  return '<!DOCTYPE html>\n' + doc.documentElement.outerHTML;
}

export function HtmlPreview({ content, fileName, currentPath = '', tabs = [], onRequestFile, onClose }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [consoleEntries, setConsoleEntries] = useState<ConsoleEntry[]>([]);
  const [consoleVisible, setConsoleVisible] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(140);
  const consoleResizeRef = useRef<{ active: boolean; startY: number; startH: number }>({ active: false, startY: 0, startH: 140 });
  const [isBuilding, setIsBuilding] = useState(false);

  const buildAndLoad = useCallback(async () => {
    setIsBuilding(true);
    const resolved = await buildHtmlWithAssets(content, currentPath, tabs, onRequestFile);
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blob = new Blob([resolved], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    if (iframeRef.current) iframeRef.current.src = url;
    setIsBuilding(false);
  }, [content, currentPath, tabs, onRequestFile]);

  useEffect(() => {
    buildAndLoad();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [content]);

  // Listen for console messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.__consoleEvent) return;
      const now = new Date();
      const ts = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
      setConsoleEntries((prev) => [...prev, { id: ++consoleId, type: e.data.type, args: e.data.args, timestamp: ts }]);
      if (!consoleVisible) setConsoleVisible(true);
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [consoleVisible]);

  const openInBrowser = () => {
    buildHtmlWithAssets(content, currentPath, tabs, onRequestFile).then((resolved) => {
      const blob = new Blob([resolved], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    });
  };

  const consoleColor = (type: ConsoleEntry['type']) => {
    if (type === 'error') return '#f44747';
    if (type === 'warn') return '#dcdcaa';
    if (type === 'info') return '#4fc1ff';
    return '#cccccc';
  };
  const consoleBg = (type: ConsoleEntry['type']) => {
    if (type === 'error') return 'rgba(244,71,71,0.07)';
    if (type === 'warn') return 'rgba(220,220,170,0.07)';
    return 'transparent';
  };

  const handleConsoleResizeStart = (e: React.MouseEvent) => {
    consoleResizeRef.current = { active: true, startY: e.clientY, startH: consoleHeight };
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!consoleResizeRef.current.active) return;
      const delta = consoleResizeRef.current.startY - e.clientY;
      setConsoleHeight(Math.max(60, Math.min(400, consoleResizeRef.current.startH + delta)));
    };
    const onUp = () => {
      consoleResizeRef.current.active = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp); };
  }, []);

  const errorCount = consoleEntries.filter((e) => e.type === 'error').length;
  const warnCount = consoleEntries.filter((e) => e.type === 'warn').length;

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: '#141414' }}>
      {/* Toolbar */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{ height: 32, backgroundColor: '#1a1a1a', borderBottom: '1px solid #2a2a2a' }}
      >
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-eye" style={{ color: '#4fc1ff', fontSize: 11 }} />
          <span style={{ color: '#888', fontSize: 11 }}>Preview — {fileName}</span>
          {isBuilding && <span style={{ color: '#666', fontSize: 10 }}>building…</span>}
        </div>

        <div className="flex items-center gap-1">
          {/* Console toggle */}
          <button
            onClick={() => setConsoleVisible((v) => !v)}
            className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors"
            style={{
              fontSize: 10,
              color: consoleVisible ? '#dcdcaa' : '#666',
              backgroundColor: consoleVisible ? 'rgba(220,220,170,0.1)' : 'transparent',
              border: consoleVisible ? '1px solid rgba(220,220,170,0.25)' : '1px solid transparent',
            }}
            title="Toggle Console"
          >
            <i className="fa-solid fa-terminal" style={{ fontSize: 9 }} />
            <span className="ml-1">Console</span>
            {errorCount > 0 && (
              <span className="ml-1 px-1 rounded-full text-xs" style={{ backgroundColor: 'rgba(244,71,71,0.3)', color: '#f44747', fontSize: 9 }}>{errorCount}</span>
            )}
            {warnCount > 0 && errorCount === 0 && (
              <span className="ml-1 px-1 rounded-full text-xs" style={{ backgroundColor: 'rgba(220,220,170,0.2)', color: '#dcdcaa', fontSize: 9 }}>{warnCount}</span>
            )}
          </button>

          {/* Open in browser */}
          <button
            onClick={openInBrowser}
            className="flex items-center gap-1 px-2 py-0.5 rounded transition-colors"
            style={{ fontSize: 10, color: '#888', border: '1px solid #333' }}
            title="Open in browser tab"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = '#222'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#888'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-arrow-up-right-from-square" style={{ fontSize: 9 }} />
            <span className="ml-1">Browser</span>
          </button>

          {/* Refresh */}
          <button
            onClick={buildAndLoad}
            className="p-1 rounded transition-colors ml-1"
            style={{ color: '#666' }}
            title="Refresh preview"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: 11 }} />
          </button>

          {/* Close */}
          <button
            onClick={onClose}
            className="p-1 rounded transition-colors"
            style={{ color: '#666' }}
            title="Close preview"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#f44747'; e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: 11 }} />
          </button>
        </div>
      </div>

      {/* Preview iframe */}
      <div className="flex-1 relative overflow-hidden" style={{ backgroundColor: '#fff' }}>
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="HTML Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups"
        />
      </div>

      {/* Console Panel */}
      {consoleVisible && (
        <>
          <div
            className="flex-shrink-0 cursor-row-resize"
            style={{ height: 4, backgroundColor: '#2a2a2a' }}
            onMouseDown={handleConsoleResizeStart}
          />
          <div
            className="flex-shrink-0 flex flex-col"
            style={{ height: consoleHeight, backgroundColor: '#0d0d0d', borderTop: '1px solid #2a2a2a' }}
          >
            {/* Console header */}
            <div
              className="flex items-center justify-between px-3 flex-shrink-0"
              style={{ height: 26, backgroundColor: '#141414', borderBottom: '1px solid #1e1e1e' }}
            >
              <div className="flex items-center gap-2">
                <i className="fa-solid fa-terminal" style={{ color: '#dcdcaa', fontSize: 10 }} />
                <span style={{ color: '#888', fontSize: 10 }}>Console</span>
                {consoleEntries.length > 0 && (
                  <span style={{ color: '#555', fontSize: 9 }}>{consoleEntries.length} message{consoleEntries.length !== 1 ? 's' : ''}</span>
                )}
              </div>
              <button
                onClick={() => setConsoleEntries([])}
                className="text-xs rounded px-1.5 py-0.5 transition-colors"
                style={{ color: '#555', fontSize: 9 }}
                title="Clear console"
                onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = '#555'; e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                <i className="fa-solid fa-trash-can" style={{ fontSize: 9 }} /> Clear
              </button>
            </div>

            {/* Console entries */}
            <div className="flex-1 overflow-y-auto" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11 }}>
              {consoleEntries.length === 0 ? (
                <div className="flex items-center justify-center h-full" style={{ color: '#444', fontSize: 11 }}>
                  No console output yet
                </div>
              ) : (
                consoleEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-start gap-2 px-3 py-0.5 border-b"
                    style={{ borderColor: '#1a1a1a', backgroundColor: consoleBg(entry.type) }}
                  >
                    <span style={{ color: '#444', fontSize: 9, paddingTop: 2, minWidth: 52, flexShrink: 0 }}>{entry.timestamp}</span>
                    <span style={{ color: consoleColor(entry.type), flexShrink: 0, fontSize: 10 }}>
                      {entry.type === 'error' && <i className="fa-solid fa-circle-xmark mr-1" />}
                      {entry.type === 'warn' && <i className="fa-solid fa-triangle-exclamation mr-1" />}
                      {entry.type === 'info' && <i className="fa-solid fa-circle-info mr-1" />}
                      {entry.type === 'log' && <i className="fa-solid fa-angle-right mr-1" style={{ opacity: 0.4 }} />}
                    </span>
                    <span style={{ color: consoleColor(entry.type), whiteSpace: 'pre-wrap', wordBreak: 'break-all', lineHeight: 1.5 }}>
                      {entry.args.join(' ')}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

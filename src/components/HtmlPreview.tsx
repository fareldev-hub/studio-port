import { useEffect, useRef, useState } from 'react';

interface HtmlPreviewProps {
  content: string;
  fileName: string;
  onClose: () => void;
}

export function HtmlPreview({ content, fileName, onClose }: HtmlPreviewProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const blobUrlRef = useRef<string | null>(null);
  const [mode, setMode] = useState<'inapp' | 'browser'>('inapp');

  const updatePreview = () => {
    if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    blobUrlRef.current = url;
    if (iframeRef.current) {
      iframeRef.current.src = url;
    }
    return url;
  };

  useEffect(() => {
    updatePreview();
    return () => {
      if (blobUrlRef.current) URL.revokeObjectURL(blobUrlRef.current);
    };
  }, [content]);

  const openInBrowser = () => {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  };

  return (
    <div className="flex flex-col h-full w-full" style={{ backgroundColor: '#141414' }}>
      {/* Preview toolbar */}
      <div
        className="flex items-center justify-between px-3 flex-shrink-0"
        style={{
          height: 32,
          backgroundColor: '#1a1a1a',
          borderBottom: '1px solid #2a2a2a',
        }}
      >
        <div className="flex items-center gap-2">
          <i className="fa-solid fa-eye" style={{ color: '#4fc1ff', fontSize: 11 }} />
          <span style={{ color: '#888', fontSize: 11 }}>Preview — {fileName}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Mode switcher */}
          <div
            className="flex rounded overflow-hidden"
            style={{ border: '1px solid #333', fontSize: 10 }}
          >
            <button
              onClick={() => setMode('inapp')}
              className="px-2 py-0.5 transition-colors"
              style={{
                backgroundColor: mode === 'inapp' ? '#4fc1ff' : 'transparent',
                color: mode === 'inapp' ? '#000' : '#888',
              }}
            >
              In App
            </button>
            <button
              onClick={() => { setMode('browser'); openInBrowser(); }}
              className="px-2 py-0.5 transition-colors"
              style={{
                backgroundColor: mode === 'browser' ? '#4fc1ff' : 'transparent',
                color: mode === 'browser' ? '#000' : '#888',
              }}
            >
              <i className="fa-solid fa-arrow-up-right-from-square mr-1" />
              In Browser
            </button>
          </div>

          <button
            onClick={updatePreview}
            className="p-1 rounded transition-colors ml-1"
            style={{ color: '#666' }}
            title="Refresh preview"
            onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.backgroundColor = '#2a2a2a'; }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#666'; e.currentTarget.style.backgroundColor = 'transparent'; }}
          >
            <i className="fa-solid fa-rotate-right" style={{ fontSize: 11 }} />
          </button>

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
      <div className="flex-1 relative" style={{ backgroundColor: '#fff' }}>
        <iframe
          ref={iframeRef}
          className="w-full h-full border-0"
          title="HTML Preview"
          sandbox="allow-scripts allow-same-origin allow-forms allow-modals"
        />
      </div>
    </div>
  );
}

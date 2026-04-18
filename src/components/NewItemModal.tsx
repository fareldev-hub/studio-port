import { useState, useRef, useEffect } from 'react';

interface NewItemModalProps {
  type: 'file' | 'folder';
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export function NewItemModal({ type, onCreate, onCancel }: NewItemModalProps) {
  const [name, setName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onCreate(name.trim());
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg p-5 w-full max-w-md"
        style={{
          backgroundColor: 'var(--bg-titlebar)',
          border: '1px solid var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          className="text-sm font-semibold mb-4"
          style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}
        >
          New {type === 'file' ? 'File' : 'Folder'}
        </h3>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              className="block text-xs mb-1.5"
              style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}
            >
              {type === 'file' ? 'File name' : 'Folder name'}
            </label>
            <input
              ref={inputRef}
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={type === 'file' ? 'example.js' : 'my-folder'}
              className="w-full rounded outline-none transition-colors"
              style={{
                backgroundColor: 'var(--bg-input)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-primary)',
                padding: '8px 12px',
                fontSize: 13,
                fontFamily: 'Inter, sans-serif',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent-blue)')}
              onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
            />
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-1.5 rounded text-xs font-medium transition-colors"
              style={{
                color: 'var(--text-secondary)',
                backgroundColor: 'transparent',
                border: '1px solid var(--border-primary)',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--bg-hover)')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!name.trim()}
              className="px-4 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-90"
              style={{
                backgroundColor: 'var(--accent-blue)',
                color: '#0d0d0d',
                opacity: name.trim() ? 1 : 0.5,
                cursor: name.trim() ? 'pointer' : 'not-allowed',
              }}
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

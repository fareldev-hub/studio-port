import { useEffect, useRef } from 'react';
import type { ContextMenuItem } from '@/types';

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  // Adjust position to avoid going off-screen
  const adjustedX = Math.min(x, window.innerWidth - 180);
  const adjustedY = Math.min(y, window.innerHeight - items.length * 32);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 py-1 rounded"
      style={{
        left: adjustedX,
        top: adjustedY,
        minWidth: 160,
        backgroundColor: 'var(--bg-titlebar)',
        border: '1px solid var(--border-primary)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      {items.map((item, i) =>
        item.divider ? (
          <div key={i} className="my-1" style={{ height: 1, backgroundColor: 'var(--border-primary)' }} />
        ) : (
          <button
            key={i}
            onClick={() => {
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            className="flex items-center justify-between w-full px-3 transition-colors"
            style={{
              height: 28,
              color: item.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
              opacity: item.disabled ? 0.5 : 1,
              cursor: item.disabled ? 'not-allowed' : 'pointer',
            }}
            onMouseEnter={(e) => {
              if (!item.disabled) e.currentTarget.style.backgroundColor = 'var(--bg-hover)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            <div className="flex items-center gap-2">
              {item.icon && (
                <i className={`fa-solid ${item.icon}`} style={{ fontSize: 13, color: 'var(--text-muted)', width: 16, textAlign: 'center' }} />
              )}
              <span className="text-xs" style={{ fontFamily: 'Inter, sans-serif' }}>
                {item.label}
              </span>
            </div>
            {item.shortcut && (
              <span className="text-xs ml-4" style={{ color: 'var(--text-muted)' }}>
                {item.shortcut}
              </span>
            )}
          </button>
        )
      )}
    </div>
  );
}

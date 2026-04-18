import { useEffect, useRef, useState } from 'react';
import type { ToastNotification } from '@/types';

interface ToastContainerProps {
  toasts: ToastNotification[];
  onRemove: (id: string) => void;
}

export function ToastContainer({ toasts, onRemove }: ToastContainerProps) {
  return (
    <div
      className="fixed z-50 flex flex-col gap-2"
      style={{ bottom: 40, right: 16, maxWidth: 400 }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={onRemove} />
      ))}
    </div>
  );
}

function ToastItem({ toast, onRemove }: { toast: ToastNotification; onRemove: (id: string) => void }) {
  const [exiting, setExiting] = useState(false);
  const progressRef = useRef<HTMLDivElement>(null);

  const accentColors: Record<string, string> = {
    'permission-request': 'var(--accent-yellow)',
    'permission-granted': 'var(--accent-green)',
    'permission-denied': 'var(--accent-red)',
    'file-saved': 'var(--accent-blue)',
    error: 'var(--accent-red)',
    info: 'var(--accent-blue)',
  };

  const iconMap: Record<string, string> = {
    'permission-request': 'fa-triangle-exclamation',
    'permission-granted': 'fa-circle-check',
    'permission-denied': 'fa-circle-xmark',
    'file-saved': 'fa-floppy-disk',
    error: 'fa-circle-exclamation',
    info: 'fa-circle-info',
  };

  const accentColor = accentColors[toast.type] || 'var(--accent-blue)';
  const icon = iconMap[toast.type] || 'fa-circle-info';

  const handleDismiss = () => {
    setExiting(true);
    setTimeout(() => onRemove(toast.id), 200);
  };

  useEffect(() => {
    if (toast.autoDismiss && toast.autoDismiss > 0 && progressRef.current) {
      progressRef.current.style.animationDuration = `${toast.autoDismiss}ms`;
    }
  }, [toast.autoDismiss]);

  return (
    <div
      className={`toast-enter rounded overflow-hidden ${exiting ? 'toast-exit' : ''}`}
      style={{
        backgroundColor: 'var(--bg-titlebar)',
        border: '1px solid var(--border-primary)',
        borderLeft: `3px solid ${accentColor}`,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
      }}
    >
      <div className="px-4 py-3">
        {/* Header */}
        <div className="flex items-start gap-2.5">
          <i
            className={`fa-solid ${icon} mt-0.5 flex-shrink-0`}
            style={{ color: accentColor, fontSize: 14 }}
          />
          <div className="flex-1 min-w-0">
            <div
              className="font-medium text-sm mb-0.5"
              style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif' }}
            >
              {toast.title}
            </div>
            <div
              className="text-xs leading-relaxed"
              style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}
            >
              {toast.message}
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="flex-shrink-0 p-0.5 rounded transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--text-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
          >
            <i className="fa-solid fa-xmark" style={{ fontSize: 12 }} />
          </button>
        </div>

        {/* Actions */}
        {toast.actions && toast.actions.length > 0 && (
          <div className="flex gap-2 mt-2.5 ml-6">
            {toast.actions.map((action, i) => (
              <button
                key={i}
                onClick={() => {
                  action.onClick();
                  handleDismiss();
                }}
                className="px-3 py-1 rounded text-xs font-medium transition-opacity hover:opacity-90"
                style={{
                  backgroundColor:
                    action.variant === 'primary'
                      ? 'var(--accent-blue)'
                      : action.variant === 'danger'
                      ? 'var(--accent-red)'
                      : 'transparent',
                  color:
                    action.variant === 'primary' || action.variant === 'danger'
                      ? '#0d0d0d'
                      : 'var(--text-secondary)',
                  border:
                    action.variant === 'secondary'
                      ? '1px solid var(--border-primary)'
                      : 'none',
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Progress bar for auto-dismiss */}
      {toast.autoDismiss && toast.autoDismiss > 0 && (
        <div
          ref={progressRef}
          className="toast-progress h-0.5"
          style={{ backgroundColor: accentColor, opacity: 0.3 }}
        />
      )}
    </div>
  );
}

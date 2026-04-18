interface DeleteConfirmModalProps {
  fileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteConfirmModal({ fileName, onConfirm, onCancel }: DeleteConfirmModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="rounded-lg p-5 w-full max-w-sm text-center"
        style={{
          backgroundColor: 'var(--bg-titlebar)',
          border: '1px solid var(--border-primary)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <i
          className="fa-solid fa-triangle-exclamation mb-3"
          style={{ fontSize: 32, color: 'var(--accent-red)' }}
        />

        <h3
          className="text-sm font-semibold mb-2"
          style={{ color: 'var(--text-primary)', fontFamily: 'Inter, sans-serif', letterSpacing: '0.02em' }}
        >
          Delete &quot;{fileName}&quot;?
        </h3>

        <p
          className="text-xs mb-5"
          style={{ color: 'var(--text-secondary)', fontFamily: 'Inter, sans-serif' }}
        >
          This action cannot be undone.
        </p>

        <div className="flex justify-center gap-2">
          <button
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
            onClick={onConfirm}
            className="px-4 py-1.5 rounded text-xs font-medium transition-opacity hover:opacity-90"
            style={{
              backgroundColor: 'var(--accent-red)',
              color: '#0d0d0d',
            }}
          >
            <i className="fa-solid fa-trash-can mr-1.5" />
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

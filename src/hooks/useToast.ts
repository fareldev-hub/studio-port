import { useState, useCallback, useRef, useEffect } from 'react';
import type { ToastNotification } from '@/types';

export function useToast() {
  const [toasts, setToasts] = useState<ToastNotification[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const idCounter = useRef(0);

  const generateId = () => `toast-${++idCounter.current}-${Date.now()}`;

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addToast = useCallback((toast: Omit<ToastNotification, 'id'>) => {
    const id = generateId();
    const newToast: ToastNotification = { ...toast, id };
    setToasts((prev) => [...prev.slice(-4), newToast]);

    if (toast.autoDismiss && toast.autoDismiss > 0) {
      const timer = setTimeout(() => {
        removeToast(id);
      }, toast.autoDismiss);
      timersRef.current.set(id, timer);
    }

    return id;
  }, [removeToast]);

  const showPermissionRequest = useCallback(
    (folderName: string, onAllow: () => void, onDeny: () => void) => {
      return addToast({
        type: 'permission-request',
        title: 'Permission Required',
        message: `CodeStudio needs access to "${folderName}" to read and write files.`,
        autoDismiss: 0,
        actions: [
          { label: 'Allow', variant: 'primary', onClick: onAllow },
          { label: 'Deny', variant: 'secondary', onClick: onDeny },
        ],
      });
    },
    [addToast]
  );

  const showPermissionGranted = useCallback(
    (folderName: string) => {
      return addToast({
        type: 'permission-granted',
        title: 'Access Granted',
        message: `You can now read and write files in "${folderName}".`,
        autoDismiss: 5000,
      });
    },
    [addToast]
  );

  const showPermissionDenied = useCallback(
    (onTryAgain?: () => void) => {
      return addToast({
        type: 'permission-denied',
        title: 'Access Denied',
        message: 'CodeStudio cannot access this folder. Some features will be limited.',
        autoDismiss: 10000,
        actions: onTryAgain
          ? [{ label: 'Try Again', variant: 'primary', onClick: onTryAgain }]
          : undefined,
      });
    },
    [addToast]
  );

  const showFileSaved = useCallback(
    (fileName: string) => {
      return addToast({
        type: 'file-saved',
        title: 'File Saved',
        message: `"${fileName}" has been saved successfully.`,
        autoDismiss: 3000,
      });
    },
    [addToast]
  );

  const showError = useCallback(
    (message: string) => {
      return addToast({
        type: 'error',
        title: 'Error',
        message,
        autoDismiss: 8000,
      });
    },
    [addToast]
  );

  const showInfo = useCallback(
    (title: string, message: string, autoDismiss = 5000) => {
      return addToast({
        type: 'info',
        title,
        message,
        autoDismiss,
      });
    },
    [addToast]
  );

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    showPermissionRequest,
    showPermissionGranted,
    showPermissionDenied,
    showFileSaved,
    showError,
    showInfo,
  };
}

import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string, duration?: number) => void;
  error: (message: string, title?: string, duration?: number) => void;
  info: (message: string, title?: string, duration?: number) => void;
  warning: (message: string, title?: string, duration?: number) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

const ToastItem: React.FC<{ toast: Toast; onRemove: (id: string) => void }> = ({ toast, onRemove }) => {
  const [isRemoving, setIsRemoving] = useState(false);

  useEffect(() => {
    const duration = toast.duration || 3000;
    const timer = setTimeout(() => {
      setIsRemoving(true);
      setTimeout(() => onRemove(toast.id), 300); // Wait for exit animation
    }, duration);

    return () => clearTimeout(timer);
  }, [toast, onRemove]);

  const handleClose = () => {
    setIsRemoving(true);
    setTimeout(() => onRemove(toast.id), 300);
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error':
        return <XCircle className="w-5 h-5 text-rose-500" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'info':
        return <Info className="w-5 h-5 text-blue-500" />;
    }
  };

  const getStyles = () => {
    switch (toast.type) {
      case 'success':
        return 'border-emerald-100 bg-emerald-50/80 backdrop-blur-md text-emerald-800 shadow-emerald-900/5';
      case 'error':
        return 'border-rose-100 bg-rose-50/80 backdrop-blur-md text-rose-800 shadow-rose-900/5';
      case 'warning':
        return 'border-amber-100 bg-amber-50/80 backdrop-blur-md text-amber-800 shadow-amber-900/5';
      case 'info':
        return 'border-blue-100 bg-blue-50/80 backdrop-blur-md text-blue-800 shadow-blue-900/5';
    }
  };

  return (
    <div
      className={`
        pointer-events-auto w-full max-w-sm overflow-hidden rounded-xl border p-4 shadow-xl transition-all duration-300 ease-in-out
        ${getStyles()}
        ${isRemoving ? 'translate-x-full opacity-0' : 'translate-x-0 opacity-100 animate-in slide-in-from-right-8'}
      `}
    >
      <div className="flex items-start gap-3">
        <div className="shrink-0 mt-0.5">{getIcon()}</div>
        <div className="flex-1 space-y-1">
          {toast.title && <p className="font-semibold text-sm leading-none tracking-tight">{toast.title}</p>}
          <p className="text-sm opacity-90 leading-snug">{toast.message}</p>
        </div>
        <button
          onClick={handleClose}
          className="shrink-0 opacity-50 hover:opacity-100 transition-opacity rounded-md hover:bg-black/5 p-1"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { ...toast, id }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const success = useCallback(
    (message: string, title?: string, duration?: number) => addToast({ type: 'success', message, title, duration }),
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number) => addToast({ type: 'error', message, title, duration }),
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number) => addToast({ type: 'info', message, title, duration }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number) => addToast({ type: 'warning', message, title, duration }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex max-h-screen w-full flex-col-reverse justify-end gap-2 p-4 sm:bottom-6 sm:right-6 sm:max-w-md md:max-w-sm pointer-events-none">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

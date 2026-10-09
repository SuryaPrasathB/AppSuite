import React, { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X, Undo2 } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

export interface Toast {
  id: string;
  type: ToastType;
  title?: string;
  message: string;
  duration?: number;
  undoAction?: () => void;
}

interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string, duration?: number, undoAction?: () => void) => void;
  error: (message: string, title?: string, duration?: number, undoAction?: () => void) => void;
  info: (message: string, title?: string, duration?: number, undoAction?: () => void) => void;
  warning: (message: string, title?: string, duration?: number, undoAction?: () => void) => void;
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
    const duration = toast.duration || (toast.undoAction ? 6000 : 3000); // Give more time if undo is available
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
  
  const handleUndo = () => {
    if (toast.undoAction) {
      toast.undoAction();
    }
    handleClose();
  };

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500 fill-emerald-500/20" />;
      case 'error':
        return <XCircle className="w-4 h-4 text-rose-500 fill-rose-500/20" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-amber-500 fill-amber-500/20" />;
      case 'info':
        return <Info className="w-4 h-4 text-blue-500 fill-blue-500/20" />;
    }
  };

  const displayMessage = toast.title && !['success', 'error', 'info', 'warning'].includes(toast.title.toLowerCase())
    ? toast.title
    : toast.message;

  return (
    <div
      className={`
        pointer-events-auto w-max max-w-[90vw] md:max-w-xl rounded-xl border border-white/10 bg-[#1c1c1c] px-3 py-2.5 shadow-xl transition-all duration-400 ease-out flex items-center gap-3
        ${isRemoving ? 'translate-y-8 opacity-0 scale-95' : 'animate-toast-in'}
      `}
    >
      <div className="shrink-0">{getIcon()}</div>
      
      <div className="flex flex-1 items-center gap-2 pr-2 overflow-hidden min-w-[120px]">
        <span className="text-[13px] font-medium text-white leading-none truncate">{displayMessage}</span>
      </div>
      
      {toast.undoAction && (
        <button
          onClick={handleUndo}
          className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium text-white/80 hover:text-white border border-white/10 rounded transition-colors shadow-sm whitespace-nowrap shrink-0"
        >
          Undo <span className="text-amber-500">CtrlZ</span>
        </button>
      )}
    </div>
  );
};

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => {
      const newToasts = [...prev, { ...toast, id }];
      if (newToasts.length > 3) {
        return newToasts.slice(newToasts.length - 3);
      }
      return newToasts;
    });
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);
  
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        const undoableToast = [...toasts].reverse().find(t => t.undoAction);
        if (undoableToast) {
          e.preventDefault();
          undoableToast.undoAction!();
          removeToast(undoableToast.id);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toasts, removeToast]);

  const success = useCallback(
    (message: string, title?: string, duration?: number, undoAction?: () => void) => addToast({ type: 'success', message, title, duration, undoAction }),
    [addToast]
  );

  const error = useCallback(
    (message: string, title?: string, duration?: number, undoAction?: () => void) => addToast({ type: 'error', message, title, duration, undoAction }),
    [addToast]
  );

  const info = useCallback(
    (message: string, title?: string, duration?: number, undoAction?: () => void) => addToast({ type: 'info', message, title, duration, undoAction }),
    [addToast]
  );

  const warning = useCallback(
    (message: string, title?: string, duration?: number, undoAction?: () => void) => addToast({ type: 'warning', message, title, duration, undoAction }),
    [addToast]
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, success, error, info, warning }}>
      {children}
      <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] flex max-h-screen w-full flex-col justify-end gap-3 p-4 sm:max-w-md md:max-w-sm pointer-events-none items-center">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};

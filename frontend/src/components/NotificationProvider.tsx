import React, { createContext, useContext, useState, useCallback } from 'react';
import '../styles/Toast.css';

type ToastType = 'info' | 'success' | 'error' | 'warning';

type Toast = {
  id: string;
  message: string;
  type?: ToastType;
};

type NotificationContextType = {
  notify: (message: string, type?: ToastType, duration?: number) => void;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export const useNotification = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotification must be used within NotificationProvider');
  return ctx;
};

export const NotificationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const notify = useCallback((message: string, type: ToastType = 'info', duration = 3500) => {
    const id = crypto.randomUUID();
    const toast: Toast = { id, message, type };
    setToasts(prev => [...prev, toast]);
    if (duration > 0) {
      setTimeout(() => removeToast(id), duration);
    }
  }, [removeToast]);

  return (
    <NotificationContext.Provider value={{ notify }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <div key={t.id} className={`toast toast-${t.type || 'info'}`} onClick={() => removeToast(t.id)}>
            <div className="toast-message">{t.message}</div>
          </div>
        ))}
      </div>
    </NotificationContext.Provider>
  );
};

export default NotificationProvider;

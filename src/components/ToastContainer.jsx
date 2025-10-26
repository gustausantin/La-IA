// components/ToastContainer.jsx - Contenedor de notificaciones para La-IA

import React, { useState, useEffect, useCallback } from 'react';
import Toast from './Toast';

let toastCount = 0;

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type, title, message, duration, showProgress }) => {
    const id = `toast-${++toastCount}`;
    const newToast = {
      id,
      type,
      title,
      message,
      duration,
      showProgress
    };

    setToasts(prev => [...prev, newToast]);
    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setToasts([]);
  }, []);

  // Exponer métodos globalmente
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.laiaToast = {
        success: (title, message, duration) => addToast({ type: 'success', title, message, duration }),
        error: (title, message, duration) => addToast({ type: 'error', title, message, duration }),
        warning: (title, message, duration) => addToast({ type: 'warning', title, message, duration }),
        info: (title, message, duration) => addToast({ type: 'info', title, message, duration }),
        default: (title, message, duration) => addToast({ type: 'default', title, message, duration }),
        clear: clearAll
      };
    }

    return () => {
      if (typeof window !== 'undefined') {
        delete window.laiaToast;
      }
    };
  }, [addToast, clearAll]);

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-sm">
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          {...toast}
          onClose={removeToast}
        />
      ))}
    </div>
  );
};

export default ToastContainer;

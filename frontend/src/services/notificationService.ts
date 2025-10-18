/**
 * Notification Service
 * 
 * Centralized notification management using react-hot-toast
 * 
 * Author: Aaron Sequeira
 * Company: Roneira AI
 */

import toast from 'react-hot-toast';

export class NotificationService {
  showSuccess(message: string, options?: { duration?: number }) {
    return toast.success(message, {
      duration: options?.duration || 4000,
      position: 'top-right',
      style: {
        background: '#065f46',
        color: '#ffffff',
        border: '1px solid #047857'
      }
    });
  }
  
  showError(message: string, options?: { duration?: number }) {
    return toast.error(message, {
      duration: options?.duration || 6000,
      position: 'top-right',
      style: {
        background: '#7f1d1d',
        color: '#ffffff',
        border: '1px solid #dc2626'
      }
    });
  }
  
  showWarning(message: string, options?: { duration?: number }) {
    return toast(message, {
      icon: '⚠️',
      duration: options?.duration || 5000,
      position: 'top-right',
      style: {
        background: '#92400e',
        color: '#ffffff',
        border: '1px solid #d97706'
      }
    });
  }
  
  showInfo(message: string, options?: { duration?: number }) {
    return toast(message, {
      icon: 'ℹ️',
      duration: options?.duration || 4000,
      position: 'top-right',
      style: {
        background: '#1e40af',
        color: '#ffffff',
        border: '1px solid #2563eb'
      }
    });
  }
  
  showLoading(message: string = 'Loading...') {
    return toast.loading(message, {
      position: 'top-right',
      style: {
        background: '#374151',
        color: '#ffffff',
        border: '1px solid #4b5563'
      }
    });
  }
  
  dismiss(toastId?: string) {
    if (toastId) {
      toast.dismiss(toastId);
    } else {
      toast.dismiss();
    }
  }
  
  dismissAll() {
    toast.dismiss();
  }
}
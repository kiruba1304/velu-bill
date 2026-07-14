import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

declare global {
  interface Window {
    electronAPI?: {
      showAlert: (message: string, title?: string) => void;
      showConfirm: (message: string, title?: string) => boolean;
      openExternal: (url: string) => Promise<boolean>;
    };
  }
}

if (window.electronAPI) {
  window.alert = (message: any) => {
    window.electronAPI!.showAlert(String(message));
  };
  window.confirm = (message?: string) => {
    return window.electronAPI!.showConfirm(message || '');
  };
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)

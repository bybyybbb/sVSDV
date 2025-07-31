import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";

// PWA Service Worker Registrierung
const registerServiceWorker = async () => {
  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      console.log('Twitter Bot PWA: Service Worker registriert erfolgreich', registration.scope);
      
      // Update verfügbar Event
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed') {
              if (navigator.serviceWorker.controller) {
                // Neue Version verfügbar
                if (window.confirm('Neue Version verfügbar! Jetzt aktualisieren?')) {
                  window.location.reload();
                }
              }
            }
          });
        }
      });
      
// PWA Install Prompt
      let deferredPrompt;
      window.addEventListener('beforeinstallprompt', (e) => {
        console.log('Twitter Bot PWA: Installation verfügbar');
        e.preventDefault();
        deferredPrompt = e;
        window.deferredPrompt = e; // Mache es global verfügbar
        
        // Zeige Install-Button nach kurzer Verzögerung
        setTimeout(() => {
          if (deferredPrompt && !window.matchMedia('(display-mode: standalone)').matches) {
            showInstallPrompt(deferredPrompt);
          }
        }, 5000);
      });
      
      // Prüfe ob bereits installiert
      window.addEventListener('appinstalled', () => {
        console.log('Twitter Bot PWA: App installiert!');
        deferredPrompt = null;
        window.deferredPrompt = null;
      });
      
    } catch (error) {
      console.error('Twitter Bot PWA: Service Worker Registrierung fehlgeschlagen:', error);
    }
  }
};

// Install Prompt anzeigen
const showInstallPrompt = (deferredPrompt) => {
  // Erstelle Install-Banner
  const installBanner = document.createElement('div');
  installBanner.id = 'pwa-install-banner';
  installBanner.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg, #7c3aed 0%, #3b82f6 100%);
      color: white;
      padding: 16px 20px;
      border-radius: 12px;
      box-shadow: 0 8px 32px rgba(124, 58, 237, 0.3);
      z-index: 10000;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      max-width: 320px;
      animation: slideIn 0.3s ease-out;
    ">
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-right: 8px;">
          <path d="M12 2L2 7v10c0 5.55 3.84 9.54 9 9.54s9-3.99 9-9.54V7l-10-5z"/>
        </svg>
        <strong>Twitter Bot installieren?</strong>
      </div>
      <p style="margin: 0 0 12px 0; font-size: 14px; opacity: 0.9;">
        Installieren Sie die App für bessere Performance und Desktop-Zugriff!
      </p>
      <div style="display: flex; gap: 8px;">
        <button id="pwa-install-btn" style="
          background: rgba(255, 255, 255, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 500;
        ">Installieren</button>
        <button id="pwa-dismiss-btn" style="
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.3);
          color: white;
          padding: 8px 16px;
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        ">Später</button>
      </div>
    </div>
    <style>
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
    </style>
  `;
  
  document.body.appendChild(installBanner);
  
  // Install Button Event
  document.getElementById('pwa-install-btn').addEventListener('click', async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log('Twitter Bot PWA: User choice:', outcome);
      deferredPrompt = null;
    }
    installBanner.remove();
  });
  
  // Dismiss Button Event
  document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
    installBanner.remove();
  });
  
  // Auto-hide nach 15 Sekunden
  setTimeout(() => {
    if (document.getElementById('pwa-install-banner')) {
      installBanner.remove();
    }
  }, 15000);
};

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Registriere Service Worker nach App-Start
registerServiceWorker();

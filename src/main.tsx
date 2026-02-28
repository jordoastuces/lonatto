import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

window.onerror = function(message, source, lineno, colno, error) {
  console.error("Global error:", message, "at", source, lineno, colno, error);
  // If the app is blank, show a simple error message
  const root = document.getElementById('root');
  if (root && root.innerHTML === "") {
    root.innerHTML = `
      <div style="padding: 20px; text-align: center; font-family: sans-serif;">
        <h1>Erreur de chargement</h1>
        <p>L'application n'a pas pu démarrer. Veuillez rafraîchir la page.</p>
        <button onclick="window.location.reload()" style="padding: 10px 20px; background: #000; color: #fff; border: none; border-radius: 5px;">Rafraîchir</button>
      </div>
    `;
  }
};

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.log('ServiceWorker registration failed: ', err);
    });
  });
}

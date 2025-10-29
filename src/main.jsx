import React from 'react';
import ReactDOM from 'react-dom/client';
import App from 'app.jsx';
// No need to import a CSS file here as we are relying on Tailwind CSS being processed
// by Vite for the overall styling, which App.jsx uses directly.

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

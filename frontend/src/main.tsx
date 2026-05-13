import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '../app.config';
import './styles/global.css';

const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = createRoot(rootElement);
  root.render(
    <StrictMode>
      <App />
    </StrictMode>
  );
}
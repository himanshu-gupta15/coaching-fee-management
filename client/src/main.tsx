import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { Toaster } from 'sonner';
import { store } from '@/store';
import App from './App';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <App />
      <Toaster position="top-right" richColors closeButton toastOptions={{ style: { fontFamily: 'Inter, sans-serif' } }} />
    </Provider>
  </StrictMode>,
);

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import ErrorBoundary from './components/ErrorBoundary'
import { DebugProvider } from './contexts/DebugContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DebugProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </DebugProvider>
  </StrictMode>,
)

import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

declare global {
  // For TypeScript: allow __debuglog on globalThis
  var __debuglog: (msg: string) => void;
}

const DebugContext = createContext<any>(null);

export const DebugProvider = ({ children = null }: { children?: ReactNode }) => {
  const [logs, setLogs] = useState<string[]>([]);
  const [isMinimized, setIsMinimized] = useState(false);

  const log = (msg: string) => {
    const timestamp = new Date().toISOString().split('T')[1].slice(0, 8);
    setLogs(prev => [...prev, `[${timestamp}] ${msg}`]);
  };

  useEffect(() => {
    try {
      (globalThis as any).__debuglog = log;
    } catch (e) {
      console.warn('Debug logger could not attach to globalThis:', e);
    }
  }, []);

  return (
    <DebugContext.Provider value={{ log }}>
      {children || null}
      <div
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          width: '100%',
          background: 'rgba(0,0,0,0.85)',
          color: 'lime',
          fontSize: '12px',
          maxHeight: isMinimized ? '30px' : '180px',
          overflowY: 'auto',
          zIndex: 9999,
          padding: '6px',
          fontFamily: 'monospace',
          transition: 'max-height 0.3s ease'
        }}
        data-testid="debug-overlay"
      >
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: isMinimized ? '0' : '6px'
        }}>
          <span style={{ fontWeight: 'bold' }}>Debug Console</span>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            style={{
              background: 'rgba(255,255,255,0.2)',
              border: '1px solid rgba(255,255,255,0.3)',
              color: 'lime',
              padding: '2px 8px',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '10px'
            }}
          >
            {isMinimized ? '🔽 Expand' : '🔼 Minimize'}
          </button>
        </div>
        {!isMinimized && logs.map((l, i) => (
          <div key={i}>{l}</div>
        ))}
      </div>
    </DebugContext.Provider>
  );
};

export const useDebug = () => useContext(DebugContext); 
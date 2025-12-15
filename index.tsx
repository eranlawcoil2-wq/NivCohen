import React, { ReactNode, ErrorInfo } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

interface ErrorBoundaryProps {
  children?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: 20, color: '#fff', textAlign: 'center', direction: 'rtl', fontFamily: 'sans-serif' }}>
          <h1 style={{color: '#A3E635', fontSize: '24px', marginBottom: '10px'}}>משהו השתבש...</h1>
          <p>אנא רענן את העמוד או נסה מאוחר יותר.</p>
          <button 
            onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{marginTop: 20, padding: '10px 20px', background: '#333', color: 'white', border: '1px solid #555', borderRadius: 5, cursor: 'pointer'}}
          >
            נקה נתונים ורענן
          </button>
          <pre style={{ fontSize: 10, opacity: 0.5, textAlign: 'left', marginTop: 20, overflow: 'auto', direction: 'ltr' }}>{this.state.error?.toString()}</pre>
        </div>
      );
    }

    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
import React, { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an unhandled error:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: '32px',
          margin: '20px auto',
          maxWidth: '800px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: '1px solid rgba(239, 68, 68, 0.35)',
          borderRadius: '16px',
          color: '#fff',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          textAlign: 'center'
        }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            marginBottom: '16px'
          }}>
            <AlertTriangle size={32} color="#f87171" />
          </div>
          <h2 style={{ fontSize: '1.3rem', fontWeight: 800, marginBottom: '8px', color: '#fff' }}>
            {this.props.fallbackTitle || 'Ocurrió un error al cargar este módulo'}
          </h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: '0 auto 20px', lineHeight: 1.5 }}>
            {this.state.error?.message || 'Error inesperado de ejecución. Puedes reintentar la carga.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button
              onClick={this.handleReload}
              className="btn btn-primary"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 20px' }}
            >
              <RefreshCw size={16} /> Reintentar Carga
            </button>
            <button
              onClick={() => window.location.reload()}
              className="btn btn-secondary"
              style={{ padding: '10px 20px' }}
            >
              Recargar Aplicación
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

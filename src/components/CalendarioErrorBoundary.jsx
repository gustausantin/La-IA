// CalendarioErrorBoundary.jsx - Error boundary específico para Calendario
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

class CalendarioErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { 
            hasError: false, 
            error: null, 
            errorInfo: null 
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('❌ Error en Calendario capturado por ErrorBoundary:', error, errorInfo);
        this.setState({
            error: error,
            errorInfo: errorInfo
        });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 flex items-center justify-center p-2">
                    <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-6 text-center">
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                        </div>
                        
                        <h2 className="text-base font-semibold text-gray-900 mb-2">
                            Error en Calendario
                        </h2>
                        
                        <p className="text-gray-600 mb-6">
                            Se ha producido un error inesperado en el módulo de calendario.
                            Nuestro equipo ha sido notificado.
                        </p>

                        <div className="space-y-3">
                            <button
                                onClick={() => {
                                    this.setState({ hasError: false, error: null, errorInfo: null });
                                    window.location.reload();
                                }}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            >
                                <RefreshCw className="w-4 h-4" />
                                Intentar de Nuevo
                            </button>
                            
                            <button
                                onClick={() => window.location.href = '/dashboard'}
                                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                            >
                                <Home className="w-4 h-4" />
                                Ir al Dashboard
                            </button>
                        </div>

                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 p-2 bg-red-50 rounded-lg text-left">
                                <summary className="font-medium text-red-800 cursor-pointer">
                                    Detalles del error (desarrollo)
                                </summary>
                                <div className="mt-2 text-sm text-red-700">
                                    <p className="font-mono">{this.state.error.toString()}</p>
                                    <pre className="mt-2 text-xs overflow-auto">
                                        {this.state.errorInfo.componentStack}
                                    </pre>
                                </div>
                            </details>
                        )}

                        <p className="text-xs text-gray-500 mt-4">
                            Si el problema persiste, contacta a nuestro soporte técnico.
                        </p>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default CalendarioErrorBoundary;

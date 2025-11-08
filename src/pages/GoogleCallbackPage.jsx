// GoogleCallbackPage.jsx - Maneja el callback de Google OAuth
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, Check, X } from 'lucide-react';
import GoogleCalendarService from '../services/GoogleCalendarService';

export default function GoogleCallbackPage() {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [status, setStatus] = useState('processing'); // processing, success, error
    const [message, setMessage] = useState('Conectando con Google Calendar...');

    useEffect(() => {
        handleCallback();
    }, []);

    const handleCallback = async () => {
        try {
            const code = searchParams.get('code');
            const state = searchParams.get('state');
            const error = searchParams.get('error');

            if (error) {
                throw new Error(`OAuth error: ${error}`);
            }

            if (!code || !state) {
                throw new Error('Missing code or state parameter');
            }

            setMessage('Intercambiando tokens con Google...');

            const result = await GoogleCalendarService.handleCallback(code, state);

            if (result.success) {
                setStatus('success');
                setMessage('¡Conectado exitosamente!');
                
                // Redirigir a configuración después de 2 segundos
                setTimeout(() => {
                    navigate('/configuracion?tab=integraciones');
                }, 2000);
            } else {
                throw new Error(result.error);
            }
        } catch (error) {
            console.error('Error in callback:', error);
            setStatus('error');
            setMessage(error.message || 'Error al conectar con Google Calendar');
            
            // Redirigir a configuración después de 3 segundos
            setTimeout(() => {
                navigate('/configuracion?tab=integraciones');
            }, 3000);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full">
                <div className="text-center">
                    {/* Icono de estado */}
                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-6 ${
                        status === 'processing' 
                            ? 'bg-blue-100' 
                            : status === 'success' 
                            ? 'bg-green-100' 
                            : 'bg-red-100'
                    }`}>
                        {status === 'processing' && (
                            <RefreshCw className="w-10 h-10 text-blue-600 animate-spin" />
                        )}
                        {status === 'success' && (
                            <Check className="w-10 h-10 text-green-600" />
                        )}
                        {status === 'error' && (
                            <X className="w-10 h-10 text-red-600" />
                        )}
                    </div>

                    {/* Mensaje */}
                    <h2 className={`text-2xl font-bold mb-3 ${
                        status === 'processing' 
                            ? 'text-blue-900' 
                            : status === 'success' 
                            ? 'text-green-900' 
                            : 'text-red-900'
                    }`}>
                        {status === 'processing' && 'Conectando...'}
                        {status === 'success' && '¡Éxito!'}
                        {status === 'error' && 'Error'}
                    </h2>

                    <p className="text-gray-600 mb-6">
                        {message}
                    </p>

                    {/* Barra de progreso */}
                    {status === 'processing' && (
                        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                            <div className="bg-gradient-to-r from-blue-600 to-purple-600 h-full animate-pulse" style={{ width: '100%' }}></div>
                        </div>
                    )}

                    {/* Mensaje de redirección */}
                    {(status === 'success' || status === 'error') && (
                        <p className="text-sm text-gray-500 mt-4">
                            Redirigiendo a Configuración...
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
}


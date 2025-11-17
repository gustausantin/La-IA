// GoogleOAuthCallback.jsx - Maneja el callback de OAuth de Google Calendar
import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { CheckCircle2, XCircle, RefreshCw, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function GoogleOAuthCallback() {
  const [status, setStatus] = useState('processing'); // processing, success, error
  const [message, setMessage] = useState('Procesando autorización de Google Calendar...');
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Obtener parámetros de la URL
        const code = searchParams.get('code');
        const error = searchParams.get('error');
        const state = searchParams.get('state'); // businessId
        const errorDescription = searchParams.get('error_description');

        // Verificar si hay un error de Google
        if (error) {
          setStatus('error');
          setMessage(`Error de autorización: ${errorDescription || error}`);
          toast.error(`Error de autorización: ${errorDescription || error}`);
          
          // Redirigir después de 3 segundos
          setTimeout(() => {
            navigate('/configuracion?tab=integraciones');
          }, 3000);
          return;
        }

        // Verificar que tenemos el código
        if (!code) {
          setStatus('error');
          setMessage('No se recibió el código de autorización de Google.');
          toast.error('No se recibió el código de autorización.');
          
          setTimeout(() => {
            navigate('/configuracion?tab=integraciones');
          }, 3000);
          return;
        }

        // Obtener businessId del state o del localStorage
        const businessId = state || localStorage.getItem('google_calendar_business_id');
        
        if (!businessId) {
          setStatus('error');
          setMessage('No se pudo identificar el negocio. Por favor, intenta de nuevo.');
          toast.error('Error: No se pudo identificar el negocio.');
          
          setTimeout(() => {
            navigate('/configuracion?tab=integraciones');
          }, 3000);
          return;
        }

        // Obtener redirect_uri (debe ser exactamente la misma que se usó en la solicitud)
        const redirectUri = `${window.location.origin}/oauth/google/callback`.trim().replace(/\/$/, '');
        const savedRedirectUri = localStorage.getItem('google_calendar_redirect_uri');
        
        // 🔍 DEBUG: Verificar que la URI coincida
        console.log('🔍 DEBUG Callback:');
        console.log('  - URI actual:', redirectUri);
        console.log('  - URI guardada:', savedRedirectUri);
        console.log('  - Coinciden:', redirectUri === savedRedirectUri);
        console.log('  - Código recibido:', code ? '✅ Sí' : '❌ No');
        console.log('  - State (businessId):', state);
        
        if (savedRedirectUri && redirectUri !== savedRedirectUri) {
          console.warn('⚠️ ADVERTENCIA: La URI actual no coincide con la guardada');
          console.warn('  - Actual:', redirectUri);
          console.warn('  - Guardada:', savedRedirectUri);
        }

        setMessage('Intercambiando código por tokens...');

        // Llamar a la Edge Function de Supabase para intercambiar el código
        const { data, error: functionError } = await supabase.functions.invoke('google-oauth-callback', {
          body: {
            code,
            businessId,
            redirectUri
          }
        });

        if (functionError) {
          throw new Error(functionError.message || 'Error al procesar la autorización');
        }

        if (!data?.success) {
          throw new Error(data?.error || 'Error desconocido al conectar Google Calendar');
        }

        // Limpiar localStorage
        localStorage.removeItem('google_calendar_connecting');
        localStorage.removeItem('google_calendar_business_id');

        setStatus('success');
        setMessage('✅ Google Calendar conectado exitosamente!');
        toast.success('Google Calendar conectado exitosamente!');

        // Redirigir a configuración después de 2 segundos
        setTimeout(() => {
          navigate('/configuracion?tab=integraciones');
        }, 2000);

      } catch (error) {
        console.error('❌ Error en callback de OAuth:', error);
        setStatus('error');
        setMessage(`Error: ${error.message}`);
        toast.error(`Error al conectar Google Calendar: ${error.message}`);
        
        // Redirigir después de 3 segundos
        setTimeout(() => {
          navigate('/configuracion?tab=integraciones');
        }, 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
        {status === 'processing' && (
          <>
            <RefreshCw className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Conectando Google Calendar
            </h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              ¡Conexión Exitosa!
            </h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">
              Redirigiendo a configuración...
            </p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="w-16 h-16 text-red-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Error de Conexión
            </h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-left">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                <div className="text-sm text-yellow-800">
                  <p className="font-semibold mb-1">Solución:</p>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Verifica que la URI de redirección esté configurada correctamente en Google Cloud Console</li>
                    <li>Asegúrate de que la URI sea exactamente: <code className="bg-yellow-100 px-1 rounded">{window.location.origin}/oauth/google/callback</code></li>
                    <li>Intenta conectarlo de nuevo desde la página de configuración</li>
                  </ul>
                </div>
              </div>
            </div>
            <p className="text-sm text-gray-500 mt-4">
              Redirigiendo a configuración...
            </p>
          </>
        )}
      </div>
    </div>
  );
}


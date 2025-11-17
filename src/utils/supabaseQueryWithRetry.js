// utils/supabaseQueryWithRetry.js - Query helper con retry y backoff exponencial
// Solución profesional para evitar problemas de deadlock y timeout

/**
 * Ejecuta una query con retry automático y backoff exponencial
 * @param {Function} queryFn - Función que retorna la promesa de la query
 * @param {Object} options - Opciones de retry
 * @returns {Promise} Resultado de la query
 */
export async function queryWithRetry(queryFn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 100,
    maxDelay = 2000,
    timeout = 3000,
    onRetry = null
  } = options;

  let lastError = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Crear timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('QUERY_TIMEOUT')), timeout)
      );
      
      // Ejecutar query con timeout
      const result = await Promise.race([queryFn(), timeoutPromise]);
      
      // Si hay error en el resultado, lanzarlo
      if (result?.error) {
        throw result.error;
      }
      
      // Si llegamos aquí, la query fue exitosa
      return result;
      
    } catch (error) {
      lastError = error;
      
      // Si es el último intento, lanzar el error
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Calcular delay con backoff exponencial
      const delay = Math.min(
        initialDelay * Math.pow(2, attempt),
        maxDelay
      );
      
      // Callback de retry si está disponible
      if (onRetry) {
        onRetry(attempt + 1, delay, error);
      }
      
      // Esperar antes del siguiente intento
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError;
}

/**
 * Helper específico para obtener business_id con múltiples estrategias
 * @param {Object} supabase - Cliente de Supabase
 * @param {string} userId - ID del usuario
 * @returns {Promise<string|null>} business_id o null
 */
export async function getBusinessIdWithFallback(supabase, userId) {
  const strategies = [
    // Estrategia 1: Función RPC con bypass RLS (PRIMERA - más confiable, bypass completo)
    {
      name: 'Función RPC bypass RLS',
      fn: () => supabase.rpc('get_user_business_id_fast', { user_id: userId })
        .then(result => {
          // Convertir resultado de RPC a formato estándar
          if (result.data) {
            return { data: { business_id: result.data }, error: null };
          }
          return result;
        })
    },
    // Estrategia 2: Query ultra-simple (sin filtro active) - fallback
    {
      name: 'Query ultra-simple',
      fn: () => supabase
        .from('user_business_mapping')
        .select('business_id')
        .eq('auth_user_id', userId)
        .limit(1)
        .maybeSingle()
    },
    // Estrategia 3: Query con filtro active - último recurso
    {
      name: 'Query con filtro active',
      fn: () => supabase
        .from('user_business_mapping')
        .select('business_id')
        .eq('auth_user_id', userId)
        .eq('active', true)
        .limit(1)
        .maybeSingle()
    }
  ];

  for (const strategy of strategies) {
    try {
      console.log(`📡 Intentando estrategia: ${strategy.name}...`);
      
      const result = await queryWithRetry(
        strategy.fn,
        {
          maxRetries: 2,
          initialDelay: 200,
          maxDelay: 1000,
          timeout: 2500,
          onRetry: (attempt, delay, error) => {
            console.warn(`⚠️ Retry ${attempt} para ${strategy.name} después de ${delay}ms:`, error.message);
          }
        }
      );
      
      // Verificar si obtuvimos business_id
      const businessId = result?.data?.business_id || result?.data;
      
      if (businessId) {
        console.log(`✅ business_id obtenido vía ${strategy.name}:`, businessId);
        return businessId;
      }
      
    } catch (error) {
      console.warn(`⚠️ Estrategia ${strategy.name} falló:`, error.message);
      // Continuar con la siguiente estrategia
      continue;
    }
  }
  
  // Si todas las estrategias fallaron
  console.error('❌ Todas las estrategias fallaron para obtener business_id');
  return null;
}


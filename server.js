
import express from 'express';
import cors from 'cors';
import { config } from 'dotenv';
import { securityMiddleware } from './src/middleware/security.js';
import nodemailer from 'nodemailer';

// CARGAR VARIABLES CORRECTAMENTE para ES6 modules
config();

// Verificar inmediatamente que las variables están cargadas
console.log('🔍 Variables del servidor:');
console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? '✅ Configurada' : '❌ Falta');
console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? '✅ Configurada' : '❌ Falta');
console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Configurada' : '❌ Falta');

// IMPORTANTE: Las credenciales deben estar en .env (NO en el código)
if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ ERROR: Faltan variables de entorno críticas.');
  console.error('Por favor, configura tu archivo .env con:');
  console.error('- VITE_SUPABASE_URL');
  console.error('- VITE_SUPABASE_ANON_KEY');
  console.error('- SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const app = express();

// 🛡️ SEGURIDAD EMPRESARIAL - Aplicar PRIMERO
securityMiddleware(app);

// Middleware
app.use(cors());
app.use(express.json());

// Import after env is loaded to avoid issues
const registerModule = await import('./src/api/register.js');
const registerHandler = registerModule.default;

// API Routes
app.post('/api/register', (req, res) => {
  registerHandler(req, res);
});

// ✅ ENDPOINT PARA CREAR NEGOCIO (con SERVICE_ROLE_KEY)
app.post('/api/create-business', async (req, res) => {
  try {
    const { businessData, userId } = req.body;

    if (!businessData || !userId) {
      return res.status(400).json({ error: 'businessData y userId son requeridos' });
    }

    // Extraer defaultService y defaultResource ANTES de insertar en businesses
    const { defaultService, defaultResource, ...businessCore } = businessData;

    // Cliente con SERVICE_ROLE_KEY (bypasea RLS)
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log('🔵 API: Creando negocio con SERVICE_ROLE_KEY');
    console.log('📦 businessCore:', businessCore);

    // 1. Crear negocio (solo los campos que existen en la tabla)
    const { data: business, error: businessError } = await supabaseAdmin
      .from('businesses')
      .insert([businessCore])
      .select()
      .single();

    if (businessError) {
      console.error('❌ Error creando negocio:', businessError);
      return res.status(400).json({ error: businessError.message });
    }

    console.log('✅ Negocio creado:', business.id);

    // 2. Desactivar mappings anteriores (solo puede haber 1 negocio activo por usuario)
    const { error: deactivateError } = await supabaseAdmin
      .from('user_business_mapping')
      .update({ active: false })
      .eq('auth_user_id', userId)
      .eq('active', true);

    if (deactivateError) {
      console.error('⚠️ Error desactivando mappings anteriores:', deactivateError);
      // No es crítico, continuamos
    } else {
      console.log('✅ Mappings anteriores desactivados');
    }

    // 3. Crear mapping para el nuevo negocio
    const { error: mappingError } = await supabaseAdmin
      .from('user_business_mapping')
      .insert([{
        auth_user_id: userId,
        business_id: business.id,
        role: 'owner',
        active: true
      }]);

    if (mappingError) {
      console.error('❌ Error creando mapping:', mappingError);
      return res.status(400).json({ error: mappingError.message });
    }

    console.log('✅ Mapping creado:', {
      auth_user_id: userId,
      business_id: business.id,
      role: 'owner',
      active: true
    });

    // 3. Crear servicio por defecto (si se envió)
    if (defaultService) {
      const { name, duration, price } = defaultService;
      const { error: serviceError } = await supabaseAdmin.from('services').insert([{
        business_id: business.id,
        name,
        duration_minutes: duration ?? 60,
        price: price ?? 0,
        is_available: true, // ✅ Columna correcta según DATABASE-SCHEMA-AUTONOMOS-2025.sql
        requires_resource: true
      }]);

      if (serviceError) {
        console.error('⚠️ Error creando servicio por defecto:', serviceError);
      } else {
        console.log('✅ Servicio por defecto creado:', name);
      }
    }

    // 4. Crear recurso por defecto (si se envió)
    if (defaultResource) {
      const { name, singular } = defaultResource;
      const { error: resourceError } = await supabaseAdmin.from('resources').insert([{
        business_id: business.id,
        name,
        is_active: true, // ✅ Columna correcta según DATABASE-SCHEMA-AUTONOMOS-2025.sql
        resource_number: singular || null
      }]);

      if (resourceError) {
        console.error('⚠️ Error creando recurso por defecto:', resourceError);
      } else {
        console.log('✅ Recurso por defecto creado:', name);
      }
    }

    return res.json({
      success: true,
      business
    });

  } catch (error) {
    console.error('💥 Error fatal en API:', error);
    return res.status(500).json({ error: error.message });
  }
});

// ========================================
// EMAIL SENDING ENDPOINT
// Usado por Supabase Edge Function para enviar emails vía SMTP
// ========================================
// Endpoint para registrar actividad del agente (health check)
app.post('/api/agent-heartbeat', async (req, res) => {
  try {
    const { business_id } = req.body;
    
    if (!business_id) {
      return res.status(400).json({ error: 'business_id required' });
    }
    
    const { registerAgentActivity } = await import('./src/services/systemNotificationService.js');
    registerAgentActivity(business_id);
    
    res.json({ success: true, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error en heartbeat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para notificar desactivación de agente
app.post('/api/agent-deactivated', async (req, res) => {
  try {
    const { business_id } = req.body;
    
    if (!business_id) {
      return res.status(400).json({ error: 'business_id required' });
    }
    
    // Obtener datos del restaurante
    const supabase = (await import('@supabase/supabase-js')).createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    
    const { data: restaurant } = await supabase
      .from('businesses')
      .select('*')
      .eq('id', business_id)
      .single();
    
    if (!restaurant) {
      return res.status(404).json({ error: 'Restaurant not found' });
    }
    
    const { sendAgentDeactivatedConfirmation } = await import('./src/services/systemNotificationService.js');
    const result = await sendAgentDeactivatedConfirmation(restaurant);
    
    res.json(result);
  } catch (error) {
    console.error('Error enviando confirmación:', error);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint para reportar errores críticos
app.post('/api/report-error', async (req, res) => {
  try {
    const { business_id, error_type, error_message } = req.body;
    
    if (!business_id || !error_type) {
      return res.status(400).json({ error: 'business_id and error_type required' });
    }
    
    const { trackError } = await import('./src/services/systemNotificationService.js');
    await trackError(business_id, error_type, error_message || 'Error desconocido');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error reportando error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/send-email', async (req, res) => {
  try {
    // Verificar autorización (solo Edge Functions pueden llamar a esto)
    const authHeader = req.headers.authorization;
    const expectedToken = `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`;
    
    if (authHeader !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { from, replyTo, to, subject, html } = req.body;

    // Configurar transporter SMTP
    const transporter = nodemailer.createTransport({
      host: 'smtp.hostinger.com',
      port: 465,
      secure: true, // SSL
      auth: {
        user: process.env.SMTP_USER || 'noreply@la-ia.site',
        pass: process.env.SMTP_PASSWORD, // Debe estar en .env
      },
    });

    // Enviar email
    const info = await transporter.sendMail({
      from,
      replyTo,
      to: Array.isArray(to) ? to : [to],
      subject,
      html,
    });

    console.log('✅ Email enviado correctamente:', info.messageId);

    res.json({
      success: true,
      messageId: info.messageId,
      accepted: info.accepted,
    });

  } catch (error) {
    console.error('❌ Error enviando email:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Serve static files from React build (for production)
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files
app.use(express.static(path.join(__dirname, 'dist')));

// Handle React routing - send all non-API requests to React app
app.get('*', (req, res) => {
  // Skip API routes
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: 'API route not found' });
  }
  
  // Send React app for all other routes
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Función para encontrar puerto disponible
const findAvailablePort = (startPort) => {
  return new Promise((resolve) => {
    const server = app.listen(startPort, '0.0.0.0', () => {
      const port = server.address().port;
      server.close();
      resolve(port);
    });
    
    server.on('error', () => {
      resolve(findAvailablePort(startPort + 1));
    });
  });
};

// Iniciar servidor en puerto fijo
const PORT = 3000;

app.listen(PORT, '0.0.0.0', async () => {
  console.log(`✅ API Server running on http://0.0.0.0:${PORT}`);
  
  // 📧 Iniciar listener de notificaciones por email vía Realtime
  console.log('📧 Iniciando sistema de notificaciones por email...');
  const { startRealtimeEmailListener } = await import('./src/services/realtimeEmailService.js');
  startRealtimeEmailListener();
  
  // 🏥 Iniciar monitor de salud de agentes y errores críticos
  console.log('🏥 Iniciando monitor del sistema...');
  const { startAgentHealthMonitor } = await import('./src/services/systemNotificationService.js');
  startAgentHealthMonitor();
  
  // 🔄 AUTO-MARCAR RESERVAS CADUCADAS COMO NO-SHOW (cada 30 min)
  console.log('🔄 Iniciando auto-marcado de reservas caducadas...');
  const { createClient } = await import('@supabase/supabase-js');
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
  
  // Ejecutar inmediatamente al iniciar
  const markExpiredReservations = async () => {
    try {
      const { data, error } = await supabase.rpc('mark_all_expired_reservations_as_noshow');
      if (error) throw error;
      if (data && data.updated_count > 0) {
        console.log(`✅ Auto-marcadas ${data.updated_count} reservas caducadas como no-show`);
      }
    } catch (error) {
      console.error('❌ Error auto-marcando reservas caducadas:', error.message);
    }
  };
  
  await markExpiredReservations();
  
  // Ejecutar cada 30 minutos
  setInterval(markExpiredReservations, 30 * 60 * 1000);
  console.log('✅ Cron job configurado: marcar reservas caducadas cada 30 minutos');
  
  // 💬 AUTO-MARCAR CONVERSACIONES INACTIVAS COMO RESUELTAS (cada 5 min)
  console.log('💬 Iniciando auto-marcado de conversaciones inactivas...');
  
  const markInactiveConversationsAsResolved = async () => {
    try {
      // Calcular timestamp de hace 10 minutos
      const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
      
      // 1. Buscar conversaciones activas
      const { data: activeConversations, error: fetchError } = await supabase
        .from('agent_conversations')
        .select('id')
        .eq('status', 'active');
      
      if (fetchError) throw fetchError;
      if (!activeConversations || activeConversations.length === 0) return;
      
      // 2. Para cada conversación, obtener su último mensaje
      const conversationsToResolve = [];
      
      for (const conv of activeConversations) {
        const { data: lastMessage } = await supabase
          .from('agent_messages')
          .select('timestamp')
          .eq('conversation_id', conv.id)
          .order('timestamp', { ascending: false })
          .limit(1)
          .single();
        
        // Si el último mensaje fue hace más de 10 min, marcar para resolver
        if (lastMessage && lastMessage.timestamp < tenMinutesAgo) {
          conversationsToResolve.push(conv.id);
        }
      }
      
      // 3. Marcar conversaciones inactivas como resueltas
      if (conversationsToResolve.length > 0) {
        const { error: updateError } = await supabase
          .from('agent_conversations')
          .update({ 
            status: 'resolved',
            resolved_at: new Date().toISOString()
          })
          .in('id', conversationsToResolve);
        
        if (updateError) throw updateError;
        
        console.log(`✅ Auto-marcadas ${conversationsToResolve.length} conversaciones como resueltas (10 min inactividad)`);
      }
    } catch (error) {
      console.error('❌ Error auto-marcando conversaciones inactivas:', error.message);
    }
  };
  
  // Ejecutar inmediatamente al iniciar
  await markInactiveConversationsAsResolved();
  
  // Ejecutar cada 5 minutos
  setInterval(markInactiveConversationsAsResolved, 5 * 60 * 1000);
  console.log('✅ Cron job configurado: marcar conversaciones inactivas cada 5 minutos');
  
  console.log('✅ Análisis de conversaciones: SOLO se ejecuta cuando el agente cierra la conversación (sin cron)');
});

// Manejar errores de puerto
app.on('error', (error) => {
  console.error('❌ Error iniciando servidor:', error);
  process.exit(1);
});


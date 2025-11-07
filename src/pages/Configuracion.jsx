import React, { useState, useEffect } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useSearchParams, useLocation } from "react-router-dom";
import {
    Settings as SettingsIcon,
    Building2,
    Bell,
    MessageSquare,
    Save,
    Upload,
    X,
    RefreshCw,
    Bot,
    Power,
    Phone,
    Instagram,
    Facebook,
    Globe,
    Calendar,
    Users,
        Clock,
        AlertCircle,
        AlertTriangle,
        HelpCircle,
        Eye,
        EyeOff,
        FileText,
        Zap
} from "lucide-react";
import toast from "react-hot-toast";
// import BaseConocimientoContent from "../components/BaseConocimientoContent"; // TEMPORALMENTE DESHABILITADO
import IntegracionesContent from "../components/configuracion/IntegracionesContent"; // 🆕 Integraciones

const ToggleSwitch = ({ enabled, onChange, label }) => {
    return (
        <div className="flex items-center gap-2">
            <button
                onClick={() => onChange(!enabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 ${
                    enabled ? 'bg-purple-600' : 'bg-gray-200'
                }`}
            >
                <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        enabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                />
            </button>
            {label && <span className="text-sm text-gray-700">{label}</span>}
        </div>
    );
};

const SettingSection = ({ title, description, icon, children }) => {
    return (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="border-b border-gray-100 p-3">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                        <div className="p-1.5 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                            {React.cloneElement(icon, { className: "w-4 h-4 text-white" })}
                        </div>
                        <div>
                            <h3 className="text-xs font-semibold text-gray-900">
                                {title}
                            </h3>
                            <p className="text-[10px] text-gray-600">{description}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-3">
                {children}
            </div>
        </div>
    );
};

const Configuracion = () => {
    const { businessId, business, user } = useAuthContext();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState('general');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Leer tab de la URL o del state al cargar
    useEffect(() => {
        // Prioridad 1: state de navegación (desde navigate con state)
        if (location.state?.activeTab && ['general', 'agent', 'channels', 'notifications', 'documentos'].includes(location.state.activeTab)) {
            setActiveTab(location.state.activeTab);
        }
        // Prioridad 2: parámetro de URL
        else {
            const tabFromUrl = searchParams.get('tab');
            if (tabFromUrl && ['general', 'agent', 'channels', 'notifications', 'documentos'].includes(tabFromUrl)) {
                setActiveTab(tabFromUrl);
            }
        }
    }, [searchParams, location.state]);
    
    const [settings, setSettings] = useState({
        name: "",
        description: "",
        cuisine_type: "",
        phone: "",
        email: "",
        website: "",
        address: "",
        city: "",
        postal_code: "",
        country: "ES",
        timezone: "Europe/Madrid",
        currency: "EUR",
        language: "es",
        capacity_total: 0,
        price_range: "",
        agent: {
            enabled: true,
            name: "Sofia",
            lastname: "Martínez",
            role: "Agente de Reservas",
            gender: "female",
            avatar_url: "",
            bio: "Profesional, amable y siempre dispuesta a ayudar. Le encanta su trabajo y conoce a la perfección cada detalle del restaurante. Paciente y con una sonrisa permanente, hará que cada cliente se sienta especial.",
            hired_date: new Date().toISOString().split('T')[0]
        },
        channels: {
            // Modo simple por defecto (objetos precreados para evitar undefined)
            voice: { enabled: false, phone_number: "" },
            whatsapp: { enabled: false, use_same_phone: true, phone_number: "", emergency_phone: "" },
            webchat: { enabled: true },
            instagram: { enabled: false, handle: "", invite_email: "" },
            facebook: { enabled: false, page_url: "", invite_email: "" },
            vapi: { enabled: false },
            reservations_email: { current_inbox: "", forward_to: "" },
            external: { thefork_url: "", google_reserve_url: "" }
        },
        notifications: {
            reservation_emails: [],
            system_emails: [],
            quiet_hours: { start: "", end: "", mode: "mute" },
            new_reservation: false,
            cancelled_reservation: false,
            reservation_modified: false,
            // daily_digest eliminado para MVP
            agent_offline: true,
            integration_errors: true,
            // Nuevos errores del sistema
            system_save_errors: true,
            system_connection_errors: true,
            system_reservation_conflicts: true,
            system_config_incomplete: true
        }
    });

    // Ayudas (popovers) por canal
    const [showHelpVAPI, setShowHelpVAPI] = useState(false);
    const [showHelpWA, setShowHelpWA] = useState(false);
    const [showHelpIG, setShowHelpIG] = useState(false);
    const [showHelpFB, setShowHelpFB] = useState(false);
  const [showHelpDigest, setShowHelpDigest] = useState(false);
  
  // Estados para mostrar/ocultar API Keys
  const [showVAPIKey, setShowVAPIKey] = useState(false);
  const [showWAToken, setShowWAToken] = useState(false);
  const [showIGToken, setShowIGToken] = useState(false);
  const [showFBToken, setShowFBToken] = useState(false);

  // Helper: RPC con fallback REST firmado si proyecto devuelve "No API key"
  const callRpcSafe = async (fnName, args) => {
    const { data, error } = await supabase.rpc(fnName, args);
    if (!error) return { data };
    if ((error.message || '').includes('No API key')) {
      try {
        const baseUrl = import.meta?.env?.VITE_SUPABASE_URL;
        const anon = import.meta?.env?.VITE_SUPABASE_ANON_KEY;
        const { data: { session } } = await supabase.auth.getSession();
        const resp = await fetch(`${baseUrl}/rest/v1/rpc/${fnName}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'apikey': anon,
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : `Bearer ${anon}`
          },
          body: JSON.stringify(args)
        });
        if (!resp.ok) {
          let detail = '';
          try { detail = await resp.text(); } catch {}
          throw new Error(detail || `REST error ${resp.status}`);
        }
        const json = await resp.json().catch(() => ({}));
        return { data: json };
      } catch (e) {
        return { error: e };
      }
    }
    return { error };
  };

    const tabs = [
        {
            id: "general",
            label: "General",
            icon: <Building2 className="w-4 h-4" />,
        },
        {
            id: "agent",
            label: "Agente IA",
            icon: <Bot className="w-4 h-4" />,
        },
        {
            id: "channels",
            label: "Canales",
            icon: <MessageSquare className="w-4 h-4" />,
        },
        {
            id: "notifications",
            label: "Notificaciones",
            icon: <Bell className="w-4 h-4" />,
        },
        {
            id: "documentos",
            label: "Documentos",
            icon: <FileText className="w-4 h-4" />,
        },
        {
            id: "integraciones",
            label: "Integraciones",
            icon: <Zap className="w-4 h-4" />,
        }
    ];


    useEffect(() => {
        const loadSettings = async () => {
            setLoading(true);
            console.log("📄 CARGANDO CONFIGURACIÓN - INICIO");
            console.log("🔍 Estado del contexto:", { 
                businessId, 
                hasBusiness: !!business,
                hasUser: !!user 
            });
            
            const { data: { user: authUser }, error: userError } = await supabase.auth.getUser();
            if (userError) {
                console.error("❌ Error obteniendo usuario:", userError);
                setLoading(false);
                return;
            }
            if (!authUser) {
                console.log("❌ No hay usuario autenticado");
                setLoading(false);
                return;
            }
            console.log("✅ Usuario autenticado:", authUser.email, authUser.id);

            // Preferir el businessId del contexto si está disponible
            let currentBusinessId = businessId;
            if (!currentBusinessId) {
                console.log("⚠️ No hay businessId en contexto, buscando en mapping...");
                const { data: mapping, error: mapError } = await supabase
                    .from('user_business_mapping')
                    .select('business_id')
                    .eq('auth_user_id', authUser.id)
                    .maybeSingle();
                
                console.log("📊 Resultado del mapping:", { mapping, error: mapError });
                
                if (mapError && mapError.code === '42501') {
                    console.log("🔄 Error de permisos, intentando con RPC...");
                    try {
                        const { data: rpcData, error: rpcErr } = await supabase
                            .rpc('get_user_business_info', { user_id: authUser.id });
                        console.log("📊 Resultado RPC:", { rpcData, error: rpcErr });
                        currentBusinessId = rpcData?.business_id || null;
                    } catch (e) {
                        console.error("❌ Error en RPC:", e);
                    }
                } else {
                    currentBusinessId = mapping?.business_id || null;
                }
            }
            
            if (!currentBusinessId) {
                console.error("⚠️ No se pudo determinar el Restaurant ID");
                console.log("📋 Información de depuración:", {
                    contexto: { businessId, restaurant },
                    usuario: authUser.id
                });
                setLoading(false);
                return;
            }
            console.log("🏪 Restaurant ID encontrado:", currentBusinessId);

            const { data: restaurantData, error: restError } = await supabase
                .from("businesses")
                .select("*")
                .eq("id", currentBusinessId)
                .maybeSingle();

            console.log("📊 DATOS DEL RESTAURANTE:", restaurantData);
            console.log("❌ ERROR AL CARGAR:", restError);

            if (restaurantData) {
                
                // Fusionar configuraciones manteniendo estructura completa
                const dbSettings = restaurantData.settings || {};
                
                setSettings({
                    // ✅ DATOS DIRECTOS DE LA TABLA
                    name: restaurantData.name || "",
                    email: restaurantData.email || "",
                    phone: restaurantData.phone || "",
                    address: restaurantData.address || "",
                    city: restaurantData.city || "",
                    postal_code: restaurantData.postal_code || "",
                    cuisine_type: restaurantData.cuisine_type || "",
                    
                    // ✅ TODO LO DEMÁS DESDE SETTINGS (JSONB)
                    contact_name: dbSettings.contact_name || "",
                    description: dbSettings.description || "",
                    website: dbSettings.website || "",
                    capacity: dbSettings.capacity_total || dbSettings.capacity || 50,
                    average_ticket: dbSettings.average_ticket || 45,
                    
                    // ✅ HORARIOS - Desde business_hours o settings
                    opening_hours: restaurantData.business_hours || dbSettings.opening_hours || {
                        monday: { open: '12:00', close: '23:00', closed: false },
                        tuesday: { open: '12:00', close: '23:00', closed: false },
                        wednesday: { open: '12:00', close: '23:00', closed: false },
                        thursday: { open: '12:00', close: '23:00', closed: false },
                        friday: { open: '12:00', close: '24:00', closed: false },
                        saturday: { open: '12:00', close: '24:00', closed: false },
                        sunday: { open: '12:00', close: '23:00', closed: false },
                    },
                    booking_settings: dbSettings.booking_settings || {
                        advance_booking_days: 30,
                        min_booking_hours: 2,
                        max_party_size: 12,
                        require_confirmation: true,
                        allow_modifications: true,
                        cancellation_policy: '24h',
                    },
                    
                    // ✅ CONFIGURACIÓN TÉCNICA
                    country: restaurantData.country || "ES",
                    timezone: restaurantData.timezone || "Europe/Madrid",
                    currency: restaurantData.currency || "EUR",
                    language: restaurantData.language || "es",
                    
                    // ✅ AGENTE IA
                    agent: {
                        enabled: dbSettings.agent?.enabled !== false,
                        name: dbSettings.agent?.name || "Sofia",
                        role: dbSettings.agent?.role || "Agente de Reservas",
                        gender: dbSettings.agent?.gender || "female",
                        avatar_url: dbSettings.agent?.avatar_url || "",
                        bio: dbSettings.agent?.bio || "Profesional, amable y siempre dispuesta a ayudar. Le encanta su trabajo y conoce a la perfección cada detalle del restaurante. Paciente y con una sonrisa permanente, hará que cada cliente se sienta especial.",
                        hired_date: dbSettings.agent?.hired_date || new Date().toISOString().split('T')[0]
                    },
                    
                    // ✅ CANALES Y NOTIFICACIONES
                    channels: {
                        voice: { 
                            enabled: dbSettings.channels?.voice?.enabled || false, 
                            phone_number: dbSettings.channels?.voice?.phone_number || "",
                            mobile_number: dbSettings.channels?.voice?.mobile_number || ""
                        },
                        vapi: { 
                            enabled: dbSettings.channels?.vapi?.enabled || false,
                            api_key: dbSettings.channels?.vapi?.api_key || "",
                            use_same_phone: dbSettings.channels?.vapi?.use_same_phone ?? true,
                            voice_number: dbSettings.channels?.vapi?.voice_number || ""
                        },
                        whatsapp: {
                            enabled: dbSettings.channels?.whatsapp?.enabled || false,
                            api_token: dbSettings.channels?.whatsapp?.api_token || "",
                            business_account_id: dbSettings.channels?.whatsapp?.business_account_id || "",
                            use_same_phone: dbSettings.channels?.whatsapp?.use_same_phone ?? true,
                            phone_number: dbSettings.channels?.whatsapp?.phone_number || "",
                            emergency_phone: dbSettings.channels?.whatsapp?.emergency_phone || ""  // ✅ AÑADIDO
                        },
                        instagram: { 
                            enabled: dbSettings.channels?.instagram?.enabled || false, 
                            handle: dbSettings.channels?.instagram?.handle || "", 
                            access_token: dbSettings.channels?.instagram?.access_token || "",
                            business_account_id: dbSettings.channels?.instagram?.business_account_id || "",
                            invite_email: dbSettings.channels?.instagram?.invite_email || "" 
                        },
                        facebook: { 
                            enabled: dbSettings.channels?.facebook?.enabled || false, 
                            page_url: dbSettings.channels?.facebook?.page_url || "",
                            page_access_token: dbSettings.channels?.facebook?.page_access_token || "",
                            page_id: dbSettings.channels?.facebook?.page_id || "",
                            invite_email: dbSettings.channels?.facebook?.invite_email || "" 
                        },
                        webchat: { enabled: dbSettings.channels?.webchat?.enabled !== false, site_domain: dbSettings.channels?.webchat?.site_domain || "", widget_key: dbSettings.channels?.webchat?.widget_key || "" },
                        reservations_email: {
                            current_inbox: dbSettings.channels?.reservations_email?.current_inbox || "",
                            forward_to: dbSettings.channels?.reservations_email?.forward_to || ""
                        },
                        external: {
                            thefork_url: dbSettings.channels?.external?.thefork_url || "",
                            google_reserve_url: dbSettings.channels?.external?.google_reserve_url || ""
                        }
                    },
                    notifications: {
                        reservation_emails: restaurantData.notifications?.reservation_emails || [],
                        system_emails: restaurantData.notifications?.system_emails || [],
                        quiet_hours: restaurantData.notifications?.quiet_hours || { start: "", end: "", mode: "mute" },
                        new_reservation: restaurantData.notifications?.new_reservation ?? false,
                        cancelled_reservation: restaurantData.notifications?.cancelled_reservation ?? false,
                        reservation_modified: restaurantData.notifications?.reservation_modified ?? false,
                        // daily_digest eliminado para MVP
                        agent_offline: restaurantData.notifications?.agent_offline ?? true,
                        integration_errors: restaurantData.notifications?.integration_errors ?? true,
                        // Nuevos errores del sistema
                        system_save_errors: restaurantData.notifications?.system_save_errors ?? true,
                        system_connection_errors: restaurantData.notifications?.system_connection_errors ?? true,
                        system_reservation_conflicts: restaurantData.notifications?.system_reservation_conflicts ?? true,
                        system_config_incomplete: restaurantData.notifications?.system_config_incomplete ?? true
                    },
                });
            }

            setLoading(false);
        };

        loadSettings();
    }, []);

    const handleSave = async (section) => {
        // Determinar businessId de forma robusta
        let effectivebusinessId = businessId;
        if (!effectivebusinessId) {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: mapping } = await supabase
                    .from('user_business_mapping')
                    .select('business_id')
                    .eq('auth_user_id', user.id)
                    .maybeSingle();
                effectivebusinessId = mapping?.business_id || null;
            }
        }
        if (!effectivebusinessId) {
            toast.error("No se encontró el ID del restaurante");
            return;
        }

        try {
            setSaving(true);

            if (section === "Información General") {
                // Obtener configuración actual para hacer merge
                const { data: currentData } = await supabase
                    .from("businesses")
                    .select("settings")
                    .eq("id", effectivebusinessId)
                    .single();
                    
                const currentSettings = currentData?.settings || {};
                
                // Guardar campos directos + campos en settings
                const { error } = await supabase
                    .from("businesses")
                    .update({
                        name: settings.name,
                        email: settings.email,
                        phone: settings.phone,
                        address: settings.address,
                        city: settings.city,
                        postal_code: settings.postal_code,
                        cuisine_type: settings.cuisine_type,
                        settings: {
                            ...currentSettings,
                            contact_name: settings.contact_name,
                            description: settings.description,
                            website: settings.website,
                            capacity_total: settings.capacity || settings.capacity_total,
                            average_ticket: settings.average_ticket,
                            price_range: settings.price_range
                        },
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", effectivebusinessId);

                if (error) throw error;
            } else if (section === "Canales de comunicación") {
                // Validaciones previas (no permitir guardar con campos críticos vacíos)
                const ch = settings.channels || {};
                const errors = [];
                if (ch.voice?.enabled && !ch.voice?.phone_number) {
                    errors.push('Teléfono de reservas: faltan números.');
                }
                if (ch.whatsapp?.enabled) {
                    if (ch.whatsapp?.use_same_phone) {
                        if (!ch.voice?.phone_number) errors.push('WhatsApp: usa mismo número, pero no hay teléfono en llamadas.');
                    } else if (!ch.whatsapp?.phone_number) {
                        errors.push('WhatsApp: falta el número.');
                    }
                    // Validar número de emergencia
                    if (!ch.whatsapp?.emergency_phone) {
                        errors.push('WhatsApp: falta el número de emergencia (obligatorio).');
                    }
                }
                if (ch.vapi?.enabled) {
                    if (ch.vapi?.use_same_phone) {
                        if (!ch.voice?.phone_number) errors.push('VAPI: usa mismo número, pero no hay teléfono principal configurado.');
                    } else if (!ch.vapi?.voice_number) {
                        errors.push('VAPI: falta el número del asistente.');
                    }
                }
                if (ch.instagram?.enabled) {
                    if (!ch.instagram?.handle) errors.push('Instagram: falta usuario/URL.');
                    if (!ch.instagram?.invite_email) errors.push('Instagram: falta email para invitarnos como admin.');
                }
                if (ch.facebook?.enabled) {
                    if (!ch.facebook?.page_url) errors.push('Facebook: falta URL de la página.');
                    if (!ch.facebook?.invite_email) errors.push('Facebook: falta email para invitarnos como admin.');
                }
                // Email de reservas: si rellenan current_inbox pero no alias, lo genero más abajo; no bloquear
                if (errors.length > 0) {
                    toast.error(errors[0]);
                    return;
                }
                // Preparar canales con defaults
                const updatedChannels = {
                    ...settings.channels,
                };
                // Si usan mismo número para WhatsApp, reflejarlo
                if (updatedChannels?.whatsapp?.use_same_phone && updatedChannels?.voice?.phone_number) {
                    updatedChannels.whatsapp = {
                        ...updatedChannels.whatsapp,
                        phone_number: updatedChannels.voice.phone_number,
                    };
                }
                // Si usan mismo número para VAPI, reflejarlo
                if (updatedChannels?.vapi?.use_same_phone && updatedChannels?.voice?.phone_number) {
                    updatedChannels.vapi = {
                        ...updatedChannels.vapi,
                        voice_number: updatedChannels.voice.phone_number,
                    };
                }
                // Generar alias de reenvío si está vacío
                try {
                    const envDomain = (import.meta?.env?.VITE_ALIAS_EMAIL_DOMAIN) || '';
                    const hostnameBase = envDomain || (typeof window !== 'undefined' ? window.location.hostname : 'alias.local');
                if (updatedChannels?.reservations_email && !updatedChannels.reservations_email.forward_to) {
                        updatedChannels.reservations_email = {
                            ...updatedChannels.reservations_email,
                        forward_to: `reservas-${effectivebusinessId}@${hostnameBase}`
                        };
                    }
                } catch {}

                // Primero obtener los settings actuales de la BD
                const { data: currentData } = await supabase
                    .from('businesses')
                    .select('settings')
                    .eq('id', effectivebusinessId)
                    .single();
                
                const currentSettings = currentData?.settings || {};
                
                // ✅ CORREGIDO: Actualizar tanto 'channels' como 'settings' para preservar toda la info
                const updatedSettings = {
                    ...currentSettings,
                    channels: updatedChannels  // Añadir channels a settings también
                };
                
                const { data, error } = await supabase
                    .from('businesses')
                    .update({
                        channels: updatedChannels,  // Columna channels
                        settings: updatedSettings,   // ✅ NUEVO: También actualizar settings
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', effectivebusinessId)
                    .select();
                
                if (error) throw error;
                
                // 🔥 SINCRONIZAR CON channel_credentials para N8N
                // Guardar WhatsApp en channel_credentials para que N8N pueda identificar el restaurante
                if (updatedChannels?.whatsapp?.enabled && updatedChannels?.whatsapp?.phone_number) {
                    const whatsappNumber = updatedChannels.whatsapp.phone_number;
                    
                    // Buscar si ya existe el registro
                    const { data: existing } = await supabase
                        .from('channel_credentials')
                        .select('id')
                        .eq('business_id', effectivebusinessId)
                        .eq('channel', 'twilio_whatsapp')
                        .maybeSingle();
                    
                    if (existing) {
                        // Actualizar existente
                        await supabase
                            .from('channel_credentials')
                            .update({
                                channel_identifier: whatsappNumber,
                                is_active: true,
                                updated_at: new Date().toISOString()
                            })
                            .eq('id', existing.id);
                    } else {
                        // Crear nuevo
                        await supabase
                            .from('channel_credentials')
                            .insert({
                                business_id: effectivebusinessId,
                                channel: 'twilio_whatsapp',
                                channel_identifier: whatsappNumber,
                                is_active: true,
                                credentials: {},
                                config: {}
                            });
                    }
                    // Sincronización con channel_credentials completada
                } else if (updatedChannels?.whatsapp?.enabled === false) {
                    // Si se deshabilita WhatsApp, marcar como inactivo
                    await supabase
                        .from('channel_credentials')
                        .update({ is_active: false })
                        .eq('business_id', effectivebusinessId)
                        .eq('channel', 'twilio_whatsapp');
                }
            } else if (section === "Configuración del Agente") {
                // Guardar configuración del agente en settings
                const { data: currentData } = await supabase
                    .from("businesses")
                    .select("settings")
                    .eq("id", effectivebusinessId)
                    .single();
                    
                const currentSettings = currentData?.settings || {};
                
                // Eliminar el campo lastname si existe (ya no se usa)
                const agentData = { ...settings.agent };
                delete agentData.lastname;
                
                const { error } = await supabase
                    .from("businesses")
                    .update({
                        settings: {
                            ...currentSettings,
                            agent: agentData
                        },
                        updated_at: new Date().toISOString()
                    })
                    .eq("id", effectivebusinessId);

                if (error) throw error;
            } else if (section === "Configuración de notificaciones") {
                // Validaciones previas para notificaciones
                const n = settings.notifications || {};
                const anyEnabled = (n.new_reservation || n.cancelled_reservation || n.reservation_modified || n.agent_offline || n.integration_errors || n.system_save_errors || n.system_connection_errors || n.system_reservation_conflicts || n.system_config_incomplete) === true;
                const hasRecipients = (Array.isArray(n.reservation_emails) && n.reservation_emails.length > 0) || (Array.isArray(n.system_emails) && n.system_emails.length > 0);
                if (anyEnabled && !hasRecipients) {
                    toast.error('Añade al menos un email destinatario para las notificaciones.');
                    return;
                }
                // Defaults de horario silencioso
                const qh = settings.notifications?.quiet_hours || {};
                const updatedNotifications = {
                    ...settings.notifications,
                    quiet_hours: {
                        start: qh.start || '08:00',
                        end: qh.end || '22:00',
                        mode: qh.mode || 'digest'
                    }
                };

                const { error } = await callRpcSafe('update_restaurant_notifications', {
                    p_business_id: effectivebusinessId,
                    p_notifications: updatedNotifications
                });
                if (error) {
                    console.error('RPC update_restaurant_notifications error:', error);
                    throw error;
                }
            }

            toast.success(`✅ ${section} guardado correctamente`);
            
            // ✅ Si se guardaron canales, disparar evento para refrescar Dashboard
            if (section === "Canales") {
                window.dispatchEvent(new CustomEvent('channels-updated', {
                    detail: { channels: settings.channels }
                }));
                console.log('✅ Evento channels-updated disparado');
            }
            
            // SINCRONIZAR CONTEXTO: Forzar recarga del restaurant en AuthContext
            // Esto asegura que el Dashboard y otras páginas vean los cambios inmediatamente
            if (section === "Agente IA") {
                console.log('🔄 Sincronizando datos del agente con el contexto...');
                
                // Recargar los datos del restaurante desde Supabase
                const { data: updatedRestaurant, error: fetchError } = await supabase
                    .from('businesses')
                    .select('*')
                    .eq('id', effectivebusinessId)
                    .single();
                
                if (!fetchError && updatedRestaurant) {
                    // Disparar evento personalizado para que AuthContext se actualice
                    window.dispatchEvent(new CustomEvent('restaurant-updated', {
                        detail: { restaurant: updatedRestaurant }
                    }));
                    
                    console.log('✅ Contexto sincronizado correctamente');
                }
            }
            
        } catch (error) {
            console.error("❌ Error guardando:", error);
            toast.error("Error al guardar la configuración");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <RefreshCw className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                    <p className="text-gray-600">Cargando configuración...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            <div className="max-w-[85%] mx-auto px-4 py-4">
                <div className="mb-3 p-3 bg-white rounded-xl shadow-sm border">
                    <div className="flex items-center gap-3">
                        <div className="bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg p-2 shadow-md">
                            <SettingsIcon className="w-5 h-5 text-white" />
                    </div>
                        <div>
                            <h1 className="text-sm font-bold text-gray-900">Configuración</h1>
                            <p className="text-xs text-gray-600">
                        Centro de control para tu restaurante. Configura canales de comunicación y notificaciones.
                    </p>
                        </div>
                    </div>
                </div>

                {/* Tabs - Homogeneizados */}
                <div className="bg-white rounded-xl shadow-sm border p-1 mb-3">
                    <div className="flex gap-1 overflow-x-auto">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                className={`
                                    px-6 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap 
                                    flex items-center gap-2 transition-all
                                    ${activeTab === tab.id
                                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                                        : "text-gray-600 hover:bg-gray-100"
                                    }
                                `}
                                >
                                    {tab.icon}
                                    {tab.label}
                                </button>
                            ))}
                    </div>
                </div>

                <div className="space-y-3">
                    {activeTab === "general" && (
                        <div className="space-y-3">
                            <SettingSection
                                title="Información General"
                                description="Configuración básica de tu restaurante"
                                icon={<Building2 />}
                            >
                                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Nombre del restaurante
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.name}
                                                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Nombre de tu restaurante"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Tipo de cocina
                                            </label>
                                            <select
                                                value={settings.cuisine_type}
                                                onChange={(e) => setSettings(prev => ({ ...prev, cuisine_type: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                            >
                                                <option value="">Selecciona el tipo</option>
                                                <option value="Mediterránea">Mediterránea</option>
                                                <option value="Española">Española</option>
                                                <option value="Italiana">Italiana</option>
                                                <option value="Asiática">Asiática</option>
                                                <option value="Mexicana">Mexicana</option>
                                                <option value="Francesa">Francesa</option>
                                                <option value="Japonesa">Japonesa</option>
                                                <option value="China">China</option>
                                                <option value="India">India</option>
                                                <option value="Americana">Americana</option>
                                                <option value="Vegetariana/Vegana">Vegetariana/Vegana</option>
                                                <option value="Marisquería">Marisquería</option>
                                                <option value="Asador/Parrilla">Asador/Parrilla</option>
                                                <option value="Tapas">Tapas</option>
                                                <option value="Fusión">Fusión</option>
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Email de contacto
                                            </label>
                                            <input
                                                type="email"
                                                value={settings.email}
                                                onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="contacto@restaurante.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Nombre del contacto
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.contact_name || ""}
                                                onChange={(e) => setSettings(prev => ({ ...prev, contact_name: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Tu nombre"
                                            />
                                            <p className="text-xs text-gray-500 mt-1">¿Cómo quieres que te llame el sistema?</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Sitio web
                                            </label>
                                            <input
                                                type="url"
                                                value={settings.website}
                                                onChange={(e) => setSettings(prev => ({ ...prev, website: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="https://www.turestaurante.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Teléfono persona de contacto (emergencias)
                                            </label>
                                            <input
                                                type="tel"
                                                value={settings.phone}
                                                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                                                className="w-full px-4 py-2 border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                placeholder="+34 600 000 000"
                                            />
                                            <p className="text-xs text-red-600 mt-1 font-medium">
                                                ⚠️ Este es el número del encargado para recibir alertas urgentes (NO pongas el teléfono del restaurante)
                                            </p>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Descripción del restaurante
                                            </label>
                                            <textarea
                                                value={settings.description}
                                                onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                                                rows="3"
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Describe tu restaurante, especialidades, ambiente..."
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Dirección completa
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.address}
                                                onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Calle Mayor 123, Madrid"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Ciudad
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.city}
                                                onChange={(e) => setSettings(prev => ({ ...prev, city: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Madrid"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">
                                                Código postal
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.postal_code}
                                                onChange={(e) => setSettings(prev => ({ ...prev, postal_code: e.target.value }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="28001"
                                            />
                                        </div>

                                    </div>

                                    <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                                        <button
                                            onClick={() => handleSave("Información General")}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                        >
                                            {saving ? (
                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Save className="w-4 h-4" />
                                            )}
                                            Guardar General
                                        </button>
                                    </div>
                                </div>
                            </SettingSection>
                        </div>
                    )}

                    {activeTab === "agent" && (
                        <div className="space-y-2">
                            <SettingSection
                                title="Configuración del Agente IA"
                                description="Control centralizado de tu asistente virtual"
                                icon={<Bot />}
                            >
                                <div className="space-y-2">
                                    {/* Tarjeta de perfil profesional */}
                                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                                        <div className="grid grid-cols-1 md:grid-cols-1 lg:grid-cols-[400px_1fr] gap-0">
                                            {/* COLUMNA IZQUIERDA: Foto + Descripción */}
                                            <div className="bg-gradient-to-br from-blue-600 via-purple-600 to-purple-700 p-4 md:p-6 flex flex-col items-center">
                                                {/* Foto del agente */}
                                                <div className="relative group mb-4 md:mb-6">
                                                    <div className="w-56 h-72 md:w-72 md:h-96 rounded-2xl overflow-hidden shadow-lg bg-gradient-to-br from-blue-700 via-purple-700 to-purple-800 flex items-center justify-center transform transition-all duration-300 group-hover:shadow-xl">
                                                        {settings.agent?.avatar_url ? (
                                                            <img
                                                                src={settings.agent.avatar_url}
                                                                alt={settings.agent?.name || "Agente"}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        ) : (
                                                            <div className="flex flex-col items-center gap-2 text-white p-8">
                                                                <Bot className="w-32 h-32 opacity-60" />
                                                                <p className="text-base font-medium text-center">
                                                                    Sube la foto de tu empleado virtual
                                                                </p>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Botones */}
                                                <div className="w-full max-w-xs space-y-3 mb-6">
                                                    <input
                                                        type="file"
                                                        id="avatar-upload-main"
                                                        accept="image/*"
                                                        className="hidden"
                                                    onChange={(e) => {
                                                        const file = e.target.files[0];
                                                        if (file) {
                                                            // Validar tamaño (máx 5MB)
                                                            if (file.size > 5 * 1024 * 1024) {
                                                                toast.error('La imagen es demasiado grande. Máximo 5MB');
                                                                return;
                                                            }

                                                            // Comprimir imagen antes de guardar
                                                            const reader = new FileReader();
                                                            reader.onload = (event) => {
                                                                const img = new Image();
                                                                img.onload = () => {
                                                                    // Crear canvas para redimensionar
                                                                    const canvas = document.createElement('canvas');
                                                                    const ctx = canvas.getContext('2d');
                                                                    
                                                                    // Tamaño máximo: 400x600 (ideal para avatares)
                                                                    const maxWidth = 400;
                                                                    const maxHeight = 600;
                                                                    let width = img.width;
                                                                    let height = img.height;

                                                                    if (width > maxWidth || height > maxHeight) {
                                                                        const ratio = Math.min(maxWidth / width, maxHeight / height);
                                                                        width = width * ratio;
                                                                        height = height * ratio;
                                                                    }

                                                                    canvas.width = width;
                                                                    canvas.height = height;
                                                                    ctx.drawImage(img, 0, 0, width, height);

                                                                    // Convertir a Base64 con compresión (calidad 0.8)
                                                                    const compressedBase64 = canvas.toDataURL('image/jpeg', 0.8);

                                                                    setSettings(prev => ({
                                                                        ...prev,
                                                                        agent: {
                                                                            ...prev.agent,
                                                                            avatar_url: compressedBase64
                                                                        }
                                                                    }));
                                                                    toast.success('Avatar cargado y optimizado correctamente');
                                                                };
                                                                img.src = event.target.result;
                                                            };
                                                            reader.readAsDataURL(file);
                                                        }
                                                    }}
                                                    />
                                                    <button 
                                                        type="button"
                                                        onClick={() => document.getElementById('avatar-upload-main').click()}
                                                        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl hover:bg-gray-50 transition-all duration-200 shadow-md font-semibold"
                                                    >
                                                        <Upload className="w-5 h-5" />
                                                        Subir avatar
                                                    </button>
                                                    {settings.agent?.avatar_url && (
                                                        <button 
                                                            type="button"
                                                            onClick={() => {
                                                                if (window.confirm('¿Eliminar el avatar?')) {
                                                                    setSettings(prev => ({
                                                                        ...prev,
                                                                        agent: {
                                                                            ...prev.agent,
                                                                            avatar_url: ''
                                                                        }
                                                                    }));
                                                                    toast.success('Avatar eliminado');
                                                                }
                                                            }}
                                                            className="w-full text-sm text-white hover:text-red-200 font-medium transition-colors"
                                                        >
                                                            Eliminar avatar
                                                        </button>
                                                    )}
                                                    <p className="text-xs text-white/70 text-center">
                                                        JPG o PNG (máx. 5MB)
                                                    </p>
                                                </div>

                                                {/* Descripción */}
                                                <div className="w-full max-w-xs">
                                                    <div className="bg-white/10 backdrop-blur-sm p-5 rounded-xl border border-white/20">
                                                        <h4 className="font-semibold text-white mb-3 text-sm flex items-center gap-2">
                                                            <MessageSquare className="w-4 h-4" />
                                                            Descripción
                                                        </h4>
                                                        <p className="text-sm text-white/90 leading-relaxed">
                                                            {settings.agent?.bio || "Profesional, amable y siempre dispuesta a ayudar. Le encanta su trabajo y conoce a la perfección cada detalle del restaurante. Paciente y con una sonrisa permanente, hará que cada cliente se sienta especial."}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* COLUMNA DERECHA: Configuración */}
                                            <div className="p-4 md:p-8 flex flex-col gap-2 md:gap-6">
                                                {/* Información del empleado */}
                                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                    <div className="space-y-1">
                                                        <div className="flex items-center gap-2 text-sm">
                                                            <span className="font-bold text-gray-900">
                                                                {settings.agent?.name}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <span>📋</span>
                                                            <span>{settings.agent?.role}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <span>📅</span>
                                                            <span>En plantilla desde: {new Date(settings.agent?.hired_date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 text-xs text-gray-600">
                                                            <span>⏰</span>
                                                            <span>Turno: 24/7</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Nombre del Agente */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Nombre
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.agent?.name || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            agent: {
                                                                ...prev.agent,
                                                                name: e.target.value
                                                            }
                                                        }))}
                                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="Sofia"
                                                    />
                                                </div>

                                                {/* Puesto/Rol */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Puesto
                                                    </label>
                                                    <input
                                                        type="text"
                                                        value={settings.agent?.role || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            agent: {
                                                                ...prev.agent,
                                                                role: e.target.value
                                                            }
                                                        }))}
                                                        className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="Agente de Reservas"
                                                    />
                                                    <p className="text-[10px] text-gray-500 mt-0.5">
                                                        Ej: Agente de Reservas, Recepcionista Virtual, etc.
                                                    </p>
                                                </div>

                                                {/* Género de la voz */}
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                                        Género de la voz telefónica
                                                    </label>
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => setSettings(prev => ({
                                                                ...prev,
                                                                agent: {
                                                                    ...prev.agent,
                                                                    gender: "female"
                                                                }
                                                            }))}
                                                            className={`px-3 py-2 rounded-lg border transition-all text-xs font-medium ${
                                                                settings.agent?.gender === "female"
                                                                    ? "border-purple-500 bg-purple-50 text-purple-700 shadow-sm"
                                                                    : "border-gray-300 bg-white text-gray-700 hover:border-purple-300"
                                                            }`}
                                                        >
                                                            👩 Femenino
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSettings(prev => ({
                                                                ...prev,
                                                                agent: {
                                                                    ...prev.agent,
                                                                    gender: "male"
                                                                }
                                                            }))}
                                                            className={`px-3 py-2 rounded-lg border transition-all text-xs font-medium ${
                                                                settings.agent?.gender === "male"
                                                                    ? "border-blue-500 bg-blue-50 text-blue-700 shadow-sm"
                                                                    : "border-gray-300 bg-white text-gray-700 hover:border-blue-300"
                                                            }`}
                                                        >
                                                            👨 Masculino
                                                        </button>
                                                    </div>
                                                    <p className="text-[10px] text-gray-600 mt-0.5">
                                                        Define qué voz usará en llamadas
                                                    </p>
                                                </div>

                                                {/* Estado activo/inactivo */}
                                                <div className="bg-white p-2 rounded-lg border border-gray-200">
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <p className="font-semibold text-gray-900 text-xs">
                                                                Estado del agente
                                                            </p>
                                                            <p className="text-[10px] text-gray-600 mt-0.5">
                                                                {settings.agent?.enabled ? "✅ Activo - Atendiendo 24/7" : "❌ Desactivado"}
                                                            </p>
                                                        </div>
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={settings.agent?.enabled || false}
                                                                onChange={async (e) => {
                                                                    const newEnabled = e.target.checked;
                                                                    setSettings(prev => ({
                                                                        ...prev,
                                                                        agent: {
                                                                            ...prev.agent,
                                                                            enabled: newEnabled
                                                                        }
                                                                    }));
                                                                    
                                                                    // Si se desactiva, enviar email de confirmación
                                                                    if (!newEnabled && businessId) {
                                                                        try {
                                                                            console.log('🔔 Enviando email de confirmación de desactivación...');
                                                                            const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/agent-deactivated`, {
                                                                                method: 'POST',
                                                                                headers: { 'Content-Type': 'application/json' },
                                                                                body: JSON.stringify({ business_id: businessId })
                                                                            });
                                                                            const result = await response.json();
                                                                            if (result.success) {
                                                                                console.log('✅ Email de confirmación enviado');
                                                                            }
                                                                        } catch (error) {
                                                                            console.error('❌ Error enviando confirmación:', error);
                                                                        }
                                                                    }
                                                                }}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-16 h-8 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-8 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-7 after:w-7 after:transition-all peer-checked:bg-gradient-to-r peer-checked:from-blue-600 peer-checked:to-purple-600"></div>
                                                        </label>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Información cuando está desactivado */}
                                    {!settings.agent?.enabled && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                                            <div className="flex gap-3">
                                                <Power className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                                                <div>
                                                    <h4 className="font-semibold text-amber-900">Agente desactivado</h4>
                                                    <p className="text-sm text-amber-800 mt-1">
                                                        El agente no responderá a clientes en WhatsApp, teléfono, Instagram, Facebook ni otros canales.
                                                        Las reservas manuales desde el dashboard siguen funcionando normalmente.
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    )}


                                    {/* Botón guardar */}
                                    <div className="flex justify-end pt-4 border-t border-gray-200">
                                        <button
                                            onClick={() => handleSave("Configuración del Agente")}
                                            disabled={saving}
                                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all duration-200 disabled:opacity-50 font-semibold shadow-lg"
                                        >
                                            {saving ? (
                                                <>
                                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                                    Guardando...
                                                </>
                                            ) : (
                                                <>
                                                    <Save className="w-4 h-4" />
                                                    Guardar Configuración
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </SettingSection>
                        </div>
                    )}

                    {activeTab === "channels" && (
                        <SettingSection
                            title="Canales de Comunicación"
                            description="Gestión de canales de comunicación con clientes"
                            icon={<MessageSquare />}
                        >
                            <div className="space-y-2">
                                {/* INFORMACIÓN DEL RESTAURANTE */}
                                {/* Aviso ANTES de todo */}
                                <div className="bg-amber-50 border border-amber-300 rounded-lg p-2 mb-2">
                                    <div className="flex items-start gap-2">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                                        <div className="flex-1">
                                            <h5 className="font-semibold text-xs text-gray-900 mb-1">⚠️ IMPORTANTE: Necesitarás DOS números diferentes</h5>
                                            <div className="space-y-0.5 text-[10px] text-gray-700">
                                                <p><strong>1️⃣ Número para canales IA:</strong> Se dedicará 100% a la inteligencia artificial.</p>
                                                <p><strong>2️⃣ Número de emergencia:</strong> Tu móvil personal o del encargado. Para recibir alertas urgentes.</p>
                                                <p className="text-[10px] text-amber-700 font-medium mt-1">
                                                    💡 Si no tienes un número dedicado para los canales, ya conseguiremos uno.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* LOS DOS NÚMEROS JUNTOS */}
                                <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 border border-purple-200 rounded-lg p-2 shadow-sm">
                                    <h4 className="text-xs font-semibold text-purple-900 uppercase mb-2 flex items-center gap-1.5">
                                        <Phone className="w-3.5 h-3.5" />
                                        📞 NÚMEROS DE TELÉFONO
                                    </h4>
                                    <p className="text-[10px] text-gray-700 mb-2">
                                        Estos números se usarán automáticamente en <strong>todos los canales</strong> (WhatsApp, VAPI, Instagram, Facebook, etc.)
                                    </p>
                                    
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        {/* Número 1: Canales IA */}
                                        <div className="bg-white rounded-lg p-2 border border-blue-300">
                                            <label className="block text-xs font-semibold text-blue-900 mb-1">
                                                1️⃣ Número dedicado para canales IA *
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.channels?.voice?.phone_number || ""}
                                                onChange={(e) => setSettings(prev => ({
                                                    ...prev,
                                                    channels: {
                                                        ...prev.channels,
                                                        voice: { ...prev.channels?.voice, phone_number: e.target.value }
                                                    }
                                                }))}
                                                className="w-full px-2 py-1.5 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono"
                                                placeholder="+34 600 000 000"
                                            />
                                            <p className="text-[10px] text-gray-600 mt-1">
                                                📱 Este número lo verán tus clientes al interactuar con la IA (dedicado 100% a IA, no lo uses para llamadas normales)
                                            </p>
                                        </div>

                                        {/* Número 2: Emergencia */}
                                        <div className="bg-white rounded-lg p-2 border border-red-300">
                                            <label className="block text-xs font-semibold text-red-900 mb-1">
                                                2️⃣ Número de emergencia (humano) *
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.channels?.whatsapp?.emergency_phone || ""}
                                                onChange={(e) => setSettings(prev => ({
                                                    ...prev,
                                                    channels: {
                                                        ...prev.channels,
                                                        whatsapp: { ...prev.channels?.whatsapp, emergency_phone: e.target.value }
                                                    }
                                                }))}
                                                className="w-full px-2 py-1.5 text-xs border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 font-mono"
                                                placeholder="+34 600 000 000"
                                            />
                                            <p className="text-[10px] text-gray-600 mt-1">
                                                🆘 Número del encargado para recibir alertas urgentes cuando la IA necesite ayuda (debe ser diferente al número de canales)
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                <div className="border-t border-gray-300 pt-2">
                                    <h4 className="text-xs font-semibold text-gray-700 uppercase mb-2">🤖 Canales de comunicación IA</h4>
                                </div>

                                {/* VAPI - Llamadas IA */}
                                <div className="bg-white p-2 rounded-lg border border-gray-200 hover:border-purple-300 transition-colors">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-start gap-2 flex-1">
                                            <div className="w-7 h-7 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Bot className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-xs text-gray-900">VAPI - Llamadas IA</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowHelpVAPI(v => !v)}
                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <HelpCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-0.5">Asistente telefónico inteligente</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.channels?.vapi?.enabled || false}
                                            onChange={(enabled) => setSettings(prev => ({
                                                ...prev,
                                                channels: {
                                                    ...prev.channels,
                                                    vapi: { ...prev.channels?.vapi, enabled }
                                                }
                                            }))}
                                        />
                                    </div>
                                    {showHelpVAPI && (
                                        <div className="mb-4 p-3 rounded-lg bg-purple-50 border border-purple-200 text-sm text-gray-700">
                                            <p className="font-medium mb-1">¿Cómo funciona?</p>
                                            <ol className="list-decimal ml-5 space-y-1 text-xs">
                                                <li>VAPI es nuestro asistente de voz con IA que atiende llamadas 24/7.</li>
                                                <li>Proporciona tu API Key de VAPI para la integración.</li>
                                                <li>Configura el número donde recibirá las llamadas.</li>
                                                <li>Gestiona reservas, consultas y derivaciones automáticamente.</li>
                                            </ol>
                                        </div>
                                    )}
                                    {settings.channels?.vapi?.enabled && (
                                        <div className="grid grid-cols-1 gap-3 mt-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">API Key de VAPI</label>
                                                <div className="relative">
                                                    <input
                                                        type={showVAPIKey ? "text" : "password"}
                                                        value={settings.channels?.vapi?.api_key || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                vapi: { ...prev.channels?.vapi, api_key: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
                                                        placeholder="sk_live_..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowVAPIKey(!showVAPIKey)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                    >
                                                        {showVAPIKey ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Obtén tu API Key desde tu dashboard de VAPI</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-purple-50 p-3 rounded-lg">
                                                <input
                                                    id="vapi-same-number"
                                                    type="checkbox"
                                                    checked={settings.channels?.vapi?.use_same_phone ?? true}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            vapi: { ...prev.channels?.vapi, use_same_phone: e.target.checked }
                                                        }
                                                    }))}
                                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                                />
                                                <label htmlFor="vapi-same-number" className="text-sm font-medium text-gray-700">Usar el mismo número de llamadas</label>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Número para el asistente (voz)</label>
                                                <input
                                                    type="text"
                                                    value={(settings.channels?.vapi?.use_same_phone ? settings.channels?.voice?.phone_number : settings.channels?.vapi?.voice_number) || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            vapi: { ...prev.channels?.vapi, voice_number: e.target.value }
                                                        }
                                                    }))}
                                                    disabled={settings.channels?.vapi?.use_same_phone}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                    placeholder="+34 910 000 000"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* WhatsApp Business */}
                                <div className="bg-white p-2 rounded-lg border border-gray-200 hover:border-green-300 transition-colors">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-start gap-2 flex-1">
                                            <div className="w-7 h-7 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <MessageSquare className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-xs text-gray-900">WhatsApp Business</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowHelpWA(v => !v)}
                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <HelpCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-0.5">Canal principal de comunicación</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.channels?.whatsapp?.enabled || false}
                                            onChange={(enabled) => setSettings(prev => ({
                                                ...prev,
                                                channels: {
                                                    ...prev.channels,
                                                    whatsapp: { ...prev.channels?.whatsapp, enabled }
                                                }
                                            }))}
                                        />
                                    </div>
                                    {showHelpWA && (
                                        <div className="mb-2 p-2 rounded-lg bg-green-50 border border-green-200 text-[10px] text-gray-700">
                                            <p className="font-medium mb-0.5">¿Dónde consigo esto?</p>
                                            <ol className="list-decimal ml-3 space-y-0.5 text-[10px]">
                                                <li>Indica el número que ya usas con tus clientes.</li>
                                                <li>Proporciona tu API Token de WhatsApp Business API.</li>
                                                <li>Cuando activemos WhatsApp Business API te pediremos un código SMS/llamada.</li>
                                                <li>Si prefieres número nuevo, te lo damos listo y sin cortes.</li>
                                            </ol>
                                        </div>
                                    )}
                                    {settings.channels?.whatsapp?.enabled && (
                                        <div className="grid grid-cols-1 gap-2 mt-2">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">API Token / Access Token</label>
                                                <div className="relative">
                                                    <input
                                                        type={showWAToken ? "text" : "password"}
                                                        value={settings.channels?.whatsapp?.api_token || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                whatsapp: { ...prev.channels?.whatsapp, api_token: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                        placeholder="EAAxxxx..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowWAToken(!showWAToken)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                    >
                                                        {showWAToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Token de acceso de WhatsApp Business API</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Business Account ID (WABA ID)</label>
                                                <input
                                                    type="text"
                                                    value={settings.channels?.whatsapp?.business_account_id || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            whatsapp: { ...prev.channels?.whatsapp, business_account_id: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                    placeholder="123456789012345"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">ID de tu cuenta de WhatsApp Business</p>
                                            </div>
                                            <div className="flex items-center gap-2 bg-green-50 p-3 rounded-lg">
                                                <input
                                                    id="wa-same-number"
                                                    type="checkbox"
                                                    checked={settings.channels?.whatsapp?.use_same_phone ?? true}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            whatsapp: { ...prev.channels?.whatsapp, use_same_phone: e.target.checked }
                                                        }
                                                    }))}
                                                    className="w-4 h-4 text-green-600 rounded focus:ring-green-500"
                                                />
                                                <label htmlFor="wa-same-number" className="text-sm font-medium text-gray-700">Usar el mismo número de llamadas</label>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Número de teléfono para WhatsApp</label>
                                                <input
                                                    type="text"
                                                    value={(settings.channels?.whatsapp?.use_same_phone ? settings.channels?.voice?.phone_number : settings.channels?.whatsapp?.phone_number) || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            whatsapp: { ...prev.channels?.whatsapp, phone_number: e.target.value }
                                                        }
                                                    }))}
                                                    disabled={settings.channels?.whatsapp?.use_same_phone}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                                                    placeholder="+34 600 000 000"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">Se usará el número configurado arriba automáticamente</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Instagram */}
                                <div className="bg-white p-2 rounded-lg border border-gray-200 hover:border-pink-300 transition-colors">
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex items-start gap-2 flex-1">
                                            <div className="w-7 h-7 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center flex-shrink-0">
                                                <Instagram className="w-4 h-4 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-xs text-gray-900">Instagram</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowHelpIG(v => !v)}
                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <HelpCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-[10px] text-gray-600 mt-0.5">Mensajes directos automáticos</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.channels?.instagram?.enabled || false}
                                            onChange={(enabled) => setSettings(prev => ({
                                                ...prev,
                                                channels: {
                                                    ...prev.channels,
                                                    instagram: { ...prev.channels?.instagram, enabled }
                                                }
                                            }))}
                                        />
                                    </div>
                                    {showHelpIG && (
                                        <div className="mb-4 p-3 rounded-lg bg-pink-50 border border-pink-200 text-sm text-gray-700">
                                            <p className="font-medium mb-1">¿Cómo conectarlo?</p>
                                            <ol className="list-decimal ml-5 space-y-1 text-xs">
                                                <li>Escribe tu @usuario o URL de Instagram.</li>
                                                <li>Proporciona el Access Token de Instagram Graph API.</li>
                                                <li>Déjanos un email para invitar a nuestro equipo como administrador.</li>
                                                <li>Nosotros hacemos el resto y activamos los mensajes automáticos.</li>
                                            </ol>
                                        </div>
                                    )}
                                    {settings.channels?.instagram?.enabled && (
                                        <div className="grid grid-cols-1 gap-3 mt-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Usuario o URL de Instagram</label>
                                                    <input
                                                        type="text"
                                                        value={settings.channels?.instagram?.handle || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                instagram: { ...prev.channels?.instagram, handle: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                                                        placeholder="@restaurante o https://instagram.com/restaurante"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Email para invitarnos como administradores</label>
                                                    <input
                                                        type="email"
                                                        value={settings.channels?.instagram?.invite_email || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                instagram: { ...prev.channels?.instagram, invite_email: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                                                        placeholder="ops@tu-empresa.com"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Access Token (Instagram Graph API)</label>
                                                <div className="relative">
                                                    <input
                                                        type={showIGToken ? "text" : "password"}
                                                        value={settings.channels?.instagram?.access_token || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                instagram: { ...prev.channels?.instagram, access_token: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                                                        placeholder="IGQVJxxxx..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowIGToken(!showIGToken)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                    >
                                                        {showIGToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Token de acceso de Instagram Graph API</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Instagram Business Account ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.channels?.instagram?.business_account_id || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            instagram: { ...prev.channels?.instagram, business_account_id: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-pink-500"
                                                    placeholder="17841xxxxxx"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">ID de tu cuenta de Instagram Business</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Facebook Messenger */}
                                <div className="bg-white p-5 rounded-xl border-2 border-gray-200 hover:border-blue-300 transition-colors shadow-sm">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Facebook className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-semibold text-gray-900">Facebook Messenger</h4>
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowHelpFB(v => !v)}
                                                        className="text-gray-400 hover:text-gray-600 transition-colors"
                                                    >
                                                        <HelpCircle className="w-4 h-4" />
                                                    </button>
                                                </div>
                                                <p className="text-sm text-gray-600 mt-0.5">Chat de página de Facebook</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.channels?.facebook?.enabled || false}
                                            onChange={(enabled) => setSettings(prev => ({
                                                ...prev,
                                                channels: {
                                                    ...prev.channels,
                                                    facebook: { ...prev.channels?.facebook, enabled }
                                                }
                                            }))}
                                        />
                                    </div>
                                    {showHelpFB && (
                                        <div className="mb-4 p-3 rounded-lg bg-blue-50 border border-blue-200 text-sm text-gray-700">
                                            <p className="font-medium mb-1">¿Cómo conectarlo?</p>
                                            <ol className="list-decimal ml-5 space-y-1 text-xs">
                                                <li>Pega la URL de tu página de Facebook.</li>
                                                <li>Proporciona el Page Access Token de Facebook.</li>
                                                <li>Déjanos un email para invitar a nuestro equipo como administrador.</li>
                                                <li>Activamos el chat y empezamos a recibir mensajes.</li>
                                            </ol>
                                        </div>
                                    )}
                                    {settings.channels?.facebook?.enabled && (
                                        <div className="grid grid-cols-1 gap-3 mt-3">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">URL de la página</label>
                                                    <input
                                                        type="url"
                                                        value={settings.channels?.facebook?.page_url || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                facebook: { ...prev.channels?.facebook, page_url: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                                                        placeholder="https://facebook.com/tu-pagina"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-medium text-gray-700 mb-1">Email para añadirnos como administradores</label>
                                                    <input
                                                        type="email"
                                                        value={settings.channels?.facebook?.invite_email || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                facebook: { ...prev.channels?.facebook, invite_email: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                                                        placeholder="ops@tu-empresa.com"
                                                    />
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Page Access Token</label>
                                                <div className="relative">
                                                    <input
                                                        type={showFBToken ? "text" : "password"}
                                                        value={settings.channels?.facebook?.page_access_token || ""}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                                facebook: { ...prev.channels?.facebook, page_access_token: e.target.value }
                                                            }
                                                        }))}
                                                        className="w-full px-4 py-2.5 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                                                        placeholder="EAAxxxx..."
                                                    />
                                                    <button
                                                        type="button"
                                                        onClick={() => setShowFBToken(!showFBToken)}
                                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                                    >
                                                        {showFBToken ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                                    </button>
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Token de acceso de tu página de Facebook</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Page ID</label>
                                                <input
                                                    type="text"
                                                    value={settings.channels?.facebook?.page_id || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            facebook: { ...prev.channels?.facebook, page_id: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                                                    placeholder="123456789012345"
                                                />
                                                <p className="text-xs text-gray-500 mt-1">ID de tu página de Facebook</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Web Chat */}
                                <div className="bg-white p-5 rounded-xl border-2 border-gray-200 hover:border-gray-300 transition-colors shadow-sm">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex items-start gap-3 flex-1">
                                            <div className="w-10 h-10 bg-gradient-to-br from-gray-600 to-gray-700 rounded-xl flex items-center justify-center flex-shrink-0">
                                                <Globe className="w-5 h-5 text-white" />
                                            </div>
                                            <div className="flex-1">
                                                <h4 className="font-semibold text-gray-900">Web Chat</h4>
                                                <p className="text-sm text-gray-600 mt-0.5">Chat integrado en la web</p>
                                            </div>
                                        </div>
                                        <ToggleSwitch
                                            enabled={settings.channels?.webchat?.enabled !== false}
                                            onChange={(enabled) => setSettings(prev => ({
                                                ...prev,
                                                channels: {
                                                    ...prev.channels,
                                                    webchat: { ...prev.channels?.webchat, enabled }
                                                }
                                            }))}
                                        />
                                    </div>
                                    {settings.channels?.webchat?.enabled !== false && (
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Dominio del sitio</label>
                                                <input
                                                    type="text"
                                                    value={settings.channels?.webchat?.site_domain || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            webchat: { ...prev.channels?.webchat, site_domain: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                                    placeholder="restaurante.com"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Widget Key (opcional)</label>
                                                <input
                                                    type="text"
                                                    value={settings.channels?.webchat?.widget_key || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            webchat: { ...prev.channels?.webchat, widget_key: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-500 focus:border-gray-500"
                                                    placeholder="Opcional"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                                <button
                                    onClick={() => handleSave("Canales de comunicación")}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {saving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Guardar Canales
                                </button>
                            </div>
                        </SettingSection>
                    )}

                    {activeTab === "notifications" && (
                        <SettingSection
                            title="Sistema de Notificaciones"
                            description="Configuración completa de alertas y notificaciones automáticas"
                            icon={<Bell />}
                        >
                            <div className="space-y-2">
                                <div className="bg-blue-50 p-2 rounded-lg border border-blue-200">
                                    <h4 className="font-semibold text-xs text-gray-900 mb-2 flex items-center gap-1.5">
                                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                        Notificaciones de Reservas
                                    </h4>
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="font-medium text-xs text-gray-900">Nueva reserva confirmada</h5>
                                                <p className="text-[10px] text-gray-600">Notificar cuando se confirme una nueva reserva</p>
                                            </div>
                                            <ToggleSwitch
                                                enabled={settings.notifications?.new_reservation ?? false}
                                                onChange={(enabled) => setSettings(prev => ({
                                                    ...prev,
                                                    notifications: {
                                                        ...prev.notifications,
                                                        new_reservation: enabled
                                                    }
                                                }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="font-medium text-xs text-gray-900">Reserva cancelada</h5>
                                                <p className="text-[10px] text-gray-600">Alerta cuando se cancele una reserva</p>
                                            </div>
                                            <ToggleSwitch
                                                enabled={settings.notifications?.cancelled_reservation ?? false}
                                                onChange={(enabled) => setSettings(prev => ({
                                                    ...prev,
                                                    notifications: {
                                                        ...prev.notifications,
                                                        cancelled_reservation: enabled
                                                    }
                                                }))}
                                            />
                                        </div>
                                        {/* Destinatarios y horario silencioso */}
                                        <div className="space-y-2 pt-1">
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">📧 Emails para notificaciones de reservas</label>
                                                <input
                                                    type="text"
                                                    value={(settings.notifications?.reservation_emails || []).join(", ")}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        notifications: {
                                                            ...prev.notifications,
                                                            reservation_emails: e.target.value.split(',').map(x => x.trim()).filter(Boolean)
                                                        }
                                                    }))}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                    placeholder="reservas@restaurante.com, gerente@restaurante.com"
                                                />
                                                <p className="text-[10px] text-gray-500 mt-0.5">Para nueva reserva, cancelada y modificada</p>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Horario silencioso (inicio)</label>
                                                <input
                                                    type="time"
                                                    value={settings.notifications?.quiet_hours?.start || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        notifications: {
                                                            ...prev.notifications,
                                                            quiet_hours: { ...prev.notifications?.quiet_hours, start: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-gray-700 mb-1">Horario silencioso (fin)</label>
                                                <input
                                                    type="time"
                                                    value={settings.notifications?.quiet_hours?.end || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        notifications: {
                                                            ...prev.notifications,
                                                            quiet_hours: { ...prev.notifications?.quiet_hours, end: e.target.value }
                                                        }
                                                    }))}
                                                    className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                />
                                            </div>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="font-medium text-xs text-gray-900">Reserva modificada</h5>
                                                <p className="text-[10px] text-gray-600">Cambios de hora, mesa o comensales</p>
                                            </div>
                                            <ToggleSwitch
                                                enabled={settings.notifications?.reservation_modified ?? false}
                                                onChange={(enabled) => setSettings(prev => ({
                                                    ...prev,
                                                    notifications: {
                                                        ...prev.notifications,
                                                        reservation_modified: enabled
                                                    }
                                                }))}
                                            />
                                        </div>
                                    </div>
                                </div>


                                <div className="bg-green-50 p-2 rounded-lg border border-green-200">
                                    <h4 className="font-semibold text-xs text-gray-900 mb-2 flex items-center gap-1.5">
                                        <AlertCircle className="w-3.5 h-3.5 text-green-600" />
                                        Notificaciones del Sistema
                                    </h4>
                                    <div className="space-y-2">
                                        {/* Emails para notificaciones del sistema */}
                                        <div>
                                            <label className="block text-xs font-medium text-gray-700 mb-1">⚙️ Emails para notificaciones del sistema</label>
                                            <input
                                                type="text"
                                                value={(settings.notifications?.system_emails || []).join(", ")}
                                                onChange={(e) => setSettings(prev => ({
                                                    ...prev,
                                                    notifications: {
                                                        ...prev.notifications,
                                                        system_emails: e.target.value.split(',').map(x => x.trim()).filter(Boolean)
                                                    }
                                                }))}
                                                className="w-full px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
                                                placeholder="admin@restaurante.com, soporte@restaurante.com"
                                            />
                                            <p className="text-[10px] text-gray-500 mt-0.5">Para errores del sistema, agente offline e integraciones</p>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="font-medium text-xs text-gray-900">Agente IA desconectado</h5>
                                                <p className="text-[10px] text-gray-600">Alerta si el agente IA deja de funcionar</p>
                                            </div>
                                            <ToggleSwitch
                                                enabled={settings.notifications?.agent_offline ?? false}
                                                onChange={(enabled) => setSettings(prev => ({
                                                    ...prev,
                                                    notifications: {
                                                        ...prev.notifications,
                                                        agent_offline: enabled
                                                    }
                                                }))}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <h5 className="font-medium text-xs text-gray-900">Errores de integración</h5>
                                                <p className="text-[10px] text-gray-600">Notificar errores en canales o integraciones</p>
                                            </div>
                                            <ToggleSwitch
                                                enabled={settings.notifications?.integration_errors ?? false}
                                                onChange={(enabled) => setSettings(prev => ({
                                                    ...prev,
                                                    notifications: {
                                                        ...prev.notifications,
                                                        integration_errors: enabled
                                                    }
                                                }))}
                                            />
                                        </div>
                                        
                                        {/* Nueva sección: Errores del Sistema */}
                                        <div className="border-t border-green-200 pt-2 mt-2">
                                            <h5 className="font-semibold text-xs text-gray-900 mb-1 flex items-center gap-1.5">
                                                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
                                                Errores del Sistema
                                            </h5>
                                            <div className="space-y-2 ml-4">
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h6 className="font-medium text-xs text-gray-800">Fallo crítico al guardar</h6>
                                                        <p className="text-[10px] text-gray-600">Reservas, configuración o datos de cliente no se guardan</p>
                                                    </div>
                                                    <ToggleSwitch
                                                        enabled={settings.notifications?.system_save_errors ?? true}
                                                        onChange={(enabled) => setSettings(prev => ({
                                                            ...prev,
                                                            notifications: {
                                                                ...prev.notifications,
                                                                system_save_errors: enabled
                                                            }
                                                        }))}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h6 className="font-medium text-xs text-gray-800">Problema de conexión</h6>
                                                        <p className="text-[10px] text-gray-600">Fallos de red, autenticación o timeouts</p>
                                                    </div>
                                                    <ToggleSwitch
                                                        enabled={settings.notifications?.system_connection_errors ?? true}
                                                        onChange={(enabled) => setSettings(prev => ({
                                                            ...prev,
                                                            notifications: {
                                                                ...prev.notifications,
                                                                system_connection_errors: enabled
                                                            }
                                                        }))}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h6 className="font-medium text-xs text-gray-800">Conflicto de reservas</h6>
                                                        <p className="text-[10px] text-gray-600">Mesa doble-asignada u horarios solapados</p>
                                                    </div>
                                                    <ToggleSwitch
                                                        enabled={settings.notifications?.system_reservation_conflicts ?? true}
                                                        onChange={(enabled) => setSettings(prev => ({
                                                            ...prev,
                                                            notifications: {
                                                                ...prev.notifications,
                                                                system_reservation_conflicts: enabled
                                                            }
                                                        }))}
                                                    />
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div>
                                                        <h6 className="font-medium text-gray-800">Configuración incompleta</h6>
                                                        <p className="text-xs text-gray-600">Sin mesas, horarios o setup básico</p>
                                                    </div>
                                                    <ToggleSwitch
                                                        enabled={settings.notifications?.system_config_incomplete ?? true}
                                                        onChange={(enabled) => setSettings(prev => ({
                                                            ...prev,
                                                            notifications: {
                                                                ...prev.notifications,
                                                                system_config_incomplete: enabled
                                                            }
                                                        }))}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="flex justify-end mt-6 pt-6 border-t border-gray-200">
                                <button
                                    onClick={() => handleSave("Configuración de notificaciones")}
                                    disabled={saving}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                                >
                                    {saving ? (
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Save className="w-4 h-4" />
                                    )}
                                    Guardar Notificaciones
                                </button>
                            </div>
                        </SettingSection>
                    )}

                    {activeTab === "documentos" && (
                        <div className="space-y-2">
                            {/* Info destacada */}
                            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-xl p-6 shadow-sm">
                                <div className="flex gap-2">
                                    <div className="flex-shrink-0">
                                        <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center">
                                            <AlertCircle className="w-7 h-7 text-white" />
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                            📚 Base de Conocimiento del Restaurante
                                        </h3>
                                        <p className="text-base text-gray-700 mb-3">
                                            Sube documentos (menú, políticas, información) para que tu <strong>Agente IA</strong> pueda 
                                            responder preguntas automáticamente.
                                        </p>
                                        <div className="bg-white rounded-lg p-4 border border-blue-200">
                                            <p className="text-sm font-semibold text-gray-900 mb-2">🚀 ¿Cómo funciona?</p>
                                            <ul className="space-y-1.5 text-sm text-gray-700">
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                                    <span><strong>1. Sube tus documentos</strong> (PDF, TXT, Excel, Google Docs/Sheets) en las categorías correspondientes</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                                    <span><strong>2. Procesamiento automático</strong> (1-2 minutos) - El sistema leerá y analizará el contenido</span>
                                                </li>
                                                <li className="flex items-start gap-2">
                                                    <span className="text-green-600 font-bold mt-0.5">✓</span>
                                                    <span><strong>3. ¡Listo!</strong> El Agente IA podrá responder preguntas sobre: menú, precios, servicios, horarios, etc.</span>
                                                </li>
                                            </ul>
                                        </div>
                                        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                                            <span className="font-medium">📋 Formatos aceptados:</span>
                                            <span className="px-2 py-1 bg-white rounded text-xs font-mono border">PDF</span>
                                            <span className="px-2 py-1 bg-white rounded text-xs font-mono border">TXT</span>
                                            <span className="px-2 py-1 bg-white rounded text-xs font-mono border">XLSX</span>
                                            <span className="px-2 py-1 bg-white rounded text-xs font-mono border">XLS</span>
                                            <span className="px-2 py-1 bg-white rounded text-xs font-mono border">Google Docs</span>
                                            <span className="px-2 py-1 bg-white rounded text-xs font-mono border">Google Sheets</span>
                                            <span className="text-gray-500">• Máximo 5MB por archivo</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* <BaseConocimientoContent /> */}
                            {/* TEMPORALMENTE DESHABILITADO - Base de Conocimiento */}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Configuracion;



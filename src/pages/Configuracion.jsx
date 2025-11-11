import React, { useState, useEffect } from "react";
import { useAuthContext } from "../contexts/AuthContext";
import { supabase } from "../lib/supabase";
import { useSearchParams, useLocation, useNavigate } from "react-router-dom";
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
    Zap,
    Play,
    Tag,
    Pause,
    Volume2,
    CheckCircle2,
    Briefcase
} from "lucide-react";
import toast from "react-hot-toast";
import { useVertical } from "../hooks/useVertical";
// import BaseConocimientoContent from "../components/BaseConocimientoContent"; // TEMPORALMENTE DESHABILITADO
import IntegracionesContent from "../components/configuracion/IntegracionesContent"; // 🆕 Integraciones
import RecursosContent from "../components/configuracion/RecursosContent"; // 🆕 Recursos

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
            <div className="border-b border-gray-100 p-4">
                <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg">
                            {React.cloneElement(icon, { className: "w-5 h-5 text-white" })}
                        </div>
                        <div>
                            <h3 className="text-base font-bold text-gray-900">
                                {title}
                            </h3>
                            <p className="text-sm text-gray-600 mt-0.5">{description}</p>
                        </div>
                    </div>
                </div>
            </div>
            <div className="p-4">
                {children}
            </div>
        </div>
    );
};

// 🎙️ 4 Voces disponibles (del onboarding)
const VOICE_OPTIONS = [
    {
        id: 'Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf',
        display_name: 'Femenina 1',
        description: 'Voz cálida y profesional',
        gender: 'female',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf.mp3.mp3'
    },
    {
        id: 'Female_2_Susi_v3V1d2rk6528UrLKRuy8',
        display_name: 'Femenina 2',
        description: 'Voz joven y dinámica',
        gender: 'female',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_2_Susi_v3V1d2rk6528UrLKRuy8.mp3.mp3'
    },
    {
        id: 'Male_1_Viraj_iWNf11sz1GrUE4ppxTOL',
        display_name: 'Masculina 1',
        description: 'Voz profesional y clara',
        gender: 'male',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_1_Viraj_iWNf11sz1GrUE4ppxTOL.mp3.mp3'
    },
    {
        id: 'Male_2_Danny_wnKyx1zkUEUnfURKiuaP',
        display_name: 'Masculina 2',
        description: 'Voz energética y cercana',
        gender: 'male',
        audio_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_2_Danny_wnKyx1zkUEUnfURKiuaP.mp3.mp3'
    }
];

const Configuracion = () => {
    const { businessId, business, user } = useAuthContext();
    const { labels } = useVertical(); // 🆕 Hook para vocabulario dinámico
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('asistente'); // 🆕 Por defecto "Mi Asistente"
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [currentPlayingVoice, setCurrentPlayingVoice] = useState(null);
    const [isPlayingAudio, setIsPlayingAudio] = useState(false);
    const audioRef = React.useRef(null);
    
    // 🆕 IDs válidos de las nuevas pestañas
    const validTabs = ['asistente', 'negocio', 'canales', 'integraciones', 'cuenta'];
    
    // Leer tab de la URL o del state al cargar
    useEffect(() => {
        // Prioridad 1: state de navegación (desde navigate con state)
        if (location.state?.activeTab && validTabs.includes(location.state.activeTab)) {
            setActiveTab(location.state.activeTab);
        }
        // Prioridad 2: parámetro de URL
        else {
            const tabFromUrl = searchParams.get('tab');
            if (tabFromUrl && validTabs.includes(tabFromUrl)) {
                setActiveTab(tabFromUrl);
            }
        }
        // 🔄 Mapeo de tabs antiguos a nuevos (compatibilidad)
        const legacyMapping = {
            'general': 'negocio',
            'agent': 'asistente',
            'channels': 'canales',
            'notifications': 'canales',
            'documentos': 'cuenta'
        };
        const legacyTab = location.state?.activeTab || searchParams.get('tab');
        if (legacyTab && legacyMapping[legacyTab]) {
            setActiveTab(legacyMapping[legacyTab]);
        }
        
        // 🆕 Toast informativo si viene desde /mesas (migración)
        if (location.state?.fromMesas) {
            toast.info('📌 La gestión de recursos se ha movido a "Mi Negocio"', {
                duration: 5000,
                position: 'top-center'
            });
        }
    }, [searchParams, location.state]);
    
    const [settings, setSettings] = useState({
        name: "",
        description: "",
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

    // 📋 Nueva estructura de configuración (Mobile-First)
    const tabs = [
        {
            id: "asistente",
            label: "Mi Asistente",
            icon: <Bot className="w-4 h-4" />,
            description: "Voz, nombre y configuración del agente IA"
        },
        {
            id: "negocio",
            label: "Mi Negocio",
            icon: <Building2 className="w-4 h-4" />,
            description: "Información, horarios y servicios"
        },
        {
            id: "recursos",
            label: `Mis ${labels?.resources || 'Recursos'}`,
            icon: <Briefcase className="w-4 h-4" />,
            description: `Gestiona tus ${labels?.resources?.toLowerCase() || 'recursos'} disponibles`
        },
        {
            id: "servicios",
            label: "Servicios",
            icon: <Tag className="w-4 h-4" />,
            description: "Servicios que ofreces, duraciones y precios",
            link: "/configuracion/servicios"
        },
        {
            id: "canales",
            label: "Canales y Alertas",
            icon: <MessageSquare className="w-4 h-4" />,
            description: "Teléfono, WhatsApp, redes sociales y alertas"
        },
        {
            id: "integraciones",
            label: "Integraciones",
            icon: <Zap className="w-4 h-4" />,
            description: "Google Calendar y otras integraciones"
        },
        {
            id: "cuenta",
            label: "Cuenta",
            icon: <Users className="w-4 h-4" />,
            description: "Plan, facturación y usuarios"
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

    // 🎙️ Función para reproducir audio de demostración de voz
    const handlePlayVoiceDemo = (voice) => {
        if (currentPlayingVoice === voice.id && isPlayingAudio) {
            // Si ya está reproduciéndose, pausar
            audioRef.current?.pause();
            setIsPlayingAudio(false);
            setCurrentPlayingVoice(null);
            return;
        }

        // Pausar audio anterior si existe
        if (audioRef.current) {
            audioRef.current.pause();
        }

        // Reproducir nuevo audio
        audioRef.current = new Audio(voice.audio_url);
        audioRef.current.play();
        setIsPlayingAudio(true);
        setCurrentPlayingVoice(voice.id);

        audioRef.current.onended = () => {
            setIsPlayingAudio(false);
            setCurrentPlayingVoice(null);
        };
    };

    // Limpiar audio al desmontar
    useEffect(() => {
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
        };
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
            {/* 📱 MOBILE-FIRST: Container adaptativo */}
            <div className="w-full max-w-7xl mx-auto px-3 sm:px-4 py-3 sm:py-4">
                {/* Header */}
                <div className="mb-4 p-4 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl shadow-lg text-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 backdrop-blur rounded-lg p-2.5">
                            <SettingsIcon className="w-6 h-6 text-white" />
                    </div>
                        <div>
                            <h1 className="text-lg sm:text-xl font-bold">Configuración</h1>
                            <p className="text-sm text-white/90 mt-0.5">
                                Centro de control de tu negocio
                    </p>
                        </div>
                    </div>
                </div>

                {/* 📱 Tabs MOBILE-FIRST - Scroll horizontal en móvil */}
                <div className="bg-white rounded-xl shadow-sm border p-1.5 mb-4">
                    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide pb-1">
                            {tabs.map((tab) => (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        if (tab.link) {
                                            navigate(tab.link);
                                        } else {
                                            setActiveTab(tab.id);
                                        }
                                    }}
                                className={`
                                    min-w-[140px] px-4 py-3 rounded-lg font-semibold text-sm whitespace-nowrap 
                                    flex flex-col items-center gap-1.5 transition-all
                                    ${activeTab === tab.id
                                        ? "bg-gradient-to-r from-blue-500 to-purple-600 text-white shadow-md"
                                        : "text-gray-600 hover:bg-gray-100"
                                    }
                                `}
                                >
                                    {tab.icon}
                                <span>{tab.label}</span>
                                </button>
                            ))}
                    </div>
                </div>

                <div className="space-y-4">
                    {/* 🏢 MI NEGOCIO */}
                    {activeTab === "negocio" && (
                        <div className="space-y-4">
                            <SettingSection
                                title="Información General"
                                description="Datos básicos de tu negocio"
                                icon={<Building2 />}
                            >
                                                <div className="space-y-2">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Nombre de tu negocio
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.name}
                                                onChange={(e) => setSettings(prev => ({ ...prev, name: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Nombre de tu negocio"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Email del negocio
                                            </label>
                                            <input
                                                type="email"
                                                value={settings.email}
                                                onChange={(e) => setSettings(prev => ({ ...prev, email: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="contacto@tunegocio.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Sitio web
                                            </label>
                                            <input
                                                type="url"
                                                value={settings.website}
                                                onChange={(e) => setSettings(prev => ({ ...prev, website: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="https://www.tunegocio.com"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Nombre del contacto
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.contact_name || ""}
                                                onChange={(e) => setSettings(prev => ({ ...prev, contact_name: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Tu nombre"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Teléfono personal de contacto (emergencias)
                                            </label>
                                            <input
                                                type="tel"
                                                value={settings.phone}
                                                onChange={(e) => setSettings(prev => ({ ...prev, phone: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-red-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                placeholder="+34 600 000 000"
                                            />
                                            <p className="text-xs text-red-600 mt-1 font-medium">
                                                ⚠️ Número del encargado para recibir alertas urgentes
                                            </p>
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Descripción del negocio
                                            </label>
                                            <textarea
                                                value={settings.description}
                                                onChange={(e) => setSettings(prev => ({ ...prev, description: e.target.value }))}
                                                rows="3"
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Describe tu negocio, servicios, especialidades..."
                                            />
                                        </div>

                                        <div className="col-span-2">
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Dirección completa
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.address}
                                                onChange={(e) => setSettings(prev => ({ ...prev, address: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Calle Mayor 123, Madrid"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Ciudad
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.city}
                                                onChange={(e) => setSettings(prev => ({ ...prev, city: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                placeholder="Madrid"
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                Código postal
                                            </label>
                                            <input
                                                type="text"
                                                value={settings.postal_code}
                                                onChange={(e) => setSettings(prev => ({ ...prev, postal_code: e.target.value }))}
                                                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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

                    {/* 🏗️ MIS RECURSOS - PESTAÑA INDEPENDIENTE */}
                    {activeTab === "recursos" && (
                        <div className="space-y-4">
                            <RecursosContent />
                        </div>
                    )}

                    {/* 🤖 MI ASISTENTE */}
                    {activeTab === "asistente" && (
                        <div className="space-y-4">
                            <SettingSection
                                title="Configuración de tu Asistente IA"
                                description="Personaliza el nombre, voz y comportamiento de tu agente"
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
                                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                        Nombre del Agente
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
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="Sofia, Carlos, Ana..."
                                                    />
                                                </div>

                                                {/* Puesto/Rol */}
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                                        Puesto / Rol
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
                                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                                        placeholder="Agente de Reservas"
                                                    />
                                                    <p className="text-xs text-gray-500 mt-1">
                                                        Ej: Agente de Reservas, Recepcionista Virtual, Asistente de Citas
                                                    </p>
                                                </div>

                                                {/* Selector de Voz con Preview (4 voces) */}
                                                <div>
                                                    <label className="block text-sm font-bold text-gray-900 mb-2">
                                                        Selección de Voz Telefónica
                                                    </label>
                                                    <p className="text-sm text-gray-600 mb-3">
                                                        Elige la voz que usará tu agente en las llamadas telefónicas
                                                    </p>
                                                    
                                                    {/* Voces Femeninas */}
                                                    <div className="mb-4">
                                                        <p className="text-sm text-gray-700 mb-2 font-semibold">👩 Voces Femeninas</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {VOICE_OPTIONS.filter(v => v.gender === 'female').map((voice) => {
                                                                const isSelected = settings.agent?.voice_id === voice.id;
                                                                const isCurrentlyPlaying = currentPlayingVoice === voice.id && isPlayingAudio;
                                                                
                                                                return (
                                                                    <div
                                                                        key={voice.id}
                                                            onClick={() => setSettings(prev => ({
                                                                ...prev,
                                                                agent: {
                                                                    ...prev.agent,
                                                                                voice_id: voice.id,
                                                                                gender: voice.gender
                                                                }
                                                            }))}
                                                                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                                                            isSelected
                                                                                ? 'border-purple-600 bg-purple-50 shadow-md'
                                                                                : 'border-gray-200 hover:border-purple-300 bg-white'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-sm font-semibold text-gray-900">
                                                                                        {voice.display_name}
                                                                                    </span>
                                                                                    {isSelected && (
                                                                                        <CheckCircle2 className="w-4 h-4 text-purple-600" />
                                                                                    )}
                                                                                </div>
                                                                                <p className="text-xs text-gray-600 mt-0.5">
                                                                                    {voice.description}
                                                                                </p>
                                                                            </div>
                                                        <button
                                                            type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePlayVoiceDemo(voice);
                                                                                }}
                                                                                className={`p-2 rounded-full transition-all ${
                                                                                    isCurrentlyPlaying
                                                                                        ? 'bg-purple-600 text-white'
                                                                                        : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                                                                                }`}
                                                                            >
                                                                                {isCurrentlyPlaying ? (
                                                                                    <Pause className="w-4 h-4" />
                                                                                ) : (
                                                                                    <Play className="w-4 h-4" />
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>

                                                    {/* Voces Masculinas */}
                                                    <div>
                                                        <p className="text-sm text-gray-700 mb-2 font-semibold">👨 Voces Masculinas</p>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {VOICE_OPTIONS.filter(v => v.gender === 'male').map((voice) => {
                                                                const isSelected = settings.agent?.voice_id === voice.id;
                                                                const isCurrentlyPlaying = currentPlayingVoice === voice.id && isPlayingAudio;
                                                                
                                                                return (
                                                                    <div
                                                                        key={voice.id}
                                                            onClick={() => setSettings(prev => ({
                                                                ...prev,
                                                                agent: {
                                                                    ...prev.agent,
                                                                                voice_id: voice.id,
                                                                                gender: voice.gender
                                                                }
                                                            }))}
                                                                        className={`p-3 border-2 rounded-lg cursor-pointer transition-all ${
                                                                            isSelected
                                                                                ? 'border-blue-600 bg-blue-50 shadow-md'
                                                                                : 'border-gray-200 hover:border-blue-300 bg-white'
                                                                        }`}
                                                                    >
                                                                        <div className="flex items-start justify-between mb-2">
                                                                            <div className="flex-1">
                                                                                <div className="flex items-center gap-2">
                                                                                    <span className="text-sm font-semibold text-gray-900">
                                                                                        {voice.display_name}
                                                                                    </span>
                                                                                    {isSelected && (
                                                                                        <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                                                                    )}
                                                    </div>
                                                                                <p className="text-xs text-gray-600 mt-0.5">
                                                                                    {voice.description}
                                                                                </p>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={(e) => {
                                                                                    e.stopPropagation();
                                                                                    handlePlayVoiceDemo(voice);
                                                                                }}
                                                                                className={`p-2 rounded-full transition-all ${
                                                                                    isCurrentlyPlaying
                                                                                        ? 'bg-blue-600 text-white'
                                                                                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                                                                                }`}
                                                                            >
                                                                                {isCurrentlyPlaying ? (
                                                                                    <Pause className="w-4 h-4" />
                                                                                ) : (
                                                                                    <Play className="w-4 h-4" />
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* ⚡ Estado ON/OFF del Agente - MUY VISIBLE */}
                                                <div className={`p-4 rounded-xl border-2 transition-all ${
                                                    settings.agent?.enabled 
                                                        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-lg shadow-green-100' 
                                                        : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-400 shadow-lg shadow-red-100'
                                                }`}>
                                                    <div className="flex items-center justify-between mb-3">
                                                        <div className="flex items-center gap-3">
                                                            <div className={`p-2 rounded-lg ${
                                                                settings.agent?.enabled 
                                                                    ? 'bg-green-500 text-white' 
                                                                    : 'bg-red-500 text-white'
                                                            }`}>
                                                                <Power className="w-5 h-5" />
                                                            </div>
                                                        <div>
                                                                <p className="font-bold text-gray-900 text-sm">
                                                                    {settings.agent?.enabled ? "🟢 Agente ACTIVO" : "🔴 Agente DESACTIVADO"}
                                                                </p>
                                                                <p className="text-xs text-gray-700 mt-0.5">
                                                                    {settings.agent?.enabled 
                                                                        ? "Atendiendo llamadas y mensajes 24/7" 
                                                                        : "No responderá a clientes"}
                                                            </p>
                                                        </div>
                                                        </div>
                                                        
                                                        {/* Toggle Switch GRANDE */}
                                                        <label className="relative inline-flex items-center cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={settings.agent?.enabled || false}
                                                                onChange={async (e) => {
                                                                    const newEnabled = e.target.checked;
                                                                    
                                                                    // Confirmación al DESACTIVAR
                                                                    if (!newEnabled) {
                                                                        const confirmed = window.confirm(
                                                                            '⚠️ ¿DESACTIVAR el agente IA?\n\n' +
                                                                            'El agente dejará de:\n' +
                                                                            '• Responder llamadas telefónicas\n' +
                                                                            '• Contestar mensajes de WhatsApp\n' +
                                                                            '• Gestionar reservas automáticamente\n\n' +
                                                                            'Las reservas manuales seguirán funcionando.'
                                                                        );
                                                                        if (!confirmed) return;
                                                                    }
                                                                    
                                                                    setSettings(prev => ({
                                                                        ...prev,
                                                                        agent: {
                                                                            ...prev.agent,
                                                                            enabled: newEnabled
                                                                        }
                                                                    }));
                                                                    
                                                                    toast.success(newEnabled 
                                                                        ? '✅ Agente ACTIVADO - Ahora atenderá a clientes' 
                                                                        : '❌ Agente DESACTIVADO - No responderá a clientes'
                                                                    );
                                                                }}
                                                                className="sr-only peer"
                                                            />
                                                            <div className="w-20 h-10 bg-red-400 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-10 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-9 after:w-9 after:transition-all peer-checked:bg-green-500 shadow-lg"></div>
                                                        </label>
                                    </div>

                                                    {/* Explicación adicional */}
                                                    <div className={`mt-3 p-3 rounded-lg ${
                                                        settings.agent?.enabled 
                                                            ? 'bg-green-100 border border-green-300' 
                                                            : 'bg-red-100 border border-red-300'
                                                    }`}>
                                                        <p className="text-xs font-semibold mb-1 flex items-center gap-2">
                                                            {settings.agent?.enabled ? (
                                                                <>
                                                                    <Power className="w-4 h-4 text-green-700" />
                                                                    <span className="text-green-900">¿Qué hace el agente cuando está ACTIVO?</span>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <Power className="w-4 h-4 text-red-700" />
                                                                    <span className="text-red-900">¿Qué pasa cuando está DESACTIVADO?</span>
                                                                </>
                                                            )}
                                                        </p>
                                                        <ul className={`text-xs space-y-1 ml-6 ${
                                                            settings.agent?.enabled ? 'text-green-800' : 'text-red-800'
                                                        }`}>
                                                            {settings.agent?.enabled ? (
                                                                <>
                                                                    <li>✅ Responde llamadas telefónicas automáticamente</li>
                                                                    <li>✅ Gestiona conversaciones de WhatsApp</li>
                                                                    <li>✅ Crea y confirma reservas sin intervención manual</li>
                                                                    <li>✅ Disponible 24/7 para tus clientes</li>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <li>❌ NO responderá llamadas (cliente escuchará tono de llamada)</li>
                                                                    <li>❌ NO contestará mensajes de WhatsApp</li>
                                                                    <li>❌ Reservas solo se pueden crear manualmente desde el dashboard</li>
                                                                    <li>⚠️ Tus clientes NO podrán reservar por teléfono o WhatsApp</li>
                                                                </>
                                                            )}
                                                        </ul>
                                                </div>
                                            </div>
                                        </div>
                                        </div>
                                    </div>



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

                    {/* 📡 CANALES Y ALERTAS - NUEVA PÁGINA MOBILE-FIRST */}
                    {activeTab === "canales" && (
                        <div className="space-y-4">
                            {/* 1️⃣ TU ASISTENTE LA-IA (Servicio que damos) */}
                        <SettingSection
                                title="Tu Asistente LA-IA"
                                description="Número de teléfono y WhatsApp asignado a tu negocio"
                                icon={<Phone />}
                            >
                                <div className="space-y-4">
                                    <p className="text-sm text-gray-700 bg-blue-50 border border-blue-200 rounded-lg p-3">
                                        💡 <strong>Este es tu número de LA-IA.</strong> Dáselo a tus clientes para que puedan llamar o escribir por WhatsApp.
                                    </p>

                                    {/* Llamadas de Voz */}
                                    <div className="flex items-center justify-between p-4 bg-white border-2 border-blue-200 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-blue-100 rounded-lg">
                                                <Phone className="w-5 h-5 text-blue-600" />
                                        </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">Llamadas de Voz</p>
                                                <p className="text-lg font-mono font-bold text-blue-600">
                                                    {business?.assigned_phone || '+34 9XX XXX XXX'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">Asignado por LA-IA</p>
                                        </div>
                                    </div>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-semibold text-green-700 bg-green-100 px-3 py-1.5 rounded-full">
                                                ✅ ACTIVO
                                            </span>
                                </div>
                                </div>

                                    {/* WhatsApp Business */}
                                    <div className="flex items-center justify-between p-4 bg-white border-2 border-green-200 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2.5 bg-green-100 rounded-lg">
                                                <MessageSquare className="w-5 h-5 text-green-600" />
                                            </div>
                                            <div>
                                                <p className="font-semibold text-gray-900">WhatsApp Business</p>
                                                <p className="text-lg font-mono font-bold text-green-600">
                                                    {business?.assigned_phone || '+34 9XX XXX XXX'}
                                                </p>
                                                <p className="text-xs text-gray-500 mt-0.5">Mismo número que voz</p>
                                                </div>
                                            </div>
                                        <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                checked={settings.channels?.whatsapp?.enabled !== false}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                        whatsapp: {
                                                            ...prev.channels?.whatsapp,
                                                            enabled: e.target.checked
                                                        }
                                                        }
                                                    }))}
                                                className="sr-only peer"
                                                />
                                            <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-green-300 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500"></div>
                                        </label>
                                            </div>
                                </div>
                            </SettingSection>

                            {/* 2️⃣ TUS ALERTAS PERSONALES */}
                            <SettingSection
                                title="Tus Alertas Personales"
                                description="Dónde te avisamos a TI cuando hay problemas urgentes"
                                icon={<Bell />}
                            >
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-700 bg-orange-50 border border-orange-200 rounded-lg p-3">
                                        ⚠️ <strong>Tu WhatsApp personal.</strong> Te enviaremos alertas urgentes aquí (quejas, errores del sistema, etc.)
                                    </p>

                                            <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                                            Tu móvil para alertas (WhatsApp)
                                        </label>
                                        <div className="flex gap-2">
                                            <div className="flex-1 relative">
                                                <MessageSquare className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-500 w-5 h-5" />
                                                <input
                                                    type="tel"
                                                    value={settings.channels?.whatsapp?.emergency_phone || business?.alert_whatsapp || ""}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            whatsapp: {
                                                                ...prev.channels?.whatsapp,
                                                                emergency_phone: e.target.value
                                                            }
                                                        }
                                                    }))}
                                                    className="w-full pl-11 pr-3 py-3 text-sm font-medium border-2 border-orange-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                                    placeholder="+34 6XX XXX XXX"
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-600 mt-1.5">
                                            Este es TU número personal. Solo para alertas importantes.
                                        </p>
                                </div>
                                            </div>
                            </SettingSection>

                            {/* 3️⃣ CANALES ADICIONALES (Centro de Mando Mobile-First) */}
                            <SettingSection
                                title="Canales Adicionales"
                                description="Conecta redes sociales y chat web para que LA-IA gestione todas tus conversaciones"
                                icon={<Globe />}
                            >
                                <div className="space-y-3">
                                    <p className="text-sm text-gray-700 bg-purple-50 border border-purple-200 rounded-lg p-3">
                                        🌐 <strong>Centro de Mando.</strong> Activa los canales que quieras y LA-IA gestionará las conversaciones automáticamente.
                                    </p>

                                    {/* Instagram DM */}
                                    <div className={`p-4 rounded-xl border-2 transition-all ${
                                        settings.channels?.instagram?.enabled 
                                            ? 'border-pink-400 bg-pink-50' 
                                            : 'border-gray-200 bg-white'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg">
                                                    <Instagram className="w-5 h-5 text-white" />
                                                </div>
                                            <div>
                                                    <p className="font-semibold text-gray-900">Instagram DM</p>
                                                    <p className="text-xs text-gray-600">Mensajes directos automáticos</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.channels?.instagram?.enabled || false}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            instagram: {
                                                                ...prev.channels?.instagram,
                                                                enabled: e.target.checked
                                                            }
                                                        }
                                                    }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-pink-300 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-pink-500"></div>
                                            </label>
                                </div>

                                        {/* Campos que aparecen al activar */}
                                        {settings.channels?.instagram?.enabled && (
                                            <div className="mt-3 space-y-3 pt-3 border-t border-pink-200">
                                                {!settings.channels?.instagram?.connected && (
                                                    <div className="bg-pink-100 border border-pink-300 rounded-lg p-3">
                                                        <p className="text-sm text-pink-900 font-medium mb-2">
                                                            Se requiere conexión
                                                        </p>
                                                    <button
                                                        type="button"
                                                            onClick={() => {
                                                                toast.info('Próximamente: OAuth de Instagram');
                                                            }}
                                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-pink-500 to-pink-600 text-white rounded-lg hover:from-pink-600 hover:to-pink-700 font-semibold"
                                                        >
                                                            <Instagram className="w-4 h-4" />
                                                            Conectar con Instagram
                                                    </button>
                                        </div>
                                    )}
                                                {settings.channels?.instagram?.connected && (
                                                    <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                                                        <p className="text-sm text-green-900 font-medium mb-1">
                                                            ✅ Conectado como: <span className="font-bold">{settings.channels?.instagram?.handle || '@tunegocio'}</span>
                                                        </p>
                                                    <button
                                                        type="button"
                                                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                                                    >
                                                            Desconectar
                                                    </button>
                                                </div>
                                                )}
                                        </div>
                                    )}
                                </div>

                                {/* Facebook Messenger */}
                                    <div className={`p-4 rounded-xl border-2 transition-all ${
                                        settings.channels?.facebook?.enabled 
                                            ? 'border-blue-400 bg-blue-50' 
                                            : 'border-gray-200 bg-white'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg">
                                                <Facebook className="w-5 h-5 text-white" />
                                            </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">Facebook Messenger</p>
                                                    <p className="text-xs text-gray-600">Chat de tu página</p>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                    <input
                                                    type="checkbox"
                                                    checked={settings.channels?.facebook?.enabled || false}
                                                        onChange={(e) => setSettings(prev => ({
                                                            ...prev,
                                                            channels: {
                                                                ...prev.channels,
                                                            facebook: {
                                                                ...prev.channels?.facebook,
                                                                enabled: e.target.checked
                                                            }
                                                            }
                                                        }))}
                                                    className="sr-only peer"
                                                    />
                                                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
                                                </div>
                                        
                                        {settings.channels?.facebook?.enabled && (
                                            <div className="mt-3 space-y-3 pt-3 border-t border-blue-200">
                                                {!settings.channels?.facebook?.connected && (
                                                    <div className="bg-blue-100 border border-blue-300 rounded-lg p-3">
                                                        <p className="text-sm text-blue-900 font-medium mb-2">
                                                            Se requiere conexión
                                                        </p>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                toast.info('Próximamente: OAuth de Facebook');
                                                            }}
                                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 font-semibold"
                                                        >
                                                            <Facebook className="w-4 h-4" />
                                                            Conectar con Facebook
                                                        </button>
                                            </div>
                                                )}
                                                {settings.channels?.facebook?.connected && (
                                                    <div className="bg-green-50 border border-green-300 rounded-lg p-3">
                                                        <p className="text-sm text-green-900 font-medium mb-1">
                                                            ✅ Conectado: <span className="font-bold">{settings.channels?.facebook?.page_url || 'Tu Página'}</span>
                                                        </p>
                                                    <button
                                                        type="button"
                                                            className="text-sm text-red-600 hover:text-red-700 font-medium"
                                                    >
                                                            Desconectar
                                                    </button>
                                                </div>
                                                )}
                                        </div>
                                    )}
                                </div>

                                {/* Web Chat */}
                                    <div className={`p-4 rounded-xl border-2 transition-all ${
                                        settings.channels?.webchat?.enabled 
                                            ? 'border-gray-400 bg-gray-50' 
                                            : 'border-gray-200 bg-white'
                                    }`}>
                                        <div className="flex items-center justify-between mb-2">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-gradient-to-br from-gray-600 to-gray-700 rounded-lg">
                                                <Globe className="w-5 h-5 text-white" />
                                            </div>
                                                <div>
                                                    <p className="font-semibold text-gray-900">Chat en tu Web</p>
                                                    <p className="text-xs text-gray-600">Widget de chat integrado</p>
                                            </div>
                                        </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.channels?.webchat?.enabled || false}
                                                    onChange={(e) => setSettings(prev => ({
                                                        ...prev,
                                                        channels: {
                                                            ...prev.channels,
                                                            webchat: {
                                                                ...prev.channels?.webchat,
                                                                enabled: e.target.checked
                                                            }
                                                        }
                                                    }))}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-14 h-7 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-gray-300 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-gray-600"></div>
                                            </label>
                                            </div>
                                        
                                        {settings.channels?.webchat?.enabled && (
                                            <div className="mt-3 space-y-3 pt-3 border-t border-gray-200">
                                                <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                                                    <p className="text-sm text-gray-900 font-medium mb-2">
                                                        📋 Código del widget generado
                                                    </p>
                                                    <div className="bg-white p-2 rounded border border-gray-300 font-mono text-xs overflow-x-auto">
                                                        &lt;script src="https://la-ia.com/widget.js" data-key="{businessId || 'TU-KEY'}"&gt;&lt;/script&gt;
                                        </div>
                                                    <p className="text-xs text-gray-600 mt-2">
                                                        Copia este código en el &lt;head&gt; de tu sitio web
                                                    </p>
                                </div>
                                            </div>
                                        )}
                            </div>

                                    {/* Botón guardar */}
                                    <div className="flex justify-end pt-4 border-t border-gray-200">
                                <button
                                            onClick={() => handleSave("Canales y Alertas")}
                                    disabled={saving}
                                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 font-semibold shadow-lg"
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

                    {/* 🔗 INTEGRACIONES */}
                    {activeTab === "integraciones" && (
                        <IntegracionesContent 
                            settings={settings}
                            setSettings={setSettings}
                            saving={saving}
                            handleSave={handleSave}
                        />
                    )}

                    {/* 💳 CUENTA Y FACTURACIÓN */}
                    {activeTab === "cuenta" && (
                        <div className="space-y-4">
                            <SettingSection
                                title="Información de la Cuenta"
                                description="Gestiona tu plan, facturación y usuarios"
                                icon={<Users />}
                            >
                                <div className="text-center py-12">
                                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                        <h3 className="text-lg font-bold text-gray-900 mb-2">
                                        Gestión de Cuenta
                                        </h3>
                                    <p className="text-gray-600 mb-4">
                                        Información del plan, facturación y usuarios
                                    </p>
                                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 text-purple-800 rounded-lg font-medium">
                                        🚧 En desarrollo - Próximamente
                                        </div>
                                        </div>
                            </SettingSection>
                                    </div>
                    )}
                            
                </div>
            </div>
        </div>
    );
};

export default Configuracion;

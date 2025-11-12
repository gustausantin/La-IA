// ====================================
// DASHBOARD VIVO - CONVERSACIÓN REAL CON EL AGENTE
// Avatar gigante + métricas completas del negocio
// ====================================

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { format, startOfDay, subDays, differenceInMinutes, parseISO, startOfMonth } from 'date-fns';
import { es } from 'date-fns/locale';
import {
  CheckCircle2, Loader2, Phone, Shield, Send, Bot,
  DollarSign, Calendar, AlertTriangle, Clock, AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const { business, user } = useAuthContext();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [agentConfig, setAgentConfig] = useState(null);
  const [agentStatus, setAgentStatus] = useState('active');
  const [greeting, setGreeting] = useState('');
  const [businessMetrics, setBusinessMetrics] = useState(null);
  const [agentMetrics, setAgentMetrics] = useState(null);
  const [nextAppointment, setNextAppointment] = useState(null);
  const [activityFeed, setActivityFeed] = useState([]);
  const [copilotProgress, setCopilotProgress] = useState(null);
  const [teamInfo, setTeamInfo] = useState(null);

  const [userMessage, setUserMessage] = useState('');
  const [loadingResponse, setLoadingResponse] = useState(false);
  const [chatHistory, setChatHistory] = useState([]);

  const userName = business?.settings?.contact_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Usuario';
  const assistantName = agentConfig?.name || business?.settings?.agent?.name || business?.assistant_name || 'Tu asistente';

  useEffect(() => {
    if (business?.id) {
      loadDashboardData();
      
      // ✅ POLLING: Refrescar cada 10 segundos para sincronizar con Configuración
      const interval = setInterval(() => {
        loadAgentConfig();
      }, 10000);
      
      return () => clearInterval(interval);
    }
  }, [business?.id]);

  useEffect(() => {
    // ✅ FRASES CONTEXTUALES SEGÚN HORA DEL DÍA
    const hour = new Date().getHours();
    
    let greetings = [];
    
    if (hour >= 6 && hour < 12) {
      // MAÑANA (6:00 - 11:59)
      greetings = [
        '¡Buenos días, {name}! Te cuento cómo empezamos el día',
        '¡Hola, {name}! Aquí tienes el resumen de la mañana',
        '¡Hey, {name}! Mira lo más destacado de hoy',
        '¡Qué tal, {name}! Te pongo al día con tu negocio'
      ];
    } else if (hour >= 12 && hour < 20) {
      // TARDE (12:00 - 19:59)
      greetings = [
        '¡Buenas tardes, {name}! Te explico cómo va el día',
        '¡Hola, {name}! Aquí tienes lo más importante de hoy',
        '¡Hey, {name}! Te cuento cómo va tu negocio',
        '¿Qué tal, {name}? Mira el resumen de la jornada'
      ];
    } else {
      // NOCHE (20:00 - 5:59)
      greetings = [
        '¡Buenas noches, {name}! Aquí el resumen del día',
        '¡Hola, {name}! Te cuento cómo ha ido la jornada',
        '¡Hey, {name}! Mira lo más destacado de hoy',
        '¿Qué tal, {name}? Te pongo al día antes de cerrar'
      ];
    }
    
    const randomGreeting = greetings[Math.floor(Math.random() * greetings.length)];
    setGreeting(randomGreeting.replace('{name}', userName));
  }, [userName]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      await Promise.all([
        loadAgentConfig(),
        loadBusinessMetrics(),
        loadAgentMetrics(),
        loadNextAppointment(),
        loadActivityFeed(),
        loadCopilotProgress(),
        loadTeamInfo()
      ]);
    } catch (error) {
      console.error('Error cargando dashboard:', error);
      toast.error('Error al cargar datos');
    } finally {
      setLoading(false);
    }
  };

  const loadAgentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('businesses')
        .select('settings')
        .eq('id', business.id)
        .single();

      if (error) throw error;
      
      setAgentConfig(data?.settings?.agent || null);
      
      // ✅ USAR EL MISMO CAMPO QUE CONFIGURACIÓN
      const isEnabled = data?.settings?.agent?.enabled;
      setAgentStatus(isEnabled ? 'active' : 'paused');
    } catch (error) {
      console.error('Error cargando config del agente:', error);
      setAgentConfig(null);
      setAgentStatus('paused');
    }
  };

  const loadBusinessMetrics = async () => {
    try {
      const today = startOfDay(new Date());
      const todayStr = format(today, 'yyyy-MM-dd');

      // 1. Facturación - JOIN MANUAL
      const { data: todayAppointments } = await supabase
        .from('appointments')
        .select('service_id, status')
        .eq('business_id', business.id)
        .eq('appointment_date', todayStr)
        .in('status', ['confirmed', 'completed']);

      const { data: services } = await supabase
        .from('services')
        .select('id, price')
        .eq('business_id', business.id);

      const servicesMap = (services || []).reduce((map, s) => { map[s.id] = s; return map; }, {});
      const revenue = (todayAppointments || []).reduce((sum, apt) => sum + (servicesMap[apt.service_id]?.price || 0), 0);

      // 2. Huecos libres HOY
      const { data: availableSlots } = await supabase
        .from('availability_slots')
        .select('id')
        .eq('business_id', business.id)
        .eq('slot_date', todayStr)
        .eq('is_available', true);

      // 3. No-Shows en riesgo - Deshabilitado
      const highRiskCount = 0;

      setBusinessMetrics({
        revenue: revenue,
        freeSlots: availableSlots?.length || 0,
        riskNoShows: highRiskCount
      });
    } catch (error) {
      console.error('Error cargando métricas del negocio:', error);
      setBusinessMetrics({ revenue: 0, freeSlots: 0, riskNoShows: 0 });
    }
  };

  const loadAgentMetrics = async () => {
    try {
      const yesterday = subDays(new Date(), 1);

      const { data: appointments } = await supabase
        .from('appointments')
        .select('id')
        .eq('business_id', business.id)
        .gte('created_at', yesterday.toISOString())
        .eq('source', 'agent_whatsapp');

      const { data: conversations } = await supabase
        .from('agent_conversations')
        .select('interaction_type, source_channel, sentiment, metadata')
        .eq('business_id', business.id)
        .gte('created_at', yesterday.toISOString());

      const spamCount = (conversations || []).filter(c => 
        c.interaction_type?.startsWith('noise_') || c.interaction_type === 'spam'
      ).length;

      const complaintsCount = (conversations || []).filter(c => 
        c.interaction_type === 'complaint' || 
        c.sentiment === 'negative' ||
        c.metadata?.escalation_needed === true
      ).length;

      const callsCount = (conversations || []).filter(c => 
        c.source_channel === 'voice'
      ).length;

      setAgentMetrics({
        reservations: appointments?.length || 0,
        complaints: complaintsCount,
        spam: spamCount,
        calls: callsCount
      });
    } catch (error) {
      console.error('Error cargando métricas del agente:', error);
      setAgentMetrics({ reservations: 0, complaints: 0, spam: 0, calls: 0 });
    }
  };

  const loadNextAppointment = async () => {
    try {
      const now = new Date();
      const todayStr = format(now, 'yyyy-MM-dd');
      const nowTime = format(now, 'HH:mm:ss');

      const { data } = await supabase
        .from('appointments')
        .select('*')
        .eq('business_id', business.id)
        .eq('appointment_date', todayStr)
        .gte('appointment_time', nowTime)
        .eq('status', 'confirmed')
        .order('appointment_time', { ascending: true })
        .limit(1);

      setNextAppointment(data?.[0] || null);
    } catch (error) {
      console.error('Error cargando próxima cita:', error);
      setNextAppointment(null);
    }
  };

  const loadActivityFeed = async () => {
    try {
      const yesterday = subDays(new Date(), 1);

      const { data } = await supabase
        .from('agent_conversations')
        .select('id, customer_name, customer_phone, interaction_type, created_at')
        .eq('business_id', business.id)
        .gte('created_at', yesterday.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);

      setActivityFeed(data || []);
    } catch (error) {
      console.error('Error cargando feed:', error);
      setActivityFeed([]);
    }
  };

  const loadCopilotProgress = async () => {
    try {
      const { data } = await supabase
        .from('businesses')
        .select('onboarding_completed')
        .eq('id', business.id)
        .single();

      const { data: services } = await supabase
        .from('business_services')
        .select('id')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .limit(1);

      const { data: resources } = await supabase
        .from('resources')
        .select('id')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .limit(1);

      const pending = [];
      if (!data?.onboarding_completed) pending.push({ id: 'onboarding', label: 'Completa tu configuración', url: '/onboarding' });
      if (!services || services.length === 0) pending.push({ id: 'services', label: 'Añade tus servicios', url: '/configuracion?tab=servicios' });
      if (!resources || resources.length === 0) pending.push({ id: 'resources', label: 'Configura tus recursos', url: '/configuracion?tab=recursos' });

      const total = 3;
      const completedCount = total - pending.length;

      setCopilotProgress({
        completed: completedCount,
        total: total,
        percentage: Math.round((completedCount / total) * 100),
        nextStep: pending[0] || null
      });
    } catch (error) {
      console.error('Error cargando progreso:', error);
      setCopilotProgress(null);
    }
  };

  const loadTeamInfo = async () => {
    try {
      const today = new Date();
      const todayStr = format(today, 'yyyy-MM-dd');
      const nextWeek = format(subDays(today, -7), 'yyyy-MM-dd');

      // 1. Ausencias HOY - SIN JOIN automático (hay 2 FK a employees)
      const { data: todayAbsences } = await supabase
        .from('employee_absences')
        .select('employee_id, reason, reason_label, all_day, start_time, end_time, start_date, end_date')
        .eq('business_id', business.id)
        .lte('start_date', todayStr)
        .gte('end_date', todayStr)
        .order('start_time', { ascending: true });

      // 2. Ausencias próximas (próximos 7 días)
      const { data: upcomingAbsences } = await supabase
        .from('employee_absences')
        .select('employee_id, reason, reason_label, start_date, end_date, all_day, start_time, end_time')
        .eq('business_id', business.id)
        .gt('start_date', todayStr)
        .lte('start_date', nextWeek)
        .order('start_date', { ascending: true });

      // 3. Empleados activos
      const { data: employees } = await supabase
        .from('employees')
        .select('id, name, is_active')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('name', { ascending: true });

      // 4. JOIN MANUAL
      const employeesMap = (employees || []).reduce((map, emp) => {
        map[emp.id] = emp;
        return map;
      }, {});

      const todayAbsencesWithNames = (todayAbsences || []).map(abs => ({
        ...abs,
        employee_name: employeesMap[abs.employee_id]?.name || 'Empleado'
      }));

      const upcomingAbsencesWithNames = (upcomingAbsences || []).map(abs => ({
        ...abs,
        employee_name: employeesMap[abs.employee_id]?.name || 'Empleado'
      }));

      setTeamInfo({
        todayAbsences: todayAbsencesWithNames,
        upcomingAbsences: upcomingAbsencesWithNames,
        employees: employees || []
      });
    } catch (error) {
      console.error('Error cargando info del equipo:', error);
      setTeamInfo({ todayAbsences: [], upcomingAbsences: [], employees: [] });
    }
  };

  const QUICK_QUESTIONS = [
    {
      id: 'revenue_yesterday',
      icon: '💰',
      label: 'Facturación ayer',
      query: async () => {
        const yesterday = subDays(startOfDay(new Date()), 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');

        const { data: appointments } = await supabase
          .from('appointments')
          .select('service_id')
          .eq('business_id', business.id)
          .eq('status', 'completed')
          .eq('appointment_date', yesterdayStr);

        const { data: services } = await supabase
          .from('services')
          .select('id, price')
          .eq('business_id', business.id);

        const servicesMap = (services || []).reduce((map, s) => { map[s.id] = s; return map; }, {});
        const total = (appointments || []).reduce((sum, apt) => sum + (servicesMap[apt.service_id]?.price || 0), 0);
        
        return total > 0 ? `Ayer facturaste **${total.toFixed(2)}€**` : `Ayer no hubo servicios completados.`;
      }
    },
    {
      id: 'revenue_month',
      icon: '📊',
      label: 'Facturación mes',
      query: async () => {
        const monthStart = startOfMonth(new Date());
        const monthStartStr = format(monthStart, 'yyyy-MM-dd');

        const { data: appointments } = await supabase
          .from('appointments')
          .select('service_id')
          .eq('business_id', business.id)
          .eq('status', 'completed')
          .gte('appointment_date', monthStartStr);

        const { data: services } = await supabase
          .from('services')
          .select('id, price')
          .eq('business_id', business.id);

        const servicesMap = (services || []).reduce((map, s) => { map[s.id] = s; return map; }, {});
        const total = (appointments || []).reduce((sum, apt) => sum + (servicesMap[apt.service_id]?.price || 0), 0);
        
        return total > 0 ? `Este mes llevas **${total.toFixed(2)}€** facturados` : `Aún no has facturado nada este mes.`;
      }
    },
    {
      id: 'vip',
      icon: '👑',
      label: 'Clientes VIP',
      query: async () => {
        const { data } = await supabase
          .from('customers')
          .select('name, phone')
          .eq('business_id', business.id)
          .eq('segment_auto', 'vip')
          .limit(5);

        const list = (data || []).map(c => `• ${c.name || c.phone}`).join('\n');
        return data && data.length > 0 ? `Tienes **${data.length} VIP**:\n\n${list}` : `Aún no tienes clientes VIP.`;
      }
    },
    {
      id: 'at_risk',
      icon: '⚠️',
      label: 'En riesgo',
      query: async () => {
        const { data } = await supabase
          .from('customers')
          .select('name, phone')
          .eq('business_id', business.id)
          .eq('segment_auto', 'en_riesgo')
          .limit(5);

        return data && data.length > 0 ? `Hay **${data.length}** que hace tiempo que no vienen.` : `¡Todo bien! No hay clientes en riesgo.`;
      }
    },
    {
      id: 'team',
      icon: '👥',
      label: 'Tu equipo',
      query: async () => {
        const { data: employees } = await supabase
          .from('employees')
          .select('name')
          .eq('business_id', business.id)
          .eq('is_active', true)
          .order('name', { ascending: true });

        if (!employees || employees.length === 0) {
          return `No tienes empleados registrados.`;
        }

        const list = employees.map(e => `• ${e.name}`).join('\n');
        return `Tu equipo (${employees.length} persona${employees.length > 1 ? 's' : ''}):\n\n${list}`;
      }
    },
    {
      id: 'today_appointments',
      icon: '📅',
      label: 'Citas de hoy',
      query: async () => {
        const today = format(new Date(), 'yyyy-MM-dd');

        const { data } = await supabase
          .from('appointments')
          .select('appointment_time, customer_name')
          .eq('business_id', business.id)
          .eq('appointment_date', today)
          .in('status', ['confirmed', 'completed'])
          .order('appointment_time', { ascending: true });

        if (!data || data.length === 0) {
          return `No hay citas confirmadas para hoy.`;
        }

        const list = data.slice(0, 5).map(a => 
          `• ${a.appointment_time.substring(0, 5)} - ${a.customer_name}`
        ).join('\n');

        return `Hoy tienes **${data.length} cita${data.length > 1 ? 's' : ''}**:\n\n${list}${data.length > 5 ? `\n\n...y ${data.length - 5} más.` : ''}`;
      }
    }
  ];

  const handleQuickQuestion = async (question) => {
    setChatHistory(prev => [...prev, {
      type: 'user',
      message: question.label,
      timestamp: new Date()
    }]);

    setLoadingResponse(true);

    try {
      const response = await question.query();
      setChatHistory(prev => [...prev, {
        type: 'agent',
        message: response,
        timestamp: new Date()
      }]);
    } catch (error) {
      console.error('Error:', error);
      setChatHistory(prev => [...prev, {
        type: 'agent',
        message: 'No pude obtener esa información.',
        timestamp: new Date()
      }]);
    } finally {
      setLoadingResponse(false);
    }
  };

  const handleSendMessage = () => {
    if (!userMessage.trim()) return;

    setChatHistory(prev => [...prev, {
      type: 'user',
      message: userMessage,
      timestamp: new Date()
    }]);

    setUserMessage('');

    setChatHistory(prev => [...prev, {
      type: 'agent',
      message: 'Pronto podré responder cualquier cosa. Por ahora usa los botones 😊',
      timestamp: new Date()
    }]);
  };

  const humanizeActivity = (activity) => {
    const time = format(new Date(activity.created_at), 'HH:mm');
    const name = activity.customer_name || 'Cliente';

    const typeMap = {
      'booking_request': `✅ Reserva confirmada (${name})`,
      'noise_spam': `🛡️ Spam bloqueado`,
      'complaint': `⚠️ Queja de ${name}`,
      'other': `💬 Conversación con ${name}`
    };

    return { time, text: typeMap[activity.interaction_type] || `💬 ${name}` };
  };

  const getTeamMessage = () => {
    if (!teamInfo) return null;

    const todayItems = [];
    const upcomingItems = [];

    // 1. Ausencias HOY
    if (teamInfo.todayAbsences && teamInfo.todayAbsences.length > 0) {
      teamInfo.todayAbsences.forEach(absence => {
        const name = absence.employee_name;
        const reasonMap = {
          'medical': { emoji: '🤒', text: 'Cita médica' },
          'sick': { emoji: '🤒', text: 'Baja médica' },
          'vacation': { emoji: '🏖️', text: 'Vacaciones' },
          'personal': { emoji: '📋', text: 'Ausencia personal' },
          'other': { emoji: '📋', text: 'No disponible' }
        };
        const reason = reasonMap[absence.reason] || { emoji: '📋', text: absence.reason_label || 'Ausencia' };
        
        let description = reason.text;
        
        if (!absence.all_day && absence.start_time && absence.end_time) {
          // Cita específica con horario
          const startTime = absence.start_time.substring(0, 5);
          const endTime = absence.end_time.substring(0, 5);
          description = `${reason.text} de ${startTime} a ${endTime}`;
        } else if (!absence.all_day && absence.start_time) {
          // Solo hora de inicio
          const startTime = absence.start_time.substring(0, 5);
          description = `${reason.text} a las ${startTime}`;
        } else if (absence.all_day) {
          // Todo el día
          if (absence.start_date !== absence.end_date) {
            // Vacaciones largas
            const endDate = format(parseISO(absence.end_date), "d 'de' MMMM", { locale: es });
            description = `${reason.text} (hoy, hasta el ${endDate})`;
          } else {
            // Solo hoy
            description = `${reason.text} (todo el día)`;
          }
        }
        
        todayItems.push({
          emoji: reason.emoji,
          name: name,
          text: description
        });
      });
    }

    // 2. Ausencias próximas (solo si no hay ausencias hoy)
    if (todayItems.length === 0 && teamInfo.upcomingAbsences && teamInfo.upcomingAbsences.length > 0) {
      teamInfo.upcomingAbsences.slice(0, 3).forEach(absence => {
        const name = absence.employee_name;
        const startDate = parseISO(absence.start_date);
        const endDate = parseISO(absence.end_date);
        
        const reasonMap = {
          'vacation': { emoji: '🏖️', text: 'Vacaciones' },
          'medical': { emoji: '🤒', text: 'Cita médica' },
          'sick': { emoji: '🤒', text: 'Baja médica' },
          'personal': { emoji: '📋', text: 'Ausencia personal' },
          'other': { emoji: '📋', text: 'No disponible' }
        };
        const reason = reasonMap[absence.reason] || { emoji: '📋', text: absence.reason_label || 'Ausencia' };
        
        let description = '';
        
        // Si es VARIOS DÍAS (vacaciones típicamente)
        if (absence.start_date !== absence.end_date) {
          const start = format(startDate, "d 'de' MMMM", { locale: es });
          const end = format(endDate, "d 'de' MMMM", { locale: es });
          description = `${reason.text} del ${start} al ${end}`;
        } 
        // Si es UN SOLO DÍA
        else {
          const dateStr = format(startDate, "EEEE d 'de' MMMM", { locale: es });
          
          // Si tiene hora específica
          if (!absence.all_day && absence.start_time) {
            const time = absence.start_time.substring(0, 5);
            
            // Si tiene hora de fin también
            if (absence.end_time) {
              const endTime = absence.end_time.substring(0, 5);
              description = `${reason.text} - ${dateStr} de ${time} a ${endTime}`;
            } else {
              description = `${reason.text} - ${dateStr} a las ${time}`;
            }
          } 
          // Todo el día
          else {
            description = `${reason.text} - ${dateStr}`;
          }
        }
        
        upcomingItems.push({
          emoji: reason.emoji,
          name: name,
          text: description
        });
      });
    }

    // 3. Si no hay ausencias, mostrar equipo disponible
    if (todayItems.length === 0 && upcomingItems.length === 0) {
      if (teamInfo.employees && teamInfo.employees.length > 0) {
        return {
          title: '👥 Tu equipo',
          type: 'available',
          employees: teamInfo.employees.slice(0, 5),
          totalCount: teamInfo.employees.length
        };
      }
      return null;
    }

    const isToday = todayItems.length > 0;
    return {
      title: isToday ? '👥 Tu equipo hoy' : '👥 Tu equipo - Esta semana',
      type: 'absences',
      items: todayItems.length > 0 ? todayItems : upcomingItems
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-blue-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin" />
      </div>
    );
  }

  const timeGreeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Buenos días';
    if (hour < 20) return 'Buenas tardes';
    return 'Buenas noches';
  })();

  const avatarUrl = agentConfig?.avatar_url || business?.settings?.agent?.avatar_url || business?.agent_config?.avatar_url;

  const getTimeUntilAppointment = () => {
    if (!nextAppointment) return null;
    const now = new Date();
    const appointmentDateTime = parseISO(`${nextAppointment.appointment_date}T${nextAppointment.appointment_time}`);
    const minutes = differenceInMinutes(appointmentDateTime, now);
    
    if (minutes < 0) return null;
    if (minutes < 60) return `en ${minutes} min`;
    const hours = Math.floor(minutes / 60);
    return `en ${hours}h ${minutes % 60}min`;
  };

  const getDynamicMetric = () => {
    if (!agentMetrics) return null;
    
    if (agentMetrics.complaints > 0) {
      return {
        value: agentMetrics.complaints,
        label: 'Quejas',
        icon: AlertCircle,
        color: 'red'
      };
    }
    
    return {
      value: agentMetrics.spam,
      label: 'Spam',
      icon: Shield,
      color: 'orange'
    };
  };

  const dynamicMetric = getDynamicMetric();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 pb-24 lg:pb-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        
        <div className="grid grid-cols-1 lg:grid-cols-[400px_1fr] gap-6">
          
          {/* AVATAR - GLASSMORPHISM PREMIUM */}
          <div className="space-y-4">
            <div className="relative bg-white/40 backdrop-blur-xl rounded-[36px] sticky top-6 shadow-2xl shadow-gray-900/10 border border-white/60 overflow-visible">
              
              {/* Avatar con efecto 3D - SIN FONDO, SOBRESALE DEL MARCO */}
              <div className="relative group -mt-6 px-6">
                {/* Glow effect sutil y profesional */}
                <div className="absolute -inset-6 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 opacity-0 group-hover:opacity-20 blur-3xl transition-all duration-700"></div>
                
                {/* Contenedor del avatar - overflow visible para que sobresalga */}
                <div className="relative">
                  {/* Imagen del avatar - sobresale del contenedor */}
                  <div className="relative transform transition-all duration-700 group-hover:scale-105 group-hover:-translate-y-2">
                    {/* Sombra profunda para dar sensación 3D - más sutil y oscura */}
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-gray-900/10 to-gray-900/20 blur-2xl transform translate-y-6 scale-95 opacity-50"></div>
                    
                    {/* Borde sutil - glassmorphism style */}
                    <div className="relative p-[2px] rounded-[36px] bg-gradient-to-br from-white/80 via-white/60 to-white/80 shadow-2xl">
                      <div className="relative w-full aspect-[3/4] overflow-hidden rounded-[33px]">
                        {avatarUrl ? (
                          <img 
                            src={avatarUrl} 
                            alt={assistantName}
                            className="w-full h-full object-cover transition-all duration-700"
                            style={{ 
                              filter: 'contrast(1.05) saturate(1.1)',
                              objectPosition: 'center 20%'
                            }}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-purple-500 via-pink-500 to-blue-500">
                            <Bot className="w-24 h-24 text-white" />
                          </div>
                        )}
                        
                        {/* Shine effect sutil */}
                        <div className="absolute inset-0 bg-gradient-to-tr from-white/0 via-white/30 to-white/0 translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000 ease-out"></div>
                        
                        {/* Vignette muy sutil para dar profundidad */}
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-gray-900/5"></div>
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Badge con más punch - ahora con z-index mayor */}
                <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 transform group-hover:scale-110 transition-transform duration-300 z-30">
                  <div className={`relative px-5 py-2 rounded-full border-2 shadow-2xl ${
                    agentStatus === 'active' 
                      ? 'bg-gradient-to-r from-green-400 to-emerald-500 border-white/50' 
                      : 'bg-gradient-to-r from-gray-500 to-gray-600 border-white/50'
                  }`}>
                    {/* Glow del badge */}
                    <div className={`absolute inset-0 rounded-full blur-md ${
                      agentStatus === 'active' 
                        ? 'bg-green-400/50' 
                        : 'bg-gray-500/30'
                    }`}></div>
                    
                    <div className="relative flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${
                        agentStatus === 'active' 
                          ? 'bg-white animate-pulse shadow-lg shadow-white/50' 
                          : 'bg-white/80'
                      }`}></span>
                      <span className="text-sm font-bold text-white tracking-wide">
                        {agentStatus === 'active' ? 'Activa' : 'Desactivada'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Nombre + Conversación - VISUAL Y ATRACTIVA */}
              <div className="relative px-6 pt-8 pb-6">
                {/* Nombre con gradiente profesional */}
                <div className="text-center mb-4">
                  <h1 className="text-[36px] font-black bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-600 bg-clip-text text-transparent tracking-tight leading-none" 
                      style={{
                        filter: 'drop-shadow(0 2px 8px rgba(59, 130, 246, 0.15))'
                      }}>
                    {assistantName}
                  </h1>
                </div>

                {/* Burbuja de conversación - PROFESIONAL */}
                <div className="relative">
                  {/* Triangulito de la burbuja */}
                  <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gradient-to-br from-blue-500 to-indigo-500 transform rotate-45"></div>
                  
                  {/* Burbuja con gradiente profesional */}
                  <div className="relative bg-gradient-to-br from-blue-500 via-indigo-500 to-blue-600 p-[2px] rounded-2xl shadow-xl shadow-blue-500/20">
                    <div className="bg-white rounded-2xl px-5 py-4">
                      {/* Icono de mensaje */}
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-8 h-8 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center mt-0.5">
                          <Bot className="w-4 h-4 text-white" />
                        </div>
                        
                        <div className="flex-1 min-w-0">
                          <p className="text-[15px] text-gray-900 font-semibold leading-relaxed">
                            {greeting}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Efecto de "escribiendo..." sutil */}
                  <div className="mt-2 flex items-center justify-center gap-1 opacity-40">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* CONVERSACIÓN */}
          <div className="space-y-4">
            
            {/* COPILOT */}
            {copilotProgress && copilotProgress.completed < copilotProgress.total && copilotProgress.nextStep && (
              <div className="bg-white rounded-3xl rounded-tl-sm p-5 shadow-lg border-2 border-orange-300 relative">
                <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l-2 border-t-2 border-orange-300 transform rotate-45"></div>
                <p className="text-gray-800 font-medium mb-3">
                  ⚠️ Aún me faltan algunas cosas para funcionar al 100%:
                </p>
                <button
                  onClick={() => navigate(copilotProgress.nextStep.url)}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white text-sm font-semibold rounded-lg"
                >
                  {copilotProgress.nextStep.label} →
                </button>
              </div>
            )}

            {/* MÉTRICAS DEL NEGOCIO */}
            {businessMetrics && (
              <div className="bg-white rounded-3xl rounded-tl-sm p-6 shadow-lg border-2 border-purple-200 relative">
                <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l-2 border-t-2 border-purple-200 transform rotate-45"></div>
                
                <p className="text-gray-800 font-medium mb-4">
                  Así va tu negocio hoy:
                </p>

                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <DollarSign className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">{businessMetrics.revenue.toFixed(0)}€</div>
                    <div className="text-xs text-gray-600">Facturado hoy</div>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Calendar className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{businessMetrics.freeSlots}</div>
                    <div className="text-xs text-gray-600">Huecos libres</div>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <AlertTriangle className="w-6 h-6 text-red-600" />
                    </div>
                    <div className="text-2xl font-bold text-red-600">{businessMetrics.riskNoShows}</div>
                    <div className="text-xs text-gray-600">En riesgo</div>
                  </div>
                </div>

                {nextAppointment && (
                  <div className="bg-blue-50 border-2 border-blue-200 rounded-xl p-3">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <span className="font-semibold text-blue-900">Próxima cita {getTimeUntilAppointment()}:</span>
                    </div>
                    <p className="text-sm text-gray-800 mt-1">
                      {nextAppointment.customer_name}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* MÉTRICAS DEL AGENTE */}
            {agentMetrics && (
              <div className="bg-white rounded-3xl rounded-tl-sm p-6 shadow-lg border-2 border-purple-200 relative">
                <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l-2 border-t-2 border-purple-200 transform rotate-45"></div>
                
                <p className="text-gray-800 font-medium mb-4">
                  Te cuento lo que he hecho:
                </p>

                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-6 h-6 text-green-600" />
                    </div>
                    <div className="text-2xl font-bold text-green-600">{agentMetrics.reservations}</div>
                    <div className="text-xs text-gray-600">Reservas</div>
                  </div>

                  <div className="text-center">
                    <div className={`w-12 h-12 ${dynamicMetric?.color === 'red' ? 'bg-red-100' : 'bg-orange-100'} rounded-xl flex items-center justify-center mx-auto mb-2`}>
                      {dynamicMetric && React.createElement(dynamicMetric.icon, {
                        className: `w-6 h-6 ${dynamicMetric.color === 'red' ? 'text-red-600' : 'text-orange-600'}`
                      })}
                    </div>
                    <div className={`text-2xl font-bold ${dynamicMetric?.color === 'red' ? 'text-red-600' : 'text-orange-600'}`}>
                      {dynamicMetric?.value}
                    </div>
                    <div className="text-xs text-gray-600">{dynamicMetric?.label}</div>
                  </div>

                  <div className="text-center">
                    <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-2">
                      <Phone className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="text-2xl font-bold text-blue-600">{agentMetrics.calls}</div>
                    <div className="text-xs text-gray-600">Llamadas</div>
                  </div>
                </div>
              </div>
            )}

            {/* EQUIPO - VISUAL */}
            {(() => {
              const teamMessage = getTeamMessage();
              if (!teamMessage) return null;
              
              return (
                <div className="bg-white rounded-3xl rounded-tl-sm p-6 shadow-lg border-2 border-purple-200 relative">
                  <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l-2 border-t-2 border-purple-200 transform rotate-45"></div>
                  
                  <p className="text-gray-800 font-semibold mb-4">{teamMessage.title}</p>

                  {teamMessage.type === 'available' ? (
                    // EQUIPO DISPONIBLE
                    <div className="space-y-2">
                      {teamMessage.employees.map((emp, idx) => (
                        <div key={idx} className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-lg">👤</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 truncate">{emp.name}</p>
                            <p className="text-xs text-green-700">Disponible hoy</p>
                          </div>
                        </div>
                      ))}
                      {teamMessage.totalCount > 5 && (
                        <p className="text-sm text-gray-600 text-center mt-2">
                          ...y {teamMessage.totalCount - 5} más
                        </p>
                      )}
                      <div className="mt-3 pt-3 border-t border-gray-200 text-center">
                        <p className="text-sm font-semibold text-green-600">
                          ✅ Todo el equipo disponible
                        </p>
                      </div>
                    </div>
                  ) : (
                    // AUSENCIAS
                    <div className="space-y-2">
                      {teamMessage.items.map((item, idx) => (
                        <div key={idx} className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-xl">
                          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                            <span className="text-xl">{item.emoji}</span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900">{item.name}</p>
                            <p className="text-sm text-gray-700" dangerouslySetInnerHTML={{ 
                              __html: item.text.replace(
                                /^(Cita médica|Baja médica|Vacaciones|Ausencia personal|No disponible)/,
                                '<strong>$1</strong>'
                              )
                            }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* ACTIVIDAD */}
            {activityFeed.length > 0 && (
              <div className="bg-white rounded-3xl rounded-tl-sm p-5 shadow-lg border-2 border-purple-200 relative">
                <div className="absolute -left-2 top-6 w-4 h-4 bg-white border-l-2 border-t-2 border-purple-200 transform rotate-45"></div>
                <p className="text-gray-800 font-medium mb-3">Mis últimas acciones:</p>
                <div className="space-y-2">
                  {activityFeed.map((activity) => {
                    const h = humanizeActivity(activity);
                    return (
                      <div key={activity.id} className="flex items-center gap-3 text-sm">
                        <span className="text-gray-500 font-mono text-xs">{h.time}</span>
                        <span className="text-gray-700">{h.text}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* CONVERSACIÓN */}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-3xl p-4 shadow-md ${
                  msg.type === 'user' 
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-br-sm' 
                    : 'bg-white border-2 border-purple-200 text-gray-800 rounded-tl-sm'
                }`}>
                  <p className="text-sm whitespace-pre-line">{msg.message}</p>
                </div>
              </div>
            ))}

            {loadingResponse && (
              <div className="flex justify-start">
                <div className="bg-white border-2 border-purple-200 rounded-3xl rounded-tl-sm p-4">
                  <Loader2 className="w-4 h-4 text-purple-600 animate-spin" />
                </div>
              </div>
            )}

            {/* CHAT INPUT */}
            <div className="bg-white rounded-2xl p-5 shadow-lg border-2 border-gray-200">
              <p className="text-gray-800 font-medium mb-3">¿Necesitas algo?</p>
              
              <div className="grid grid-cols-3 gap-2 mb-4">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q.id}
                    onClick={() => handleQuickQuestion(q)}
                    disabled={loadingResponse}
                    className="px-3 py-2 bg-gradient-to-r from-purple-50 to-blue-50 hover:from-purple-100 hover:to-blue-100 border-2 border-purple-200 rounded-xl text-sm font-medium disabled:opacity-50"
                  >
                    {q.icon} {q.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={userMessage}
                  onChange={(e) => setUserMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribe tu pregunta..."
                  className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!userMessage.trim()}
                  className="px-5 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl disabled:opacity-50"
                >
                  <Send className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

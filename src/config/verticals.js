// Configuración de Verticales - Labels, iconos y datos del sector
import { 
    Scissors, Heart, Dumbbell, Users as UsersIcon, 
    Stethoscope, HandMetal, Brain, Sparkles, Activity, PawPrint
} from 'lucide-react';

export const VERTICAL_CONFIG = {
    'peluqueria_barberia': {
        id: 'peluqueria_barberia',
        name: 'Peluquería y Barbería',
        icon: Scissors,
        color: 'purple',
        labels: {
            service: 'Servicio',
            services: 'Servicios',
            serviceCompleted: 'Servicio Completado',
            servicesCompleted: 'Servicios Completados',
            topServices: 'Servicios Más Solicitados',
            billing: 'Facturación & Servicios'
        },
        benchmarks: {
            avgTicket: 35,
            conversionRate: 85,
            vipPercentage: 18,
            regularPercentage: 40,
            churnRate: 15
        }
    },
    'centro_unas': {
        id: 'centro_unas',
        name: 'Centro de Uñas',
        icon: HandMetal,
        color: 'pink',
        labels: {
            service: 'Servicio',
            services: 'Servicios',
            serviceCompleted: 'Servicio Completado',
            servicesCompleted: 'Servicios Completados',
            topServices: 'Servicios Más Populares',
            billing: 'Facturación & Servicios'
        },
        benchmarks: {
            avgTicket: 28,
            conversionRate: 88,
            vipPercentage: 22,
            regularPercentage: 45,
            churnRate: 12
        }
    },
    'entrenador_personal': {
        id: 'entrenador_personal',
        name: 'Entrenador Personal',
        icon: Dumbbell,
        color: 'orange',
        labels: {
            service: 'Sesión',
            services: 'Sesiones',
            serviceCompleted: 'Sesión Completada',
            servicesCompleted: 'Sesiones Completadas',
            topServices: 'Sesiones Más Demandadas',
            billing: 'Facturación & Sesiones'
        },
        benchmarks: {
            avgTicket: 45,
            conversionRate: 90,
            vipPercentage: 30,
            regularPercentage: 50,
            churnRate: 20
        }
    },
    'yoga_pilates': {
        id: 'yoga_pilates',
        name: 'Yoga y Pilates',
        icon: Activity,
        color: 'green',
        labels: {
            service: 'Clase',
            services: 'Clases',
            serviceCompleted: 'Clase Completada',
            servicesCompleted: 'Clases Completadas',
            topServices: 'Clases Más Populares',
            billing: 'Facturación & Clases'
        },
        benchmarks: {
            avgTicket: 18,
            conversionRate: 92,
            vipPercentage: 35,
            regularPercentage: 45,
            churnRate: 18
        }
    },
    'fisioterapia': {
        id: 'fisioterapia',
        name: 'Fisioterapia',
        icon: Stethoscope,
        color: 'blue',
        labels: {
            service: 'Sesión',
            services: 'Sesiones',
            serviceCompleted: 'Sesión Completada',
            servicesCompleted: 'Sesiones Completadas',
            topServices: 'Tratamientos Más Frecuentes',
            billing: 'Facturación & Sesiones'
        },
        benchmarks: {
            avgTicket: 50,
            conversionRate: 85,
            vipPercentage: 20,
            regularPercentage: 42,
            churnRate: 25
        }
    },
    'masajes_osteopatia': {
        id: 'masajes_osteopatia',
        name: 'Masajes y Osteopatía',
        icon: Heart,
        color: 'rose',
        labels: {
            service: 'Sesión',
            services: 'Sesiones',
            serviceCompleted: 'Sesión Completada',
            servicesCompleted: 'Sesiones Completadas',
            topServices: 'Tratamientos Más Solicitados',
            billing: 'Facturación & Sesiones'
        },
        benchmarks: {
            avgTicket: 55,
            conversionRate: 87,
            vipPercentage: 25,
            regularPercentage: 40,
            churnRate: 20
        }
    },
    'psicologia_coaching': {
        id: 'psicologia_coaching',
        name: 'Psicología y Coaching',
        icon: Brain,
        color: 'indigo',
        labels: {
            service: 'Consulta',
            services: 'Consultas',
            serviceCompleted: 'Consulta Completada',
            servicesCompleted: 'Consultas Completadas',
            topServices: 'Consultas Más Frecuentes',
            billing: 'Facturación & Consultas'
        },
        benchmarks: {
            avgTicket: 60,
            conversionRate: 90,
            vipPercentage: 28,
            regularPercentage: 48,
            churnRate: 22
        }
    },
    'centro_estetica': {
        id: 'centro_estetica',
        name: 'Centro de Estética',
        icon: Sparkles,
        color: 'pink',
        labels: {
            service: 'Tratamiento',
            services: 'Tratamientos',
            serviceCompleted: 'Tratamiento Completado',
            servicesCompleted: 'Tratamientos Completados',
            topServices: 'Tratamientos Más Demandados',
            billing: 'Facturación & Tratamientos'
        },
        benchmarks: {
            avgTicket: 65,
            conversionRate: 86,
            vipPercentage: 22,
            regularPercentage: 43,
            churnRate: 16
        }
    },
    'clinica_dental': {
        id: 'clinica_dental',
        name: 'Clínica Dental',
        icon: Stethoscope,
        color: 'cyan',
        labels: {
            service: 'Tratamiento',
            services: 'Tratamientos',
            serviceCompleted: 'Tratamiento Completado',
            servicesCompleted: 'Tratamientos Completados',
            topServices: 'Tratamientos Más Frecuentes',
            billing: 'Facturación & Tratamientos'
        },
        benchmarks: {
            avgTicket: 120,
            conversionRate: 92,
            vipPercentage: 15,
            regularPercentage: 38,
            churnRate: 10
        }
    },
    'veterinario': {
        id: 'veterinario',
        name: 'Veterinario',
        icon: PawPrint,
        color: 'amber',
        labels: {
            service: 'Consulta',
            services: 'Consultas',
            serviceCompleted: 'Consulta Completada',
            servicesCompleted: 'Consultas Completadas',
            topServices: 'Consultas Más Comunes',
            billing: 'Facturación & Consultas'
        },
        benchmarks: {
            avgTicket: 45,
            conversionRate: 88,
            vipPercentage: 20,
            regularPercentage: 42,
            churnRate: 18
        }
    }
};

// Configuración por defecto (fallback)
export const DEFAULT_VERTICAL_CONFIG = {
    id: 'generic',
    name: 'Negocio de Servicios',
    icon: UsersIcon,
    color: 'purple',
    labels: {
        service: 'Servicio',
        services: 'Servicios',
        serviceCompleted: 'Servicio Completado',
        servicesCompleted: 'Servicios Completados',
        topServices: 'Servicios Más Vendidos',
        billing: 'Facturación & Servicios'
    },
    benchmarks: {
        avgTicket: 40,
        conversionRate: 85,
        vipPercentage: 18,
        regularPercentage: 40,
        churnRate: 15
    }
};

// Función helper para obtener configuración
export const getVerticalConfig = (verticalType) => {
    return VERTICAL_CONFIG[verticalType] || DEFAULT_VERTICAL_CONFIG;
};

// Colores por métrica (universales)
export const METRIC_COLORS = {
    revenue: { gradient: 'from-green-500 to-emerald-600', bg: 'bg-green-50', text: 'text-green-700', border: 'border-green-200' },
    services: { gradient: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    pending: { gradient: 'from-orange-500 to-amber-600', bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
    ticket: { gradient: 'from-purple-500 to-pink-600', bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
    performance: { gradient: 'from-cyan-500 to-blue-600', bg: 'bg-cyan-50', text: 'text-cyan-700', border: 'border-cyan-200' }
};




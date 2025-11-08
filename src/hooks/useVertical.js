import { useMemo } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import {
  Heart, Sparkles, Scissors, Dumbbell, Flower2, 
  Stethoscope, Brain, PawPrint, Activity, User,
  Calendar, Users, Clock, MapPin, Phone, Mail
} from 'lucide-react';

/**
 * Hook para adaptar la UI según el vertical del negocio
 * Devuelve labels, iconos y configuración específica del sector
 */
export function useVertical() {
  const { business } = useAuthContext();
  
  // ✅ FIX: La BD usa vertical_type, no vertical
  const vertical = business?.vertical_type || business?.vertical || 'peluqueria_barberia';

  // Configuración por vertical
  const config = useMemo(() => {
    const configs = {
      fisioterapia: {
        id: 'fisioterapia',
        name: 'Fisioterapia',
        icon: Activity,
        color: 'blue',
        labels: {
          resource: 'Camilla',
          resources: 'Camillas',
          service: 'Sesión',
          services: 'Sesiones',
          appointment: 'Cita',
          appointments: 'Citas',
          customer: 'Paciente',
          customers: 'Pacientes',
          booking: 'Reserva',
          bookings: 'Reservas'
        },
        defaultDuration: 60,
        typicalServices: ['Sesión individual', 'Masaje deportivo', 'Rehabilitación', 'Valoración inicial']
      },
      
      masajes_osteopatia: {
        id: 'masajes_osteopatia',
        name: 'Masajes / Osteopatía',
        icon: Sparkles,
        color: 'purple',
        labels: {
          resource: 'Camilla',
          resources: 'Camillas',
          service: 'Sesión',
          services: 'Sesiones',
          appointment: 'Cita',
          appointments: 'Citas',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Reserva',
          bookings: 'Reservas'
        },
        defaultDuration: 60,
        typicalServices: ['Masaje relajante', 'Osteopatía', 'Masaje deportivo', 'Masaje terapéutico']
      },

      clinica_dental: {
        id: 'clinica_dental',
        name: 'Clínica Dental',
        icon: User,
        color: 'cyan',
        labels: {
          resource: 'Sillón',
          resources: 'Sillones',
          service: 'Tratamiento',
          services: 'Tratamientos',
          appointment: 'Cita',
          appointments: 'Citas',
          customer: 'Paciente',
          customers: 'Pacientes',
          booking: 'Cita',
          bookings: 'Citas'
        },
        defaultDuration: 30,
        typicalServices: ['Limpieza dental', 'Revisión', 'Empaste', 'Ortodoncia', 'Endodoncia']
      },

      psicologia_coaching: {
        id: 'psicologia_coaching',
        name: 'Psicología / Coaching',
        icon: Brain,
        color: 'indigo',
        labels: {
          resource: 'Consulta',
          resources: 'Consultas',
          service: 'Sesión',
          services: 'Sesiones',
          appointment: 'Sesión',
          appointments: 'Sesiones',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Sesión',
          bookings: 'Sesiones'
        },
        defaultDuration: 60,
        typicalServices: ['Sesión individual', 'Terapia de pareja', 'Coaching', 'Primera consulta']
      },

      centro_estetica: {
        id: 'centro_estetica',
        name: 'Centro de Estética',
        icon: Sparkles,
        color: 'pink',
        labels: {
          resource: 'Cabina',
          resources: 'Cabinas',
          service: 'Tratamiento',
          services: 'Tratamientos',
          appointment: 'Cita',
          appointments: 'Citas',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Cita',
          bookings: 'Citas'
        },
        defaultDuration: 45,
        typicalServices: ['Facial', 'Depilación láser', 'Tratamiento corporal', 'Masaje']
      },

      peluqueria_barberia: {
        id: 'peluqueria_barberia',
        name: 'Peluquería / Barbería',
        icon: Scissors,
        color: 'amber',
        labels: {
          resource: 'Sillón',
          resources: 'Sillones',
          service: 'Servicio',
          services: 'Servicios',
          appointment: 'Turno',
          appointments: 'Turnos',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Turno',
          bookings: 'Turnos'
        },
        defaultDuration: 30,
        typicalServices: ['Corte', 'Tinte', 'Peinado', 'Barba', 'Mechas']
      },

      centro_unas: {
        id: 'centro_unas',
        name: 'Centro de Uñas',
        icon: Flower2,
        color: 'rose',
        labels: {
          resource: 'Mesa',
          resources: 'Mesas',
          service: 'Servicio',
          services: 'Servicios',
          appointment: 'Cita',
          appointments: 'Citas',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Cita',
          bookings: 'Citas'
        },
        defaultDuration: 45,
        typicalServices: ['Manicura', 'Pedicura', 'Uñas acrílicas', 'Uñas gel', 'Diseños']
      },

      entrenador_personal: {
        id: 'entrenador_personal',
        name: 'Entrenador Personal',
        icon: Dumbbell,
        color: 'orange',
        labels: {
          resource: 'Sala',
          resources: 'Salas',
          service: 'Sesión',
          services: 'Sesiones',
          appointment: 'Entrenamiento',
          appointments: 'Entrenamientos',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Sesión',
          bookings: 'Sesiones'
        },
        defaultDuration: 60,
        typicalServices: ['Sesión 1:1', 'Sesión grupal', 'Evaluación física', 'Plan nutricional']
      },

      yoga_pilates: {
        id: 'yoga_pilates',
        name: 'Yoga / Pilates',
        icon: Heart,
        color: 'green',
        labels: {
          resource: 'Sala',
          resources: 'Salas',
          service: 'Clase',
          services: 'Clases',
          appointment: 'Clase',
          appointments: 'Clases',
          customer: 'Alumno',
          customers: 'Alumnos',
          booking: 'Reserva',
          bookings: 'Reservas'
        },
        defaultDuration: 60,
        typicalServices: ['Clase yoga', 'Clase pilates', 'Sesión privada', 'Meditación']
      },

      veterinario: {
        id: 'veterinario',
        name: 'Veterinaria',
        icon: PawPrint,
        color: 'teal',
        labels: {
          resource: 'Consultorio',
          resources: 'Consultorios',
          service: 'Servicio',
          services: 'Servicios',
          appointment: 'Cita',
          appointments: 'Citas',
          customer: 'Cliente',
          customers: 'Clientes',
          booking: 'Cita',
          bookings: 'Citas'
        },
        defaultDuration: 30,
        typicalServices: ['Consulta', 'Vacunación', 'Cirugía', 'Emergencia', 'Revisión']
      }
    };

    return configs[vertical] || configs.fisioterapia;
  }, [vertical]);

  // Función helper para obtener color Tailwind
  const getColorClass = (type = 'bg', shade = '500') => {
    return `${type}-${config.color}-${shade}`;
  };

  // Función helper para obtener label en singular o plural
  const getLabel = (key, count = 1) => {
    if (count === 1) {
      return config.labels[key] || key;
    }
    return config.labels[`${key}s`] || `${key}s`;
  };

  return {
    vertical: config.id,
    name: config.name,
    Icon: config.icon,
    color: config.color,
    labels: config.labels,
    defaultDuration: config.defaultDuration,
    typicalServices: config.typicalServices,
    getColorClass,
    getLabel
  };
}


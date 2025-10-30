/**
 * PAQUETES DE DEMO - Información FIJA por Vertical
 * La IA usará esta información para responder preguntas abiertas.
 * El modal de "Info" mostrará estos datos en bruto para que el usuario invente preguntas.
 */

export const DEMO_PACKAGES = {
  fisioterapia: {
    services: [
      { name: 'Sesión Fisioterapia', duration: 45, price: 50, description: 'Tratamiento personalizado para contracturas, esguinces y dolor muscular.' },
      { name: 'Rehabilitación Suelo Pélvico', duration: 60, price: 65, description: 'Especialidad en recuperación postparto y disfunciones.' },
      { name: 'Masaje Deportivo', duration: 30, price: 35, description: 'Tratamiento profundo para optimizar el rendimiento y prevenir lesiones.' },
      { name: 'Punción Seca', duration: 30, price: 40, description: 'Técnica avanzada para desactivar puntos gatillo (contracturas).' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Acceso', answer: 'Estamos en Plaza España, 5, Barcelona. Tienes el Metro L1/L3 (Pl. Espanya) y un parking público (Parking BSM) a 50 metros.' },
      { icon: 'check-circle', title: 'Mutuas y Pagos', answer: 'No trabajamos directamente con mutuas, pero sí ofrecemos reembolso. Te daremos una factura oficial para que la presentes a tu aseguradora (Adeslas, Sanitas, DKV, etc.).' },
      { icon: 'user-md', title: 'Nuestra Especialidad', answer: 'Somos especialistas en fisioterapia deportiva y recuperación postparto (suelo pélvico). Usamos técnicas avanzadas como la punción seca.' },
      { icon: 'info-circle', title: 'Primera Visita', answer: 'En tu primera visita, haremos una evaluación completa. Si tienes informes médicos o pruebas (resonancias, radiografías), es muy útil que los traigas.' }
    ]
  },
  
  masajes_osteopatia: {
    services: [
      { name: 'Sesión Osteopatía', duration: 60, price: 60, description: 'Ajuste estructural, visceral y craneal para encontrar el origen del dolor.' },
      { name: 'Masaje Relajante', duration: 60, price: 50, description: 'Masaje corporal completo con aceites esenciales para eliminar el estrés.' },
      { name: 'Masaje Deportivo', duration: 45, price: 45, description: 'Masaje profundo de descarga muscular, ideal para pre y post competición.' },
      { name: 'Reflexología Podal', duration: 45, price: 40, description: 'Técnica terapéutica en puntos reflejos de los pies.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Acceso', answer: 'Estamos en Calle Gran Vía, 123, Madrid. Justo al lado del Metro Callao (L3, L5).' },
      { icon: 'spa', title: 'Nuestro Enfoque', answer: 'Combinamos técnicas de osteopatía para tratar el origen, y masajes para aliviar los síntomas. Si tienes un dolor concreto, recomendamos osteopatía; si es estrés, un masaje.' },
      { icon: 'gift', title: 'Bonos Ahorro', answer: 'Disponemos de bonos de 5 y 10 sesiones. Con el bono de 10 sesiones, te regalamos una sesión adicional.' },
      { icon: 'shopping-bag', title: 'Qué Traer', answer: 'No necesitas traer nada, solo tus ganas de relajarte. Nosotros proporcionamos toallas, aceites y todo el material necesario.' }
    ]
  },

  clinica_dental: {
    services: [
      { name: 'Revisión General', duration: 30, price: 40, description: 'Inspección completa, diagnóstico y plan de tratamiento.' },
      { name: 'Limpieza Dental', duration: 45, price: 60, description: 'Profilaxis profesional con ultrasonidos y pulido para eliminar sarro y manchas.' },
      { name: 'Empaste', duration: 60, price: 80, description: 'Obturación de composite estético para tratar caries.' },
      { name: 'Blanqueamiento', duration: 60, price: 150, description: 'Blanqueamiento profesional con luz LED, 100% seguro y no daña el esmalte.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Acceso', answer: 'Estamos en Avenida Diagonal, 456, Barcelona. Disponemos de 1 hora de parking gratuito para pacientes en el mismo edificio.' },
      { icon: 'check-circle', title: 'Seguros y Financiación', answer: 'Trabajamos con las principales aseguradoras (Sanitas, Adeslas, DKV, etc.) y ofrecemos financiación a medida de hasta 12 meses.' },
      { icon: 'users', title: 'Promoción Primera Visita', answer: '¡Tu primera visita es gratuita! Incluye una revisión general, diagnóstico y radiografía panorámica (si es necesaria).' },
      { icon: 'tooth', title: 'Especialidades', answer: 'Además de odontología general, somos especialistas en Implantología y Ortodoncia Invisible.' }
    ]
  },

  psicologia_coaching: {
    services: [
      { name: 'Primera Sesión (Evaluación)', duration: 60, price: 80, description: 'Toma de contacto para conocernos, explorar el motivo de consulta y definir objetivos.' },
      { name: 'Sesión Seguimiento (Terapia)', duration: 60, price: 60, description: 'Terapia individual basada en la corriente Cognitivo-Conductual y Aceptación.' },
      { name: 'Terapia de Pareja', duration: 90, price: 90, description: 'Sesión conjunta para mejorar la comunicación y resolver conflictos.' },
      { name: 'Sesión Coaching', duration: 60, price: 70, description: 'Enfocado a conseguir objetivos específicos, personales o profesionales.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Modalidad', answer: 'Estamos en Calle Serrano, 89, Madrid, en un despacho privado y discreto. También ofrecemos todas las sesiones 100% online por videollamada segura.' },
      { icon: 'lock', title: 'Confidencialidad', answer: 'Absolutamente. La confidencialidad y el secreto profesional son la base de nuestro trabajo y están garantizados por ley.' },
      { icon: 'user-friends', title: 'Nuestro Enfoque', answer: 'No creemos en terapias eternas. Usamos un enfoque práctico (Cognitivo-Conductual) para darte herramientas desde el primer día.' },
      { icon: 'clock', title: 'Horario', answer: 'Nuestro horario es flexible para adaptarnos a ti, de Lunes a Viernes de 10:00 a 21:00. También Sábados por la mañana.' }
    ]
  },

  centro_estetica: {
    services: [
      { name: 'Limpieza Facial Profunda', duration: 60, price: 45, description: 'Extracción, peeling ultrasónico e hidratación.' },
      { name: 'Depilación Láser Diodo', duration: 30, price: 40, description: 'Precio por zona (ej. axilas, ingles). Prácticamente indoloro.' },
      { name: 'Tratamiento Facial (Premium)', duration: 75, price: 65, description: 'Tratamiento personalizado (anti-edad, luminosidad) con alta cosmética.' },
      { name: 'Radiofrecuencia (Indiba)', duration: 45, price: 55, description: 'Tratamiento reafirmante facial o corporal, no invasivo.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación', answer: 'Estamos en Paseo de Gracia, 77, Barcelona (zona Eixample).' },
      { icon: 'spa', title: 'Nuestros Productos', answer: 'Solo trabajamos con marcas de alta cosmética profesional, como Germaine de Capuccini y Natura Bissé, para garantizar resultados.' },
      { icon: 'percent', title: 'Promociones', answer: '¡Tenemos una promo de bienvenida! Si es tu primera vez, tienes un 20% de descuento en cualquier tratamiento facial.' },
      { icon: 'gift', title: 'Bonos y Regalos', answer: 'Disponemos de bonos de 5 sesiones (con 10% de dto.) y tarjetas regalo que puedes comprar para quien tú quieras.' }
    ]
  },

  peluqueria_barberia: {
    services: [
      { name: 'Corte y Peinado (Mujer)', duration: 30, price: 25, description: 'Incluye lavado con champú de tratamiento y peinado.' },
      { name: 'Corte + Barba (Hombre)', duration: 45, price: 30, description: 'Servicio completo de corte, perfilado de barba con navaja y toalla caliente.' },
      { name: 'Tinte Completo', duration: 90, price: 50, description: 'Aplicación de color en raíces y puntas. Usamos tinte sin amoníaco.' },
      { name: 'Mechas (Balayage/Babylights)', duration: 120, price: 80, description: 'Técnica de coloración avanzada para un resultado natural. Incluye Olaplex.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Acceso', answer: 'Estamos en Calle Mayor, 34, Valencia. El Parking del Mercado Central está a 2 minutos andando.' },
      { icon: 'star', title: 'Nuestra Especialidad', answer: 'Somos expertos en técnicas de coloración avanzadas (Balayage, Babylights) y en cortes de tendencia. También hacemos tratamientos de keratina y alisado orgánico.' },
      { icon: 'spa', title: 'Nuestros Productos', answer: 'Para proteger tu cabello, usamos siempre productos de alta gama como Wella, Kérastase y Olaplex en nuestros tratamientos de color.' },
      { icon: 'calendar-check', title: 'Cita Previa', answer: 'Trabajamos principalmente con cita previa para dedicarte el tiempo que mereces. No podemos garantizar atenderte si vienes sin cita.' }
    ]
  },

  centro_unas: {
    services: [
      { name: 'Manicura Semipermanente', duration: 45, price: 30, description: 'Limado, cutículas y esmaltado de alta duración (2-3 semanas).' },
      { name: 'Pedicura Semipermanente', duration: 60, price: 35, description: 'Completa: limado, durezas, cutículas, esmaltado y masaje relajante.' },
      { name: 'Uñas Acrílicas (Nuevas)', duration: 90, price: 45, description: 'Construcción de uña nueva con acrílico, largo y forma a elegir.' },
      { name: 'Uñas de Gel (Esculpidas)', duration: 60, price: 35, description: 'Refuerzo o construcción con gel, acabado más natural.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Horario', answer: 'Estamos en el Centro Comercial Islazul (Local 23, Madrid). Abrimos todos los días, L-S de 10h a 20h y Domingos de 11h a 15h.' },
      { icon: 'shield-alt', title: 'Calidad y Seguridad', answer: 'Tu salud es lo primero. Usamos productos 5-Free (libres de tóxicos) y esterilizamos todo nuestro material en autoclave médico.' },
      { icon: 'sparkles', title: 'Nail Art y Diseños', answer: '¡Nos encanta el nail art! Hacemos todo tipo de diseños, desde "efecto espejo" o "baby boomer" hasta dibujos a mano alzada. El precio del diseño es un extra.' },
      { icon: 'calendar-check', title: 'Duración', answer: 'Nuestra manicura semipermanente dura entre 2 y 3 semanas impecable. La retirada en el salón es no invasiva y protege tu uña natural.' }
    ]
  },

  entrenador_personal: {
    services: [
      { name: 'Sesión Personal (1 a 1)', duration: 60, price: 40, description: 'Entrenamiento 100% individualizado y adaptado a tu objetivo.' },
      { name: 'Sesión en Pareja', duration: 60, price: 60, description: 'Entrenamiento para dos personas. ¡Misma intensidad, mitad de precio!' },
      { name: 'Valoración Inicial (Fitness)', duration: 90, price: 60, description: 'Evaluación completa de tu condición física, movilidad y objetivos.' },
      { name: 'Plan Nutricional', duration: 60, price: 50, description: 'Dieta personalizada por nuestro nutricionista deportivo.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Modalidad y Ubicación', answer: '¡Tú eliges! Las sesiones pueden ser en el gimnasio FitZone (Calle Alcalá 200), al aire libre (Parque del Retiro) o 100% online por videollamada.' },
      { icon: 'dumbbell', title: 'Nuestra Especialidad', answer: 'Somos especialistas en recomposición corporal (pérdida de peso y ganancia muscular) y en preparación de oposiciones (policía, bomberos).' },
      { icon: 'user-check', title: '¿Es para mí si soy principiante?', answer: 'Totalmente. La Valoración Inicial es para eso. Adaptamos el plan 100% a tu nivel. Nuestra prioridad es la técnica y evitar lesiones.' },
      { icon: 'gift', title: 'Bonos Ahorro', answer: 'No hay permanencia. Puedes pagar por sesión suelta o ahorrar con nuestros bonos de 10 y 20 sesiones, que no caducan.' }
    ]
  },

  yoga_pilates: {
    services: [
      { name: 'Clase Grupal Yoga', duration: 60, price: 15, description: '1 plaza en nuestras clases de Hatha, Vinyasa o Yin Yoga.' },
      { name: 'Clase Grupal Pilates', duration: 60, price: 15, description: '1 plaza en clase de Pilates Mat (suelo). Grupos reducidos.' },
      { name: 'Clase Privada (Yoga o Pilates)', duration: 60, price: 50, description: 'Sesión 1 a 1, totalmente personalizada, en el estudio o a domicilio.' },
      { name: 'Pilates Reformer (Máquina)', duration: 60, price: 25, description: 'Clase semi-privada (máx 3 personas) con máquina Reformer.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación', answer: 'Estamos en Calle Valencia, 123, en la zona de Eixample, Barcelona.' },
      { icon: 'om', title: 'Nuestros Estilos', answer: 'En Yoga ofrecemos Hatha (pausado), Vinyasa (dinámico) y Yin (relajante). En Pilates tenemos Mat (suelo) y Reformer (máquinas).' },
      { icon: 'user-check', title: '¿Si nunca he hecho?', answer: '¡Este es tu sitio! Tenemos clases de "Iniciación" tanto en Yoga como en Pilates, diseñadas para empezar desde cero y aprender la base correctamente.' },
      { icon: 'shopping-bag', title: 'Qué Traer', answer: 'Solo ropa cómoda. El estudio está equipado con todo lo demás: esterillas (mats) de alta calidad, bloques, cinturones... todo incluido en el precio.' }
    ]
  },

  veterinario: {
    services: [
      { name: 'Consulta General', duration: 30, price: 35, description: 'Revisión veterinaria para cualquier problema de salud (piel, digestivo, etc.).' },
      { name: 'Vacunación', duration: 20, price: 40, description: 'Incluye la vacuna (ej. rabia, trivalente) y una revisión rápida.' },
      { name: 'Revisión Anual', duration: 45, price: 50, description: 'Chequeo completo, desparasitación y calendario vacunal.' },
      { name: 'Peluquería Canina', duration: 60, price: 30, description: 'Servicio de baño, corte y arreglo. Siempre con cita previa.' }
    ],
    info: [
      { icon: 'map-marker-alt', title: 'Ubicación y Acceso', answer: 'Estamos en Avenida Meridiana, 89, Barcelona. Tenemos un parking gratuito para clientes en la misma puerta, para que no tengas que cargar.' },
      { icon: 'ambulance', title: 'Servicio de Urgencias', answer: 'Disponemos de servicio de urgencias 24 horas, los 365 días. El coste de la visita de urgencia (fuera de horario) es de 70€, sin incluir pruebas.' },
      { icon: 'paw', title: 'Animales Atendidos', answer: 'Nuestra clínica está especializada en perros y gatos. También atendemos animales exóticos comunes, como conejos, cobayas y hurones.' },
      { icon: 'hospital', title: 'Instalaciones', answer: 'Contamos con quirófano propio, laboratorio de análisis y diagnóstico por imagen (Rayos X y ecógrafo) para un diagnóstico completo.' }
    ]
  }
};

// ====================================
// AVATARES PREDEFINIDOS - LA-IA
// Cada avatar tiene voz, personalidad y descripción fija
// ====================================

export const AVATARS_PREDEFINIDOS = [
  {
    id: 'carlota',
    name: 'Clara',
    gender: 'female',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_1.png',
    voice_id: 'femenina_1',
    voice_label: 'Cálida y Profesional',
    voice_description: 'Voz cálida, inteligente y que transmite confianza',
    default_description: 'Profesional, amable y siempre dispuesta a ayudar. Inteligente, transmite confianza absoluta. Su voz es cálida y profesional, perfecta para inspirar seguridad en cada interacción. Conoce cada detalle a la perfección.',
    color: {
      primary: 'purple',
      from: 'from-purple-500',
      to: 'to-purple-600',
      bg: 'bg-purple-50',
      border: 'border-purple-400',
      text: 'text-purple-700'
    },
    default_role: 'Agente de Reservas'
  },
  {
    id: 'elena',
    name: 'Lua',
    gender: 'female',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_4.png',
    voice_id: 'femenina_2',
    voice_label: 'Joven y Dinámica',
    voice_description: 'Voz joven, enérgica y proactiva',
    default_description: 'Enérgica, dinámica y con estilo moderno. Su actitud proactiva y voz joven hacen que cada cliente se sienta en buenas manos. Cercana, resolutiva y siempre lista para ayudar con una sonrisa.',
    color: {
      primary: 'blue',
      from: 'from-blue-500',
      to: 'to-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      text: 'text-blue-700'
    },
    default_role: 'Asistente Virtual'
  },
  {
    id: 'carlos',
    name: 'Álex',
    gender: 'male',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_3.png',
    voice_id: 'masculina_1',
    voice_label: 'Amigable y Cercano',
    voice_description: 'Voz amigable, accesible y confiable',
    default_description: 'Amigable, cercano y con una actitud abierta que genera confianza inmediata. Su voz transmite accesibilidad y profesionalismo. Perfecto para crear un ambiente cálido donde cada cliente se siente escuchado.',
    color: {
      primary: 'orange',
      from: 'from-orange-500',
      to: 'to-orange-600',
      bg: 'bg-orange-50',
      border: 'border-orange-400',
      text: 'text-orange-700'
    },
    default_role: 'Agente de Atención'
  },
  {
    id: 'pedro',
    name: 'Hugo',
    gender: 'male',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_2.png',
    voice_id: 'masculina_2',
    voice_label: 'Seguro y Profesional',
    voice_description: 'Voz profesional, clara y que inspira seguridad',
    default_description: 'Experto, seguro y competente. Su presencia inspira confianza absoluta y transmite que "todo está bajo control". Con su voz profesional y clara, gestiona cada situación con maestría y autoridad serena.',
    color: {
      primary: 'green',
      from: 'from-green-500',
      to: 'to-green-600',
      bg: 'bg-green-50',
      border: 'border-green-400',
      text: 'text-green-700'
    },
    default_role: 'Especialista en Reservas'
  }
];

export const getAvatarById = (id) => {
  return AVATARS_PREDEFINIDOS.find(avatar => avatar.id === id) || AVATARS_PREDEFINIDOS[0];
};

export const getAvatarByVoiceId = (voiceId) => {
  return AVATARS_PREDEFINIDOS.find(avatar => avatar.voice_id === voiceId) || AVATARS_PREDEFINIDOS[0];
};



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
    voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_1_Eva_Dorado_RgXx32WYOGrd7gFNifSf.mp3.mp3',
    voice_label: 'Cálida y Profesional',
    voice_description: 'Voz cálida, inteligente y que transmite confianza',
    default_description: 'Profesional, amable y siempre dispuesta a ayudar. Le encanta su trabajo y conoce a la perfección cada detalle del restaurante. Paciente y con una sonrisa permanente, hará que cada cliente se sienta especial.',
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
    id: 'pedro',
    name: 'Hugo',
    gender: 'male',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_4.png',
    voice_id: 'masculina_2',
    voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_2_Danny_wnKyx1zkUEUnfURKiuaP.mp3.mp3',
    voice_label: 'Seguro y Profesional',
    voice_description: 'Voz profesional, clara y que inspira seguridad',
    default_description: 'Atento, servicial y siempre listo para ayudar. Domina cada aspecto del restaurante con profesionalismo impecable. Su paciencia y dedicación garantizan que cada cliente se sienta bien atendido y valorado.',
    color: {
      primary: 'green',
      from: 'from-green-500',
      to: 'to-green-600',
      bg: 'bg-green-50',
      border: 'border-green-400',
      text: 'text-green-700'
    },
    default_role: 'Especialista en Reservas'
  },
  {
    id: 'carlos',
    name: 'Álex',
    gender: 'male',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_3.png',
    voice_id: 'masculina_1',
    voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Male_1_Viraj_iWNf11sz1GrUE4ppxTOL.mp3.mp3',
    voice_label: 'Amigable y Cercano',
    voice_description: 'Voz amigable, accesible y confiable',
    default_description: 'Amable, cercano y genuinamente apasionado por su trabajo. Conoce cada detalle del restaurante y disfruta compartirlo. Con calidez y paciencia, consigue que cada cliente se sienta como en casa y especialmente bienvenido.',
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
    id: 'elena',
    name: 'Lua',
    gender: 'female',
    avatar_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/Avatar/Avatar_2.png',
    voice_id: 'femenina_2',
    voice_sample_url: 'https://zrcsujgurtglyqoqiynr.supabase.co/storage/v1/object/public/voice-demos/Female_2_Susi_v3V1d2rk6528UrLKRuy8.mp3.mp3',
    voice_label: 'Joven y Dinámica',
    voice_description: 'Voz joven, enérgica y proactiva',
    default_description: 'Entusiasta, proactiva y con energía contagiosa. Adora su trabajo y maneja cada detalle del restaurante con precisión. Su actitud positiva y atención personalizada hacen que cada cliente se sienta único y muy bien cuidado.',
    color: {
      primary: 'blue',
      from: 'from-blue-500',
      to: 'to-blue-600',
      bg: 'bg-blue-50',
      border: 'border-blue-400',
      text: 'text-blue-700'
    },
    default_role: 'Asistente Virtual'
  }
];

export const getAvatarById = (id) => {
  return AVATARS_PREDEFINIDOS.find(avatar => avatar.id === id) || AVATARS_PREDEFINIDOS[0];
};

export const getAvatarByVoiceId = (voiceId) => {
  return AVATARS_PREDEFINIDOS.find(avatar => avatar.voice_id === voiceId) || AVATARS_PREDEFINIDOS[0];
};



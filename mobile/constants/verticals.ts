export const VERTICALS = [
  {
    id: 'fisioterapia',
    name: 'Fisioterapia',
    icon: '🏃',
    description: 'Consultas y tratamientos de fisioterapia',
    defaultServices: [
      { name: 'Sesión de fisioterapia', duration: 60, price: 45 },
      { name: 'Valoración inicial', duration: 45, price: 35 },
      { name: 'Tratamiento deportivo', duration: 75, price: 55 },
    ],
  },
  {
    id: 'psicologia',
    name: 'Psicología',
    icon: '🧠',
    description: 'Terapia psicológica individual y familiar',
    defaultServices: [
      { name: 'Sesión individual', duration: 60, price: 60 },
      { name: 'Primera consulta', duration: 90, price: 80 },
      { name: 'Terapia de pareja', duration: 90, price: 90 },
    ],
  },
  {
    id: 'masajes_osteopatia',
    name: 'Masajes / Osteopatía',
    icon: '💆',
    description: 'Masajes terapéuticos y osteopatía',
    defaultServices: [
      { name: 'Masaje relajante', duration: 60, price: 50 },
      { name: 'Masaje deportivo', duration: 60, price: 55 },
      { name: 'Sesión de osteopatía', duration: 60, price: 65 },
    ],
  },
  {
    id: 'odontologia',
    name: 'Odontología',
    icon: '🦷',
    description: 'Clínicas dentales y ortodoncias',
    defaultServices: [
      { name: 'Revisión general', duration: 30, price: 30 },
      { name: 'Limpieza dental', duration: 45, price: 50 },
      { name: 'Empaste', duration: 60, price: 80 },
    ],
  },
  {
    id: 'estetica',
    name: 'Estética',
    icon: '💅',
    description: 'Centros de belleza y estética',
    defaultServices: [
      { name: 'Manicura', duration: 45, price: 25 },
      { name: 'Pedicura', duration: 60, price: 35 },
      { name: 'Tratamiento facial', duration: 75, price: 65 },
    ],
  },
  {
    id: 'peluqueria',
    name: 'Peluquería',
    icon: '💇',
    description: 'Salones de peluquería y barbería',
    defaultServices: [
      { name: 'Corte de pelo', duration: 30, price: 25 },
      { name: 'Tinte', duration: 90, price: 60 },
      { name: 'Peinado', duration: 45, price: 35 },
    ],
  },
  {
    id: 'otros',
    name: 'Otros',
    icon: '📋',
    description: 'Otros servicios profesionales',
    defaultServices: [
      { name: 'Sesión estándar', duration: 60, price: 50 },
    ],
  },
];

export const getVerticalById = (id: string) => {
  return VERTICALS.find((v) => v.id === id) || VERTICALS[VERTICALS.length - 1];
};


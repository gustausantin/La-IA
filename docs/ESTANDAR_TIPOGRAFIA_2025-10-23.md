# 📐 ESTÁNDAR DE TIPOGRAFÍA Y ESPACIADO - SON-IA
**Fecha:** 23 Octubre 2025  
**Basado en:** Comunicacion.jsx (página de referencia)

---

## 🎯 PROBLEMA DETECTADO

Las páginas tienen tamaños inconsistentes:
- ❌ **Dashboard, Reservas, No-Shows**: Texto MUY GRANDE, sobredimensionado
- ✅ **Comunicación**: Tamaño PERFECTO, compacto y profesional

---

## ✅ ESTÁNDAR A APLICAR (BASADO EN COMUNICACIÓN)

### **📝 TIPOGRAFÍA:**

```css
/* TÍTULOS PRINCIPALES (H1) */
text-xl font-bold          /* Ej: "Centro de Comunicación", "Gestión de Reservas" */

/* SUBTÍTULOS (H2) */
text-base font-semibold    /* Ej: Secciones, Cards principales */

/* SUBTÍTULOS PEQUEÑOS (H3) */
text-sm font-medium        /* Ej: Nombres de campos, labels importantes */

/* TEXTO NORMAL (Body) */
text-xs                    /* Ej: Descripciones, párrafos, contenido general */

/* TEXTO SECUNDARIO (Metadata) */
text-xs text-gray-500      /* Ej: "hace 2 horas", timestamps, hints */

/* BADGES Y PILLS */
text-xs px-2 py-0.5        /* Ej: "IA Activa", status badges */
```

---

### **📏 ESPACIADO:**

```css
/* PADDING DE CARDS */
p-3                        /* Cards pequeños */
p-4                        /* Cards medianos */
p-6                        /* Cards grandes (solo headers principales) */

/* GAPS ENTRE ELEMENTOS */
gap-1.5                    /* Elementos muy juntos */
gap-2                      /* Elementos normales */
gap-3                      /* Elementos espaciados (tabs) */

/* MARGINS ENTRE SECCIONES */
mb-2                       /* Entre elementos pequeños */
mb-3                       /* Entre cards */
mb-4                       /* Entre secciones */
```

---

### **🎨 ICONOS:**

```css
/* ICONOS PEQUEÑOS (inline con texto) */
w-4 h-4                    /* Ej: Iconos junto a labels */

/* ICONOS NORMALES (standalone) */
w-5 h-5                    /* Ej: Iconos de canales, acciones */

/* ICONOS GRANDES (headers) */
w-6 h-6                    /* Solo para headers principales */
```

---

### **🔘 BOTONES:**

```css
/* BOTONES PRINCIPALES (CTA) */
px-8 py-4 text-base font-semibold rounded-xl    /* Tabs activos */

/* BOTONES SECUNDARIOS */
px-4 py-2 text-sm font-medium rounded-lg        /* Botones de acción */

/* BOTONES PEQUEÑOS */
px-3 py-1.5 text-xs font-medium rounded-md      /* Botones inline */
```

---

## 🚫 LO QUE HAY QUE CAMBIAR EN OTRAS PÁGINAS

### **❌ ANTES (Demasiado grande):**
```css
text-3xl font-bold         /* Títulos gigantes */
text-2xl                   /* Subtítulos muy grandes */
text-base                  /* Texto normal demasiado grande */
p-8                        /* Padding excesivo */
gap-6                      /* Gaps enormes */
w-8 h-8                    /* Iconos gigantes */
```

### **✅ DESPUÉS (Compacto como Comunicación):**
```css
text-xl font-bold          /* Títulos apropiados */
text-base font-semibold    /* Subtítulos proporcionados */
text-xs                    /* Texto normal compacto */
p-3, p-4                   /* Padding apropiado */
gap-2, gap-3               /* Gaps correctos */
w-4 h-4, w-5 h-5           /* Iconos proporcionados */
```

---

## 📄 EJEMPLO: HEADER DE PÁGINA

### **✅ CORRECTO (Como Comunicación):**
```jsx
<div className="max-w-[85%] mx-auto px-4 py-4">
    <div className="flex items-center gap-3 mb-3">
        <div className="p-2.5 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
            <Icon className="w-5 h-5 text-white" />
        </div>
        <div>
            <h1 className="text-xl font-bold text-gray-900">
                Título de Página
            </h1>
            <p className="text-xs text-gray-600 mt-0.5">
                Descripción breve de la página
            </p>
        </div>
    </div>
</div>
```

---

## 📊 STATS CARDS

### **✅ CORRECTO (Compacto):**
```jsx
<div className="bg-white p-3 rounded-md border border-gray-200">
    <div className="flex items-center justify-between">
        <div>
            <p className="text-xs text-gray-600">Métrica</p>
            <p className="text-lg font-bold text-gray-900">123</p>
        </div>
        <Icon className="w-5 h-5 text-purple-600" />
    </div>
</div>
```

---

## 🎯 PÁGINAS A ACTUALIZAR

- [ ] Dashboard principal
- [ ] Reservas.jsx
- [ ] NoShowControlNuevo.jsx
- [ ] DashboardAgente.jsx
- [ ] Mesas.jsx
- [ ] Calendario.jsx
- [ ] Clientes.jsx
- [ ] Analytics.jsx

---

**FIN DEL ESTÁNDAR** 📐



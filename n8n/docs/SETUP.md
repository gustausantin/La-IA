# 🛠️ SETUP - N8N PARA LA-IA

Guía paso a paso para configurar n8n y los workflows del Super Agente.

---

## 📋 REQUISITOS

- n8n instalado y funcionando
- Acceso a Supabase
- API Key de OpenAI
- (Opcional) VAPI configurado
- (Opcional) WhatsApp Business API

---

## 1. INSTALAR N8N

### Opción A: Docker (Recomendada)

```bash
docker run -it --rm \
  --name n8n \
  -p 5678:5678 \
  -v ~/.n8n:/home/node/.n8n \
  n8nio/n8n
```

### Opción B: NPM

```bash
npm install n8n -g
n8n start
```

Accede a: `http://localhost:5678`

---

## 2. CONFIGURAR CREDENCIALES

### 2.1 Supabase

1. En n8n: `Credentials` > `New` > `Supabase`
2. Completa:
   - **Name:** `Supabase La-IA`
   - **URL:** `https://ktsqwvhqamedpmzkzjaz.supabase.co`
   - **API Key:** Tu `anon key` de Supabase
   - **Service Role Key:** (Opcional) Para operaciones admin

### 2.2 OpenAI

1. En n8n: `Credentials` > `New` > `OpenAI`
2. Completa:
   - **Name:** `OpenAI La-IA`
   - **API Key:** Tu API key de OpenAI

### 2.3 VAPI (si aplica)

1. En n8n: `Credentials` > `New` > `HTTP Header Auth`
2. Completa:
   - **Name:** `VAPI Auth`
   - **Header Name:** `Authorization`
   - **Header Value:** `Bearer YOUR_VAPI_KEY`

---

## 3. IMPORTAR WORKFLOWS

### 3.1 Workflow VAPI Existente

1. Copia tu JSON actual de VAPI
2. Pégalo en: `n8n/workflows/vapi-integration.json`
3. En n8n: `Workflows` > `Import from File`
4. Selecciona el archivo
5. Configura credenciales

### 3.2 Workflow Super Agent (Próximamente)

Espera a que esté listo el workflow completo.

---

## 4. CREAR RPC FUNCTIONS EN SUPABASE

Ejecuta estos SQL en Supabase SQL Editor:

### 4.1 check_availability_for_agent

```sql
CREATE OR REPLACE FUNCTION check_availability_for_agent(
    p_restaurant_id UUID,
    p_date DATE,
    p_time TIME,
    p_party_size INTEGER
)
RETURNS JSONB AS $$
-- [Ver código completo en AUDITORIA_Y_ARQUITECTURA_SUPER_AGENTE_N8N.md]
$$ LANGUAGE plpgsql;
```

### 4.2 find_reservation_by_phone

```sql
CREATE OR REPLACE FUNCTION find_reservation_by_phone(
    p_restaurant_id UUID,
    p_phone VARCHAR,
    p_date_from DATE DEFAULT CURRENT_DATE
)
RETURNS TABLE (...) AS $$
-- [Ver código completo en AUDITORIA_Y_ARQUITECTURA_SUPER_AGENTE_N8N.md]
$$ LANGUAGE plpgsql;
```

### 4.3 get_restaurant_info_for_agent

```sql
CREATE OR REPLACE FUNCTION get_restaurant_info_for_agent(
    p_restaurant_id UUID
)
RETURNS JSONB AS $$
-- [Ver código completo en AUDITORIA_Y_ARQUITECTURA_SUPER_AGENTE_N8N.md]
$$ LANGUAGE plpgsql;
```

---

## 5. TESTING

Ver: `docs/TESTING.md`

---

## 🎉 ¡LISTO!

Ya tienes n8n configurado para La-IA.

**Siguiente paso:** Importar tu workflow VAPI existente.


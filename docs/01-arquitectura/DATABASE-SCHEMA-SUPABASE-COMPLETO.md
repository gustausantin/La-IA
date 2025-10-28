# 📊 ESQUEMA COMPLETO BASE DE DATOS SUPABASE - LA-IA APP

> **Fecha:** 14 de Octubre 2025  
> **Fuente:** Export directo desde `information_schema.columns`  
> **Estado:** ✅ **COMPLETO Y VERIFICADO**  
> **Total Tablas:** 46 tablas + 1 vista  
> **Última actualización:** Agregada tabla `crm_interactions` para sistema de feedback

---

## 📋 ÍNDICE ALFABÉTICO DE TABLAS

1. [agent_conversations](#1-agent_conversations) - Conversaciones del agente AI
2. [agent_insights](#2-agent_insights) - Insights generados por IA
3. [agent_messages](#3-agent_messages) - Mensajes individuales
4. [agent_metrics](#4-agent_metrics) - Métricas del agente
5. [ai_conversation_insights](#5-ai_conversation_insights) - Análisis IA conversaciones
6. [analytics](#6-analytics) - Analytics generales
7. [analytics_historical](#7-analytics_historical) - Analytics históricos
8. [automation_rule_executions](#8-automation_rule_executions) - Ejecuciones CRM
9. [automation_rules](#9-automation_rules) - Reglas automatización CRM
10. [availability_change_log](#10-availability_change_log) - Log cambios disponibilidad
11. [availability_slots](#11-availability_slots) - Slots disponibilidad
12. [billing_tickets](#12-billing_tickets) - Tickets TPV
13. [channel_credentials](#13-channel_credentials) - Credenciales canales
14. [channel_performance](#14-channel_performance) - Performance canales
15. [conversation_analytics](#15-conversation_analytics) - Analytics conversaciones
16. [crm_settings](#16-crm_settings) - Configuración CRM
17. [crm_suggestions](#17-crm_suggestions) - Sugerencias CRM
18. [crm_templates](#18-crm_templates) - Plantillas CRM
19. [crm_interactions](#19-crm_interactions) - ✨ **Interacciones CRM (NUEVO)**
20. [crm_v2_dashboard](#20-crm_v2_dashboard) - Dashboard CRM v2 (VISTA)
21. [customer_feedback](#21-customer_feedback) - Feedback clientes
21. [customer_interactions](#21-customer_interactions) - Interacciones clientes
22. [customers](#22-customers) - **Base clientes**
23. [daily_metrics](#23-daily_metrics) - Métricas diarias
24. [interaction_logs](#24-interaction_logs) - Logs interacciones
25. [inventory](#25-inventory) - Inventario (legacy)
26. [inventory_items](#26-inventory_items) - Inventario items
27. [menu_items](#27-menu_items) - Items menú
28. [message_templates](#28-message_templates) - Plantillas mensajes
29. [noshow_actions](#29-noshow_actions) - Acciones no-show
30. [notifications](#30-notifications) - Notificaciones
31. [profiles](#31-profiles) - Perfiles usuarios
32. [reservations](#32-reservations) - **Reservas**
33. [reservations_with_customer](#33-reservations_with_customer) - Reservas + Cliente (VISTA)
34. [restaurant_business_config](#34-restaurant_business_config) - Config negocio
35. [restaurant_operating_hours](#35-restaurant_operating_hours) - Horarios operativos
36. [restaurant_settings](#36-restaurant_settings) - Settings restaurante
37. [restaurant_shifts](#37-restaurant_shifts) - Turnos restaurante
38. [businesses](#38-businesses) - **Restaurantes**
39. [scheduled_messages](#39-scheduled_messages) - Mensajes programados
40. [special_events](#40-special_events) - Eventos especiales
41. [staff](#41-staff) - Personal
42. [tables](#42-tables) - **Mesas**
43. [template_variables](#43-template_variables) - Variables plantillas
44. [user_restaurant_mapping](#44-user_restaurant_mapping) - Mapeo usuarios
45. [whatsapp_message_buffer](#45-whatsapp_message_buffer) - **Buffer WhatsApp**

---

## 🎯 TABLAS CORE PARA N8N AI AGENT

### 1. agent_conversations

**Propósito:** Almacena cada conversación del agente AI con clientes (WhatsApp, VAPI, Instagram, etc.)

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `customer_id` | uuid | YES | - | FK → customers (nullable) |
| `customer_phone` | varchar | NO | - | **Teléfono cliente** |
| `customer_name` | varchar | YES | - | Nombre cliente |
| `customer_email` | varchar | YES | - | Email cliente |
| `source_channel` | varchar | NO | - | **whatsapp, vapi, instagram, facebook, web** |
| `interaction_type` | varchar | NO | - | **nueva_reserva, modificar, cancelar, consulta** |
| `status` | varchar | NO | `'active'` | active, resolved, abandoned |
| `outcome` | varchar | YES | - | Resultado final |
| `reservation_id` | uuid | YES | - | FK → reservations |
| `created_at` | timestamptz | NO | `now()` | Fecha inicio |
| `resolved_at` | timestamptz | YES | - | Fecha fin |
| `resolution_time_seconds` | int | YES | - | Duración (segundos) |
| `sentiment` | varchar | YES | - | positive, neutral, negative |
| `metadata` | jsonb | YES | `'{}'` | Datos adicionales |

**Índices sugeridos:**
- `restaurant_id, created_at DESC`
- `customer_phone, created_at DESC`
- `source_channel, status`

---

### 2. agent_insights

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | YES | - |
| `type` | varchar | YES | - |
| `title` | varchar | YES | - |
| `description` | text | YES | - |
| `priority` | varchar | YES | `'medium'` |
| `action_required` | boolean | YES | `false` |
| `data` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | YES | `now()` |
| `resolved_at` | timestamptz | YES | - |

---

### 3. agent_messages

**Propósito:** Mensajes individuales dentro de conversaciones

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `conversation_id` | uuid | NO | - | FK → agent_conversations |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `direction` | varchar | NO | - | **inbound / outbound** |
| `sender` | varchar | NO | - | **customer / agent** |
| `message_text` | text | NO | - | Texto mensaje |
| `timestamp` | timestamptz | NO | `now()` | Fecha/hora |
| `metadata` | jsonb | YES | `'{}'` | Metadata |
| `tokens_used` | int | YES | - | Tokens OpenAI |
| `confidence_score` | numeric | YES | - | Score confianza (0-1) |

---

### 4. agent_metrics

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | YES | - |
| `date` | date | YES | `CURRENT_DATE` |
| `total_conversations` | int | YES | `0` |
| `successful_bookings` | int | YES | `0` |
| `avg_response_time` | float8 | YES | `0` |
| `conversion_rate` | float8 | YES | `0` |
| `customer_satisfaction` | float8 | YES | `0` |
| `channel_breakdown` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

---

### 5. ai_conversation_insights

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `conversation_id` | uuid | NO | - |
| `restaurant_id` | uuid | NO | - |
| `sentiment` | varchar | YES | - |
| `intent` | varchar | YES | - |
| `confidence_score` | numeric | YES | - |
| `key_topics` | text[] | YES | - |
| `suggested_actions` | text[] | YES | - |
| `urgency_level` | int | YES | `1` |
| `customer_satisfaction_predicted` | numeric | YES | - |
| `analysis_metadata` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

---

### 6. analytics

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `type` | varchar | NO | - |
| `date` | date | NO | - |
| `value` | numeric | NO | - |
| `metadata` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 7. analytics_historical

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `metric_type` | text | NO | - |
| `metric_name` | text | NO | - |
| `metric_value` | numeric | NO | - |
| `dimension1` | text | YES | - |
| `dimension1_value` | text | YES | - |
| `dimension2` | text | YES | - |
| `dimension2_value` | text | YES | - |
| `period_type` | text | NO | - |
| `period_start` | timestamptz | NO | - |
| `period_end` | timestamptz | NO | - |
| `metadata` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 8. automation_rule_executions

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `rule_id` | uuid | NO | - |
| `customer_id` | uuid | NO | - |
| `executed_at` | timestamptz | YES | `timezone('utc', now())` |
| `status` | varchar | NO | `'pending'` |
| `result_data` | jsonb | YES | `'{}'` |
| `error_message` | text | YES | - |
| `interaction_id` | uuid | YES | - |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 9. automation_rules

**Propósito:** Reglas de automatización CRM

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `name` | varchar | NO | - |
| `description` | text | YES | - |
| `is_active` | boolean | YES | `true` |
| `rule_type` | varchar | YES | - |
| `trigger_condition` | jsonb | NO | `'{}'` |
| `trigger_event` | text | NO | `'manual'` |
| `trigger_conditions_v2` | jsonb | YES | `'{}'` |
| `action_type` | varchar | YES | - |
| `action_config` | jsonb | NO | `'{}'` |
| `target_segment` | text | YES | - |
| `template_id` | uuid | YES | - |
| `cooldown_days` | int | YES | `30` |
| `max_executions_per_customer` | int | YES | `3` |
| `max_daily_executions` | int | YES | `50` |
| `execution_window_days` | int | YES | `90` |
| `execution_hours_start` | time | YES | `'09:00:00'` |
| `execution_hours_end` | time | YES | `'21:00:00'` |
| `execution_days_of_week` | int[] | YES | `ARRAY[1,2,3,4,5,6,7]` |
| `aivi_config` | jsonb | YES | `'{}'` |
| `execution_stats` | jsonb | YES | `'{}'` |
| `created_by` | uuid | YES | - |
| `last_executed_at` | timestamptz | YES | - |
| `last_optimization_at` | timestamptz | YES | - |
| `total_executions` | int | YES | `0` |
| `successful_executions` | int | YES | `0` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 10. availability_change_log

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `change_type` | text | NO | - |
| `change_description` | text | NO | - |
| `old_values` | jsonb | YES | `'{}'` |
| `new_values` | jsonb | YES | `'{}'` |
| `affected_tables` | text[] | YES | `ARRAY[]::text[]` |
| `requires_regeneration` | boolean | YES | `true` |
| `regeneration_completed` | boolean | YES | `false` |
| `regeneration_completed_at` | timestamptz | YES | - |
| `created_by` | uuid | YES | - |
| `created_at` | timestamptz | YES | `now()` |
| `processed_at` | timestamptz | YES | - |
| `affected_dates_start` | date | YES | - |
| `affected_dates_end` | date | YES | - |

---

### 11. availability_slots

**Propósito:** Slots de disponibilidad generados automáticamente

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `slot_date` | date | NO | - | **Fecha del slot** |
| `start_time` | time | NO | - | **Hora inicio** |
| `end_time` | time | NO | - | **Hora fin** |
| `table_id` | uuid | NO | - | FK → tables |
| `shift_name` | text | YES | - | Nombre turno |
| `status` | text | NO | `'free'` | **free, reserved, blocked** |
| `source` | text | YES | `'system'` | system, manual |
| `is_available` | boolean | YES | `true` | Disponible |
| `duration_minutes` | int | YES | `90` | Duración |
| `metadata` | jsonb | YES | `'{}'` | Metadata |
| `created_at` | timestamptz | YES | `now()` | Fecha creación |
| `updated_at` | timestamptz | YES | `now()` | Fecha actualización |

**Índices críticos:**
- `restaurant_id, slot_date, start_time`
- `table_id, slot_date, status`

---

### 12. billing_tickets

**Propósito:** Tickets TPV vinculados a reservas/clientes

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `reservation_id` | uuid | YES | - |
| `table_id` | uuid | YES | - |
| `customer_id` | uuid | YES | - |
| `ticket_number` | varchar | NO | - |
| `external_ticket_id` | varchar | YES | - |
| `ticket_date` | timestamptz | NO | `now()` |
| `service_start` | timestamptz | YES | - |
| `service_end` | timestamptz | YES | - |
| `items` | jsonb | NO | `'[]'` |
| `subtotal` | numeric | NO | `0` |
| `tax_amount` | numeric | NO | `0` |
| `discount_amount` | numeric | NO | `0` |
| `total_amount` | numeric | NO | `0` |
| `payment_method` | varchar | YES | - |
| `tip_amount` | numeric | YES | `0` |
| `covers_count` | int | YES | `1` |
| `mesa_number` | varchar | YES | - |
| `waiter_name` | varchar | YES | - |
| `kitchen_notes` | text | YES | - |
| `special_requests` | text | YES | - |
| `source_system` | varchar | YES | - |
| `source_data` | jsonb | YES | - |
| `is_processed` | boolean | YES | `false` |
| `auto_matched` | boolean | YES | `false` |
| `confidence_score` | numeric | YES | `1.0` |
| `matching_notes` | text | YES | - |
| `processing_errors` | text | YES | - |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

---

### 13. channel_credentials

**Propósito:** Credenciales de canales (WhatsApp, Instagram, etc.)

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `channel` | text | NO | - |
| `is_active` | boolean | YES | `false` |
| `credentials` | jsonb | NO | `'{}'` |
| `config` | jsonb | YES | `'{}'` |
| `last_test_at` | timestamptz | YES | - |
| `last_test_success` | boolean | YES | - |
| `last_test_error` | text | YES | - |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 14. channel_performance

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | YES | - |
| `channel` | varchar | YES | - |
| `date` | date | YES | `CURRENT_DATE` |
| `conversations` | int | YES | `0` |
| `bookings` | int | YES | `0` |
| `conversion_rate` | float8 | YES | `0` |
| `avg_response_time` | float8 | YES | `0` |
| `customer_satisfaction` | float8 | YES | `0` |
| `created_at` | timestamptz | YES | `now()` |

---

### 15. conversation_analytics

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `conversation_id` | uuid | YES | - |
| `restaurant_id` | uuid | YES | - |
| `total_messages` | int | YES | `0` |
| `ai_messages` | int | YES | `0` |
| `human_messages` | int | YES | `0` |
| `avg_response_time` | float8 | YES | `0` |
| `intent_detected` | varchar | YES | - |
| `sentiment_score` | float8 | YES | `0` |
| `topics` | jsonb | YES | `'[]'` |
| `created_at` | timestamptz | YES | `now()` |

---

### 16. crm_settings

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `days_new_customer` | int | YES | `7` |
| `days_active_customer` | int | YES | `30` |
| `days_inactive_customer` | int | YES | `60` |
| `visits_bib_customer` | int | YES | `10` |
| `days_risk_customer` | int | YES | `45` |
| `frequency_reactivation` | int | YES | `90` |
| `frequency_welcome` | int | YES | `1` |
| `frequency_bib_promotion` | int | YES | `180` |
| `auto_suggestions` | boolean | YES | `true` |
| `auto_segmentation` | boolean | YES | `true` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 17. crm_suggestions

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `customer_id` | uuid | NO | - |
| `template_id` | uuid | YES | - |
| `type` | varchar | NO | - |
| `priority` | varchar | YES | `'medium'` |
| `title` | varchar | NO | - |
| `description` | text | YES | - |
| `status` | varchar | YES | `'pending'` |
| `suggested_at` | timestamptz | YES | `timezone('utc', now())` |
| `executed_at` | timestamptz | YES | - |
| `suggested_subject` | varchar | YES | - |
| `suggested_content` | text | YES | - |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 18. crm_templates

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `name` | varchar | NO | - |
| `type` | varchar | NO | - |
| `subject` | varchar | NO | - |
| `content` | text | NO | - |
| `variables` | jsonb | YES | `'[]'` |
| `active` | boolean | YES | `true` |
| `priority` | int | YES | `1` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 19. crm_interactions ✨ **NUEVO**

**Propósito:** Registro de todas las interacciones del CRM con clientes (campañas de feedback, recordatorios, reactivación, etc.)

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | ID único |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `customer_id` | uuid | NO | - | FK → customers |
| `interaction_type` | varchar | NO | - | Tipo: feedback, bienvenida, reactivacion, vip_upgrade, recordatorio, marketing, manual |
| `campaign_id` | varchar | YES | - | ID de campaña (ej: feedback_post_visit_day1) |
| `campaign_name` | varchar | YES | - | Nombre descriptivo de la campaña |
| `channel` | varchar | NO | - | Canal: whatsapp, email, sms, phone, push |
| `message_text` | text | NO | - | Mensaje enviado al cliente |
| `message_template_id` | varchar | YES | - | ID de plantilla usada |
| `status` | varchar | NO | `'sent'` | Estado: sent, delivered, read, responded, bounced, failed |
| `customer_responded` | boolean | YES | `false` | ¿Cliente respondió? |
| `response_received_at` | timestamptz | YES | - | Cuándo respondió |
| `response_conversation_id` | uuid | YES | - | FK → agent_conversations (si respondió) |
| `metadata` | jsonb | YES | `'{}'` | Datos adicionales (reservation_id, etc.) |
| `created_at` | timestamptz | NO | `NOW()` | Fecha creación |
| `updated_at` | timestamptz | NO | `NOW()` | Fecha actualización |
| `sent_at` | timestamptz | YES | - | Cuándo se envió |
| `delivered_at` | timestamptz | YES | - | Cuándo se entregó |
| `read_at` | timestamptz | YES | - | Cuándo se leyó |

**Índices:**
- `idx_crm_interactions_restaurant_type` - (restaurant_id, interaction_type, created_at DESC)
- `idx_crm_interactions_customer` - (customer_id, created_at DESC)
- `idx_crm_interactions_campaign` - (campaign_id, created_at DESC)
- `idx_crm_interactions_status` - (restaurant_id, status, created_at DESC)
- `idx_crm_interactions_response` - (restaurant_id, customer_responded, created_at DESC)
- `idx_crm_interactions_metadata` - GIN (metadata)

**Función helper:** `log_crm_interaction()` - Registrar interacciones fácilmente desde workflows

**RLS:** ✅ Habilitado (aislamiento por tenant)

**Uso:**
- Campañas de feedback post-visita
- Mensajes de bienvenida a nuevos clientes
- Reactivación de clientes inactivos
- Recordatorios de reservas
- Promociones y marketing
- Tracking de tasa de respuesta

---

### 20. crm_v2_dashboard

**Tipo:** VISTA (no tabla física)

| Columna | Tipo | NULL |
|---------|------|------|
| `restaurant_id` | uuid | YES |
| `nuevos` | bigint | YES |
| `activos` | bigint | YES |
| `en_riesgo` | bigint | YES |
| `inactivos` | bigint | YES |
| `vips` | bigint | YES |
| `aivi_promedio` | numeric | YES |
| `recencia_promedio` | numeric | YES |
| `gasto_promedio_12m` | numeric | YES |
| `visitas_promedio_12m` | numeric | YES |
| `tickets_vinculados` | bigint | YES |
| `confianza_promedio_matching` | numeric | YES |
| `ultima_actualizacion` | timestamptz | YES |

---

### 20. customer_feedback

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `conversation_id` | uuid | NO | - |
| `restaurant_id` | uuid | NO | - |
| `customer_id` | uuid | NO | - |
| `rating` | int | YES | - |
| `feedback_text` | text | YES | - |
| `feedback_type` | varchar | YES | `'satisfaction'` |
| `resolved` | boolean | YES | `false` |
| `response_text` | text | YES | - |
| `responded_by` | uuid | YES | - |
| `responded_at` | timestamptz | YES | - |
| `created_at` | timestamptz | YES | `now()` |

---

### 21. customer_interactions

**Propósito:** Log de interacciones enviadas a clientes (CRM)

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `customer_id` | uuid | NO | - |
| `channel` | varchar | NO | - |
| `template_id` | uuid | YES | - |
| `interaction_type` | varchar | NO | - |
| `subject` | text | YES | - |
| `content` | text | NO | - |
| `payload` | jsonb | YES | `'{}'` |
| `status` | varchar | NO | `'pending'` |
| `sent_at` | timestamptz | YES | - |
| `delivered_at` | timestamptz | YES | - |
| `opened_at` | timestamptz | YES | - |
| `clicked_at` | timestamptz | YES | - |
| `replied_at` | timestamptz | YES | - |
| `external_id` | varchar | YES | - |
| `error_message` | text | YES | - |
| `retry_count` | int | YES | `0` |
| `metadata` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 22. customers

**Propósito:** 🔥 **BASE DE DATOS DE CLIENTES** (CRM central)

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | **PK** |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `name` | varchar | NO | - | Nombre completo |
| `email` | varchar | YES | - | Email |
| `phone` | varchar | YES | - | Teléfono |
| `first_name` | varchar | YES | - | Nombre |
| `last_name1` | varchar | YES | - | Primer apellido |
| `last_name2` | varchar | YES | - | Segundo apellido |
| `birthday` | date | YES | - | Cumpleaños |
| `preferences` | jsonb | YES | `'{}'` | Preferencias |
| `tags` | text[] | YES | - | Etiquetas |
| `notes` | text | YES | - | Notas internas |
| `total_visits` | int | YES | `0` | Total visitas |
| `total_spent` | numeric | YES | `0` | Total gastado |
| `last_visit` | timestamptz | YES | - | Última visita |
| `visits_count` | int | YES | `0` | Contador visitas |
| `last_visit_at` | timestamptz | YES | - | Última visita |
| `avg_ticket` | numeric | YES | `0.00` | Ticket promedio |
| `preferred_items` | jsonb | YES | `'[]'` | Items preferidos |
| `segment_manual` | varchar | YES | - | Segmento manual |
| `segment_auto` | varchar | YES | `'nuevo'` | Segmento automático |
| `segment_auto_v2` | varchar | YES | `'nuevo'` | Segmento v2 |
| `consent_email` | boolean | YES | `true` | Consentimiento email |
| `consent_sms` | boolean | YES | `true` | Consentimiento SMS |
| `consent_whatsapp` | boolean | YES | `false` | Consentimiento WhatsApp |
| `last_contacted_at` | timestamptz | YES | - | Último contacto |
| `last_interaction_at` | timestamptz | YES | - | Última interacción |
| `interaction_count` | int | YES | `0` | Contador interacciones |
| `next_action_at` | timestamptz | YES | - | Próxima acción |
| `churn_risk_score` | int | YES | `0` | Score riesgo abandono |
| `predicted_ltv` | numeric | YES | `0.00` | LTV predicho |
| `notifications_enabled` | boolean | YES | `true` | Notificaciones activas |
| `preferred_channel` | text | YES | `'whatsapp'` | Canal preferido |
| `aivi_days` | numeric | YES | `30.0` | AIVI (días entre visitas) |
| `recency_days` | int | YES | `0` | Días desde última visita |
| `visits_12m` | int | YES | `0` | Visitas últimos 12 meses |
| `total_spent_12m` | numeric | YES | `0` | Gasto últimos 12 meses |
| `top_dishes` | jsonb | YES | `'[]'` | Platos favoritos |
| `top_categories` | jsonb | YES | `'[]'` | Categorías favoritas |
| `fav_weekday` | int | YES | `6` | Día semana favorito (0-6) |
| `fav_hour_block` | int | YES | `20` | Hora favorita (0-23) |
| `is_vip_calculated` | boolean | YES | `false` | Es VIP (calculado) |
| `features_updated_at` | timestamptz | YES | `now()` | Última actualización features |
| `created_at` | timestamptz | NO | `timezone('utc', now())` | Fecha creación |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` | Fecha actualización |

**Índices críticos:**
- `restaurant_id, phone` (UNIQUE)
- `restaurant_id, email`
- `restaurant_id, segment_auto_v2`

---

### 23. daily_metrics

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `date` | date | NO | - |
| `total_reservations` | int | YES | `0` |
| `confirmed_reservations` | int | YES | `0` |
| `cancelled_reservations` | int | YES | `0` |
| `no_shows` | int | YES | `0` |
| `walk_ins` | int | YES | `0` |
| `total_customers` | int | YES | `0` |
| `new_customers` | int | YES | `0` |
| `returning_customers` | int | YES | `0` |
| `table_utilization_rate` | numeric | YES | `0` |
| `average_party_size` | numeric | YES | `0` |
| `peak_hour_start` | time | YES | - |
| `peak_hour_end` | time | YES | - |
| `total_revenue` | numeric | YES | `0` |
| `average_spend_per_customer` | numeric | YES | `0` |
| `customer_satisfaction_score` | numeric | YES | - |
| `staff_efficiency_score` | numeric | YES | - |
| `notes` | text | YES | - |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 24. interaction_logs

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `customer_id` | uuid | NO | - |
| `scheduled_message_id` | uuid | YES | - |
| `interaction_type` | text | NO | - |
| `channel` | text | NO | - |
| `subject` | text | YES | - |
| `content_preview` | text | YES | - |
| `provider_message_id` | text | YES | - |
| `provider_response` | jsonb | YES | - |
| `metadata` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `created_by_user` | uuid | YES | - |
| `ip_address` | inet | YES | - |
| `user_agent` | text | YES | - |

---

### 25. inventory

**Nota:** Legacy (usar `inventory_items`)

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `name` | varchar | NO | - |
| `category` | varchar | YES | - |
| `quantity` | numeric | NO | `0` |
| `unit` | varchar | YES | - |
| `min_threshold` | numeric | YES | - |
| `cost_per_unit` | numeric | YES | - |
| `supplier` | varchar | YES | - |
| `last_updated` | timestamptz | NO | `timezone('utc', now())` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 26. inventory_items

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `name` | text | NO | - |
| `category` | text | NO | - |
| `description` | text | YES | - |
| `unit` | text | NO | - |
| `current_stock` | numeric | YES | `0` |
| `minimum_stock` | numeric | YES | `0` |
| `maximum_stock` | numeric | YES | - |
| `cost_per_unit` | numeric | YES | `0` |
| `supplier` | text | YES | - |
| `supplier_contact` | jsonb | YES | `'{}'` |
| `barcode` | text | YES | - |
| `location` | text | YES | - |
| `expiration_date` | date | YES | - |
| `last_restocked` | timestamptz | YES | - |
| `status` | text | YES | `'active'` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 27. menu_items

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `name` | varchar | NO | - |
| `description` | text | YES | - |
| `category` | varchar | NO | - |
| `price` | numeric | NO | - |
| `cost` | numeric | YES | - |
| `is_available` | boolean | YES | `true` |
| `allergens` | text[] | YES | - |
| `preparation_time` | int | YES | - |
| `popularity_score` | int | YES | `0` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

---

### 28. message_templates

**Propósito:** Plantillas de mensajes para CRM y AI Agent

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `name` | text | NO | - |
| `category` | text | NO | - |
| `template_type` | varchar | YES | - |
| `subject` | text | YES | - |
| `body_markdown` | text | YES | - |
| `content_markdown` | text | NO | `''` |
| `preview_text` | text | YES | - |
| `variables` | text[] | YES | `ARRAY[]::text[]` |
| `variables_available` | jsonb | YES | `'[]'` |
| `channel` | text | NO | - |
| `segment` | text | NO | `'all'` |
| `segment_target_v2` | varchar | YES | `'all'` |
| `event_trigger` | text | NO | `'manual'` |
| `provider_template_name` | text | YES | - |
| `send_delay_hours` | int | YES | `0` |
| `optimal_send_time` | varchar | YES | `'any'` |
| `priority` | int | YES | `5` |
| `is_active` | boolean | YES | `true` |
| `usage_count` | int | YES | `0` |
| `tags` | text[] | YES | `ARRAY[]::text[]` |
| `personalization_level` | varchar | YES | `'basic'` |
| `success_rate` | numeric | YES | `0.00` |
| `conversion_rate` | numeric | YES | `0.00` |
| `success_metrics` | jsonb | YES | `'{}'` |
| `last_used_at` | timestamptz | YES | - |
| `created_by` | uuid | YES | - |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 29. noshow_actions

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `reservation_id` | uuid | YES | - |
| `customer_id` | uuid | YES | - |
| `customer_name` | varchar | NO | - |
| `customer_phone` | varchar | YES | - |
| `reservation_date` | date | NO | - |
| `reservation_time` | time | NO | - |
| `party_size` | int | NO | - |
| `risk_level` | varchar | NO | - |
| `risk_score` | int | NO | - |
| `risk_factors` | jsonb | YES | `'[]'` |
| `action_type` | varchar | NO | - |
| `template_id` | uuid | YES | - |
| `template_name` | varchar | YES | - |
| `message_sent` | text | NO | - |
| `channel` | varchar | NO | `'whatsapp'` |
| `customer_response` | varchar | YES | - |
| `response_time` | interval | YES | - |
| `response_message` | text | YES | - |
| `final_outcome` | varchar | YES | - |
| `prevented_noshow` | boolean | YES | `false` |
| `sent_at` | timestamptz | YES | `timezone('utc', now())` |
| `response_received_at` | timestamptz | YES | - |
| `reservation_completed_at` | timestamptz | YES | - |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 30. notifications

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `user_id` | uuid | YES | - |
| `title` | text | NO | - |
| `message` | text | NO | - |
| `type` | text | NO | - |
| `priority` | text | YES | `'normal'` |
| `is_read` | boolean | YES | `false` |
| `action_url` | text | YES | - |
| `metadata` | jsonb | YES | `'{}'` |
| `expires_at` | timestamptz | YES | - |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `read_at` | timestamptz | YES | - |

---

### 31. profiles

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `auth_user_id` | uuid | NO | - |
| `email` | varchar | NO | - |
| `full_name` | varchar | YES | - |
| `avatar_url` | text | YES | - |
| `restaurant_name` | varchar | YES | - |
| `phone` | varchar | YES | - |
| `role` | varchar | YES | `'owner'` |
| `preferences` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 32. reservations

**Propósito:** 🔥 **RESERVAS DE MESAS**

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | **PK** |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `customer_id` | uuid | YES | - | FK → customers |
| `customer_name` | varchar | NO | - | Nombre cliente |
| `customer_email` | varchar | YES | - | Email cliente |
| `customer_phone` | varchar | YES | - | Teléfono cliente |
| `reservation_date` | date | NO | - | **Fecha reserva** |
| `reservation_time` | time | NO | - | **Hora reserva** |
| `date` | date | YES | - | (duplicado?) |
| `time` | time | YES | - | (duplicado?) |
| `party_size` | int | NO | - | **Número personas** |
| `status` | varchar | YES | `'confirmed'` | confirmed, cancelled, completed, no_show |
| `table_id` | uuid | YES | - | FK → tables |
| `table_number` | varchar | YES | - | Número mesa (legacy) |
| `special_requests` | text | YES | - | Solicitudes especiales |
| `source` | varchar | YES | `'web'` | Fuente (legacy) |
| `channel` | varchar | YES | `'web'` | Canal reserva |
| `reservation_source` | varchar | YES | `'manual'` | Fuente reserva |
| `reservation_channel` | varchar | YES | `'web'` | Canal reserva |
| `notes` | text | YES | - | Notas internas |
| `spend_amount` | numeric | YES | `0.00` | Monto gastado |
| `created_at` | timestamptz | NO | `timezone('utc', now())` | Fecha creación |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` | Fecha actualización |

**Índices críticos:**
- `restaurant_id, reservation_date, status`
- `customer_id, reservation_date DESC`
- `table_id, reservation_date, reservation_time`

---

### 33. reservations_with_customer

**Tipo:** VISTA (combina reservations + customers)

| Columna | Tipo | NULL |
|---------|------|------|
| `id` | uuid | YES |
| `restaurant_id` | uuid | YES |
| `reservation_date` | date | YES |
| `reservation_time` | time | YES |
| `party_size` | int | YES |
| `status` | varchar | YES |
| `notes` | text | YES |
| `source` | varchar | YES |
| `channel` | varchar | YES |
| `created_at` | timestamptz | YES |
| `updated_at` | timestamptz | YES |
| `customer_id` | uuid | YES |
| `customer_name` | varchar | YES |
| `customer_email` | varchar | YES |
| `customer_phone` | varchar | YES |
| `linked_customer_id` | uuid | YES |
| `linked_customer_name` | varchar | YES |
| `linked_customer_email` | varchar | YES |
| `linked_customer_phone` | varchar | YES |
| `linked_customer_notes` | text | YES |

---

### 34. restaurant_business_config

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | YES | - |
| `avg_ticket_price` | numeric | YES | `35.00` |
| `monthly_revenue` | numeric | YES | - |
| `staff_cost_monthly` | numeric | YES | `1800.00` |
| `current_reservations_monthly` | int | YES | `0` |
| `target_growth_percentage` | numeric | YES | `15.00` |
| `ai_system_cost` | numeric | YES | `199.00` |
| `ai_expected_improvement` | numeric | YES | `15.00` |
| `operating_hours_daily` | int | YES | `12` |
| `peak_hours_percentage` | numeric | YES | `30.00` |
| `manual_response_time_minutes` | numeric | YES | `5.00` |
| `configured_by` | varchar | YES | - |
| `last_updated` | timestamptz | YES | `now()` |
| `created_at` | timestamptz | YES | `now()` |

---

### 35. restaurant_operating_hours

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `day_of_week` | int | NO | - |
| `is_open` | boolean | NO | `true` |
| `open_time` | time | NO | `'09:00:00'` |
| `close_time` | time | NO | `'22:00:00'` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

---

### 36. restaurant_settings

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `category` | text | NO | - |
| `setting_key` | text | NO | - |
| `setting_value` | jsonb | NO | - |
| `description` | text | YES | - |
| `is_sensitive` | boolean | YES | `false` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 37. restaurant_shifts

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `day_of_week` | int | NO | - |
| `name` | varchar | NO | - |
| `start_time` | time | NO | - |
| `end_time` | time | NO | - |
| `is_active` | boolean | YES | `true` |
| `created_at` | timestamptz | YES | `now()` |
| `updated_at` | timestamptz | YES | `now()` |

---

### 38. businesses

**Propósito:** 🔥 **RESTAURANTES** (Multi-tenant base)

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | **PK** |
| `owner_id` | uuid | YES | - | FK → profiles |
| `name` | varchar | NO | - | Nombre restaurante |
| `email` | varchar | YES | - | Email |
| `phone` | varchar | YES | - | Teléfono |
| `address` | text | YES | - | Dirección |
| `city` | varchar | YES | - | Ciudad |
| `country` | varchar | YES | `'España'` | País |
| `postal_code` | varchar | YES | - | Código postal |
| `cuisine_type` | varchar | YES | - | Tipo cocina |
| `plan` | varchar | YES | `'trial'` | trial, basic, premium |
| `active` | boolean | YES | `true` | Activo |
| `settings` | jsonb | YES | `'{}'` | Configuración general |
| `agent_config` | jsonb | YES | `'{}'` | **Config AI Agent** |
| `business_hours` | jsonb | YES | `'{}'` | Horarios |
| `crm_config` | jsonb | YES | `'{}'` | Config CRM |
| `channels` | jsonb | YES | `'{}'` | Canales activos |
| `notifications` | jsonb | YES | `'{}'` | Config notificaciones |
| `created_at` | timestamptz | NO | `timezone('utc', now())` | Fecha creación |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` | Fecha actualización |

---

### 39. scheduled_messages

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `customer_id` | uuid | NO | - |
| `automation_rule_id` | uuid | YES | - |
| `template_id` | uuid | YES | - |
| `scheduled_for` | timestamptz | NO | - |
| `channel_planned` | text | NO | - |
| `channel_final` | text | YES | - |
| `subject_rendered` | text | YES | - |
| `content_rendered` | text | NO | - |
| `variables_used` | jsonb | YES | `'{}'` |
| `status` | text | YES | `'planned'` |
| `provider_message_id` | text | YES | - |
| `provider_response` | jsonb | YES | - |
| `retry_count` | int | YES | `0` |
| `last_error` | text | YES | - |
| `last_attempted_at` | timestamptz | YES | - |
| `sent_at` | timestamptz | YES | - |
| `delivered_at` | timestamptz | YES | - |
| `failed_at` | timestamptz | YES | - |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 40. special_events

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `event_date` | date | NO | - |
| `title` | varchar | NO | - |
| `description` | text | YES | - |
| `type` | varchar | YES | `'evento'` |
| `start_time` | time | YES | - |
| `end_time` | time | YES | - |
| `is_closed` | boolean | YES | `false` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |
| `updated_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 41. staff

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `auth_user_id` | uuid | YES | - |
| `name` | varchar | NO | - |
| `email` | varchar | YES | - |
| `phone` | varchar | YES | - |
| `role` | varchar | NO | - |
| `active` | boolean | YES | `true` |
| `schedule` | jsonb | YES | `'{}'` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 42. tables

**Propósito:** 🔥 **MESAS DEL RESTAURANTE**

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | **PK** |
| `restaurant_id` | uuid | NO | - | FK → businesses |
| `table_number` | text | NO | - | **Número mesa** |
| `name` | varchar | YES | - | Nombre mesa |
| `capacity` | int | NO | - | **Capacidad personas** |
| `location` | text | YES | - | Ubicación |
| `zone` | varchar | YES | `'main'` | Zona |
| `status` | text | YES | `'available'` | available, occupied, reserved |
| `position_x` | float8 | YES | - | Posición X (plano) |
| `position_y` | float8 | YES | - | Posición Y (plano) |
| `notes` | text | YES | - | Notas |
| `is_active` | boolean | YES | `true` | Activa |
| `created_at` | timestamptz | NO | `timezone('utc', now())` | Fecha creación |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` | Fecha actualización |

---

### 43. template_variables

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `restaurant_id` | uuid | NO | - |
| `variable_name` | varchar | NO | - |
| `variable_type` | varchar | NO | - |
| `description` | text | NO | - |
| `example_value` | text | YES | - |
| `category` | varchar | NO | - |
| `data_source` | varchar | YES | - |
| `is_active` | boolean | YES | `true` |
| `created_at` | timestamptz | YES | `timezone('utc', now())` |

---

### 44. user_restaurant_mapping

| Columna | Tipo | NULL | Default |
|---------|------|------|---------|
| `id` | uuid | NO | `gen_random_uuid()` |
| `auth_user_id` | uuid | NO | - |
| `restaurant_id` | uuid | NO | - |
| `role` | varchar | YES | `'staff'` |
| `permissions` | jsonb | YES | `'{}'` |
| `active` | boolean | YES | `true` |
| `created_at` | timestamptz | NO | `timezone('utc', now())` |
| `updated_at` | timestamptz | NO | `timezone('utc', now())` |

---

### 45. whatsapp_message_buffer

**Propósito:** 🔥 **BUFFER TEMPORAL PARA MENSAJES WHATSAPP FRAGMENTADOS**

| Columna | Tipo | NULL | Default | Descripción |
|---------|------|------|---------|-------------|
| `id` | uuid | NO | `gen_random_uuid()` | PK |
| `buffer_key` | varchar | NO | - | **Clave única (phone+timestamp)** |
| `customer_phone` | varchar | NO | - | Teléfono cliente |
| `customer_name` | varchar | YES | - | Nombre cliente |
| `messages` | text | NO | `''` | **Mensajes concatenados** |
| `message_count` | int | YES | `1` | Contador mensajes |
| `last_message_at` | timestamptz | NO | `now()` | **Último mensaje recibido** |
| `created_at` | timestamptz | YES | `now()` | Fecha creación buffer |

**Índice crítico:**
- `buffer_key` (UNIQUE)
- `last_message_at DESC` (para limpieza)

---

## 🔗 DIAGRAMA DE RELACIONES CLAVE

```
businesses (1) ────┬─── (N) agent_conversations
                    ├─── (N) agent_messages
                    ├─── (N) customers
                    ├─── (N) reservations
                    ├─── (N) tables
                    ├─── (N) availability_slots
                    ├─── (N) message_templates
                    ├─── (N) automation_rules
                    ├─── (N) channel_credentials
                    └─── (N) billing_tickets

agent_conversations (1) ─── (N) agent_messages
agent_conversations (1) ─── (1) ai_conversation_insights
agent_conversations (1) ─── (1) customer_feedback

customers (1) ───┬─── (N) reservations
                 ├─── (N) customer_interactions
                 ├─── (N) billing_tickets
                 └─── (N) scheduled_messages

reservations (N) ─── (1) tables

tables (1) ─── (N) availability_slots

whatsapp_message_buffer (temporal) ──> agent_conversations (via phone)
```

---

## ✅ RESUMEN EJECUTIVO

| Categoría | Tablas | Descripción |
|-----------|--------|-------------|
| **AI Agent** | 8 | Conversaciones, mensajes, métricas, insights |
| **CRM** | 12 | Clientes, interacciones, automatización, plantillas |
| **Reservas** | 5 | Reservas, disponibilidad, mesas, turnos |
| **Analytics** | 6 | Métricas diarias, históricos, performance |
| **Billing/TPV** | 2 | Tickets, matching automático |
| **Inventory** | 3 | Inventario, items menú |
| **Config** | 9 | Restaurantes, settings, horarios, perfiles |
| **Total** | **45 tablas** + 1 vista |

---

## 🎯 REGLAS DE ORO PARA N8N

1. ✅ **Multi-tenant:** Filtrar SIEMPRE por `restaurant_id`
2. ✅ **Customers:** Buscar por `phone` o `email` antes de crear
3. ✅ **Conversations:** Crear primero `agent_conversations`, luego `agent_messages`
4. ✅ **WhatsApp:** Usar `whatsapp_message_buffer` antes de procesar
5. ✅ **Availability:** Consultar `availability_slots` para reservas
6. ✅ **NUNCA** crear tablas nuevas sin aprobación explícita
7. ✅ **USAR** siempre las tablas y columnas existentes

---

**📅 Última actualización:** 2 de Octubre 2025  
**✅ Estado:** COMPLETO Y VERIFICADO  
**📊 Total:** 45 tablas + 1 vista documentadas


// ========================================
// CRM WEBHOOK SERVICE - INTEGRACIÓN EXTERNA
// Fecha: 28 Enero 2025
// Descripción: Webhooks para n8n, workers y conectores Email/SMS/WhatsApp
// ========================================

import { supabase } from '../lib/supabase';

/**
 * CONFIGURACIÓN DE WEBHOOKS
 */
const WEBHOOK_CONFIG = {
    // n8n workflow endpoints
    n8n: {
        base_url: import.meta.env.VITE_N8N_BASE_URL || 'https://n8n.tu-dominio.com',
        endpoints: {
            reservation_completed: '/webhook/crm/reservation-completed',
            customer_segment_changed: '/webhook/crm/segment-changed',
            send_email: '/webhook/crm/send-email',
            send_sms: '/webhook/crm/send-sms',
            send_whatsapp: '/webhook/crm/send-whatsapp',
            daily_job: '/webhook/crm/daily-job'
        }
    },
    
    // External service integrations
    external: {
        sendgrid: {
            api_key: import.meta.env.VITE_SENDGRID_API_KEY,
            from_email: import.meta.env.VITE_FROM_EMAIL || 'noreply@tu-restaurante.com'
        },
        twilio: {
            account_sid: import.meta.env.VITE_TWILIO_ACCOUNT_SID,
            auth_token: import.meta.env.VITE_TWILIO_AUTH_TOKEN,
            phone_number: import.meta.env.VITE_TWILIO_PHONE_NUMBER
        },
        whatsapp: {
            api_url: import.meta.env.VITE_WHATSAPP_API_URL,
            api_token: import.meta.env.VITE_WHATSAPP_API_TOKEN
        }
    }
};

/**
 * SERVICIO DE WEBHOOKS CRM
 */
export class CRMWebhookService {
    constructor() {
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 segundo
    }

    /**
     * WEBHOOK: RESERVA COMPLETADA
     */
    async triggerReservationCompleted(reservationData, customerData, crmResult) {
        try {
            const payload = {
                event: 'reservation_completed',
                timestamp: new Date().toISOString(),
                data: {
                    reservation: reservationData,
                    customer: customerData,
                    crm_result: crmResult
                }
            };

            // Enviar a n8n
            await this.sendToN8N('reservation_completed', payload);

            // Registrar evento
            await this.logWebhookEvent('reservation_completed', payload, 'sent');

            console.log('✅ Webhook reservation_completed enviado');
            return { success: true };

        } catch (error) {
            console.error('❌ Error en webhook reservation_completed:', error);
            await this.logWebhookEvent('reservation_completed', { error: error.message }, 'failed');
            return { success: false, error: error.message };
        }
    }

    /**
     * WEBHOOK: CAMBIO DE SEGMENTO DE CLIENTE
     */
    async triggerCustomerSegmentChanged(customerId, previousSegment, newSegment, customerData) {
        try {
            const payload = {
                event: 'customer_segment_changed',
                timestamp: new Date().toISOString(),
                data: {
                    customer_id: customerId,
                    previous_segment: previousSegment,
                    new_segment: newSegment,
                    customer: customerData,
                    requires_action: this.shouldTriggerAction(newSegment)
                }
            };

            // Enviar a n8n
            await this.sendToN8N('customer_segment_changed', payload);

            // Si requiere acción inmediata, enviar también a servicios específicos
            if (payload.data.requires_action) {
                await this.handleSegmentChangeAction(customerData, newSegment);
            }

            await this.logWebhookEvent('customer_segment_changed', payload, 'sent');

            console.log(`✅ Webhook segment change enviado: ${previousSegment} → ${newSegment}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error en webhook segment_changed:', error);
            await this.logWebhookEvent('customer_segment_changed', { error: error.message }, 'failed');
            return { success: false, error: error.message };
        }
    }

    /**
     * WEBHOOK: ENVIAR EMAIL
     */
    async sendEmail(interactionData, customerData, templateData) {
        try {
            const payload = {
                event: 'send_email',
                timestamp: new Date().toISOString(),
                data: {
                    interaction: interactionData,
                    customer: customerData,
                    template: templateData,
                    email_config: {
                        to: customerData.email,
                        subject: interactionData.subject,
                        html_content: this.processMarkdownToHTML(interactionData.content),
                        text_content: interactionData.content
                    }
                }
            };

            // Opción 1: Enviar a n8n para procesamiento
            if (WEBHOOK_CONFIG.n8n.base_url) {
                await this.sendToN8N('send_email', payload);
            }

            // Opción 2: Enviar directamente a SendGrid (backup)
            if (WEBHOOK_CONFIG.external.sendgrid.api_key) {
                await this.sendDirectEmail(payload.data.email_config);
            }

            // Actualizar estado de interacción
            await this.updateInteractionStatus(interactionData.id, 'sent');

            await this.logWebhookEvent('send_email', payload, 'sent');

            console.log(`✅ Email enviado a ${customerData.email}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error enviando email:', error);
            await this.updateInteractionStatus(interactionData.id, 'failed', error.message);
            await this.logWebhookEvent('send_email', { error: error.message }, 'failed');
            return { success: false, error: error.message };
        }
    }

    /**
     * WEBHOOK: ENVIAR SMS
     */
    async sendSMS(interactionData, customerData) {
        try {
            const payload = {
                event: 'send_sms',
                timestamp: new Date().toISOString(),
                data: {
                    interaction: interactionData,
                    customer: customerData,
                    sms_config: {
                        to: customerData.phone,
                        message: interactionData.content.substring(0, 160) // Límite SMS
                    }
                }
            };

            // Enviar a n8n
            if (WEBHOOK_CONFIG.n8n.base_url) {
                await this.sendToN8N('send_sms', payload);
            }

            // Backup: Twilio directo
            if (WEBHOOK_CONFIG.external.twilio.account_sid) {
                await this.sendDirectSMS(payload.data.sms_config);
            }

            await this.updateInteractionStatus(interactionData.id, 'sent');
            await this.logWebhookEvent('send_sms', payload, 'sent');

            console.log(`✅ SMS enviado a ${customerData.phone}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error enviando SMS:', error);
            await this.updateInteractionStatus(interactionData.id, 'failed', error.message);
            await this.logWebhookEvent('send_sms', { error: error.message }, 'failed');
            return { success: false, error: error.message };
        }
    }

    /**
     * WEBHOOK: ENVIAR WHATSAPP
     */
    async sendWhatsApp(interactionData, customerData) {
        try {
            const payload = {
                event: 'send_whatsapp',
                timestamp: new Date().toISOString(),
                data: {
                    interaction: interactionData,
                    customer: customerData,
                    whatsapp_config: {
                        to: customerData.phone,
                        message: interactionData.content
                    }
                }
            };

            // Enviar a n8n
            if (WEBHOOK_CONFIG.n8n.base_url) {
                await this.sendToN8N('send_whatsapp', payload);
            }

            // Backup: API directa de WhatsApp
            if (WEBHOOK_CONFIG.external.whatsapp.api_url) {
                await this.sendDirectWhatsApp(payload.data.whatsapp_config);
            }

            await this.updateInteractionStatus(interactionData.id, 'sent');
            await this.logWebhookEvent('send_whatsapp', payload, 'sent');

            console.log(`✅ WhatsApp enviado a ${customerData.phone}`);
            return { success: true };

        } catch (error) {
            console.error('❌ Error enviando WhatsApp:', error);
            await this.updateInteractionStatus(interactionData.id, 'failed', error.message);
            await this.logWebhookEvent('send_whatsapp', { error: error.message }, 'failed');
            return { success: false, error: error.message };
        }
    }

    /**
     * WEBHOOK: JOB DIARIO COMPLETADO
     */
    async triggerDailyJobCompleted(jobResults) {
        try {
            const payload = {
                event: 'daily_job_completed',
                timestamp: new Date().toISOString(),
                data: jobResults
            };

            await this.sendToN8N('daily_job', payload);
            await this.logWebhookEvent('daily_job', payload, 'sent');

            console.log('✅ Webhook daily_job enviado');
            return { success: true };

        } catch (error) {
            console.error('❌ Error en webhook daily_job:', error);
            await this.logWebhookEvent('daily_job', { error: error.message }, 'failed');
            return { success: false, error: error.message };
        }
    }

    /**
     * ENVIAR DATOS A N8N
     */
    async sendToN8N(endpoint, payload, attempt = 1) {
        try {
            if (!WEBHOOK_CONFIG.n8n.base_url) {
                console.warn('⚠️ N8N base URL no configurada');
                return;
            }

            const url = `${WEBHOOK_CONFIG.n8n.base_url}${WEBHOOK_CONFIG.n8n.endpoints[endpoint]}`;
            
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${import.meta.env.VITE_N8N_API_KEY || ''}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                throw new Error(`N8N webhook failed: ${response.status} ${response.statusText}`);
            }

            console.log(`✅ Enviado a N8N ${endpoint}: ${response.status}`);
            return await response.json();

        } catch (error) {
            console.error(`❌ Error enviando a N8N (intento ${attempt}):`, error);
            
            // Reintentar si no es el último intento
            if (attempt < this.retryAttempts) {
                console.log(`🔄 Reintentando en ${this.retryDelay}ms...`);
                await new Promise(resolve => setTimeout(resolve, this.retryDelay));
                return this.sendToN8N(endpoint, payload, attempt + 1);
            }
            
            throw error;
        }
    }

    /**
     * DETERMINAR SI UN CAMBIO DE SEGMENTO REQUIERE ACCIÓN INMEDIATA
     */
    shouldTriggerAction(newSegment) {
        const actionableSegments = ['vip', 'en_riesgo', 'inactivo'];
        return actionableSegments.includes(newSegment);
    }

    /**
     * MANEJAR ACCIÓN POR CAMBIO DE SEGMENTO
     */
    async handleSegmentChangeAction(customerData, newSegment) {
        try {
            const actions = {
                'vip': () => this.handleVIPUpgrade(customerData),
                'en_riesgo': () => this.handleAtRiskCustomer(customerData),
                'inactivo': () => this.handleInactiveCustomer(customerData)
            };

            const action = actions[newSegment];
            if (action) {
                await action();
            }

        } catch (error) {
            console.error('❌ Error manejando acción de segmento:', error);
        }
    }

    /**
     * MANEJAR UPGRADE A VIP
     */
    async handleVIPUpgrade(customerData) {
        console.log(`👑 Cliente VIP detectado: ${customerData.name}`);
        
        // Crear tarea para el equipo
        await this.createInternalTask({
            type: 'vip_upgrade',
            customer_id: customerData.id,
            title: `Nuevo cliente VIP: ${customerData.name}`,
            description: `Cliente promovido a VIP. Considerar atención especial y beneficios exclusivos.`,
            priority: 'high'
        });
    }

    /**
     * MANEJAR CLIENTE EN RIESGO
     */
    async handleAtRiskCustomer(customerData) {
        console.log(`⚠️ Cliente en riesgo detectado: ${customerData.name}`);
        
        await this.createInternalTask({
            type: 'at_risk',
            customer_id: customerData.id,
            title: `Cliente en riesgo: ${customerData.name}`,
            description: `Cliente con reducción de visitas. Considerar contacto personal o oferta especial.`,
            priority: 'medium'
        });
    }

    /**
     * MANEJAR CLIENTE INACTIVO
     */
    async handleInactiveCustomer(customerData) {
        console.log(`💤 Cliente inactivo detectado: ${customerData.name}`);
        
        // Este será manejado por las automatizaciones, solo logeamos
    }

    /**
     * ENVIAR EMAIL DIRECTO (SENDGRID)
     */
    async sendDirectEmail(emailConfig) {
        try {
            // Implementación directa con SendGrid API
            console.log('📧 [SIMULADO] Enviando email directo:', emailConfig);
            
            // En producción:
            // const sgMail = require('@sendgrid/mail');
            // sgMail.setApiKey(WEBHOOK_CONFIG.external.sendgrid.api_key);
            // await sgMail.send(emailConfig);
            
        } catch (error) {
            console.error('❌ Error en SendGrid directo:', error);
            throw error;
        }
    }

    /**
     * ENVIAR SMS DIRECTO (TWILIO)
     */
    async sendDirectSMS(smsConfig) {
        try {
            console.log('📱 [SIMULADO] Enviando SMS directo:', smsConfig);
            
            // En producción:
            // const twilio = require('twilio');
            // const client = twilio(accountSid, authToken);
            // await client.messages.create(smsConfig);
            
        } catch (error) {
            console.error('❌ Error en Twilio directo:', error);
            throw error;
        }
    }

    /**
     * ENVIAR WHATSAPP DIRECTO
     */
    async sendDirectWhatsApp(whatsappConfig) {
        try {
            console.log('💬 [SIMULADO] Enviando WhatsApp directo:', whatsappConfig);
            
        } catch (error) {
            console.error('❌ Error en WhatsApp directo:', error);
            throw error;
        }
    }

    /**
     * ACTUALIZAR ESTADO DE INTERACCIÓN
     */
    async updateInteractionStatus(interactionId, status, errorMessage = null) {
        try {
            const updateData = {
                status,
                updated_at: new Date().toISOString()
            };

            if (status === 'sent') {
                updateData.sent_at = new Date().toISOString();
            }

            if (errorMessage) {
                updateData.error_message = errorMessage;
            }

            const { error } = await supabase
                .from('customer_interactions')
                .update(updateData)
                .eq('id', interactionId);

            if (error) {
                console.error('❌ Error actualizando estado de interacción:', error);
            }

        } catch (error) {
            console.error('❌ Error en updateInteractionStatus:', error);
        }
    }

    /**
     * PROCESAR MARKDOWN A HTML
     */
    processMarkdownToHTML(markdown) {
        // Conversión básica de Markdown a HTML
        return markdown
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n/g, '<br>')
            .replace(/#{1}\s(.*)$/gm, '<h1>$1</h1>')
            .replace(/#{2}\s(.*)$/gm, '<h2>$1</h2>')
            .replace(/#{3}\s(.*)$/gm, '<h3>$1</h3>');
    }

    /**
     * CREAR TAREA INTERNA
     */
    async createInternalTask(taskData) {
        try {
            // Crear notificación interna para el equipo
            const { error } = await supabase
                .from('notifications')
                .insert({
                    restaurant_id: taskData.customer_id, // Temporal
                    title: taskData.title,
                    message: taskData.description,
                    type: 'crm_task',
                    priority: taskData.priority,
                    metadata: taskData
                });

            if (error) {
                console.error('❌ Error creando tarea interna:', error);
            }

        } catch (error) {
            console.error('❌ Error en createInternalTask:', error);
        }
    }

    /**
     * REGISTRAR EVENTO DE WEBHOOK
     */
    async logWebhookEvent(eventType, payload, status) {
        try {
            const { error } = await supabase
                .from('analytics')
                .insert({
                    restaurant_id: payload.data?.customer?.restaurant_id || null,
                    type: `webhook_${eventType}`,
                    date: new Date().toISOString().split('T')[0],
                    value: status === 'sent' ? 1 : 0,
                    metadata: {
                        event_type: eventType,
                        status,
                        timestamp: new Date().toISOString(),
                        payload_size: JSON.stringify(payload).length
                    }
                });

            if (error) {
                console.error('❌ Error registrando evento webhook:', error);
            }

        } catch (error) {
            console.error('❌ Error en logWebhookEvent:', error);
        }
    }
}

/**
 * INSTANCIA GLOBAL DEL SERVICIO
 */
export const webhookService = new CRMWebhookService();

/**
 * FUNCIONES DE CONVENIENCIA
 */
export const triggerReservationWebhook = webhookService.triggerReservationCompleted.bind(webhookService);
export const triggerSegmentChangeWebhook = webhookService.triggerCustomerSegmentChanged.bind(webhookService);
export const sendEmailWebhook = webhookService.sendEmail.bind(webhookService);
export const sendSMSWebhook = webhookService.sendSMS.bind(webhookService);
export const sendWhatsAppWebhook = webhookService.sendWhatsApp.bind(webhookService);

export default webhookService;

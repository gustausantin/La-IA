// ========================================
// CRM DAILY JOB - CRON DIARIO PARA REACTIVACIÓN
// Fecha: 28 Enero 2025
// Descripción: Job diario que detecta inactivos y ejecuta automatizaciones
// ========================================

import { supabase } from '../lib/supabase';
import { runGlobalCRMAutomations } from './CRMAutomationService';
import { recomputeCustomerStats, recomputeSegment } from './CRMService';
import { subDays, format } from 'date-fns';
import { es } from 'date-fns/locale';

/**
 * JOB DIARIO PRINCIPAL CRM
 * Se ejecuta una vez al día para mantener el CRM actualizado
 */
export async function runDailyCRMJob() {
    const jobStart = new Date();
    console.log(`🌅 [${format(jobStart, 'HH:mm:ss')}] Iniciando job diario CRM`);
    
    const jobResults = {
        job_started_at: jobStart.toISOString(),
        businesses_processed: 0,
        customers_updated: 0,
        segments_changed: 0,
        automations_sent: 0,
        errors: [],
        success: true
    };
    
    try {
        // 1. ACTUALIZAR SEGMENTACIÓN DE TODOS LOS CLIENTES
        console.log('📊 Paso 1: Actualizando segmentación de clientes');
        const segmentationResult = await updateAllCustomerSegmentation();
        jobResults.customers_updated = segmentationResult.customers_updated;
        jobResults.segments_changed = segmentationResult.segments_changed;
        
        if (segmentationResult.errors?.length) {
            jobResults.errors.push(...segmentationResult.errors);
        }
        
        // 2. EJECUTAR AUTOMATIZACIONES
        console.log('🤖 Paso 2: Ejecutando automatizaciones CRM');
        const automationResult = await runGlobalCRMAutomations();
        
        if (automationResult.success) {
            jobResults.businesses_processed = automationResult.businesses_processed;
            jobResults.automations_sent = automationResult.results?.reduce(
                (total, r) => total + (r.stats?.successful_sends || 0), 0
            ) || 0;
        } else {
            jobResults.errors.push(`Automatizaciones: ${automationResult.error}`);
        }
        
        // 3. LIMPIAR DATOS ANTIGUOS
        console.log('🧹 Paso 3: Limpiando datos antiguos');
        const cleanupResult = await cleanupOldData();
        if (cleanupResult.errors?.length) {
            jobResults.errors.push(...cleanupResult.errors);
        }
        
        // 4. GENERAR MÉTRICAS DIARIAS
        console.log('📈 Paso 4: Generando métricas diarias');
        const metricsResult = await generateDailyMetrics();
        if (metricsResult.errors?.length) {
            jobResults.errors.push(...metricsResult.errors);
        }
        
        const jobEnd = new Date();
        jobResults.job_completed_at = jobEnd.toISOString();
        jobResults.duration_minutes = Math.round((jobEnd - jobStart) / (1000 * 60));
        jobResults.success = jobResults.errors.length === 0;
        
        console.log(`✅ Job diario CRM completado en ${jobResults.duration_minutes} minutos`);
        console.log(`📊 Resultados:`, {
            negocios: jobResults.businesses_processed,
            clientes_actualizados: jobResults.customers_updated,
            cambios_segmento: jobResults.segments_changed,
            automatizaciones_enviadas: jobResults.automations_sent,
            errores: jobResults.errors.length
        });
        
        // 5. REGISTRAR RESULTADO DEL JOB
        await logJobExecution(jobResults);
        
        return jobResults;
        
    } catch (error) {
        console.error('❌ Error crítico en job diario CRM:', error);
        jobResults.success = false;
        jobResults.errors.push(`Error crítico: ${error.message}`);
        jobResults.job_completed_at = new Date().toISOString();
        
        await logJobExecution(jobResults);
        return jobResults;
    }
}

/**
 * ACTUALIZAR SEGMENTACIÓN DE TODOS LOS CLIENTES
 */
async function updateAllCustomerSegmentation() {
    const result = {
        customers_updated: 0,
        segments_changed: 0,
        errors: []
    };
    
    try {
        console.log('🔄 Obteniendo todos los clientes para actualizar segmentación');
        
        // Obtener todos los clientes activos
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('id, business_id, segment_auto, last_visit_at, visits_count')
            .order('business_id');
            
        if (customersError) {
            result.errors.push(`Error obteniendo clientes: ${customersError.message}`);
            return result;
        }
        
        console.log(`📋 Procesando ${customers?.length || 0} clientes`);
        
        // Procesar cada cliente
        for (const customer of customers || []) {
            try {
                // 1. Recomputar estadísticas
                const statsResult = await recomputeCustomerStats(customer.id, customer.business_id);
                
                if (statsResult.success) {
                    result.customers_updated++;
                    
                    // 2. Recomputar segmento
                    const segmentResult = await recomputeSegment(customer.id, customer.business_id);
                    
                    if (segmentResult.success && segmentResult.segmentChanged) {
                        result.segments_changed++;
                        console.log(`🎯 Cliente ${customer.id}: ${segmentResult.previousSegment} → ${segmentResult.newSegment}`);
                    }
                } else {
                    result.errors.push(`Cliente ${customer.id}: ${statsResult.error}`);
                }
                
            } catch (customerError) {
                result.errors.push(`Cliente ${customer.id}: ${customerError.message}`);
            }
        }
        
        console.log(`✅ Segmentación actualizada: ${result.customers_updated} clientes, ${result.segments_changed} cambios`);
        return result;
        
    } catch (error) {
        console.error('❌ Error en updateAllCustomerSegmentation:', error);
        result.errors.push(`Error global: ${error.message}`);
        return result;
    }
}

/**
 * LIMPIAR DATOS ANTIGUOS
 */
async function cleanupOldData() {
    const result = { errors: [] };
    
    try {
        console.log('🧹 Iniciando limpieza de datos antiguos');
        
        // 1. Limpiar interacciones muy antiguas (>1 año)
        const oneYearAgo = subDays(new Date(), 365).toISOString();
        
        const { error: interactionsError } = await supabase
            .from('customer_interactions')
            .delete()
            .lt('created_at', oneYearAgo)
            .in('status', ['failed', 'bounced']);
            
        if (interactionsError) {
            result.errors.push(`Error limpiando interacciones: ${interactionsError.message}`);
        } else {
            console.log('✅ Interacciones antiguas limpiadas');
        }
        
        // 2. Limpiar ejecuciones de reglas muy antiguas (>6 meses)
        const sixMonthsAgo = subDays(new Date(), 180).toISOString();
        
        const { error: executionsError } = await supabase
            .from('automation_rule_executions')
            .delete()
            .lt('executed_at', sixMonthsAgo)
            .eq('status', 'failed');
            
        if (executionsError) {
            result.errors.push(`Error limpiando ejecuciones: ${executionsError.message}`);
        } else {
            console.log('✅ Ejecuciones antiguas limpiadas');
        }
        
        console.log('✅ Limpieza de datos completada');
        return result;
        
    } catch (error) {
        console.error('❌ Error en cleanupOldData:', error);
        result.errors.push(`Error de limpieza: ${error.message}`);
        return result;
    }
}

/**
 * GENERAR MÉTRICAS DIARIAS
 */
async function generateDailyMetrics() {
    const result = { errors: [] };
    
    try {
        console.log('📈 Generando métricas diarias');
        
        // Obtener todos los negocios activos
        const { data: businesses, error: businessesError } = await supabase
            .from('businesses')
            .select('id, name')
            .eq('active', true);
            
        if (businessesError) {
            result.errors.push(`Error obteniendo negocios: ${businessesError.message}`);
            return result;
        }
        
        const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        
        // Generar métricas para cada negocio
        for (const business of businesses || []) {
            try {
                // Obtener estadísticas del día
                const { data: customers, error: customersError } = await supabase
                    .from('customers')
                    .select('segment_auto, created_at, total_spent, visits_count')
                    .eq('business_id', business.id);
                    
                if (customersError) {
                    result.errors.push(`Métricas negocio ${business.id}: ${customersError.message}`);
                    continue;
                }

                // Calcular métricas
                const metrics = {
                    business_id: business.id,
                    date: today,
                    total_customers: customers?.length || 0,
                    new_customers: customers?.filter(c => 
                        c.created_at && c.created_at.startsWith(today)
                    ).length || 0,
                    vip_customers: customers?.filter(c => c.segment_auto === 'vip').length || 0,
                    inactive_customers: customers?.filter(c => c.segment_auto === 'inactivo').length || 0,
                    at_risk_customers: customers?.filter(c => c.segment_auto === 'en_riesgo').length || 0,
                    total_revenue: customers?.reduce((sum, c) => sum + (c.total_spent || 0), 0) || 0,
                    avg_customer_value: 0
                };
                
                if (metrics.total_customers > 0) {
                    metrics.avg_customer_value = metrics.total_revenue / metrics.total_customers;
                }
                
                // Guardar métricas en analytics
                const { error: analyticsError } = await supabase
                    .from('analytics')
                    .upsert({
                        business_id: business.id,
                        type: 'crm_daily',
                        date: today,
                        value: metrics.total_customers,
                        metadata: metrics
                    }, {
                        onConflict: 'business_id,type,date'
                    });
                    
                if (analyticsError) {
                    result.errors.push(`Guardando métricas ${business.id}: ${analyticsError.message}`);
                } else {
                    console.log(`📊 Métricas guardadas para ${business.name}: ${metrics.total_customers} clientes`);
                }
                
            } catch (businessError) {
                result.errors.push(`Negocio ${business.id}: ${businessError.message}`);
            }
        }
        
        console.log('✅ Métricas diarias generadas');
        return result;
        
    } catch (error) {
        console.error('❌ Error en generateDailyMetrics:', error);
        result.errors.push(`Error métricas: ${error.message}`);
        return result;
    }
}

/**
 * REGISTRAR EJECUCIÓN DEL JOB
 */
async function logJobExecution(jobResults) {
    try {
        const { error } = await supabase
            .from('analytics')
            .insert({
                business_id: null, // Job global
                type: 'crm_daily_job',
                date: new Date().toISOString().split('T')[0],
                value: jobResults.customers_updated,
                metadata: jobResults
            });
            
        if (error) {
            console.error('❌ Error registrando ejecución del job:', error);
        } else {
            console.log('📝 Ejecución del job registrada');
        }
        
    } catch (error) {
        console.error('❌ Error en logJobExecution:', error);
    }
}

/**
 * EJECUTAR MANUALMENTE EL JOB PARA UN NEGOCIO ESPECÍFICO
 */
export async function runCRMJobForBusiness(businessId) {
    try {
        console.log(`🏪 Ejecutando job CRM para negocio ${businessId}`);
        
        // 1. Actualizar clientes del negocio
        const { data: customers, error: customersError } = await supabase
            .from('customers')
            .select('id')
            .eq('business_id', businessId);
            
        if (customersError) {
            console.error('❌ Error obteniendo clientes:', customersError);
            return { success: false, error: customersError.message };
        }
        
        let customersUpdated = 0;
        let segmentsChanged = 0;
        
        // 2. Procesar cada cliente
        for (const customer of customers || []) {
            const statsResult = await recomputeCustomerStats(customer.id, businessId);
            if (statsResult.success) {
                customersUpdated++;
                
                const segmentResult = await recomputeSegment(customer.id, businessId);
                if (segmentResult.success && segmentResult.segmentChanged) {
                    segmentsChanged++;
                }
            }
        }
        
        // 3. Ejecutar automatizaciones
        const { runCRMAutomations } = await import('./CRMAutomationService');
        const automationResult = await runCRMAutomations(businessId);
        
        const result = {
            success: true,
            business_id: businessId,
            customers_updated: customersUpdated,
            segments_changed: segmentsChanged,
            automations: automationResult
        };
        
        console.log('✅ Job CRM completado para negocio:', result);
        return result;
        
    } catch (error) {
        console.error('❌ Error en runCRMJobForBusiness:', error);
        return { success: false, error: error.message };
    }
}

/**
 * VERIFICAR ESTADO DEL CRM
 */
export async function getCRMHealthStatus() {
    try {
        const health = {
            timestamp: new Date().toISOString(),
            status: 'healthy',
            checks: {}
        };
        
        // Check 1: Clientes con segmentación actualizada
        const { data: customersCheck, error: customersError } = await supabase
            .from('customers')
            .select('id, segment_auto, updated_at')
            .not('segment_auto', 'is', null)
            .limit(100);
            
        health.checks.customers_segmented = {
            status: customersError ? 'error' : 'ok',
            count: customersCheck?.length || 0,
            error: customersError?.message
        };
        
        // Check 2: Reglas de automatización activas
        const { data: rulesCheck, error: rulesError } = await supabase
            .from('automation_rules')
            .select('id, name, is_active')
            .eq('is_active', true);
            
        health.checks.active_rules = {
            status: rulesError ? 'error' : 'ok',
            count: rulesCheck?.length || 0,
            error: rulesError?.message
        };
        
        // Check 3: Interacciones recientes
        const oneDayAgo = subDays(new Date(), 1).toISOString();
        const { data: interactionsCheck, error: interactionsError } = await supabase
            .from('customer_interactions')
            .select('id, status')
            .gte('created_at', oneDayAgo);
            
        health.checks.recent_interactions = {
            status: interactionsError ? 'error' : 'ok',
            count: interactionsCheck?.length || 0,
            sent: interactionsCheck?.filter(i => i.status === 'sent').length || 0,
            error: interactionsError?.message
        };
        
        // Determinar estado general
        const hasErrors = Object.values(health.checks).some(check => check.status === 'error');
        health.status = hasErrors ? 'error' : 'healthy';
        
        return health;
        
    } catch (error) {
        console.error('❌ Error en getCRMHealthStatus:', error);
        return {
            timestamp: new Date().toISOString(),
            status: 'error',
            error: error.message
        };
    }
}

export default {
    runDailyCRMJob,
    runCRMJobForBusiness,
    getCRMHealthStatus
};


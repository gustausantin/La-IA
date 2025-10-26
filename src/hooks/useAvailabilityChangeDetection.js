// Hook para detectar cambios que requieren regenerar disponibilidades
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useAvailabilityChangeDetection = (restaurantId) => {
    const [needsRegeneration, setNeedsRegeneration] = useState(false);
    const [lastChangeTimestamp, setLastChangeTimestamp] = useState(null);
    const [changeType, setChangeType] = useState(null);
    const [changeDetails, setChangeDetails] = useState(null);
    const [hasExistingSlots, setHasExistingSlots] = useState(false);

    // Función para verificar si existen slots de disponibilidad
    const checkExistingSlots = useCallback(async () => {
        if (!restaurantId) return false;
        
        try {
            const { data, error } = await supabase
                .from('availability_slots')
                .select('id')
                .eq('restaurant_id', restaurantId)
                .limit(1);
            
            if (error) {
                console.warn('Error verificando slots existentes:', error);
                return false;
            }
            
            const exists = (data && data.length > 0);
            setHasExistingSlots(exists);
            return exists;
        } catch (error) {
            console.warn('Error verificando slots existentes:', error);
            return false;
        }
    }, [restaurantId]);

    // Función para marcar que se necesita regeneración (SOLO si ya existen slots)
    const markNeedsRegeneration = useCallback(async (type, details = null) => {
        // 🔍 VERIFICAR SI EXISTEN DISPONIBILIDADES ANTES DE MOSTRAR AVISO
        const slotsExist = await checkExistingSlots();
        
        if (!slotsExist) {
            console.log(`🚧 No se muestra aviso de regeneración: no existen slots previos (cambio: ${type})`);
            return; // NO mostrar aviso si nunca se han generado slots
        }
        const timestamp = new Date().toISOString();
        
        setNeedsRegeneration(true);
        setLastChangeTimestamp(timestamp);
        setChangeType(type);
        setChangeDetails(details);

        // Guardar en localStorage para persistencia
        try {
            localStorage.setItem(`needsRegeneration_${restaurantId}`, JSON.stringify({
                needsRegeneration: true,
                lastChangeTimestamp: timestamp,
                changeType: type,
                changeDetails: details
            }));
        } catch (error) {
            console.warn('Error guardando estado de regeneración:', error);
        }
    }, [restaurantId]);

    // Función para limpiar el estado de regeneración
    const clearRegenerationFlag = useCallback(() => {
        setNeedsRegeneration(false);
        setLastChangeTimestamp(null);
        setChangeType(null);
        setChangeDetails(null);

        try {
            localStorage.removeItem(`needsRegeneration_${restaurantId}`);
        } catch (error) {
            console.warn('Error limpiando estado de regeneración:', error);
        }
    }, [restaurantId]);

    // Cargar estado persistente al inicializar Y verificar slots existentes
    useEffect(() => {
        if (restaurantId) {
            // 🚨 CARGAR INMEDIATAMENTE desde localStorage
            try {
                const saved = localStorage.getItem(`needsRegeneration_${restaurantId}`);
                console.log('🔍 Hook: Leyendo localStorage ->', saved);
                
                if (saved) {
                    const data = JSON.parse(saved);
                    console.log('🔍 Hook: Datos parseados ->', data);
                    
                    // 🎯 RESTAURAR ESTADO INMEDIATAMENTE (no esperar verificación)
                    setNeedsRegeneration(data.needsRegeneration || false);
                    setLastChangeTimestamp(data.lastChangeTimestamp);
                    setChangeType(data.changeType);
                    setChangeDetails(data.changeDetails);
                    
                    console.log('✅ Hook: Estado restaurado - needsRegeneration:', data.needsRegeneration);
                    
                    // Verificar slots en segundo plano (por si acaso)
                    checkExistingSlots().then(slotsExist => {
                        console.log('🔍 Hook: Verificación asíncrona - slotsExist:', slotsExist);
                        if (!slotsExist) {
                            // Limpiar estado si no hay slots (protección)
                            console.log('⚠️ Hook: No hay slots, limpiando estado...');
                            localStorage.removeItem(`needsRegeneration_${restaurantId}`);
                            setNeedsRegeneration(false);
                            setLastChangeTimestamp(null);
                            setChangeType(null);
                            setChangeDetails(null);
                        }
                    });
                } else {
                    console.log('ℹ️ Hook: No hay estado guardado en localStorage');
                }
            } catch (error) {
                console.warn('❌ Hook: Error cargando estado de regeneración:', error);
            }
            
            // Verificar si existen slots (independiente del localStorage)
            checkExistingSlots();
        }
    }, [restaurantId, checkExistingSlots]);

    // Funciones específicas para diferentes tipos de cambios
    const onTableChange = useCallback(async (action, tableData) => {
        await markNeedsRegeneration('table_change', {
            action, // 'added', 'removed', 'modified', 'status_changed'
            table: tableData
        });
    }, [markNeedsRegeneration]);

    const onScheduleChange = useCallback(async (scheduleData) => {
        await markNeedsRegeneration('schedule_change', {
            schedule: scheduleData
        });
    }, [markNeedsRegeneration]);

    const onPolicyChange = useCallback(async (policyData) => {
        await markNeedsRegeneration('policy_change', {
            policy: policyData
        });
    }, [markNeedsRegeneration]);

    const onSpecialEventChange = useCallback(async (action, eventData) => {
        await markNeedsRegeneration('special_event_change', {
            action, // 'added', 'removed', 'modified'
            event: eventData
        });
    }, [markNeedsRegeneration]);

    // Función para obtener mensaje descriptivo del cambio
    const getChangeMessage = useCallback(() => {
        if (!needsRegeneration || !changeType) return null;

        const messages = {
            table_change: {
                added: '🏠 Se añadió una nueva mesa',
                removed: '❌ Se eliminó una mesa',
                modified: '🔧 Se modificó una mesa',
                status_changed: '🔄 Se cambió el estado de una mesa'
            },
            schedule_change: '⏰ Se modificaron los horarios de apertura',
            policy_change: '⚙️ Se cambió la política de reservas',
            special_event_change: {
                added: '🎉 Se añadió un evento especial',
                removed: '🗑️ Se eliminó un evento especial',
                modified: '📝 Se modificó un evento especial'
            }
        };

        const message = messages[changeType];
        if (typeof message === 'string') {
            return message;
        } else if (typeof message === 'object' && changeDetails?.action) {
            return message[changeDetails.action] || 'Se detectó un cambio';
        }

        return 'Se detectó un cambio que requiere regenerar disponibilidades';
    }, [needsRegeneration, changeType, changeDetails]);

    return {
        needsRegeneration,
        lastChangeTimestamp,
        changeType,
        changeDetails,
        hasExistingSlots,
        markNeedsRegeneration,
        clearRegenerationFlag,
        checkExistingSlots,
        onTableChange,
        onScheduleChange,
        onPolicyChange,
        onSpecialEventChange,
        getChangeMessage
    };
};

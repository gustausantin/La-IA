// =========================================
// RESERVATION FORM MODAL WITH VALIDATION
// Modal para crear reservas con validación de disponibilidad
// =========================================

import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Users, Phone, Mail, User, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../lib/supabase';
import ConflictDetectionService from '../services/ConflictDetectionService';
import toast from 'react-hot-toast';

const ReservationFormModal = ({ isOpen, onClose, onSave, tables, businessId }) => {
    const [formData, setFormData] = useState({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        reservation_date: format(new Date(), 'yyyy-MM-dd'),
        reservation_time: '20:00',
        party_size: 2,
        table_id: '',
        special_requests: ''
    });
    
    const [availabilityStatus, setAvailabilityStatus] = useState({
        checking: false,
        isValid: null,
        message: '',
        availableSlots: []
    });
    
    const [saving, setSaving] = useState(false);
    const [validationError, setValidationError] = useState('');

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setFormData({
                customer_name: '',
                customer_email: '',
                customer_phone: '',
                reservation_date: format(new Date(), 'yyyy-MM-dd'),
                reservation_time: '20:00',
                party_size: 2,
                table_id: '',
                special_requests: '',
                channel: 'manual'
            });
            setAvailabilityStatus({
                checking: false,
                isValid: null,
                message: '',
                availableSlots: []
            });
            setValidationError('');
        }
    }, [isOpen]);

    // Validar disponibilidad cuando cambien fecha, hora, personas o mesa
    useEffect(() => {
        if (formData.reservation_date && formData.reservation_time && formData.party_size) {
            validateAvailability();
        }
    }, [formData.reservation_date, formData.reservation_time, formData.party_size, formData.table_id]);

    const validateAvailability = async () => {
        if (!businessId) return;
        
        setAvailabilityStatus(prev => ({ ...prev, checking: true }));
        
        try {
            const validation = await ConflictDetectionService.validateReservationAvailability(
                businessId,
                formData.reservation_date,
                formData.reservation_time,
                formData.party_size,
                formData.table_id || null
            );
            
            setAvailabilityStatus({
                checking: false,
                isValid: validation.isValid,
                message: validation.message,
                availableSlots: validation.availableSlots || []
            });
            
        } catch (error) {
            console.error('Error validando disponibilidad:', error);
            setAvailabilityStatus({
                checking: false,
                isValid: false,
                message: 'Error al validar disponibilidad',
                availableSlots: []
            });
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validaciones básicas
        if (!formData.customer_name.trim()) {
            setValidationError('El nombre del cliente es obligatorio');
            return;
        }
        
        if (!formData.customer_phone.trim()) {
            setValidationError('El teléfono del cliente es obligatorio');
            return;
        }
        
        // Validar disponibilidad final
        if (!availabilityStatus.isValid) {
            setValidationError(availabilityStatus.message || 'No hay disponibilidad para esta reserva');
            return;
        }
        
        setSaving(true);
        setValidationError('');
        
        try {
            // ✅ VERIFICAR GOOGLE CALENDAR ANTES DE CREAR RESERVA
            const startDateTime = new Date(`${formData.reservation_date}T${formData.reservation_time}`);
            const durationMinutes = 60; // Duración por defecto, se puede obtener de settings
            const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60000);
            
            try {
                const { data: availabilityCheck, error: checkError } = await supabase.functions.invoke(
                    'check-availability-unified',
                    {
                        body: {
                            business_id: businessId,
                            resource_id: formData.table_id || null,
                            start_time: startDateTime.toISOString(),
                            end_time: endDateTime.toISOString()
                        }
                    }
                );
                
                if (checkError) {
                    console.warn('⚠️ Error verificando Google Calendar:', checkError);
                    // Continuar de todas formas si hay error en la verificación
                } else if (availabilityCheck && !availabilityCheck.available) {
                    // Hay conflictos en Google Calendar
                    const conflicts = availabilityCheck.conflicts || [];
                    const googleConflicts = conflicts.filter(c => c.type === 'google_calendar');
                    
                    if (googleConflicts.length > 0) {
                        const conflictMessage = `⚠️ Este horario está bloqueado en Google Calendar:\n${googleConflicts.map(c => `• ${c.reason || 'Evento bloqueado'}`).join('\n')}\n\n¿Deseas continuar de todas formas?`;
                        
                        const shouldContinue = window.confirm(conflictMessage);
                        if (!shouldContinue) {
                            setSaving(false);
                            return;
                        }
                    }
                }
            } catch (checkError) {
                console.warn('⚠️ Error en verificación de Google Calendar:', checkError);
                // Continuar de todas formas si hay error
            }
            // 1. Crear o encontrar cliente
            console.log('🔍 Paso 1: Buscando/creando cliente...', {
                customer_name: formData.customer_name,
                customer_phone: formData.customer_phone,
                business_id: businessId
            });
            
            let customerId;
            const { data: existingCustomer, error: searchCustomerError } = await supabase
                .from('customers')
                .select('id')
                .eq('business_id', businessId)
                .eq('phone', formData.customer_phone)
                .maybeSingle();
            
            if (searchCustomerError && searchCustomerError.code !== 'PGRST116') {
                console.error('❌ Error buscando cliente:', searchCustomerError);
                throw new Error(`Error buscando cliente: ${searchCustomerError.message}`);
            }
            
            if (existingCustomer && existingCustomer.id) {
                customerId = existingCustomer.id;
                console.log('✅ Cliente existente encontrado:', customerId);
                
                // Actualizar datos del cliente si han cambiado
                const { error: updateCustomerError } = await supabase
                    .from('customers')
                    .update({
                        name: formData.customer_name,
                        email: formData.customer_email || null,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', customerId);
                
                if (updateCustomerError) {
                    console.warn('⚠️ Error actualizando cliente (continuando):', updateCustomerError);
                }
            } else {
                // Crear nuevo cliente
                console.log('📝 Creando nuevo cliente...');
                const { data: newCustomer, error: customerError } = await supabase
                    .from('customers')
                    .insert({
                        business_id: businessId,
                        name: formData.customer_name,
                        email: formData.customer_email || null,
                        phone: formData.customer_phone,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    })
                    .select('id')
                    .single();
                
                if (customerError) {
                    console.error('❌ Error creando cliente:', customerError);
                    throw new Error(`Error creando cliente: ${customerError.message} (${customerError.details || ''})`);
                }
                
                if (!newCustomer || !newCustomer.id) {
                    throw new Error('No se pudo crear el cliente: respuesta vacía');
                }
                
                customerId = newCustomer.id;
                console.log('✅ Cliente creado:', customerId);
            }
            
            // 2. Seleccionar mesa/recurso automáticamente si no se especificó
            console.log('🔍 Paso 2: Obteniendo recurso y trabajador...', {
                table_id_from_form: formData.table_id,
                available_slots_count: availabilityStatus.availableSlots.length
            });
            
            let selectedTableId = formData.table_id;
            let selectedEmployeeId = null;
            
            if (!selectedTableId && availabilityStatus.availableSlots.length > 0) {
                selectedTableId = availabilityStatus.availableSlots[0].resource_id || availabilityStatus.availableSlots[0].table_id;
                console.log('✅ Recurso seleccionado automáticamente:', selectedTableId);
            }
            
            // ✅ 2.1. OBTENER employee_id: Un recurso SIEMPRE está asociado a un trabajador
            // La relación es: Employee.assigned_resource_id -> Resource.id
            // Por lo tanto, si hay resource_id, SIEMPRE debe haber employee_id
            
            if (selectedTableId) {
                // ✅ Prioridad 1: Buscar employee_id directamente en el slot (más rápido)
            if (availabilityStatus.availableSlots.length > 0) {
                const selectedSlot = availabilityStatus.availableSlots.find(slot => 
                    (slot.resource_id && slot.resource_id === selectedTableId) ||
                    (slot.table_id && slot.table_id === selectedTableId)
                ) || availabilityStatus.availableSlots[0];
                
                if (selectedSlot?.employee_id) {
                    selectedEmployeeId = selectedSlot.employee_id;
                        console.log('✅ employee_id obtenido directamente del slot:', selectedEmployeeId);
                    }
                }
                
                // ✅ Prioridad 2: Si no está en el slot, buscar el empleado que tiene este recurso asignado
                // REGLA DE NEGOCIO: Un recurso SIEMPRE tiene un trabajador asignado (assigned_resource_id)
                if (!selectedEmployeeId) {
                    console.log('🔍 Buscando empleado con assigned_resource_id =', selectedTableId);
                    const { data: employeeData, error: employeeError } = await supabase
                        .from('employees')
                        .select('id, name, assigned_resource_id')
                        .eq('business_id', businessId)
                        .eq('assigned_resource_id', selectedTableId)
                        .eq('is_active', true)
                        .maybeSingle();
                    
                    if (employeeError) {
                        console.error('❌ Error buscando empleado por assigned_resource_id:', employeeError);
                        setSaving(false);
                        setValidationError(`❌ Error al buscar el trabajador asociado al recurso.`);
                        toast.error('❌ Error al buscar el trabajador. Por favor, intenta de nuevo.', { duration: 8000 });
                        return;
                    }
                    
                    if (employeeData) {
                        selectedEmployeeId = employeeData.id;
                        console.log(`✅ Empleado encontrado: ${employeeData.name} (ID: ${employeeData.id}) para recurso ${selectedTableId}`);
                    } else {
                        // ❌ ERROR CRÍTICO: Un recurso SIN trabajador asignado es un error del sistema
                        console.error('❌ CRÍTICO: El recurso', selectedTableId, 'NO tiene un trabajador asignado (assigned_resource_id)');
                        
                        // Obtener información del recurso para el mensaje de error
                        const { data: resourceData } = await supabase
                            .from('resources')
                            .select('id, name')
                            .eq('id', selectedTableId)
                            .eq('business_id', businessId)
                            .single();
                        
                        const resourceName = resourceData?.name || selectedTableId;
                        
                        setSaving(false);
                        setValidationError(`❌ Error: El recurso "${resourceName}" no tiene un trabajador asignado. Por favor, asigna un trabajador a este recurso antes de crear reservas.`);
                        toast.error(`❌ El recurso "${resourceName}" no tiene trabajador asignado. Asigna un trabajador en la configuración.`, { duration: 10000 });
                        return; // ❌ DETENER la creación - esto es un error del sistema
                    }
                }
            } else {
                // Si no hay resource_id, tampoco puede haber employee_id (van juntos)
                console.warn('⚠️ No se seleccionó ningún recurso. No se puede crear la reserva sin recurso y trabajador.');
                setSaving(false);
                setValidationError('❌ Error: Debes seleccionar un recurso para crear la reserva.');
                toast.error('❌ Debes seleccionar un recurso para crear la reserva.', { duration: 8000 });
                return;
            }
            
            // ✅ VALIDACIÓN FINAL: Verificar que tenemos AMBOS (resource_id Y employee_id)
            if (!selectedTableId || !selectedEmployeeId) {
                console.error('❌ CRÍTICO: Faltan campos obligatorios:', {
                    resource_id: selectedTableId,
                    employee_id: selectedEmployeeId
                });
                setSaving(false);
                setValidationError('❌ Error: Faltan datos obligatorios (recurso o trabajador).');
                toast.error('❌ No se puede crear la reserva: faltan datos obligatorios.', { duration: 8000 });
                return;
            }
            
            console.log('✅ Recurso y trabajador validados:', {
                resource_id: selectedTableId,
                employee_id: selectedEmployeeId
            });
            
            // ✅ VALIDACIÓN ADICIONAL: Si no hay resource_id ni employee_id, también es un problema
            if (!selectedTableId && !selectedEmployeeId) {
                console.error('❌ CRÍTICO: Se intenta crear una reserva sin resource_id ni employee_id');
                setSaving(false);
                setValidationError('❌ Error: Debes seleccionar un recurso o trabajador para crear la reserva.');
                toast.error('❌ No se puede crear la reserva: debes seleccionar un recurso o trabajador.', { duration: 8000 });
                return; // ❌ DETENER la creación de la reserva
            }
            
            // ✅ VALIDACIÓN FINAL: Verificar que tenemos TODOS los campos necesarios
            if (!selectedTableId) {
                setSaving(false);
                setValidationError('❌ Error: Debes seleccionar un recurso para crear la reserva.');
                toast.error('❌ No se puede crear la reserva: falta el recurso.', { duration: 8000 });
                return;
            }
            
            if (!selectedEmployeeId) {
                setSaving(false);
                setValidationError('❌ Error: No se pudo identificar el empleado. Verifica que el recurso esté asignado a un trabajador activo.');
                toast.error('❌ No se puede crear la reserva: falta el empleado.', { duration: 8000 });
                return;
            }
            
            if (!customerId) {
                setSaving(false);
                setValidationError('❌ Error: No se pudo crear o encontrar el cliente.');
                toast.error('❌ No se puede crear la reserva: error con el cliente.', { duration: 8000 });
                return;
            }
            
            // ✅ 2.2. Obtener service_id (OBLIGATORIO) - Buscar el primer servicio activo del negocio
            let selectedServiceId = null;
            console.log('🔍 Buscando service_id para el negocio...');
            const { data: servicesData, error: servicesError } = await supabase
                .from('business_services')
                .select('id, name, is_active')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('position_order', { ascending: true })
                .limit(1);
            
            if (servicesError) {
                console.error('❌ Error buscando servicios:', servicesError);
                setSaving(false);
                setValidationError('❌ Error: No se pudo obtener el servicio. Verifica que haya servicios activos configurados.');
                toast.error('❌ No se puede crear la reserva: error obteniendo servicios.', { duration: 8000 });
                return;
            }
            
            if (!servicesData || servicesData.length === 0) {
                console.error('❌ No hay servicios activos para el negocio');
                setSaving(false);
                setValidationError('❌ Error: No hay servicios activos configurados. Por favor, crea al menos un servicio antes de crear reservas.');
                toast.error('❌ No se puede crear la reserva: no hay servicios configurados.', { duration: 8000 });
                return;
            }
            
            selectedServiceId = servicesData[0].id;
            console.log(`✅ service_id obtenido: ${selectedServiceId} (${servicesData[0].name})`);
            
            // ✅ VALIDACIÓN FINAL COMPLETA: Verificar que tenemos TODOS los campos obligatorios
            if (!selectedServiceId) {
                setSaving(false);
                setValidationError('❌ Error: No se pudo obtener el servicio.');
                toast.error('❌ No se puede crear la reserva: falta el servicio.', { duration: 8000 });
                return;
            }
            
            console.log('✅ Validaciones completadas. Datos completos de la reserva:', {
                business_id: businessId,
                customer_id: customerId,
                service_id: selectedServiceId,
                resource_id: selectedTableId,
                employee_id: selectedEmployeeId,
                appointment_date: formData.reservation_date,
                appointment_time: formData.reservation_time,
                duration_minutes: 60, // Por defecto, se puede obtener del servicio
            });
            
            // 3. Crear la reserva
            console.log('🔍 Paso 3: Creando reserva en appointments...', {
                business_id: businessId,
                customer_id: customerId,
                service_id: selectedServiceId,
                resource_id: selectedTableId,
                employee_id: selectedEmployeeId,
                appointment_date: formData.reservation_date,
                appointment_time: formData.reservation_time
            });
            
            // ✅ CORRECCIÓN: Usar appointment_date y appointment_time (campos reales de la BD)
            // NO reservation_date/reservation_time (solo para mapeo en frontend)
            // ✅ TODOS los campos OBLIGATORIOS deben estar completos
            const appointmentData = {
                business_id: businessId, // ✅ OBLIGATORIO
                customer_id: customerId, // ✅ OBLIGATORIO
                service_id: selectedServiceId, // ✅ OBLIGATORIO
                customer_name: formData.customer_name, // ✅ OBLIGATORIO
                customer_email: formData.customer_email || null,
                customer_phone: formData.customer_phone,
                appointment_date: formData.reservation_date, // ✅ OBLIGATORIO - Campo real de BD
                appointment_time: formData.reservation_time, // ✅ OBLIGATORIO - Campo real de BD
                duration_minutes: 60, // ✅ OBLIGATORIO - Por defecto 60 min (se puede obtener del servicio)
                party_size: formData.party_size,
                resource_id: selectedTableId, // ✅ OBLIGATORIO cuando hay recurso: Para salones: resource_id (empleado/recurso)
                table_id: selectedTableId, // ✅ Legacy: table_id (mesa) - ya no se usa para nuevos negocios
                employee_id: selectedEmployeeId, // ✅ OBLIGATORIO cuando hay resource_id: Debe estar SIEMPRE
                special_requests: formData.special_requests || null,
                status: 'confirmed', // ✅ Estado en inglés (confirmed, pending, cancelled, etc.)
                source: 'dashboard', // ✅ Fuente: creada desde dashboard
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            };
            
            // ✅ VALIDACIÓN CRÍTICA FINAL: Verificar employee_id ANTES de insertar
            // Esta es la última línea de defensa - NO se puede crear sin trabajador
            if (!appointmentData.employee_id && appointmentData.resource_id) {
                console.error('❌ CRÍTICO: Intento de crear reserva sin employee_id pero con resource_id');
                console.error('Datos que se intentaron insertar:', appointmentData);
                setSaving(false);
                setValidationError('❌ ERROR CRÍTICO: No se puede crear una reserva sin trabajador asignado. El sistema ha bloqueado esta operación.');
                toast.error('❌ ERROR: No se puede crear la reserva sin trabajador. Verifica que el recurso tenga un trabajador asignado.', { duration: 10000 });
                return; // ❌ BLOQUEAR COMPLETAMENTE
            }
            
            // ✅ VALIDACIÓN ADICIONAL: Verificar que employee_id no sea null/undefined
            if (appointmentData.resource_id && (!appointmentData.employee_id || appointmentData.employee_id === null || appointmentData.employee_id === undefined)) {
                console.error('❌ CRÍTICO: employee_id es null/undefined pero hay resource_id');
                console.error('Datos que se intentaron insertar:', appointmentData);
                setSaving(false);
                setValidationError('❌ ERROR CRÍTICO: El trabajador no está identificado. No se puede crear la reserva.');
                toast.error('❌ ERROR: No se puede crear la reserva sin trabajador identificado.', { duration: 10000 });
                return; // ❌ BLOQUEAR COMPLETAMENTE
            }
            
            console.log('📤 Datos a insertar en appointments:', appointmentData);
            console.log('✅ Validación final: employee_id =', appointmentData.employee_id, 'resource_id =', appointmentData.resource_id);
            
            const { data: reservation, error: reservationError } = await supabase
                .from('appointments')
                .insert(appointmentData)
                .select()
                .single();
            
            if (reservationError) {
                console.error('❌ ERROR al crear reserva en appointments:', reservationError);
                console.error('Detalles del error:', {
                    code: reservationError.code,
                    message: reservationError.message,
                    details: reservationError.details,
                    hint: reservationError.hint
                });
                console.error('Datos que se intentaron insertar:', appointmentData);
                throw new Error(`Error creando reserva: ${reservationError.message}${reservationError.details ? ' (' + reservationError.details + ')' : ''}`);
            }
            
            if (!reservation || !reservation.id) {
                console.error('❌ CRÍTICO: La reserva no se creó (respuesta vacía)');
                throw new Error('La reserva no se creó: respuesta vacía del servidor');
            }
            
            // ✅ VERIFICACIÓN POST-CREACIÓN: Asegurar que la reserva tiene employee_id
            if (reservation.resource_id && !reservation.employee_id) {
                console.error('❌ CRÍTICO: La reserva se creó pero NO tiene employee_id');
                console.error('Reserva creada:', reservation);
                setSaving(false);
                setValidationError('❌ ERROR CRÍTICO: La reserva se creó sin trabajador. Esto no debería ser posible.');
                toast.error('❌ ERROR CRÍTICO: La reserva se creó sin trabajador. Por favor, contacta al soporte.', { duration: 10000 });
                
                // Intentar eliminar la reserva incorrecta
                try {
                    await supabase.from('appointments').delete().eq('id', reservation.id);
                    console.log('✅ Reserva incorrecta eliminada');
                } catch (deleteError) {
                    console.error('❌ Error eliminando reserva incorrecta:', deleteError);
                }
                
                return; // ❌ DETENER el proceso
            }
            
            console.log('✅ Reserva creada exitosamente en appointments:', reservation.id);
            console.log('✅ Verificación post-creación: employee_id =', reservation.employee_id, 'resource_id =', reservation.resource_id);
            
            // ✅ Verificar que la reserva se creó con TODOS los campos obligatorios
            const missingFields = [];
            if (!reservation.business_id) missingFields.push('business_id');
            if (!reservation.customer_id) missingFields.push('customer_id');
            if (!reservation.service_id) missingFields.push('service_id');
            if (!reservation.appointment_date) missingFields.push('appointment_date');
            if (!reservation.appointment_time) missingFields.push('appointment_time');
            if (!reservation.duration_minutes) missingFields.push('duration_minutes');
            if (!reservation.employee_id && reservation.resource_id) missingFields.push('employee_id');
            if (!reservation.resource_id && !reservation.employee_id) missingFields.push('resource_id o employee_id');
            
            if (missingFields.length > 0) {
                console.error('❌ CRÍTICO: La reserva se creó pero faltan campos obligatorios:', missingFields);
                console.error('Reserva creada:', reservation);
                toast.error(`⚠️ La reserva se creó pero faltan campos: ${missingFields.join(', ')}. Esto puede causar problemas.`, { duration: 10000 });
            } else {
                console.log('✅ Reserva creada exitosamente con TODOS los campos obligatorios:', {
                    id: reservation.id,
                    business_id: reservation.business_id,
                    customer_id: reservation.customer_id,
                    service_id: reservation.service_id,
                    employee_id: reservation.employee_id,
                    resource_id: reservation.resource_id,
                    appointment_date: reservation.appointment_date,
                    appointment_time: reservation.appointment_time,
                    duration_minutes: reservation.duration_minutes,
                });
            }
            
            // ✅ 4. Sincronizar con Google Calendar (push)
            try {
                console.log('🔄 Sincronizando reserva con Google Calendar...', {
                    reservation_id: reservation.id,
                    employee_id: reservation.employee_id,
                    resource_id: reservation.resource_id,
                    selectedEmployeeId: selectedEmployeeId,
                    selectedTableId: selectedTableId,
                    status: reservation.status
                });
                
                // ✅ Verificar que tenemos employee_id o resource_id antes de sincronizar
                if (!reservation.employee_id && !reservation.resource_id) {
                    console.warn('⚠️ No se puede sincronizar: la reserva no tiene employee_id ni resource_id');
                    toast.warning('⚠️ La reserva se creó pero no se puede sincronizar: no hay empleado o recurso asignado', { duration: 6000 });
                } else {
                    const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
                    body: {
                        business_id: businessId,
                        action: 'push',
                        reservation_id: reservation.id
                    }
                });
                
                if (syncError) {
                        console.error('❌ Error sincronizando con Google Calendar:', syncError);
                        console.error('Error completo:', JSON.stringify(syncError, null, 2));
                        
                        // Intentar parsear el error para mostrar un mensaje más útil
                        let errorMessage = 'Error desconocido';
                        try {
                            if (syncError.message) {
                                errorMessage = syncError.message;
                            } else if (typeof syncError === 'string') {
                                errorMessage = syncError;
                            }
                        } catch (e) {
                            console.error('Error parseando mensaje de error:', e);
                        }
                        
                        toast.error(`⚠️ Error sincronizando con Google Calendar: ${errorMessage}. La reserva se creó correctamente.`, { duration: 8000 });
                    } else {
                        console.log('✅ Respuesta de sync-google-calendar:', syncData);
                        
                        if (syncData?.skipped) {
                            console.warn('⚠️ Sincronización omitida:', syncData);
                            toast.warning(`⚠️ Reserva creada pero no sincronizada: ${syncData.message || 'No hay calendario mapeado para este trabajador'}`, { duration: 7000 });
                        } else if (syncData?.success && syncData?.event_id) {
                            console.log('✅ Evento creado en Google Calendar:', syncData.event_id);
                            toast.success(`✅ Reserva sincronizada con Google Calendar (Evento: ${syncData.event_id.substring(0, 20)}...)`, { duration: 5000 });
                } else {
                            console.warn('⚠️ Respuesta inesperada de sync-google-calendar:', syncData);
                            toast.success('✅ Reserva sincronizada con Google Calendar', { duration: 3000 });
                        }
                    }
                }
            } catch (syncError) {
                console.error('❌ Error en catch de sincronización con Google Calendar:', syncError);
                console.error('Error stack:', syncError?.stack);
                toast.error('⚠️ Error en sincronización con Google Calendar. La reserva se creó correctamente.', { duration: 6000 });
                // Continuar de todas formas
            }
            
            // 5. Marcar slot(s) como ocupado(s) si existe(n)
            // ✅ Los slots se generan con resource_id (para todos los tipos de negocio)
            // Necesitamos actualizar todos los slots que corresponden a esta reserva
            if (availabilityStatus.availableSlots.length > 0) {
                // Buscar slot que coincida con el recurso/mesa seleccionado
                const slotToBook = availabilityStatus.availableSlots.find(slot => 
                    (slot.resource_id && slot.resource_id === selectedTableId) ||
                    (slot.table_id && slot.table_id === selectedTableId)
                ) || availabilityStatus.availableSlots[0];
                
                if (slotToBook && slotToBook.id) {
                    // Calcular cuántos slots necesita esta reserva (basado en duración)
                    const durationMinutes = reservation.duration_minutes || 60;
                    const slotInterval = 15; // Intervalo de slots (15 minutos según migración)
                    const slotsNeeded = Math.ceil(durationMinutes / slotInterval);
                    
                    // Actualizar el slot principal y los siguientes slots necesarios
                    const slotDate = formData.reservation_date;
                    const [slotHour, slotMin] = formData.reservation_time.split(':').map(Number);
                    
                    // Buscar y actualizar todos los slots afectados
                    for (let i = 0; i < slotsNeeded; i++) {
                        const minutesOffset = i * slotInterval;
                        const totalMinutes = slotHour * 60 + slotMin + minutesOffset;
                        const targetHour = Math.floor(totalMinutes / 60);
                        const targetMin = totalMinutes % 60;
                        const targetTime = `${targetHour.toString().padStart(2, '0')}:${targetMin.toString().padStart(2, '0')}`;
                        
                        // Buscar slot específico
                        const { data: slotsToUpdate } = await supabase
                            .from('availability_slots')
                            .select('id')
                            .eq('business_id', businessId)
                            .eq('slot_date', slotDate)
                            .eq('start_time', targetTime)
                            .or(`resource_id.eq.${selectedTableId},table_id.eq.${selectedTableId}`)
                            .eq('status', 'free');
                        
                        if (slotsToUpdate && slotsToUpdate.length > 0) {
                            await supabase
                                .from('availability_slots')
                                .update({
                                    status: 'reserved',
                                    metadata: {
                                        appointment_id: reservation.id, // ✅ Usar appointment_id
                                        customer_name: formData.customer_name,
                                        party_size: formData.party_size
                                    },
                                    updated_at: new Date().toISOString()
                                })
                                .in('id', slotsToUpdate.map(s => s.id));
                        }
                    }
                }
            }
            
            toast.success('✅ Reserva creada correctamente');
            onSave();
            
        } catch (error) {
            console.error('❌ ERROR CRÍTICO al crear reserva:', error);
            console.error('Error completo:', {
                message: error.message,
                code: error.code,
                details: error.details,
                hint: error.hint,
                stack: error.stack
            });
            
            // Mostrar error detallado al usuario
            let errorMessage = 'Error al crear la reserva';
            if (error.message) {
                errorMessage += ': ' + error.message;
            }
            if (error.details) {
                errorMessage += ' (' + error.details + ')';
            }
            
            setValidationError(errorMessage);
            toast.error(errorMessage, { duration: 10000 });
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2">
            <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <h2 className="text-base font-bold text-gray-900">
                        📅 Nueva Reserva
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    {/* Datos del cliente */}
                    <div className="mb-6">
                        <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                            <User className="w-5 h-5" />
                            Datos del Cliente
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Nombre completo *
                                </label>
                                <input
                                    type="text"
                                    value={formData.customer_name}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        customer_name: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="Nombre del cliente"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Teléfono *
                                </label>
                                <input
                                    type="tel"
                                    value={formData.customer_phone}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        customer_phone: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="+34 123 456 789"
                                    required
                                />
                            </div>
                            
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email (opcional)
                                </label>
                                <input
                                    type="email"
                                    value={formData.customer_email}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        customer_email: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    placeholder="cliente@email.com"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Datos de la reserva */}
                    <div className="mb-6">
                        <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                            <Calendar className="w-5 h-5" />
                            Detalles de la Reserva
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Fecha *
                                </label>
                                <input
                                    type="date"
                                    value={formData.reservation_date}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        reservation_date: e.target.value
                                    }))}
                                    min={format(new Date(), 'yyyy-MM-dd')}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Hora *
                                </label>
                                <input
                                    type="time"
                                    value={formData.reservation_time}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        reservation_time: e.target.value
                                    }))}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Personas *
                                </label>
                                <input
                                    type="number"
                                    value={formData.party_size}
                                    onChange={(e) => setFormData(prev => ({
                                        ...prev,
                                        party_size: parseInt(e.target.value) || 1
                                    }))}
                                    min="1"
                                    max="20"
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    required
                                />
                            </div>
                        </div>
                        
                        {/* Mesa específica (opcional) */}
                        <div className="mt-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Mesa específica (opcional)
                            </label>
                            <select
                                value={formData.table_id}
                                onChange={(e) => setFormData(prev => ({
                                    ...prev,
                                    table_id: e.target.value
                                }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            >
                                <option value="">Asignación automática</option>
                                {tables.filter(table => table.is_active).map(table => (
                                    <option key={table.id} value={table.id}>
                                        {table.name} - {table.zone} (Cap: {table.capacity})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Estado de disponibilidad */}
                    <div className="mb-6">
                        {availabilityStatus.checking && (
                            <div className="flex items-center gap-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-600 border-t-transparent"></div>
                                <span className="text-blue-800">Verificando disponibilidad...</span>
                            </div>
                        )}
                        
                        {!availabilityStatus.checking && availabilityStatus.isValid === true && (
                            <div className="flex items-center gap-2 p-2 bg-green-50 border border-green-200 rounded-lg">
                                <CheckCircle2 className="w-5 h-5 text-green-600" />
                                <span className="text-green-800">✅ Disponibilidad confirmada</span>
                            </div>
                        )}
                        
                        {!availabilityStatus.checking && availabilityStatus.isValid === false && (
                            <div className="flex items-center gap-2 p-2 bg-red-50 border border-red-200 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <span className="text-red-800">❌ {availabilityStatus.message}</span>
                            </div>
                        )}
                    </div>

                    {/* Notas especiales */}
                    <div className="mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Peticiones especiales
                        </label>
                        <textarea
                            value={formData.special_requests}
                            onChange={(e) => setFormData(prev => ({
                                ...prev,
                                special_requests: e.target.value
                            }))}
                            rows={3}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                            placeholder="Alergias, preferencias de mesa, celebraciones..."
                        />
                    </div>

                    {/* Error de validación */}
                    {validationError && (
                        <div className="mb-4 p-2 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-red-600" />
                                <span className="text-red-800">{validationError}</span>
                            </div>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={saving || availabilityStatus.checking || availabilityStatus.isValid === false}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {saving ? 'Guardando...' : 'Crear Reserva'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ReservationFormModal;



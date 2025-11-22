// ======================================================================
// MODAL PROFESIONAL DE NUEVA RESERVA - La mejor aplicación del mundo
// ======================================================================
// ✅ USANDO ESQUEMA REAL DE SUPABASE (customers: name, first_name, last_name, phone, email, birthday, total_visits)
// ======================================================================
import React, { useState, useEffect } from 'react';
import { 
    X, Calendar, User, Phone, Mail, Clock, Scissors, Search, Check, 
    AlertCircle, Loader2, Users, Star, MessageSquare, Sparkles, CakeIcon, CheckCircle2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function NewReservationModalPro({
    isOpen,
    onClose,
    businessId,
    prefilledData = {},
    editingReservation = null, // 🆕 Si existe, es modo edición
    onSuccess = () => {}
}) {
    const isEditMode = !!editingReservation;
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [searchResults, setSearchResults] = useState([]);
    const [searching, setSearching] = useState(false);
    const [selectedCustomer, setSelectedCustomer] = useState(null);
    const [showNewCustomerForm, setShowNewCustomerForm] = useState(false);
    const [employees, setEmployees] = useState([]);
    const [services, setServices] = useState([]);
    
    // Estado del formulario COMPLETO - ESQUEMA REAL
    const [formData, setFormData] = useState({
        // DATOS DEL CLIENTE (ESQUEMA REAL SUPABASE)
        name: '', // Nombre completo
        first_name: '',
        last_name: '', // Solo 1 apellido en el esquema real
        customer_phone: '',
        customer_email: '',
        birthday: '',
        
        // DATOS DE LA RESERVA (ESQUEMA REAL appointments)
        employee_id: prefilledData.employee_id || '', // ✅ ID del trabajador (OBLIGATORIO)
        resource_id: '', // ✅ Se obtendrá del trabajador seleccionado (assigned_resource_id)
        service_id: '',
        appointment_date: prefilledData.date || format(new Date(), 'yyyy-MM-dd'), // ✅ appointment_date
        appointment_time: prefilledData.time || '10:00', // ✅ appointment_time
        duration_minutes: 60, // ✅ duration_minutes
        status: 'pending', // ✅ Estado de la reserva
        
        // OPCIONES
        flexible_time: false,
        special_requests: ''
    });

    // Cargar empleados y servicios al abrir
    useEffect(() => {
        if (isOpen && businessId) {
            loadEmployees();
            loadServices();
        }
    }, [isOpen, businessId]);

    // 🆕 Pre-cargar datos en modo edición
    useEffect(() => {
        if (isEditMode && editingReservation) {
            setFormData({
                name: editingReservation.customer_name || '',
                first_name: editingReservation.customer_name?.split(' ')[0] || '',
                last_name: editingReservation.customer_name?.split(' ').slice(1).join(' ') || '',
                customer_phone: editingReservation.customer_phone || '',
                customer_email: editingReservation.customer_email || '',
                birthday: editingReservation.birthday || '',
                employee_id: editingReservation.employee_id || '',
                resource_id: editingReservation.resource_id || '',
                service_id: editingReservation.service_id || '',
                appointment_date: editingReservation.appointment_date || editingReservation.reservation_date || format(new Date(), 'yyyy-MM-dd'),
                appointment_time: editingReservation.appointment_time || editingReservation.reservation_time || '10:00',
                duration_minutes: editingReservation.duration_minutes || 60,
                status: editingReservation.status || 'pending', // ✅ Cargar estado actual
                flexible_time: false,
                special_requests: editingReservation.special_requests || ''
            });
            
            // Pre-seleccionar cliente si existe
            if (editingReservation.customer_id) {
                setSelectedCustomer({
                    id: editingReservation.customer_id,
                    name: editingReservation.customer_name,
                    phone: editingReservation.customer_phone,
                    email: editingReservation.customer_email
                });
            }
        } else if (prefilledData) {
            // Modo creación con datos pre-rellenados del calendario
            setFormData(prev => ({
                ...prev,
                employee_id: prefilledData.employee_id || prev.employee_id,
                appointment_date: prefilledData.date || prev.appointment_date,
                appointment_time: prefilledData.time || prev.appointment_time
            }));
            
            // Si hay employee_id, obtener su resource_id
            if (prefilledData.employee_id) {
                loadEmployeeResource(prefilledData.employee_id);
            }
        }
    }, [isEditMode, editingReservation, prefilledData]);

    const loadEmployees = async () => {
        try {
            const { data, error } = await supabase
                .from('employees')
                .select('id, name')
                .eq('business_id', businessId)
                .eq('is_active', true)
                .order('name');

            if (error) throw error;
            setEmployees(data || []);
        } catch (error) {
            console.error('Error cargando empleados:', error);
        }
    };

    const loadServices = async () => {
        console.log('🔍 Intentando cargar servicios para businessId:', businessId);
        try {
            const { data, error } = await supabase
                .from('business_services')  // ✅ La tabla correcta es 'business_services'
                .select('id, name, duration_minutes, suggested_price, category')  // ✅ Campo correcto: suggested_price
                .eq('business_id', businessId)
                .eq('is_active', true)  // ✅ Solo servicios activos
                .order('position_order', { ascending: true });  // ✅ Ordenar por posición

            if (error) {
                console.error('❌ Error en query de servicios:', error);
                throw error;
            }
            
            console.log('✅ Servicios cargados:', data?.length || 0, data);
            setServices(data || []);
            
            if (!data || data.length === 0) {
                toast.error('No hay servicios activos. Crea servicios en Configuración > Servicios');
            }
        } catch (error) {
            console.error('❌ Error cargando servicios:', error);
            toast.error('Error al cargar servicios: ' + error.message);
        }
    };

    // ✅ Función para obtener el resource_id de un empleado
    const loadEmployeeResource = async (employeeId) => {
        if (!employeeId) {
            setFormData(prev => ({ ...prev, resource_id: '' }));
            return;
        }
        
        try {
            const { data: employee, error } = await supabase
                .from('employees')
                .select('id, name, assigned_resource_id')
                .eq('id', employeeId)
                .eq('business_id', businessId)
                .eq('is_active', true)
                .single();
            
            if (error) {
                console.error('❌ Error obteniendo recurso del empleado:', error);
                toast.error('Error al obtener el recurso del trabajador');
                return;
            }
            
            if (!employee || !employee.assigned_resource_id) {
                console.error('❌ El trabajador no tiene recurso asignado');
                toast.error(`❌ El trabajador "${employee?.name || employeeId}" no tiene un recurso asignado. Asigna un recurso en Configuración > Equipo.`, { duration: 8000 });
                setFormData(prev => ({ ...prev, employee_id: '', resource_id: '' }));
                return;
            }
            
            console.log('✅ Recurso obtenido del trabajador:', {
                employee_id: employee.id,
                employee_name: employee.name,
                resource_id: employee.assigned_resource_id
            });
            
            setFormData(prev => ({
                ...prev,
                employee_id: employee.id,
                resource_id: employee.assigned_resource_id
            }));
        } catch (error) {
            console.error('❌ Error en loadEmployeeResource:', error);
            toast.error('Error al obtener el recurso del trabajador');
        }
    };

    // 🔍 BÚSQUEDA INTELIGENTE: Por teléfono Y nombre (ESQUEMA REAL)
    useEffect(() => {
        const searchCustomers = async () => {
            if (searchTerm.length < 2) {
                setSearchResults([]);
                return;
            }

            setSearching(true);
            try {
                // ESQUEMA REAL: name, first_name, last_name, phone, total_visits
                const { data, error } = await supabase
                    .from('customers')
                    .select('id, name, first_name, last_name, phone, email, total_visits, last_visit_at')
                    .eq('business_id', businessId)
                    .or(`name.ilike.%${searchTerm}%,phone.ilike.%${searchTerm}%`)
                    .order('total_visits', { ascending: false })
                    .limit(10);

                if (error) throw error;
                setSearchResults(data || []);
            } catch (error) {
                console.error('Error buscando clientes:', error);
            } finally {
                setSearching(false);
            }
        };

        const debounce = setTimeout(searchCustomers, 300);
        return () => clearTimeout(debounce);
    }, [searchTerm, businessId]);

    // Seleccionar cliente existente
    const handleSelectCustomer = (customer) => {
        setSelectedCustomer(customer);
        const fullName = customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
        setFormData(prev => ({
            ...prev,
            name: fullName,
            first_name: customer.first_name || '',
            last_name: customer.last_name || '',
            customer_phone: customer.phone || '',
            customer_email: customer.email || ''
        }));
        setSearchTerm('');
        setSearchResults([]);
        setShowNewCustomerForm(false);
    };

    // Cuando se selecciona un servicio, autocompletar duration_minutes
    const handleServiceChange = (serviceId) => {
        const service = services.find(s => s.id === serviceId);
        setFormData(prev => ({
            ...prev,
            service_id: serviceId,
            duration_minutes: service?.duration_minutes || 60
        }));
    };

            // 🔍 VALIDAR DISPONIBILIDAD (evitar conflictos)
            const validateAvailability = async () => {
                try {
                    const appointmentDate = formData.appointment_date;
                    const appointmentTime = formData.appointment_time;
                    const employeeId = formData.employee_id;
                    const resourceId = formData.resource_id;
                    const duration = formData.duration_minutes;
                    
                    if (!employeeId) {
                        toast.error('❌ Debes seleccionar un trabajador');
                        return false;
                    }
                    
                    // 1. Verificar que el empleado trabaja en ese día/hora
                    const { data: employee, error: employeeError } = await supabase
                        .from('employees')
                        .select('*, employee_schedules(*)')
                        .eq('id', employeeId)
                        .single();
            
            if (employeeError || !employee) {
                toast.error('❌ Error al verificar horario del empleado');
                return false;
            }
            
            const dayOfWeek = new Date(appointmentDate).getDay();
            const schedule = employee.employee_schedules?.find(s => s.day_of_week === dayOfWeek && s.is_working);
            
            if (!schedule || !schedule.shifts || schedule.shifts.length === 0) {
                toast.error(`❌ El empleado no trabaja este día. Por favor, selecciona otro día u otro empleado.`);
                return false;
            }
            
            // Verificar que la hora está dentro de algún turno
            const [reqHour, reqMin] = appointmentTime.split(':').map(Number);
            const requestedMinutes = reqHour * 60 + reqMin;
            const endMinutes = requestedMinutes + duration;
            
            const isWithinShift = schedule.shifts.some(shift => {
                const [startH, startM] = shift.start.split(':').map(Number);
                const [endH, endM] = shift.end.split(':').map(Number);
                const shiftStart = startH * 60 + startM;
                const shiftEnd = endH * 60 + endM;
                
                return requestedMinutes >= shiftStart && endMinutes <= shiftEnd;
            });
            
            if (!isWithinShift) {
                const shiftText = schedule.shifts.map(s => `${s.start}-${s.end}`).join(', ');
                toast.error(`❌ La hora seleccionada está fuera del horario del empleado (${shiftText}). Por favor, elige otra hora.`);
                return false;
            }
            
            // 2. Verificar que no haya solapamiento con otras reservas
            const { data: conflictingReservations, error: conflictError } = await supabase
                .from('appointments')
                .select('id, appointment_time, duration_minutes, customer_name')
                .eq('resource_id', resourceId)
                .eq('appointment_date', appointmentDate)
                .neq('status', 'cancelled'); // Ignorar canceladas
            
            if (conflictError) {
                console.error('Error verificando conflictos:', conflictError);
                return true; // Continuar aunque falle la verificación
            }
            
            if (conflictingReservations && conflictingReservations.length > 0) {
                for (const existing of conflictingReservations) {
                    // Saltar la misma reserva si estamos editando
                    if (isEditMode && existing.id === editingReservation.id) continue;
                    
                    const [exHour, exMin] = existing.appointment_time.split(':').map(Number);
                    const exStart = exHour * 60 + exMin;
                    const exEnd = exStart + (existing.duration_minutes || 60);
                    
                    // Verificar solapamiento
                    const overlaps = (requestedMinutes < exEnd) && (endMinutes > exStart);
                    
                    if (overlaps) {
                        toast.error(`❌ Conflicto detectado: Ya existe una reserva de ${existing.customer_name} a las ${existing.appointment_time}. Por favor, elige otra hora.`);
                        return false;
                    }
                }
            }
            
            return true; // ✅ Sin conflictos
        } catch (error) {
            console.error('Error validando disponibilidad:', error);
            return true; // Continuar en caso de error
        }
    };

    // 🚀 GUARDAR RESERVA
    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Validaciones
        if (!formData.first_name.trim()) {
            toast.error('❌ El nombre del cliente es obligatorio');
            return;
        }
        if (!formData.customer_phone.trim()) {
            toast.error('❌ El teléfono del cliente es obligatorio');
            return;
        }
        if (!formData.employee_id) {
            toast.error('❌ Debes seleccionar un trabajador');
            return;
        }
        if (!formData.resource_id) {
            toast.error('❌ El trabajador seleccionado no tiene un recurso asignado. Asigna un recurso en Configuración > Equipo.');
            return;
        }
        if (!formData.service_id) {
            toast.error('❌ Debes seleccionar un servicio');
            return;
        }
        
            // ✅ VALIDACIÓN CRÍTICA: Verificar que tenemos employee_id y resource_id
            if (!formData.employee_id || !formData.resource_id) {
                console.error('❌ CRÍTICO: Faltan employee_id o resource_id:', {
                    employee_id: formData.employee_id,
                    resource_id: formData.resource_id
                });
                toast.error('❌ ERROR: No se puede crear la reserva sin trabajador y recurso asignados.', { duration: 10000 });
                setLoading(false);
                return;
            }
            
            // 🔍 VALIDAR DISPONIBILIDAD
            const isAvailable = await validateAvailability();
            if (!isAvailable) {
                return; // Detener si hay conflictos
            }

        setLoading(true);

        try {
            let customerId = selectedCustomer?.id;
            const fullName = `${formData.first_name} ${formData.last_name || ''}`.trim();

            // 1. CREAR O ACTUALIZAR CLIENTE (ESQUEMA REAL)
            if (!selectedCustomer) {
                // Buscar si ya existe por teléfono
                const { data: existingCustomer } = await supabase
                    .from('customers')
                    .select('id')
                    .eq('business_id', businessId)
                    .eq('phone', formData.customer_phone)
                    .single();

                if (existingCustomer) {
                    // Actualizar cliente existente
                    customerId = existingCustomer.id;
                    await supabase
                        .from('customers')
                        .update({
                            name: fullName,
                            first_name: formData.first_name,
                            last_name: formData.last_name || null,
                            email: formData.customer_email || null,
                            birthday: formData.birthday || null
                        })
                        .eq('id', customerId);
                    
                    console.log('✅ Cliente existente actualizado');
                } else {
                    // Crear nuevo cliente con ESQUEMA REAL
                    const { data: newCustomer, error: customerError } = await supabase
                        .from('customers')
                        .insert({
                            business_id: businessId,
                            name: fullName,
                            first_name: formData.first_name,
                            last_name: formData.last_name || null,
                            phone: formData.customer_phone,
                            email: formData.customer_email || null,
                            birthday: formData.birthday || null,
                            total_visits: 0,
                            total_spent: 0,
                            preferences: {
                                segment: "nuevo",
                                created_automatically: true,
                                created_from: "reservation"
                            },
                            notes: "Cliente creado desde nueva reserva"
                        })
                        .select()
                        .single();

                    if (customerError) throw customerError;
                    customerId = newCustomer.id;
                    console.log('✅ Nuevo cliente creado:', newCustomer);
                }
            } else {
                // Cliente ya seleccionado, solo actualizamos si cambió algo
                await supabase
                    .from('customers')
                    .update({
                        name: fullName,
                        first_name: formData.first_name,
                        last_name: formData.last_name || null,
                        email: formData.customer_email || null,
                        birthday: formData.birthday || null
                    })
                    .eq('id', selectedCustomer.id);
            }

            // 2. CREAR O ACTUALIZAR RESERVA
            const service = services.find(s => s.id === formData.service_id);
            let result = null;
            
            if (isEditMode) {
                // 🔄 MODO EDICIÓN: Actualizar reserva existente
                const { error: reservationError } = await supabase
                    .from('appointments')
                    .update({
                        customer_id: customerId,
                        service_id: formData.service_id,
                        employee_id: formData.employee_id, // ✅ OBLIGATORIO
                        resource_id: formData.resource_id, // ✅ OBLIGATORIO
                        appointment_date: formData.appointment_date,
                        appointment_time: formData.appointment_time,
                        duration_minutes: formData.duration_minutes,
                        status: formData.status, // ✅ Incluir estado en la actualización
                        special_requests: formData.special_requests || null,
                        customer_name: fullName,
                        customer_phone: formData.customer_phone,
                        customer_email: formData.customer_email || null
                    })
                    .eq('id', editingReservation.id);

                if (reservationError) {
                    console.error('❌ ERROR AL ACTUALIZAR RESERVA:', reservationError);
                    throw reservationError;
                }

                console.log('✅ Reserva actualizada');
                toast.success(`✅ Reserva actualizada para ${fullName}`);
                result = editingReservation; // Devolver la reserva editada
            } else {
                // ✨ MODO CREACIÓN: Crear nueva reserva
                const { data: newReservation, error: reservationError } = await supabase
                    .from('appointments')
                    .insert({
                        business_id: businessId,
                        customer_id: customerId,
                        service_id: formData.service_id,
                        employee_id: formData.employee_id, // ✅ OBLIGATORIO: ID del trabajador
                        resource_id: formData.resource_id, // ✅ OBLIGATORIO: Recurso del trabajador
                        appointment_date: formData.appointment_date, // ✅ appointment_date
                        appointment_time: formData.appointment_time, // ✅ appointment_time
                        duration_minutes: formData.duration_minutes, // ✅ duration_minutes
                        status: 'pending', // ✅ SIEMPRE pending - solo se confirma cuando cliente responde WhatsApp
                        special_requests: formData.special_requests || null,
                        channel: 'web', // ✅ enum válido: whatsapp, vapi, phone, email, web, instagram, facebook, google
                        source: 'dashboard',
                        customer_name: fullName,
                        customer_phone: formData.customer_phone,
                        customer_email: formData.customer_email || null
                    })
                    .select()
                    .single();

                if (reservationError) {
                    console.error('❌ ERROR AL CREAR RESERVA:', reservationError);
                    throw reservationError;
                }

                console.log('✅ Reserva creada:', newReservation);
                
                // ✅ VERIFICACIÓN POST-CREACIÓN: Asegurar que tiene employee_id y resource_id
                if (newReservation.resource_id && !newReservation.employee_id) {
                    console.error('❌ CRÍTICO: La reserva se creó pero NO tiene employee_id');
                    console.error('Reserva creada:', newReservation);
                    toast.error('❌ ERROR CRÍTICO: La reserva se creó sin trabajador. Esto no debería ser posible.', { duration: 10000 });
                    
                    // Intentar eliminar la reserva incorrecta
                    try {
                        await supabase.from('appointments').delete().eq('id', newReservation.id);
                        console.log('✅ Reserva incorrecta eliminada');
                    } catch (deleteError) {
                        console.error('❌ Error eliminando reserva incorrecta:', deleteError);
                    }
                    
                    setLoading(false);
                    return;
                }
                
                toast.success(`✅ Reserva creada para ${fullName}`);
                result = newReservation; // Devolver la reserva creada
                
                // ✅ SINCRONIZAR CON GOOGLE CALENDAR
                try {
                    console.log('🔄 Sincronizando reserva con Google Calendar...', newReservation.id);
                    const { data: syncData, error: syncError } = await supabase.functions.invoke('sync-google-calendar', {
                        body: {
                            business_id: businessId,
                            action: 'create',
                            appointment_id: newReservation.id
                        }
                    });
                    
                    if (syncError) {
                        console.error('❌ Error sincronizando con Google Calendar:', syncError);
                        toast.warning('⚠️ Reserva creada pero no se pudo sincronizar con Google Calendar', { duration: 6000 });
                    } else {
                        console.log('✅ Respuesta de sync-google-calendar:', syncData);
                        
                        if (syncData?.skipped) {
                            console.warn('⚠️ Sincronización omitida:', syncData);
                            toast.warning(`⚠️ Reserva creada pero no sincronizada: ${syncData.message || 'No hay calendario mapeado para este trabajador'}`, { duration: 7000 });
                        } else if (syncData?.success && syncData?.event_id) {
                            console.log('✅ Evento creado en Google Calendar:', syncData.event_id);
                            toast.success(`✅ Reserva sincronizada con Google Calendar`, { duration: 5000 });
                        } else {
                            console.warn('⚠️ Respuesta inesperada de sync-google-calendar:', syncData);
                            toast.success('✅ Reserva sincronizada con Google Calendar', { duration: 3000 });
                        }
                    }
                } catch (syncError) {
                    console.error('❌ Error en catch de sincronización con Google Calendar:', syncError);
                    toast.warning('⚠️ Error en sincronización con Google Calendar. La reserva se creó correctamente.', { duration: 6000 });
                    // Continuar de todas formas
                }
            }
            
            // Cerrar modal y limpiar
            onClose();
            resetForm();
            
            // Notificar para que recargue la lista
            onSuccess(result);

        } catch (error) {
            console.error(`❌ Error ${isEditMode ? 'editando' : 'creando'} reserva:`, error);
            toast.error(`❌ Error al ${isEditMode ? 'editar' : 'crear'} la reserva: ` + (error.message || error.hint || JSON.stringify(error)));
        } finally {
            setLoading(false);
        }
    };

    const resetForm = () => {
        setSearchTerm('');
        setSelectedCustomer(null);
        setSearchResults([]);
        setShowNewCustomerForm(false);
        setFormData({
            name: '',
            first_name: '',
            last_name: '',
            customer_phone: '',
            customer_email: '',
            birthday: '',
            employee_id: '', // ✅ Limpiar employee_id
            resource_id: '', // ✅ Limpiar resource_id
            service_id: '',
            appointment_date: format(new Date(), 'yyyy-MM-dd'),
            appointment_time: '10:00',
            duration_minutes: 60,
            status: 'pending',
            flexible_time: false,
            special_requests: ''
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                {/* 🎨 HEADER PROFESIONAL */}
                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-t-2xl sticky top-0 z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <Sparkles className="w-6 h-6" />
                            </div>
                            <div>
                                <h2 className="text-2xl font-bold">{isEditMode ? 'Editar Reserva' : 'Nueva Reserva'}</h2>
                                <p className="text-sm text-white/80">
                                    {isEditMode ? 'Modificar detalles de la cita' : 'Gestión profesional de reservas'}
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* 📋 INFO BOX */}
                <div className="p-6 bg-blue-50 border-b border-blue-200">
                    <div className="flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-900">
                            <p className="font-semibold mb-1">💡 Consejos rápidos</p>
                            <p className="text-blue-700">
                                Busca primero por <strong>teléfono</strong> para ver si el cliente ya existe. 
                                Si es nuevo, completa todos los datos para crear su ficha automáticamente.
                            </p>
                        </div>
                    </div>
                </div>

                {/* 📝 FORMULARIO */}
                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    
                    {/* 🔍 PASO 1: BUSCAR O CREAR CLIENTE */}
                    <div>
                        <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                            <Search className="w-5 h-5 text-blue-600" />
                            Paso 1: Buscar Cliente
                        </h3>

                        {!selectedCustomer && !showNewCustomerForm && (
                            <div className="space-y-3">
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    <input
                                        type="text"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        placeholder="🔍 Buscar por teléfono o nombre..."
                                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                    />
                                    {searching && (
                                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-blue-600 animate-spin" />
                                    )}
                                </div>

                                {/* Resultados de búsqueda */}
                                {searchResults.length > 0 && (
                                    <div className="bg-white border-2 border-gray-200 rounded-lg divide-y max-h-60 overflow-y-auto shadow-lg">
                                        {searchResults.map(customer => {
                                            const displayName = customer.name || `${customer.first_name || ''} ${customer.last_name || ''}`.trim();
                                            return (
                                                <button
                                                    key={customer.id}
                                                    type="button"
                                                    onClick={() => handleSelectCustomer(customer)}
                                                    className="w-full text-left p-4 hover:bg-blue-50 transition-colors"
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div>
                                                            <div className="font-bold text-gray-900 text-lg">
                                                                {displayName}
                                                            </div>
                                                            <div className="text-sm text-gray-600 flex items-center gap-2 mt-1">
                                                                <Phone className="w-3 h-3" />
                                                                {customer.phone}
                                                                {customer.email && (
                                                                    <>
                                                                        <span className="text-gray-400">·</span>
                                                                        <Mail className="w-3 h-3" />
                                                                        {customer.email}
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                        {customer.total_visits > 0 && (
                                                            <div className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-50 px-3 py-1 rounded-full">
                                                                <Star className="w-3 h-3" />
                                                                {customer.total_visits} visita{customer.total_visits > 1 ? 's' : ''}
                                                            </div>
                                                        )}
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}

                                {/* No encontrado */}
                                {searchTerm.length >= 2 && !searching && searchResults.length === 0 && (
                                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                            <div className="flex-1">
                                                <p className="text-sm text-yellow-800 font-medium mb-2">
                                                    No se encontró ningún cliente con "{searchTerm}"
                                                </p>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setShowNewCustomerForm(true);
                                                        // Pre-rellenar teléfono si parece un número
                                                        if (/^\d+$/.test(searchTerm)) {
                                                            setFormData(prev => ({ ...prev, customer_phone: searchTerm }));
                                                        }
                                                    }}
                                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium"
                                                >
                                                    ➕ Crear nuevo cliente
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Botón crear nuevo */}
                                {searchTerm.length === 0 && (
                                    <button
                                        type="button"
                                        onClick={() => setShowNewCustomerForm(true)}
                                        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 hover:bg-blue-50 transition-all text-sm font-medium"
                                    >
                                        ➕ Crear nuevo cliente
                                    </button>
                                )}
                            </div>
                        )}

                        {/* Cliente seleccionado */}
                        {selectedCustomer && !showNewCustomerForm && (
                            <div className="bg-green-50 border-2 border-green-200 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 text-green-800 font-medium mb-2">
                                            <Check className="w-5 h-5" />
                                            Cliente seleccionado
                                        </div>
                                        <p className="font-bold text-gray-900 text-lg">
                                            {selectedCustomer.name || `${selectedCustomer.first_name || ''} ${selectedCustomer.last_name || ''}`.trim()}
                                        </p>
                                        <div className="text-sm text-gray-600 mt-2 space-y-1">
                                            <p className="flex items-center gap-2">
                                                <Phone className="w-3 h-3" />
                                                {selectedCustomer.phone}
                                            </p>
                                            {selectedCustomer.email && (
                                                <p className="flex items-center gap-2">
                                                    <Mail className="w-3 h-3" />
                                                    {selectedCustomer.email}
                                                </p>
                                            )}
                                            {selectedCustomer.total_visits > 0 && (
                                                <p className="flex items-center gap-2 text-purple-600">
                                                    <Star className="w-3 h-3" />
                                                    {selectedCustomer.total_visits} visita{selectedCustomer.total_visits > 1 ? 's' : ''} anterior{selectedCustomer.total_visits > 1 ? 'es' : ''}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setSelectedCustomer(null);
                                            setShowNewCustomerForm(false);
                                        }}
                                        className="text-gray-500 hover:text-gray-700 text-sm underline"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Formulario nuevo cliente */}
                        {showNewCustomerForm && (
                            <div className="space-y-4 bg-gradient-to-br from-gray-50 to-blue-50 p-5 rounded-lg border-2 border-gray-200">
                                <div className="flex items-center justify-between mb-3">
                                    <span className="text-sm font-bold text-gray-700 flex items-center gap-2">
                                        <User className="w-4 h-4" />
                                        Datos del Nuevo Cliente
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setShowNewCustomerForm(false)}
                                        className="text-sm text-gray-600 hover:text-gray-800 underline"
                                    >
                                        Cancelar
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Nombre *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.first_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="María"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Apellido(s)
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.last_name}
                                            onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="García López"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Phone className="w-3 h-3" />
                                            Teléfono *
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.customer_phone}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customer_phone: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="+34 600 000 000"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Mail className="w-3 h-3" />
                                            Email (opcional)
                                        </label>
                                        <input
                                            type="email"
                                            value={formData.customer_email}
                                            onChange={(e) => setFormData(prev => ({ ...prev, customer_email: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            placeholder="email@ejemplo.com"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <CakeIcon className="w-3 h-3" />
                                            Fecha de Nacimiento (opcional)
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.birthday}
                                            onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* 📅 PASO 2: DETALLES DE LA RESERVA */}
                    {(selectedCustomer || showNewCustomerForm) && (
                        <>
                            <div className="border-t-2 border-gray-200 pt-6">
                                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2 text-lg">
                                    <Calendar className="w-5 h-5 text-purple-600" />
                                    Paso 2: Detalles de la Reserva
                                </h3>
                                
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Users className="w-3 h-3" />
                                            Empleado *
                                        </label>
                                        <select
                                            value={formData.employee_id}
                                            onChange={async (e) => {
                                                const selectedEmployeeId = e.target.value;
                                                // ✅ Obtener el resource_id del trabajador seleccionado
                                                await loadEmployeeResource(selectedEmployeeId);
                                            }}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        >
                                            <option value="">Seleccionar empleado</option>
                                            {employees.map(emp => (
                                                <option key={emp.id} value={emp.id}>{emp.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Scissors className="w-3 h-3" />
                                            Servicio *
                                        </label>
                                        <select
                                            value={formData.service_id}
                                            onChange={(e) => handleServiceChange(e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        >
                                            <option value="">Seleccionar servicio</option>
                                            {services.map(service => (
                                                <option key={service.id} value={service.id}>
                                                    {service.name} - {service.duration_minutes} min - €{service.suggested_price || '0'}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Fecha *
                                        </label>
                                        <input
                                            type="date"
                                            value={formData.appointment_date}
                                            onChange={(e) => setFormData(prev => ({ ...prev, appointment_date: e.target.value }))}
                                            min={format(new Date(), 'yyyy-MM-dd')}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <Clock className="w-3 h-3" />
                                            Hora *
                                        </label>
                                        <input
                                            type="time"
                                            value={formData.appointment_time}
                                            onChange={(e) => setFormData(prev => ({ ...prev, appointment_time: e.target.value }))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            required
                                        />
                                    </div>

                                    {/* 🆕 Selector de Estado - Solo visible en modo edición */}
                                    {isEditMode && (
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" />
                                                Estado de la Reserva *
                                            </label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value }))}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                                required
                                            >
                                                <option value="pending">Pendiente</option>
                                                <option value="confirmed">Confirmada</option>
                                                <option value="completed">Completada</option>
                                                <option value="cancelled">Cancelada</option>
                                                <option value="no_show">No-Show</option>
                                            </select>
                                            <p className="text-xs text-gray-500 mt-1">
                                                💡 Puedes cambiar manualmente el estado si el cliente confirma por teléfono, WhatsApp u otro medio
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* ⚙️ PASO 3: OPCIONES AVANZADAS */}
                            <div className="border-t-2 border-gray-200 pt-6">
                                <h3 className="font-bold text-gray-900 mb-3 text-lg">Opciones Adicionales</h3>
                                
                                <div className="space-y-4">
                                    {/* Flexible con hora */}
                                    <label className="flex items-start gap-3 cursor-pointer bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                                        <input
                                            type="checkbox"
                                            checked={formData.flexible_time}
                                            onChange={(e) => setFormData(prev => ({ ...prev, flexible_time: e.target.checked }))}
                                            className="mt-1 w-5 h-5 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                                        />
                                        <div>
                                            <p className="font-medium text-gray-900">Flexible con la hora</p>
                                            <p className="text-sm text-gray-600">
                                                El cliente acepta otras horas disponibles si es necesario
                                            </p>
                                        </div>
                                    </label>

                                    {/* Notas/Requerimientos */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1 flex items-center gap-1">
                                            <MessageSquare className="w-3 h-3" />
                                            Notas o Requerimientos Especiales
                                        </label>
                                        <textarea
                                            value={formData.special_requests}
                                            onChange={(e) => setFormData(prev => ({ ...prev, special_requests: e.target.value }))}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                            rows="3"
                                            placeholder="Ejemplo: Cliente prefiere productos sin amoníaco, tiene alergia a..."
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* 🚀 BOTONES */}
                            <div className="flex gap-3 pt-4 border-t-2 border-gray-200">
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="flex-1 px-6 py-3 bg-gray-100 text-gray-700 rounded-lg font-semibold hover:bg-gray-200 transition-colors"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>
                                            <Loader2 className="w-5 h-5 animate-spin" />
                                            {isEditMode ? 'Guardando...' : 'Creando...'}
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-5 h-5" />
                                            {isEditMode ? 'Guardar Cambios' : 'Crear Reserva'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </>
                    )}
                </form>
            </div>
        </div>
    );
}

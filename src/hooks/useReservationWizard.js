// ======================================================================
// HOOK: useReservationWizard - Manejo de flujo paso a paso
// ======================================================================
// Gestiona el wizard de creación/modificación de reservas con validación
// en tiempo real y sugerencias inteligentes
// ======================================================================

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { ReservationValidationService } from '../services/reservationValidationService';
import { AvailabilityService } from '../services/AvailabilityService';

/**
 * Hook para manejar el wizard de reservas paso a paso
 * @param {string} businessId - ID del restaurante
 * @param {Object} initialData - Datos iniciales de la reserva (para edición)
 * @returns {Object} Estado y métodos del wizard
 */
export const useReservationWizard = (businessId, initialData = null) => {
  
  // ===== ESTADO DEL WIZARD =====
  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [formData, setFormData] = useState({
    customerPhone: initialData?.customer_phone || '',
    customerId: initialData?.customer_id || null,
    customerName: initialData?.customer_name || '',
    firstName: initialData?.first_name || initialData?.customer_name?.split(' ')[0] || '',
    lastName1: initialData?.last_name1 || initialData?.customer_name?.split(' ')[1] || '',
    lastName2: initialData?.last_name2 || initialData?.customer_name?.split(' ')[2] || '',
    customerEmail: initialData?.customer_email || '',
    birthdate: initialData?.birthdate || '',
    date: initialData?.reservation_date || '',
    time: initialData?.reservation_time || '',
    partySize: initialData?.party_size || 2,
    zone: initialData?.zone || null,  // 🆕 Zona seleccionada (interior, terraza, etc.)
    tableIds: initialData?.table_ids || [],  // 🆕 Array de IDs de mesas seleccionadas
    tableId: initialData?.table_id || null,  // Mantener para compatibilidad
    status: initialData?.status || 'pending',
    specialRequests: initialData?.special_requests || ''
  });

  // ===== ESTADO DE VALIDACIONES =====
  const [validations, setValidations] = useState({
    phone: { valid: initialData ? true : null, message: '' },
    date: { valid: initialData ? true : null, message: '', alternatives: [] },
    time: { valid: initialData ? true : null, message: '', alternatives: [] },
    partySize: { valid: initialData ? true : null, message: '' },
    zone: { valid: initialData ? true : null, message: '', zones: [] },  // 🆕 Validación de zona
    table: { valid: initialData ? true : null, message: '' }
  });

  // ===== ESTADO DE DATOS DINÁMICOS =====
  const [existingCustomer, setExistingCustomer] = useState(null);
  const [availableTables, setAvailableTables] = useState([]);
  const [loadingTables, setLoadingTables] = useState(false);
  
  // ===== ESTADO PARA ALTERNATIVAS (NUEVO) =====
  const [suggestedTimes, setSuggestedTimes] = useState([]);
  const [showAlternativesModal, setShowAlternativesModal] = useState(false);
  const hasSearchedAlternativesRef = useRef(false); // 🔥 Ref para evitar búsquedas repetidas
  
  // ===== ESTADO PARA COMBINACIÓN DE MESAS =====
  const [tableCombinationInfo, setTableCombinationInfo] = useState(null);

  // ===== PASOS DEL WIZARD =====
  const STEPS = [
    { id: 1, name: 'Cliente', field: 'customerPhone', icon: '📱' },
    { id: 2, name: 'Fecha', field: 'date', icon: '📅' },
    { id: 3, name: 'Hora', field: 'time', icon: '🕐' },
    { id: 4, name: 'Personas', field: 'partySize', icon: '👥' },
    { id: 5, name: 'Zona', field: 'zone', icon: '📍' },  // 🆕 NUEVO PASO
    { id: 6, name: 'Mesas', field: 'tableIds', icon: '🪑' }  // 🔄 MODIFICADO
  ];

  // ===== PASO 1: BUSCAR CLIENTE POR TELÉFONO (FLEXIBLE: con o sin +34) =====
  const searchCustomerByPhone = useCallback(async (phone) => {
    if (!phone || phone.length < 9) {
      setExistingCustomer(null);
      return;
    }

    try {
      // 🔥 NORMALIZAR TELÉFONO: Buscar con y sin +34
      const phoneVariants = [];
      
      // Si tiene +34, también buscar sin él
      if (phone.startsWith('+34')) {
        phoneVariants.push(phone); // +34XXXXXXXXX
        phoneVariants.push(phone.substring(3)); // XXXXXXXXX (sin +34)
      } 
      // Si NO tiene +34, también buscar con él
      else {
        phoneVariants.push(phone); // XXXXXXXXX
        phoneVariants.push(`+34${phone}`); // +34XXXXXXXXX
      }

      console.log('🔍 Buscando cliente con variantes:', phoneVariants);

      // Buscar con cualquiera de las variantes
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .eq('business_id', businessId)
        .in('phone', phoneVariants)
        .maybeSingle();

      if (error) {
        console.error('Error buscando cliente:', error);
        return;
      }

      if (data) {
        console.log('✅ Cliente encontrado:', data.name);
        setExistingCustomer(data);
        setFormData(prev => ({
          ...prev,
          customerId: data.id,
          customerName: data.name || '',
          firstName: data.first_name || data.name?.split(' ')[0] || '',
          lastName1: data.last_name1 || data.name?.split(' ')[1] || '',
          lastName2: data.last_name2 || data.name?.split(' ')[2] || '',
          customerEmail: data.email || '',
          birthdate: data.birthday || ''  // 🔥 FIX: El campo en BD se llama "birthday"
        }));
      } else {
        console.log('⚠️ Cliente no encontrado');
        setExistingCustomer(null);
        setFormData(prev => ({
          ...prev,
          customerId: null
        }));
      }
    } catch (error) {
      console.error('Error buscando cliente:', error);
    }
  }, [businessId]);

  // ===== PASO 2: VALIDAR FECHA =====
  const validateDate = useCallback(async (date) => {
    if (!date) {
      setValidations(prev => ({
        ...prev,
        date: { valid: null, message: '' }
      }));
      return;
    }

    setIsLoading(true);
    const result = await ReservationValidationService.validateDate(businessId, date);
    
    setValidations(prev => ({
      ...prev,
      date: {
        valid: result.valid,
        message: result.message,
        code: result.code
      }
    }));
    
    setIsLoading(false);
    return result;
  }, [businessId]);

  // ===== PASO 3: VALIDAR HORA =====
  const validateTime = useCallback(async (date, time) => {
    if (!date || !time) {
      setValidations(prev => ({
        ...prev,
        time: { valid: null, message: '', alternatives: [] }
      }));
      setSuggestedTimes([]);
      return;
    }

    setIsLoading(true);
    // 🔥 Pasar el ID de la reserva actual si estamos editando
    const excludeId = initialData?.id || null;
    const result = await ReservationValidationService.validateTime(businessId, date, time, excludeId);
    
    // ❌ NO buscar alternativas en Paso 3 (aún no sabemos partySize)
    // ✅ Las alternativas se buscan SOLO en Paso 5 cuando ya tenemos todos los datos
    setValidations(prev => ({
      ...prev,
      time: result
    }));
    
    setIsLoading(false);
    return result;
  }, [businessId, formData.partySize]);

  // ===== PASO 4: VALIDAR PERSONAS =====
  const validatePartySize = useCallback(async (partySize) => {
    if (!partySize || partySize < 1) {
      setValidations(prev => ({
        ...prev,
        partySize: { valid: null, message: '' }
      }));
      return;
    }

    setIsLoading(true);
    const result = await ReservationValidationService.validatePartySize(businessId, partySize);
    
    setValidations(prev => ({
      ...prev,
      partySize: {
        valid: result.valid,
        message: result.message,
        warning: result.warning,
        code: result.code
      }
    }));
    
    setIsLoading(false);
    return result;
  }, [businessId]);

  // ===== PASO 5: VALIDAR Y CARGAR ZONAS DISPONIBLES =====
  const validateZone = useCallback(async (partySize, date, time) => {
    if (!partySize || !date || !time) {
      setValidations(prev => ({
        ...prev,
        zone: { valid: null, message: '', zones: [] }
      }));
      return;
    }

    setIsLoading(true);

    try {
      // 🔥 OBTENER MESAS REALMENTE DISPONIBLES para esta fecha/hora/personas
      const excludeId = initialData?.id || null;
      const availableTablesResult = await ReservationValidationService.getAvailableTables(
        businessId,
        date,
        time,
        partySize,
        excludeId
      );

      console.log('🔍 validateZone: Resultado de getAvailableTables:', availableTablesResult);

      // Extraer mesas del resultado
      const availableTables = Array.isArray(availableTablesResult) 
        ? availableTablesResult 
        : (availableTablesResult?.tables || []);

      console.log('📊 validateZone: Mesas disponibles:', availableTables.length);

      if (availableTables.length === 0) {
        setValidations(prev => ({
          ...prev,
          zone: {
            valid: false,
            message: 'No hay mesas disponibles para esta fecha/hora',
            zones: []
          }
        }));
        setIsLoading(false);
        return { valid: false, zones: [] };
      }

      // 🔥 AGRUPAR SOLO LAS MESAS DISPONIBLES por zona
      const zoneCapacity = {};
      availableTables.forEach(table => {
        const zone = table.zone || 'interior';  // ✅ Cambio: 'main' → 'interior'
        if (!zoneCapacity[zone]) {
          zoneCapacity[zone] = {
            zone,
            totalCapacity: 0,
            tableCount: 0,
            tables: []
          };
        }
        zoneCapacity[zone].totalCapacity += table.capacity;
        zoneCapacity[zone].tableCount += 1;
        zoneCapacity[zone].tables.push(table);
      });

      // Calcular si cada zona tiene capacidad suficiente
      const availableZones = Object.values(zoneCapacity).map(z => ({
        ...z,
        sufficient: z.totalCapacity >= partySize
      }));

      console.log('✅ validateZone: Zonas disponibles:', availableZones);

      setValidations(prev => ({
        ...prev,
        zone: {
          valid: availableZones.some(z => z.sufficient),
          message: availableZones.some(z => z.sufficient) 
            ? 'Selecciona una zona' 
            : 'No hay capacidad suficiente en ninguna zona',
          zones: availableZones
        }
      }));

      setIsLoading(false);
      return { valid: availableZones.some(z => z.sufficient), zones: availableZones };

    } catch (error) {
      console.error('❌ Error validando zona:', error);
      setIsLoading(false);
      return { valid: false, zones: [] };
    }
  }, [businessId, initialData]);

  // ===== PASO 6: CARGAR MESAS DISPONIBLES DE UNA ZONA =====
  const loadAvailableTables = useCallback(async (date, time, partySize, zone = null) => {
    if (!date || !time || !partySize) {
      setAvailableTables([]);
      return;
    }

    setLoadingTables(true);
    
    // 🔥 Pasar excludeReservationId si estamos editando
    const excludeId = initialData?.id || null;
    
    const result = await ReservationValidationService.getAvailableTables(
      businessId,
      date,
      time,
      partySize,
      excludeId,
      zone  // 🆕 Filtrar por zona
    );
    
    console.log('📊 Resultado completo de getAvailableTables:', result);
    
    // 🔥 FIX: getAvailableTables puede devolver un array directamente O un objeto con tables
    let tables = Array.isArray(result) ? result : (result?.tables || []);
    
    // 🆕 Filtrar por zona si se especificó
    if (zone) {
      tables = tables.filter(t => (t.zone || 'interior') === zone);  // ✅ Cambio: 'main' → 'interior'
      console.log(`📍 Filtrando por zona "${zone}":`, tables.length, 'mesas');
    }
    
    const requiresCombination = result?.requiresCombination || false;
    const resultZone = result?.zone || zone || null;
    const totalCapacity = result?.totalCapacity || null;
    const message = result?.message || '';
    
    console.log('📊 Mesas extraídas:', tables);
    console.log('📊 Requiere combinación:', requiresCombination);
    console.log('📊 Actualizando availableTables con:', tables);
    setAvailableTables(tables);
    setLoadingTables(false);
    
    // Guardar info de combinación si aplica
    if (requiresCombination) {
      setTableCombinationInfo({
        requiresCombination: true,
        zone,
        totalCapacity,
        message,
        tableCount: tables.length
      });
    } else {
      setTableCombinationInfo(null);
    }
    
    // Devolver en formato consistente
    return { 
      success: tables.length > 0, 
      tables,
      requiresCombination,
      zone,
      totalCapacity,
      message
    };
  }, [businessId, initialData]);

  // ===== VALIDAR MESA SELECCIONADA =====
  const validateTable = useCallback(async (tableId, partySize, date, time) => {
    if (!tableId) {
      setValidations(prev => ({
        ...prev,
        table: { valid: null, message: '' }
      }));
      return;
    }

    setIsLoading(true);
    const result = await ReservationValidationService.validateTable(
      businessId,
      tableId,
      partySize,
      date,
      time
    );
    
    setValidations(prev => ({
      ...prev,
      table: {
        valid: result.valid,
        message: result.message,
        code: result.code
      }
    }));
    
    setIsLoading(false);
    return result;
  }, [businessId]);

  // ===== MANEJAR CAMBIO DE CAMPO =====
  const handleFieldChange = useCallback(async (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));

    // Validaciones en tiempo real según el campo
    switch (field) {
      case 'customerPhone':
        if (value.length >= 9) {
          await searchCustomerByPhone(value);
        }
        break;

      case 'date':
        await validateDate(value);
        // Reset campos dependientes
        setValidations(prev => ({
          ...prev,
          time: { valid: null, message: '', alternatives: [] },
          table: { valid: null, message: '' }
        }));
        setAvailableTables([]);
        break;

      case 'time':
        if (formData.date) {
          await validateTime(formData.date, value);
          
          // 🔥 Si estamos editando Y ya hay mesa seleccionada → Re-validarla
          if (initialData && formData.tableId && formData.partySize) {
            console.log('🔄 Re-validando mesa después de cambiar hora...');
            const excludeId = initialData?.id || null;
            const tableResult = await ReservationValidationService.validateTable(
              businessId,
              formData.tableId,
              formData.partySize,
              formData.date,
              value, // Nueva hora
              excludeId
            );
            setValidations(prev => ({
              ...prev,
              table: { valid: tableResult.valid, message: tableResult.message }
            }));
          } else {
            // Reset mesa solo si NO estamos editando
            setValidations(prev => ({
              ...prev,
              table: { valid: null, message: '' }
            }));
            setAvailableTables([]);
          }
        }
        break;

      case 'partySize':
        await validatePartySize(value);
        // Reset mesa
        setValidations(prev => ({
          ...prev,
          table: { valid: null, message: '' }
        }));
        setAvailableTables([]);
        break;

      case 'tableId':
        if (formData.date && formData.time && formData.partySize) {
          console.log('🔍 Validando mesa:', { tableId: value, partySize: formData.partySize, date: formData.date, time: formData.time });
          await validateTable(value, formData.partySize, formData.date, formData.time);
        } else {
          console.warn('⚠️ No se puede validar mesa: faltan datos', { 
            date: formData.date, 
            time: formData.time, 
            partySize: formData.partySize 
          });
        }
        break;

      default:
        break;
    }
  }, [formData.date, formData.time, formData.partySize, searchCustomerByPhone, validateDate, validateTime, validatePartySize, validateTable]);

  // ===== NAVEGACIÓN DEL WIZARD =====
  const goToNextStep = useCallback(() => {
    if (currentStep < STEPS.length) {
      setCurrentStep(prev => prev + 1);
    }
  }, [currentStep, STEPS.length]);

  const goToPreviousStep = useCallback(() => {
    if (currentStep > 1) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const goToStep = useCallback((step) => {
    if (step >= 1 && step <= STEPS.length) {
      setCurrentStep(step);
    }
  }, [STEPS.length]);

  // ===== VERIFICAR SI PASO ACTUAL ESTÁ COMPLETO =====
  const isCurrentStepValid = useCallback(() => {
    switch (currentStep) {
      case 1: // Cliente
        return formData.customerPhone && formData.firstName && formData.lastName1;
      case 2: // Fecha
        return validations.date.valid === true;
      case 3: // Hora
        return validations.time.valid === true;
      case 4: // Personas
        return formData.partySize >= 1 && validations.partySize.valid !== false;
      case 5: // Zona
        return formData.zone !== null;
      case 6: // Mesas
        return formData.tableIds && formData.tableIds.length > 0;
      default:
        return false;
    }
  }, [currentStep, formData, validations]);

  // ===== CARGAR ZONAS AL LLEGAR AL PASO 5 =====
  useEffect(() => {
    if (currentStep === 5 && formData.date && formData.time && formData.partySize) {
      validateZone(formData.partySize, formData.date, formData.time);
    }
  }, [currentStep, formData.date, formData.time, formData.partySize, validateZone]);

  // ===== CARGAR MESAS AL LLEGAR AL PASO 6 =====
  useEffect(() => {
    if (currentStep === 6 && formData.zone && formData.date && formData.time && formData.partySize) {
      loadAvailableTables(formData.date, formData.time, formData.partySize, formData.zone);
    }
  }, [currentStep, formData.zone, formData.date, formData.time, formData.partySize, loadAvailableTables]);

  // ===== BUSCAR ALTERNATIVAS SI NO HAY MESAS EN PASO 6 (SOLO LA PRIMERA VEZ) =====
  useEffect(() => {
    // 🔥 NO buscar alternativas si ya buscamos para esta hora
    if (hasSearchedAlternativesRef.current) {
      console.log('⏭️ Ya buscamos alternativas para esta hora, saltando...');
      return;
    }

    if (currentStep !== 6) return; // Solo en paso 6
    
    const timeoutId = setTimeout(async () => {
      if (
        availableTables.length === 0 && 
        !loadingTables &&
        formData.date && 
        formData.time && 
        formData.partySize &&
        suggestedTimes.length === 0
      ) {
        console.log('🔍 Primera vez en Paso 5 sin mesas, buscando alternativas...');
        hasSearchedAlternativesRef.current = true; // 🔥 Marcar que ya buscamos
        
        try {
          const excludeId = initialData?.id || null;
          const alternatives = await ReservationValidationService.findNearestAlternatives(
            businessId,
            formData.date,
            formData.time,
            formData.partySize,
            6,
            excludeId
          );
          console.log('✅ Alternativas encontradas:', alternatives.length);
          
          const filteredAlternatives = alternatives.filter(alt => alt.time !== formData.time);
          console.log('✅ Alternativas filtradas (sin hora actual):', filteredAlternatives.length);
          
          setSuggestedTimes(filteredAlternatives);
        } catch (error) {
          console.error('❌ Error buscando alternativas:', error);
          setSuggestedTimes([]);
        }
      }
    }, 800);

    return () => clearTimeout(timeoutId);
  }, [currentStep]); // 🔥 SOLO depende de currentStep

  // ===== RE-VALIDAR EN MODO EDICIÓN CUANDO CAMBIAN LOS CAMPOS =====
  useEffect(() => {
    if (!initialData) return; // Solo en modo edición

    // Re-validar fecha si cambió
    if (formData.date && formData.date !== initialData.reservation_date) {
      validateDate(formData.date);
    }

    // Re-validar hora si cambió
    if (formData.time && formData.time !== initialData.reservation_time && formData.date) {
      validateTime(formData.date, formData.time);
    }

    // Re-validar personas si cambió
    if (formData.partySize && formData.partySize !== initialData.party_size) {
      validatePartySize(formData.partySize);
    }

    // Re-validar mesa si cambió
    if (formData.tableId && formData.tableId !== initialData.table_id && formData.date && formData.time && formData.partySize) {
      validateTable(formData.tableId, formData.partySize, formData.date, formData.time);
    }
  }, [formData.date, formData.time, formData.partySize, formData.tableId, initialData, validateDate, validateTime, validatePartySize, validateTable]);

  // ===== MANEJO DE ALTERNATIVAS (NUEVO) =====
  const handleSelectAlternative = useCallback(async (alternative) => {
    console.log('✅ Alternativa seleccionada:', alternative);
    console.log('📊 Datos actuales:', { date: formData.date, partySize: formData.partySize });
    
    // Cerrar modal
    setShowAlternativesModal(false);
    
    // Actualizar la hora con la alternativa seleccionada
    setFormData(prev => ({
      ...prev,
      time: alternative.time
    }));
    
    // 🔥 NO VALIDAR DE NUEVO - La alternativa YA está validada
    // Marcar validaciones como válidas
    setValidations(prev => ({
      ...prev,
      time: {
        valid: true,
        message: `Hora ${alternative.displayTime} disponible`,
        code: 'TIME_AVAILABLE'
      },
      table: { valid: null, message: '' } // Reset table validation
    }));
    
    console.log('🚀 Llamando a loadAvailableTables con:', formData.date, alternative.time, formData.partySize);
    
    // 🔥 Cargar mesas disponibles para la nueva hora DIRECTAMENTE
    const result = await loadAvailableTables(formData.date, alternative.time, formData.partySize);
    
    console.log('📊 Resultado de loadAvailableTables:', result);
    console.log('✅ Mesas cargadas:', result?.tables?.length || 0);
    
    // 🔥 Limpiar sugerencias DESPUÉS de cargar las mesas
    setSuggestedTimes([]);
    
    // Mantener en paso 5 para que vea las mesas disponibles
    setCurrentStep(5);
  }, [formData.date, formData.partySize, loadAvailableTables]);

  const openAlternativesModal = useCallback(() => {
    setShowAlternativesModal(true);
  }, []);

  const closeAlternativesModal = useCallback(() => {
    setShowAlternativesModal(false);
  }, []);

  // ===== RESET WIZARD =====
  const resetWizard = useCallback(() => {
    setCurrentStep(1);
    setFormData({
      customerPhone: '',
      customerId: null,
      customerName: '',
      firstName: '',
      lastName1: '',
      lastName2: '',
      customerEmail: '',
      birthdate: '',
      date: '',
      time: '',
      partySize: 2,
      tableId: null,
      specialRequests: ''
    });
    setValidations({
      phone: { valid: null, message: '' },
      date: { valid: null, message: '', alternatives: [] },
      time: { valid: null, message: '', alternatives: [] },
      partySize: { valid: null, message: '' },
      table: { valid: null, message: '' }
    });
    setExistingCustomer(null);
    setAvailableTables([]);
    setSuggestedTimes([]);
    setShowAlternativesModal(false);
  }, []);

  return {
    // Estado
    currentStep,
    formData,
    validations,
    existingCustomer,
    availableTables,
    isLoading,
    loadingTables,
    STEPS,
    
    // Estado de alternativas (NUEVO)
    suggestedTimes,
    showAlternativesModal,
    
    // Estado de combinación de mesas (NUEVO)
    tableCombinationInfo,
    
    // Métodos de validación
    validateDate,
    validateTime,
    validatePartySize,
    validateZone,  // 🆕 NUEVO
    validateTable,
    loadAvailableTables,
    searchCustomerByPhone,
    
    // Métodos de navegación
    goToNextStep,
    goToPreviousStep,
    goToStep,
    isCurrentStepValid,
    
    // Métodos de cambio
    handleFieldChange,
    setFormData,
    
    // Métodos de alternativas (NUEVO)
    handleSelectAlternative,
    openAlternativesModal,
    closeAlternativesModal,
    
    // Reset
    resetWizard
  };
};

export default useReservationWizard;



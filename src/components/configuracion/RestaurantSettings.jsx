import React, { useState, useCallback } from 'react';
import {
  Building2,
  Clock,
  MapPin,
  Phone,
  Mail,
  Globe,
  Image,
  Save,
  Upload,
  Calendar,
  Utensils,
  Navigation,
  Users,
  DollarSign,
  CheckCircle,
  AlertCircle,
  Info,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAvailabilityChangeDetection } from '../../hooks/useAvailabilityChangeDetection';
import { useRegenerationModal } from '../../hooks/useRegenerationModal';
import RegenerationRequiredModal from '../RegenerationRequiredModal';
import ProtectedReservationsInfoModal from '../ProtectedReservationsInfoModal';
import { useAuthContext } from '../../contexts/AuthContext';
import { useVertical } from '../../hooks/useVertical';
import AutoSlotRegenerationService from '../../services/AutoSlotRegenerationService';

const businessesettings = React.memo(({ restaurant, onUpdate, showOnlyReservas = false }) => {
  const { businessId: businessId, business } = useAuthContext();
  const { labels, name: verticalName } = useVertical(); // 🆕 Hook para adaptar según tipo de negocio
  // Usar restaurant de props o business del contexto como fallback
  const restaurantData = restaurant || business;
  // Los hooks siempre deben llamarse (reglas de React)
  const changeDetection = useAvailabilityChangeDetection(businessId);
  const { isModalOpen, modalChangeReason, modalChangeDetails, showRegenerationModal, closeModal } = useRegenerationModal();
  const [settings, setSettings] = useState({
    name: restaurantData?.name || '',
    contact_name: restaurantData?.settings?.contact_name || restaurantData?.contact_name || '',
    description: restaurantData?.settings?.description || restaurantData?.description || '',
    cuisine_type: restaurantData?.cuisine_type || '',
    phone: restaurantData?.phone || '',
    email: restaurantData?.email || '',
    website: restaurantData?.settings?.website || restaurantData?.website || '',
    address: restaurantData?.address || '',
    city: restaurantData?.city || '',
    postal_code: restaurantData?.postal_code || '',
    capacity: restaurantData?.settings?.capacity_total || restaurantData?.capacity || 50,
    
    // Horarios
    opening_hours: restaurantData?.opening_hours || {
      monday: { open: '12:00', close: '23:00', closed: false },
      tuesday: { open: '12:00', close: '23:00', closed: false },
      wednesday: { open: '12:00', close: '23:00', closed: false },
      thursday: { open: '12:00', close: '23:00', closed: false },
      friday: { open: '12:00', close: '24:00', closed: false },
      saturday: { open: '12:00', close: '24:00', closed: false },
      sunday: { open: '12:00', close: '23:00', closed: false },
    },
    
    // Configuración de reservas
    booking_settings: restaurantData?.booking_settings || restaurantData?.settings?.booking_settings || {
      advance_booking_days: 30,
      min_booking_hours: 2,
      min_advance_minutes: 120, // ⚡ Minutos de antelación mínima (para disponibilidad)
      max_party_size: 12,
      require_confirmation: true,
      allow_modifications: true,
      cancellation_policy: '24h',
    },
  });

  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(showOnlyReservas ? 'reservas' : 'general');
  const [protectedReservations, setProtectedReservations] = useState([]);
  const [showProtectedModal, setShowProtectedModal] = useState(false);

  const handleInputChange = useCallback((field, value) => {
    setSettings(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleNestedChange = useCallback((parent, field, value) => {
    setSettings(prev => ({
      ...prev,
      [parent]: { ...prev[parent], [field]: value }
    }));
  }, []);

  const handleSave = useCallback(async () => {
    setIsLoading(true);
    
    // 🔍 Detectar cambios en configuración crítica
    const previousSettings = {
      opening_hours: restaurantData?.opening_hours,
      booking_settings: restaurantData?.booking_settings || restaurantData?.settings?.booking_settings
    };
    
    try {
      // Filtrar campos que no existen en la tabla businesses
      const { average_ticket, ...settingsToSave } = settings;
      await onUpdate(settingsToSave);
      
      toast.success('Configuración guardada correctamente');
      
      // 🚨 CRÍTICO: Detectar cambios en parámetros de disponibilidad
      const hoursChanged = JSON.stringify(previousSettings.opening_hours) !== JSON.stringify(settings.opening_hours);
      const policyChanged = JSON.stringify(previousSettings.booking_settings) !== JSON.stringify(settings.booking_settings);
      
      // Detectar cambios específicos en configuración de disponibilidad
      const advanceDaysChanged = previousSettings.booking_settings?.advance_booking_days !== settings.booking_settings?.advance_booking_days;
      const minAdvanceChanged = (previousSettings.booking_settings?.min_advance_minutes || previousSettings.booking_settings?.min_booking_hours * 60) !== 
                                (settings.booking_settings?.min_advance_minutes || settings.booking_settings?.min_booking_hours * 60);
      
      if (hoursChanged || policyChanged || advanceDaysChanged || minAdvanceChanged) {
        if (!changeDetection || !businessId) {
          console.warn('⚠️ No se puede regenerar: businessId o changeDetection no disponible');
          return;
        }
        changeDetection.checkExistingSlots().then(async (slotsExist) => {
          if (slotsExist) {
            // ⚡ REGENERACIÓN AUTOMÁTICA EN BACKGROUND
            // En lugar de mostrar modal bloqueante, regenerar automáticamente
            let reason = 'booking_policy_changed';
            let toastMessage = '⚡ Actualizando disponibilidad con la nueva política...';
            
            if (hoursChanged) {
              reason = 'business_hours_changed';
              toastMessage = '⚡ Actualizando disponibilidad con los nuevos horarios...';
            } else if (advanceDaysChanged || minAdvanceChanged) {
              reason = 'availability_settings_changed';
              toastMessage = '⚡ Actualizando disponibilidad con la nueva configuración...';
            }
            
            console.log(`⚡ Regenerando disponibilidad automáticamente - Motivo: ${reason}`);
            
            // Mostrar toast informativo mientras se regenera
            const regenerationToast = toast.loading(
              toastMessage,
              { duration: 5000 }
            );
            
            try {
              // Regenerar automáticamente en background (silent: false para mostrar toast de éxito)
              const result = await AutoSlotRegenerationService.regenerate(businessId, reason, {
                silent: false, // Mostrar toast de éxito
                advanceDays: settings.booking_settings?.advance_booking_days || 30
              });
              
              toast.dismiss(regenerationToast);
              
              if (result.success) {
                toast.success(
                  `✅ Disponibilidad actualizada: ${result.slotsUpdated || 0} slots generados`,
                  { duration: 3000, icon: '✅' }
                );
                
                // 🛡️ Si hay reservas protegidas, mostrar modal informativo (NO bloqueante)
                if (result.protectedReservations && result.protectedReservations.length > 0) {
                  setProtectedReservations(result.protectedReservations);
                  setShowProtectedModal(true);
                }
                
                // Disparar evento para que otros componentes se actualicen
                window.dispatchEvent(new CustomEvent('availabilityRegenerated', {
                  detail: { reason, slotsUpdated: result.slotsUpdated }
                }));
              } else {
                // Si falla, solo mostrar toast de error (NO modal bloqueante)
                toast.error('⚠️ Error al actualizar disponibilidad. Intenta regenerar manualmente desde Disponibilidades.', {
                  duration: 5000
                });
                console.error('❌ Regeneración automática falló:', result.error);
              }
            } catch (error) {
              console.error('❌ Error en regeneración automática:', error);
              toast.dismiss(regenerationToast);
              
              // Si hay error, solo mostrar toast (NO modal bloqueante)
              toast.error('⚠️ Error al actualizar disponibilidad. Intenta regenerar manualmente desde Disponibilidades.', {
                duration: 5000
              });
            }
          } else {
            console.log('✅ No se regenera: usuario está configurando el sistema por primera vez');
          }
        });
      }
    } catch (error) {
      toast.error('Error al guardar la configuración');
    } finally {
      setIsLoading(false);
    }
  }, [settings, onUpdate, restaurantData, changeDetection, showRegenerationModal]);

  const InputField = ({ label, value, onChange, type = 'text', placeholder, required = false, help, icon: Icon }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        {Icon && (
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Icon className="h-5 w-5 text-gray-400" />
          </div>
        )}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`w-full ${Icon ? 'pl-10' : ''} px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent`}
          required={required}
        />
      </div>
      {help && <p className="text-xs text-gray-500">{help}</p>}
    </div>
  );

  const SelectField = ({ label, value, onChange, options, required = false, help }) => (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
        required={required}
      >
        {options.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {help && <p className="text-xs text-gray-500">{help}</p>}
    </div>
  );

  const DaySchedule = ({ day, schedule, onChange }) => (
    <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg">
      <div className="w-20">
        <span className="text-sm font-medium text-gray-700 capitalize">{day}</span>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={!schedule.closed}
          onChange={(e) => onChange(day, 'closed', !e.target.checked)}
          className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
        />
        <span className="text-sm text-gray-600">Abierto</span>
      </div>
      {!schedule.closed && (
        <>
          <input
            type="time"
            value={schedule.open}
            onChange={(e) => onChange(day, 'open', e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
          <span className="text-gray-500">-</span>
          <input
            type="time"
            value={schedule.close}
            onChange={(e) => onChange(day, 'close', e.target.value)}
            className="px-2 py-1 border border-gray-300 rounded text-sm"
          />
        </>
      )}
    </div>
  );

  const cuisineTypes = [
    { value: '', label: 'Seleccionar tipo de cocina' },
    { value: 'mediterranea', label: 'Mediterránea' },
    { value: 'italiana', label: 'Italiana' },
    { value: 'japonesa', label: 'Japonesa' },
    { value: 'mexicana', label: 'Mexicana' },
    { value: 'china', label: 'China' },
    { value: 'india', label: 'India' },
    { value: 'francesa', label: 'Francesa' },
    { value: 'americana', label: 'Americana' },
    { value: 'fusion', label: 'Fusión' },
    { value: 'vegetariana', label: 'Vegetariana' },
    { value: 'vegana', label: 'Vegana' },
  ];

  const tabs = showOnlyReservas 
    ? [{ id: 'reservas', label: 'Reservas', icon: Calendar }]
    : [
        { id: 'general', label: 'General', icon: Building2 },
        { id: 'horarios', label: 'Horarios', icon: Clock },
        { id: 'reservas', label: 'Reservas', icon: Calendar },
      ];

  return (
    <div className="bg-white rounded-xl border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <Building2 className="w-5 h-5 text-purple-600" />
          {showOnlyReservas ? 'Configuración de Reservas' : `Configuración del Negocio`}
        </h3>
        <p className="text-sm text-gray-600 mt-1">
          {showOnlyReservas 
            ? 'Configuración de disponibilidad y políticas de reserva'
            : 'Información básica y configuración general del establecimiento'}
        </p>
      </div>

      {/* Tabs - Solo mostrar si NO es solo reservas */}
      {!showOnlyReservas && (
        <div className="px-6 pt-6">
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex-1 py-2 px-3 text-sm font-medium rounded transition-colors flex items-center justify-center gap-2
                  ${activeTab === tab.id
                    ? 'bg-white text-purple-600 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                  }
                `}
              >
                <tab.icon className="w-4 h-4" />
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="p-6">
        {!showOnlyReservas && activeTab === 'general' && (
          <div className="space-y-6">
            {/* FILA 1: Nombre del Negocio | Tipo (solo si es restaurante) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Nombre del Negocio"
                value={settings.name}
                onChange={(value) => handleInputChange('name', value)}
                placeholder={`Mi ${verticalName}`}
                required
              />
              
              {/* Solo mostrar "Tipo de Cocina" si es restaurante */}
              {restaurantData?.vertical_type === 'restaurante' && (
                <SelectField
                  label="Tipo de Cocina"
                  value={settings.cuisine_type}
                  onChange={(value) => handleInputChange('cuisine_type', value)}
                  options={cuisineTypes}
                />
              )}
            </div>
            
            {/* FILA 2: Email de contacto | Nombre del contacto */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Email de contacto"
                value={settings.email}
                onChange={(value) => handleInputChange('email', value)}
                type="email"
                placeholder="contacto@tunegocio.com"
                icon={Mail}
              />
              
              <InputField
                label="Nombre del contacto"
                value={settings.contact_name}
                onChange={(value) => handleInputChange('contact_name', value)}
                placeholder="Tu nombre"
                icon={Users}
                help="¿Cómo quieres que te llame el sistema?"
              />
            </div>
            
            {/* FILA 3: Sitio web | Teléfono */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Sitio web"
                value={settings.website}
                onChange={(value) => handleInputChange('website', value)}
                placeholder="https://www.tunegocio.com"
                icon={Globe}
              />
              
              <InputField
                label="Teléfono"
                value={settings.phone}
                onChange={(value) => handleInputChange('phone', value)}
                type="tel"
                placeholder="+34 XXX XXX XXX"
                icon={Phone}
              />
            </div>

            {/* Descripción del restaurante */}
            <InputField
              label="Descripción del restaurante"
              value={settings.description}
              onChange={(value) => handleInputChange('description', value)}
              placeholder="Breve descripción del restaurante..."
              help="Esta descripción se usará en las reservas y promociones"
            />

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <InputField
                  label="Dirección"
                  value={settings.address}
                  onChange={(value) => handleInputChange('address', value)}
                  placeholder="Calle Principal 123"
                />
              </div>
              <InputField
                label="Código Postal"
                value={settings.postal_code}
                onChange={(value) => handleInputChange('postal_code', value)}
                placeholder="28001"
              />
            </div>

            <InputField
              label="Ciudad"
              value={settings.city}
              onChange={(value) => handleInputChange('city', value)}
              placeholder="Madrid"
            />

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Capacidad Total"
                value={settings.capacity}
                onChange={(value) => handleInputChange('capacity', parseInt(value) || 0)}
                type="number"
                placeholder="50"
                help="Número máximo de comensales"
              />
              
            </div>
          </div>
        )}

        {activeTab === 'horarios' && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5 text-purple-600" />
              <h4 className="font-medium text-gray-900">Horarios de Apertura</h4>
            </div>
            
            <div className="space-y-3">
              {Object.entries(settings.opening_hours).map(([day, schedule]) => (
                <DaySchedule
                  key={day}
                  day={day}
                  schedule={schedule}
                  onChange={(day, field, value) => 
                    handleNestedChange('opening_hours', day, { ...schedule, [field]: value })
                  }
                />
              ))}
            </div>
          </div>
        )}

        {(showOnlyReservas || activeTab === 'reservas') && (
          <div className="space-y-6">
            {!showOnlyReservas && (
              <div className="flex items-center gap-2 mb-4">
                <Calendar className="w-5 h-5 text-purple-600" />
                <h4 className="font-medium text-gray-900">Configuración de Reservas</h4>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InputField
                label="Días de Anticipación Máxima"
                value={settings.booking_settings.advance_booking_days}
                onChange={(value) => handleNestedChange('booking_settings', 'advance_booking_days', parseInt(value) || 0)}
                type="number"
                placeholder="30"
                help="Máximo días hacia el futuro para generar horarios disponibles"
              />
              
              <InputField
                label="Minutos de Antelación Mínima"
                value={settings.booking_settings.min_advance_minutes || settings.booking_settings.min_booking_hours * 60 || 120}
                onChange={(value) => handleNestedChange('booking_settings', 'min_advance_minutes', parseInt(value) || 120)}
                type="number"
                placeholder="120"
                help="Tiempo mínimo (en minutos) antes de la cita para permitir nuevas reservas"
              />
            </div>
            
            {/* Info sobre generación automática */}
            <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <strong>⚡ Generación Automática:</strong> Los horarios disponibles se generan automáticamente 
                  cuando guardas esta configuración. No necesitas hacer nada más.
                </div>
              </div>
            </div>

            {/* Tamaño Máximo de Grupo - Solo para restaurantes y negocios que lo necesiten */}
            {(restaurantData?.vertical_type === 'restaurante' || restaurantData?.vertical_type === 'yoga_pilates') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InputField
                  label="Tamaño Máximo de Grupo"
                  value={settings.booking_settings.max_party_size}
                  onChange={(value) => handleNestedChange('booking_settings', 'max_party_size', parseInt(value) || 0)}
                  type="number"
                  placeholder="12"
                  help="Número máximo de personas por reserva"
                />
              </div>
            )}

            {/* Política de Cancelación - Útil para todos los negocios */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField
                label="Política de Cancelación"
                value={settings.booking_settings.cancellation_policy}
                onChange={(value) => handleNestedChange('booking_settings', 'cancellation_policy', value)}
                options={[
                  { value: '1h', label: '1 hora antes' },
                  { value: '2h', label: '2 horas antes' },
                  { value: '4h', label: '4 horas antes' },
                  { value: '24h', label: '24 horas antes' },
                  { value: '48h', label: '48 horas antes' },
                  { value: 'none', label: 'Sin política (cancelación libre)' },
                ]}
                help="Tiempo mínimo de antelación para cancelar sin penalización"
              />
            </div>

            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.booking_settings.require_confirmation}
                  onChange={(e) => handleNestedChange('booking_settings', 'require_confirmation', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Requerir confirmación de {labels?.bookings || 'reservas'}
                </label>
                <p className="text-xs text-gray-500 ml-7">Las reservas quedarán pendientes hasta confirmar</p>
              </div>

              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={settings.booking_settings.allow_modifications}
                  onChange={(e) => handleNestedChange('booking_settings', 'allow_modifications', e.target.checked)}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label className="text-sm font-medium text-gray-700">
                  Permitir modificaciones de {labels?.bookings || 'reservas'}
                </label>
                <p className="text-xs text-gray-500 ml-7">Los clientes pueden cambiar fecha/hora después de reservar</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 rounded-b-xl">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600">
            <CheckCircle className="w-4 h-4 inline mr-1 text-green-500" />
            Los cambios se guardan automáticamente
          </div>
          
          <button
            onClick={handleSave}
            disabled={isLoading}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 transition-colors flex items-center gap-2"
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            Guardar Cambios
          </button>
        </div>
      </div>

      {/* 🛡️ Modal informativo de reservas protegidas (NO bloqueante) */}
      <ProtectedReservationsInfoModal
        isOpen={showProtectedModal}
        onClose={() => setShowProtectedModal(false)}
        protectedReservations={protectedReservations}
      />
      
      {/* 🚨 MODAL BLOQUEANTE (solo como fallback en casos extremos - NO debería mostrarse) */}
      <RegenerationRequiredModal
        isOpen={isModalOpen}
        onClose={closeModal}
        changeReason={modalChangeReason}
        changeDetails={modalChangeDetails}
      />
    </div>
  );
});

businessesettings.displayName = 'businessesettings';

export default businessesettings;

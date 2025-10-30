import React, { useState } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { getVerticalOnboardingConfig } from '../../../services/onboardingService';
import toast from 'react-hot-toast';
import { Loader2, CheckCircle2 } from 'lucide-react';

export default function Step1ProfileVertical({ verticals }) {
  const {
    businessName,
    businessPhone,
    businessData,
    selectedVertical,
    setBusinessName,
    setBusinessPhone,
    setBusinessData,
    setSelectedVertical,
    setVerticalConfig,
    setSelectedServices,
    setLoading
  } = useOnboardingStore();

  const [localLoading, setLocalLoading] = useState(false);

  const handleSelectVertical = async (vertical) => {
    setLocalLoading(true);
    setLoading(true);
    setSelectedVertical(vertical);

    try {
      // Llamar a la API para obtener la configuración del vertical
      console.log('📞 Obteniendo configuración para:', vertical.id);
      const { success, config } = await getVerticalOnboardingConfig(vertical.id);

      if (success && config) {
        console.log('✅ Configuración obtenida:', config);
        setVerticalConfig(config);

        // Preparar servicios sugeridos para el Paso 3
        if (config.suggestedServices && config.suggestedServices.length > 0) {
          const servicesWithSelection = config.suggestedServices.map(service => ({
            ...service,
            isSelected: service.is_popular || false,
          }));
          setSelectedServices(servicesWithSelection);
        }

        toast.success(`¡${vertical.name} seleccionado! Ahora completa tus datos`);
      } else {
        // Continuar sin configuración (no es crítico en el MVO de 5 pasos)
        console.warn('⚠️ Configuración no disponible, continuando sin ella');
        toast.success(`¡${vertical.name} seleccionado! Ahora completa tus datos`);
      }
    } catch (error) {
      console.error('❌ Error:', error);
      // No mostrar error al usuario, simplemente continuar
      console.warn('⚠️ Error obteniendo config, pero continuamos');
      toast.success(`¡${vertical.name} seleccionado! Ahora completa tus datos`);
    } finally {
      setLocalLoading(false);
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Título y Descripción */}
      <h2 className="text-lg font-bold text-gray-900 mb-1 text-center">
        ¡Bienvenido a LA-IA!
      </h2>
      <p className="text-center text-gray-600 mb-4 text-xs">
        Empecemos conociendo tu negocio
      </p>

      {/* PRIMERO: Selector de Vertical (si no se ha seleccionado) */}
      {!selectedVertical && (
        <div>
          <h3 className="text-base font-bold text-gray-900 mb-2 text-center">
            ¿Qué tipo de negocio tienes?
          </h3>
          <p className="text-center text-gray-600 mb-4 text-xs">
            Selecciona tu sector para personalizar la experiencia
          </p>

          {/* Loading State */}
          {localLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
              <p className="text-gray-600 font-medium">Cargando configuración...</p>
              <p className="text-sm text-gray-500 mt-2">Esto solo tomará un momento</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {verticals.map((vertical) => {
                const Icon = vertical.icon;

                return (
                  <button
                    key={vertical.id}
                    onClick={() => handleSelectVertical(vertical)}
                    disabled={localLoading}
                    className={`group relative overflow-hidden ${vertical.bgColor} ${vertical.borderColor} border-2 rounded-xl p-3 sm:p-4 transition-all duration-300 ${vertical.hoverColor} hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98] text-left`}
                  >
                    {/* Gradiente de fondo sutil */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    
                    <div className="relative">
                      {/* Icono con gradiente */}
                      <div className={`inline-flex p-2.5 rounded-lg bg-gradient-to-br ${vertical.color} shadow-md group-hover:scale-110 group-hover:rotate-3 transition-transform duration-300 mb-3`}>
                        <Icon className="w-5 h-5 text-white" strokeWidth={2.5} />
                      </div>
                      
                      {/* Título */}
                      <h3 className="text-sm font-bold text-gray-900 mb-1 group-hover:text-gray-900">
                        {vertical.name}
                      </h3>
                      
                      {/* Descripción */}
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {vertical.description}
                      </p>
                    </div>

                    {/* Indicador de selección */}
                    <div className="absolute top-3 right-3 w-6 h-6 rounded-full border-2 border-gray-300 group-hover:border-purple-500 group-hover:bg-purple-500 transition-all duration-300 flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEGUNDO: Formulario de Datos (después de seleccionar vertical) */}
      {selectedVertical && (() => {
        // Buscar el vertical completo desde la lista de verticals (para recuperar el icono)
        const fullVertical = verticals.find(v => v.id === selectedVertical.id) || selectedVertical;
        const IconComponent = fullVertical.icon;
        
        return (
          <div>
            {/* Mostrar el vertical seleccionado */}
            <div className="mb-4 p-3 bg-gradient-to-r from-purple-50 to-blue-50 border border-purple-200 rounded-lg flex items-center gap-3">
              <div className={`p-2 rounded-lg bg-gradient-to-br ${fullVertical.color} shadow-md`}>
                {typeof IconComponent === 'function' ? (
                  <IconComponent className="w-4 h-4 text-white" strokeWidth={2.5} />
                ) : (
                  <div className="w-4 h-4 bg-white rounded" />
                )}
              </div>
              <div className="flex-1">
                <p className="text-xs text-gray-600">Sector seleccionado:</p>
                <p className="text-sm font-bold text-gray-900">{fullVertical.name}</p>
              </div>
              <CheckCircle2 className="w-4 h-4 text-green-600" />
            </div>

          <h3 className="text-base font-bold text-gray-900 mb-3">
            Datos de tu negocio
          </h3>

          {/* Formulario */}
          <div className="space-y-3">
            {/* Nombre del negocio */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Nombre del negocio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="Ej: Centro de Fisioterapia López"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                required
              />
            </div>

            {/* Dirección */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Dirección <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={businessData.address || ''}
                onChange={(e) => setBusinessData({ address: e.target.value })}
                placeholder="Calle Principal 123"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                required
              />
            </div>

            {/* Ciudad y Código Postal */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Ciudad <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessData.city || ''}
                  onChange={(e) => setBusinessData({ city: e.target.value })}
                  placeholder="Madrid"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Código Postal <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={businessData.postalCode || ''}
                  onChange={(e) => setBusinessData({ postalCode: e.target.value })}
                  placeholder="28001"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                  required
                />
              </div>
            </div>

            {/* Teléfono */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Teléfono principal del negocio <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={businessPhone}
                onChange={(e) => setBusinessPhone(e.target.value)}
                placeholder="+34 600 000 000"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-purple-500 focus:border-purple-500 transition-all text-sm"
                required
              />
              <p className="mt-1.5 text-xs text-gray-500">
                💡 El número que desviarás a LA-IA. Tus clientes llamarán aquí.
              </p>
            </div>
          </div>

          {/* Advertencia si faltan campos */}
          {(!businessName || !businessData.address || !businessData.city || !businessData.postalCode || !businessPhone) && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-800 text-center">
                ⚠️ Por favor, completa todos los campos para continuar
              </p>
            </div>
          )}
        </div>
        );
      })()}
    </div>
  );
}

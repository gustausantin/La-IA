import React, { useState, useEffect } from 'react';
import { useOnboardingStore } from '../../../stores/onboardingStore';
import { Phone, MessageCircle, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { assignAvailableNumber } from '../../../services/phoneInventoryService';

const OPERATORS = [
  { id: 'movistar', name: 'Movistar', code: '*21*' },
  { id: 'vodafone', name: 'Vodafone', code: '*21*' },
  { id: 'orange', name: 'Orange', code: '*21*' },
  { id: 'yoigo', name: 'Yoigo', code: '*21*' },
  { id: 'masmovil', name: 'MásMóvil', code: '*21*' },
  { id: 'otro', name: 'Otro operador', code: '*21*' }
];

export default function Step4Connection() {
  const {
    assignedPhone,
    whatsappNumber,
    phoneOperator,
    connectionVerified,
    setAssignedPhone,
    setWhatsappNumber,
    setPhoneOperator,
    setConnectionVerified
  } = useOnboardingStore();

  const [isAssigningNumber, setIsAssigningNumber] = useState(false);
  const [assignmentError, setAssignmentError] = useState(null);

  // Asignar número automáticamente al cargar el componente (solo si no tiene uno ya)
  useEffect(() => {
    if (!assignedPhone && !isAssigningNumber) {
      handleAssignNumber();
    }
  }, []);

  const handleAssignNumber = async () => {
    setIsAssigningNumber(true);
    setAssignmentError(null);
    
    try {
      // Crear un business_id temporal para el onboarding
      // En el Step5, cuando se cree el negocio real, se reasignará
      const tempBusinessId = `temp-${Date.now()}`;
      
      const result = await assignAvailableNumber(tempBusinessId);
      
      if (!result.success) {
        if (result.error === 'NO_INVENTORY') {
          setAssignmentError('No hay números disponibles. Contacta con soporte.');
          toast.error('No hay números telefónicos disponibles en este momento.', { duration: 6000 });
        } else {
          setAssignmentError('Error al asignar número. Por favor, recarga la página.');
          toast.error('Error al asignar número telefónico.');
        }
        return;
      }

      // Guardar el número asignado
      setAssignedPhone(result.assigned_phone);
      toast.success(`Número asignado: ${result.assigned_phone}`);
      
    } catch (error) {
      console.error('Error asignando número:', error);
      setAssignmentError('Error inesperado. Por favor, recarga la página.');
      toast.error('Error al asignar número telefónico.');
    } finally {
      setIsAssigningNumber(false);
    }
  };

  const selectedOperator = OPERATORS.find(op => op.id === phoneOperator);
  const forwardingCode = selectedOperator && assignedPhone ? `${selectedOperator.code}${assignedPhone}#` : '';

  // Mostrar estado de carga mientras se asigna el número
  if (isAssigningNumber) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="w-12 h-12 text-purple-600 animate-spin mb-4" />
        <p className="text-gray-900 font-medium text-lg">Asignando tu número telefónico...</p>
        <p className="text-sm text-gray-500 mt-2">Un momento por favor</p>
      </div>
    );
  }

  // Mostrar error si no se pudo asignar
  if (assignmentError) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-600" />
        </div>
        <p className="text-gray-900 font-bold text-lg mb-2">Error al asignar número</p>
        <p className="text-sm text-gray-600 text-center max-w-md mb-4">{assignmentError}</p>
        <button
          onClick={handleAssignNumber}
          className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Título */}
      <div className="text-center mb-4">
        <div className="inline-flex p-3 bg-purple-100 rounded-full mb-3">
          <Phone className="w-6 h-6 text-purple-600" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-1">
          Conecta tu teléfono
        </h2>
        <p className="text-gray-600 text-xs">
          Último paso: activa el desvío para que LA-IA empiece a trabajar
        </p>
      </div>

      {/* SECCIÓN 1: Desvío de Llamadas (OBLIGATORIO) */}
      <div className="p-4 bg-gradient-to-br from-purple-50 to-blue-50 border-2 border-purple-300 rounded-xl">
        <div className="flex items-start gap-2 mb-3">
          <AlertCircle className="w-5 h-5 text-purple-700 mt-0.5 flex-shrink-0" />
          <div>
            <h3 className="text-base font-bold text-purple-900 mb-1">
              PASO 1 (Obligatorio): Activa el desvío de llamadas
          </h3>
            <p className="text-sm text-purple-800 leading-relaxed">
              <strong>Este es el paso clave.</strong> Para que LA-IA pueda atender tus llamadas, necesitas desviar tu línea cuando no estés disponible.
          </p>
        </div>
      </div>

        {/* 1. Selector de operador */}
        <div className="mb-4">
          <label className="block text-sm font-semibold text-purple-900 mb-2">
            1️⃣ Selecciona tu operador telefónico:
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {OPERATORS.map((operator) => (
              <button
                key={operator.id}
                onClick={() => setPhoneOperator(operator.id)}
                className={`p-2 border-2 rounded-lg transition-all text-sm font-medium ${
                  phoneOperator === operator.id
                    ? 'border-purple-600 bg-purple-100 text-purple-900'
                    : 'border-gray-300 bg-white text-gray-700 hover:border-purple-400'
                }`}
              >
                {operator.name}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Código de desvío */}
        {phoneOperator && (
          <div className="mb-4">
            <label className="block text-sm font-semibold text-purple-900 mb-2">
              2️⃣ Marca este código ÚNICO en tu teléfono:
            </label>
            <div className="flex items-center gap-2 p-3 bg-white border-2 border-purple-300 rounded-lg">
              <code className="text-xl font-bold text-purple-700 flex-1 tracking-wider">
                {forwardingCode}
              </code>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(forwardingCode);
                  toast.success('Código copiado');
                }}
                className="px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-xs font-medium whitespace-nowrap"
              >
                Copiar
              </button>
            </div>
            <p className="text-xs text-purple-700 mt-2 font-medium">
              3️⃣ Pulsa el botón de "llamar" ☎️ en tu móvil
            </p>
          </div>
        )}

        {/* Explicación del desvío */}
        {phoneOperator && (
          <div className="p-3 bg-purple-100 border border-purple-300 rounded-lg">
            <p className="text-sm font-semibold text-purple-900 leading-relaxed">
              📞 Este código desviará las llamadas que no contestes a tu asistente LA-IA para que las atienda automáticamente.
            </p>
          </div>
        )}
      </div>

      {/* SECCIÓN 2: Confirmación Obligatoria */}
      <div className="p-4 bg-white border-2 border-gray-300 rounded-xl">
        <h3 className="text-sm font-bold text-gray-900 mb-2">
          PASO 2: Confirma la activación
        </h3>
        <p className="text-xs text-gray-600 mb-3">
          Una vez hayas marcado el código y pulsado "llamar" en tu móvil, marca esta casilla para continuar.
        </p>
        
        <label className="flex items-start gap-3 cursor-pointer group">
          <input
            type="checkbox"
            checked={connectionVerified}
            onChange={(e) => setConnectionVerified(e.target.checked)}
            className="mt-1 w-5 h-5 text-purple-600 border-2 border-gray-300 rounded focus:ring-2 focus:ring-purple-500 cursor-pointer"
          />
          <span className="text-sm font-medium text-gray-900 group-hover:text-purple-700 transition-colors">
            ✅ Sí, he activado el desvío en mi teléfono.
          </span>
        </label>
      </div>

      {/* SECCIÓN 3: Alertas por WhatsApp (OPCIONAL) */}
      <div className="border-t-2 border-gray-200 pt-4">
        <div className="flex items-center gap-2 mb-3">
          <MessageCircle className="w-5 h-5 text-green-600" />
          <h3 className="text-sm font-bold text-gray-900">
            Alertas urgentes por WhatsApp
            <span className="ml-2 text-xs font-normal text-gray-500">(Recomendado)</span>
          </h3>
        </div>

        <p className="text-xs text-gray-600 mb-3 leading-relaxed">
          Introduce tu WhatsApp. Te enviaremos una alerta <strong>solo si un cliente tiene una queja muy grave o una urgencia</strong> (ej: "mi perro no puede respirar") que LA-IA detecte que no puede resolver.
        </p>

        <input
          type="tel"
          value={whatsappNumber}
          onChange={(e) => setWhatsappNumber(e.target.value)}
          placeholder="+34 600 000 000 (opcional)"
          className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all text-sm"
        />
      </div>

      {/* SECCIÓN 4: Reaseguro Final */}
      <div className="p-3 bg-amber-50 border border-amber-300 rounded-lg">
        <p className="text-xs text-amber-900 text-center leading-relaxed">
          💡 <strong>¡No te preocupes!</strong> Puedes desactivar el desvío en cualquier momento marcando <code className="font-mono bg-amber-200 px-1.5 py-0.5 rounded font-semibold">#21#</code> y pulsando "llamar" en tu móvil.
        </p>
      </div>
    </div>
  );
}


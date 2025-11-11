// ====================================
// TOGGLE ACTIVACIÓN DEL AGENTE
// On/Off con confirmación y guardado automático
// ====================================

import React from 'react';
import { Power } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

export default function AgentToggle({ enabled, businessId, settings, setSettings }) {
  
  const handleToggle = async (newEnabled) => {
    // Confirmación al DESACTIVAR
    if (!newEnabled) {
      const confirmed = window.confirm(
        '⚠️ ¿DESACTIVAR el agente IA?\n\n' +
        'El agente dejará de:\n' +
        '• Responder llamadas telefónicas\n' +
        '• Contestar mensajes de WhatsApp\n' +
        '• Gestionar reservas automáticamente\n\n' +
        'Las reservas manuales seguirán funcionando.'
      );
      if (!confirmed) return;
    }
    
    // ✅ ACTUALIZAR ESTADO LOCAL
    setSettings(prev => ({
      ...prev,
      agent: {
        ...prev.agent,
        enabled: newEnabled
      }
    }));
    
    // ✅ GUARDAR AUTOMÁTICAMENTE EN BD
    try {
      const { error } = await supabase
        .from('businesses')
        .update({
          settings: {
            ...settings,
            agent: {
              ...settings.agent,
              enabled: newEnabled
            }
          }
        })
        .eq('id', businessId);
      
      if (error) throw error;
      
      toast.success(newEnabled 
        ? '✅ Agente ACTIVADO - Ahora atenderá a clientes' 
        : '❌ Agente DESACTIVADO - No responderá a clientes'
      );
    } catch (error) {
      console.error('❌ Error guardando estado del agente:', error);
      toast.error('Error al guardar el cambio');
      // Revertir el cambio
      setSettings(prev => ({
        ...prev,
        agent: {
          ...prev.agent,
          enabled: !newEnabled
        }
      }));
    }
  };

  return (
    <div className={`p-4 rounded-lg border transition-all ${
      enabled 
        ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-green-400 shadow-md' 
        : 'bg-gradient-to-r from-red-50 to-orange-50 border-red-400 shadow-md'
    }`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`p-2 rounded-lg ${
            enabled 
              ? 'bg-green-500 text-white' 
              : 'bg-red-500 text-white'
          }`}>
            <Power className="w-4 h-4" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm">
              {enabled ? "🟢 Agente ACTIVO" : "🔴 Agente DESACTIVADO"}
            </p>
            <p className="text-xs text-gray-700">
              {enabled 
                ? "Atendiendo llamadas 24/7" 
                : "No responderá a clientes"}
            </p>
          </div>
        </div>
        
        {/* Toggle Switch - MÁS PEQUEÑO */}
        <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
          <input
            type="checkbox"
            checked={enabled || false}
            onChange={(e) => handleToggle(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-14 h-7 bg-red-400 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-200 rounded-full peer peer-checked:after:translate-x-7 peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-green-500 shadow-md"></div>
        </label>
      </div>

      {/* Explicación adicional - MÁS COMPACTA */}
      <div className={`p-2 rounded-lg ${
        enabled 
          ? 'bg-green-100 border border-green-300' 
          : 'bg-red-100 border border-red-300'
      }`}>
        <p className="text-xs font-semibold mb-1 flex items-center gap-1.5">
          {enabled ? (
            <>
              <Power className="w-3 h-3 text-green-700" />
              <span className="text-green-900">¿Qué hace cuando está ACTIVO?</span>
            </>
          ) : (
            <>
              <Power className="w-3 h-3 text-red-700" />
              <span className="text-red-900">¿Qué pasa cuando está DESACTIVADO?</span>
            </>
          )}
        </p>
        <ul className={`text-xs space-y-0.5 ml-4 ${
          enabled ? 'text-green-800' : 'text-red-800'
        }`}>
          {enabled ? (
            <>
              <li>✅ Responde llamadas automáticamente</li>
              <li>✅ Gestiona WhatsApp</li>
              <li>✅ Crea reservas sin intervención</li>
            </>
          ) : (
            <>
              <li>❌ NO responderá llamadas</li>
              <li>❌ NO contestará WhatsApp</li>
              <li>⚠️ Sin reservas automáticas</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}



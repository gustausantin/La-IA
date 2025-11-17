// =====================================================
// GESTIÓN DE RECURSOS - MOBILE-FIRST
// Gestión simple de recursos (Sillones, Camillas, Consultorios)
// =====================================================

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { useVertical } from '../../hooks/useVertical';
import { supabase } from '../../lib/supabase';
import { Plus, Edit2, Trash2, Save, X, Briefcase, AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import AutoSlotRegenerationService from '../../services/AutoSlotRegenerationService';

export default function RecursosContent() {
  const { businessId } = useAuthContext();
  const { labels } = useVertical();
  const [resources, setResources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (businessId) {
      loadResources();
    }
  }, [businessId]);

  const loadResources = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('resources')
        .select('*')
        .eq('business_id', businessId)
        .order('resource_number', { ascending: true });

      if (error) throw error;
      setResources(data || []);
    } catch (error) {
      console.error('❌ Error cargando recursos:', error);
      toast.error('Error al cargar recursos');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    const newNumber = resources.length + 1;
    const newName = `${labels.resource} ${newNumber}`;

    try {
      setCreating(true);

      const { data, error } = await supabase
        .from('resources')
        .insert({
          business_id: businessId,
          name: newName,
          resource_number: newNumber.toString(),
          is_active: true,
          capacity: 1
        })
        .select()
        .single();

      if (error) throw error;

      toast.success(`✅ ${newName} creado correctamente`);
      
      // Regenerar slots automáticamente
      await AutoSlotRegenerationService.regenerateAfterAction(
        businessId,
        'resource_created',
        { silent: false }
      );

      loadResources();
    } catch (error) {
      console.error('❌ Error creando recurso:', error);
      toast.error('Error al crear recurso');
    } finally {
      setCreating(false);
    }
  };

  const handleUpdate = async (id, newName) => {
    if (!newName.trim()) {
      toast.error('El nombre no puede estar vacío');
      return;
    }

    try {
      const { error } = await supabase
        .from('resources')
        .update({ 
          name: newName.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Nombre actualizado');
      setEditingId(null);
      loadResources();
    } catch (error) {
      console.error('❌ Error actualizando recurso:', error);
      toast.error('Error al actualizar');
    }
  };

  const handleToggleActive = async (id, currentStatus) => {
    const newStatus = !currentStatus;
    const action = newStatus ? 'activar' : 'desactivar';

    if (!confirm(`¿${action.charAt(0).toUpperCase() + action.slice(1)} este recurso?`)) return;

    try {
      const { error } = await supabase
        .from('resources')
        .update({ 
          is_active: newStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success(`Recurso ${newStatus ? 'activado' : 'desactivado'}`);
      
      // Regenerar slots si se desactiva (afecta disponibilidad)
      if (!newStatus) {
        await AutoSlotRegenerationService.regenerateAfterAction(
          businessId,
          'resource_deactivated',
          { silent: false }
        );
      }

      loadResources();
    } catch (error) {
      console.error('❌ Error cambiando estado:', error);
      toast.error('Error al cambiar estado');
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`¿Eliminar "${name}"?\n\n⚠️ Esta acción no se puede deshacer.`)) return;

    try {
      // ✅ PASO 1: Verificar si tiene EMPLEADOS asignados CON HORARIOS ACTIVOS
      const { data: employeesWithResource, error: employeesError } = await supabase
        .from('employees')
        .select('id, name, assigned_resource_id')
        .eq('business_id', businessId)
        .eq('assigned_resource_id', id)
        .eq('is_active', true);

      if (employeesError) throw employeesError;

      if (employeesWithResource && employeesWithResource.length > 0) {
        // ✅ Verificar si estos empleados tienen horarios activos
        const employeeIds = employeesWithResource.map(e => e.id);
        
        const { data: activeSchedules, error: schedulesError } = await supabase
          .from('employee_schedules')
          .select('employee_id, is_working')
          .in('employee_id', employeeIds)
          .eq('is_working', true)
          .limit(1);

        if (schedulesError) {
          console.warn('⚠️ Error verificando horarios:', schedulesError);
          // Continuar con la validación aunque falle esta verificación
        }

        // Si hay empleados con horarios activos, no permitir eliminar
        if (activeSchedules && activeSchedules.length > 0) {
          const employeeNames = employeesWithResource.map(e => e.name).join(', ');
          toast.error(
            `❌ No puedes eliminar: ${employeesWithResource.length} empleado(s) tiene(n) este recurso asignado Y horarios activos:\n${employeeNames}\n\nPrimero desasigna el recurso o elimina los horarios de los empleados.`,
            { duration: 6000 }
          );
          return;
        }

        // ✅ Si los empleados NO tienen horarios activos, permitir eliminar pero advertir
        // El recurso se desasignará automáticamente por la FK constraint (ON DELETE SET NULL)
        const employeeNames = employeesWithResource.map(e => e.name).join(', ');
        const confirmDelete = window.confirm(
          `⚠️ ADVERTENCIA:\n\n${employeesWithResource.length} empleado(s) tiene(n) este recurso asignado pero SIN horarios activos:\n${employeeNames}\n\nEl recurso se desasignará automáticamente al eliminarlo.\n\n¿Continuar con la eliminación?`
        );

        if (!confirmDelete) {
          return;
        }
      }

      // ✅ PASO 2: Desasignar el recurso de los empleados (si no tienen horarios activos)
      if (employeesWithResource && employeesWithResource.length > 0) {
        // Ya verificamos que no tienen horarios activos, así que podemos desasignar
        const { error: unassignError } = await supabase
          .from('employees')
          .update({ assigned_resource_id: null })
          .in('id', employeesWithResource.map(e => e.id))
          .eq('business_id', businessId);

        if (unassignError) {
          console.error('❌ Error desasignando recurso de empleados:', unassignError);
          toast.error('Error al desasignar el recurso de los empleados');
          return;
        }

        console.log(`✅ Recurso desasignado de ${employeesWithResource.length} empleado(s)`);
      }

      // ✅ PASO 3: Verificar si tiene citas futuras
      const { data: futureAppointments, error: checkError } = await supabase
        .from('appointments')
        .select('id')
        .eq('resource_id', id)
        .gte('appointment_date', new Date().toISOString().split('T')[0])
        .in('status', ['confirmed', 'pending', 'pending_approval'])
        .limit(1);

      if (checkError) throw checkError;

      if (futureAppointments && futureAppointments.length > 0) {
        toast.error('❌ No puedes eliminar: tiene citas futuras confirmadas');
        return;
      }

      // ✅ PASO 4: Eliminar recurso (ya no tiene empleados asignados ni citas futuras)
      const { error } = await supabase
        .from('resources')
        .delete()
        .eq('id', id)
        .eq('business_id', businessId);

      if (error) throw error;

      toast.success('Recurso eliminado');
      
      // Regenerar slots
      await AutoSlotRegenerationService.regenerateAfterAction(
        businessId,
        'resource_deactivated',
        { silent: false }
      );

      loadResources();
    } catch (error) {
      console.error('❌ Error eliminando recurso:', error);
      
      // Error específico de FK constraint
      if (error.code === '23503') {
        // Verificar qué tabla está causando el problema
        if (error.details?.includes('employees')) {
          toast.error('❌ No se puede eliminar: tiene empleados asignados. Primero desasigna el recurso de los empleados.', { duration: 5000 });
        } else {
          toast.error('❌ No se puede eliminar: tiene citas o datos asociados', { duration: 5000 });
        }
      } else {
        toast.error('Error al eliminar recurso');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-8 h-8 text-purple-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* HEADER COMPACTO Y PROFESIONAL */}
      <div className="bg-white border border-gray-200 rounded-xl shadow-sm p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-gray-900">
                {labels?.resources || 'Recursos'}
              </h2>
              <p className="text-xs text-gray-600">
                {resources.length} configurado{resources.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          
          {/* Info compacta */}
          <div className="hidden sm:block text-xs text-gray-600 text-right max-w-xs">
            Gestiona cada {labels?.resource?.toLowerCase() || 'recurso'} de forma independiente
          </div>
        </div>
      </div>

      {/* Lista de recursos */}
      <div className="space-y-2 sm:space-y-3">
        {resources.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-lg p-6 text-center">
            <Briefcase className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600 mb-4">
              No tienes {labels?.resources?.toLowerCase() || 'recursos'} configurados
            </p>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="px-6 py-2.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all shadow-lg disabled:opacity-50"
            >
              {creating ? 'Creando...' : `Crear primer ${labels?.resource || 'recurso'}`}
            </button>
          </div>
        ) : (
          <>
            {resources.map((r, idx) => (
              <div 
                key={r.id} 
                className={`group relative bg-white border rounded-lg p-3 transition-all duration-200 ${
                  r.is_active 
                    ? 'border-gray-200 hover:border-purple-300 hover:shadow-md' 
                    : 'border-gray-200 opacity-60'
                }`}
              >
                {editingId === r.id ? (
                  // Modo edición
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 p-3 border-2 border-purple-400 rounded-lg text-sm font-medium focus:ring-2 focus:ring-purple-500 shadow-sm"
                      placeholder="Nombre del recurso"
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleUpdate(r.id, editingName);
                        if (e.key === 'Escape') setEditingId(null);
                      }}
                    />
                    <button
                      onClick={() => handleUpdate(r.id, editingName)}
                      className="p-3 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors shadow-md min-w-[44px] min-h-[44px]"
                      title="Guardar"
                    >
                      <Save className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-3 bg-gray-300 hover:bg-gray-400 rounded-lg transition-colors min-w-[44px] min-h-[44px]"
                      title="Cancelar"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ) : (
                  // Modo vista - COMPACTO Y PROFESIONAL
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {/* Badge numérico compacto */}
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
                        r.is_active 
                          ? 'bg-gradient-to-br from-purple-600 to-blue-600' 
                          : 'bg-gray-400'
                      }`}>
                        <span className="text-white font-bold text-lg">
                          {r.resource_number}
                        </span>
                      </div>
                      
                      {/* Nombre y estado */}
                      <div className="flex-1 min-w-0">
                        <p className={`font-semibold text-sm truncate ${
                          r.is_active ? 'text-gray-900' : 'text-gray-400'
                        }`}>
                          {r.name}
                        </p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {r.is_active ? (
                            <>
                              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                              <span className="text-xs text-green-700 font-medium">Operativo</span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                              <span className="text-xs text-gray-500 font-medium">Inactivo</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Acciones compactas */}
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {/* Editar */}
                      <button
                        onClick={() => {
                          setEditingId(r.id);
                          setEditingName(r.name);
                        }}
                        className="p-2 hover:bg-purple-100 rounded-lg transition-colors"
                        title="Editar nombre"
                      >
                        <Edit2 className="w-4 h-4 text-gray-600" />
                      </button>

                      {/* Eliminar */}
                      <button
                        onClick={() => handleDelete(r.id, r.name)}
                        className="p-2 hover:bg-red-100 rounded-lg text-red-600 transition-colors"
                        title="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {/* Botón crear nuevo recurso - COMPACTO */}
            <button
              onClick={handleCreate}
              disabled={creating}
              className="w-full p-4 border-2 border-dashed border-purple-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center justify-center gap-2">
                <Plus className="w-5 h-5 text-purple-600" />
                <span className="text-sm font-semibold text-gray-700 group-hover:text-purple-700">
                  {creating ? 'Creando...' : `Añadir ${labels?.resource || 'recurso'}`}
                </span>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Footer informativo */}
      {resources.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs sm:text-sm text-blue-900 font-semibold mb-1">
                💡 Gestión de disponibilidad
              </p>
              <p className="text-xs text-blue-800">
                Para bloquear horarios específicos de cada {labels?.resource?.toLowerCase() || 'recurso'}, 
                ve a <strong>Reservas {'>'} Calendario</strong>.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


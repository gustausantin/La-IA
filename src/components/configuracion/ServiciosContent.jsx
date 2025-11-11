// ====================================
// SERVICIOS CONTENT - Para integrar en Configuracion.jsx
// ====================================

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { 
  Search, Plus, Edit3, Trash2, Save, X, Loader2,
  Clock, Tag, Euro, Palette, FileText
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function ServiciosContent() {
  const { business } = useAuthContext();
  
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedService, setSelectedService] = useState(null);

  useEffect(() => {
    if (business?.id) {
      loadServices();
    }
  }, [business?.id]);

  const loadServices = async () => {
    try {
      setLoading(true);
      // Cargar SOLO los servicios del negocio (business_services)
      const { data, error } = await supabase
        .from('business_services')
        .select('*')
        .eq('business_id', business.id)
        .eq('is_active', true)
        .order('position_order', { ascending: true });

      if (error) throw error;
      setServices(data || []);
    } catch (error) {
      console.error('Error cargando servicios:', error);
      toast.error('Error al cargar servicios');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!confirm('¿Seguro que quieres eliminar este servicio?')) return;
    
    try {
      const { error } = await supabase
        .from('business_services')
        .delete()
        .eq('id', serviceId);

      if (error) throw error;
      
      toast.success('Servicio eliminado');
      loadServices();
    } catch (error) {
      console.error('Error eliminando servicio:', error);
      toast.error('Error al eliminar servicio');
    }
  };

  const filteredServices = services.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar por categoría
  const groupedServices = filteredServices.reduce((acc, service) => {
    const cat = service.category || 'Sin categoría';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(service);
    return acc;
  }, {});

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-purple-600 animate-spin mx-auto mb-3" />
          <p className="text-sm text-gray-600 font-medium">Cargando servicios...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Acciones */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar servicios..."
            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
        
        <button
          onClick={() => setShowAddModal(true)}
          className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Añadir Servicio
        </button>
      </div>

      {/* Lista de servicios - ESTILO BOOKSY */}
      {filteredServices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
          <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Tag className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-bold text-gray-900 mb-2">
            No hay servicios añadidos
          </h3>
          <p className="text-sm text-gray-600 mb-4">
            Añade los servicios que ofreces para empezar
          </p>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold rounded-xl transition-all shadow-lg inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Añadir mi primer servicio
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedServices).map(([category, categoryServices]) => (
            <div key={category}>
              <h2 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
                <div className="w-1 h-6 bg-purple-600 rounded-full" />
                {category}
                <span className="text-sm font-normal text-gray-500">
                  ({categoryServices.length})
                </span>
              </h2>
              
              {/* LISTA SIMPLE - ESTILO BOOKSY */}
              <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden divide-y divide-gray-100">
                {categoryServices.map(service => (
                  <ServiceRow
                    key={service.id}
                    service={service}
                    onEdit={() => {
                      setSelectedService(service);
                      setShowEditModal(true);
                    }}
                    onDelete={() => handleDeleteService(service.id)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modales */}
      {showAddModal && (
        <AddServiceModal
          businessId={business.id}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            loadServices();
          }}
        />
      )}

      {showEditModal && selectedService && (
        <EditServiceModal
          service={selectedService}
          onClose={() => {
            setShowEditModal(false);
            setSelectedService(null);
          }}
          onSuccess={() => {
            setShowEditModal(false);
            setSelectedService(null);
            loadServices();
          }}
        />
      )}
    </div>
  );
}

// ====================================
// COMPONENTE: Fila de Servicio (ESTILO BOOKSY)
// ====================================
function ServiceRow({ service, onEdit, onDelete }) {
  // Generar color aleatorio basado en el id del servicio
  const getColorBar = () => {
    const colors = [
      'bg-blue-500',
      'bg-purple-500', 
      'bg-pink-500',
      'bg-green-500',
      'bg-yellow-500',
      'bg-red-500',
      'bg-indigo-500'
    ];
    const hash = service.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatPrice = () => {
    if (service.suggested_price) return `${parseFloat(service.suggested_price).toFixed(2)} €`;
    return 'Sin precio';
  };

  const formatDuration = () => {
    const hours = Math.floor(service.duration_minutes / 60);
    const mins = service.duration_minutes % 60;
    if (hours > 0 && mins > 0) return `${hours}h ${mins}min`;
    if (hours > 0) return `${hours}h`;
    return `${mins}min`;
  };

  return (
    <div
      onClick={onEdit}
      className="flex items-center gap-4 px-6 py-4 hover:bg-gray-50 transition-colors cursor-pointer group"
    >
      {/* Color bar */}
      <div className={`w-1 h-12 rounded-full ${getColorBar()}`} />
      
      {/* Nombre del servicio */}
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-gray-900 truncate">
          {service.name}
        </h3>
        {service.description && (
          <p className="text-xs text-gray-500 truncate mt-0.5">
            {service.description}
          </p>
        )}
      </div>
      
      {/* Duración */}
      <div className="text-sm text-gray-600 min-w-[80px] text-right">
        {formatDuration()}
      </div>
      
      {/* Precio */}
      <div className="text-sm font-semibold text-gray-900 min-w-[100px] text-right">
        {formatPrice()}
      </div>
      
      {/* Flecha */}
      <div className="text-gray-400 group-hover:text-purple-600 transition-colors">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </div>
  );
}

// ====================================
// MODAL: Añadir Servicio Nuevo
// ====================================
function AddServiceModal({ businessId, onClose, onSuccess }) {
  const { business } = useAuthContext();
  
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState(''); // '' = Otro (personalizado)
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    duration_minutes: 60,
    suggested_price: '',
    description: ''
  });
  const [saving, setSaving] = useState(false);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [isCustom, setIsCustom] = useState(false); // Si es "Otro"

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      console.log('🔍 Cargando templates para vertical:', business.vertical_type);
      
      const { data, error } = await supabase
        .from('service_templates')
        .select('*')
        .eq('vertical_type', business.vertical_type)
        .order('is_popular', { ascending: false })
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('❌ Error en query:', error);
        throw error;
      }
      
      console.log('✅ Templates cargados:', data?.length || 0, data);
      setTemplates(data || []);
    } catch (error) {
      console.error('❌ Error cargando plantillas:', error);
      toast.error('Error cargando servicios predefinidos');
    } finally {
      setLoadingTemplates(false);
    }
  };

  const handleTemplateChange = (templateId) => {
    setSelectedTemplateId(templateId);
    
    if (templateId === 'custom') {
      // Crear personalizado
      setIsCustom(true);
      setFormData({
        name: '',
        category: '',
        duration_minutes: 60,
        suggested_price: '',
        description: ''
      });
    } else {
      // Cargar datos de la plantilla
      setIsCustom(false);
      const template = templates.find(t => t.id === templateId);
      if (template) {
        setFormData({
          name: template.name,
          category: template.category || '',
          duration_minutes: template.duration_minutes || 60,
          suggested_price: template.suggested_price || '',
          description: template.description || ''
        });
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!selectedTemplateId) {
      toast.error('Debes seleccionar un servicio');
      return;
    }

    if (!formData.name.trim()) {
      toast.error('El nombre es obligatorio');
      return;
    }

    if (!formData.duration_minutes || formData.duration_minutes < 1) {
      toast.error('La duración debe ser mayor a 0');
      return;
    }

    setSaving(true);
    try {
      // Insertar en business_services (servicios del negocio)
      const { error } = await supabase
        .from('business_services')
        .insert([{
          business_id: businessId,
          template_id: selectedTemplateId === 'custom' ? null : selectedTemplateId,
          name: formData.name.trim(),
          category: formData.category.trim() || null,
          duration_minutes: parseInt(formData.duration_minutes),
          suggested_price: parseFloat(formData.suggested_price) || null,
          description: formData.description.trim() || null,
          is_active: true,
          position_order: 9999
        }]);

      if (error) throw error;

      toast.success('¡Servicio añadido! ✅');
      onSuccess();
    } catch (error) {
      console.error('Error añadiendo servicio:', error);
      toast.error('Error al añadir servicio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">✨ Crear Servicio Nuevo</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Selector de servicio */}
          <div className="mb-6 pb-6 border-b border-gray-200">
            <label className="block text-sm font-semibold text-gray-900 mb-2">
              ¿Qué servicio ofreces? <span className="text-red-500">*</span>
            </label>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 text-sm font-medium"
              disabled={loadingTemplates}
              required
            >
              <option value="">-- Selecciona un servicio --</option>
              
              {/* Servicios populares primero */}
              {templates.filter(t => t.is_popular).length > 0 && (
                <optgroup label="⭐ Más Populares">
                  {templates.filter(t => t.is_popular).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.duration_minutes ? `• ${t.duration_minutes} min` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              
              {/* Resto de servicios */}
              {templates.filter(t => !t.is_popular).length > 0 && (
                <optgroup label="📋 Todos los servicios">
                  {templates.filter(t => !t.is_popular).map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} {t.duration_minutes ? `• ${t.duration_minutes} min` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              
              {/* Opción personalizada */}
              <option value="custom">➕ Otro (crear personalizado)</option>
            </select>
            <p className="text-xs text-gray-500 mt-2">
              💡 Elige un servicio típico de tu negocio o crea uno personalizado
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Nombre */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Nombre del servicio <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={isCustom ? "Ej: Corte VIP Personalizado" : "Selecciona un servicio arriba"}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
              {selectedTemplateId && selectedTemplateId !== 'custom' && (
                <p className="text-xs text-green-600 mt-1 font-medium">
                  ✅ Cargado desde plantilla (puedes editarlo)
                </p>
              )}
            </div>

            {/* Categoría */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Categoría
              </label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                placeholder="Ej: Cabello"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Duración */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Duración (min) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                min="1"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            {/* Precio sugerido */}
            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Precio sugerido (€)
              </label>
              <input
                type="number"
                value={formData.suggested_price}
                onChange={(e) => setFormData({ ...formData, suggested_price: e.target.value })}
                placeholder="Opcional"
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            {/* Descripción */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Descripción
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descripción del servicio..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </div>

          {/* Botones */}
          <div className="flex gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Crear Servicio
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ====================================
// MODAL: Editar Servicio
// ====================================
function EditServiceModal({ service, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    name: service.name,
    category: service.category || '',
    duration_minutes: service.duration_minutes || 60,
    suggested_price: service.suggested_price || '',
    description: service.description || ''
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    setSaving(true);
    try {
      const { error } = await supabase
        .from('business_services')
        .update({
          name: formData.name.trim(),
          category: formData.category.trim() || null,
          duration_minutes: parseInt(formData.duration_minutes),
          suggested_price: parseFloat(formData.suggested_price) || null,
          description: formData.description.trim() || null
        })
        .eq('id', service.id);

      if (error) throw error;

      toast.success('¡Servicio actualizado! ✅');
      onSuccess();
    } catch (error) {
      console.error('Error actualizando servicio:', error);
      toast.error('Error al actualizar servicio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 overflow-y-auto">
      <div className="bg-white rounded-2xl max-w-2xl w-full my-8 shadow-2xl">
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-gray-900">✏️ Editar Servicio</h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Nombre <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Categoría</label>
              <input
                type="text"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">
                Duración (min) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                value={formData.duration_minutes}
                onChange={(e) => setFormData({ ...formData, duration_minutes: e.target.value })}
                min="1"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-900 mb-1">Precio sugerido (€)</label>
              <input
                type="number"
                value={formData.suggested_price}
                onChange={(e) => setFormData({ ...formData, suggested_price: e.target.value })}
                placeholder="Opcional"
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-900 mb-1">Descripción</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Breve descripción..."
                rows="3"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 resize-none"
              />
            </div>
          </div>

          <div className="flex gap-3 mt-6">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 border border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2"
            >
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" />Guardando...</> : <><Save className="w-4 h-4" />Guardar</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}



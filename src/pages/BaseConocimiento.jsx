// ====================================
// BASE DE CONOCIMIENTO - Sistema RAG
// Upload de documentos del restaurante para que el Agente IA pueda responder preguntas
// ====================================

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Upload, FileText, Trash2, CheckCircle, AlertCircle, 
  Loader, Info, FileUp, X, Calendar, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BaseConocimiento() {
  const { business: restaurant } = useAuthContext();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  
  // Estados para archivos por categoría
  const [menuFiles, setMenuFiles] = useState([]);
  const [serviceFiles, setServiceFiles] = useState([]);
  const [otherFiles, setOtherFiles] = useState([]);
  
  // Límites por categoría (SIMPLIFICADOS)
  const LIMITS = {
    menu: { max: 2, maxSizeMB: 5 },
    services: { max: 1, maxSizeMB: 5 },
    other: { max: 1, maxSizeMB: 5 }
  };
  
  const ACCEPTED_TYPES = {
    'application/pdf': '.pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/msword': '.doc',
    'text/plain': '.txt'
  };

  useEffect(() => {
    if (restaurant?.id) {
      loadFiles();
    }
  }, [restaurant?.id]);

  // Cargar archivos desde Supabase
  const loadFiles = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('restaurant_knowledge_files')
        .select('*')
        .eq('business_id', restaurant.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      // Separar por categoría
      setMenuFiles(data?.filter(f => f.category === 'menu') || []);
      setServiceFiles(data?.filter(f => f.category === 'services') || []);
      setOtherFiles(data?.filter(f => f.category === 'other') || []);
      
      console.log('📚 Archivos cargados:', data?.length || 0);
    } catch (error) {
      console.error('Error al cargar archivos:', error);
      toast.error('Error al cargar archivos');
    } finally {
      setLoading(false);
    }
  };

  // Upload de archivo
  const handleFileUpload = async (file, category) => {
    // Validar tamaño
    const maxSize = LIMITS[category].maxSizeMB * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error(`El archivo es demasiado grande. Máximo ${LIMITS[category].maxSizeMB}MB`);
      return;
    }
    
    // Validar tipo
    if (!ACCEPTED_TYPES[file.type]) {
      toast.error('Formato no soportado. Solo PDF, DOCX, DOC y TXT');
      return;
    }
    
    // Validar límite de archivos
    const currentFiles = getCategoryFiles(category);
    if (currentFiles.length >= LIMITS[category].max) {
      toast.error(`Máximo ${LIMITS[category].max} archivo(s) por categoría`);
      return;
    }
    
    try {
      setUploading(true);
      
      // 1. Subir a Supabase Storage
      const fileName = `${Date.now()}_${file.name}`;
      const filePath = `${restaurant.id}/${category}/${fileName}`;
      
      const { data: storageData, error: storageError } = await supabase.storage
        .from('restaurant-knowledge')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });
      
      if (storageError) throw storageError;
      
      console.log('📤 Archivo subido a Storage:', filePath);
      
      // 2. Crear registro en tabla de tracking
      const { data: fileRecord, error: dbError } = await supabase
        .from('restaurant_knowledge_files')
        .insert({
          business_id: restaurant.id,
          category,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          status: 'processing'
        })
        .select()
        .single();
      
      if (dbError) throw dbError;
      
      console.log('💾 Registro creado en BD:', fileRecord.id);
      
      // 3. Llamar a N8N para procesar
      const n8nWebhook = 'https://gustausantin.app.n8n.cloud/webhook/process-knowledge';
      
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_id: restaurant.id,
          file_path: filePath,
          file_name: file.name,
          file_type: file.type,
          category,
          file_id: fileRecord.id,
          uploaded_at: new Date().toISOString()
        })
      });
      
      if (!response.ok) {
        throw new Error('Error al procesar archivo en N8N');
      }
      
      console.log('🚀 N8N procesando archivo...');
      
      toast.success('Archivo subido. Procesando...');
      
      // Recargar lista de archivos
      await loadFiles();
      
    } catch (error) {
      console.error('Error al subir archivo:', error);
      toast.error('Error al subir archivo: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  // Eliminar archivo
  const handleDelete = async (fileId, filePath) => {
    if (!confirm('¿Estás seguro de eliminar este archivo?')) return;
    
    try {
      // 1. Eliminar de Storage
      const { error: storageError } = await supabase.storage
        .from('restaurant-knowledge')
        .remove([filePath]);
      
      if (storageError) throw storageError;
      
      // 2. Eliminar de BD (el trigger eliminará los vectores automáticamente)
      const { error: dbError } = await supabase
        .from('restaurant_knowledge_files')
        .delete()
        .eq('id', fileId);
      
      if (dbError) throw dbError;
      
      toast.success('Archivo eliminado');
      await loadFiles();
      
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar archivo');
    }
  };

  // Reprocesar archivo (si falló)
  const handleReprocess = async (file) => {
    try {
      const n8nWebhook = 'https://gustausantin.app.n8n.cloud/webhook/process-knowledge';
      
      const response = await fetch(n8nWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          business_id: restaurant.id,
          file_path: file.file_path,
          file_name: file.file_name,
          file_type: file.file_type,
          category: file.category,
          file_id: file.id,
          uploaded_at: file.created_at
        })
      });
      
      if (!response.ok) throw new Error('Error al reprocesar');
      
      toast.success('Reprocesando archivo...');
      
      // Actualizar estado a "processing"
      await supabase
        .from('restaurant_knowledge_files')
        .update({ status: 'processing', error_message: null })
        .eq('id', file.id);
      
      await loadFiles();
      
    } catch (error) {
      console.error('Error al reprocesar:', error);
      toast.error('Error al reprocesar archivo');
    }
  };

  const getCategoryFiles = (category) => {
    switch(category) {
      case 'menu': return menuFiles;
      case 'services': return serviceFiles;
      case 'other': return otherFiles;
      default: return [];
    }
  };

  // Componente: Upload Zone - RESPONSIVE MOBILE-FIRST
  const FileUploadZone = ({ category, title, description, icon: Icon }) => {
    const files = getCategoryFiles(category);
    const limit = LIMITS[category].max;
    const canUpload = files.length < limit;
    
    return (
      <div className="bg-white rounded-lg sm:rounded-xl p-4 sm:p-6 shadow-sm border border-gray-200 mb-4 sm:mb-6">
        {/* Header - Responsive */}
        <div className="flex items-start sm:items-center gap-3 mb-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-purple-100 rounded-lg flex items-center justify-center flex-shrink-0">
            <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-purple-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h3>
            <p className="text-xs sm:text-sm text-gray-500 line-clamp-2">{description}</p>
          </div>
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-500 font-medium">
              {files.length}/{limit}
            </p>
            <p className="text-xs text-gray-400 hidden sm:block">Máx. {LIMITS[category].maxSizeMB}MB</p>
          </div>
        </div>
        
        {/* Upload Area - Touch-Friendly */}
        {canUpload && (
          <label className={`
            block border-2 border-dashed rounded-lg p-4 sm:p-6 text-center cursor-pointer
            transition-colors duration-200 min-h-[120px] flex flex-col items-center justify-center
            ${uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50 active:scale-[0.99]'}
          `}>
            <input
              type="file"
              className="hidden"
              accept={Object.values(ACCEPTED_TYPES).join(',')}
              disabled={uploading}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  handleFileUpload(file, category);
                  e.target.value = ''; // Reset input
                }
              }}
            />
            <FileUp className={`w-8 h-8 sm:w-10 sm:h-10 mx-auto mb-2 ${uploading ? 'text-gray-400' : 'text-purple-600'}`} />
            <p className="text-sm sm:text-base font-medium text-gray-700">
              {uploading ? 'Subiendo...' : 'Toca para subir archivo'}
            </p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1">
              PDF, DOCX, DOC o TXT (máx. {LIMITS[category].maxSizeMB}MB)
            </p>
          </label>
        )}
        
        {!canUpload && (
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 text-center">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Límite alcanzado ({limit} archivos)</p>
          </div>
        )}
        
        {/* Lista de archivos - Responsive */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map(file => (
              <FileItem
                key={file.id}
                file={file}
                onDelete={() => handleDelete(file.id, file.file_path)}
                onReprocess={() => handleReprocess(file)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Componente: File Item - RESPONSIVE MOBILE-FIRST
  const FileItem = ({ file, onDelete, onReprocess }) => {
    const getStatusBadge = () => {
      switch(file.status) {
        case 'completed':
          return (
            <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full whitespace-nowrap">
              <CheckCircle className="w-3 h-3 flex-shrink-0" />
              <span className="hidden sm:inline">Procesado</span>
              <span className="sm:hidden">OK</span>
            </span>
          );
        case 'processing':
          return (
            <span className="flex items-center gap-1 text-xs text-blue-700 bg-blue-100 px-2 py-1 rounded-full whitespace-nowrap">
              <Loader className="w-3 h-3 animate-spin flex-shrink-0" />
              <span className="hidden sm:inline">Procesando...</span>
            </span>
          );
        case 'failed':
          return (
            <span className="flex items-center gap-1 text-xs text-red-700 bg-red-100 px-2 py-1 rounded-full whitespace-nowrap">
              <AlertCircle className="w-3 h-3 flex-shrink-0" />
              <span className="hidden sm:inline">Error</span>
            </span>
          );
        default:
          return null;
      }
    };
    
    return (
      <div className="flex items-start sm:items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg border border-gray-200">
        <FileText className="w-5 h-5 text-gray-600 flex-shrink-0 mt-0.5 sm:mt-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500 mt-1">
            <span className="flex items-center gap-1 whitespace-nowrap">
              <Calendar className="w-3 h-3" />
              <span className="hidden sm:inline">{format(new Date(file.created_at), 'dd MMM yyyy', { locale: es })}</span>
              <span className="sm:hidden">{format(new Date(file.created_at), 'dd/MM', { locale: es })}</span>
            </span>
            {file.processed_at && (
              <span className="flex items-center gap-1 whitespace-nowrap">
                <Clock className="w-3 h-3" />
                {format(new Date(file.processed_at), 'HH:mm', { locale: es })}
              </span>
            )}
            <span className="whitespace-nowrap">{(file.file_size / 1024).toFixed(0)} KB</span>
          </div>
          {file.error_message && (
            <p className="text-xs text-red-600 mt-1 line-clamp-2">{file.error_message}</p>
          )}
        </div>
        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-2">
          {getStatusBadge()}
          <div className="flex items-center gap-1">
            {file.status === 'failed' && (
              <button
                onClick={onReprocess}
                className="text-blue-600 hover:text-blue-700 p-2 hover:bg-blue-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                title="Reprocesar"
              >
                <Loader className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onDelete}
              className="text-red-600 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
              title="Eliminar"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <Loader className="w-8 h-8 sm:w-10 sm:h-10 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Header - Responsive */}
      <div className="mb-4 sm:mb-6 md:mb-8">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mb-2">
          📚 Base de Conocimiento
        </h1>
        <p className="text-sm sm:text-base text-gray-600">
          Sube documentos para que tu Agente IA pueda responder preguntas sobre tu negocio
        </p>
      </div>
      
      {/* Info Alert - Responsive */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4 mb-4 sm:mb-6 flex gap-2 sm:gap-3">
        <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
        <div className="text-xs sm:text-sm text-blue-800">
          <p className="font-semibold mb-2">¿Cómo funciona?</p>
          <ul className="list-disc list-inside space-y-1 text-blue-700">
            <li>Sube tus menús, políticas o información del negocio</li>
            <li>El sistema procesará automáticamente los documentos (1-2 minutos)</li>
            <li>Tu Agente IA podrá responder preguntas sobre el contenido</li>
            <li>Formatos soportados: PDF, Word (.docx/.doc) y TXT</li>
          </ul>
        </div>
      </div>
      
      {/* Upload Zones - Responsive */}
      <FileUploadZone
        category="menu"
        title="🍽️ Menú y Carta"
        description="Menús, cartas de vinos, opciones especiales..."
        icon={FileText}
      />
      
      <FileUploadZone
        category="services"
        title="🏢 Servicios del Negocio"
        description="Políticas, servicios disponibles, información importante..."
        icon={Info}
      />
      
      <FileUploadZone
        category="other"
        title="ℹ️ Información Adicional"
        description="Historia, eventos, promociones..."
        icon={Calendar}
      />
    </div>
  );
}



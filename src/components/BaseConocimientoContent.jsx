// ====================================
// BASE DE CONOCIMIENTO - Contenido (sin wrapper de página)
// Para usar dentro de Configuración
// ====================================

import React, { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  FileText, Trash2, CheckCircle, AlertCircle, 
  Loader, FileUp, Calendar, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export default function BaseConocimientoContent() {
  const { restaurant } = useAuthContext();
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
    'text/plain': '.txt',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.google-apps.document': '.gdoc',
    'application/vnd.google-apps.spreadsheet': '.gsheet'
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
        .eq('restaurant_id', restaurant.id)
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
      toast.error('Formato no soportado. Solo PDF, TXT, Excel (XLSX/XLS), Google Docs y Google Sheets');
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
      
      // 2. Crear registro en tabla de tracking (directamente como "completed")
      const { data: fileRecord, error: dbError } = await supabase
        .from('restaurant_knowledge_files')
        .insert({
          restaurant_id: restaurant.id,
          category,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          file_type: file.type,
          status: 'completed',
          processed_at: new Date().toISOString()
        })
        .select()
        .single();
      
      if (dbError) throw dbError;
      
      console.log('💾 Registro creado en BD:', fileRecord.id);
      console.log('✅ Archivo listo para usar');
      
      toast.success('Archivo subido correctamente');
      
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
      console.log('🗑️ Eliminando archivo:', { fileId, filePath });
      
      // 1. Eliminar de Supabase Storage (ignorar si no existe)
      const { error: storageError } = await supabase.storage
        .from('restaurant-knowledge')
        .remove([filePath]);
      
      if (storageError && storageError.message !== 'Not found') {
        console.warn('⚠️ Error al eliminar de Storage (puede que ya no exista):', storageError);
      } else {
        console.log('✅✅✅ ARCHIVO ELIMINADO DE STORAGE - VERSIÓN NUEVA');
      }
      
      // 2. Eliminar registro de BD (ignorar si no existe)
      const { error: dbError, count } = await supabase
        .from('restaurant_knowledge_files')
        .delete({ count: 'exact' })
        .eq('id', fileId)
        .eq('restaurant_id', restaurant.id);
      
      // Ignorar error 404 (PGRST116 = no rows found)
      if (dbError && dbError.code !== 'PGRST116') {
        console.error('❌ Error al eliminar de BD:', dbError);
        // No lanzar error, solo advertir
        console.warn('⚠️ Error no crítico al eliminar de BD');
      }
      
      if (count === 0) {
        console.log('⚠️ El archivo ya no existía en BD');
      } else {
        console.log('✅ Registro eliminado de BD');
      }
      
      toast.success('Archivo eliminado correctamente');
      await loadFiles();
      
    } catch (error) {
      console.error('Error al eliminar:', error);
      toast.error('Error al eliminar archivo: ' + error.message);
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

  // Componente: Upload Zone
  const FileUploadZone = ({ category, title, description, icon: Icon }) => {
    const files = getCategoryFiles(category);
    const limit = LIMITS[category].max;
    const canUpload = files.length < limit;
    
    return (
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-200 mb-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
            <Icon className="w-6 h-6 text-purple-600" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
            <p className="text-sm text-gray-500">{description}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-gray-500">
              {files.length} / {limit} archivos
            </p>
            <p className="text-xs text-gray-400">Máx. {LIMITS[category].maxSizeMB}MB</p>
          </div>
        </div>
        
        {/* Upload Area */}
        {canUpload && (
          <label className={`
            block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
            transition-colors duration-200
            ${uploading ? 'border-gray-200 bg-gray-50 cursor-not-allowed' : 'border-purple-300 hover:border-purple-500 hover:bg-purple-50'}
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
            <FileUp className={`w-8 h-8 mx-auto mb-2 ${uploading ? 'text-gray-400' : 'text-purple-600'}`} />
            <p className="text-sm font-medium text-gray-700">
              {uploading ? 'Subiendo...' : 'Click para subir archivo'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              PDF, TXT, Excel, Google Docs/Sheets
            </p>
          </label>
        )}
        
        {!canUpload && (
          <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 text-center">
            <AlertCircle className="w-6 h-6 mx-auto mb-2 text-gray-400" />
            <p className="text-sm text-gray-600">Límite alcanzado ({limit} archivos)</p>
          </div>
        )}
        
        {/* Lista de archivos */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2">
            {files.map(file => (
              <FileItem
                key={file.id}
                file={file}
                onDelete={() => handleDelete(file.id, file.file_path)}
              />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Componente: File Item
  const FileItem = ({ file, onDelete }) => {
    return (
      <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
        <FileText className="w-5 h-5 text-gray-600 flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900 truncate">{file.file_name}</p>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(file.created_at), 'dd MMM yyyy', { locale: es })}
            </span>
            {file.processed_at && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(file.processed_at), 'HH:mm', { locale: es })}
              </span>
            )}
            <span>{(file.file_size / 1024).toFixed(0)} KB</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1 text-xs text-green-700 bg-green-100 px-2 py-1 rounded-full">
            <CheckCircle className="w-3 h-3" />
            Listo
          </span>
          <button
            onClick={onDelete}
            className="text-red-600 hover:text-red-700 p-1"
            title="Eliminar"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Upload Zones */}
      <FileUploadZone
        category="menu"
        title="🍽️ Menú y Carta"
        description="Menús, cartas de vinos, opciones especiales..."
        icon={FileText}
      />
      
      <FileUploadZone
        category="services"
        title="🏢 Servicios del Restaurante"
        description="Políticas, servicios disponibles, información importante..."
        icon={AlertCircle}
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


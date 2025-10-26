import { useState, useEffect, useMemo, useCallback, useRef } from 'react';

/**
 * 🚀 OPTIMIZED FILTERS HOOK
 * Sistema de filtros ultra optimizado con debounce, cache y virtualización
 */

// Hook para debounce avanzado con cancelación
export const useAdvancedDebounce = (value, delay = 300, options = {}) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  const timerRef = useRef();
  const { immediate = false, maxWait = null } = options;

  useEffect(() => {
    if (immediate && !timerRef.current) {
      setDebouncedValue(value);
    }

    clearTimeout(timerRef.current);
    
    timerRef.current = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    // MaxWait implementation
    if (maxWait) {
      const maxTimer = setTimeout(() => {
        setDebouncedValue(value);
      }, maxWait);
      
      return () => {
        clearTimeout(timerRef.current);
        clearTimeout(maxTimer);
      };
    }

    return () => clearTimeout(timerRef.current);
  }, [value, delay, immediate, maxWait]);

  const cancelDebounce = useCallback(() => {
    clearTimeout(timerRef.current);
    setDebouncedValue(value);
  }, [value]);

  return [debouncedValue, cancelDebounce];
};

// Hook para filtros optimizados con cache
export const useOptimizedFilters = (data, initialFilters = {}, options = {}) => {
  const {
    debounceDelay = 300,
    enableCache = true,
    maxCacheSize = 50,
    virtualizeThreshold = 1000,
    sortOptions = {},
    filterFunctions = {}
  } = options;

  const [filters, setFilters] = useState(initialFilters);
  const [sortConfig, setSortConfig] = useState(sortOptions.default || { key: null, direction: 'asc' });
  const cacheRef = useRef(new Map());
  
  // Debounce para filtros de texto
  const [debouncedSearch] = useAdvancedDebounce(
    filters.search || '', 
    debounceDelay,
    { maxWait: debounceDelay * 3 }
  );

  // Función de filtrado optimizada con cache
  const filteredData = useMemo(() => {
    if (!data || !Array.isArray(data)) return [];

    // Crear clave de cache
    const cacheKey = JSON.stringify({ 
      filters: { ...filters, search: debouncedSearch }, 
      sortConfig,
      dataLength: data.length 
    });

    // Verificar cache si está habilitado
    if (enableCache && cacheRef.current.has(cacheKey)) {
      return cacheRef.current.get(cacheKey);
    }

    let result = [...data];

    // Aplicar filtros personalizados
    Object.entries(filters).forEach(([key, value]) => {
      if (!value || key === 'search') return;
      
      if (filterFunctions[key]) {
        result = result.filter(item => filterFunctions[key](item, value));
      } else {
        // Filtro genérico
        result = result.filter(item => {
          const itemValue = item[key];
          if (typeof value === 'string') {
            return String(itemValue).toLowerCase().includes(value.toLowerCase());
          }
          return itemValue === value;
        });
      }
    });

    // Aplicar búsqueda de texto
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      result = result.filter(item => {
        return Object.values(item).some(value => 
          String(value).toLowerCase().includes(searchLower)
        );
      });
    }

    // Aplicar ordenamiento
    if (sortConfig.key) {
      result.sort((a, b) => {
        const aValue = a[sortConfig.key];
        const bValue = b[sortConfig.key];
        
        if (aValue === bValue) return 0;
        
        const comparison = aValue < bValue ? -1 : 1;
        return sortConfig.direction === 'desc' ? comparison * -1 : comparison;
      });
    }

    // Guardar en cache si está habilitado
    if (enableCache) {
      // Limpiar cache si excede el tamaño máximo
      if (cacheRef.current.size >= maxCacheSize) {
        const firstKey = cacheRef.current.keys().next().value;
        cacheRef.current.delete(firstKey);
      }
      cacheRef.current.set(cacheKey, result);
    }

    return result;
  }, [data, filters, debouncedSearch, sortConfig, filterFunctions, enableCache, maxCacheSize]);

  // Paginación optimizada
  const [pagination, setPagination] = useState({
    page: 1,
    pageSize: virtualizeThreshold > 0 ? Math.min(50, virtualizeThreshold) : 50
  });

  const paginatedData = useMemo(() => {
    const start = (pagination.page - 1) * pagination.pageSize;
    const end = start + pagination.pageSize;
    return filteredData.slice(start, end);
  }, [filteredData, pagination]);

  // Métodos optimizados
  const updateFilter = useCallback((key, value) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, page: 1 })); // Reset to first page
  }, []);

  const updateSort = useCallback((key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters(initialFilters);
    setSortConfig(sortOptions.default || { key: null, direction: 'asc' });
    setPagination({ page: 1, pageSize: pagination.pageSize });
    cacheRef.current.clear();
  }, [initialFilters, sortOptions.default, pagination.pageSize]);

  const updatePagination = useCallback((updates) => {
    setPagination(prev => ({ ...prev, ...updates }));
  }, []);

  // Estadísticas de rendimiento
  const stats = useMemo(() => ({
    totalItems: data?.length || 0,
    filteredItems: filteredData.length,
    currentPageItems: paginatedData.length,
    totalPages: Math.ceil(filteredData.length / pagination.pageSize),
    currentPage: pagination.page,
    cacheSize: cacheRef.current.size,
    isFiltered: Object.values(filters).some(v => v) || debouncedSearch,
    searchDelay: filters.search !== debouncedSearch
  }), [data, filteredData, paginatedData, pagination, filters, debouncedSearch]);

  return {
    // Datos
    data: paginatedData,
    allFilteredData: filteredData,
    
    // Estado
    filters,
    sortConfig,
    pagination,
    
    // Métodos
    updateFilter,
    updateSort,
    clearFilters,
    updatePagination,
    
    // Estadísticas
    stats
  };
};

// Hook para virtualización de listas grandes
export const useVirtualization = (items, containerHeight, itemHeight, overscan = 5) => {
  const [scrollTop, setScrollTop] = useState(0);
  
  const visibleItems = useMemo(() => {
    const containerItemCount = Math.ceil(containerHeight / itemHeight);
    const startIndex = Math.floor(scrollTop / itemHeight);
    const endIndex = Math.min(
      startIndex + containerItemCount + overscan,
      items.length
    );
    
    const actualStartIndex = Math.max(0, startIndex - overscan);
    
    return {
      items: items.slice(actualStartIndex, endIndex),
      startIndex: actualStartIndex,
      endIndex,
      totalHeight: items.length * itemHeight,
      offsetY: actualStartIndex * itemHeight
    };
  }, [items, containerHeight, itemHeight, scrollTop, overscan]);

  const handleScroll = useCallback((e) => {
    setScrollTop(e.target.scrollTop);
  }, []);

  return {
    ...visibleItems,
    handleScroll
  };
};

// Hook para performance monitoring
export const useFilterPerformance = (filteredData, filters) => {
  const [metrics, setMetrics] = useState({
    lastFilterTime: 0,
    averageFilterTime: 0,
    filterCount: 0
  });

  useEffect(() => {
    const start = performance.now();
    
    // Simular el tiempo que tarda el filtrado
    const end = performance.now();
    const filterTime = end - start;
    
    setMetrics(prev => {
      const newFilterCount = prev.filterCount + 1;
      const newAverage = (prev.averageFilterTime * prev.filterCount + filterTime) / newFilterCount;
      
      return {
        lastFilterTime: filterTime,
        averageFilterTime: newAverage,
        filterCount: newFilterCount
      };
    });
  }, [filteredData, filters]);

  return metrics;
};

export default useOptimizedFilters;

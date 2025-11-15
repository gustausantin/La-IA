// ResponsiveTable.jsx - Componente que convierte tablas a cards en móvil
import React from 'react';
import { useResponsive } from '../../config/breakpoints';

/**
 * ResponsiveTable - Muestra tabla en desktop y cards en móvil
 * 
 * @param {Array} data - Datos a mostrar
 * @param {Array} columns - Configuración de columnas para desktop
 * @param {Function} mobileCard - Componente de card para móvil
 * @param {Object} props - Props adicionales
 */
export const ResponsiveTable = ({ 
  data = [], 
  columns = [], 
  mobileCard: MobileCard,
  className = '',
  emptyMessage = 'No hay datos para mostrar',
  ...props 
}) => {
  const { isMobile } = useResponsive();

  if (!data || data.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>{emptyMessage}</p>
      </div>
    );
  }

  // Vista móvil: Cards
  if (isMobile) {
    if (!MobileCard) {
      // Fallback: Card genérica si no se proporciona componente
      return (
        <div className="space-y-3">
          {data.map((row, index) => (
            <div 
              key={index}
              className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm"
            >
              {columns.map((col, colIndex) => (
                <div key={colIndex} className="flex justify-between items-start mb-2 last:mb-0">
                  <span className="text-sm font-medium text-gray-600">
                    {col.header}:
                  </span>
                  <span className="text-sm text-gray-900 text-right flex-1 ml-2">
                    {col.render ? col.render(row) : row[col.key]}
                  </span>
                </div>
              ))}
            </div>
          ))}
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {data.map((row, index) => (
          <MobileCard key={index} data={row} index={index} />
        ))}
      </div>
    );
  }

  // Vista desktop: Tabla
  return (
    <div className={`overflow-x-auto ${className}`} {...props}>
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col, index) => (
              <th
                key={index}
                scope="col"
                className={`
                  px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider
                  ${col.className || ''}
                `}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {data.map((row, rowIndex) => (
            <tr key={rowIndex} className="hover:bg-gray-50 transition-colors">
              {columns.map((col, colIndex) => (
                <td
                  key={colIndex}
                  className={`
                    px-4 py-3 whitespace-nowrap text-sm text-gray-900
                    ${col.cellClassName || ''}
                  `}
                >
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ResponsiveTable;


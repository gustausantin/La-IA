import React from 'react';
import { motion } from 'framer-motion';

const Skeleton = ({ 
  width = 'w-full', 
  height = 'h-4', 
  className = '', 
  variant = 'default',
  animate = true 
}) => {
  const baseClasses = `
    bg-gray-200 rounded
    ${animate ? 'animate-pulse' : ''}
    ${width} ${height} ${className}
  `;

  const variants = {
    default: 'bg-gray-200',
    card: 'bg-gray-100 rounded-lg',
    circle: 'bg-gray-200 rounded-full',
    text: 'bg-gray-200 rounded',
  };

  return (
    <div className={`${baseClasses} ${variants[variant]}`} />
  );
};

// Skeleton específicos para diferentes secciones
const SkeletonCard = ({ lines = 3 }) => (
  <motion.div 
    className="card-base p-6 space-y-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-center space-x-4">
      <Skeleton variant="circle" width="w-12" height="h-12" />
      <div className="space-y-2 flex-1">
        <Skeleton width="w-3/4" height="h-4" />
        <Skeleton width="w-1/2" height="h-3" />
      </div>
    </div>
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton 
          key={i} 
          width={i === lines - 1 ? 'w-2/3' : 'w-full'} 
          height="h-3" 
        />
      ))}
    </div>
  </motion.div>
);

const SkeletonTable = ({ rows = 5, columns = 4 }) => (
  <motion.div 
    className="bg-white rounded-lg border border-gray-200"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    {/* Header */}
    <div className="p-2 border-b border-gray-200">
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <Skeleton key={i} width="w-20" height="h-4" />
        ))}
      </div>
    </div>
    
    {/* Rows */}
    <div className="divide-y divide-gray-100">
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div key={rowIndex} className="p-2">
          <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
            {Array.from({ length: columns }).map((_, colIndex) => (
              <Skeleton 
                key={colIndex} 
                width={colIndex === 0 ? 'w-full' : 'w-16'} 
                height="h-4" 
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  </motion.div>
);

const SkeletonChart = () => (
  <motion.div 
    className="bg-white p-6 rounded-lg border border-gray-200"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <Skeleton width="w-32" height="h-6" />
        <Skeleton width="w-20" height="h-4" />
      </div>
      
      {/* Chart area */}
      <div className="h-64 flex items-end justify-between space-x-2">
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton 
            key={i} 
            width="w-6" 
            height={`h-${Math.floor(Math.random() * 40) + 20}`}
            className="bg-purple-100" 
          />
        ))}
      </div>
      
      {/* Legend */}
      <div className="flex space-x-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center space-x-2">
            <Skeleton variant="circle" width="w-3" height="h-3" />
            <Skeleton width="w-16" height="h-3" />
          </div>
        ))}
      </div>
    </div>
  </motion.div>
);

const SkeletonMetrics = () => (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
    {Array.from({ length: 4 }).map((_, i) => (
      <motion.div 
        key={i}
        className="bg-white p-6 rounded-lg border border-gray-200"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: i * 0.1 }}
      >
        <div className="flex items-center justify-between mb-4">
          <Skeleton variant="circle" width="w-12" height="h-12" className="bg-purple-100" />
          <Skeleton width="w-8" height="h-4" />
        </div>
        <div className="space-y-2">
          <Skeleton width="w-20" height="h-8" />
          <Skeleton width="w-full" height="h-4" />
          <Skeleton width="w-3/4" height="h-3" />
        </div>
      </motion.div>
    ))}
  </div>
);

const SkeletonConversation = () => (
  <motion.div 
    className="space-y-4"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    {Array.from({ length: 6 }).map((_, i) => (
      <div key={i} className={`flex ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
        <div className={`flex items-start space-x-3 max-w-xs ${i % 2 === 0 ? '' : 'flex-row-reverse space-x-reverse'}`}>
          <Skeleton variant="circle" width="w-8" height="h-8" />
          <div className="space-y-2">
            <Skeleton 
              width={i % 2 === 0 ? 'w-32' : 'w-24'} 
              height="h-10" 
              className={i % 2 === 0 ? 'bg-gray-200' : 'bg-purple-100'} 
            />
            <Skeleton width="w-16" height="h-3" />
          </div>
        </div>
      </div>
    ))}
  </motion.div>
);

const SkeletonProfile = () => (
  <motion.div 
    className="bg-white p-6 rounded-lg border border-gray-200"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}
  >
    <div className="flex items-center space-x-4 mb-6">
      <Skeleton variant="circle" width="w-20" height="h-20" />
      <div className="space-y-2 flex-1">
        <Skeleton width="w-32" height="h-6" />
        <Skeleton width="w-24" height="h-4" />
        <Skeleton width="w-40" height="h-4" />
      </div>
    </div>
    
    <div className="space-y-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex justify-between items-center">
          <Skeleton width="w-24" height="h-4" />
          <Skeleton width="w-32" height="h-4" />
        </div>
      ))}
    </div>
  </motion.div>
);

// Loading state específico para páginas completas
const PageSkeleton = ({ type = 'dashboard' }) => {
  const skeletonTypes = {
    dashboard: (
      <div className="space-y-6">
        <SkeletonMetrics />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonChart />
          <SkeletonChart />
        </div>
        <SkeletonTable />
      </div>
    ),
    
    analytics: (
      <div className="space-y-6">
        <SkeletonMetrics />
        <SkeletonChart />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <SkeletonCard />
          <SkeletonCard />
          <SkeletonCard />
        </div>
      </div>
    ),
    
    communication: (
      <div className="flex h-full">
        <div className="w-80 border-r border-gray-200 p-2 space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonCard key={i} lines={2} />
          ))}
        </div>
        <div className="flex-1 p-2">
          <SkeletonConversation />
        </div>
      </div>
    ),
    
    configuration: (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkeletonProfile />
          <SkeletonCard lines={5} />
        </div>
        <SkeletonTable rows={3} />
      </div>
    ),
  };

  return (
    <motion.div 
      className="min-h-screen bg-gray-50 p-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {skeletonTypes[type]}
    </motion.div>
  );
};

// Exportaciones
export default Skeleton;
export {
  SkeletonCard,
  SkeletonTable,
  SkeletonChart,
  SkeletonMetrics,
  SkeletonConversation,
  SkeletonProfile,
  PageSkeleton,
};

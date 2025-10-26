// API endpoint para ejecutar el job diario de CRM
// Se puede llamar desde un cron externo o scheduler

import { runCRMDailyJob } from '../../src/services/CRMDailyJobEnhanced.js';

export default async function handler(req, res) {
  // Solo permitir POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ 
      error: 'Method not allowed', 
      message: 'Only POST requests are allowed' 
    });
  }
  
  // Verificar autenticación básica (API key)
  const apiKey = req.headers.authorization?.replace('Bearer ', '');
  const expectedApiKey = process.env.CRM_DAILY_JOB_API_KEY || 'crm-job-secret-key';
  
  if (apiKey !== expectedApiKey) {
    return res.status(401).json({ 
      error: 'Unauthorized', 
      message: 'Invalid API key' 
    });
  }
  
  try {
    console.log('🚀 Ejecutando CRM Daily Job vía API...');
    
    const result = await runCRMDailyJob();
    
    if (result.success) {
      return res.status(200).json({
        success: true,
        message: 'CRM Daily Job ejecutado exitosamente',
        duration: result.duration,
        stats: result.stats,
        timestamp: new Date().toISOString()
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        stats: result.stats,
        timestamp: new Date().toISOString()
      });
    }
    
  } catch (error) {
    console.error('❌ Error ejecutando CRM Daily Job:', error);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
}
// useChannelStats.js - Hook para obtener estadísticas de canales
import { useState, useEffect } from 'react';
import { useAuthContext } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export const useChannelStats = () => {
    const { restaurantId } = useAuthContext();
    const [channelStats, setChannelStats] = useState({
        active: 0,
        total: 5,
        validChannels: []
    });
    const [loading, setLoading] = useState(true);

    const loadChannelStats = async () => {
        if (!restaurantId) {
            setChannelStats({ active: 0, total: 5, validChannels: [] });
            setLoading(false);
            return;
        }

        try {
            const { data: restaurant, error } = await supabase
                .from('restaurants')
                .select('settings')
                .eq('id', restaurantId)
                .single();

            if (error) throw error;

            const channels = restaurant?.settings?.channels || {};
            // ✅ Siempre 5 canales principales: VAPI, WhatsApp, Instagram, Facebook, Web Chat
            const totalChannels = 5;
            
            console.log('🔍 useChannelStats - channels desde DB:', channels);
            
            // Validar cada canal
            const activeChannels = [];
            
            Object.entries(channels).forEach(([channelType, channelSettings]) => {
                const isEnabled = channelSettings?.enabled === true;
                
                // ✅ SIMPLIFICADO: Solo miramos enabled, sin validar credenciales
                // La validación de credenciales es responsabilidad de Configuración
                console.log(`🔍 Canal "${channelType}":`, {
                    enabled: isEnabled,
                    settings: channelSettings
                });
                
                if (isEnabled) {
                    activeChannels.push(channelType);
                    console.log(`✅ Canal "${channelType}" → ACTIVO`);
                }
            });

            console.log('✅ useChannelStats - Canales activos:', activeChannels);

            setChannelStats({
                active: activeChannels.length,
                total: totalChannels,
                validChannels: activeChannels
            });

        } catch (error) {
            console.error('Error loading channel stats:', error);
            setChannelStats({ active: 0, total: 5, validChannels: [] });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadChannelStats();
    }, [restaurantId]);

    return {
        channelStats,
        loading,
        refresh: loadChannelStats
    };
};

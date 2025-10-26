// Hook para mostrar modal de regeneración inmediatamente cuando hay cambios
import { useState, useCallback } from 'react';

export const useRegenerationModal = () => {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalChangeReason, setModalChangeReason] = useState(null);
    const [modalChangeDetails, setModalChangeDetails] = useState(null);

    /**
     * Muestra el modal de regeneración INMEDIATAMENTE
     * @param {string} reason - Razón del cambio (ej: 'table_deleted', 'schedule_changed')
     * @param {string} details - Detalles adicionales del cambio
     */
    const showRegenerationModal = useCallback((reason, details = null) => {
        setModalChangeReason(reason);
        setModalChangeDetails(details);
        setIsModalOpen(true);
    }, []);

    /**
     * Cierra el modal
     */
    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        // No limpiamos reason/details inmediatamente para permitir animaciones
        setTimeout(() => {
            setModalChangeReason(null);
            setModalChangeDetails(null);
        }, 300);
    }, []);

    return {
        isModalOpen,
        modalChangeReason,
        modalChangeDetails,
        showRegenerationModal,
        closeModal
    };
};

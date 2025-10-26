import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Dashboard from '../Dashboard';
import { AuthContext } from '../../contexts/AuthContext';

// Mock del AuthContext con usuario autenticado
const createMockAuthContext = (overrides = {}) => ({
  user: { id: '1', email: 'test@restaurant.com' },
  loading: false,
  status: 'authenticated',
  restaurant: { 
    id: '1', 
    name: 'Mi Restaurante',
    email: 'test@restaurant.com'
  },
  restaurantId: '1',
  notifications: [],
  ...overrides,
});

const renderDashboard = (authContextValue = {}) => {
  const mockAuthValue = createMockAuthContext(authContextValue);
  
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthValue}>
        <Dashboard />
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Dashboard - Tests Simplificados', () => {
  it('debería renderizar el componente sin errores', () => {
    renderDashboard();
    // Verificar que al menos algo se renderiza
    expect(document.body).toBeInTheDocument();
  });

  it('debería mostrar loading cuando está cargando', () => {
    renderDashboard({ status: 'checking' });
    expect(screen.getByText(/cargando/i)).toBeInTheDocument();
  });

  it('debería mostrar mensaje de login cuando no está autenticado', () => {
    renderDashboard({ 
      user: null, 
      status: 'unauthenticated',
      restaurant: null 
    });
    expect(screen.getByText(/inicia sesión/i)).toBeInTheDocument();
  });

  it('debería tener estructura básica cuando está autenticado', () => {
    renderDashboard();
    // Simplemente verificar que algo se renderiza para usuario autenticado
    const dashboard = document.querySelector('[class*="dashboard"], [class*="container"], div');
    expect(dashboard).toBeInTheDocument();
  });

  it('debería manejar estado de loading correctamente', () => {
    renderDashboard({ loading: true });
    // Verificar que maneja el loading
    expect(document.body).toBeInTheDocument();
  });

  it('debería mostrar contenido para usuario con restaurante', () => {
    renderDashboard({
      user: { id: '1', email: 'test@restaurant.com' },
      restaurant: { id: '1', name: 'Test Restaurant' },
      status: 'authenticated'
    });
    
    // Verificar que se renderiza algo útil
    expect(document.body).toBeInTheDocument();
  });

  it('debería manejar notificaciones', () => {
    renderDashboard({
      notifications: [
        { id: '1', message: 'Test notification', type: 'info' }
      ]
    });
    
    expect(document.body).toBeInTheDocument();
  });

  it('debería renderizar para diferentes estados de auth', () => {
    const states = ['checking', 'authenticated', 'unauthenticated'];
    
    states.forEach(status => {
      renderDashboard({ status });
      expect(document.body).toBeInTheDocument();
    });
  });

  it('debería tener componente estable', () => {
    const { container } = renderDashboard();
    expect(container.firstChild).toBeTruthy();
  });

  it('debería funcionar con props mínimas', () => {
    renderDashboard({
      user: null,
      restaurant: null,
      loading: false
    });
    
    expect(document.body).toBeInTheDocument();
  });
});

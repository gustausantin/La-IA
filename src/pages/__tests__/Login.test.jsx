import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../Login';
import { AuthContext } from '../../contexts/AuthContext';

// Mock simple para AuthContext
const createMockAuthContext = (overrides = {}) => ({
  user: null,
  loading: false,
  login: vi.fn(),
  register: vi.fn(),
  notifications: [],
  ...overrides,
});

const renderLogin = (authContextValue = {}) => {
  const mockAuthValue = createMockAuthContext(authContextValue);
  
  return render(
    <BrowserRouter>
      <AuthContext.Provider value={mockAuthValue}>
        <Login />
      </AuthContext.Provider>
    </BrowserRouter>
  );
};

describe('Login - Tests Simplificados', () => {
  it('debería renderizar el componente sin errores', () => {
    renderLogin();
    expect(screen.getByText('La-IA')).toBeInTheDocument();
  });

  it('debería mostrar el formulario de login', () => {
    renderLogin();
    expect(screen.getByPlaceholderText('tu@email.com')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
  });

  it('debería tener botones de navegación', () => {
    renderLogin();
    // Buscar por rol y tipo específico para evitar ambigüedad
    const toggleButtons = screen.getAllByRole('button').filter(btn => btn.type === 'button');
    const loginToggle = toggleButtons.find(btn => btn.textContent === 'Iniciar Sesión');
    const registerToggle = toggleButtons.find(btn => btn.textContent === 'Crear Cuenta');
    
    expect(loginToggle).toBeInTheDocument();
    expect(registerToggle).toBeInTheDocument();
  });

  it('debería mostrar el título principal', () => {
    renderLogin();
    expect(screen.getByText('Sistema Inteligente de Reservas con IA')).toBeInTheDocument();
  });

  it('debería tener campos con labels apropiadas', () => {
    renderLogin();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Contraseña')).toBeInTheDocument();
  });

  it('debería mostrar link de contraseña olvidada', () => {
    renderLogin();
    expect(screen.getByText('¿Olvidaste tu contraseña?')).toBeInTheDocument();
  });

  it('debería mostrar mensaje de prueba gratuita', () => {
    renderLogin();
    expect(screen.getByText('Prueba 14 días gratis')).toBeInTheDocument();
  });

  it('debería tener estructura semántica básica', () => {
    renderLogin();
    // Verificar elementos estructurales importantes
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument(); // H1: La-IA
    
    // Verificar que el formulario existe
    const emailInput = screen.getByLabelText('Email');
    const passwordInput = screen.getByLabelText('Contraseña');
    expect(emailInput.closest('form')).toBeInTheDocument();
    expect(passwordInput.closest('form')).toBeInTheDocument();
  });

  it('debería mostrar todos los botones requeridos', () => {
    renderLogin();
    const buttons = screen.getAllByRole('button');
    expect(buttons.length).toBeGreaterThanOrEqual(3); // Login toggle, register toggle, submit
  });

  it('debería renderizar sin usuario autenticado', () => {
    renderLogin({ user: null });
    expect(screen.getByText('La-IA')).toBeInTheDocument();
  });
});

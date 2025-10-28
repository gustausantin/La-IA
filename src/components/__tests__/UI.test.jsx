import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Button from '../ui/Button';
import Card from '../ui/Card';

describe('Componentes UI Reales', () => {
  describe('Button', () => {
    it('debería renderizar un botón básico', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toBeInTheDocument();
      expect(screen.getByText('Click me')).toBeInTheDocument();
    });

    it('debería manejar diferentes variantes', () => {
      render(<Button variant="primary">Primary</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-purple-600');
    });

    it('debería estar deshabilitado cuando se especifica', () => {
      render(<Button disabled>Disabled</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('debería mostrar loading state', () => {
      render(<Button loading>Loading</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('debería tener diferentes tamaños', () => {
      render(<Button size="lg">Large Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-6', 'py-3');
    });
  });

  describe('Card', () => {
    it('debería renderizar un card básico', () => {
      render(
        <Card>
          <h3>Test Card</h3>
          <p>Content</p>
        </Card>
      );
      
      expect(screen.getByText('Test Card')).toBeInTheDocument();
      expect(screen.getByText('Content')).toBeInTheDocument();
    });

    it('debería aplicar clases CSS correctas', () => {
      const { container } = render(<Card>Content</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-white', 'rounded-xl');
    });

    it('debería manejar diferentes variantes', () => {
      const { container } = render(<Card variant="premium">Premium Card</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('bg-gradient-to-br');
    });

    it('debería manejar diferentes paddings', () => {
      const { container } = render(<Card padding="lg">Large Padding</Card>);
      const card = container.firstChild;
      expect(card).toHaveClass('p-8');
    });

    it('debería ser clickeable cuando tiene onClick', () => {
      const handleClick = () => {};
      const { container } = render(<Card onClick={handleClick}>Clickable</Card>);
      const card = container.firstChild;
      expect(card.tagName).toBe('BUTTON');
    });
  });

  describe('Tests de Accesibilidad', () => {
    it('los botones deberían tener text content', () => {
      render(<Button>Accessible Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveTextContent('Accessible Button');
    });

    it('las cards deberían contener su contenido', () => {
      render(
        <Card>
          <h2>Card Title</h2>
          <p>Card description</p>
        </Card>
      );
      
      expect(screen.getByText('Card Title')).toBeInTheDocument();
      expect(screen.getByText('Card description')).toBeInTheDocument();
    });
  });

  describe('Estados y Interacciones', () => {
    it('los botones deberían manejar estado loading', () => {
      render(<Button loading>Loading Button</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
    });

    it('las cards deberían permitir contenido personalizado', () => {
      render(
        <Card>
          <Card.Header>Header</Card.Header>
          <Card.Body>Body Content</Card.Body>
        </Card>
      );
      
      expect(screen.getByText('Header')).toBeInTheDocument();
      expect(screen.getByText('Body Content')).toBeInTheDocument();
    });
  });
});

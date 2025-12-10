import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Toast from './Toast';

describe('Toast Component', () => {
  it('should render success toast', () => {
    render(
      <Toast
        id="1"
        message="Success message"
        type="success"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Success message')).toBeInTheDocument();
  });

  it('should render error toast', () => {
    render(
      <Toast
        id="1"
        message="Error message"
        type="error"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Error message')).toBeInTheDocument();
  });

  it('should render warning toast', () => {
    render(
      <Toast
        id="1"
        message="Warning message"
        type="warning"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Warning message')).toBeInTheDocument();
  });

  it('should render info toast', () => {
    render(
      <Toast
        id="1"
        message="Info message"
        type="info"
        onClose={() => {}}
      />
    );

    expect(screen.getByText('Info message')).toBeInTheDocument();
  });
});

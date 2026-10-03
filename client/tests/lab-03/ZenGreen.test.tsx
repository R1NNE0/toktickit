/// <reference types="vite/client" />
import { describe, it, expect, vi } from 'vitest';
import css from '../../src/index.css?raw';
import { render, screen, fireEvent } from '@testing-library/react';
import { Login } from '../../src/components/Login.js';
import { ChangePassword } from '../../src/components/ChangePassword.js';

describe('STYLE-01 accessible Zen Green form semantics', () => {
  it('retains the approved shared palette', () => {
    for (const [token, color] of Object.entries({ 'primary-green': '#006b3c', 'secondary-green': '#0b7a46',
      'pale-green': '#eaf6ef', 'page-bg': '#f5f7f6', 'surface-card': '#ffffff', 'text-primary': '#1f2937' }))
      expect(css).toContain(`--${token}: ${color}`);
  });
  it('associates login validation with the first invalid field and moves focus there', () => {
    render(<Login onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }));
    expect(screen.getByLabelText('Email')).toHaveFocus();
    expect(screen.getByLabelText('Email')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Email')).toHaveAccessibleDescription('Enter a valid email and password.');
  });
  it('associates password mismatch feedback and focuses confirmation without bypassing the gate', () => {
    render(<ChangePassword mandatory onSubmit={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Current password'), { target: { value: 'Current synthetic password' } });
    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'Different synthetic password' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save password' }));
    expect(screen.getByLabelText('Confirm new password')).toHaveFocus();
    expect(screen.getByLabelText('Confirm new password')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByLabelText('Confirm new password')).toHaveAccessibleDescription(/must match/);
    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ConnectionStatus, ConnectionState } from '../ConnectionStatus';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren<unknown>) => <>{children}</>,
}));

describe('ConnectionStatus', () => {
  it('renders connected state correctly', () => {
    render(<ConnectionStatus status="connected" />);
    
    expect(screen.getByText('Connected')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveAttribute(
      'aria-label', 
      'Connection status: Connected'
    );
  });

  it('renders reconnecting state correctly', () => {
    render(<ConnectionStatus status="reconnecting" />);
    
    expect(screen.getByText('Reconnecting')).toBeInTheDocument();
  });

  it('renders stale state correctly', () => {
    render(<ConnectionStatus status="stale" />);
    
    expect(screen.getByText('Stale')).toBeInTheDocument();
  });

  it('renders disconnected state correctly', () => {
    render(<ConnectionStatus status="disconnected" />);
    
    expect(screen.getByText('Disconnected')).toBeInTheDocument();
  });

  it('hides label when showLabel is false', () => {
    render(<ConnectionStatus status="connected" showLabel={false} />);
    
    expect(screen.queryByText('Connected')).not.toBeInTheDocument();
  });

  it('shows last tick time when provided for connected status', () => {
    const now = new Date();
    render(<ConnectionStatus status="connected" lastTickTime={now} />);
    
    // Should show "just now" or similar
    expect(screen.getByText(/just now|ago/i)).toBeInTheDocument();
  });

  it('shows last tick time for stale status', () => {
    const tenSecondsAgo = new Date(Date.now() - 10000);
    render(<ConnectionStatus status="stale" lastTickTime={tenSecondsAgo} />);
    
    expect(screen.getByText(/10s ago/)).toBeInTheDocument();
  });

  it('does not show last tick time for reconnecting status', () => {
    const now = new Date();
    render(<ConnectionStatus status="reconnecting" lastTickTime={now} />);
    
    expect(screen.queryByText(/ago|just now/i)).not.toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<ConnectionStatus status="connected" className="custom-class" />);
    
    expect(screen.getByRole('status')).toHaveClass('custom-class');
  });

  it('has proper accessibility attributes', () => {
    render(<ConnectionStatus status="connected" />);
    
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute('aria-label');
  });

  it('renders with all status types without errors', () => {
    const statuses: ConnectionState[] = ['connected', 'reconnecting', 'stale', 'disconnected'];
    
    statuses.forEach((status) => {
      const { unmount } = render(<ConnectionStatus status={status} />);
      expect(screen.getByRole('status')).toBeInTheDocument();
      unmount();
    });
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard, StatCardProps }  from '../StatCard';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, whileHover, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div {...props}>{children}</div>
    ),
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
  useSpring: () => ({ set: vi.fn() }),
  useTransform: (_spring: unknown, fn: (v: number) => string) => fn(100),
}));

describe('StatCard', () => {
  const defaultProps: StatCardProps = {
    title: 'Portfolio Value',
    value: 12345.67,
  };

  it('renders title and value', () => {
    render(<StatCard {...defaultProps} />);
    
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument();
    expect(screen.getByRole('article')).toBeInTheDocument();
  });

  it('displays prefix and suffix', () => {
    render(
      <StatCard 
        {...defaultProps} 
        prefix="$" 
        suffix=" USD"
      />
    );
    
    expect(screen.getByText('$')).toBeInTheDocument();
    expect(screen.getByText('USD')).toBeInTheDocument();
  });

  it('shows positive change with bullish styling', () => {
    render(
      <StatCard 
        {...defaultProps} 
        previousValue={10000}
        showChange={true}
      />
    );
    
    // Should show positive percentage
    expect(screen.getByText(/\+23\.5%/)).toBeInTheDocument();
  });

  it('shows negative change with bearish styling', () => {
    render(
      <StatCard 
        {...defaultProps}
        value={8000}
        previousValue={10000}
        showChange={true}
      />
    );
    
    // Should show negative percentage
    expect(screen.getByText(/-20\.0%/)).toBeInTheDocument();
  });

  it('hides change when showChange is false', () => {
    render(
      <StatCard 
        {...defaultProps}
        previousValue={10000}
        showChange={false}
      />
    );
    
    expect(screen.queryByText(/%/)).not.toBeInTheDocument();
  });

  it('displays description when provided', () => {
    render(
      <StatCard 
        {...defaultProps}
        description="Last updated 5 minutes ago"
      />
    );
    
    expect(screen.getByText('Last updated 5 minutes ago')).toBeInTheDocument();
  });

  it('renders loading skeleton state', () => {
    render(<StatCard {...defaultProps} loading={true} />);
    
    // Should show skeleton, not actual content
    expect(screen.queryByText('Portfolio Value')).not.toBeInTheDocument();
    expect(document.querySelector('.animate-pulse')).toBeInTheDocument();
  });

  it('renders icon when provided', () => {
    const TestIcon = () => <span data-testid="test-icon">💰</span>;
    render(
      <StatCard 
        {...defaultProps}
        icon={<TestIcon />}
      />
    );
    
    expect(screen.getByTestId('test-icon')).toBeInTheDocument();
  });

  it('renders sparkline when data provided', () => {
    render(
      <StatCard 
        {...defaultProps}
        sparkline={{
          values: [100, 120, 110, 140, 135, 150],
          color: 'bullish'
        }}
      />
    );
    
    const sparkline = screen.getByRole('img', { name: /sparkline/i });
    expect(sparkline).toBeInTheDocument();
  });

  it('applies size classes correctly', () => {
    const { rerender } = render(<StatCard {...defaultProps} size="sm" />);
    expect(screen.getByRole('article')).toHaveClass('p-3');
    
    rerender(<StatCard {...defaultProps} size="lg" />);
    expect(screen.getByRole('article')).toHaveClass('p-6');
  });

  it('applies custom className', () => {
    render(<StatCard {...defaultProps} className="custom-stat" />);
    
    expect(screen.getByRole('article')).toHaveClass('custom-stat');
  });

  it('has proper ARIA label with value', () => {
    render(
      <StatCard 
        {...defaultProps}
        prefix="$"
        precision={2}
      />
    );
    
    expect(screen.getByRole('article')).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Portfolio Value')
    );
  });

  it('handles zero previous value without NaN', () => {
    render(
      <StatCard 
        {...defaultProps}
        value={100}
        previousValue={0}
        showChange={true}
      />
    );
    
    // Should not show NaN or infinity
    expect(screen.queryByText(/NaN|Infinity/)).not.toBeInTheDocument();
  });
});

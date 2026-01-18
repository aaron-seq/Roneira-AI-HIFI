import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPalette, useCommandPalette, CommandItem } from '../CommandPalette';

// Mock scrollIntoView
beforeEach(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Mock framer-motion to avoid animation issues in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, initial, animate, exit, whileHover, transition, ...props }: 
      React.PropsWithChildren<Record<string, unknown>>) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: React.PropsWithChildren<unknown>) => <>{children}</>,
}));

const mockCommands: CommandItem[] = [
  { 
    id: 'goto-dashboard', 
    label: 'Go to Dashboard', 
    category: 'Navigation',
    action: vi.fn()
  },
  { 
    id: 'add-symbol', 
    label: 'Add Symbol', 
    category: 'Actions',
    action: vi.fn()
  },
  { 
    id: 'open-settings', 
    label: 'Open Settings', 
    category: 'Settings',
    keywords: ['preferences'],
    action: vi.fn()
  },
];

describe('CommandPalette', () => {
  const onCloseMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders when isOpen is true', () => {
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('does not render when isOpen is false', () => {
    render(
      <CommandPalette 
        isOpen={false} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('displays all commands when no search query', () => {
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Add Symbol')).toBeInTheDocument();
    expect(screen.getByText('Open Settings')).toBeInTheDocument();
  });

  it('filters commands based on search query', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'dashboard');

    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
    expect(screen.queryByText('Add Symbol')).not.toBeInTheDocument();
  });

  it('filters by keywords', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'preferences');

    expect(screen.getByText('Open Settings')).toBeInTheDocument();
    expect(screen.queryByText('Go to Dashboard')).not.toBeInTheDocument();
  });

  it('shows no results message when search has no matches', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, 'nonexistentcommand');

    expect(screen.getByText('No commands found')).toBeInTheDocument();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, '{Escape}');

    expect(onCloseMock).toHaveBeenCalled();
  });

  it('executes command action and closes on Enter', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    await user.type(input, '{Enter}');

    expect(mockCommands[0].action).toHaveBeenCalled();
    expect(onCloseMock).toHaveBeenCalled();
  });

  it('navigates with arrow keys', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    
    // Move down
    await user.type(input, '{ArrowDown}');
    await user.type(input, '{Enter}');

    // Second command should be selected
    expect(mockCommands[1].action).toHaveBeenCalled();
  });

  it('wraps around when navigating past end', async () => {
    const user = userEvent.setup();
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    const input = screen.getByRole('textbox');
    
    // Go to last, then wrap to first
    await user.type(input, '{ArrowDown}{ArrowDown}{ArrowDown}');
    await user.type(input, '{Enter}');

    expect(mockCommands[0].action).toHaveBeenCalled();
  });

  it('has proper ARIA attributes', () => {
    render(
      <CommandPalette 
        isOpen={true} 
        onClose={onCloseMock} 
        commands={mockCommands}
      />
    );

    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByRole('textbox')).toHaveAttribute('aria-label', 'Search commands');
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Available commands');
  });
});

describe('useCommandPalette hook', () => {
  it('initializes with isOpen false', () => {
    const TestComponent = () => {
      const { isOpen } = useCommandPalette();
      return <div data-testid="status">{isOpen ? 'open' : 'closed'}</div>;
    };

    render(<TestComponent />);
    expect(screen.getByTestId('status')).toHaveTextContent('closed');
  });
});

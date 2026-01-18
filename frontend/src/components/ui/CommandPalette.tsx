import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  ArrowRight, 
  PlusCircle, 
  Bell, 
  Briefcase, 
  Settings, 
  LayoutDashboard,
  Eye,
  History,
  Palette,
  Command as CommandIcon
} from 'lucide-react';

export interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  category?: string;
  action: () => void;
  keywords?: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  commands?: CommandItem[];
  placeholder?: string;
}

const defaultCommands: CommandItem[] = [
  { 
    id: 'goto-dashboard', 
    label: 'Go to Dashboard', 
    icon: LayoutDashboard, 
    category: 'Navigation',
    shortcut: 'G D',
    keywords: ['home', 'overview'],
    action: () => console.log('Navigate to Dashboard')
  },
  { 
    id: 'goto-portfolio', 
    label: 'Go to Portfolio', 
    icon: Briefcase, 
    category: 'Navigation',
    shortcut: 'G P',
    keywords: ['holdings', 'stocks'],
    action: () => console.log('Navigate to Portfolio')
  },
  { 
    id: 'goto-watchlist', 
    label: 'Go to Watchlist', 
    icon: Eye, 
    category: 'Navigation',
    shortcut: 'G W',
    keywords: ['watch', 'track'],
    action: () => console.log('Navigate to Watchlist')
  },
  { 
    id: 'add-symbol', 
    label: 'Add Symbol to Watchlist', 
    icon: PlusCircle, 
    category: 'Actions',
    shortcut: 'A S',
    keywords: ['stock', 'ticker', 'add'],
    action: () => console.log('Add symbol')
  },
  { 
    id: 'create-alert', 
    label: 'Create Price Alert', 
    icon: Bell, 
    category: 'Actions',
    shortcut: 'C A',
    keywords: ['notification', 'alert', 'price'],
    action: () => console.log('Create alert')
  },
  { 
    id: 'view-transactions', 
    label: 'View Transactions', 
    icon: History, 
    category: 'Navigation',
    shortcut: 'G T',
    keywords: ['history', 'trades'],
    action: () => console.log('View transactions')
  },
  { 
    id: 'toggle-theme', 
    label: 'Toggle Theme', 
    icon: Palette, 
    category: 'Settings',
    shortcut: 'T T',
    keywords: ['dark', 'light', 'mode'],
    action: () => console.log('Toggle theme')
  },
  { 
    id: 'open-settings', 
    label: 'Open Settings', 
    icon: Settings, 
    category: 'Settings',
    shortcut: 'G S',
    keywords: ['preferences', 'config'],
    action: () => console.log('Open settings')
  },
];

/**
 * CommandPalette - Cmd/Ctrl+K command palette for quick navigation and actions
 * Supports keyboard navigation, fuzzy search, and categorized commands
 */
export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  commands = defaultCommands,
  placeholder = 'Type a command or search...',
}) => {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter commands based on search query
  const filteredCommands = query.trim()
    ? commands.filter((cmd) => {
        const searchTerms = [
          cmd.label.toLowerCase(),
          cmd.category?.toLowerCase() || '',
          ...(cmd.keywords || []).map((k) => k.toLowerCase()),
        ];
        return searchTerms.some((term) => term.includes(query.toLowerCase()));
      })
    : commands;

  // Group commands by category
  const groupedCommands = filteredCommands.reduce((acc, cmd) => {
    const category = cmd.category || 'General';
    if (!acc[category]) acc[category] = [];
    acc[category].push(cmd);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  // Flatten for keyboard navigation
  const flattenedCommands = Object.values(groupedCommands).flat();

  // Reset state when opening
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Keep active item in view
  useEffect(() => {
    const activeElement = listRef.current?.querySelector(`[data-index="${activeIndex}"]`);
    activeElement?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setActiveIndex((prev) => 
          prev < flattenedCommands.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        e.preventDefault();
        setActiveIndex((prev) => 
          prev > 0 ? prev - 1 : flattenedCommands.length - 1
        );
        break;
      case 'Enter':
        e.preventDefault();
        if (flattenedCommands[activeIndex]) {
          flattenedCommands[activeIndex].action();
          onClose();
        }
        break;
      case 'Escape':
        e.preventDefault();
        onClose();
        break;
    }
  }, [flattenedCommands, activeIndex, onClose]);

  // Close on backdrop click
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  let currentIndex = -1;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 flex items-start justify-center pt-[15vh]"
          style={{ 
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            backdropFilter: 'blur(4px)',
            zIndex: 'var(--z-command)'
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          <motion.div
            className="w-full max-w-xl rounded-xl overflow-hidden"
            style={{ 
              backgroundColor: 'var(--surface-1)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-card-hover)'
            }}
            initial={{ scale: 0.95, opacity: 0, y: -20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: -20 }}
            transition={{ duration: 0.15, ease: [0.2, 0.8, 0.2, 1] }}
          >
            {/* Search Input */}
            <div 
              className="flex items-center gap-3 px-4 py-3"
              style={{ borderBottom: '1px solid var(--border-subtle)' }}
            >
              <Search size={18} style={{ color: 'var(--text-3)' }} />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActiveIndex(0);
                }}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className="flex-1 bg-transparent text-base outline-none"
                style={{ color: 'var(--text-1)' }}
                aria-label="Search commands"
                autoComplete="off"
                spellCheck="false"
              />
              <kbd 
                className="px-2 py-1 rounded text-xs font-mono"
                style={{ 
                  backgroundColor: 'var(--surface-2)',
                  color: 'var(--text-3)'
                }}
              >
                ESC
              </kbd>
            </div>

            {/* Command List */}
            <div 
              ref={listRef}
              className="max-h-80 overflow-y-auto py-2"
              role="listbox"
              aria-label="Available commands"
            >
              {Object.keys(groupedCommands).length === 0 ? (
                <div 
                  className="px-4 py-8 text-center"
                  style={{ color: 'var(--text-3)' }}
                >
                  <p>No commands found</p>
                  <p className="text-sm mt-1">Try a different search term</p>
                </div>
              ) : (
                Object.entries(groupedCommands).map(([category, items]) => (
                  <div key={category} className="mb-2">
                    <div 
                      className="px-4 py-1.5 text-xs font-medium uppercase tracking-wider"
                      style={{ color: 'var(--text-3)' }}
                    >
                      {category}
                    </div>
                    {items.map((cmd) => {
                      currentIndex++;
                      const isActive = currentIndex === activeIndex;
                      const Icon = cmd.icon;
                      const itemIndex = currentIndex;
                      
                      return (
                        <button
                          key={cmd.id}
                          data-index={itemIndex}
                          onClick={() => {
                            cmd.action();
                            onClose();
                          }}
                          onMouseEnter={() => setActiveIndex(itemIndex)}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors duration-75"
                          style={{ 
                            backgroundColor: isActive ? 'var(--surface-2)' : 'transparent',
                            color: 'var(--text-1)'
                          }}
                          role="option"
                          aria-selected={isActive}
                        >
                          {Icon && (
                            <Icon 
                              size={18} 
                              style={{ color: isActive ? 'var(--color-primary)' : 'var(--text-2)' }}
                            />
                          )}
                          <span className="flex-1 font-medium">{cmd.label}</span>
                          {cmd.shortcut && (
                            <span 
                              className="text-xs font-mono"
                              style={{ color: 'var(--text-3)' }}
                            >
                              {cmd.shortcut}
                            </span>
                          )}
                          {isActive && (
                            <ArrowRight 
                              size={16} 
                              style={{ color: 'var(--color-primary)' }}
                            />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            {/* Footer */}
            <div 
              className="flex items-center justify-between px-4 py-2 text-xs"
              style={{ 
                borderTop: '1px solid var(--border-subtle)',
                color: 'var(--text-3)'
              }}
            >
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)' }}>↑</kbd>
                  <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)' }}>↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1">
                  <kbd className="px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--surface-2)' }}>↵</kbd>
                  select
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CommandIcon size={12} />
                <span>K to open</span>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/**
 * Hook to manage command palette state with keyboard shortcut
 */
export const useCommandPalette = () => {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return {
    isOpen,
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
    toggle: () => setIsOpen((prev) => !prev),
  };
};

export default CommandPalette;

import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import * as Dialog from '@radix-ui/react-dialog';

export type DrawerPosition = 'left' | 'right' | 'bottom';

interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  position?: DrawerPosition;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
}

const sizeMap = {
  sm: '320px',
  md: '400px',
  lg: '500px',
  xl: '640px',
  full: '100%',
};

/**
 * Drawer - Slide-out panel component using Radix Dialog
 * Supports left, right, and bottom positions with multiple sizes
 */
export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  position = 'right',
  size = 'md',
  showCloseButton = true,
  closeOnOutsideClick = true,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const getMotionProps = () => {
    const sizeValue = sizeMap[size];
    
    switch (position) {
      case 'left':
        return {
          initial: { x: '-100%' },
          animate: { x: 0 },
          exit: { x: '-100%' },
          style: { 
            left: 0, 
            top: 0, 
            bottom: 0, 
            width: sizeValue,
            maxWidth: '100vw'
          },
        };
      case 'right':
        return {
          initial: { x: '100%' },
          animate: { x: 0 },
          exit: { x: '100%' },
          style: { 
            right: 0, 
            top: 0, 
            bottom: 0, 
            width: sizeValue,
            maxWidth: '100vw'
          },
        };
      case 'bottom':
        return {
          initial: { y: '100%' },
          animate: { y: 0 },
          exit: { y: '100%' },
          style: { 
            left: 0, 
            right: 0, 
            bottom: 0,
            height: sizeValue,
            maxHeight: '90vh',
            borderTopLeftRadius: 'var(--radius-xl)',
            borderTopRightRadius: 'var(--radius-xl)'
          },
        };
      default:
        return {};
    }
  };

  const motionProps = getMotionProps();

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <AnimatePresence>
        {isOpen && (
          <Dialog.Portal forceMount>
            {/* Backdrop */}
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0"
                style={{ 
                  backgroundColor: 'rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(4px)',
                  zIndex: 'var(--z-modal)'
                }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={closeOnOutsideClick ? onClose : undefined}
              />
            </Dialog.Overlay>

            {/* Drawer Content */}
            <Dialog.Content asChild>
              <motion.div
                ref={contentRef}
                className="fixed flex flex-col overflow-hidden"
                style={{
                  backgroundColor: 'var(--surface-1)',
                  borderLeft: position === 'right' ? '1px solid var(--border-default)' : undefined,
                  borderRight: position === 'left' ? '1px solid var(--border-default)' : undefined,
                  borderTop: position === 'bottom' ? '1px solid var(--border-default)' : undefined,
                  zIndex: 'var(--z-modal)',
                  ...motionProps.style,
                }}
                initial={motionProps.initial}
                animate={motionProps.animate}
                exit={motionProps.exit}
                transition={{ 
                  duration: 0.25, 
                  ease: [0.2, 0.8, 0.2, 1] 
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                {(title || showCloseButton) && (
                  <div 
                    className="flex items-center justify-between px-6 py-4 shrink-0"
                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                  >
                    <div>
                      {title && (
                        <Dialog.Title 
                          className="text-lg font-semibold"
                          style={{ color: 'var(--text-1)' }}
                        >
                          {title}
                        </Dialog.Title>
                      )}
                      {description && (
                        <Dialog.Description 
                          className="text-sm mt-1"
                          style={{ color: 'var(--text-2)' }}
                        >
                          {description}
                        </Dialog.Description>
                      )}
                    </div>
                    {showCloseButton && (
                      <button
                        onClick={onClose}
                        className="p-2 rounded-lg transition-colors duration-150"
                        style={{ 
                          color: 'var(--text-2)',
                          backgroundColor: 'transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = 'var(--surface-2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = 'transparent';
                        }}
                        aria-label="Close drawer"
                      >
                        <X size={20} />
                      </button>
                    )}
                  </div>
                )}

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                  {children}
                </div>
              </motion.div>
            </Dialog.Content>
          </Dialog.Portal>
        )}
      </AnimatePresence>
    </Dialog.Root>
  );
};

export default Drawer;

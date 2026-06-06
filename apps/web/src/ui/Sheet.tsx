import { useEffect, type ReactElement, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';

export interface SheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

/**
 * A bottom sheet that slides up over a blurred backdrop — the "native depth"
 * surface. Closes on backdrop click or Escape. Content is unmounted when closed.
 */
export function Sheet({ open, onClose, title, children }: SheetProps): ReactElement {
  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent): void => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          data-testid="sheet-backdrop"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
            zIndex: 50,
          }}
        >
          <motion.div
            role="dialog"
            aria-label={title}
            onClick={(ev) => ev.stopPropagation()}
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
            style={{
              width: '100%',
              maxWidth: 520,
              maxHeight: '85vh',
              overflowY: 'auto',
              background: 'var(--surface)',
              borderTopLeftRadius: 'var(--radius-card)',
              borderTopRightRadius: 'var(--radius-card)',
              border: '1px solid var(--border)',
              padding: '20px 20px calc(20px + env(safe-area-inset-bottom))',
            }}
          >
            <div
              aria-hidden
              style={{
                width: 38,
                height: 4,
                borderRadius: 2,
                background: 'var(--border)',
                margin: '0 auto 16px',
              }}
            />
            <h2 style={{ margin: '0 0 14px', fontSize: 20, fontWeight: 650 }}>{title}</h2>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

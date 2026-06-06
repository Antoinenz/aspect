import { useEffect, type ReactElement } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { connectToServer } from './server-client/socket.js';
import { useConnectionStore } from './store/connectionStore.js';
import { Dashboard } from './dashboard/Dashboard.js';

export function App(): ReactElement {
  const link = useConnectionStore((s) => s.link);
  const serverStatus = useConnectionStore((s) => s.serverStatus);
  const haConnected = useConnectionStore((s) => s.haConnected);

  useEffect(() => connectToServer(), []);

  const healthy = link === 'connected' && serverStatus === 'online' && haConnected;
  const badge =
    link !== 'connected'
      ? 'Connecting…'
      : serverStatus === null
        ? 'Connecting…'
        : serverStatus === 'online' && !haConnected
          ? 'Home Assistant offline'
          : serverStatus === 'degraded'
            ? 'Reconnecting…'
            : null;

  return (
    <>
      <Dashboard />
      <AnimatePresence>
        {!healthy && badge && (
          <motion.div
            key={badge}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            style={{
              position: 'fixed',
              left: '50%',
              transform: 'translateX(-50%)',
              bottom: 'calc(18px + env(safe-area-inset-bottom))',
              padding: '10px 18px',
              borderRadius: 999,
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              color: 'var(--muted)',
              fontSize: 13.5,
              fontWeight: 600,
              zIndex: 40,
            }}
          >
            {badge}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

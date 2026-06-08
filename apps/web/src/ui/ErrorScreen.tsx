import type { ReactElement } from 'react';
import { motion } from 'motion/react';
import { mdiLanDisconnect, mdiHomeOff, mdiFlask } from '@mdi/js';
import { Icon } from './Icon.js';
import { useDemoStore } from '../demo/demoStore.js';
import { SQUIRCLE } from './tokens.js';

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.05 },
  },
  exit: { opacity: 0, transition: { duration: 0.18 } },
};

const item = {
  hidden: { opacity: 0, y: 18 },
  show: { opacity: 1, y: 0, transition: { duration: 0.42, ease: [0.25, 0.46, 0.45, 0.94] } },
};

export function ErrorScreen({ kind }: { kind: 'server' | 'ha' }): ReactElement {
  const setDemo = useDemoStore((s) => s.setDemo);
  const isServer = kind === 'server';

  return (
    <motion.div
      className="flex min-h-dvh flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: 'radial-gradient(ellipse at 50% 25%, rgba(90,110,255,0.08) 0%, #0e0f13 60%)' }}
      variants={container}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      <motion.div
        variants={item}
        className="flex h-[72px] w-[72px] items-center justify-center border border-white/10 bg-white/[0.04]"
        style={{ borderRadius: 24, cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
      >
        <Icon path={isServer ? mdiLanDisconnect : mdiHomeOff} size={32} color="rgba(255,255,255,0.35)" />
      </motion.div>

      <motion.div variants={item} className="flex flex-col gap-2.5">
        <h1 className="m-0 text-[22px] font-extrabold tracking-[-0.4px]">
          {isServer ? "Can't reach Aspect" : 'Home Assistant is offline'}
        </h1>
        <p className="m-0 max-w-[300px] text-[14.5px] leading-relaxed text-[rgba(255,255,255,0.45)]">
          {isServer
            ? 'Make sure the Aspect server is running on your local network.'
            : 'The server is reachable but Home Assistant is not responding.'}
        </p>
      </motion.div>

      <motion.div variants={item} className="flex flex-col items-center gap-3">
        {!isServer && (
          <button
            type="button"
            onClick={() => setDemo(true)}
            className="flex items-center gap-2 border border-white/15 bg-white/[0.06] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-white/[0.1] focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{ borderRadius: 14, cornerShape: `superellipse(${SQUIRCLE})` } as React.CSSProperties}
          >
            <Icon path={mdiFlask} size={16} color="rgba(255,255,255,0.7)" />
            Try demo mode
          </button>
        )}

        <div className="flex items-center gap-2 text-[13px] text-[rgba(255,255,255,0.35)]">
          <span className="relative flex h-2 w-2 shrink-0">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/40" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-white/40" />
          </span>
          Retrying…
        </div>
      </motion.div>
    </motion.div>
  );
}

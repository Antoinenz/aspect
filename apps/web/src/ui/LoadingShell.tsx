import type { ReactElement } from 'react';
import { motion } from 'motion/react';

const page = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const stagger = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.12 } },
};

const row = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.32, ease: [0.25, 0.46, 0.45, 0.94] } },
};

function Bone({ className = '', style }: { className?: string; style?: React.CSSProperties }): ReactElement {
  return <div className={`animate-pulse rounded-[8px] bg-white/[0.07] ${className}`} style={style} />;
}

function TileSkeleton({ wide = false }: { wide?: boolean }): ReactElement {
  return (
    <div className={`flex min-h-[120px] flex-col rounded-[20px] border border-white/[0.06] bg-white/[0.04] p-4 ${wide ? 'col-span-2' : ''}`}>
      <Bone className="h-[42px] w-[42px] flex-none rounded-[13px]" />
      <div className="mt-auto flex flex-col gap-1.5">
        <Bone className="h-3.5 rounded-[5px]" style={{ width: '62%' }} />
        <Bone className="h-2.5 rounded-[4px]" style={{ width: '38%' }} />
      </div>
    </div>
  );
}

export function LoadingShell(): ReactElement {
  return (
    <motion.div
      className="flex h-dvh overflow-hidden"
      variants={page}
      initial="hidden"
      animate="show"
      exit="exit"
    >
      {/* ── Sidebar skeleton (desktop only) ── */}
      <aside className="hidden h-full w-[226px] flex-none flex-col gap-1 border-r border-white/7 bg-[rgba(20,22,28,0.5)] p-3.5 backdrop-blur-[20px] md:flex">
        <div className="flex items-center gap-3 px-2 pb-4 pt-1.5">
          <Bone className="h-8 w-8 flex-none rounded-[10px]" />
          <Bone className="h-5 w-20" />
        </div>
        <div className="flex flex-col gap-1">
          {[1, 2, 3, 4].map((i) => (
            <Bone key={i} className="h-10 w-full rounded-[13px]" />
          ))}
        </div>
        <div className="flex-1" />
        <Bone className="h-10 w-full rounded-[13px]" />
      </aside>

      {/* ── Main content skeleton ── */}
      <main className="flex-1 overflow-y-auto overflow-x-hidden px-5 pb-24 pt-[calc(24px+env(safe-area-inset-top))] md:px-8 md:pb-10">
        <motion.div className="mx-auto max-w-[1100px]" variants={stagger} initial="hidden" animate="show">

          {/* Header row */}
          <motion.div variants={row} className="mb-6 flex items-start justify-between gap-3">
            <div className="flex flex-col gap-2">
              <Bone className="h-8 w-28" />
              <Bone className="h-3 w-52 rounded-[5px]" />
            </div>
            <div className="flex gap-2 pt-1">
              <Bone className="h-8 w-20 rounded-[13px]" />
              <Bone className="h-8 w-20 rounded-[13px]" />
            </div>
          </motion.div>

          {/* Status pills row */}
          <motion.div variants={row} className="mb-6 flex gap-2.5">
            <Bone className="h-8 w-24 flex-none rounded-full" />
            <Bone className="h-8 w-20 flex-none rounded-full" />
            <Bone className="h-8 w-[72px] flex-none rounded-full" />
          </motion.div>

          {/* First tile section */}
          <motion.div variants={row} className="mb-6">
            <Bone className="mb-3 h-3 w-16 rounded-[5px]" />
            <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              <TileSkeleton />
              <TileSkeleton />
              <TileSkeleton />
              <TileSkeleton wide />
              <TileSkeleton />
            </div>
          </motion.div>

          {/* Second tile section */}
          <motion.div variants={row}>
            <Bone className="mb-3 h-3 w-20 rounded-[5px]" />
            <div className="grid gap-[13px] [grid-template-columns:repeat(auto-fill,minmax(150px,1fr))]">
              <TileSkeleton />
              <TileSkeleton />
              <TileSkeleton wide />
            </div>
          </motion.div>

        </motion.div>
      </main>

      {/* ── Bottom bar skeleton (mobile only) ── */}
      <nav
        className="fixed inset-x-0 bottom-0 z-30 flex items-stretch justify-around border-t border-white/10 bg-[rgba(18,20,26,0.8)] backdrop-blur-[22px] md:hidden"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex flex-1 flex-col items-center gap-1.5 py-2.5">
            <Bone className="h-[22px] w-[22px] rounded-full" />
            <Bone className="h-2 w-8 rounded-[4px]" />
          </div>
        ))}
      </nav>
    </motion.div>
  );
}

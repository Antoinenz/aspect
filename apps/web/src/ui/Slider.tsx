import * as RSlider from '@radix-ui/react-slider';
import type { ReactElement } from 'react';

export function Slider({
  value, min = 0, max = 100, step = 1, onCommit, onValueChange, ariaLabel,
}: {
  value: number; min?: number; max?: number; step?: number;
  onCommit: (v: number) => void; onValueChange?: (v: number) => void; ariaLabel: string;
}): ReactElement {
  return (
    <RSlider.Root
      className="relative flex h-6 w-full touch-none items-center"
      value={[value]} min={min} max={max} step={step}
      onValueChange={(v) => onValueChange?.(v[0] ?? value)}
      onValueCommit={(v) => onCommit(v[0] ?? value)}
    >
      <RSlider.Track className="relative h-1.5 grow rounded-full bg-white/15">
        <RSlider.Range className="absolute h-full rounded-full bg-white/80" />
      </RSlider.Track>
      <RSlider.Thumb aria-label={ariaLabel} className="block h-5 w-5 rounded-full bg-white shadow-md focus:outline-none" />
    </RSlider.Root>
  );
}

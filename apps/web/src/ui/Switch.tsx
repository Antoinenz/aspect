import * as RSwitch from '@radix-ui/react-switch';
import type { ReactElement } from 'react';

export function Switch({
  checked, onCheckedChange, ariaLabel,
}: { checked: boolean; onCheckedChange: (v: boolean) => void; ariaLabel: string }): ReactElement {
  return (
    <RSwitch.Root
      checked={checked} onCheckedChange={onCheckedChange} aria-label={ariaLabel}
      className="relative h-7 w-12 rounded-full border border-white/10 bg-white/15 data-[state=checked]:bg-white/85"
    >
      <RSwitch.Thumb className="block h-5 w-5 translate-x-1 rounded-full bg-white transition-transform data-[state=checked]:translate-x-6 data-[state=checked]:bg-[#15161a]" />
    </RSwitch.Root>
  );
}

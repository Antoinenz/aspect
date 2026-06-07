import MdiIcon from '@mdi/react';
import type { ReactElement } from 'react';

/** Renders an MDI path. `path` is an `mdi*` export from @mdi/js. */
export function Icon({
  path,
  size = 22,
  color = 'currentColor',
}: {
  path: string;
  size?: number;
  color?: string;
}): ReactElement {
  return <MdiIcon path={path} size={`${size}px`} color={color} />;
}

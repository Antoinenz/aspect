import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { mdiLightbulb } from '@mdi/js';
import { Icon } from './Icon.js';

describe('Icon', () => {
  it('renders an svg path', () => {
    const { container } = render(<Icon path={mdiLightbulb} />);
    expect(container.querySelector('svg path')).toBeTruthy();
  });
});

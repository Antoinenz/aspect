import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { mdiSofaOutline } from '@mdi/js';
import { Tabs, TabPanel } from './Tabs.js';

describe('Tabs', () => {
  it('renders triggers and switches panels on click', async () => {
    const onChange = vi.fn();
    render(
      <Tabs value="a" onValueChange={onChange}
        items={[{ id: 'a', label: 'Alpha', path: mdiSofaOutline }, { id: 'b', label: 'Beta', path: mdiSofaOutline }]}>
        <TabPanel value="a">Panel A</TabPanel>
        <TabPanel value="b">Panel B</TabPanel>
      </Tabs>,
    );
    expect(screen.getByText('Panel A')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('tab', { name: /beta/i }));
    expect(onChange).toHaveBeenCalledWith('b');
  });
});

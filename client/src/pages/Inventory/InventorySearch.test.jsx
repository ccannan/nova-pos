import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { INVENTORY_ITEM } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { InventorySearch } from './InventorySearch';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/inventory']}>
      <InventorySearch />
    </MemoryRouter>
  );
}

// Three live instances of the same design (FIFO ordered by acquisitionDate).
const THREE_INSTANCES = [
  { ...INVENTORY_ITEM, inventoryItemId: 'ffffffff-0000-0000-0000-000000000001', acquisitionDate: '2026-01-15T00:00:00Z' },
  { ...INVENTORY_ITEM, inventoryItemId: 'ffffffff-0000-0000-0000-000000000002', acquisitionDate: '2026-02-20T00:00:00Z' },
  { ...INVENTORY_ITEM, inventoryItemId: 'ffffffff-0000-0000-0000-000000000003', acquisitionDate: '2026-03-10T00:00:00Z' },
];

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('InventorySearch', () => {
  // --- Render ---

  it('renders the inventory search heading', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /inventory/i })).toBeInTheDocument();
  });

  it('renders a search field', () => {
    renderComponent();
    expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
  });

  // --- Loading state ---

  it('shows a loading indicator while searching', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Diamond');
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // --- Success state ---

  it('displays matching inventory items after a search', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Diamond');
    await waitFor(() => {
      expect(screen.getByText('Diamond Solitaire Ring')).toBeInTheDocument();
    });
  });

  it('displays the effective retail price and status for a result', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Diamond');
    await waitFor(() => {
      expect(screen.getByText(/1,?299(\.00)?/)).toBeInTheDocument();
    });
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });

  // --- Empty state ---

  it('shows an empty-state message when no inventory matches', async () => {
    server.use(
      http.get('/api/inventory', () =>
        HttpResponse.json({ total: 0, page: 1, limit: 20, results: [] })
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Nothing');
    await waitFor(() => {
      expect(screen.getByText(/no (inventory|items|stock) found/i)).toBeInTheDocument();
    });
  });

  // --- Error state ---

  it('shows an error message when the inventory request returns 500', async () => {
    server.use(http.get('/api/inventory', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Diamond');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // --- User interaction ---

  it('calls GET /api/inventory with a description param for a text search', async () => {
    let params = null;
    server.use(
      http.get('/api/inventory', ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ total: 1, page: 1, limit: 20, results: [INVENTORY_ITEM] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Diamond');
    await waitFor(() => {
      expect(params.get('description')).toBe('Diamond');
    });
  });

  // --- FIFO ordering ---

  it('renders multiple instances of one design in the order returned (FIFO)', async () => {
    server.use(
      http.get('/api/inventory', () =>
        HttpResponse.json({ total: 3, page: 1, limit: 20, results: THREE_INSTANCES })
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Diamond');
    await waitFor(() => {
      expect(screen.getAllByText('Diamond Solitaire Ring')).toHaveLength(3);
    });
    // TODO: assert the first rendered row corresponds to the oldest acquisitionDate
    // (the server returns FIFO order; the UI must preserve it).
  });
});

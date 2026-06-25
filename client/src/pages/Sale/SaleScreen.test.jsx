import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { INVENTORY_ITEM, CUSTOMER, SALE } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { SaleScreen } from './SaleScreen';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/sale']}>
      <SaleScreen />
    </MemoryRouter>
  );
}

// Three live instances of the same design, distinct inventoryItemIds (FIFO order).
const THREE_INSTANCES = [
  { ...INVENTORY_ITEM, inventoryItemId: 'ffffffff-0000-0000-0000-000000000001', acquisitionDate: '2026-01-15T00:00:00Z' },
  { ...INVENTORY_ITEM, inventoryItemId: 'ffffffff-0000-0000-0000-000000000002', acquisitionDate: '2026-02-20T00:00:00Z' },
  { ...INVENTORY_ITEM, inventoryItemId: 'ffffffff-0000-0000-0000-000000000003', acquisitionDate: '2026-03-10T00:00:00Z' },
];

// Returns inventory results, optionally a custom list.
function inventoryReturning(results) {
  return http.get('/api/inventory', () =>
    HttpResponse.json({ total: results.length, page: 1, limit: 20, results })
  );
}

// Helper: search and add the (idx-th) result to the sale.
async function searchAndAdd(user, term, idx = 0) {
  await user.type(screen.getByRole('searchbox', { name: /item|search|scan/i }), term);
  const addButtons = await screen.findAllByRole('button', { name: /add to sale|add/i });
  await user.click(addButtons[idx]);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('SaleScreen', () => {
  // ─── Render ─────────────────────────────────────────────────────────────

  it('renders the sale screen heading', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /sale|new sale|point of sale/i })).toBeInTheDocument();
  });

  it('renders the item search/scan field', () => {
    renderComponent();
    expect(screen.getByRole('searchbox', { name: /item|search|scan/i })).toBeInTheDocument();
  });

  it('renders a Complete Sale button', () => {
    renderComponent();
    expect(screen.getByRole('button', { name: /complete sale|complete|pay/i })).toBeInTheDocument();
  });

  // ─── Item search by description ───────────────────────────────────────────

  it('calls GET /api/inventory with a description param when searching by text', async () => {
    let params = null;
    server.use(
      http.get('/api/inventory', ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ total: 1, page: 1, limit: 20, results: [INVENTORY_ITEM] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /item|search|scan/i }), 'Diamond');
    await waitFor(() => {
      expect(params.get('description')).toBe('Diamond');
    });
    // It must NOT send the text as an inventoryItemId for a plain description search.
    expect(params.get('inventoryItemId')).toBeNull();
  });

  it('shows the search result so it can be added to the sale', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /item|search|scan/i }), 'Diamond');
    await waitFor(() => {
      expect(screen.getByText('Diamond Solitaire Ring')).toBeInTheDocument();
    });
  });

  // ─── Item scan by inventoryItemId ─────────────────────────────────────────

  it('calls GET /api/inventory with an inventoryItemId param when a scan value is entered', async () => {
    let params = null;
    server.use(
      http.get('/api/inventory', ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({ total: 1, page: 1, limit: 20, results: [INVENTORY_ITEM] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    // A scanned barcode is an exact inventoryItemId. TODO: confirm how the UI
    // distinguishes a scan from a text search (separate field, or a value that
    // looks like a UUID). This test assumes the inventoryItemId value routes to
    // the inventoryItemId param.
    const field = screen.getByRole('searchbox', { name: /item|search|scan/i });
    await user.type(field, INVENTORY_ITEM.inventoryItemId);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(params.get('inventoryItemId')).toBe(INVENTORY_ITEM.inventoryItemId);
    });
  });

  it('adds the exact scanned item to the sale', async () => {
    const user = userEvent.setup();
    renderComponent();
    const field = screen.getByRole('searchbox', { name: /item|search|scan/i });
    await user.type(field, INVENTORY_ITEM.inventoryItemId);
    await user.keyboard('{Enter}');
    await waitFor(() => {
      expect(screen.getByText('Diamond Solitaire Ring')).toBeInTheDocument();
    });
    // TODO: assert the line carries INVENTORY_ITEM.inventoryItemId.
  });

  // ─── Add one item to the sale ─────────────────────────────────────────────

  it('adds a sale line showing the item description and price when added', async () => {
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    // The line region should show the description and the unit price.
    // TODO: scope to the sale-lines region (e.g. getByRole('table') / a list)
    // once the markup exists; for now assert presence after add.
    await waitFor(() => {
      expect(screen.getByText('Diamond Solitaire Ring')).toBeInTheDocument();
    });
  });

  // ─── Add two instances of the same design ─────────────────────────────────

  it('produces two distinct sale lines with different inventoryItemIds for the same design', async () => {
    server.use(inventoryReturning(THREE_INSTANCES));
    let postBody = null;
    server.use(
      http.post('/api/sales', async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json(
          { saleId: SALE.saleId, saleNumber: 42, status: 'Active', grandTotal: 2598, receiptHtml: '<html></html>', queued: [] },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderComponent();

    // Add the first instance, then the second instance from the same result list.
    await user.type(screen.getByRole('searchbox', { name: /item|search|scan/i }), 'Diamond');
    const addButtons = await screen.findAllByRole('button', { name: /add to sale|add/i });
    await user.click(addButtons[0]);
    await user.click(addButtons[1]);

    // Two lines should be present.
    await waitFor(() => {
      expect(screen.getAllByText('Diamond Solitaire Ring')).toHaveLength(2);
    });

    // The authoritative check: the POST payload carries two distinct ids.
    // TODO: enter tender then complete to trigger the POST, or assert distinct
    // ids via per-line data attributes before completion.
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(postBody).not.toBeNull();
    });
    const ids = postBody.lines.map((l) => l.inventoryItemId);
    expect(new Set(ids).size).toBe(2);
    expect(ids).toContain(THREE_INSTANCES[0].inventoryItemId);
    expect(ids).toContain(THREE_INSTANCES[1].inventoryItemId);
  });

  // ─── Remove a sale line ───────────────────────────────────────────────────

  it('removes a sale line from the display when the remove button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.click(screen.getByRole('button', { name: /remove|delete line|×/i }));
    await waitFor(() => {
      expect(screen.queryByText('Diamond Solitaire Ring')).not.toBeInTheDocument();
    });
  });

  it('does NOT call POST /api/sales when a line is removed', async () => {
    let called = false;
    server.use(
      http.post('/api/sales', () => {
        called = true;
        return HttpResponse.json({ saleId: SALE.saleId, queued: [] }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.click(screen.getByRole('button', { name: /remove|delete line|×/i }));
    expect(called).toBe(false);
  });

  // ─── Cash tender and change due ───────────────────────────────────────────

  it('displays the change due for a cash tender greater than the grand total', async () => {
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond'); // one line @ 1299.00
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1500');
    // Change due = 1500.00 - 1299.00 = 201.00
    await waitFor(() => {
      expect(screen.getByText(/201(\.00)?/)).toBeInTheDocument();
    });
  });

  // ─── Tender must equal grand total ────────────────────────────────────────

  it('blocks completion when the tender amount is less than the grand total', async () => {
    let called = false;
    server.use(
      http.post('/api/sales', () => {
        called = true;
        return HttpResponse.json({ saleId: SALE.saleId, queued: [] }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '500');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    expect(called).toBe(false);
  });

  it('shows a validation message when the tender is insufficient', async () => {
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '500');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(screen.getByText(/insufficient|does not (cover|equal)|tender/i)).toBeInTheDocument();
    });
  });

  // ─── Successful sale — 201 ────────────────────────────────────────────────

  it('clears the screen or navigates to the receipt after a successful sale (201)', async () => {
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    // After success the active sale lines should no longer be on the entry screen.
    await waitFor(() => {
      expect(screen.queryByText('Diamond Solitaire Ring')).not.toBeInTheDocument();
    });
    // TODO: if it navigates to a receipt/confirmation view instead of clearing,
    // assert the confirmation heading (e.g. /sale complete|receipt/i) here.
  });

  it('shows no warning message after a clean 201 sale', async () => {
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(screen.queryByText(/queued|saved locally|warning/i)).not.toBeInTheDocument();
    });
  });

  // ─── Partial write warning — 207 ──────────────────────────────────────────

  it('shows a warning when the sale is partially queued (207)', async () => {
    server.use(
      http.post('/api/sales', () =>
        HttpResponse.json(
          {
            saleId: SALE.saleId,
            saleNumber: 42,
            status: 'Active',
            grandTotal: 1299,
            receiptHtml: '<html></html>',
            queued: ['SaleTender'],
          },
          { status: 207 }
        )
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(screen.getByText(/queued|will be (submitted|processed)|some data/i)).toBeInTheDocument();
    });
  });

  it('does not block the user on a 207 — the sale is shown as completed', async () => {
    server.use(
      http.post('/api/sales', () =>
        HttpResponse.json(
          { saleId: SALE.saleId, saleNumber: 42, status: 'Active', grandTotal: 1299, receiptHtml: '<html></html>', queued: ['SaleTender'] },
          { status: 207 }
        )
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      // Confirmation surface exists (sale number shown / completed state).
      expect(screen.getByText(/42|complete|done/i)).toBeInTheDocument();
    });
  });

  // ─── InventoryItem conflict — 409 ─────────────────────────────────────────

  it('shows an error and keeps sale lines visible on a 409 INVENTORY_ITEM_NOT_ACTIVE', async () => {
    server.use(
      http.post('/api/sales', () =>
        HttpResponse.json(
          {
            error: 'INVENTORY_ITEM_NOT_ACTIVE',
            message: 'One or more items are no longer Active.',
            conflictingIds: [INVENTORY_ITEM.inventoryItemId],
          },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // Sale lines remain so the user can fix the order.
    expect(screen.getByText('Diamond Solitaire Ring')).toBeInTheDocument();
  });

  // ─── Validation error — 400 ───────────────────────────────────────────────

  it('shows a validation error message on a 400 from POST /api/sales', async () => {
    server.use(
      http.post('/api/sales', () =>
        HttpResponse.json(
          { error: 'VALIDATION_FAILED', message: 'One or more fields are invalid.', fields: { tender: 'Tender must equal grand total.' } },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // ─── Customer search and selection ────────────────────────────────────────

  it('calls GET /api/customers with a search param when searching for a customer', async () => {
    let captured = null;
    server.use(
      http.get('/api/customers', ({ request }) => {
        captured = new URL(request.url).searchParams.get('search');
        return HttpResponse.json({ total: 1, page: 1, limit: 20, results: [CUSTOMER] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /customer/i }), 'Smith');
    await waitFor(() => {
      expect(captured).toBe('Smith');
    });
  });

  it('shows the selected customer name in the sale header', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /customer/i }), 'Smith');
    const result = await screen.findByText(/jane smith/i);
    await user.click(result);
    await waitFor(() => {
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    });
  });

  it('includes customerId in the POST payload when a customer is selected', async () => {
    let postBody = null;
    server.use(
      http.post('/api/sales', async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json({ saleId: SALE.saleId, saleNumber: 42, status: 'Active', grandTotal: 1299, receiptHtml: '<html></html>', queued: [] }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    // Select a customer.
    await user.type(screen.getByRole('searchbox', { name: /customer/i }), 'Smith');
    await user.click(await screen.findByText(/jane smith/i));
    // Build and complete the sale.
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(postBody?.customerId).toBe(CUSTOMER.customerId);
    });
  });

  // ─── Walk-in sale (no customer) ───────────────────────────────────────────

  it('sends customerId: null for a walk-in sale (no customer selected)', async () => {
    let postBody = null;
    server.use(
      http.post('/api/sales', async ({ request }) => {
        postBody = await request.json();
        return HttpResponse.json({ saleId: SALE.saleId, saleNumber: 42, status: 'Active', grandTotal: 1299, receiptHtml: '<html></html>', queued: [] }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await searchAndAdd(user, 'Diamond');
    await screen.findByText('Diamond Solitaire Ring');
    await user.type(screen.getByLabelText(/cash|tender|amount tendered/i), '1299');
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    await waitFor(() => {
      expect(postBody).not.toBeNull();
    });
    expect(postBody.customerId).toBeNull();
  });

  // ─── Empty-cart guard ─────────────────────────────────────────────────────

  it('does not call POST /api/sales when there are no sale lines', async () => {
    let called = false;
    server.use(
      http.post('/api/sales', () => {
        called = true;
        return HttpResponse.json({ saleId: SALE.saleId, queued: [] }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /complete sale|complete|pay/i }));
    expect(called).toBe(false);
  });

  // ─── Accessibility ────────────────────────────────────────────────────────

  it('exposes the item search and cash tender fields via accessible labels', () => {
    renderComponent();
    expect(screen.getByRole('searchbox', { name: /item|search|scan/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/cash|tender|amount tendered/i)).toBeInTheDocument();
  });
});

// ─── Void Sale ──────────────────────────────────────────────────────────────
//
// The Void action operates on a completed/active sale. The bootstrap does not
// specify a dedicated SaleDetail page path, so these tests assume the Void
// button lives on the sale view rendered after completion (or on a sale-detail
// route). They render via a route that loads the sale detail (GET /api/sales/:id)
// then exercise the void confirmation flow.
// TODO: point this at the real component/route once the sale-detail view exists.

describe('SaleScreen — Void', () => {
  function renderSaleView(id = SALE.saleId) {
    return render(
      <MemoryRouter initialEntries={[`/sales/${id}`]}>
        {/* TODO: replace with the actual sale-detail route element that renders
            the loaded sale and the Void button. */}
        <SaleScreen />
      </MemoryRouter>
    );
  }

  it('shows a confirmation dialog before calling the void endpoint', async () => {
    const user = userEvent.setup();
    renderSaleView();
    await screen.findByText(/42|diamond solitaire ring/i);
    await user.click(screen.getByRole('button', { name: /void/i }));
    await waitFor(() => {
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });

  it('does NOT call PUT /api/sales/:id/void when the confirmation is cancelled', async () => {
    let called = false;
    server.use(
      http.put('/api/sales/:id/void', () => {
        called = true;
        return HttpResponse.json({ saleId: SALE.saleId, status: 'Voided', voidedAt: '2026-06-13T11:00:00Z' });
      })
    );
    const user = userEvent.setup();
    renderSaleView();
    await screen.findByText(/42|diamond solitaire ring/i);
    await user.click(screen.getByRole('button', { name: /void/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /cancel|no/i }));
    expect(called).toBe(false);
  });

  it('calls PUT /api/sales/:id/void when the void is confirmed', async () => {
    let called = false;
    let voidedId = null;
    server.use(
      http.put('/api/sales/:id/void', ({ params }) => {
        called = true;
        voidedId = params.id;
        return HttpResponse.json({ saleId: SALE.saleId, status: 'Voided', voidedAt: '2026-06-13T11:00:00Z' });
      })
    );
    const user = userEvent.setup();
    renderSaleView();
    await screen.findByText(/42|diamond solitaire ring/i);
    await user.click(screen.getByRole('button', { name: /void/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /confirm|yes|void/i }));
    await waitFor(() => {
      expect(called).toBe(true);
    });
    expect(voidedId).toBe(SALE.saleId);
  });

  it('updates the status display to Voided and disables/hides the Void button on success (200)', async () => {
    const user = userEvent.setup();
    renderSaleView();
    await screen.findByText(/42|diamond solitaire ring/i);
    await user.click(screen.getByRole('button', { name: /void/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /confirm|yes|void/i }));
    await waitFor(() => {
      expect(screen.getByText(/voided/i)).toBeInTheDocument();
    });
    // Void button is gone or disabled.
    const voidBtn = screen.queryByRole('button', { name: /^void$/i });
    expect(voidBtn === null || voidBtn.disabled).toBe(true);
  });

  it('shows an error when voiding an already-voided sale (409 SALE_ALREADY_VOIDED)', async () => {
    server.use(
      http.put('/api/sales/:id/void', () =>
        HttpResponse.json({ error: 'SALE_ALREADY_VOIDED', message: 'Sale is already Voided' }, { status: 409 })
      )
    );
    const user = userEvent.setup();
    renderSaleView();
    await screen.findByText(/42|diamond solitaire ring/i);
    await user.click(screen.getByRole('button', { name: /void/i }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: /confirm|yes|void/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });
});

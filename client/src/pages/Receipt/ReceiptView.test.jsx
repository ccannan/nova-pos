import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { SALE } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { ReceiptView } from './ReceiptView';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => {
  server.resetHandlers();
  vi.restoreAllMocks();
});
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderComponent(id = SALE.saleId) {
  return render(
    <MemoryRouter initialEntries={[`/sales/${id}/receipt`]}>
      <Routes>
        <Route path="/sales/:id/receipt" element={<ReceiptView />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ReceiptView', () => {
  // --- Render ---

  it('renders a Print button', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument();
    });
  });

  // --- Loading state ---

  it('shows a loading indicator while fetching the receipt', () => {
    renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // --- Success state: HTML in an iframe ---

  it('renders the receipt HTML inside an iframe', async () => {
    renderComponent();
    await waitFor(() => {
      // An iframe has an implicit accessible name; query by title or test id.
      // TODO: add a title attribute to the iframe (e.g. title="Receipt") so it
      // is reachable via getByTitle. Fallback below uses the DOM tag directly.
      const iframe = document.querySelector('iframe');
      expect(iframe).not.toBeNull();
    });
  });

  it('passes the route id through to GET /api/sales/:id/receipt', async () => {
    let requestedId = null;
    server.use(
      http.get('/api/sales/:id/receipt', ({ params }) => {
        requestedId = params.id;
        return HttpResponse.html('<html><body>Receipt</body></html>');
      })
    );
    renderComponent(SALE.saleId);
    await waitFor(() => {
      expect(requestedId).toBe(SALE.saleId);
    });
  });

  // --- Print ---

  it('calls window.print exactly once when the Print button is clicked', async () => {
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});
    const user = userEvent.setup();
    renderComponent();
    const printBtn = await screen.findByRole('button', { name: /print/i });
    await user.click(printBtn);
    expect(printSpy).toHaveBeenCalledTimes(1);
  });

  // --- Error state ---

  it('shows a not-found message when the sale does not exist (404 SALE_NOT_FOUND)', async () => {
    server.use(
      http.get('/api/sales/:id/receipt', () =>
        HttpResponse.json({ error: 'SALE_NOT_FOUND', message: 'No sale with given ID' }, { status: 404 })
      )
    );
    renderComponent('00000000-0000-0000-0000-000000000000');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows a receipt-not-ready message when the receipt was queued (404 RECEIPT_NOT_GENERATED)', async () => {
    server.use(
      http.get('/api/sales/:id/receipt', () =>
        HttpResponse.json(
          { error: 'RECEIPT_NOT_GENERATED', message: 'Sale exists but ReceiptContent has not yet been written' },
          { status: 404 }
        )
      )
    );
    renderComponent();
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
    // TODO: if the UI distinguishes "not generated yet" from "not found", assert
    // a more specific message (e.g. /not.*ready|being prepared/i).
  });
});

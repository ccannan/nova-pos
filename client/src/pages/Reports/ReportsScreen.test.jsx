import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { SALE } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { ReportsScreen } from './ReportsScreen';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/reports']}>
      <ReportsScreen />
    </MemoryRouter>
  );
}

// Fill the from/to date inputs with valid values.
async function setDateRange(user, from = '2026-06-01', to = '2026-06-13') {
  await user.type(screen.getByLabelText(/from/i), from);
  await user.type(screen.getByLabelText(/to/i), to);
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ReportsScreen', () => {
  // --- Render ---

  it('renders the reports page heading', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /report/i })).toBeInTheDocument();
  });

  it('renders from and to date inputs and a Run Report button', () => {
    renderComponent();
    expect(screen.getByLabelText(/from/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/to/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /run report|run/i })).toBeInTheDocument();
  });

  // --- Date range required validation ---

  it('does not call GET /api/reports/sales when no date range is set', async () => {
    let called = false;
    server.use(
      http.get('/api/reports/sales', () => {
        called = true;
        return HttpResponse.json({ from: '', to: '', saleCount: 0, itemCount: 0, subTotal: 0, discountTotal: 0, grandTotal: 0 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    expect(called).toBe(false);
  });

  it('prompts the user to select dates when the range is missing', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      expect(screen.getByText(/select.*date|date range.*required|required/i)).toBeInTheDocument();
    });
  });

  // --- Loading state ---

  it('shows a loading indicator while the report is fetching', async () => {
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // --- Per-sale (default detail) ---

  it('passes from and to params to GET /api/reports/sales', async () => {
    let params = null;
    server.use(
      http.get('/api/reports/sales', ({ request }) => {
        params = new URL(request.url).searchParams;
        return HttpResponse.json({
          from: '2026-06-01',
          to: '2026-06-13',
          totals: { saleCount: 1, itemCount: 1, grandTotal: 1299 },
          sales: [],
        });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      expect(params.get('from')).toBe('2026-06-01');
      expect(params.get('to')).toBe('2026-06-13');
    });
  });

  it('displays per-sale rows with sale number and grand total', async () => {
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      expect(screen.getByText(/42/)).toBeInTheDocument();
    });
    expect(screen.getByText(/1,?299(\.00)?/)).toBeInTheDocument();
  });

  // --- Summary detail ---

  it('displays sale count, item count and grand total at the summary detail level', async () => {
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    // TODO: confirm the detail-level control type (select vs radio/tabs).
    await user.selectOptions(screen.getByLabelText(/detail/i), 'summary');
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      // saleCount 42, itemCount 58, grandTotal 44000 from the default summary handler.
      expect(screen.getByText(/42/)).toBeInTheDocument();
    });
    expect(screen.getByText(/58/)).toBeInTheDocument();
    expect(screen.getByText(/44,?000(\.00)?/)).toBeInTheDocument();
  });

  it('sends detail=summary when the summary level is chosen', async () => {
    let detail = null;
    server.use(
      http.get('/api/reports/sales', ({ request }) => {
        detail = new URL(request.url).searchParams.get('detail');
        return HttpResponse.json({ from: '2026-06-01', to: '2026-06-13', saleCount: 42, itemCount: 58, subTotal: 45200, discountTotal: 1200, grandTotal: 44000 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.selectOptions(screen.getByLabelText(/detail/i), 'summary');
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      expect(detail).toBe('summary');
    });
  });

  // --- Full detail ---

  it('displays line-level detail at the full detail level', async () => {
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.selectOptions(screen.getByLabelText(/detail/i), 'full');
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      // The default full handler nests SALE.lines (Diamond Solitaire Ring).
      expect(screen.getByText(/Diamond Solitaire Ring/i)).toBeInTheDocument();
    });
  });

  // --- Empty state ---

  it('shows an empty-state message when the report has no sales', async () => {
    server.use(
      http.get('/api/reports/sales', () =>
        HttpResponse.json({ from: '2026-06-01', to: '2026-06-13', totals: { saleCount: 0, itemCount: 0, grandTotal: 0 }, sales: [] })
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      expect(screen.getByText(/no sales|no results|nothing/i)).toBeInTheDocument();
    });
  });

  // --- Error state ---

  it('shows an error message when the report request returns 500', async () => {
    server.use(http.get('/api/reports/sales', () => new HttpResponse(null, { status: 500 })));
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    await user.click(screen.getByRole('button', { name: /run report|run/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // --- CSV export ---

  it('calls the report endpoint with format=csv when Export CSV is clicked', async () => {
    let format = null;
    server.use(
      http.get('/api/reports/sales', ({ request }) => {
        const url = new URL(request.url);
        format = url.searchParams.get('format');
        if (format === 'csv') {
          return new HttpResponse('saleNumber,grandTotal\n42,1299.00\n', {
            headers: { 'Content-Type': 'text/csv', 'Content-Disposition': 'attachment; filename="sales.csv"' },
          });
        }
        return HttpResponse.json({ from: '2026-06-01', to: '2026-06-13', totals: { saleCount: 1, itemCount: 1, grandTotal: 1299 }, sales: [] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await setDateRange(user);
    // TODO: if the CSV export is an anchor with an href rather than a fetch,
    // assert the href contains format=csv instead of capturing a request.
    await user.click(screen.getByRole('button', { name: /export csv|csv/i }));
    await waitFor(() => {
      expect(format).toBe('csv');
    });
  });
});

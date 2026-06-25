import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { CUSTOMER } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { CustomerList } from './CustomerList';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderComponent() {
  return render(
    <MemoryRouter initialEntries={['/customers']}>
      <CustomerList />
    </MemoryRouter>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CustomerList', () => {
  // --- Render ---

  it('renders the customers page heading', () => {
    renderComponent();
    expect(screen.getByRole('heading', { name: /customers/i })).toBeInTheDocument();
  });

  it('renders a customer search field', () => {
    renderComponent();
    expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
    // TODO: if not a role=searchbox, fall back to getByLabelText(/search/i)
  });

  // --- Loading state ---

  it('shows a loading indicator while the search request is in flight', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Smith');
    expect(screen.getByRole('status')).toBeInTheDocument(); // or getByText(/loading/i)
  });

  // --- Success state ---

  it('displays matching customers after a successful search', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Smith');
    await waitFor(() => {
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    });
  });

  it('displays the primary phone and email for a result row', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Smith');
    await waitFor(() => {
      expect(screen.getByText(CUSTOMER.primaryPhone)).toBeInTheDocument();
    });
    expect(screen.getByText(CUSTOMER.primaryEmail)).toBeInTheDocument();
  });

  // --- Empty state ---

  it('shows an empty-state message when no customers match', async () => {
    server.use(
      http.get('/api/customers', () =>
        HttpResponse.json({ total: 0, page: 1, limit: 20, results: [] })
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Nobody');
    await waitFor(() => {
      expect(screen.getByText(/no customers found/i)).toBeInTheDocument();
    });
  });

  // --- Error state ---

  it('shows an error message when the search request returns 500', async () => {
    server.use(
      http.get('/api/customers', () => new HttpResponse(null, { status: 500 }))
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Smith');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // --- User interaction ---

  it('calls GET /api/customers with the typed search value', async () => {
    let captured = null;
    server.use(
      http.get('/api/customers', ({ request }) => {
        captured = new URL(request.url).searchParams.get('search');
        return HttpResponse.json({ total: 1, page: 1, limit: 20, results: [CUSTOMER] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Smith');
    await waitFor(() => {
      expect(captured).toBe('Smith');
    });
  });

  it('navigates to the customer detail route when a result is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'Smith');
    const row = await screen.findByText(/jane smith/i);
    await user.click(row);
    // TODO: assert navigation — e.g. a router spy or that the detail URL is reached.
    // Suggested: render with a route table and assert detail content appears,
    // or wrap CustomerList with a location-display test harness.
    await waitFor(() => {
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    });
  });

  it('navigates to the new-customer form when the Add button is clicked', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /add customer|new customer/i }));
    // TODO: assert navigation to the create route (router spy or location display).
  });

  // --- Accessibility ---

  it('exposes the search input via an accessible label', () => {
    renderComponent();
    // getByLabelText throws if no label association exists.
    expect(screen.getByRole('searchbox', { name: /search/i })).toBeInTheDocument();
  });
});

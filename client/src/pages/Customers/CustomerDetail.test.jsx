import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { CUSTOMER } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { CustomerDetail } from './CustomerDetail';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

// CustomerDetail reads the customer id from the route param.
function renderComponent(id = CUSTOMER.customerId) {
  return render(
    <MemoryRouter initialEntries={[`/customers/${id}`]}>
      <Routes>
        <Route path="/customers/:id" element={<CustomerDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('CustomerDetail', () => {
  // --- Loading state ---

  it('shows a loading indicator while fetching the customer', () => {
    renderComponent();
    expect(screen.getByRole('status')).toBeInTheDocument(); // or getByText(/loading/i)
  });

  // --- Success state ---

  it('displays the customer name after a successful fetch', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    });
  });

  it('passes the route id param through to GET /api/customers/:id', async () => {
    let requestedId = null;
    server.use(
      http.get('/api/customers/:id', ({ params }) => {
        requestedId = params.id;
        return HttpResponse.json({
          customerId: CUSTOMER.customerId,
          firstName: 'Jane',
          lastName: 'Smith',
          notes: '',
          contacts: [],
        });
      })
    );
    renderComponent(CUSTOMER.customerId);
    await waitFor(() => {
      expect(requestedId).toBe(CUSTOMER.customerId);
    });
  });

  // --- Contacts grouped by type (POS-specific scenario) ---

  it('displays Phone, Email, and Address contacts for the customer', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText('0412 000 000')).toBeInTheDocument();
    });
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.getByText(/12 Rose St/i)).toBeInTheDocument();
  });

  it('shows the label for each contact (Mobile, Work, Home)', async () => {
    renderComponent();
    await waitFor(() => {
      expect(screen.getByText(/mobile/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/work/i)).toBeInTheDocument();
    expect(screen.getByText(/home/i)).toBeInTheDocument();
  });

  // --- Error state ---

  it('shows a not-found message when the customer does not exist (404)', async () => {
    server.use(
      http.get('/api/customers/:id', () =>
        HttpResponse.json(
          { error: 'CUSTOMER_NOT_FOUND', message: 'No active customer with given ID' },
          { status: 404 }
        )
      )
    );
    renderComponent('00000000-0000-0000-0000-000000000000');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // --- Edit customer fields ---

  it('saves edited fields via PUT /api/customers/:id', async () => {
    let body = null;
    server.use(
      http.put('/api/customers/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...body, customerId: CUSTOMER.customerId, contacts: [] });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText(/jane smith/i);
    // TODO: open edit mode if the detail view is read-only by default.
    const firstName = screen.getByLabelText(/first name/i);
    await user.clear(firstName);
    await user.type(firstName, 'Janet');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(body).toMatchObject({ firstName: 'Janet' });
    });
  });

  // --- Add contact form: required field validation (POS-specific scenario) ---

  it('does not call POST contacts when the Value field is blank', async () => {
    let called = false;
    server.use(
      http.post('/api/customers/:id/contacts', () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText(/jane smith/i);
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    // Select Phone type, leave Value blank.
    // TODO: confirm control type for ContactType (select vs radio).
    await user.selectOptions(screen.getByLabelText(/contact type/i), 'Phone');
    await user.click(screen.getByRole('button', { name: /save|add/i }));
    expect(called).toBe(false);
  });

  it('shows a validation message on the Value field when blank', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText(/jane smith/i);
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    await user.selectOptions(screen.getByLabelText(/contact type/i), 'Phone');
    await user.click(screen.getByRole('button', { name: /save|add/i }));
    await waitFor(() => {
      expect(screen.getByText(/value is required|required/i)).toBeInTheDocument();
    });
  });

  it('adds a contact via POST /api/customers/:id/contacts on a valid submit', async () => {
    let body = null;
    server.use(
      http.post('/api/customers/:id/contacts', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json(
          { custContactId: 'new-uuid', ...body },
          { status: 201 }
        );
      })
    );
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText(/jane smith/i);
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    await user.selectOptions(screen.getByLabelText(/contact type/i), 'Phone');
    await user.type(screen.getByLabelText(/value/i), '0400 111 222');
    await user.click(screen.getByRole('button', { name: /save|add/i }));
    await waitFor(() => {
      expect(body).toMatchObject({ contactType: 'Phone', value: '0400 111 222' });
    });
  });

  // --- API response field errors in forms ---

  it('displays a server field error returned by POST contacts (400)', async () => {
    server.use(
      http.post('/api/customers/:id/contacts', () =>
        HttpResponse.json(
          {
            error: 'VALIDATION_FAILED',
            message: 'One or more fields are invalid.',
            fields: { value: 'Invalid phone number.' },
          },
          { status: 400 }
        )
      )
    );
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText(/jane smith/i);
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    await user.selectOptions(screen.getByLabelText(/contact type/i), 'Phone');
    await user.type(screen.getByLabelText(/value/i), 'xx');
    await user.click(screen.getByRole('button', { name: /save|add/i }));
    await waitFor(() => {
      expect(screen.getByText(/invalid phone number/i)).toBeInTheDocument();
    });
  });

  // --- Accessibility ---

  it('associates each form input with a label', async () => {
    const user = userEvent.setup();
    renderComponent();
    await screen.findByText(/jane smith/i);
    await user.click(screen.getByRole('button', { name: /add contact/i }));
    expect(screen.getByLabelText(/contact type/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/value/i)).toBeInTheDocument();
  });
});

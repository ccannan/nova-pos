import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';

import { handlers } from '../../mocks/handlers';
import { ITEM } from '../../mocks/fixtures';
// TODO: confirm the export name/path once the component is built.
import { ItemDetail } from './ItemDetail';

// ─── MSW server ───────────────────────────────────────────────────────────────

const server = setupServer(...handlers);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

// ─── Helpers ─────────────────────────────────────────────────────────────────

function renderDetail(id = ITEM.itemId) {
  return render(
    <MemoryRouter initialEntries={[`/items/${id}`]}>
      <Routes>
        <Route path="/items/:id" element={<ItemDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

// For create mode the route has no id.
function renderCreate() {
  return render(
    <MemoryRouter initialEntries={['/items/new']}>
      <Routes>
        <Route path="/items/new" element={<ItemDetail />} />
      </Routes>
    </MemoryRouter>
  );
}

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe('ItemDetail', () => {
  // --- Loading state ---

  it('shows a loading indicator while fetching the item', () => {
    renderDetail();
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  // --- Success state ---

  it('displays the item description and design number after fetch', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText('Diamond Solitaire Ring')).toBeInTheDocument();
    });
    expect(screen.getByText(ITEM.designNo)).toBeInTheDocument();
  });

  it('displays the item attributes', async () => {
    renderDetail();
    await waitFor(() => {
      expect(screen.getByText(/18ct Yellow Gold/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/metalType/i)).toBeInTheDocument();
  });

  it('passes the route id through to GET /api/items/:id', async () => {
    let requestedId = null;
    server.use(
      http.get('/api/items/:id', ({ params }) => {
        requestedId = params.id;
        return HttpResponse.json({ ...ITEM, attributes: [] });
      })
    );
    renderDetail(ITEM.itemId);
    await waitFor(() => {
      expect(requestedId).toBe(ITEM.itemId);
    });
  });

  // --- Error state ---

  it('shows a not-found message when the item does not exist (404)', async () => {
    server.use(
      http.get('/api/items/:id', () =>
        HttpResponse.json({ error: 'ITEM_NOT_FOUND', message: 'No item design with given ID' }, { status: 404 })
      )
    );
    renderDetail('00000000-0000-0000-0000-000000000000');
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // --- Edit / update ---

  it('saves changed fields via PUT /api/items/:id', async () => {
    let body = null;
    server.use(
      http.put('/api/items/:id', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ITEM, ...body, attributes: [] });
      })
    );
    const user = userEvent.setup();
    renderDetail();
    await screen.findByText('Diamond Solitaire Ring');
    // TODO: enter edit mode if detail view is read-only by default.
    const price = screen.getByLabelText(/retail price/i);
    await user.clear(price);
    await user.type(price, '1399');
    await user.click(screen.getByRole('button', { name: /save/i }));
    await waitFor(() => {
      expect(body).toMatchObject({ retailPrice: 1399 });
      // TODO: confirm whether the client sends retailPrice as a number or string.
    });
  });

  // --- Create / form validation ---

  it('does not call POST /api/items when description is missing', async () => {
    let called = false;
    server.use(
      http.post('/api/items', () => {
        called = true;
        return HttpResponse.json({}, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderCreate();
    // Fill everything except description, then submit.
    await user.click(screen.getByRole('button', { name: /save|create/i }));
    expect(called).toBe(false);
  });

  it('shows a validation message for the missing required field', async () => {
    const user = userEvent.setup();
    renderCreate();
    await user.click(screen.getByRole('button', { name: /save|create/i }));
    await waitFor(() => {
      expect(screen.getByText(/required/i)).toBeInTheDocument();
    });
  });

  it('creates the item via POST /api/items on a valid submit', async () => {
    let body = null;
    server.use(
      http.post('/api/items', async ({ request }) => {
        body = await request.json();
        return HttpResponse.json({ ...ITEM, ...body, attributes: [] }, { status: 201 });
      })
    );
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/design (no|number)/i), 'PAN-002');
    await user.type(screen.getByLabelText(/description/i), 'Ruby Pendant');
    // TODO: select supplier and category controls (likely dropdowns populated from lookups).
    await user.type(screen.getByLabelText(/retail price/i), '499');
    await user.click(screen.getByRole('button', { name: /save|create/i }));
    await waitFor(() => {
      expect(body).toMatchObject({ description: 'Ruby Pendant', designNo: 'PAN-002' });
    });
  });

  // --- API response field / conflict errors ---

  it('shows a conflict message when a duplicate design returns 409 DESIGN_EXISTS', async () => {
    server.use(
      http.post('/api/items', () =>
        HttpResponse.json(
          { error: 'DESIGN_EXISTS', message: 'SupplierId + DesignNo combination already exists' },
          { status: 409 }
        )
      )
    );
    const user = userEvent.setup();
    renderCreate();
    await user.type(screen.getByLabelText(/design (no|number)/i), 'PAN-001');
    await user.type(screen.getByLabelText(/description/i), 'Dupe');
    await user.type(screen.getByLabelText(/retail price/i), '499');
    await user.click(screen.getByRole('button', { name: /save|create/i }));
    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  // --- Accessibility ---

  it('associates create-form inputs with labels', () => {
    renderCreate();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/retail price/i)).toBeInTheDocument();
  });
});

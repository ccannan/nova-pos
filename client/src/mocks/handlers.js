// client/src/mocks/handlers.js
//
// Default (happy-path) MSW v2 handlers for every endpoint documented in
// docs/architecture/03-api-contracts.md. Response shapes use the fixtures
// from fixtures.js. Individual test files import these into setupServer(...)
// and override specific handlers inline with server.use(...) for error and
// edge-case scenarios.
//
// All handlers are registered against same-origin /api/* paths (the dev base
// URL is http://localhost:3001/api but tests run same-origin under jsdom).

import { http, HttpResponse } from 'msw';
import {
  STORE,
  SUPPLIER,
  CATEGORY,
  CUSTOMER,
  ITEM,
  INVENTORY_ITEM,
  SALE,
  ATTRIB_TYPE,
  ITEM_STATUS,
} from './fixtures';

// Full customer record (GET /customers/:id and POST/PUT responses).
const CUSTOMER_DETAIL = {
  customerId: CUSTOMER.customerId,
  firstName: CUSTOMER.firstName,
  lastName: CUSTOMER.lastName,
  notes: '',
  contacts: [
    {
      custContactId: 'd0c0c001-0000-0000-0000-000000000001',
      contactType: 'Phone',
      label: 'Mobile',
      value: '0412 000 000',
      isPrimary: true,
    },
    {
      custContactId: 'd0c0c001-0000-0000-0000-000000000002',
      contactType: 'Email',
      label: 'Work',
      value: 'jane@example.com',
      isPrimary: true,
    },
    {
      custContactId: 'd0c0c001-0000-0000-0000-000000000003',
      contactType: 'Address',
      label: 'Home',
      addressLine1: '12 Rose St',
      addressLine2: null,
      city: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      country: 'Australia',
      isPrimary: true,
    },
  ],
};

// Full item record (GET /items/:id and POST/PUT responses).
const ITEM_DETAIL = {
  ...ITEM,
  attributes: [
    {
      itemAttribId: 'eea77001-0000-0000-0000-000000000001',
      attribTypeId: ATTRIB_TYPE.attribTypeId,
      attribTypeName: 'metalType',
      attribTypeListId: ATTRIB_TYPE.values[0].attribTypeListId,
      attribValue: '18ct Yellow Gold',
    },
  ],
};

export const handlers = [
  // ─── Customers ──────────────────────────────────────────────────────────
  http.get('/api/customers', () =>
    HttpResponse.json({
      total: 1,
      page: 1,
      limit: 20,
      results: [CUSTOMER],
    })
  ),
  http.get('/api/customers/:id', () => HttpResponse.json(CUSTOMER_DETAIL)),
  http.post('/api/customers', () => HttpResponse.json(CUSTOMER_DETAIL, { status: 201 })),
  http.put('/api/customers/:id', () => HttpResponse.json(CUSTOMER_DETAIL)),
  http.post('/api/customers/:id/contacts', () =>
    HttpResponse.json(CUSTOMER_DETAIL.contacts[0], { status: 201 })
  ),
  http.put('/api/customers/:id/contacts/:contactId', () =>
    HttpResponse.json(CUSTOMER_DETAIL.contacts[0])
  ),
  http.delete('/api/customers/:id/contacts/:contactId', () =>
    HttpResponse.json({ deleted: true })
  ),

  // ─── Items ──────────────────────────────────────────────────────────────
  http.get('/api/items', () =>
    HttpResponse.json({
      total: 1,
      page: 1,
      limit: 20,
      results: [ITEM],
    })
  ),
  http.get('/api/items/:id', () => HttpResponse.json(ITEM_DETAIL)),
  http.post('/api/items', () => HttpResponse.json(ITEM_DETAIL, { status: 201 })),
  http.put('/api/items/:id', () => HttpResponse.json(ITEM_DETAIL)),

  // ─── Inventory ──────────────────────────────────────────────────────────
  http.get('/api/inventory', () =>
    HttpResponse.json({
      total: 1,
      page: 1,
      limit: 20,
      results: [INVENTORY_ITEM],
    })
  ),
  http.get('/api/inventory/:id', () =>
    HttpResponse.json({
      ...INVENTORY_ITEM,
      cost: 650.0,
      notes: '',
      legacyKey: null,
    })
  ),
  http.post('/api/inventory', () =>
    HttpResponse.json({ ...INVENTORY_ITEM, cost: 650.0, notes: '', legacyKey: null }, { status: 201 })
  ),
  http.put('/api/inventory/:id', () =>
    HttpResponse.json({ ...INVENTORY_ITEM, cost: 650.0, notes: '', legacyKey: null })
  ),

  // ─── Sales ──────────────────────────────────────────────────────────────
  http.post('/api/sales', () =>
    HttpResponse.json(
      {
        saleId: SALE.saleId,
        saleNumber: SALE.saleNumber,
        status: 'Active',
        grandTotal: SALE.grandTotal,
        receiptHtml: '<html><body>Receipt</body></html>',
        queued: [],
      },
      { status: 201 }
    )
  ),
  http.get('/api/sales', () =>
    HttpResponse.json({
      total: 1,
      page: 1,
      limit: 20,
      results: [
        {
          saleId: SALE.saleId,
          saleNumber: SALE.saleNumber,
          saleDate: SALE.saleDate,
          customerName: SALE.customerName,
          grandTotal: SALE.grandTotal,
          status: SALE.status,
          lineCount: SALE.lines.length,
        },
      ],
    })
  ),
  http.get('/api/sales/:id', () => HttpResponse.json(SALE)),
  http.put('/api/sales/:id/void', () =>
    HttpResponse.json({
      saleId: SALE.saleId,
      status: 'Voided',
      voidedAt: '2026-06-13T11:00:00Z',
    })
  ),

  // ─── Receipts ───────────────────────────────────────────────────────────
  http.get('/api/sales/:id/receipt', () =>
    HttpResponse.html('<html><body><h1>Tax Invoice</h1><p>Sale #42</p></body></html>')
  ),

  // ─── Reports ────────────────────────────────────────────────────────────
  // Default detail level per contract is per-sale.
  http.get('/api/reports/sales', ({ request }) => {
    const url = new URL(request.url);
    const detail = url.searchParams.get('detail') || 'per-sale';
    const format = url.searchParams.get('format') || 'json';

    if (format === 'csv') {
      return new HttpResponse('saleNumber,grandTotal\n42,1299.00\n', {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': 'attachment; filename="sales-report.csv"',
        },
      });
    }

    if (detail === 'summary') {
      return HttpResponse.json({
        from: '2026-06-01',
        to: '2026-06-13',
        saleCount: 42,
        itemCount: 58,
        subTotal: 45200.0,
        discountTotal: 1200.0,
        grandTotal: 44000.0,
      });
    }

    const saleRow = {
      saleNumber: 42,
      saleDate: '2026-06-13',
      customerName: 'Jane Smith',
      lineCount: 2,
      grandTotal: 1299.0,
      status: 'Active',
    };

    if (detail === 'full') {
      return HttpResponse.json({
        from: '2026-06-01',
        to: '2026-06-13',
        totals: { saleCount: 42, itemCount: 58, grandTotal: 44000.0 },
        sales: [{ ...saleRow, lines: SALE.lines }],
      });
    }

    // per-sale
    return HttpResponse.json({
      from: '2026-06-01',
      to: '2026-06-13',
      totals: { saleCount: 42, itemCount: 58, grandTotal: 44000.0 },
      sales: [saleRow],
    });
  }),

  // ─── Lookups: Stores ────────────────────────────────────────────────────
  http.get('/api/stores', () =>
    HttpResponse.json({
      results: [
        {
          storeId: STORE.storeId,
          storeName: STORE.storeName,
          phone: '03 9000 0000',
          email: 'city@example.com',
          isActive: true,
        },
      ],
    })
  ),
  http.get('/api/stores/:id', () =>
    HttpResponse.json({
      storeId: STORE.storeId,
      storeName: STORE.storeName,
      addressLine1: '1 Collins St',
      addressLine2: null,
      city: 'Melbourne',
      state: 'VIC',
      postcode: '3000',
      phone: '03 9000 0000',
      email: 'city@example.com',
      isActive: true,
    })
  ),
  http.post('/api/stores', () => HttpResponse.json({ storeId: STORE.storeId, storeName: STORE.storeName }, { status: 201 })),
  http.put('/api/stores/:id', () => HttpResponse.json({ storeId: STORE.storeId, storeName: STORE.storeName })),

  // ─── Lookups: Suppliers ─────────────────────────────────────────────────
  http.get('/api/suppliers', () =>
    HttpResponse.json({
      total: 1,
      page: 1,
      limit: 20,
      results: [
        {
          supplierId: SUPPLIER.supplierId,
          supplierName: SUPPLIER.supplierName,
          email: 'orders@pandora.com',
          phone: '1800 000 000',
          mainContact: 'Jane Rep',
          isActive: true,
        },
      ],
    })
  ),
  http.get('/api/suppliers/:id', () =>
    HttpResponse.json({
      supplierId: SUPPLIER.supplierId,
      supplierName: SUPPLIER.supplierName,
      email: 'orders@pandora.com',
      phone: '1800 000 000',
      mainContact: 'Jane Rep',
      isActive: true,
    })
  ),
  http.post('/api/suppliers', () =>
    HttpResponse.json({ supplierId: SUPPLIER.supplierId, supplierName: SUPPLIER.supplierName }, { status: 201 })
  ),
  http.put('/api/suppliers/:id', () =>
    HttpResponse.json({ supplierId: SUPPLIER.supplierId, supplierName: SUPPLIER.supplierName })
  ),

  // ─── Lookups: Categories ────────────────────────────────────────────────
  http.get('/api/categories', () =>
    HttpResponse.json({
      results: [
        {
          categoryId: CATEGORY.categoryId,
          categoryName: CATEGORY.categoryName,
          description: '',
          isActive: true,
          sortOrder: 1,
        },
      ],
    })
  ),
  http.get('/api/categories/:id', () =>
    HttpResponse.json({
      categoryId: CATEGORY.categoryId,
      categoryName: CATEGORY.categoryName,
      description: '',
      isActive: true,
      sortOrder: 1,
    })
  ),
  http.post('/api/categories', () =>
    HttpResponse.json({ categoryId: CATEGORY.categoryId, categoryName: CATEGORY.categoryName }, { status: 201 })
  ),
  http.put('/api/categories/:id', () =>
    HttpResponse.json({ categoryId: CATEGORY.categoryId, categoryName: CATEGORY.categoryName })
  ),

  // ─── Lookups: Attribute Types ───────────────────────────────────────────
  http.get('/api/attrib-types', () =>
    HttpResponse.json({
      results: [
        {
          attribTypeId: ATTRIB_TYPE.attribTypeId,
          attribTypeName: ATTRIB_TYPE.attribTypeName,
          description: ATTRIB_TYPE.description,
          isActive: true,
          sortOrder: 1,
        },
      ],
    })
  ),
  http.get('/api/attrib-types/:id', () => HttpResponse.json(ATTRIB_TYPE)),
  http.post('/api/attrib-types', () =>
    HttpResponse.json({ ...ATTRIB_TYPE, values: [] }, { status: 201 })
  ),
  http.put('/api/attrib-types/:id', () => HttpResponse.json(ATTRIB_TYPE)),
  http.post('/api/attrib-types/:id/values', () =>
    HttpResponse.json(
      {
        attribTypeListId: ATTRIB_TYPE.values[0].attribTypeListId,
        attribTypeId: ATTRIB_TYPE.attribTypeId,
        value: '18ct Yellow Gold',
        isActive: true,
        sortOrder: 1,
      },
      { status: 201 }
    )
  ),
  http.put('/api/attrib-types/:id/values/:valueId', () =>
    HttpResponse.json(ATTRIB_TYPE.values[0])
  ),

  // ─── Lookups: Item Status ───────────────────────────────────────────────
  http.get('/api/item-status', () =>
    HttpResponse.json({ results: [ITEM_STATUS] })
  ),
  http.get('/api/item-status/:id', () => HttpResponse.json(ITEM_STATUS)),
  http.post('/api/item-status', () => HttpResponse.json(ITEM_STATUS, { status: 201 })),
  http.put('/api/item-status/:id', () => HttpResponse.json(ITEM_STATUS)),
];

export default handlers;

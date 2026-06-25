const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { seedSale, clearAll } = require('../helpers/seeds');
const { DEFAULT_STORE_ID } = require('../helpers/constants');

describe('Receipts — GET /api/sales/:id/receipt', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── Happy path ──────────────────────────────────────────────────────────────────

  describe('retrieving a stored receipt', () => {
    it('returns 200 with Content-Type text/html when ReceiptContent exists', async () => {
      const sale = await seedSale({
        StoreId: DEFAULT_STORE_ID,
        ReceiptContent: '<html><body>Receipt #1</body></html>',
      });
      const res = await request(app).get(`/api/sales/${sale.SaleId}/receipt`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/html/);
    });

    it('returns the raw stored HTML content in the body', async () => {
      const html = '<html><body>Receipt ABC</body></html>';
      const sale = await seedSale({ StoreId: DEFAULT_STORE_ID, ReceiptContent: html });
      const res = await request(app).get(`/api/sales/${sale.SaleId}/receipt`);
      expect(res.text).toContain('Receipt ABC');
    });
  });

  // ─── Not found ───────────────────────────────────────────────────────────────────

  describe('errors', () => {
    it('returns 404 SALE_NOT_FOUND when the sale does not exist', async () => {
      const res = await request(app)
        .get('/api/sales/00000000-0000-0000-0000-0000000000ff/receipt');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('SALE_NOT_FOUND');
    });

    it('returns 404 RECEIPT_NOT_GENERATED when the sale exists but ReceiptContent is null', async () => {
      const sale = await seedSale({ StoreId: DEFAULT_STORE_ID, ReceiptContent: null });
      const res = await request(app).get(`/api/sales/${sale.SaleId}/receipt`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('RECEIPT_NOT_GENERATED');
    });
  });

  // ─── Receipt template (pure function) ───────────────────────────────────────────
  // Per 04-dependency-order.md the template is a pure function in
  // server/src/printing/receipt.template.js: generateReceipt(saleData) -> html.

  describe('receipt template — generateReceipt(saleData)', () => {
    const { generateReceipt } = require('../../src/printing/receipt.template');

    it('returns an HTML string for a complete sale object', () => {
      const html = generateReceipt({
        saleNumber: 42,
        saleDate: '2026-06-13T10:30:00Z',
        storeName: 'City Store',
        customerName: 'Jane Smith',
        subTotal: 1299.0,
        discountTotal: 0.0,
        grandTotal: 1299.0,
        lines: [{ lineNumber: 1, description: 'Diamond Solitaire Ring', unitPrice: 1299.0, discount: 0, lineTotal: 1299.0 }],
        tender: [{ tenderMethod: 'Cash', amount: 1299.0 }],
      });
      expect(typeof html).toBe('string');
      expect(html).toMatch(/<html/i);
    });

    it('includes the sale number and grand total in the rendered HTML', () => {
      const html = generateReceipt({
        saleNumber: 42, grandTotal: 1299.0, lines: [], tender: [],
      });
      expect(html).toContain('42');
      expect(html).toContain('1299');
    });

    it('renders one row per sale line', () => {
      // TODO: implement
    });

    it('renders a walk-in receipt with no customer name', () => {
      // TODO: implement — customerName null/omitted should not throw
    });
  });
});

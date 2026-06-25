const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const {
  seedItem, seedInventoryItem, seedSale, seedSaleLine, clearAll,
} = require('../helpers/seeds');
const { DEFAULT_STORE_ID } = require('../helpers/constants');

// Seed a complete Active sale within a given date for report aggregation.
async function seedReportSale({ saleDate, grandTotal = 1299.0, status = 'Active', storeId = DEFAULT_STORE_ID } = {}) {
  const item = await seedItem();
  const inv = await seedInventoryItem({ ItemId: item.ItemId, StoreId: storeId });
  const sale = await seedSale({
    StoreId: storeId,
    SaleDate: saleDate ? new Date(saleDate) : new Date(),
    SubTotal: grandTotal,
    GrandTotal: grandTotal,
    Status: status,
  });
  await seedSaleLine({ SaleId: sale.SaleId, InventoryItemId: inv.InventoryItemId, LineTotal: grandTotal });
  return sale;
}

describe('Reports — GET /api/reports/sales', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── Validation ────────────────────────────────────────────────────────────────

  describe('validation', () => {
    it('returns 400 VALIDATION_FAILED when from is missing', async () => {
      const res = await request(app).get('/api/reports/sales?to=2026-06-13');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('from');
    });

    it('returns 400 VALIDATION_FAILED when to is missing', async () => {
      const res = await request(app).get('/api/reports/sales?from=2026-06-01');
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('to');
    });

    it('returns 400 for an invalid detail enum value', async () => {
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&detail=bogus');
      expect(res.status).toBe(400);
    });
  });

  // ─── Summary detail ──────────────────────────────────────────────────────────────

  describe('detail=summary', () => {
    it('returns 200 with aggregate totals only', async () => {
      await seedReportSale({ saleDate: '2026-06-05', grandTotal: 100 });
      await seedReportSale({ saleDate: '2026-06-06', grandTotal: 200 });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&detail=summary');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        from: '2026-06-01',
        to: '2026-06-13',
        saleCount: 2,
        itemCount: expect.any(Number),
        subTotal: expect.any(Number),
        discountTotal: expect.any(Number),
        grandTotal: 300,
      });
    });

    it('excludes sales outside the date range from totals', async () => {
      await seedReportSale({ saleDate: '2026-06-05', grandTotal: 100 });
      await seedReportSale({ saleDate: '2026-05-01', grandTotal: 999 });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&detail=summary');
      expect(res.body.grandTotal).toBe(100);
    });

    it('excludes Voided sales from the totals', async () => {
      await seedReportSale({ saleDate: '2026-06-05', grandTotal: 100, status: 'Active' });
      await seedReportSale({ saleDate: '2026-06-06', grandTotal: 500, status: 'Voided' });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&detail=summary');
      expect(res.body.grandTotal).toBe(100);
    });

    it('filters by storeId when provided', async () => {
      // TODO: implement
    });
  });

  // ─── Per-sale detail (default) ───────────────────────────────────────────────────

  describe('detail=per-sale (default)', () => {
    it('returns 200 with a totals object and a sales array', async () => {
      await seedReportSale({ saleDate: '2026-06-05' });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        totals: expect.objectContaining({ saleCount: expect.any(Number), grandTotal: expect.any(Number) }),
        sales: expect.arrayContaining([
          expect.objectContaining({
            saleNumber: expect.any(Number),
            lineCount: expect.any(Number),
            grandTotal: expect.any(Number),
            status: expect.any(String),
          }),
        ]),
      });
    });

    it('defaults to per-sale detail when detail param is omitted', async () => {
      await seedReportSale({ saleDate: '2026-06-05' });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13');
      expect(res.body).toHaveProperty('sales');
    });
  });

  // ─── Full detail ───────────────────────────────────────────────────────────────

  describe('detail=full', () => {
    it('returns 200 with a lines array on each sale', async () => {
      await seedReportSale({ saleDate: '2026-06-05' });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&detail=full');
      expect(res.status).toBe(200);
      expect(res.body.sales[0]).toHaveProperty('lines');
      expect(Array.isArray(res.body.sales[0].lines)).toBe(true);
    });
  });

  // ─── CSV export ──────────────────────────────────────────────────────────────────

  describe('format=csv', () => {
    it('returns 200 with Content-Type text/csv', async () => {
      await seedReportSale({ saleDate: '2026-06-05' });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&format=csv');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toMatch(/text\/csv/);
    });

    it('sets a Content-Disposition attachment header', async () => {
      await seedReportSale({ saleDate: '2026-06-05' });
      const res = await request(app)
        .get('/api/reports/sales?from=2026-06-01&to=2026-06-13&format=csv');
      expect(res.headers['content-disposition']).toMatch(/attachment/);
    });

    it('returns CSV rows matching the queried sales', async () => {
      // TODO: implement — assert header row + one data row per sale
    });
  });
});

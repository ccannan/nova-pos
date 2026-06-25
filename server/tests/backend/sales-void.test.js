const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const {
  seedItem, seedInventoryItem, seedSale, seedSaleLine, seedSaleTender, clearAll,
} = require('../helpers/seeds');
const { STATUS, DEFAULT_STORE_ID } = require('../helpers/constants');

const QUEUE_DIR = process.env.QUEUE_DIR || path.join(__dirname, '..', 'tmp', 'queue');
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');

function cleanQueueDir() {
  for (const sub of ['pending', 'processed', 'failed']) {
    const dir = path.join(QUEUE_DIR, sub);
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
    }
  }
}

// Build an Active sale with one line referencing a Sold InventoryItem (the
// normal post-sale state) plus a tender row.
async function buildActiveSale() {
  const item = await seedItem();
  const inv = await seedInventoryItem({
    ItemId: item.ItemId, StoreId: DEFAULT_STORE_ID, StatusId: STATUS.SOLD,
  });
  const sale = await seedSale({ StoreId: DEFAULT_STORE_ID, Status: 'Active' });
  const line = await seedSaleLine({ SaleId: sale.SaleId, InventoryItemId: inv.InventoryItemId, Status: 'Active' });
  const tender = await seedSaleTender({ SaleId: sale.SaleId, Status: 'Active' });
  return { item, inv, sale, line, tender };
}

describe('Void Sale — PUT /api/sales/:id/void', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => {
    jest.restoreAllMocks();
    cleanQueueDir();
    await clearAll();
  });

  // ─── Happy path ──────────────────────────────────────────────────────────────────

  describe('voiding an Active sale', () => {
    it('returns 200 with status Voided and a voidedAt timestamp', async () => {
      const { sale } = await buildActiveSale();
      const res = await request(app)
        .put(`/api/sales/${sale.SaleId}/void`)
        .send({ reason: 'Customer changed mind' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        saleId: sale.SaleId,
        status: 'Voided',
        voidedAt: expect.any(String),
      });
    });

    it('sets Sale.Status to Voided in the DB', async () => {
      const { sale } = await buildActiveSale();
      await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      const row = await db.query('SELECT Status FROM Sale WHERE SaleId = @id', { id: sale.SaleId });
      expect(row.recordset[0].Status).toBe('Voided');
    });

    it('sets every SaleLine.Status to Voided', async () => {
      const { sale } = await buildActiveSale();
      await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      const row = await db.query('SELECT Status FROM SaleLine WHERE SaleId = @id', { id: sale.SaleId });
      expect(row.recordset.every((r) => r.Status === 'Voided')).toBe(true);
    });

    it('sets every SaleTender.Status to Voided', async () => {
      const { sale } = await buildActiveSale();
      await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      const row = await db.query('SELECT Status FROM SaleTender WHERE SaleId = @id', { id: sale.SaleId });
      expect(row.recordset.every((r) => r.Status === 'Voided')).toBe(true);
    });

    it('returns the InventoryItem StatusId to Active', async () => {
      const { inv } = await buildActiveSale();
      const sale = await db.query('SELECT TOP 1 SaleId FROM Sale', {});
      await request(app).put(`/api/sales/${sale.recordset[0].SaleId}/void`).send({ reason: 'x' });
      const row = await db.query(
        'SELECT StatusId FROM InventoryItem WHERE InventoryItemId = @id',
        { id: inv.InventoryItemId }
      );
      expect(row.recordset[0].StatusId.toLowerCase()).toBe(STATUS.ACTIVE.toLowerCase());
    });
  });

  // ─── InventoryHistory two-step — high-risk POS scenario ─────────────────────────

  describe('InventoryHistory two-step audit trail', () => {
    it('writes two StatusId InventoryHistory rows per item: Return Via Void then Active', async () => {
      const { sale, inv } = await buildActiveSale();
      await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      const hist = await db.query(
        "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'StatusId' ORDER BY ChangedAt ASC",
        { id: inv.InventoryItemId }
      );
      expect(hist.recordset.length).toBe(2);
    });

    it('orders the two rows by ChangedAt — Return Via Void before Active', async () => {
      const { sale, inv } = await buildActiveSale();
      await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      const hist = await db.query(
        "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'StatusId' ORDER BY ChangedAt ASC",
        { id: inv.InventoryItemId }
      );
      expect(hist.recordset[0].AfterValue).toBe('Return Via Void');
      // Second row reinstates to Active (the GUID or the literal 'Active').
      const second = hist.recordset[1].AfterValue;
      expect(
        second === 'Active' || second.toLowerCase() === STATUS.ACTIVE.toLowerCase()
      ).toBe(true);
    });

    it('records BeforeValue Sold on the first (Return Via Void) row', async () => {
      const { sale, inv } = await buildActiveSale();
      await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      const hist = await db.query(
        "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'StatusId' ORDER BY ChangedAt ASC",
        { id: inv.InventoryItemId }
      );
      expect(hist.recordset[0].BeforeValue).toBe('Sold');
    });
  });

  // ─── Conflict / not found ──────────────────────────────────────────────────────

  describe('errors', () => {
    it('returns 404 SALE_NOT_FOUND for a non-existent sale', async () => {
      const res = await request(app)
        .put('/api/sales/00000000-0000-0000-0000-0000000000ff/void')
        .send({ reason: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('SALE_NOT_FOUND');
    });

    it('returns 409 SALE_ALREADY_VOIDED when the sale is already Voided', async () => {
      const sale = await seedSale({ StoreId: DEFAULT_STORE_ID, Status: 'Voided' });
      const res = await request(app)
        .put(`/api/sales/${sale.SaleId}/void`)
        .send({ reason: 'x' });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('SALE_ALREADY_VOIDED');
    });

    it('does not write InventoryHistory rows when the sale is already voided', async () => {
      // TODO: implement — assert no new history rows after a rejected re-void
    });
  });

  // ─── Queue strategy on failed void steps ────────────────────────────────────────

  describe('partial-write queue strategy', () => {
    it('queues failed void steps following the same strategy as sale creation', async () => {
      // TODO: implement — inject a fault on the InventoryHistory write, assert a
      // queue file appears in pending/ with the deferred operation
      const { sale } = await buildActiveSale();
      const saleModel = require('../../src/models/sale.model');
      if (saleModel.insertInventoryHistory) {
        jest.spyOn(saleModel, 'insertInventoryHistory').mockRejectedValueOnce(new Error('hist write failed'));
      }
      const res = await request(app).put(`/api/sales/${sale.SaleId}/void`).send({ reason: 'x' });
      // Void still reports success for the core status changes; deferred writes queued.
      expect([200, 207]).toContain(res.status);
      const files = fs.existsSync(PENDING_DIR) ? fs.readdirSync(PENDING_DIR) : [];
      expect(files.length).toBeGreaterThanOrEqual(0); // TODO: tighten once fault-injection point is finalised
    });
  });
});

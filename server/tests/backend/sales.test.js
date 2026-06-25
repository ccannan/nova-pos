const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const {
  seedStore, seedCustomer, seedItem, seedInventoryItem, clearAll,
} = require('../helpers/seeds');
const { STATUS, DEFAULT_STORE_ID } = require('../helpers/constants');

const QUEUE_DIR = process.env.QUEUE_DIR || path.join(__dirname, '..', 'tmp', 'queue');
const PENDING_DIR = path.join(QUEUE_DIR, 'pending');

// Build a minimal valid sale payload for a freshly-seeded Active InventoryItem.
async function buildValidSale(overrides = {}) {
  const item = await seedItem({ RetailPrice: 1299.0 });
  const inv = await seedInventoryItem({
    ItemId: item.ItemId,
    StoreId: DEFAULT_STORE_ID,
    StatusId: STATUS.ACTIVE,
  });
  return {
    inv,
    payload: {
      storeId: DEFAULT_STORE_ID,
      customerId: null,
      memo: '',
      lines: [{ inventoryItemId: inv.InventoryItemId, unitPrice: 1299.0, discount: 0.0 }],
      tender: [{ tenderMethod: 'Cash', amount: 1299.0, reference: null }],
      ...overrides,
    },
  };
}

function cleanQueueDir() {
  for (const sub of ['pending', 'processed', 'failed']) {
    const dir = path.join(QUEUE_DIR, sub);
    if (fs.existsSync(dir)) {
      for (const f of fs.readdirSync(dir)) fs.rmSync(path.join(dir, f), { force: true });
    }
  }
}

describe('Sales — /api/sales', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => {
    jest.restoreAllMocks();
    cleanQueueDir();
    await clearAll();
  });

  // ─── POST /api/sales — happy path (201) ─────────────────────────────────────────

  describe('POST /api/sales — 201 all writes succeed', () => {
    it('returns 201 with queued: [] when every write succeeds', async () => {
      const { payload } = await buildValidSale();
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        saleId: expect.any(String),
        saleNumber: expect.any(Number),
        status: 'Active',
        grandTotal: 1299.0,
        receiptHtml: expect.any(String),
        queued: [],
      });
    });

    it('writes the Sale row to the DB', async () => {
      const { payload } = await buildValidSale();
      const res = await request(app).post('/api/sales').send(payload);
      const row = await db.query('SELECT * FROM Sale WHERE SaleId = @id', { id: res.body.saleId });
      expect(row.recordset.length).toBe(1);
    });

    it('writes one SaleLine row per line', async () => {
      const { payload } = await buildValidSale();
      const res = await request(app).post('/api/sales').send(payload);
      const row = await db.query('SELECT * FROM SaleLine WHERE SaleId = @id', { id: res.body.saleId });
      expect(row.recordset.length).toBe(1);
    });

    it('writes the SaleTender row', async () => {
      const { payload } = await buildValidSale();
      const res = await request(app).post('/api/sales').send(payload);
      const row = await db.query('SELECT * FROM SaleTender WHERE SaleId = @id', { id: res.body.saleId });
      expect(row.recordset.length).toBe(1);
    });

    it('updates the sold InventoryItem StatusId to Sold', async () => {
      const { inv, payload } = await buildValidSale();
      await request(app).post('/api/sales').send(payload);
      const row = await db.query(
        'SELECT StatusId FROM InventoryItem WHERE InventoryItemId = @id',
        { id: inv.InventoryItemId }
      );
      expect(row.recordset[0].StatusId.toLowerCase()).toBe(STATUS.SOLD.toLowerCase());
    });

    it('writes an InventoryHistory StatusId row for the sold item', async () => {
      const { inv, payload } = await buildValidSale();
      await request(app).post('/api/sales').send(payload);
      const hist = await db.query(
        "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'StatusId'",
        { id: inv.InventoryItemId }
      );
      expect(hist.recordset.length).toBeGreaterThan(0);
    });

    it('snapshots CustomerName on the Sale when a customer is provided', async () => {
      // TODO: implement — seed customer, send customerId, assert Sale.CustomerName populated
    });

    it('does NOT write a queue file when all writes succeed', async () => {
      const { payload } = await buildValidSale();
      await request(app).post('/api/sales').send(payload);
      const files = fs.existsSync(PENDING_DIR) ? fs.readdirSync(PENDING_DIR) : [];
      expect(files).toHaveLength(0);
    });
  });

  // ─── POST /api/sales — partial write (207) ──────────────────────────────────────

  describe('POST /api/sales — 207 partial write (SaleTender fails)', () => {
    it('returns 207 with SaleTender listed in queued', async () => {
      const { payload } = await buildValidSale();
      // Inject a one-time fault into the SaleTender insert at the model layer.
      const saleModel = require('../../src/models/sale.model');
      jest.spyOn(saleModel, 'insertSaleTender').mockRejectedValueOnce(new Error('tender write failed'));
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(207);
      expect(res.body.queued).toContain('SaleTender');
    });

    it('still persists the Sale and SaleLine rows', async () => {
      const { payload } = await buildValidSale();
      const saleModel = require('../../src/models/sale.model');
      jest.spyOn(saleModel, 'insertSaleTender').mockRejectedValueOnce(new Error('tender write failed'));
      const res = await request(app).post('/api/sales').send(payload);
      const sale = await db.query('SELECT * FROM Sale WHERE SaleId = @id', { id: res.body.saleId });
      const line = await db.query('SELECT * FROM SaleLine WHERE SaleId = @id', { id: res.body.saleId });
      expect(sale.recordset.length).toBe(1);
      expect(line.recordset.length).toBe(1);
    });

    it('writes a queue file containing the deferred SaleTender operation', async () => {
      const { payload } = await buildValidSale();
      const saleModel = require('../../src/models/sale.model');
      jest.spyOn(saleModel, 'insertSaleTender').mockRejectedValueOnce(new Error('tender write failed'));
      await request(app).post('/api/sales').send(payload);
      const files = fs.readdirSync(PENDING_DIR);
      expect(files.length).toBe(1);
      const parsed = JSON.parse(fs.readFileSync(path.join(PENDING_DIR, files[0]), 'utf8'));
      expect(parsed).toMatchObject({
        queueId: expect.any(String),
        createdAt: expect.any(String),
        retryCount: 0,
        operations: expect.arrayContaining([
          expect.objectContaining({ table: 'SaleTender', operation: 'INSERT', data: expect.any(Object) }),
        ]),
      });
    });
  });

  // ─── POST /api/sales — full queue (202) ─────────────────────────────────────────

  describe('POST /api/sales — 202 total DB unavailability', () => {
    it('returns 202 with queued: true and a queueRef when the Sale insert fails', async () => {
      const { payload } = await buildValidSale();
      const saleModel = require('../../src/models/sale.model');
      jest.spyOn(saleModel, 'insertSale').mockRejectedValueOnce(new Error('DB unavailable'));
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(202);
      expect(res.body).toMatchObject({
        queued: true,
        queueRef: expect.any(String),
        message: expect.any(String),
      });
    });

    it('writes the complete sale payload to a single queue file and no Sale row', async () => {
      const { payload } = await buildValidSale();
      const saleModel = require('../../src/models/sale.model');
      jest.spyOn(saleModel, 'insertSale').mockRejectedValueOnce(new Error('DB unavailable'));
      const res = await request(app).post('/api/sales').send(payload);
      const file = path.join(PENDING_DIR, res.body.queueRef);
      expect(fs.existsSync(file)).toBe(true);
      const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(parsed.operations.length).toBeGreaterThan(0);
      // No partial DB state.
      const sale = await db.query('SELECT * FROM Sale', {});
      expect(sale.recordset.length).toBe(0);
    });
  });

  // ─── POST /api/sales — validation (400) ─────────────────────────────────────────

  describe('POST /api/sales — validation', () => {
    it('returns 400 VALIDATION_FAILED when lines is empty', async () => {
      const res = await request(app).post('/api/sales').send({
        storeId: DEFAULT_STORE_ID,
        lines: [],
        tender: [{ tenderMethod: 'Cash', amount: 0 }],
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('lines');
    });

    it('returns 400 VALIDATION_FAILED when tender is empty', async () => {
      const { payload } = await buildValidSale();
      payload.tender = [];
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('tender');
    });

    it('returns 400 when tender sum does not equal grandTotal', async () => {
      const { payload } = await buildValidSale();
      payload.tender = [{ tenderMethod: 'Cash', amount: 1.0, reference: null }];
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
    });

    it('returns 400 for an unknown tenderMethod', async () => {
      const { payload } = await buildValidSale();
      payload.tender = [{ tenderMethod: 'Bitcoin', amount: 1299.0, reference: null }];
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(400);
    });

    it('returns 400 when storeId is missing', async () => {
      const { payload } = await buildValidSale();
      delete payload.storeId;
      const res = await request(app).post('/api/sales').send(payload);
      expect(res.status).toBe(400);
      expect(res.body.fields).toHaveProperty('storeId');
    });

    it('returns 404/400 when storeId does not exist or is inactive', async () => {
      // TODO: implement — confirm whether store validation returns 404 STORE_NOT_FOUND or 400
    });

    it('returns 400/404 when a provided customerId is soft-deleted', async () => {
      // TODO: implement
    });

    it('writes no DB rows when validation fails', async () => {
      const res = await request(app).post('/api/sales').send({ storeId: DEFAULT_STORE_ID, lines: [], tender: [] });
      expect(res.status).toBe(400);
      const sale = await db.query('SELECT * FROM Sale', {});
      expect(sale.recordset.length).toBe(0);
    });
  });

  // ─── POST /api/sales — conflict (409) ───────────────────────────────────────────

  describe('POST /api/sales — 409 InventoryItem not Active', () => {
    it('returns 409 INVENTORY_ITEM_NOT_ACTIVE with conflictingIds when an item is Sold', async () => {
      const item = await seedItem();
      const inv = await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.SOLD });
      const res = await request(app).post('/api/sales').send({
        storeId: DEFAULT_STORE_ID,
        lines: [{ inventoryItemId: inv.InventoryItemId, unitPrice: 1299.0, discount: 0 }],
        tender: [{ tenderMethod: 'Cash', amount: 1299.0, reference: null }],
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('INVENTORY_ITEM_NOT_ACTIVE');
      expect(res.body.conflictingIds).toContain(inv.InventoryItemId);
    });

    it('writes no Sale row when an item is not Active', async () => {
      const item = await seedItem();
      const inv = await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.SOLD });
      await request(app).post('/api/sales').send({
        storeId: DEFAULT_STORE_ID,
        lines: [{ inventoryItemId: inv.InventoryItemId, unitPrice: 1299.0, discount: 0 }],
        tender: [{ tenderMethod: 'Cash', amount: 1299.0, reference: null }],
      });
      const sale = await db.query('SELECT * FROM Sale', {});
      expect(sale.recordset.length).toBe(0);
    });

    it('returns 409 when the InventoryItem belongs to a different store', async () => {
      // TODO: implement — item belongs to store A, sale posted for store B
    });
  });

  // ─── Concurrency — high-risk POS scenarios (run with --runInBand) ───────────────

  describe('POST /api/sales — concurrency', () => {
    it('sells an InventoryItem exactly once under two concurrent requests', async () => {
      // Race condition: two concurrent sales for the same InventoryItemId.
      // Exactly one must get 201, the other 409 INVENTORY_ITEM_NOT_ACTIVE.
      const { payload } = await buildValidSale();
      const [a, b] = await Promise.all([
        request(app).post('/api/sales').send(payload),
        request(app).post('/api/sales').send(payload),
      ]);
      const statuses = [a.status, b.status].sort();
      expect(statuses).toEqual([201, 409]);
      const loser = a.status === 409 ? a : b;
      expect(loser.body.error).toBe('INVENTORY_ITEM_NOT_ACTIVE');
    });

    it('assigns distinct SaleNumbers to two concurrent sales for the same store', async () => {
      // SaleNumber must be unique per store under concurrent load.
      const a = await buildValidSale();
      const b = await buildValidSale();
      const [r1, r2] = await Promise.all([
        request(app).post('/api/sales').send(a.payload),
        request(app).post('/api/sales').send(b.payload),
      ]);
      expect(r1.status).toBe(201);
      expect(r2.status).toBe(201);
      expect(r1.body.saleNumber).not.toBe(r2.body.saleNumber);
    });
  });

  // ─── GET /api/sales ──────────────────────────────────────────────────────────────

  describe('GET /api/sales', () => {
    it('returns 200 and a paginated list with lineCount', async () => {
      const { payload } = await buildValidSale();
      await request(app).post('/api/sales').send(payload);
      const res = await request(app).get('/api/sales');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            saleId: expect.any(String),
            saleNumber: expect.any(Number),
            lineCount: expect.any(Number),
          }),
        ]),
      });
    });

    it('filters by from/to date range', async () => {
      // TODO: implement
    });

    it('filters by customerId', async () => {
      // TODO: implement
    });

    it('filters by status', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/sales/:id ────────────────────────────────────────────────────────

  describe('GET /api/sales/:id', () => {
    it('returns 200 with full detail including lines and tender arrays', async () => {
      const { payload } = await buildValidSale();
      const created = await request(app).post('/api/sales').send(payload);
      const res = await request(app).get(`/api/sales/${created.body.saleId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        saleId: created.body.saleId,
        lines: expect.arrayContaining([expect.objectContaining({ saleLineId: expect.any(String) })]),
        tender: expect.arrayContaining([expect.objectContaining({ saleTenderId: expect.any(String) })]),
      });
    });

    it('returns 404 SALE_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/sales/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('SALE_NOT_FOUND');
    });
  });
});

const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const {
  seedStore, seedItem, seedInventoryItem, clearAll,
} = require('../helpers/seeds');
const { STATUS, DEFAULT_STORE_ID } = require('../helpers/constants');

describe('Inventory — /api/inventory', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/inventory ────────────────────────────────────────────────────────

  describe('GET /api/inventory', () => {
    it('returns 200 and a paginated list with effectiveRetailPrice', async () => {
      const item = await seedItem({ RetailPrice: 1299.0 });
      await seedInventoryItem({ ItemId: item.ItemId });
      const res = await request(app).get('/api/inventory');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            inventoryItemId: expect.any(String),
            effectiveRetailPrice: expect.any(Number),
            statusName: expect.any(String),
            acquisitionDate: expect.any(String),
          }),
        ]),
      });
    });

    // ── FIFO ordering — high-risk POS scenario ──
    it('orders results by AcquisitionDate ASC (FIFO)', async () => {
      const item = await seedItem();
      await seedInventoryItem({ ItemId: item.ItemId, AcquisitionDate: new Date('2026-01-01T00:00:00Z') });
      await seedInventoryItem({ ItemId: item.ItemId, AcquisitionDate: new Date('2026-03-01T00:00:00Z') });
      await seedInventoryItem({ ItemId: item.ItemId, AcquisitionDate: new Date('2026-02-01T00:00:00Z') });
      const res = await request(app).get(`/api/inventory?itemId=${item.ItemId}`);
      const dates = res.body.results.map((r) => r.acquisitionDate.slice(0, 10));
      expect(dates).toEqual(['2026-01-01', '2026-02-01', '2026-03-01']);
    });

    it('defaults the status filter to Active', async () => {
      const item = await seedItem();
      await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.ACTIVE });
      await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.SOLD });
      const res = await request(app).get(`/api/inventory?itemId=${item.ItemId}`);
      const statuses = res.body.results.map((r) => r.statusName);
      expect(statuses).not.toContain('Sold');
    });

    it('filters by inventoryItemId for an exact barcode-scan match', async () => {
      const inv = await seedInventoryItem();
      const res = await request(app).get(`/api/inventory?inventoryItemId=${inv.InventoryItemId}`);
      expect(res.body.results).toHaveLength(1);
      expect(res.body.results[0].inventoryItemId).toBe(inv.InventoryItemId);
    });

    it('filters by designNo', async () => {
      // TODO: implement
    });

    it('filters by categoryId', async () => {
      // TODO: implement
    });

    it('filters by storeId', async () => {
      // TODO: implement
    });

    it('partial-matches on description', async () => {
      // TODO: implement
    });

    it('excludes soft-deleted (IsDeleted=1) inventory items from Active results', async () => {
      const item = await seedItem();
      const deleted = await seedInventoryItem({
        ItemId: item.ItemId, StatusId: STATUS.WRITTEN_OFF, IsDeleted: 1,
      });
      const res = await request(app).get('/api/inventory?status=Active');
      const ids = res.body.results.map((r) => r.inventoryItemId);
      expect(ids).not.toContain(deleted.InventoryItemId);
    });

    it('reflects total matching count, not page size, in total', async () => {
      // TODO: implement
    });

    it('applies page and limit params to produce correct offsets', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/inventory/:id ────────────────────────────────────────────────────

  describe('GET /api/inventory/:id', () => {
    it('returns 200 with cost, notes, legacyKey in addition to search shape', async () => {
      const inv = await seedInventoryItem();
      const res = await request(app).get(`/api/inventory/${inv.InventoryItemId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        inventoryItemId: inv.InventoryItemId,
        cost: expect.anything(),
        notes: expect.anything(),
        legacyKey: expect.anything(),
      });
    });

    // ── effectiveRetailPrice COALESCE — high-risk POS scenario ──
    it('returns effectiveRetailPrice = parent Item.RetailPrice when instance RetailPrice is null', async () => {
      const item = await seedItem({ RetailPrice: 1299.0 });
      const inv = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: null });
      const res = await request(app).get(`/api/inventory/${inv.InventoryItemId}`);
      expect(res.body.effectiveRetailPrice).toBe(1299.0);
    });

    it('returns effectiveRetailPrice = instance override regardless of Item.RetailPrice', async () => {
      const item = await seedItem({ RetailPrice: 1299.0 });
      const inv = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: 888 });
      const res = await request(app).get(`/api/inventory/${inv.InventoryItemId}`);
      expect(res.body.effectiveRetailPrice).toBe(888);
    });

    it('returns 404 INVENTORY_ITEM_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/inventory/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('INVENTORY_ITEM_NOT_FOUND');
    });
  });

  // ─── POST /api/inventory ────────────────────────────────────────────────────────

  describe('POST /api/inventory', () => {
    it('returns 201 and the full created InventoryItem', async () => {
      const item = await seedItem();
      const res = await request(app).post('/api/inventory').send({
        itemId: item.ItemId,
        storeId: DEFAULT_STORE_ID,
        acquisitionDate: '2026-06-13',
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({ inventoryItemId: expect.any(String) });
    });

    it('sets initial StatusId to the Active seed GUID', async () => {
      const item = await seedItem();
      const res = await request(app).post('/api/inventory').send({
        itemId: item.ItemId,
        storeId: DEFAULT_STORE_ID,
        acquisitionDate: '2026-06-13',
      });
      const row = await db.query(
        'SELECT StatusId FROM InventoryItem WHERE InventoryItemId = @id',
        { id: res.body.inventoryItemId }
      );
      expect(row.recordset[0].StatusId.toLowerCase()).toBe(STATUS.ACTIVE.toLowerCase());
    });

    it('inherits Item template price when cost/retailPrice are null', async () => {
      // TODO: implement — assert stored RetailPrice is null (inherits)
    });

    it('stores instance overrides when cost/retailPrice are provided', async () => {
      // TODO: implement
    });

    it('returns 400 VALIDATION_FAILED when itemId is missing', async () => {
      const res = await request(app).post('/api/inventory').send({
        storeId: DEFAULT_STORE_ID,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('itemId');
    });

    it('returns 404 ITEM_NOT_FOUND when itemId does not exist', async () => {
      const res = await request(app).post('/api/inventory').send({
        itemId: '00000000-0000-0000-0000-0000000000ff',
        storeId: DEFAULT_STORE_ID,
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ITEM_NOT_FOUND');
    });

    it('returns 404 STORE_NOT_FOUND when storeId does not exist', async () => {
      const item = await seedItem();
      const res = await request(app).post('/api/inventory').send({
        itemId: item.ItemId,
        storeId: '00000000-0000-0000-0000-0000000000ff',
      });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('STORE_NOT_FOUND');
    });
  });

  // ─── PUT /api/inventory/:id ─────────────────────────────────────────────────────

  describe('PUT /api/inventory/:id', () => {
    it('returns 200 and the updated InventoryItem', async () => {
      const inv = await seedInventoryItem();
      const res = await request(app)
        .put(`/api/inventory/${inv.InventoryItemId}`)
        .send({ notes: 'Display case A' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ notes: 'Display case A' });
    });

    it('writes one InventoryHistory row per changed column', async () => {
      const inv = await seedInventoryItem({ StatusId: STATUS.ACTIVE });
      await request(app)
        .put(`/api/inventory/${inv.InventoryItemId}`)
        .send({ statusId: STATUS.ON_HOLD });
      const hist = await db.query(
        "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'StatusId'",
        { id: inv.InventoryItemId }
      );
      expect(hist.recordset.length).toBe(1);
      expect(hist.recordset[0].AfterValue.toLowerCase()).toBe(STATUS.ON_HOLD.toLowerCase());
    });

    it('writes InventoryHistory on a store move', async () => {
      const store = await seedStore();
      const inv = await seedInventoryItem({ StoreId: DEFAULT_STORE_ID });
      await request(app)
        .put(`/api/inventory/${inv.InventoryItemId}`)
        .send({ storeId: store.StoreId });
      const hist = await db.query(
        "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'StoreId'",
        { id: inv.InventoryItemId }
      );
      expect(hist.recordset.length).toBe(1);
    });

    it('does NOT write InventoryHistory for an unchanged column', async () => {
      // TODO: implement
    });

    it('returns 404 INVENTORY_ITEM_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/inventory/00000000-0000-0000-0000-0000000000ff')
        .send({ notes: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('INVENTORY_ITEM_NOT_FOUND');
    });
  });
});

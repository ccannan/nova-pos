const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const {
  seedSupplier, seedCategory, seedItem,
  seedInventoryItem, clearAll,
} = require('../helpers/seeds');
const { STATUS } = require('../helpers/constants');

describe('Items — /api/items', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/items ────────────────────────────────────────────────────────────

  describe('GET /api/items', () => {
    it('returns 200 and a paginated list with category/supplier names', async () => {
      const sup = await seedSupplier({ SupplierName: 'Pandora' });
      const cat = await seedCategory({ CategoryName: 'Ring' });
      await seedItem({ SupplierId: sup.SupplierId, CategoryId: cat.CategoryId, DesignNo: 'ABC-001' });
      const res = await request(app).get('/api/items');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({
            itemId: expect.any(String),
            designNo: 'ABC-001',
            categoryName: 'Ring',
            supplierName: 'Pandora',
            stockCount: expect.any(Number),
          }),
        ]),
      });
    });

    it('reports stockCount as the count of linked Active InventoryItems', async () => {
      const item = await seedItem();
      await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.ACTIVE });
      await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.ACTIVE });
      await seedInventoryItem({ ItemId: item.ItemId, StatusId: STATUS.SOLD });
      const res = await request(app).get(`/api/items?search=${item.DesignNo}`);
      const row = res.body.results.find((r) => r.itemId === item.ItemId);
      expect(row.stockCount).toBe(2);
    });

    it('filters by supplierId', async () => {
      // TODO: implement
    });

    it('filters by categoryId', async () => {
      // TODO: implement
    });

    it('matches on Description and DesignNo via the search param', async () => {
      // TODO: implement
    });

    it('returns empty results when no item matches the search term', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/items/:id ──────────────────────────────────────────────────────────

  describe('GET /api/items/:id', () => {
    it('returns 200 and the full item detail including attributes array', async () => {
      const item = await seedItem();
      const res = await request(app).get(`/api/items/${item.ItemId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        itemId: item.ItemId,
        attributes: expect.any(Array),
      });
    });

    it('returns 404 ITEM_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/items/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ITEM_NOT_FOUND');
    });
  });

  // ─── POST /api/items ───────────────────────────────────────────────────────────

  describe('POST /api/items', () => {
    it('returns 201 and the full created item', async () => {
      const sup = await seedSupplier();
      const cat = await seedCategory();
      const res = await request(app).post('/api/items').send({
        supplierId: sup.SupplierId,
        categoryId: cat.CategoryId,
        designNo: 'ABC-001',
        description: 'Diamond Solitaire Ring',
        retailPrice: 1299.0,
        cost: 650.0,
      });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        itemId: expect.any(String),
        designNo: 'ABC-001',
      });
    });

    it('persists the item row to the DB', async () => {
      const sup = await seedSupplier();
      const cat = await seedCategory();
      const res = await request(app).post('/api/items').send({
        supplierId: sup.SupplierId,
        categoryId: cat.CategoryId,
        designNo: 'PERSIST-1',
      });
      const row = await db.query('SELECT * FROM Item WHERE ItemId = @id', { id: res.body.itemId });
      expect(row.recordset.length).toBe(1);
    });

    it('creates ItemAttrib rows when attributes are provided', async () => {
      // TODO: implement — provide attributes, assert ItemAttrib rows written
    });

    it('stores attribTypeListId as null for free-text attributes', async () => {
      // TODO: implement
    });

    it('succeeds when attributes are omitted (optional)', async () => {
      // TODO: implement
    });

    it('returns 400 VALIDATION_FAILED when designNo is missing', async () => {
      const sup = await seedSupplier();
      const cat = await seedCategory();
      const res = await request(app).post('/api/items').send({
        supplierId: sup.SupplierId,
        categoryId: cat.CategoryId,
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('designNo');
    });

    it('returns 400 VALIDATION_FAILED when an attribute is missing attribValue', async () => {
      // TODO: implement — attribValue is always required per contract
    });

    it('returns 400 when retailPrice is a non-numeric type', async () => {
      // TODO: implement — type mismatch
    });

    it('returns 409 DESIGN_EXISTS for a duplicate SupplierId + DesignNo', async () => {
      const sup = await seedSupplier();
      const cat = await seedCategory();
      await seedItem({ SupplierId: sup.SupplierId, CategoryId: cat.CategoryId, DesignNo: 'DUP-1' });
      const res = await request(app).post('/api/items').send({
        supplierId: sup.SupplierId,
        categoryId: cat.CategoryId,
        designNo: 'DUP-1',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('DESIGN_EXISTS');
    });

    it('allows the same DesignNo under a different supplier', async () => {
      // TODO: implement — unique constraint is on the pair, not DesignNo alone
    });
  });

  // ─── PUT /api/items/:id ───────────────────────────────────────────────────────────

  describe('PUT /api/items/:id', () => {
    it('returns 200 and the updated full item', async () => {
      const item = await seedItem();
      const res = await request(app)
        .put(`/api/items/${item.ItemId}`)
        .send({ description: 'Updated Description' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ description: 'Updated Description' });
    });

    it('writes one ItemHistory row per changed column', async () => {
      const item = await seedItem({ Description: 'Old', RetailPrice: 100 });
      await request(app)
        .put(`/api/items/${item.ItemId}`)
        .send({ description: 'New', retailPrice: 200 });
      const hist = await db.query(
        'SELECT * FROM ItemHistory WHERE ItemId = @id',
        { id: item.ItemId }
      );
      const cols = hist.recordset.map((r) => r.ColumnName);
      expect(cols).toEqual(expect.arrayContaining(['Description', 'RetailPrice']));
    });

    it('records the correct BeforeValue/AfterValue in ItemHistory', async () => {
      const item = await seedItem({ RetailPrice: 100 });
      await request(app).put(`/api/items/${item.ItemId}`).send({ retailPrice: 250 });
      const hist = await db.query(
        "SELECT * FROM ItemHistory WHERE ItemId = @id AND ColumnName = 'RetailPrice'",
        { id: item.ItemId }
      );
      expect(hist.recordset[0].BeforeValue).toBe('100');
      expect(hist.recordset[0].AfterValue).toBe('250');
    });

    it('does NOT write an ItemHistory row for a column that did not change', async () => {
      const item = await seedItem({ Description: 'Same', RetailPrice: 100 });
      await request(app).put(`/api/items/${item.ItemId}`).send({ description: 'Same' });
      const hist = await db.query(
        'SELECT * FROM ItemHistory WHERE ItemId = @id',
        { id: item.ItemId }
      );
      expect(hist.recordset.length).toBe(0);
    });

    // ── Price cascade — the high-risk POS scenario ──
    describe('RetailPrice cascade to InventoryHistory', () => {
      it('writes one InventoryHistory EffectiveRetailPrice row per inheriting instance', async () => {
        const item = await seedItem({ RetailPrice: 100 });
        // two inheriting instances (RetailPrice null)
        const inhA = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: null });
        const inhB = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: null });
        // one override instance
        await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: 999 });

        await request(app).put(`/api/items/${item.ItemId}`).send({ retailPrice: 200 });

        const hist = await db.query(
          "SELECT * FROM InventoryHistory WHERE ColumnName = 'EffectiveRetailPrice' AND InventoryItemId IN (@a, @b)",
          { a: inhA.InventoryItemId, b: inhB.InventoryItemId }
        );
        expect(hist.recordset.length).toBe(2);
      });

      it('writes ZERO InventoryHistory rows for the instance with a price override', async () => {
        const item = await seedItem({ RetailPrice: 100 });
        await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: null });
        const override = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: 999 });

        await request(app).put(`/api/items/${item.ItemId}`).send({ retailPrice: 200 });

        const hist = await db.query(
          'SELECT * FROM InventoryHistory WHERE InventoryItemId = @id',
          { id: override.InventoryItemId }
        );
        expect(hist.recordset.length).toBe(0);
      });

      it('records old and new effective price in the InventoryHistory cascade rows', async () => {
        const item = await seedItem({ RetailPrice: 100 });
        const inh = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: null });
        await request(app).put(`/api/items/${item.ItemId}`).send({ retailPrice: 350 });
        const hist = await db.query(
          "SELECT * FROM InventoryHistory WHERE InventoryItemId = @id AND ColumnName = 'EffectiveRetailPrice'",
          { id: inh.InventoryItemId }
        );
        expect(hist.recordset[0].BeforeValue).toBe('100');
        expect(hist.recordset[0].AfterValue).toBe('350');
      });

      it('does NOT update the InventoryItem row itself for inheriting instances', async () => {
        // Per 02 History Strategy: no write to InventoryItem; price is COALESCE at query time.
        const item = await seedItem({ RetailPrice: 100 });
        const inh = await seedInventoryItem({ ItemId: item.ItemId, RetailPrice: null });
        await request(app).put(`/api/items/${item.ItemId}`).send({ retailPrice: 200 });
        const row = await db.query(
          'SELECT RetailPrice FROM InventoryItem WHERE InventoryItemId = @id',
          { id: inh.InventoryItemId }
        );
        expect(row.recordset[0].RetailPrice).toBeNull();
      });
    });

    it('replaces the full attribute set when attributes array is included', async () => {
      // TODO: implement — seed item w/ 2 attribs, PUT with 1, assert old gone
    });

    it('returns 404 ITEM_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/items/00000000-0000-0000-0000-0000000000ff')
        .send({ description: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('ITEM_NOT_FOUND');
    });

    it('returns 409 DESIGN_EXISTS when updating to a duplicate SupplierId + DesignNo', async () => {
      // TODO: implement
    });
  });
});

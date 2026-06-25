const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { seedStore, clearAll } = require('../helpers/seeds');

// NOTE: The Store module is referenced by the dependency order and inventory
// docs (`api-stores` — full CRUD). The API contracts doc (03) does not specify
// the request/response shapes for Store endpoints explicitly. The tests below
// follow the conventions established by the other lookup modules (paginated
// list, VALIDATION_FAILED on missing required field, STORE_NOT_FOUND from the
// error catalogue). See spec-ambiguity note in the summary.

describe('Stores — /api/stores', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/stores ──────────────────────────────────────────────────────

  describe('GET /api/stores', () => {
    it('returns 200 and a paginated list of stores', async () => {
      await seedStore({ StoreName: 'City Store' });
      const res = await request(app).get('/api/stores');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ storeName: 'City Store' }),
        ]),
      });
    });

    it('reflects total matching count, not page size, in total', async () => {
      // TODO: implement — seed > limit stores, assert total > results.length
    });

    it('applies page and limit params to produce correct offsets', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/stores/:id ────────────────────────────────────────────────────

  describe('GET /api/stores/:id', () => {
    it('returns 200 and the full store record', async () => {
      const store = await seedStore();
      const res = await request(app).get(`/api/stores/${store.StoreId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ storeId: store.StoreId });
    });

    it('returns 404 STORE_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/stores/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('STORE_NOT_FOUND');
    });
  });

  // ─── POST /api/stores ───────────────────────────────────────────────────────

  describe('POST /api/stores', () => {
    it('returns 201 and the created store on valid input', async () => {
      const res = await request(app)
        .post('/api/stores')
        .send({ storeName: 'New Store' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        storeId: expect.any(String),
        storeName: 'New Store',
      });
    });

    it('writes the store row to the DB', async () => {
      const res = await request(app)
        .post('/api/stores')
        .send({ storeName: 'Persisted Store' });
      const row = await db.query(
        'SELECT * FROM Store WHERE StoreId = @id',
        { id: res.body.storeId }
      );
      expect(row.recordset.length).toBe(1);
      expect(row.recordset[0].StoreName).toBe('Persisted Store');
    });

    it('returns 400 VALIDATION_FAILED and names the field when storeName is missing', async () => {
      const res = await request(app).post('/api/stores').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('storeName');
    });

    it('defaults isActive to true when omitted', async () => {
      // TODO: implement — assert created store isActive === true
    });

    it('accepts the maximum allowed storeName length (100 chars)', async () => {
      // TODO: implement
    });

    it('rejects storeName one character over the maximum with 400', async () => {
      // TODO: implement
    });
  });

  // ─── PUT /api/stores/:id ──────────────────────────────────────────────────────

  describe('PUT /api/stores/:id', () => {
    it('returns 200 and the updated store', async () => {
      const store = await seedStore();
      const res = await request(app)
        .put(`/api/stores/${store.StoreId}`)
        .send({ storeName: 'Renamed Store' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ storeName: 'Renamed Store' });
    });

    it('persists the change to the DB', async () => {
      // TODO: implement — direct SELECT, assert StoreName changed
    });

    it('returns 404 STORE_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/stores/00000000-0000-0000-0000-0000000000ff')
        .send({ storeName: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('STORE_NOT_FOUND');
    });

    it('does not modify unrelated store rows', async () => {
      // TODO: implement — seed two stores, update one, assert the other unchanged
    });
  });
});

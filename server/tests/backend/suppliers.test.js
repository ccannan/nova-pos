const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { seedSupplier, clearAll } = require('../helpers/seeds');

// NOTE: The API contracts doc (03) does not give explicit request/response
// shapes for the Supplier module. Tests follow lookup-module conventions and
// the data model (02). No dedicated SUPPLIER_NOT_FOUND code exists in the error
// catalogue — a generic 404 is asserted. See spec-ambiguity note in summary.

describe('Suppliers — /api/suppliers', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/suppliers ─────────────────────────────────────────────────────

  describe('GET /api/suppliers', () => {
    it('returns 200 and a paginated list of suppliers', async () => {
      await seedSupplier({ SupplierName: 'Pandora' });
      const res = await request(app).get('/api/suppliers');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ supplierName: 'Pandora' }),
        ]),
      });
    });

    it('matches suppliers by the search query param', async () => {
      // TODO: implement — seed two suppliers, search for one, assert filter
    });

    it('returns empty results when no supplier matches the search term', async () => {
      // TODO: implement
    });

    it('reflects total matching count, not page size, in total', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/suppliers/:id ──────────────────────────────────────────────────

  describe('GET /api/suppliers/:id', () => {
    it('returns 200 and the full supplier record', async () => {
      const sup = await seedSupplier();
      const res = await request(app).get(`/api/suppliers/${sup.SupplierId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ supplierId: sup.SupplierId });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/suppliers/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/suppliers ─────────────────────────────────────────────────────

  describe('POST /api/suppliers', () => {
    it('returns 201 and the created supplier on valid input', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .send({ supplierName: 'New Supplier' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        supplierId: expect.any(String),
        supplierName: 'New Supplier',
      });
    });

    it('writes the supplier row to the DB', async () => {
      const res = await request(app)
        .post('/api/suppliers')
        .send({ supplierName: 'Persisted Supplier' });
      const row = await db.query(
        'SELECT * FROM Supplier WHERE SupplierId = @id',
        { id: res.body.supplierId }
      );
      expect(row.recordset.length).toBe(1);
      expect(row.recordset[0].SupplierName).toBe('Persisted Supplier');
    });

    it('returns 400 VALIDATION_FAILED and names the field when supplierName is missing', async () => {
      const res = await request(app).post('/api/suppliers').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('supplierName');
    });

    it('stores optional contact fields (email, phone, address) when provided', async () => {
      // TODO: implement
    });

    it('accepts the maximum allowed supplierName length (100 chars)', async () => {
      // TODO: implement
    });

    it('rejects supplierName one character over the maximum with 400', async () => {
      // TODO: implement
    });
  });

  // ─── PUT /api/suppliers/:id ───────────────────────────────────────────────────

  describe('PUT /api/suppliers/:id', () => {
    it('returns 200 and the updated supplier', async () => {
      const sup = await seedSupplier();
      const res = await request(app)
        .put(`/api/suppliers/${sup.SupplierId}`)
        .send({ supplierName: 'Renamed' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ supplierName: 'Renamed' });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/suppliers/00000000-0000-0000-0000-0000000000ff')
        .send({ supplierName: 'x' });
      expect(res.status).toBe(404);
    });

    it('does not modify unrelated supplier rows', async () => {
      // TODO: implement
    });
  });
});

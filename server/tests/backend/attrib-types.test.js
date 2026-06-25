const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { seedAttribType, seedAttribTypeList, clearAll } = require('../helpers/seeds');

// NOTE: The api-attrib-types module owns both AttribType and AttribTypeList CRUD
// (per 04-dependency-order.md). 03-api-contracts.md does not specify these
// endpoints' shapes explicitly. Tests follow lookup conventions + the data
// model (02): AttribTypeName is UNIQUE; AttribTypeList rows require a valid
// AttribTypeId FK. Route paths assumed: /api/attrib-types and the nested
// /api/attrib-types/:id/list. See spec-ambiguity note in summary.

describe('AttribTypes — /api/attrib-types', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/attrib-types ───────────────────────────────────────────────────

  describe('GET /api/attrib-types', () => {
    it('returns 200 and a paginated list of attribute types', async () => {
      await seedAttribType({ AttribTypeName: 'metalType' });
      const res = await request(app).get('/api/attrib-types');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ attribTypeName: 'metalType' }),
        ]),
      });
    });

    it('returns empty results when none match the search term', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/attrib-types/:id ────────────────────────────────────────────────

  describe('GET /api/attrib-types/:id', () => {
    it('returns 200 and the attribute type record', async () => {
      const at = await seedAttribType();
      const res = await request(app).get(`/api/attrib-types/${at.AttribTypeId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ attribTypeId: at.AttribTypeId });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/attrib-types/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/attrib-types ──────────────────────────────────────────────────

  describe('POST /api/attrib-types', () => {
    it('returns 201 and the created attribute type on valid input', async () => {
      const res = await request(app)
        .post('/api/attrib-types')
        .send({ attribTypeName: 'stoneType' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        attribTypeId: expect.any(String),
        attribTypeName: 'stoneType',
      });
    });

    it('writes the attribute type row to the DB', async () => {
      const res = await request(app)
        .post('/api/attrib-types')
        .send({ attribTypeName: 'Length' });
      const row = await db.query(
        'SELECT * FROM AttribType WHERE AttribTypeId = @id',
        { id: res.body.attribTypeId }
      );
      expect(row.recordset.length).toBe(1);
    });

    it('returns 400 VALIDATION_FAILED and names the field when attribTypeName is missing', async () => {
      const res = await request(app).post('/api/attrib-types').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('attribTypeName');
    });

    it('returns 409 when attribTypeName already exists (unique constraint)', async () => {
      await seedAttribType({ AttribTypeName: 'Carat' });
      const res = await request(app)
        .post('/api/attrib-types')
        .send({ attribTypeName: 'Carat' });
      expect(res.status).toBe(409);
    });
  });

  // ─── PUT /api/attrib-types/:id ────────────────────────────────────────────────

  describe('PUT /api/attrib-types/:id', () => {
    it('returns 200 and the updated attribute type', async () => {
      const at = await seedAttribType();
      const res = await request(app)
        .put(`/api/attrib-types/${at.AttribTypeId}`)
        .send({ attribTypeName: 'itemStyle' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ attribTypeName: 'itemStyle' });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/attrib-types/00000000-0000-0000-0000-0000000000ff')
        .send({ attribTypeName: 'x' });
      expect(res.status).toBe(404);
    });
  });
});

describe('AttribTypeList — /api/attrib-types/:id/list', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET list values for a type ──────────────────────────────────────────────

  describe('GET /api/attrib-types/:id/list', () => {
    it('returns 200 and the list values for the given type', async () => {
      const at = await seedAttribType();
      await seedAttribTypeList({ AttribTypeId: at.AttribTypeId, Value: '18ct Yellow Gold' });
      const res = await request(app).get(`/api/attrib-types/${at.AttribTypeId}/list`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        results: expect.arrayContaining([
          expect.objectContaining({ value: '18ct Yellow Gold' }),
        ]),
      });
    });

    it('orders list values by SortOrder', async () => {
      // TODO: implement
    });

    it('returns 404 when the parent attribute type does not exist', async () => {
      const res = await request(app)
        .get('/api/attrib-types/00000000-0000-0000-0000-0000000000ff/list');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST a list value ────────────────────────────────────────────────────────

  describe('POST /api/attrib-types/:id/list', () => {
    it('returns 201 and the created list value', async () => {
      const at = await seedAttribType();
      const res = await request(app)
        .post(`/api/attrib-types/${at.AttribTypeId}/list`)
        .send({ value: 'Sterling Silver' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        attribTypeListId: expect.any(String),
        value: 'Sterling Silver',
      });
    });

    it('writes the list value row with the correct AttribTypeId FK', async () => {
      const at = await seedAttribType();
      const res = await request(app)
        .post(`/api/attrib-types/${at.AttribTypeId}/list`)
        .send({ value: 'Platinum' });
      const row = await db.query(
        'SELECT * FROM AttribTypeList WHERE AttribTypeListId = @id',
        { id: res.body.attribTypeListId }
      );
      expect(row.recordset[0].AttribTypeId).toBe(at.AttribTypeId);
    });

    it('returns 400 VALIDATION_FAILED when value is missing', async () => {
      const at = await seedAttribType();
      const res = await request(app)
        .post(`/api/attrib-types/${at.AttribTypeId}/list`)
        .send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('value');
    });

    it('returns 404 when the parent attribute type does not exist', async () => {
      const res = await request(app)
        .post('/api/attrib-types/00000000-0000-0000-0000-0000000000ff/list')
        .send({ value: 'x' });
      expect(res.status).toBe(404);
    });
  });
});

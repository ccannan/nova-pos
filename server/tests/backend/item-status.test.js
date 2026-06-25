const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { clearAll } = require('../helpers/seeds');
const { STATUS } = require('../helpers/constants');

// NOTE: api-item-status is CRUD + seed data. The seven seed rows (Active, Sold,
// On Hold, Layby, Consignment, Returned, Written Off) are created by the
// migration with fixed GUIDs (see constants.js) and are NOT removed by
// clearAll(). 03-api-contracts.md does not specify these endpoints' shapes
// explicitly. Tests follow lookup conventions + data model (02): StatusName is
// UNIQUE. See spec-ambiguity note in summary.

describe('ItemStatus — /api/item-status', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── Seed data invariants ─────────────────────────────────────────────────────

  describe('seed data', () => {
    it('GET /api/item-status returns the seven seeded statuses', async () => {
      const res = await request(app).get('/api/item-status');
      expect(res.status).toBe(200);
      const names = res.body.results.map((r) => r.statusName);
      expect(names).toEqual(
        expect.arrayContaining([
          'Active', 'Sold', 'On Hold', 'Layby',
          'Consignment', 'Returned', 'Written Off',
        ])
      );
    });

    it('seeds the Active status with the fixed known GUID', async () => {
      const row = await db.query(
        'SELECT * FROM ItemStatus WHERE ItemStatusId = @id',
        { id: STATUS.ACTIVE }
      );
      expect(row.recordset.length).toBe(1);
      expect(row.recordset[0].StatusName).toBe('Active');
    });

    it('seeds the Sold status with the fixed known GUID', async () => {
      const row = await db.query(
        'SELECT * FROM ItemStatus WHERE ItemStatusId = @id',
        { id: STATUS.SOLD }
      );
      expect(row.recordset.length).toBe(1);
      expect(row.recordset[0].StatusName).toBe('Sold');
    });
  });

  // ─── GET /api/item-status/:id ─────────────────────────────────────────────────

  describe('GET /api/item-status/:id', () => {
    it('returns 200 and the status record', async () => {
      const res = await request(app).get(`/api/item-status/${STATUS.ACTIVE}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        itemStatusId: STATUS.ACTIVE,
        statusName: 'Active',
      });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/item-status/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/item-status ────────────────────────────────────────────────────

  describe('POST /api/item-status', () => {
    it('returns 201 and the created status on valid input', async () => {
      const res = await request(app)
        .post('/api/item-status')
        .send({ statusName: 'In Repair' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        itemStatusId: expect.any(String),
        statusName: 'In Repair',
      });
      // Clean up the extra status this test created.
      await db.query('DELETE FROM ItemStatus WHERE ItemStatusId = @id', {
        id: res.body.itemStatusId,
      });
    });

    it('returns 400 VALIDATION_FAILED when statusName is missing', async () => {
      const res = await request(app).post('/api/item-status').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('statusName');
    });

    it('returns 409 when statusName already exists (unique constraint)', async () => {
      const res = await request(app)
        .post('/api/item-status')
        .send({ statusName: 'Active' });
      expect(res.status).toBe(409);
    });
  });

  // ─── PUT /api/item-status/:id ─────────────────────────────────────────────────

  describe('PUT /api/item-status/:id', () => {
    it('returns 200 and the updated status', async () => {
      // TODO: implement — create a disposable status, update its description,
      // assert 200, then delete it to keep seed set clean
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/item-status/00000000-0000-0000-0000-0000000000ff')
        .send({ description: 'x' });
      expect(res.status).toBe(404);
    });
  });
});

const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { seedCategory, clearAll } = require('../helpers/seeds');

// NOTE: Category endpoints are not given explicit shapes in 03-api-contracts.md.
// Tests follow lookup conventions and the data model (02). CategoryName has a
// UNIQUE index (02), so a duplicate-name conflict (409) is exercised. The exact
// conflict error code is not in the catalogue — see spec-ambiguity note.

describe('Categories — /api/categories', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/categories ─────────────────────────────────────────────────────

  describe('GET /api/categories', () => {
    it('returns 200 and a paginated list of categories', async () => {
      await seedCategory({ CategoryName: 'Ring' });
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        results: expect.arrayContaining([
          expect.objectContaining({ categoryName: 'Ring' }),
        ]),
      });
    });

    it('orders results by SortOrder when set', async () => {
      // TODO: implement — seed categories with SortOrder, assert order
    });

    it('returns empty results when no category matches the search term', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/categories/:id ──────────────────────────────────────────────────

  describe('GET /api/categories/:id', () => {
    it('returns 200 and the category record', async () => {
      const cat = await seedCategory();
      const res = await request(app).get(`/api/categories/${cat.CategoryId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ categoryId: cat.CategoryId });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/categories/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /api/categories ─────────────────────────────────────────────────────

  describe('POST /api/categories', () => {
    it('returns 201 and the created category on valid input', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({ categoryName: 'Watch' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        categoryId: expect.any(String),
        categoryName: 'Watch',
      });
    });

    it('writes the category row to the DB', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({ categoryName: 'Pendant' });
      const row = await db.query(
        'SELECT * FROM Category WHERE CategoryId = @id',
        { id: res.body.categoryId }
      );
      expect(row.recordset.length).toBe(1);
      expect(row.recordset[0].CategoryName).toBe('Pendant');
    });

    it('returns 400 VALIDATION_FAILED and names the field when categoryName is missing', async () => {
      const res = await request(app).post('/api/categories').send({});
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('categoryName');
    });

    it('returns 409 when categoryName already exists (unique constraint)', async () => {
      await seedCategory({ CategoryName: 'Earring' });
      const res = await request(app)
        .post('/api/categories')
        .send({ categoryName: 'Earring' });
      expect(res.status).toBe(409);
    });

    it('accepts the maximum allowed categoryName length (100 chars)', async () => {
      // TODO: implement
    });

    it('rejects categoryName one character over the maximum with 400', async () => {
      // TODO: implement
    });
  });

  // ─── PUT /api/categories/:id ──────────────────────────────────────────────────

  describe('PUT /api/categories/:id', () => {
    it('returns 200 and the updated category', async () => {
      const cat = await seedCategory();
      const res = await request(app)
        .put(`/api/categories/${cat.CategoryId}`)
        .send({ categoryName: 'Bracelet' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ categoryName: 'Bracelet' });
    });

    it('returns 404 for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/categories/00000000-0000-0000-0000-0000000000ff')
        .send({ categoryName: 'x' });
      expect(res.status).toBe(404);
    });

    it('returns 409 when renaming to an existing category name', async () => {
      // TODO: implement — seed two categories, rename one to the other's name
    });
  });
});

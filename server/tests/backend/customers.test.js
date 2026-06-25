const request = require('supertest');
const app = require('../../src/index');
const db = require('../helpers/db-test');
const { seedCustomer, seedCustContact, clearAll } = require('../helpers/seeds');

describe('Customers — /api/customers', () => {
  beforeAll(async () => { await db.connect(); });
  afterAll(async () => { await db.close(); });
  afterEach(async () => { await clearAll(); });

  // ─── GET /api/customers ───────────────────────────────────────────────────────

  describe('GET /api/customers', () => {
    it('returns 200 and a paginated list', async () => {
      await seedCustomer({ FirstName: 'Jane', LastName: 'Smith' });
      const res = await request(app).get('/api/customers');
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        total: expect.any(Number),
        page: 1,
        limit: 20,
        results: expect.arrayContaining([
          expect.objectContaining({
            customerId: expect.any(String),
            firstName: 'Jane',
            lastName: 'Smith',
          }),
        ]),
      });
    });

    it('matches on LastName via the search param', async () => {
      // TODO: implement
    });

    it('matches on FirstName via the search param', async () => {
      // TODO: implement
    });

    it('matches on a contact Value via the search param', async () => {
      // TODO: implement — seed customer + phone contact, search by the number
    });

    it('excludes soft-deleted customers from results', async () => {
      await seedCustomer({ LastName: 'Ghost', IsDeleted: 1 });
      const res = await request(app).get('/api/customers?search=Ghost');
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(0);
    });

    it('returns empty results when no customer matches the search term', async () => {
      const res = await request(app).get('/api/customers?search=zzzznomatch');
      expect(res.status).toBe(200);
      expect(res.body.results).toHaveLength(0);
    });

    it('reflects total matching count, not page size, in total', async () => {
      // TODO: implement
    });

    it('applies page and limit params to produce correct offsets', async () => {
      // TODO: implement
    });
  });

  // ─── GET /api/customers/:id ────────────────────────────────────────────────────

  describe('GET /api/customers/:id', () => {
    it('returns 200 and the full customer record including contacts', async () => {
      const cust = await seedCustomer();
      await seedCustContact({
        CustomerId: cust.CustomerId,
        ContactType: 'Phone',
        Value: '0412 000 000',
      });
      const res = await request(app).get(`/api/customers/${cust.CustomerId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        customerId: cust.CustomerId,
        contacts: expect.arrayContaining([
          expect.objectContaining({
            custContactId: expect.any(String),
            contactType: 'Phone',
            value: '0412 000 000',
            isPrimary: expect.any(Boolean),
          }),
        ]),
      });
    });

    it('returns address-type contacts with address columns populated', async () => {
      // TODO: implement — seed Address contact, assert addressLine1/city/etc
    });

    it('excludes soft-deleted contacts from the contacts array', async () => {
      const cust = await seedCustomer();
      await seedCustContact({ CustomerId: cust.CustomerId, Value: 'live@x.com', ContactType: 'Email', IsDeleted: 0 });
      await seedCustContact({ CustomerId: cust.CustomerId, Value: 'dead@x.com', ContactType: 'Email', IsDeleted: 1 });
      const res = await request(app).get(`/api/customers/${cust.CustomerId}`);
      const values = res.body.contacts.map((c) => c.value);
      expect(values).toContain('live@x.com');
      expect(values).not.toContain('dead@x.com');
    });

    it('returns 404 CUSTOMER_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .get('/api/customers/00000000-0000-0000-0000-0000000000ff');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CUSTOMER_NOT_FOUND');
    });

    it('returns 404 CUSTOMER_NOT_FOUND for a soft-deleted customer', async () => {
      const cust = await seedCustomer({ IsDeleted: 1 });
      const res = await request(app).get(`/api/customers/${cust.CustomerId}`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CUSTOMER_NOT_FOUND');
    });
  });

  // ─── POST /api/customers ───────────────────────────────────────────────────────

  describe('POST /api/customers', () => {
    it('returns 201 and the full created customer object', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({ firstName: 'Jane', lastName: 'Smith', notes: '' });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        customerId: expect.any(String),
        firstName: 'Jane',
        lastName: 'Smith',
        contacts: expect.any(Array),
      });
    });

    it('persists the customer row to the DB', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({ lastName: 'Persisted' });
      const row = await db.query(
        'SELECT * FROM Customer WHERE CustomerId = @id',
        { id: res.body.customerId }
      );
      expect(row.recordset.length).toBe(1);
      expect(row.recordset[0].IsDeleted).toBe(false);
    });

    it('creates customer with contacts when contacts array is provided', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({
          lastName: 'Smith',
          contacts: [
            { contactType: 'Phone', label: 'Mobile', value: '0412 000 000', isPrimary: true },
          ],
        });
      expect(res.status).toBe(201);
      const row = await db.query(
        'SELECT * FROM CustContact WHERE CustomerId = @id',
        { id: res.body.customerId }
      );
      expect(row.recordset.length).toBe(1);
    });

    it('succeeds with an empty contacts array', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({ lastName: 'Smith', contacts: [] });
      expect(res.status).toBe(201);
    });

    it('succeeds when contacts is omitted (optional)', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({ lastName: 'Smith' });
      expect(res.status).toBe(201);
    });

    it('returns 400 VALIDATION_FAILED and names the field when lastName is missing', async () => {
      const res = await request(app)
        .post('/api/customers')
        .send({ firstName: 'Jane' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
      expect(res.body.fields).toHaveProperty('lastName');
    });

    it('accepts the maximum allowed lastName length (100 chars)', async () => {
      // TODO: implement
    });

    it('rejects lastName one character over the maximum with 400', async () => {
      // TODO: implement
    });
  });

  // ─── PUT /api/customers/:id ─────────────────────────────────────────────────────

  describe('PUT /api/customers/:id', () => {
    it('returns 200 and the updated full customer object', async () => {
      const cust = await seedCustomer();
      const res = await request(app)
        .put(`/api/customers/${cust.CustomerId}`)
        .send({ firstName: 'Janet' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ firstName: 'Janet' });
    });

    it('updates only the supplied subset of fields', async () => {
      // TODO: implement — set notes only, assert lastName unchanged in DB
    });

    it('returns 404 CUSTOMER_NOT_FOUND for a non-existent id', async () => {
      const res = await request(app)
        .put('/api/customers/00000000-0000-0000-0000-0000000000ff')
        .send({ firstName: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CUSTOMER_NOT_FOUND');
    });

    it('returns 400 when lastName is explicitly set to null/empty', async () => {
      // TODO: implement
    });
  });

  // ─── POST /api/customers/:id/contacts ────────────────────────────────────────────

  describe('POST /api/customers/:id/contacts', () => {
    it('returns 201 and the created contact object', async () => {
      const cust = await seedCustomer();
      const res = await request(app)
        .post(`/api/customers/${cust.CustomerId}/contacts`)
        .send({ contactType: 'Email', label: 'Work', value: 'jane@x.com', isPrimary: true });
      expect(res.status).toBe(201);
      expect(res.body).toMatchObject({
        custContactId: expect.any(String),
        contactType: 'Email',
        value: 'jane@x.com',
      });
    });

    it('persists the contact row with the correct CustomerId FK', async () => {
      const cust = await seedCustomer();
      const res = await request(app)
        .post(`/api/customers/${cust.CustomerId}/contacts`)
        .send({ contactType: 'Phone', value: '0400 000 000' });
      const row = await db.query(
        'SELECT * FROM CustContact WHERE CustContactId = @id',
        { id: res.body.custContactId }
      );
      expect(row.recordset[0].CustomerId).toBe(cust.CustomerId);
    });

    it('returns 404 CUSTOMER_NOT_FOUND when the customer does not exist', async () => {
      const res = await request(app)
        .post('/api/customers/00000000-0000-0000-0000-0000000000ff/contacts')
        .send({ contactType: 'Phone', value: '0400 000 000' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CUSTOMER_NOT_FOUND');
    });

    it('returns 400 VALIDATION_FAILED for an invalid contactType enum value', async () => {
      const cust = await seedCustomer();
      const res = await request(app)
        .post(`/api/customers/${cust.CustomerId}/contacts`)
        .send({ contactType: 'Carrier Pigeon', value: 'x' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('VALIDATION_FAILED');
    });
  });

  // ─── PUT /api/customers/:id/contacts/:contactId ────────────────────────────────

  describe('PUT /api/customers/:id/contacts/:contactId', () => {
    it('returns 200 and the updated contact object', async () => {
      const cust = await seedCustomer();
      const contact = await seedCustContact({ CustomerId: cust.CustomerId });
      const res = await request(app)
        .put(`/api/customers/${cust.CustomerId}/contacts/${contact.CustContactId}`)
        .send({ value: '0499 999 999' });
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ value: '0499 999 999' });
    });

    it('returns 404 CONTACT_NOT_FOUND when the contact does not exist', async () => {
      const cust = await seedCustomer();
      const res = await request(app)
        .put(`/api/customers/${cust.CustomerId}/contacts/00000000-0000-0000-0000-0000000000ff`)
        .send({ value: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CONTACT_NOT_FOUND');
    });

    it('returns 404 CONTACT_NOT_FOUND when the contact belongs to a different customer', async () => {
      const custA = await seedCustomer();
      const custB = await seedCustomer();
      const contact = await seedCustContact({ CustomerId: custB.CustomerId });
      const res = await request(app)
        .put(`/api/customers/${custA.CustomerId}/contacts/${contact.CustContactId}`)
        .send({ value: 'x' });
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CONTACT_NOT_FOUND');
    });
  });

  // ─── DELETE /api/customers/:id/contacts/:contactId ─────────────────────────────

  describe('DELETE /api/customers/:id/contacts/:contactId', () => {
    it('returns 200 { deleted: true } and soft-deletes the contact', async () => {
      const cust = await seedCustomer();
      const contact = await seedCustContact({ CustomerId: cust.CustomerId });
      const res = await request(app)
        .delete(`/api/customers/${cust.CustomerId}/contacts/${contact.CustContactId}`);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({ deleted: true });
      const row = await db.query(
        'SELECT IsDeleted FROM CustContact WHERE CustContactId = @id',
        { id: contact.CustContactId }
      );
      expect(row.recordset[0].IsDeleted).toBe(true);
    });

    it('excludes the soft-deleted contact from a subsequent GET /api/customers/:id', async () => {
      const cust = await seedCustomer();
      const contact = await seedCustContact({ CustomerId: cust.CustomerId, Value: 'gone@x.com', ContactType: 'Email' });
      await request(app)
        .delete(`/api/customers/${cust.CustomerId}/contacts/${contact.CustContactId}`);
      const res = await request(app).get(`/api/customers/${cust.CustomerId}`);
      const ids = res.body.contacts.map((c) => c.custContactId);
      expect(ids).not.toContain(contact.CustContactId);
    });

    it('returns 404 CONTACT_NOT_FOUND when the contact does not exist', async () => {
      const cust = await seedCustomer();
      const res = await request(app)
        .delete(`/api/customers/${cust.CustomerId}/contacts/00000000-0000-0000-0000-0000000000ff`);
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('CONTACT_NOT_FOUND');
    });
  });
});

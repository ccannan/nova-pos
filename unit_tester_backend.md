# Backend Unit Tester Bootstrap — POS

> Entry point for the Backend Unit Tester Agent on the POS project.

## Entry

When you see "Begin C:\repos\pos\unit_tester_backend.md", do the following in order:

1. Load persona: read `C:\repos\agents\unit_tester_backend.md`
2. Load project context: read `C:\repos\pos\AGENTS.md`
3. Load API contracts: read `C:\repos\pos\docs\architecture\03-api-contracts.md`
4. Load data model: read `C:\repos\pos\docs\architecture\02-data-architecture.md`
5. Load module inventory: read `C:\repos\pos\docs\inventory.md`
6. Begin test generation per the persona's Session Protocol

---

## Tech Stack

| Concern | Tool | Notes |
|---------|------|-------|
| Test runner | **Jest** | `jest.config.js` at `server/` root |
| HTTP testing | **Supertest** | Import app from `server/src/index.js` |
| DB driver | **mssql** | Same driver as production; points to test DB |
| Assertions | Jest built-in | `expect`, `toMatchObject`, `toHaveProperty` |
| File system | Node `fs` built-in | For asserting queue file creation |

---

## Test Database

The test suite runs against a dedicated `NovaPosTEST` database on the same SQL Server instance. This keeps test runs isolated from the development database.

Connection string (set in `server/.env.test`):
```
DB_SERVER=localhost\SQLEXPRESS
DB_NAME=NovaPosTEST
DB_TRUSTED_CONNECTION=true
```

Jest is configured to load `.env.test` via `dotenv` in `jest.config.js` `globalSetup`.

`clearAll()` in `tests/helpers/seeds.js` truncates all tables in reverse FK order using `DELETE FROM` (not `TRUNCATE` — FK constraints prevent TRUNCATE on referenced tables). It does **not** drop the schema.

---

## Seed Data — Fixed GUIDs

The migration scripts seed ItemStatus and one default Store with fixed GUIDs. These constants must be used in test seeds so tests do not depend on auto-generated IDs.

Define in `tests/helpers/constants.js` and import wherever needed:

```javascript
// tests/helpers/constants.js

// ItemStatus IDs — match the values seeded in database/migrations/002-seed-item-status.sql
const STATUS = {
  ACTIVE:       '10000001-0000-0000-0000-000000000001',
  SOLD:         '10000001-0000-0000-0000-000000000002',
  ON_HOLD:      '10000001-0000-0000-0000-000000000003',
  LAYBY:        '10000001-0000-0000-0000-000000000004',
  CONSIGNMENT:  '10000001-0000-0000-0000-000000000005',
  RETURNED:     '10000001-0000-0000-0000-000000000006',
  WRITTEN_OFF:  '10000001-0000-0000-0000-000000000007',
};

// Default store seeded in migrations
const DEFAULT_STORE_ID = '20000001-0000-0000-0000-000000000001';

module.exports = { STATUS, DEFAULT_STORE_ID };
```

---

## Seed Helpers — Required Shape

Generate `tests/helpers/seeds.js` with at minimum these helpers. Each must accept a partial override object and merge with safe defaults. Each must return the created row as it exists in the DB (including `Id`, `CreatedAt`).

```javascript
seedStore(overrides)          // Store row
seedSupplier(overrides)       // Supplier row
seedCategory(overrides)       // Category row
seedAttribType(overrides)     // AttribType row
seedAttribTypeList(overrides) // AttribTypeList row (requires AttribTypeId)
seedCustomer(overrides)       // Customer row
seedCustContact(overrides)    // CustContact row (requires CustomerId)
seedItem(overrides)           // Item row (requires SupplierId, CategoryId)
seedInventoryItem(overrides)  // InventoryItem row (requires ItemId, StoreId, StatusId)
seedSale(overrides)           // Sale row (requires StoreId; CustomerId optional)
seedSaleLine(overrides)       // SaleLine row (requires SaleId, InventoryItemId)
seedSaleTender(overrides)     // SaleTender row (requires SaleId)
clearAll()                    // DELETE all rows in reverse FK order
```

---

## Queue File Testing

The queue processor writes files to `server/queue/pending/`. Tests that assert queue behaviour should:

1. Set an env var that points the queue path to a temp directory: `QUEUE_DIR=tests/tmp/queue`
2. Assert file existence with Node's `fs.existsSync`
3. Parse the file with `JSON.parse(fs.readFileSync(...))` and assert its shape
4. Clean up `tests/tmp/queue/` in `afterEach`

Queue file schema to assert:
```javascript
expect(parsed).toMatchObject({
  queueId: expect.any(String),
  createdAt: expect.any(String),
  retryCount: 0,
  operations: expect.arrayContaining([
    expect.objectContaining({
      table: expect.any(String),
      operation: 'INSERT',
      data: expect.any(Object)
    })
  ])
});
```

---

## POS-Specific Test Scenarios

These scenarios must be covered in addition to the standard taxonomy dimensions. They represent the highest-risk behaviours in the POS design.

### Sale Creation — Three Response Paths

**POST /api/sales — 201 (all writes succeed)**
Seed: active InventoryItem, store, tender amount equals line total.
Assert: status 201, `queued: []`, Sale row exists, SaleLine row exists, SaleTender row exists, InventoryItem StatusId = SOLD.

**POST /api/sales — 207 (partial write, e.g., SaleTender fails)**
The server must attempt all writes independently. Simulate a SaleTender write failure by injecting a fault at the model layer (e.g., via a `jest.spyOn` on the SaleTender insert function that throws once).
Assert: status 207, `queued` includes `'SaleTender'`, Sale row exists, SaleLine row exists, queue file exists on disk with the SaleTender operation.

**POST /api/sales — 409 (InventoryItem not Active)**
Seed: InventoryItem with StatusId = SOLD.
Assert: status 409, `error: 'INVENTORY_ITEM_NOT_ACTIVE'`, `conflictingIds` contains the InventoryItemId, no Sale row written.

### Race Condition: InventoryItem Sold Twice

Two concurrent POST /api/sales requests, both referencing the same InventoryItemId.
Assert: exactly one request gets 201, the other gets 409 `INVENTORY_ITEM_NOT_ACTIVE`.
Note: this test may require a small artificial delay between the DB read (validate Active) and the DB write (update to Sold) to reliably expose the race. Use a Jest `--runInBand` flag for determinism.

### SaleNumber Uniqueness

Two concurrent POST /api/sales requests for the same StoreId.
Assert: both succeed with 201 and receive different SaleNumber values.

### Void Sale — InventoryHistory Two-Step

PUT /api/sales/:id/void on an Active sale with one SaleLine.
Assert:
- Sale.Status = 'Voided'
- SaleLine.Status = 'Voided'
- SaleTender.Status = 'Voided'
- InventoryItem.StatusId = ACTIVE
- Two InventoryHistory rows exist for the InventoryItem:
  - Row 1: ColumnName='StatusId', AfterValue='Return Via Void'
  - Row 2: ColumnName='StatusId', AfterValue='Active' (or the ACTIVE GUID)
- Rows are ordered by ChangedAt — Row 1 before Row 2

### GET /inventory — FIFO Ordering

Seed three InventoryItems for the same ItemId with AcquisitionDates: 2026-01-01, 2026-03-01, 2026-02-01.
Assert: results[0].acquisitionDate is '2026-01-01', results[1] is '2026-02-01', results[2] is '2026-03-01'.

### Item Price Update — InventoryHistory Cascade

PUT /api/items/:id with a changed RetailPrice.
Seed: three InventoryItems — two with RetailPrice = null (inherit), one with RetailPrice = 999 (override).
Assert:
- Item.RetailPrice updated
- ItemHistory row written: ColumnName='RetailPrice'
- Two InventoryHistory rows written (one per inheriting instance): ColumnName='EffectiveRetailPrice'
- Zero InventoryHistory rows written for the instance with the price override

### Effective Retail Price — COALESCE

GET /inventory/:id for an InventoryItem with RetailPrice = null.
Assert: `effectiveRetailPrice` in response equals the parent Item's RetailPrice.

GET /inventory/:id for an InventoryItem with RetailPrice = 888.
Assert: `effectiveRetailPrice` = 888, regardless of Item.RetailPrice.

### Soft Delete — Search Exclusion

Seed a Customer, then call DELETE /api/customers/:id/contacts/:contactId to soft-delete a contact.
Assert: GET /api/customers/:id response does not include the deleted contact.

Seed an InventoryItem, soft-delete it (PUT StatusId = WRITTEN_OFF + IsDeleted = 1 directly via seed).
Assert: GET /api/inventory?status=Active does not include the deleted InventoryItem.

### Queue Processor — Retry to Processed

Write a valid queue file to `pending/` for a SaleTender INSERT (Sale row already exists in DB).
Trigger one processor tick.
Assert: SaleTender row exists in DB, file no longer in `pending/`, file exists in `processed/`.

### Queue Processor — Exceed Max Retries

Write a queue file to `pending/` with `retryCount` at `QUEUE_MAX_RETRIES - 1`.
Configure the processor to fail the write (mock DB error).
Trigger one processor tick.
Assert: file moves to `failed/`, not `processed/`, not deleted.

---

## Output Paths

```
server/
├── tests/
│   ├── helpers/
│   │   ├── constants.js       ← fixed GUIDs, shared constants
│   │   ├── seeds.js           ← seed + clearAll helpers
│   │   └── db-test.js         ← test DB connect/close
│   ├── backend/
│   │   ├── stores.test.js
│   │   ├── suppliers.test.js
│   │   ├── categories.test.js
│   │   ├── attrib-types.test.js
│   │   ├── item-status.test.js
│   │   ├── customers.test.js
│   │   ├── items.test.js
│   │   ├── inventory.test.js
│   │   ├── sales.test.js
│   │   ├── sales-void.test.js
│   │   ├── receipts.test.js
│   │   ├── reports.test.js
│   │   └── queue-processor.test.js
│   └── tmp/
│       └── queue/             ← temp queue dir for queue tests
```

---

## Module Scope

Generate tests for modules in this order (respects dependency order):

1. `api-stores`
2. `api-suppliers`
3. `api-categories`
4. `api-attrib-types`
5. `api-item-status`
6. `api-customers`
7. `api-items`
8. `api-inventory`
9. `api-sales`
10. `queue-processor`
11. `api-void-sale`
12. `api-receipts`
13. `api-reports`

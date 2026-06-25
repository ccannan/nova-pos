# NovaPOS — Claude Code Context

A point-of-sale and CRM system for jewellery retail, replacing an existing WinForms app.
Greenfield MVP. After-hours development. Craig is domain expert and final decision-maker.

## Tech Stack

- **Backend**: Node.js + Express, SQL Server (`NovaPOS` / `NovaPosTEST`), `sqlcmd` bridge
- **Frontend**: React + Tailwind CSS + Vite (not yet built)
- **Testing**: Jest + Supertest (backend), Vitest + RTL + MSW (frontend)
- **Auth**: Windows Integrated Auth (`Trusted_Connection=True`), no user auth in MVP

## Project Layout

```
server/src/
  db/          connection.js (query wrapper), sqlBridge.js (sqlcmd bridge)
  models/      DB access layer — PascalCase column names
  controllers/ HTTP layer — camelCase ↔ PascalCase conversion
  routes/      Express routers
  middleware/  errorHandler.js, requestLogger.js
server/tests/
  backend/     Jest + Supertest test files (written before implementation)
  helpers/     seeds.js, db-test.js, constants.js
docs/
  architecture/  01-context-and-scope.md, 02-data-architecture.md,
                 03-api-contracts.md, 04-dependency-order.md
  inventory.md   Module status tracker — keep this current
```

## Key Conventions

**Case conversion**: API request/response bodies use camelCase. DB columns are PascalCase.
Controllers handle conversion via `toCamelCase(row)` and `toPascalCase(body)`.

**SQL bridge**: `connection.js` inlines parameters into SQL via string replacement.
Parameters must have distinct names — `@SupplierId` and `@Id` in the same query
will conflict because `@Id` matches inside `@SupplierId`. Use full column names
as param names (`@ItemId`, `@SupplierId`, etc.) to stay safe.

**DB return types**: All values come back as strings from sqlcmd pipe output.
Exception: columns matching `/^Is/i` with value `'0'` or `'1'` are auto-converted
to booleans by sqlBridge. Money/numeric columns return as strings like `'100.0000'`.
Use `parseFloat(String(val))` when comparing or storing numeric values.

**Response shape** (list endpoints):
```json
{ "total": N, "page": 1, "limit": 20, "results": [...] }
```

**Error shape**:
```json
{ "error": "VALIDATION_FAILED", "message": "...", "fields": { "field": "Required." } }
```

**No DELETE endpoints** — soft delete only (`IsDeleted = 1` or `IsActive = 0`).

**History tables**: `ItemHistory` and `InventoryHistory` store column-level change audit.
`BeforeValue`/`AfterValue` are `nvarchar(max)` — store as clean numeric strings
(use `String(parseFloat(val))`) for money columns, plain `String(val)` for text.

**Seed GUIDs** (fixed — used in tests):
- `ItemStatus ACTIVE`: `10000001-0000-0000-0000-000000000001`
- `Default Store`:     `20000001-0000-0000-0000-000000000001`

## UI Concept

`concept.html` (repo root) is the approved single-file interactive prototype for the React frontend.
Dark Luxe theme (bg `#0D1117`, gold `#D4A843`). Use it as the design reference for all frontend modules.
Layout: collapsible left sidebar → pages for POS, Customers, Items, Inventory, Suppliers.
POS screen: customer pill + item search → sale lines → right-panel totals/tender/change.
CRUD pages: toolbar + filterable table + slide-in drawer form.

## Current State

Waves 1-4 complete. Wave 5 in progress.

| Wave | Modules | Status |
|------|---------|--------|
| 1 | db-schema, express-bootstrap | done |
| 2 | api-stores, api-suppliers, api-categories, api-attrib-types, api-item-status, api-customers | done |
| 3 | api-items, api-inventory | done |
| 4 | api-sales, queue-processor | done |
| 5 | api-void-sale, api-receipts | in-progress |
| 6 | api-reports | planned |
| — | All frontend modules | planned |

**Sale model exports**: `checkAndClaimInventoryItems`, `revertInventoryItems`, `insertSale`,
`insertSaleLine`, `insertSaleTender`, `insertInventoryHistory`, `findSales`, `findSaleById`.
Tests spy on `insertSale` (202 path) and `insertSaleTender` (207 path) directly.

**Queue files**: written to `QUEUE_DIR` env var or `server/tests/tmp/queue/` (test default).
Format: `{ queueId, createdAt, retryCount, operations: [{ table, operation, data }] }`.
Responses: 201 (all OK), 207 (partial — `queued: ['SaleTender']`), 202 (full failure — `{ queued: true, queueRef, message }`).

**UUID casing**: `crypto.randomUUID()` returns lowercase; SQL Server `uniqueidentifier` returns uppercase
from sqlcmd. Normalise to lowercase with `.toLowerCase()` when comparing UUIDs in GET responses.

## Development Workflow

Tests are written before implementation. To start a new module:
1. Read `docs/architecture/03-api-contracts.md` for the endpoint spec
2. Read the test file in `server/tests/backend/<module>.test.js`
3. Run tests to confirm they fail: `cd server && npm test -- --testPathPattern=<module>`
4. Implement model → controller → route → register in `index.js`
5. Run tests until green
6. Update `docs/inventory.md` status to `done`

## Running Tests

```powershell
cd server
npm test                                          # full suite
npm test -- --testPathPattern=items               # single module
npm test -- --testPathPattern=items --verbose     # with test names
```

Test DB is `NovaPosTEST`. Connection config is in `server/.env.test`.
`clearAll()` in seeds.js deletes all rows in reverse FK order after each test.
The seeded ItemStatus rows and default Store row are preserved across tests.

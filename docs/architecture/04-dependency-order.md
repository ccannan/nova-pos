# Dependency Order — POS Build Plan
*Pass 4 output · 2026-06-13*

---

## Module Registry

22 modules total. All start as `planned`. Agents update status as work progresses.

### Backend

| Module | Description | Dependencies |
|--------|-------------|--------------|
| `db-schema` | NovaPOS database creation, all migration scripts, connection pool | — |
| `express-bootstrap` | Server entry point, middleware, error handler, `.env` config | `db-schema` |
| `api-stores` | Store CRUD | `express-bootstrap` |
| `api-suppliers` | Supplier CRUD | `express-bootstrap` |
| `api-categories` | Category CRUD | `express-bootstrap` |
| `api-attrib-types` | AttribType + AttribTypeList CRUD | `express-bootstrap` |
| `api-item-status` | ItemStatus CRUD + seed data | `express-bootstrap` |
| `api-customers` | Customer + CustContact CRUD | `express-bootstrap` |
| `api-items` | Item + ItemAttrib CRUD; ItemHistory writes on update | `api-suppliers`, `api-categories`, `api-attrib-types` |
| `api-inventory` | InventoryItem CRUD + search; InventoryHistory writes on update | `api-items`, `api-stores`, `api-item-status` |
| `api-sales` | Sale create + list + get; SaleLine + SaleTender writes; InventoryItem status update | `api-inventory`, `api-customers`, `api-stores` |
| `queue-processor` | Background timer service; reads pending queue files; retries failed DB writes | `express-bootstrap`, `api-sales` write patterns |
| `api-void-sale` | PUT /sales/:id/void; InventoryHistory two-step write | `api-sales` |
| `api-receipts` | HTML receipt generation; writes to Sale.ReceiptContent; GET /sales/:id/receipt | `api-sales` |
| `api-reports` | GET /reports/sales with summary / per-sale / full detail; CSV export | `api-sales` |

### Frontend

| Module | Description | Dependencies |
|--------|-------------|--------------|
| `client-shell` | Vite project setup, React Router, layout, nav skeleton | — |
| `ui-customers` | Customer search, view, create, edit pages; contact management | `client-shell`, `api-customers` |
| `ui-items` | Item search, view, create, edit pages; attribute management | `client-shell`, `api-items` |
| `ui-inventory` | Inventory search, InventoryItem detail, add-to-stock form | `client-shell`, `api-inventory` |
| `ui-sale-screen` | POS transaction screen: item search, sale lines, tender entry, complete sale | `ui-inventory`, `ui-customers`, `api-sales` |
| `ui-reports` | Sales report screen: date picker, detail toggle, CSV/print export | `client-shell`, `api-reports` |
| `ui-receipt` | Receipt iframe display, browser print trigger | `client-shell`, `api-receipts` |

---

## Build Waves

### Wave 1 — Foundation
*Sequential. Nothing else can start until both complete.*

```
[db-schema] ──► [express-bootstrap]
```

| Module | What to build |
|--------|--------------|
| `db-schema` | Create `NovaPOS` database. Write migration scripts for all 17 tables in schema order (lookup tables first, then entities, then transactional). Create connection pool module (`server/src/db/connection.js`). |
| `express-bootstrap` | Server entry point (`server/src/index.js`). JSON body parser, CORS, request logger, global error handler. Health check route `GET /api/health`. Load `.env`. |

`db-schema` and `express-bootstrap` can be **authored in parallel** — the migration scripts do not require the Express server to exist, and the server scaffold does not need a live DB. Integration (wiring the pool into the server) is the only sequential step.

---

### Wave 2 — Lookup APIs + React Shell
*All seven modules are fully independent. Assign to parallel agents.*

```
[api-stores]  [api-suppliers]  [api-categories]  [api-attrib-types]
[api-item-status]  [api-customers]  [client-shell]
```

| Module | Notes |
|--------|-------|
| `api-stores` | Full CRUD. No FK dependencies on other API modules. |
| `api-suppliers` | Full CRUD. No FK dependencies. |
| `api-categories` | Full CRUD. Seed with: Ring, Chain, Watch, Earring, Pendant, Bracelet. |
| `api-attrib-types` | AttribType CRUD first, then AttribTypeList CRUD (internal dependency). Both live in this module. |
| `api-item-status` | Full CRUD. **Seed on first run**: Active, Sold, On Hold, Layby, Consignment, Returned, Written Off. These IDs are referenced by `api-inventory` and `api-sales`. |
| `api-customers` | Customer + CustContact CRUD. CustContact sub-resource is part of this module. |
| `client-shell` | Vite + React project (`client/`). Install Tailwind. Set up React Router with placeholder routes for: `/customers`, `/items`, `/inventory`, `/sale`, `/reports`. Shared layout component with nav. |

---

### Wave 3 — Item Designs
*Depends on: `api-suppliers`, `api-categories`, `api-attrib-types` from Wave 2.*

```
[api-items]
```

| Module | Notes |
|--------|-------|
| `api-items` | Item CRUD + embedded ItemAttrib management. On PUT, write `ItemHistory` rows for every changed column. On `retailPrice` / `cost` change, write `InventoryHistory` rows for affected InventoryItems (those with NULL price override). The attribute array on PUT replaces the full set for the item. |

`ui-customers` and `ui-items` (frontend) **can be built in parallel with Wave 3** by working against mocked API responses. They do not block Wave 3 and Wave 3 does not block them.

---

### Wave 4 — Inventory
*Depends on: `api-items` (Wave 3), `api-stores`, `api-item-status` (Wave 2).*

```
[api-inventory]
```

| Module | Notes |
|--------|-------|
| `api-inventory` | InventoryItem CRUD + search. Search results ordered by `AcquisitionDate ASC` (FIFO). `effectiveRetailPrice` = `COALESCE(InventoryItem.RetailPrice, Item.RetailPrice)` computed in query. All PUT changes write to `InventoryHistory`. Initial status on POST is 'Active' (resolved to `ItemStatusId` for the 'Active' seed row). |

`ui-inventory` frontend can begin alongside this wave.

---

### Wave 5 — Sales + Queue
*Depends on: `api-inventory` (Wave 4), `api-customers`, `api-stores` (Wave 2).*

```
[api-sales]  [queue-processor]
```

These two modules can be **built in parallel** — the queue processor reads queue files written by the sales controller and needs no direct call into `api-sales` code.

| Module | Notes |
|--------|-------|
| `api-sales` | Sale create / list / get. Sale creation follows the write sequence in `03-api-contracts.md`. `SaleNumber` must be generated atomically — use `SELECT MAX(SaleNumber) + 1 ... WITH (UPDLOCK)` inside the transaction, or a SQL `SEQUENCE` object per store. Failed write steps are written to `server/queue/pending/` as JSON files. |
| `queue-processor` | Background service started by the Express server on startup. Timer interval from `QUEUE_POLL_INTERVAL_MS` env var. Reads `pending/`, attempts writes, moves to `processed/` or `failed/`. Max retries from `QUEUE_MAX_RETRIES` env var. No HTTP routes — internal service only. |

`ui-sale-screen` frontend can begin against mocked `api-sales` endpoints during this wave.

---

### Wave 6 — Void, Receipts, Reports
*All three depend on `api-sales` (Wave 5). All three can be built in parallel.*

```
[api-void-sale]  [api-receipts]  [api-reports]
```

| Module | Notes |
|--------|-------|
| `api-void-sale` | PUT /sales/:id/void. Follows the void flow in `03-api-contracts.md`. Two `InventoryHistory` rows per item: 'Return Via Void' then 'Active'. Failed void steps follow the same queue strategy as sale creation. |
| `api-receipts` | On sale completion, generate HTML receipt from the written Sale + SaleLine + SaleTender data. Write to `Sale.ReceiptContent`. Expose `GET /api/sales/:id/receipt` returning `text/html`. Receipt template lives in `server/src/printing/receipt.template.js`. |
| `api-reports` | GET /reports/sales supporting `summary`, `per-sale`, `full` detail levels and `json` / `csv` format. Voided sales are excluded from totals but optionally shown with status. |

`ui-receipt` and `ui-reports` frontend modules can be built alongside this wave.

---

## Dependency Graph

```
db-schema ──────────────────────────────────────────────────────────────────────────────────┐
express-bootstrap ───────────────────────────────────────────────────────────────────────┐  │
                                                                                         │  │
Wave 2 (all parallel) ───────────────────────────────────────────────────────────────────▼──▼
  api-stores ────────────────────────────────────────────────────────────────────────────────► api-inventory
  api-suppliers ──────────────────────────────────────────────────────────────────────────────► api-items
  api-categories ─────────────────────────────────────────────────────────────────────────────► api-items
  api-attrib-types ───────────────────────────────────────────────────────────────────────────► api-items
  api-item-status ────────────────────────────────────────────────────────────────────────────► api-inventory
  api-customers ──────────────────────────────────────────────────────────────────────────────► api-sales
  client-shell ───────────────────────────────────────────────────────────────────────────────► all UI modules

Wave 3
  api-items (← api-suppliers, api-categories, api-attrib-types) ─────────────────────────────► api-inventory

Wave 4
  api-inventory (← api-items, api-stores, api-item-status) ─────────────────────────────────► api-sales

Wave 5 (parallel)
  api-sales (← api-inventory, api-customers, api-stores) ───────────────────────────────────► api-void-sale
                                                                                              ► api-receipts
                                                                                              ► api-reports
  queue-processor (← express-bootstrap)

Wave 6 (parallel)
  api-void-sale
  api-receipts
  api-reports
```

---

## Critical Path

The longest sequential chain — this is what determines the earliest the system can process a sale end-to-end:

```
db-schema
  → express-bootstrap
    → api-suppliers + api-categories + api-attrib-types  (parallel, Wave 2)
      → api-items  (Wave 3)
        → api-inventory  (Wave 4)
          → api-sales  (Wave 5)
```

6 stages. Everything off this path (stores, customers, queue-processor, all Wave 6 modules, all frontend) can be built in parallel without extending the timeline.

---

## Parallelisation Summary

| Wave | Parallel slots available |
|------|--------------------------|
| 1 | 2 (db-schema and express-bootstrap can be authored simultaneously; integrated at end) |
| 2 | 7 (all Wave 2 modules are independent) |
| 3 | 1 backend + N frontend (ui-customers, ui-items can build against mocks in parallel) |
| 4 | 1 backend + 1 frontend (ui-inventory can build alongside api-inventory) |
| 5 | 2 (api-sales + queue-processor) + 1 frontend (ui-sale-screen against mocks) |
| 6 | 3 (api-void-sale + api-receipts + api-reports) + 2 frontend (ui-receipt + ui-reports) |

Maximum parallelism is at Wave 2: up to 7 agents can be active simultaneously.

---

## Implementation Notes

**SaleNumber atomicity** (`api-sales`)  
`SaleNumber` must be unique per store and sequential. Use a `WITH (UPDLOCK, HOLDLOCK)` hint on the `MAX(SaleNumber)` query inside the sale creation transaction to prevent duplicate numbers under concurrent writes. Alternatively, create a SQL `SEQUENCE` object per store.

**ItemStatus seed data** (`api-item-status`)  
The 'Active' status row's `ItemStatusId` is referenced by `api-inventory` (POST /inventory sets initial status). Seed this row with a fixed known GUID defined in a constants file shared across modules, so the ID is stable across environments.

**Queue processor startup** (`queue-processor`)  
The processor is started by the Express server's startup sequence. If `pending/` contains files from a previous session (e.g., after a crash), the processor begins retrying them immediately on startup without waiting for the first timer tick.

**Frontend mock-first development**  
Frontend modules can be built against a local mock server (e.g., `msw` — Mock Service Worker) before their backing API is complete. This allows Wave F2 frontend work (`ui-customers`, `ui-items`) to proceed in parallel with Wave 3 backend work. The mock responses must match the shapes defined in `03-api-contracts.md` exactly.

**Receipt HTML template** (`api-receipts`)  
The template lives in `server/src/printing/receipt.template.js` and is a pure function: `generateReceipt(saleData) → htmlString`. It has no DB dependency — it takes the already-fetched sale object and returns HTML. This makes it independently testable and means the `ui-receipt` iframe renderer needs no changes when the template is updated.

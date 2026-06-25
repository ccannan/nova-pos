# Project Inventory — pos

> Managed by the Architect Agent. Updated each design and review session.

## Status Legend

| Status | Meaning |
|--------|---------|
| planned | Designed but not yet implemented |
| in-progress | Currently being built by a developer agent |
| done | Implemented and all tests pass |
| reviewed | Reviewed and signed off by architect |

## Modules

### Backend

| Module | Status | Dependencies | Key Files |
|--------|--------|-------------|-----------|
| `db-schema` | done | — | `server/src/db/connection.js`, `server/src/db/sqlBridge.js`, `server/src/db/migration-001-complete-schema.js` |
| `express-bootstrap` | done | `db-schema` | `server/src/index.js`, `server/src/middleware/` |
| `api-stores` | done | `express-bootstrap` | `server/src/routes/stores.js`, `server/src/controllers/stores.controller.js`, `server/src/models/store.model.js` |
| `api-suppliers` | done | `express-bootstrap` | `server/src/routes/suppliers.js`, `server/src/controllers/suppliers.controller.js`, `server/src/models/supplier.model.js` |
| `api-categories` | done | `express-bootstrap` | `server/src/routes/categories.js`, `server/src/controllers/categories.controller.js`, `server/src/models/category.model.js` |
| `api-attrib-types` | done | `express-bootstrap` | `server/src/routes/attribTypes.js`, `server/src/controllers/attribTypes.controller.js`, `server/src/models/attribType.model.js` |
| `api-item-status` | done | `express-bootstrap` | `server/src/routes/itemStatus.js`, `server/src/controllers/itemStatus.controller.js`, `server/src/models/itemStatus.model.js` |
| `api-customers` | done | `express-bootstrap` | `server/src/routes/customers.js`, `server/src/controllers/customers.controller.js`, `server/src/models/customer.model.js` |
| `api-items` | done | `api-suppliers`, `api-categories`, `api-attrib-types` | `server/src/routes/items.js`, `server/src/controllers/items.controller.js`, `server/src/models/item.model.js` |
| `api-inventory` | done | `api-items`, `api-stores`, `api-item-status` | `server/src/routes/inventory.js`, `server/src/controllers/inventory.controller.js`, `server/src/models/inventoryItem.model.js` |
| `api-sales` | done | `api-inventory`, `api-customers`, `api-stores` | `server/src/routes/sales.js`, `server/src/controllers/sales.controller.js`, `server/src/models/sale.model.js` |
| `queue-processor` | done | `express-bootstrap` | `server/src/queue/processor.js`, `server/queue/pending/`, `server/queue/processed/`, `server/queue/failed/` |
| `api-void-sale` | done | `api-sales` | `server/src/routes/sales.js` (PUT /:id/void), `server/src/controllers/voidSale.controller.js` |
| `api-receipts` | done | `api-sales` | `server/src/routes/sales.js` (GET /:id/receipt), `server/src/controllers/receipts.controller.js`, `server/src/printing/receipt.template.js` |
| `api-reports` | planned | `api-sales` | `server/src/routes/reports.js`, `server/src/controllers/reports.controller.js`, `server/src/models/report.model.js` |

### Frontend

| Module | Status | Dependencies | Key Files |
|--------|--------|-------------|-----------|
| `client-shell` | done | — | `client/src/App.jsx`, `client/src/main.jsx`, `client/src/api.js`, `client/src/index.css` |
| `ui-customers` | done | `client-shell`, `api-customers` | `client/src/pages/Customers/CustomerList.jsx`, `client/src/pages/Customers/CustomerDetail.jsx` |
| `ui-items` | done | `client-shell`, `api-items` | `client/src/pages/Items/ItemList.jsx`, `client/src/pages/Items/ItemDetail.jsx` |
| `ui-inventory` | done | `client-shell`, `api-inventory` | `client/src/pages/Inventory/InventorySearch.jsx` |
| `ui-sale-screen` | done | `ui-inventory`, `ui-customers`, `api-sales` | `client/src/pages/Sale/SaleScreen.jsx` |
| `ui-reports` | planned | `client-shell`, `api-reports` | `client/src/pages/Reports/`, `client/src/services/reports.service.js` |
| `ui-receipt` | planned | `client-shell`, `api-receipts` | `client/src/pages/Receipt/` |

## Design Documents

| Document | Status | Last Updated |
|----------|--------|-------------|
| 01-context-and-scope.md | draft | 2026-06-10 |
| 02-data-architecture.md | draft | 2026-06-13 |
| 03-api-contracts.md | draft | 2026-06-13 (rev 2) |
| 04-dependency-order.md | draft | 2026-06-13 |

## Agent Bootstrap Files

| File | Agent | Purpose |
|------|-------|---------|
| `C:\repos\agents\unit_tester_backend.md` | Backend Unit Tester | Generic persona — methodology, taxonomy, output format |
| `C:\repos\agents\unit_tester_frontend.md` | Frontend Unit Tester | Generic persona — methodology, taxonomy, output format |
| `C:\repos\pos\unit_tester_backend.md` | Backend Unit Tester | POS bootstrap — stack, seed GUIDs, POS-specific scenarios, module scope |
| `C:\repos\pos\unit_tester_frontend.md` | Frontend Unit Tester | POS bootstrap — stack, fixtures, POS-specific scenarios, module scope |
